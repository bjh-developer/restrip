"use client";

import React, { useState, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PasskeyAuth } from "./PasskeyAuth";
import { EmailPasswordAuth } from "./EmailPasswordAuth";
import { usePasskeySupport } from "../../hooks/usePasskeySupport";
import { useAuth } from "../../hooks/useAuth";

// Register ScrollTrigger plugin
try {
  gsap.registerPlugin(ScrollTrigger);
} catch {
  // Plugin already registered or registration failed, safe to ignore
}

interface AuthGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

type AuthTab = "passkey" | "password";

export function AuthGate({ children, fallback }: AuthGateProps) {
  const { user, isLoading: authLoading, hasEncryptionKey, signOut } = useAuth();
  const { passkeySupported, isLoading: supportLoading } = usePasskeySupport();
  const [activeTab, setActiveTab] = useState<AuthTab>("passkey");
  const [authSuccess, setAuthSuccess] = useState(false);
  const [showEmailVerificationMessage, setShowEmailVerificationMessage] = useState(false);

  // Check if user came from email verification link
  useEffect(() => {
    const checkEmailVerification = async () => {
      // Check URL hash for confirmation token
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      
      if (type === 'signup' || type === 'email') {
        // User clicked email verification link
        setActiveTab("password");
        setShowEmailVerificationMessage(true);
        
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      // Also check if user's auth method is password
      if (user?.user_metadata?.auth_method === 'password') {
        setActiveTab("password");
      }
    };
    
    checkEmailVerification();
  }, [user]);

  // Refresh ScrollTrigger when authentication state changes
  useEffect(() => {
    if (user && hasEncryptionKey) {
      // Give the DOM a moment to update with the new content
      setTimeout(() => {
        try {
          // Guard: Ensure ScrollTrigger is available and has refresh method
          if (ScrollTrigger && typeof ScrollTrigger.refresh === 'function') {
            ScrollTrigger.refresh();
          }
        } catch (error) {
          // Silently fail if ScrollTrigger is not available or refresh fails
          // This is non-critical for authentication functionality
          console.debug('ScrollTrigger.refresh() failed:', error);
        }
      }, 100);
    }
  }, [user, hasEncryptionKey]);

  // Show loading state
  if (authLoading || supportLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // User is authenticated with encryption key
  if (user && hasEncryptionKey) {
    console.log('AuthGate: User authenticated with encryption key, showing main app');
    return <>{children}</>;
  }

  // User is authenticated but missing encryption key
  // Check if they just verified their email - if so, show the normal auth flow with a message
  if (user && !hasEncryptionKey && !showEmailVerificationMessage) {
    // Check if user is in passkey registration flow
    const isPasskeyRegistration = window.location.hash === '#passkey-registration';
    
    if (isPasskeyRegistration) {
      console.log('AuthGate: User in passkey registration flow, showing passkey auth');
      return (
        <div className="w-full max-w-md mx-auto p-6">
          <PasskeyAuth />
        </div>
      );
    }
    
    console.log('AuthGate: User authenticated but missing encryption key, showing re-auth page');
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Re-authenticate to Enter
          </h2>
          <p className="text-gray-600 text-sm">
            Your session is active but we need your passkey or password to
            decrypt your data.
          </p>
        </div>

        {passkeySupported && (user?.user_metadata?.auth_method === 'passkey' || user?.user_metadata?.auth_method === 'passkey_pending_verification') ? (
          <PasskeyAuth onSuccess={() => setAuthSuccess(true)} />
        ) : !passkeySupported && (user?.user_metadata?.auth_method === 'passkey' || user?.user_metadata?.auth_method === 'passkey_pending_verification' || user?.user_metadata?.auth_method === 'password_and_passkey') ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-sm font-semibold text-amber-900 mb-2">
                  Passkey Not Supported on This Device
                </h3>
                <p className="text-sm text-amber-800 mb-3">
                  Your account uses passkey authentication, but this device or browser doesn't support passkeys.
                </p>
                <div className="space-y-2 text-sm text-amber-700">
                  <p className="font-medium">What you can do:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Try accessing your account from a supported device (modern smartphone, laptop with biometrics)</li>
                    <li>Use a compatible browser (Chrome, Safari, Edge, or Firefox)</li>
                    <li>Contact support if you need to link a password to your account</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmailPasswordAuth onSuccess={() => setAuthSuccess(true)} signinOnly />
        )}

        {/* Sign out button */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500 mb-2">
            Want to sign in with a different account?
          </p>
          <button
            onClick={async () => {
              await signOut();
            }}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Sign out completely
          </button>
        </div>
      </div>
    );
  }

  // User is not authenticated - show auth UI
  const handleSuccess = () => {
    setAuthSuccess(true);
  };

  // Show custom fallback if provided
  if (fallback && !authSuccess) {
    return <>{fallback}</>;
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-soft-black mb-2">
          Sign In/Up to Continue
        </h2>
        <p className="text-gray-600 text-sm">
          Passkey / Password blocks anyone (even us) from viewing your uploaded
          images.
        </p>
      </div>

      {/* Email verification success message */}
      {showEmailVerificationMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-medium text-green-900">
                Email verified successfully!
              </p>
              <p className="text-xs text-green-700 mt-1">
                Now sign in with your password to access your account.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab selector - only show if passkeys are supported */}
      {passkeySupported && (
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveTab("passkey")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === "passkey"
                ? "bg-white text-gray-900 shadow"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>🔑</span>
            Passkey
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === "password"
                ? "bg-white text-gray-900 shadow"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>🔒</span>
            Email/Password
          </button>
        </div>
      )}

      {/* Passkey recommendation badge */}
      {passkeySupported && activeTab === "passkey" && (
        <div className="mb-4 flex items-center justify-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            ✓ Recommended
          </span>
        </div>
      )}

      {/* Auth components */}
      {passkeySupported && activeTab === "passkey" ? (
        <PasskeyAuth onSuccess={handleSuccess} />
      ) : (
        <EmailPasswordAuth onSuccess={handleSuccess} />
      )}

      {/* Security info */}
      <div className="mt-8 pt-6 border-t border-soft-black">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          🔐 How your data is protected
        </h3>
        <ul className="space-y-2 text-xs text-gray-500">
          <li className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>
              Images are Zero-Knowledge Encrypted on your device before upload
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Encryption keys never leave your device</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Even we cannot see your uploaded images</span>
          </li>
          {passkeySupported && (
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Passkeys use hardware security for maximum protection</span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>
              If you lose your passkey or password, you will lose access to your
              data. That's the cost of true privacy.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// Export individual components for flexibility
export { PasskeyAuth } from "./PasskeyAuth";
export { EmailPasswordAuth } from "./EmailPasswordAuth";
