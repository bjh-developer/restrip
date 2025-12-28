'use client';

import { useState, useEffect } from 'react';

export type PasskeySupport = {
  /** WebAuthn is available in this browser */
  webAuthnAvailable: boolean;
  /** Platform authenticator (Face ID, Touch ID, Windows Hello) is available */
  platformAuthenticatorAvailable: boolean;
  /** Conditional mediation (passkey autofill) is available */
  conditionalMediationAvailable: boolean;
  /** PRF extension might be available (for zero-knowledge encryption) */
  prfMaybeAvailable: boolean;
  /** Overall: should we show passkey UI? */
  passkeySupported: boolean;
  /** Still checking support */
  isLoading: boolean;
};

/**
 * Hook to detect browser passkey support
 * 
 * Checks for:
 * - WebAuthn API availability
 * - Platform authenticator (built-in biometrics)
 * - Conditional mediation (passkey autofill)
 * - PRF extension support (for key derivation)
 */
export function usePasskeySupport(): PasskeySupport {
  const [support, setSupport] = useState<PasskeySupport>({
    webAuthnAvailable: false,
    platformAuthenticatorAvailable: false,
    conditionalMediationAvailable: false,
    prfMaybeAvailable: false,
    passkeySupported: false,
    isLoading: true,
  });

  useEffect(() => {
    async function checkSupport() {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        setSupport(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Check if WebAuthn API is available in the browser
      const webAuthnAvailable = !!(
        window.PublicKeyCredential &&
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function' &&
        typeof PublicKeyCredential.isConditionalMediationAvailable === 'function'
      );

      if (!webAuthnAvailable) {
        setSupport({
          webAuthnAvailable: false,
          platformAuthenticatorAvailable: false,
          conditionalMediationAvailable: false,
          prfMaybeAvailable: false,
          passkeySupported: false,
          isLoading: false,
        });
        return;
      }

      try {
        // Check for platform authenticator and conditional mediation
        const [platformAvailable, conditionalAvailable] = await Promise.all([
          PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
          PublicKeyCredential.isConditionalMediationAvailable(),
        ]);

        // PRF extension is generally available in modern browsers that support passkeys
        // We can't definitively check until we actually try to use it
        // But if platform authenticator is available, PRF likely is too
        const prfMaybeAvailable = platformAvailable;

        // We consider passkeys supported if both platform auth and conditional mediation work
        const passkeySupported = platformAvailable && conditionalAvailable;

        setSupport({
          webAuthnAvailable: true,
          platformAuthenticatorAvailable: platformAvailable,
          conditionalMediationAvailable: conditionalAvailable,
          prfMaybeAvailable,
          passkeySupported,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error checking passkey support:', error);
        setSupport({
          webAuthnAvailable: true,
          platformAuthenticatorAvailable: false,
          conditionalMediationAvailable: false,
          prfMaybeAvailable: false,
          passkeySupported: false,
          isLoading: false,
        });
      }
    }

    checkSupport();
  }, []);

  return support;
}

/**
 * Get a user-friendly message about passkey support
 */
export function getPasskeySupportMessage(support: PasskeySupport): string {
  if (support.isLoading) {
    return 'Checking passkey support...';
  }
  
  if (support.passkeySupported) {
    return 'Your browser supports passkeys with Face ID, Touch ID, or Windows Hello';
  }
  
  if (support.webAuthnAvailable && !support.platformAuthenticatorAvailable) {
    return 'Your device doesn\'t have a built-in authenticator. Using password login instead.';
  }
  
  if (!support.webAuthnAvailable) {
    return 'Your browser doesn\'t support passkeys. Using password login instead.';
  }
  
  return 'Passkeys not fully supported. Using password login instead.';
}
