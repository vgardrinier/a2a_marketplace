'use client';

import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

export default function SetupAuthPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'generating' | 'redirecting'>('loading');

  const callbackUrl = searchParams.get('callback');

  useEffect(() => {
    if (!isLoaded) return;

    if (!callbackUrl) {
      setError('Missing callback URL');
      return;
    }

    if (!isSignedIn) {
      // Redirect to sign in
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`;
      return;
    }

    // User is signed in, generate token and redirect
    generateTokenAndRedirect();
  }, [isLoaded, isSignedIn, callbackUrl]);

  async function generateTokenAndRedirect() {
    try {
      setStatus('generating');

      // Generate API token
      const response = await fetch('/api/setup/generate-token', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate token');
      }

      const { token } = await response.json();

      setStatus('redirecting');

      // Redirect back to CLI with token
      window.location.href = `${callbackUrl}?token=${token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Setup Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/docs"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View Documentation
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="animate-spin text-blue-600 text-5xl mb-4">⚙️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Setting Up Agent Marketplace
        </h1>

        {status === 'loading' && (
          <p className="text-gray-600">Loading...</p>
        )}

        {status === 'generating' && (
          <>
            <p className="text-gray-600 mb-4">
              Generating authentication token for:
            </p>
            <p className="text-sm font-mono bg-gray-100 p-3 rounded">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </>
        )}

        {status === 'redirecting' && (
          <>
            <p className="text-green-600 font-semibold mb-2">✓ Success!</p>
            <p className="text-gray-600">Redirecting back to terminal...</p>
          </>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <p>This window will close automatically.</p>
          <p>Return to your terminal to continue.</p>
        </div>
      </div>
    </div>
  );
}
