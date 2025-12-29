'use client';

import React, { useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../hooks/useAuth';

interface EmailPasswordAuthProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

type AuthMode = 'signin' | 'signup';

export function EmailPasswordAuth({ onSuccess, onError }: EmailPasswordAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<AuthMode>('signin');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  const { setEncryptionKeyFromPassword } = useAuth();
  const supabase = createClient();

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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        // Derive encryption key from password
        // Use user ID as salt for deterministic key derivation
        const saltString = data.user.id;
        const salt = new TextEncoder().encode(saltString);
        await setEncryptionKeyFromPassword(password, salt);

        setShowSuccess(true);
        onSuccess?.();
      }
    } catch (err) {
      console.error('Sign in error:', err);
      const message = err instanceof Error ? err.message : 'Sign in failed';
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
      setError('Please enter a valid email address');
      return;
    }

    if (!isValidPassword(password)) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            auth_method: 'password',
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
        // Check if email verification is required
        if (data.user.identities && data.user.identities.length === 0) {
          // Email already exists
          setError('An account with this email already exists. Please sign in instead.');
          setMode('signin');
          return;
        }
        
        // Supabase requires email confirmation by default
        // Don't set encryption key yet - wait for email verification
        setNeedsEmailVerification(true);
        setShowSuccess(true);
      }
    } catch (err) {
      console.error('Sign up error:', err);
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'signin') {
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
          <p className="text-gray-700 font-medium">
            Check your email
          </p>
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
        <p className="text-gray-700 font-medium">
          Signed in successfully!
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Your data is protected with encryption derived from your password.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Mode toggle */}
      <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
            mode === 'signin'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
            mode === 'signup'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Warning about password-based encryption */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-amber-800 text-sm">
          ⚠️ <strong>Note:</strong> Using email/password means your encryption key is derived 
          from your password. Keep your password safe.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email-password-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="email-password-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent outline-none transition"
            disabled={isLoading}
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="email-password-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="email-password-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent outline-none transition"
            disabled={isLoading}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
          {mode === 'signup' && (
            <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
          )}
        </div>

        {mode === 'signup' && (
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
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
          disabled={isLoading || !email || !password || (mode === 'signup' && !confirmPassword)}
          className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white font-medium rounded-lg transition duration-200"
        >
          {isLoading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
