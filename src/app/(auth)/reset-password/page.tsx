'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { Label } from '../../../../components/ui/label';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [step, setStep] = useState<'request' | 'reset'>('request');

  const supabase = useMemo(() => createClient(), []);

  // Validate email format
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Validate password strength
  const isValidPassword = (password: string) => {
    return password.length >= 8;
  };

  // Request password reset
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!isValidEmail(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Check if user exists in the system
      const checkResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!checkResponse.ok) {
        throw new Error('Failed to verify email');
      }

      const checkData = await checkResponse.json();
      if (!checkData.exists) {
        throw new Error('Account not found. Please create a new account.');
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password?next=reset`,
      });

      if (resetError) {
        throw resetError;
      }

      setShowSuccess(true);
    } catch (err) {
      console.error('Password reset request error:', err);
      const message = err instanceof Error ? err.message : 'Failed to request password reset';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Update password with token
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!isValidPassword(password)) {
        throw new Error('Password must be at least 8 characters long');
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Get session with fresh token from URL
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session) {
        throw new Error('Reset session expired. Please request a new password reset.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }
      // Redirect to sign in page after successful password update
      setTimeout(() => {
        router.push('/?mode=signin');
      }, 1500);
      
      setShowSuccess(true);
    } catch (err) {
      console.error('Password update error:', err);
      const message = err instanceof Error ? err.message : 'Failed to update password';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if we're in reset mode from redirect
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('next') === 'reset') {
      setStep('reset');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-warm-beige to-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 font-display">ReStrip</h1>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {step === 'request' ? 'Reset Password' : 'Set New Password'}
          </h2>
          <p className="text-gray-600">
            {step === 'request'
              ? 'Enter your email to receive a password reset link'
              : 'Create a new password for your account'}
          </p>
        </div>

        {/* Success Message */}
        {showSuccess && step === 'request' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              ✓ Reset link sent to {email}
            </p>
            <p className="text-green-700 text-sm mt-1">
              Check your email and click the link to continue.
            </p>
          </div>
        )}

        {showSuccess && step === 'reset' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              ✓ Password updated successfully
            </p>
            <p className="text-green-700 text-sm mt-1">
              You can now sign in with your new password.
            </p>
            <Link
              href="/"
              className="inline-block mt-2 text-sm font-semibold text-green-700 hover:text-green-800 underline"
            >
              Return to home
            </Link>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            {error.includes('Account not found') && (
              <Link 
                href="/?mode=signup" 
                className="inline-block mt-2 text-sm font-semibold text-red-700 hover:text-red-800 underline"
              >
                Create new account
              </Link>
            )}
          </div>
        )}

        {/* Request Reset Form */}
        {step === 'request' && (
          <form onSubmit={handleRequestReset} className="space-y-6">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || showSuccess}
                className="mt-2"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || showSuccess || !email}
              className="w-full"
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        )}

        {/* Reset Password Form */}
        {step === 'reset' && !showSuccess && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="mt-2"
              />
              <p className="text-sm text-gray-600 mt-2">
                Must be at least 8 characters long
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="mt-2"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !password || !confirmPassword}
              className="w-full"
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        )}

        {/* Footer Links */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-gray-600">
            {step === 'request'
              ? 'Remember your password?'
              : 'Need to reset your email?'}
            {' '}
            <Link
              href={step === 'request' ? '/?mode=signin' : '/reset-password'}
              className="font-semibold text-blue-500 hover:text-blue-700 underline"
            >
              {step === 'request' ? 'Sign in' : 'Request new reset'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
