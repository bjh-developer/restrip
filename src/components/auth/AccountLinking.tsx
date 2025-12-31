'use client';

import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

interface AccountLinkingProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function AccountLinking({ onSuccess, onError }: AccountLinkingProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleAddPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Guard: ensure user is authenticated and has an ID
      if (!user?.id) {
        throw new Error('You must be signed in to link a password');
      }

      const response = await fetch('/api/auth/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'password',
          password,
          userId: user.id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add password');
      }

      setPassword('');
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add password';
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPasskey = () => {
    // Redirect to passkey registration flow
    // Since user is already authenticated, it will link to their existing account
    window.location.href = '/auth/passkey';
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Link Additional Sign-In Methods
        </h3>
        <p className="text-sm text-gray-600">
          Add more ways to sign in to your account for easier access.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Add Password */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Add Password Sign-In</h4>
        <form onSubmit={handleAddPassword} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a password"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={isLoading}
            required
          />
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition"
          >
            {isLoading ? 'Adding Password...' : 'Add Password'}
          </button>
        </form>
      </div>

      {/* Add Passkey */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Add Passkey Sign-In</h4>
        <p className="text-sm text-gray-600">
          Create a passkey for passwordless sign-in to this account.
        </p>
        <button
          onClick={handleAddPasskey}
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
        >
          Create Passkey
        </button>
      </div>
    </div>
  );
}