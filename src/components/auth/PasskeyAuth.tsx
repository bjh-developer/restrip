'use client';

import React, { useState } from 'react';
import { 
  startRegistration, 
  startAuthentication,
} from '@simplewebauthn/browser';
import type { 
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { useAuth } from '../../hooks/useAuth';
import { usePasskeySupport } from '../../hooks/usePasskeySupport';
import { createClient } from '../../lib/supabase/client';

// Helper to convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
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

type AuthStep = 'email' | 'passkey-choice' | 'registering' | 'authenticating' | 'success';

export function PasskeyAuth({ onSuccess, onError }: PasskeyAuthProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<AuthStep>('email');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);

  const { setEncryptionKeyFromPRF } = useAuth();
  const { passkeySupported, isLoading: checkingSupport } = usePasskeySupport();

  // Validate email format
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Check if user has existing passkeys
  const checkExistingCredentials = async (email: string) => {
    try {
      const res = await fetch('/api/auth/passkey/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setError('Please enter a valid email address');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const hasCredentials = await checkExistingCredentials(email);
      setHasExistingCredentials(hasCredentials);
      
      if (hasCredentials) {
        // User has passkeys, go straight to authentication
        await handleLogin();
      } else {
        // New user, show registration choice
        setStep('passkey-choice');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Failed to check credentials. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle passkey registration
  const handleRegister = async () => {
    setError(null);
    setIsLoading(true);
    setStep('registering');

    try {
      // Get registration options from server
      const optionsRes = await fetch('/api/auth/passkey/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        const errorData = await optionsRes.json();
        throw new Error(errorData.error || 'Failed to get registration options');
      }

      const { options } = await optionsRes.json() as { options: PublicKeyCredentialCreationOptionsJSON };
      
      // Start WebAuthn registration (user interaction)
      console.log('🔐 Starting passkey registration...');
      const registrationResponse = await startRegistration({ optionsJSON: options });
      
      // Verify registration with server
      const verifyRes = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          response: registrationResponse,
        }),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json();
        throw new Error(errorData.error || 'Failed to verify registration');
      }

      const verifyData = await verifyRes.json();
      console.log('✅ Registration successful:', verifyData);

      // Sign in to Supabase using the magic link token
      if (verifyData.token) {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.verifyOtp({
          token_hash: verifyData.token,
          type: 'magiclink',
        });
        
        if (signInError) {
          console.error('Failed to sign in with token:', signInError);
          // Try alternate approach - use the action link directly
          if (verifyData.actionLink) {
            const url = new URL(verifyData.actionLink);
            const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];
            const refreshToken = url.hash.match(/refresh_token=([^&]+)/)?.[1];
            
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            }
          }
        }
        console.log('✅ Supabase session created after registration');
      }

      // After registration, immediately authenticate to get PRF output for encryption key
      // This provides a seamless experience - register once, get encryption key
      console.log('🔐 Auto-authenticating to get encryption key...');
      setHasExistingCredentials(true);
      await handleLogin();
      return; // handleLogin will set success state
    } catch (err) {
      console.error('Registration error:', err);
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      setStep('passkey-choice');
      setIsLoading(false);
      onError?.(err instanceof Error ? err : new Error(message));
    }
  };

  // Handle passkey login
  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);
    setStep('authenticating');

    try {
      // Get authentication options from server
      const optionsRes = await fetch('/api/auth/passkey/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!optionsRes.ok) {
        const errorData = await optionsRes.json();
        throw new Error(errorData.error || 'Failed to get login options');
      }

      const { options } = await optionsRes.json() as { options: PublicKeyCredentialRequestOptionsJSON & { extensions?: { prf?: { eval?: { first?: string } } } } };
      
      // Convert PRF salt from base64url to Uint8Array for the WebAuthn API
      // The browser expects ArrayBuffer/Uint8Array, not base64url strings
      let optionsForWebAuthn = options;
      if (options.extensions?.prf?.eval?.first) {
        const prfSaltBase64url = options.extensions.prf.eval.first;
        const prfSaltBytes = base64urlToUint8Array(prfSaltBase64url);
        optionsForWebAuthn = {
          ...options,
          extensions: {
            ...options.extensions,
            prf: {
              eval: {
                first: prfSaltBytes,
              },
            },
          },
        } as PublicKeyCredentialRequestOptionsJSON;
      }

      // Start WebAuthn authentication (user interaction)
      console.log('🔐 Starting passkey authentication...');
      const authResponse = await startAuthentication({ optionsJSON: optionsForWebAuthn });
      
      // Check for PRF output in the response
      let prfOutput: ArrayBuffer | null = null;
      const extensionResults = authResponse.clientExtensionResults as { 
        prf?: { results?: { first?: ArrayBuffer } } 
      };
      
      if (extensionResults?.prf?.results?.first) {
        prfOutput = extensionResults.prf.results.first;
        console.log('✅ PRF output received for encryption key');
      }

      // Verify authentication with server
      const verifyRes = await fetch('/api/auth/passkey/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          response: authResponse,
        }),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json();
        throw new Error(errorData.error || 'Failed to verify login');
      }

      const verifyData = await verifyRes.json();
      console.log('✅ Login successful:', verifyData);

      // Derive encryption key directly from PRF output
      // With phone-first passkey flow, the same passkey (synced via iCloud/Google)
      // produces the same PRF output everywhere, so we don't need key wrapping
      if (prfOutput) {
        console.log('🔑 Deriving encryption key from PRF...');
        await setEncryptionKeyFromPRF(prfOutput);
        console.log('✅ Encryption key set');
      } else {
        console.log('⚠️ PRF not available, encryption key not set');
        // PRF should always be available with modern passkeys
        // If not, the user won't be able to encrypt/decrypt data
      }

      // Sign in to Supabase using the magic link token
      if (verifyData.token) {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.verifyOtp({
          token_hash: verifyData.token,
          type: 'magiclink',
        });
        
        if (signInError) {
          console.error('Failed to sign in with token:', signInError);
          // Try alternate approach - use the action link directly
          if (verifyData.actionLink) {
            // Extract tokens from action link
            const url = new URL(verifyData.actionLink);
            const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];
            const refreshToken = url.hash.match(/refresh_token=([^&]+)/)?.[1];
            
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            }
          }
        }
        console.log('✅ Supabase session created');
      }

      setStep('success');
      setIsLoading(false);
      onSuccess?.();
    } catch (err) {
      console.error('Login error:', err);
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setStep('email');
      setIsLoading(false);
      onError?.(err instanceof Error ? err : new Error(message));
    }
  };

  // Loading state while checking passkey support
  if (checkingSupport) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-gray-500">Checking passkey support...</div>
      </div>
    );
  }

  // Passkeys not supported
  if (!passkeySupported) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">
          Your browser doesn't support passkeys. Please use a different browser or 
          sign in with email and password.
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
      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
            {isLoading ? 'Checking...' : 'Continue with Passkey'}
          </button>
        </form>
      )}

      {/* Passkey choice step (new user) */}
      {step === 'passkey-choice' && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Create your passkey
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Passkeys are a secure, passwordless way to sign in. Your device will 
              create a unique key that only works for you.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">🔒 Zero-Knowledge Encryption</h4>
            <p className="text-sm text-blue-800">
              Your images will be encrypted on your device before upload. Not even 
              we can see them – only you with your passkey can decrypt them.
            </p>
          </div>

          <button
            onClick={handleRegister}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              'Creating passkey...'
            ) : (
              <>
                <span>🔑</span>
                Create Passkey
              </>
            )}
          </button>

          <button
            onClick={() => {
              setStep('email');
              setEmail('');
            }}
            disabled={isLoading}
            className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 font-medium transition"
          >
            Use a different email
          </button>
        </div>
      )}

      {/* Registering step */}
      {step === 'registering' && (
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
      {step === 'authenticating' && (
        <div className="text-center py-8">
          <div className="animate-pulse mb-4">
            <span className="text-4xl">🔓</span>
          </div>
          <p className="text-gray-700">
            Use your passkey to sign in...
          </p>
        </div>
      )}

      {/* Success step */}
      {step === 'success' && (
        <div className="text-center py-8">
          <div className="mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <p className="text-gray-700 font-medium">
            {hasExistingCredentials ? 'Signed in successfully!' : 'Passkey created successfully!'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Your data is protected with zero-knowledge encryption.
          </p>
        </div>
      )}
    </div>
  );
}
