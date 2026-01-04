"use client";

import React, { useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { useAuth } from "../../hooks/useAuth";
import { usePasskeySupport } from "../../hooks/usePasskeySupport";
import { createClient } from "../../lib/supabase/client";
import {
  generateMasterKey,
  deriveKEKFromPRF,
  wrapKey,
  unwrapKey,
  setEncryptionKey,
  getEncryptionKey,
} from "../../lib/encryption";

// Helper to convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface PasskeyAuthProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

type AuthStep =
  | "email"
  | "passkey-choice"
  | "registering"
  | "authenticating"
  | "password-auth"
  | "success";

export function PasskeyAuth({ onSuccess, onError }: PasskeyAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<AuthStep>("email");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
  const [existingAccountType, setExistingAccountType] = useState<string | null>(
    null,
  );

  const { setEncryptionKeyFromPRF, setHasEncryptionKey, user } = useAuth();
  const { passkeySupported, isLoading: checkingSupport } = usePasskeySupport();

  // Check if user is already authenticated and needs to complete passkey registration
  React.useEffect(() => {
    // Check URL parameters for email verification
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isEmailVerification =
      hashParams.get("type") === "signup" || hashParams.get("type") === "email";

    if (
      user &&
      user.user_metadata?.auth_method === "passkey_pending_verification" &&
      user.email_confirmed_at
    ) {
      // User has verified email and is pending passkey registration
      setEmail(user.email || "");
      setStep("passkey-choice");
    } else if (window.location.hash === "#passkey-registration" && user) {
      // User is in passkey registration flow after password auth
      setEmail(user.email || "");
      setExistingAccountType("password");
      setStep("passkey-choice");
    } else if (
      isEmailVerification &&
      user &&
      user.user_metadata?.auth_method === "passkey_pending_verification"
    ) {
      // User just verified email and should create passkey
      setEmail(user.email || "");
      setStep("passkey-choice");
      // Clean up the hash but preserve search params
      const searchParams = new URLSearchParams(window.location.search);
      const newUrl = searchParams.toString()
        ? `${window.location.pathname}?${searchParams.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [user]);

  // Clear hash when registration is complete
  React.useEffect(() => {
    if (step === "success") {
      // Preserve search params when clearing hash
      const searchParams = new URLSearchParams(window.location.search);
      const newUrl = searchParams.toString()
        ? `${window.location.pathname}?${searchParams.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [step]);

  // Validate email format
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Check if user has existing passkeys
  const checkExistingCredentials = async (email: string) => {
    try {
      const res = await fetch("/api/auth/passkey/login-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      return data.options?.allowCredentials?.length > 0;
    } catch {
      return false;
    }
  };

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // First check if user has existing passkey credentials
      const hasCredentials = await checkExistingCredentials(email);
      setHasExistingCredentials(hasCredentials);

      // Check account type to see if there's an existing password account
      const accountCheckRes = await fetch("/api/auth/check-account-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (accountCheckRes.ok) {
        const accountData = await accountCheckRes.json();
        setExistingAccountType(accountData.accountType);

        // If user has existing password account but no passkey, prompt for password first
        if (accountData.accountType === "password" && !accountData.hasPasskey) {
          setStep("password-auth");
          // Add hash to indicate passkey registration flow
          window.location.hash = "passkey-registration";
          setIsLoading(false);
          return;
        }
      }

      if (hasCredentials) {
        // User has passkeys, go straight to authentication
        await handleLogin();
      } else {
        // New user, create temporary account to trigger email verification
        await createTempAccountForVerification();
      }
    } catch (err) {
      setError("Failed to check credentials. Please try again.");
      setIsLoading(false);
    }
  };

  // Handle password authentication for existing accounts
  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError("Please enter your password");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        // Password authentication successful, now proceed with passkey registration
        setStep("passkey-choice");
        // Clear sensitive password data from memory
        setPassword("");
      }
    } catch (err) {
      setError("Invalid password. Please try again.");
      setIsLoading(false);
    }
  };

  // Create temporary account to trigger Supabase email verification
  const createTempAccountForVerification = async () => {
    try {
      const supabase = createClient();

      // Create user with email_confirm: false to trigger verification email
      const { data, error } = await supabase.auth.signUp({
        email,
        password: crypto
          .getRandomValues(new Uint8Array(32))
          .reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), ""), // Cryptographically secure temporary password
        options: {
          data: {
            auth_method: "passkey_pending_verification",
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setError(null);
      setStep("passkey-choice");
      setIsLoading(false);
    } catch (err) {
      setError("Failed to send verification email. Please try again.");
      setIsLoading(false);
    }
  };

  // Helper to authenticate and wrap master key with PRF-derived KEK
  const authenticateAndWrapKey = async (
    credentialId: string,
    masterKey: CryptoKey,
  ) => {
    try {
      // Get authentication options
      const optionsRes = await fetch("/api/auth/passkey/login-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        throw new Error("Failed to get auth options for key wrapping");
      }

      const { options, credentialSalts } = await optionsRes.json();
      const saltBytes = base64ToUint8Array(credentialSalts[credentialId]);

      // Authenticate to get PRF output
      const authResponse = await startAuthentication({
        optionsJSON: {
          ...options,
          extensions: {
            ...options.extensions,
            prf: {
              eval: {
                first: saltBytes,
              },
            },
          },
        },
      });

      // Extract PRF output
      const extensionResults = authResponse.clientExtensionResults as {
        prf?: { results?: { first?: ArrayBuffer } };
      };

      if (!extensionResults?.prf?.results?.first) {
        console.warn("⚠️ No PRF output, cannot wrap key");
        return;
      }

      // Derive KEK from PRF and wrap master key
      const kek = await deriveKEKFromPRF(extensionResults.prf.results.first);
      const wrappedKey = await wrapKey(masterKey, kek);

      // Store wrapped key on server
      await fetch("/api/auth/passkey/store-wrapped-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId, wrappedKey }),
      });

      console.log("✅ Master key wrapped and stored for passkey");
    } catch (error) {
      console.error("Failed to wrap key:", error);
      // Don't throw - this is non-critical, user can still use direct derivation
    }
  };

  // Handle passkey registration
  const handleRegister = async () => {
    setError(null);
    setIsLoading(true);
    setStep("registering");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      // For existing password users, we don't need email verification
      const isExistingPasswordUser = existingAccountType === "password";

      if (userError || !user) {
        if (!isExistingPasswordUser) {
          throw new Error("Please verify email first");
        }
        // For existing users, we should have a user from password auth
        throw new Error("Authentication required");
      }

      // Check if email is verified (skip for existing password users)
      if (!user.email_confirmed_at && !isExistingPasswordUser) {
        throw new Error(
          "Please verify your email first by clicking the link in your email",
        );
      }

      // Get registration options from server
      const optionsRes = await fetch("/api/auth/passkey/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        const errorData = await optionsRes.json();
        throw new Error(
          errorData.error || "Failed to get registration options",
        );
      }

      const { options, salt } = (await optionsRes.json()) as {
        options: PublicKeyCredentialCreationOptionsJSON;
        salt: string;
      };

      if (!salt) {
        throw new Error("Server did not provide credential salt");
      }

      // Start WebAuthn registration (user interaction)
      console.log("🔐 Starting passkey registration...");
      const registrationResponse = await startRegistration({
        optionsJSON: options,
      });

      // Get PRF output from registration response if available
      let wrappedMasterKey: string | null = null;
      const extensionResults = registrationResponse.clientExtensionResults as {
        prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
      };

      if (extensionResults?.prf) {
        console.log("🔑 PRF enabled, generating wrapped master key...");

        // Check if user already has a master key (password user adding passkey)
        let masterKey = await getEncryptionKey();

        if (!masterKey) {
          // New user or no existing key - generate new master key
          masterKey = await generateMasterKey();
          console.log("✅ Generated new master encryption key");
        } else {
          console.log("✅ Reusing existing master encryption key");
        }

        // Need to authenticate to get PRF output (registration doesn't return PRF results)
        // We'll do this after registration verification
      }

      // Verify registration with server, passing the salt
      const verifyRes = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          response: registrationResponse,
          salt,
        }),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json();
        throw new Error(errorData.error || "Failed to verify registration");
      }

      const verifyData = await verifyRes.json();
      console.log("✅ Registration successful:", verifyData);

      // Store the credential ID for later use
      const credentialId = registrationResponse.id;

      // For existing password users, we need to authenticate to get PRF and wrap existing key
      if (existingAccountType === "password") {
        console.log("✅ Passkey added to existing password account");

        // Create Supabase session FIRST so API calls work
        if (verifyData.token) {
          const { data: sessionData, error: signInError } =
            await supabase.auth.verifyOtp({
              token_hash: verifyData.token,
              type: "magiclink",
            });

          if (signInError || !sessionData.session) {
            console.error("Failed to create session:", signInError);
            throw new Error(
              "Failed to create session after passkey registration",
            );
          }
          console.log("✅ Session created for key wrapping");
        }

        // Now get the master key from current session
        const existingMasterKey = await getEncryptionKey();

        if (existingMasterKey) {
          console.log("🔑 Wrapping existing master key for passkey...");
          // Authenticate to get PRF output and wrap the key (session exists now)
          await authenticateAndWrapKey(credentialId, existingMasterKey);
        } else {
          console.warn(
            "⚠️ No master key in session - user needs to authenticate with passkey",
          );
          console.log("💡 Master key will be synced on next password login");
        }

        // Authenticate with the new passkey to complete the flow
        setHasExistingCredentials(true);
        await handleLogin();
        return; // handleLogin will call onSuccess
      }

      // Sign in to Supabase using the magic link token (for new users)
      if (verifyData.token) {
        const { data: sessionData, error: signInError } =
          await supabase.auth.verifyOtp({
            token_hash: verifyData.token,
            type: "magiclink",
          });

        if (signInError || !sessionData.session) {
          console.error("Failed to verify magic link token:", signInError);
          throw new Error(
            "Failed to create session. Please try registering again.",
          );
        }

        console.log("✅ Supabase session created after registration");

        // For new passkey users, wrap the newly generated master key
        if (extensionResults?.prf) {
          // Generate master key for new user
          const newMasterKey = await generateMasterKey();
          console.log("🔑 Generated master key for new passkey user");

          // Authenticate to get PRF output and wrap the key
          await authenticateAndWrapKey(credentialId, newMasterKey);

          // Set the master key in session
          await setEncryptionKey(newMasterKey);
          setHasEncryptionKey(true); // Update auth context immediately
          console.log("✅ Master key set after registration");
        }
      } else {
        console.warn("⚠️ No token received from registration verification");
        throw new Error(
          "Registration successful but session creation failed. Please sign in manually.",
        );
      }

      // After registration, immediately authenticate to get PRF output for encryption key
      // This provides a seamless experience - register once, get encryption key
      console.log("🔐 Auto-authenticating to get encryption key...");
      setHasExistingCredentials(true);
      await handleLogin();
      return; // handleLogin will set success state
    } catch (err) {
      console.error("Registration error:", err);
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setError(message);
      setStep("passkey-choice");
      setIsLoading(false);
      onError?.(err instanceof Error ? err : new Error(message));
    }
  };

  // Handle passkey login
  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);
    setStep("authenticating");

    try {
      // Get authentication options from server
      const optionsRes = await fetch("/api/auth/passkey/login-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        const errorData = await optionsRes.json();
        throw new Error(errorData.error || "Failed to get login options");
      }

      const { options, credentialSalts } = (await optionsRes.json()) as {
        options: PublicKeyCredentialRequestOptionsJSON;
        credentialSalts: Record<string, string>;
      };

      if (!credentialSalts || Object.keys(credentialSalts).length === 0) {
        throw new Error("Server did not provide credential salts");
      }

      // Convert credential salts from base64 to Uint8Array
      // For now, we'll use the first available salt (in a multi-credential scenario,
      // we'd need to know which credential was used, but browser autofill handles this)
      const credentialIds = Object.keys(credentialSalts);
      const firstSaltBase64 = credentialSalts[credentialIds[0]];
      const saltBytes = base64ToUint8Array(firstSaltBase64);

      // Update PRF extension with the per-credential salt
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

      // Start WebAuthn authentication (user interaction)
      console.log(
        "🔐 Starting passkey authentication with per-credential salt...",
      );
      const authResponse = await startAuthentication({
        optionsJSON: optionsWithSalt,
      });

      // Determine which credential was used
      const usedCredentialId = authResponse.id;
      const usedSalt = credentialSalts[usedCredentialId];

      if (!usedSalt) {
        throw new Error("No salt found for authenticated credential");
      }

      // Check for PRF output in the response
      let prfOutput: ArrayBuffer | null = null;
      const extensionResults = authResponse.clientExtensionResults as {
        prf?: { results?: { first?: ArrayBuffer } };
      };

      if (extensionResults?.prf?.results?.first) {
        prfOutput = extensionResults.prf.results.first;
        console.log("✅ PRF output received for encryption key");
      }

      // Verify authentication with server, passing the salt for the used credential
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
        throw new Error(errorData.error || "Failed to verify login");
      }

      const verifyData = await verifyRes.json();
      console.log("✅ Login successful:", verifyData);

      // Sign in to Supabase FIRST to create authenticated session
      if (verifyData.token) {
        const supabase = createClient();
        const { data: sessionData, error: signInError } =
          await supabase.auth.verifyOtp({
            token_hash: verifyData.token,
            type: "magiclink",
          });

        if (signInError || !sessionData.session) {
          console.error("Failed to verify magic link token:", signInError);
          throw new Error(
            "Failed to create session. Please try signing in again.",
          );
        }

        console.log("✅ Supabase session created");
      } else {
        throw new Error("No authentication token received");
      }

      // NOW derive/unwrap encryption key (session exists for API calls)
      if (prfOutput) {
        console.log("🔑 Deriving KEK from PRF...");

        // Fetch the wrapped key for this credential from the server
        const wrappedKeyRes = await fetch(
          `/api/auth/passkey/wrapped-key?credentialId=${usedCredentialId}`,
        );

        if (wrappedKeyRes.ok) {
          const { wrappedKey } = await wrappedKeyRes.json();

          if (wrappedKey) {
            // Unwrap master key using PRF-derived KEK
            const kek = await deriveKEKFromPRF(prfOutput);
            const masterKey = await unwrapKey(wrappedKey, kek);
            await setEncryptionKey(masterKey);
            setHasEncryptionKey(true); // Update auth context
            console.log("✅ Master key unwrapped from passkey PRF");
          } else {
            // Legacy passkey without wrapped key - migrate to key wrapping
            console.log("🔄 Migrating legacy passkey to key wrapping...");

            // Derive key using legacy method
            await setEncryptionKeyFromPRF(prfOutput);

            // Get the key we just derived and wrap it for future use
            const masterKey = await getEncryptionKey();
            if (masterKey) {
              const kek = await deriveKEKFromPRF(prfOutput);
              const wrappedKey = await wrapKey(masterKey, kek);

              // Store wrapped key for this credential (session now exists)
              const storeRes = await fetch(
                "/api/auth/passkey/store-wrapped-key",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    credentialId: usedCredentialId,
                    wrappedKey,
                  }),
                },
              );

              if (!storeRes.ok) {
                console.warn(
                  "⚠️ Failed to migrate passkey to key wrapping:",
                  await storeRes.text(),
                );
              } else {
                console.log("✅ Successfully migrated passkey to key wrapping");
              }
            }
          }
        } else {
          // Fallback to legacy direct derivation
          console.log("⚠️ Wrapped key fetch failed, using legacy derivation");
          await setEncryptionKeyFromPRF(prfOutput);
        }
      } else {
        console.log("⚠️ PRF not available, encryption key not set");
        // PRF should always be available with modern passkeys
        // If not, the user won't be able to encrypt/decrypt data
      }

      setStep("success");
      setIsLoading(false);
      onSuccess?.();
    } catch (err) {
      console.error("Login error:", err);
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      setStep("email");
      setIsLoading(false);
      onError?.(err instanceof Error ? err : new Error(message));
    }
  };

  // Loading state while checking passkey support
  if (checkingSupport) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-gray-500">
          Checking passkey support...
        </div>
      </div>
    );
  }

  // Passkeys not supported
  if (!passkeySupported) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">
          Your browser doesn't support passkeys. Please use a different browser
          or sign in with email and password.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Email step */}
      {step === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent outline-none transition"
              disabled={isLoading}
              autoComplete="email webauthn"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition duration-200"
          >
            {isLoading ? "Checking..." : "Continue with Passkey"}
          </button>
        </form>
      )}

      {/* Password authentication step (for existing accounts) */}
      {step === "password-auth" && (
        <form onSubmit={handlePasswordAuth} className="space-y-4">
          <div className="text-center mb-4">
            <span className="text-2xl">🔑</span>
            <h3 className="text-lg font-medium text-gray-900 mt-2">
              Add Passkey to Existing Account
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              We found an existing account with this email. Please enter your
              password to continue.
            </p>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent outline-none transition"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition duration-200"
          >
            {isLoading ? "Authenticating..." : "Continue with Passkey"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("email");
              setPassword("");
              setExistingAccountType(null);
            }}
            disabled={isLoading}
            className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 font-medium transition"
          >
            Use a different email
          </button>
        </form>
      )}

      {/* Passkey choice step */}
      {step === "passkey-choice" && (
        <div className="space-y-4">
          {existingAccountType === "password" ? (
            // Existing password user - add passkey
            <div className="text-center py-8">
              <div className="mb-4">
                <span className="text-4xl">🔑</span>
              </div>
              <p className="text-gray-700 font-medium">
                Add passkey to your account
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Secure your account with biometric authentication. You'll be
                able to sign in with your fingerprint, face, or device PIN.
              </p>
            </div>
          ) : user?.user_metadata?.auth_method ===
              "passkey_pending_verification" && user?.email_confirmed_at ? (
            // User has verified email and is ready to create passkey
            <div className="text-center py-8">
              <div className="mb-4">
                <span className="text-4xl">🔑</span>
              </div>
              <p className="text-gray-700 font-medium">Create your passkey</p>
              <p className="text-sm text-gray-500 mt-2">
                Your email has been verified! Now create a passkey to secure
                your account with biometric authentication.
              </p>
            </div>
          ) : (
            // New user - email verification pending
            <div className="text-center py-8">
              <div className="mb-4">
                <span className="text-4xl">📧</span>
              </div>
              <p className="text-gray-700 font-medium">Check your email</p>
              <p className="text-sm text-gray-500 mt-2">
                We've sent you a verification link. Click it to verify your
                account.
              </p>
              <p className="text-xs text-gray-400 mt-4">
                After verifying, come back here and sign in with your passkey.
              </p>
            </div>
          )}

          {/* Only show button if user has verified email or is adding to existing account */}
          {(existingAccountType === "password" ||
            (user?.user_metadata?.auth_method ===
              "passkey_pending_verification" &&
              user?.email_confirmed_at)) && (
            <button
              onClick={handleRegister}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                "Creating passkey..."
              ) : (
                <>
                  <span>🔑</span>
                  {existingAccountType === "password"
                    ? "Add Passkey"
                    : "Create Passkey"}
                </>
              )}
            </button>
          )}

          {existingAccountType !== "password" && (
            <button
              onClick={() => {
                setStep("email");
                setEmail("");
              }}
              disabled={isLoading}
              className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 font-medium transition"
            >
              Use a different email
            </button>
          )}
        </div>
      )}

      {/* Registering step */}
      {step === "registering" && (
        <div className="text-center py-8">
          <div className="animate-pulse mb-4">
            <span className="text-4xl">🔐</span>
          </div>
          <p className="text-gray-700">
            Follow your device's prompts to create your passkey...
          </p>
        </div>
      )}

      {/* Authenticating step */}
      {step === "authenticating" && (
        <div className="text-center py-8">
          <div className="animate-pulse mb-4">
            <span className="text-4xl">🔓</span>
          </div>
          <p className="text-gray-700">Using your passkey to sign in...</p>
        </div>
      )}

      {/* Success step */}
      {step === "success" && (
        <div className="text-center py-8">
          <div className="mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <p className="text-gray-700 font-medium">
            {hasExistingCredentials
              ? "Signed in successfully!"
              : "Passkey created successfully!"}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Your data is protected with zero-knowledge encryption.
          </p>
        </div>
      )}
    </div>
  );
}
