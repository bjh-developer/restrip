"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { createClient } from "../../lib/supabase/client";
import { useAuth } from "../../hooks/useAuth";
import {
  generateMasterKey,
  deriveKEKFromPassword,
  wrapKey,
  unwrapKey,
  setEncryptionKey,
  getEncryptionKey,
} from "../../lib/encryption";

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface EmailPasswordAuthProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  signinOnly?: boolean; // Hide sign-up option when true
  passkeyLinking?: boolean; // Show password linking UI for passkey users
}

type AuthMode = "signin" | "signup";

export function EmailPasswordAuth({
  onSuccess,
  onError,
  signinOnly = false,
  passkeyLinking = false,
}: EmailPasswordAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [showAccountLinking, setShowAccountLinking] = useState(false);
  const [existingAccountMethod, setExistingAccountMethod] = useState<
    string | null
  >(null);
  const [passkeyAuthenticated, setPasskeyAuthenticated] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [showFullyRegisteredAccount, setShowFullyRegisteredAccount] =
    useState(false);

  const {
    setEncryptionKeyFromPassword,
    setEncryptionKeyFromPRF,
    setHasEncryptionKey,
  } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Handle passkey linking mode
  React.useEffect(() => {
    if (passkeyLinking) {
      setPasskeyAuthenticated(true);
      // For passkey linking, we assume the user is already authenticated
      // and we just need to get their user ID from the session
      const getUserId = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setVerifiedUserId(user.id);
          setEmail(user.email || "");
        }
      };
      getUserId();
    }
  }, [passkeyLinking, supabase.auth]);

  // Validate email format
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Validate password strength
  const isValidPassword = (password: string) => {
    return password.length >= 8;
  };

  // Handle sign in
  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        // Get wrapped master key from user metadata
        const wrappedKey = data.user.user_metadata?.wrapped_encryption_key;

        if (wrappedKey) {
          // Derive KEK from password and unwrap master key
          const saltString = data.user.id;
          const salt = new TextEncoder().encode(saltString);
          const kek = await deriveKEKFromPassword(password, salt);
          const masterKey = await unwrapKey(wrappedKey, kek);
          await setEncryptionKey(masterKey);
          setHasEncryptionKey(true); // Update auth context
          console.log("✅ Master key unwrapped from password KEK");
        } else {
          // Legacy user without wrapped key - migrate to key wrapping
          console.log("🔄 Migrating legacy user to key wrapping...");
          const saltString = data.user.id;
          const salt = new TextEncoder().encode(saltString);

          // Derive key using legacy method
          await setEncryptionKeyFromPassword(password, salt);

          // Get the key we just derived and wrap it for future use
          const masterKey = await getEncryptionKey();
          if (masterKey) {
            const kek = await deriveKEKFromPassword(password, salt);
            const wrappedKey = await wrapKey(masterKey, kek);

            // Store wrapped key in user metadata
            const { error: updateError } = await supabase.auth.updateUser({
              data: {
                wrapped_encryption_key: wrappedKey,
              },
            });

            if (updateError) {
              console.warn(
                "⚠️ Failed to migrate user to key wrapping:",
                updateError,
              );
            } else {
              console.log("✅ Successfully migrated user to key wrapping");
            }
          }
        }

        setShowSuccess(true);
        onSuccess?.();
      }
    } catch (err) {
      console.error("Sign in error:", err);
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sign up
  const handleSignUp = async () => {
    setError(null);

    // Validate inputs
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!isValidPassword(password)) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Generate master key and wrap it with password-derived KEK
      const masterKey = await generateMasterKey();
      const salt = new TextEncoder().encode(email); // Use email as salt for signup (will use user ID later)
      const kek = await deriveKEKFromPassword(password, salt);
      const wrappedKey = await wrapKey(masterKey, kek);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            auth_method: "password",
            wrapped_encryption_key: wrappedKey,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      // Check if this is an "email already exists" error
      if (signUpError) {
        console.log("Signup error:", signUpError.message);
        // Check if the error indicates email already exists
        if (
          signUpError.message?.includes("already registered") ||
          signUpError.message?.includes("already exists") ||
          signUpError.message?.includes("User already registered")
        ) {
          // Email already exists - check account type securely
          try {
            const checkResponse = await fetch("/api/auth/check-account-type", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });

            if (!checkResponse.ok) {
              throw new Error(
                `Account type check failed: ${checkResponse.status}`,
              );
            }

            const accountData = await checkResponse.json();
            console.log("Account type check response:", accountData);
            console.log("Has passkey:", accountData.hasPasskey);
            console.log("Account type:", accountData.accountType);

            if (accountData.accountType === "password_and_passkey") {
              // Account already has both passkey and password
              setExistingAccountMethod(accountData.accountType);
              setShowFullyRegisteredAccount(true);
              setError(null);
              setIsLoading(false);
              return;
            } else if (accountData.hasPasskey) {
              // Existing passkey account - offer to link password
              setExistingAccountMethod(accountData.accountType);
              setShowAccountLinking(true);
              setError(null);
              setIsLoading(false);
              return;
            } else {
              // Existing password account - suggest signing in
              setError(
                "An account with this email already exists. Please sign in instead.",
              );
              setMode("signin");
              setIsLoading(false);
              return;
            }
          } catch (checkError) {
            console.error("Account type check error:", checkError);
            // If we can't check account type, assume passkey for security and offer linking
            console.warn("Could not check account type:", checkError);
            setExistingAccountMethod("passkey");
            setShowAccountLinking(true);
            setError(null);
            setIsLoading(false);
            return;
          }
        } else {
          // Some other signup error
          throw signUpError;
        }
      }

      if (data.user) {
        // Check if email verification is required
        if (data.user.identities && data.user.identities.length === 0) {
          // Email already exists - check account type securely
          try {
            const checkResponse = await fetch("/api/auth/check-account-type", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });

            if (!checkResponse.ok) {
              throw new Error(
                `Account type check failed: ${checkResponse.status}`,
              );
            }

            const accountData = await checkResponse.json();
            console.log(
              "Account type check response (identities path):",
              accountData,
            );
            console.log(
              "Has passkey (identities path):",
              accountData.hasPasskey,
            );
            console.log(
              "Account type (identities path):",
              accountData.accountType,
            );

            if (accountData.accountType === "password_and_passkey") {
              // Account already has both passkey and password
              setExistingAccountMethod(accountData.accountType);
              setShowFullyRegisteredAccount(true);
              setError(null);
              setIsLoading(false);
              return;
            } else if (accountData.hasPasskey) {
              // Existing passkey account - offer to link password
              setExistingAccountMethod(accountData.accountType);
              setShowAccountLinking(true);
              setError(null);
              setIsLoading(false);
              return;
            } else {
              // Existing password account - suggest signing in
              setError(
                "An account with this email already exists. Please sign in instead.",
              );
              setMode("signin");
              setIsLoading(false);
              return;
            }
          } catch (checkError) {
            console.error(
              "Account type check error (identities path):",
              checkError,
            );
            // If we can't check account type, assume passkey for security and offer linking
            setExistingAccountMethod("passkey");
            setShowAccountLinking(true);
            setError(null);
            setIsLoading(false);
            return;
          }
        }

        // Set encryption key in memory immediately after signup
        // This allows users to upload memories even before email verification
        await setEncryptionKey(masterKey);
        setHasEncryptionKey(true);

        // Supabase requires email confirmation by default
        setNeedsEmailVerification(true);
        setShowSuccess(true);
      }
    } catch (err) {
      console.error("Sign up error:", err);
      const message = err instanceof Error ? err.message : "Sign up failed";
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  // Authenticate with passkey before allowing account linking
  const authenticateWithPasskey = async (
    createSession: boolean = true,
  ): Promise<{ success: boolean; userId?: string }> => {
    try {
      // Get authentication options from server
      const optionsRes = await fetch("/api/auth/passkey/login-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        throw new Error("Failed to get authentication options");
      }

      const { options, credentialSalts } = (await optionsRes.json()) as {
        options: PublicKeyCredentialRequestOptionsJSON;
        credentialSalts: Record<string, string>;
      };

      if (!options.allowCredentials || options.allowCredentials.length === 0) {
        throw new Error("No passkeys found for this account");
      }

      // For simplicity, use the first available salt (browser will handle credential selection)
      const credentialIds = Object.keys(credentialSalts);
      const firstSaltBase64 = credentialSalts[credentialIds[0]];
      const saltBytes = base64ToUint8Array(firstSaltBase64);

      // Update PRF extension with the salt
      const optionsWithSalt = {
        ...options,
        extensions: {
          ...options.extensions,
          prf: {
            eval: {
              first: saltBytes,
            },
          },
        },
      } as PublicKeyCredentialRequestOptionsJSON;

      // Start WebAuthn authentication
      const authResponse = await startAuthentication({
        optionsJSON: optionsWithSalt,
      });

      // Extract PRF output if available
      const prfOutput = (authResponse as any).clientExtensionResults?.prf
        ?.results?.first;

      // Determine which credential was used and get its salt
      const usedCredentialId = authResponse.id;
      const usedSalt = credentialSalts[usedCredentialId];

      if (!usedSalt) {
        throw new Error("No salt found for authenticated credential");
      }

      // Verify authentication with server
      const verifyRes = await fetch("/api/auth/passkey/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          response: authResponse,
          salt: usedSalt,
        }),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json();
        throw new Error(errorData.error || "Authentication failed");
      }

      const verifyData = await verifyRes.json();

      if (verifyData.token && createSession) {
        // Sign in to Supabase using the magic link token
        const { data: sessionData, error: signInError } =
          await supabase.auth.verifyOtp({
            token_hash: verifyData.token,
            type: "magiclink",
          });

        if (signInError || !sessionData.session) {
          throw new Error("Failed to create session");
        }

        // Set encryption key from PRF output if available
        if (prfOutput) {
          await setEncryptionKeyFromPRF(prfOutput);
          console.log("✅ Encryption key set from passkey PRF");
        } else {
          console.warn("⚠️ No PRF output received from passkey authentication");
        }
      }

      return { success: true, userId: verifyData.userId };
    } catch (err) {
      console.error("Passkey authentication error:", err);
      return { success: false };
    }
  };

  // Handle account linking (authenticate with passkey first)
  const handleAccountLinking = async () => {
    setError(null);
    setIsLoading(true);

    try {
      setError("Authenticating with your passkey...");
      const result = await authenticateWithPasskey(false); // Don't create session yet

      if (result.success && result.userId) {
        setVerifiedUserId(result.userId);
        setPasskeyAuthenticated(true);
        setError(null);
      } else {
        setError("Passkey authentication failed. Please try again.");
      }
    } catch (err) {
      console.error("Account linking error:", err);
      const message =
        err instanceof Error ? err.message : "Account linking failed";
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password linking after passkey authentication
  const handlePasswordLinking = async () => {
    setError(null);
    setIsLoading(true);

    try {
      setError("Linking password to your account...");
      console.log(
        "Calling link-account API with verified userId:",
        verifiedUserId,
      );

      // Get the existing master key from passkey session (before signing out)
      const existingMasterKey = await getEncryptionKey();
      if (!existingMasterKey) {
        throw new Error("No encryption key found. Please sign in with passkey first.");
      }

      // Wrap the existing master key with password KEK
      const saltString = verifiedUserId!;
      const salt = new TextEncoder().encode(saltString);
      const kek = await deriveKEKFromPassword(password, salt);
      const wrappedKey = await wrapKey(existingMasterKey, kek);
      console.log("🔑 Wrapped existing master key with password KEK");

      const response = await fetch("/api/auth/link-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "password",
          password,
          userId: verifiedUserId,
          wrappedKey, // Pass wrapped key to server
        }),
      });

      console.log("Link account response status:", response.status);
      const linkData = await response.json();
      console.log("Link account response data:", linkData);

      if (!response.ok) {
        throw new Error(linkData.error || "Failed to link account");
      }

      // Success - link the account first
      console.log("User ID after linking:", verifiedUserId);

      // Now sign in the user with the newly linked password
      console.log("Signing in user with linked password...");
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        console.error("Failed to sign in after linking:", signInError);
        throw new Error(
          "Account linked but failed to sign in. Please try signing in manually.",
        );
      }

      // Unwrap the master key that was wrapped and stored by the server
      const wrappedKey = signInData.user!.user_metadata?.wrapped_encryption_key;

      if (!wrappedKey) {
        throw new Error("Wrapped key not found after linking. Please try again.");
      }

      // Unwrap master key using password KEK
      const saltString = signInData.user!.id;
      const salt = new TextEncoder().encode(saltString);
      const kek = await deriveKEKFromPassword(password, salt);
      const masterKey = await unwrapKey(wrappedKey, kek);
      await setEncryptionKey(masterKey);
      setHasEncryptionKey(true); // Update auth context
      console.log("✅ Master key unwrapped after linking");

      console.log("User signed in successfully after linking");
      setShowSuccess(true);
      setVerifiedUserId(null); // Reset for next time
      onSuccess?.();
    } catch (err) {
      console.error("Account linking error:", err);
      const message =
        err instanceof Error ? err.message : "Account linking failed";
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passkeyAuthenticated) {
      await handlePasswordLinking();
    } else if (showAccountLinking) {
      await handleAccountLinking();
    } else if (mode === "signin") {
      await handleSignIn();
    } else {
      await handleSignUp();
    }
  };

  if (showSuccess) {
    if (needsEmailVerification) {
      return (
        <div className="text-center py-8">
          <div className="mb-4">
            <span className="text-4xl">📧</span>
          </div>
          <p className="text-gray-700 font-medium">Check your email</p>
          <p className="text-sm text-gray-500 mt-2">
            We've sent you a verification link. Click it to verify your account.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            After verifying, come back here and sign in with your password.
          </p>
        </div>
      );
    }

    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <span className="text-4xl">✅</span>
        </div>
        <p className="text-gray-700 font-medium">Signed in successfully!</p>
        <p className="text-sm text-gray-500 mt-2">
          Your data is protected with encryption derived from your password.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Mode toggle - only show if not signinOnly */}
      {!signinOnly && (
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              mode === "signin"
                ? "bg-white text-gray-900 shadow"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              mode === "signup"
                ? "bg-white text-gray-900 shadow"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Sign Up
          </button>
        </div>
      )}

      {/* Warning about password-based encryption */}
      {!signinOnly && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm">
            ⚠️ <strong>Note:</strong> Using email/password means your encryption
            key is derived from your password. Keep your password safe.
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Fully registered account (has both passkey and password) */}
      {showFullyRegisteredAccount && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            ✓ Account Already Registered
          </h3>
          <p className="text-sm text-blue-800 mb-3">
            This email is already registered with both passkey and password
            authentication. Please sign in using your preferred method.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setIsLoading(true);
                try {
                  const result = await authenticateWithPasskey(true);
                  if (result.success) {
                    onSuccess?.();
                  } else {
                    setError(
                      "Passkey authentication failed. Please try again.",
                    );
                  }
                } catch (err) {
                  console.error("Passkey authentication error:", err);
                  setError("An unexpected error occurred. Please try again.");
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition"
            >
              {isLoading ? "Authenticating..." : "🔑 Sign In With Passkey"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFullyRegisteredAccount(false);
                setMode("signin");
              }}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-blue-600 text-sm font-medium rounded border border-blue-300 transition"
            >
              🔒 Sign In With Password
            </button>
          </div>
        </div>
      )}

      {/* Account linking option */}
      {showAccountLinking && !passkeyAuthenticated && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            🔗 Link to Existing Account
          </h3>
          <p className="text-sm text-blue-800 mb-3">
            We found an existing account with passkey authentication for this
            email. To link a password, you'll need to authenticate with your
            passkey first for security.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAccountLinking}
              disabled={isLoading}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition"
            >
              {isLoading ? "Authenticating..." : "Authenticate & Link"}
            </button>
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setIsLoading(true);
                try {
                  const result = await authenticateWithPasskey(true); // Create session
                  if (result.success) {
                    onSuccess?.(); // Trigger success callback
                  } else {
                    setError(
                      "Passkey authentication failed. Please try again.",
                    );
                  }
                } catch (err) {
                  console.error("Passkey authentication error:", err);
                  setError("An unexpected error occurred. Please try again.");
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 font-medium transition"
            >
              {isLoading ? "Authenticating..." : "Sign In With Passkey Instead"}
            </button>
          </div>
        </div>
      )}

      {/* Password linking after passkey authentication */}
      {passkeyAuthenticated && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-semibold text-green-900 mb-2">
            ✅ Passkey Verified
          </h3>
          <p className="text-sm text-green-800 mb-3">
            Your passkey has been verified. Now create a password to link to
            your account.
          </p>
        </div>
      )}

      {/* Show form only when not in account linking mode or when password linking */}
      {(!showAccountLinking || passkeyAuthenticated) &&
      !showFullyRegisteredAccount ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email-password-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email address
            </label>
            <input
              id="email-password-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent outline-none transition"
              disabled={isLoading || showAccountLinking || passkeyAuthenticated}
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="email-password-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {passkeyAuthenticated ? "Create Password" : "Password"}
            </label>
            <input
              id="email-password-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent outline-none transition"
              disabled={isLoading}
              autoComplete={
                passkeyAuthenticated
                  ? "new-password"
                  : mode === "signin"
                    ? "current-password"
                    : "new-password"
              }
            />
            {(passkeyAuthenticated || mode === "signup") && (
              <p className="mt-1 text-xs text-gray-500">
                At least 8 characters
              </p>
            )}
            {mode === "signin" && !passkeyAuthenticated && (
              <Link
                href="/reset-password"
                className="mt-2 inline-block text-xs text-blue-500 hover:text-blue-700 underline"
              >
                Forget password?
              </Link>
            )}
          </div>

          {((mode === "signup" && !passkeyAuthenticated) ||
            (passkeyAuthenticated && confirmPassword)) && (
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={
              isLoading ||
              !password ||
              (passkeyAuthenticated
                ? password.length < 8
                : !email || (mode === "signup" && !confirmPassword))
            }
            className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white font-medium rounded-lg transition duration-200"
          >
            {isLoading
              ? "Please wait..."
              : passkeyAuthenticated
                ? "Link Password to Account"
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
