/**
 * Generate WebAuthn registration options
 * 
 * Flow:
 * 1. Client sends email
 * 2. Server generates challenge and options
 * 3. Server stores challenge temporarily
 * 4. Returns options for navigator.credentials.create()
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';
import { 
  rpConfig,
  getDomainFromRequest,
  getOriginFromRequest,
  authenticatorSelection, 
  supportedAlgorithmIDs,
  timeout,
  challengeExpiration
} from '../../../../../lib/webauthn/config';

// Create Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, displayName } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user already exists with passkey
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    // Get existing credentials for this user (to exclude during registration)
    let existingCredentials: { id: string }[] = [];
    if (userExists) {
      const { data: credentials } = await supabaseAdmin
        .from('passkey_credentials')
        .select('credential_id')
        .eq('user_id', userExists.id);
      
      existingCredentials = credentials?.map(c => ({
        id: c.credential_id,
      })) || [];
    }

    // Get dynamic domain from request
    const rpID = getDomainFromRequest(request);
    
    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: rpConfig.rpName,
      rpID,
      userName: email,
      userDisplayName: displayName || email.split('@')[0],
      // Don't allow re-registration of existing credentials
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.id,
        transports: ['internal', 'hybrid'] as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        authenticatorAttachment: authenticatorSelection.authenticatorAttachment,
        userVerification: authenticatorSelection.userVerification,
        residentKey: authenticatorSelection.residentKey,
        requireResidentKey: authenticatorSelection.requireResidentKey,
      },
      supportedAlgorithmIDs,
      timeout,
      attestationType: 'none', // We don't need attestation for our use case
    });

    // Add PRF extension for zero-knowledge encryption
    const optionsWithPRF = {
      ...options,
      extensions: {
        ...options.extensions,
        prf: {},
      },
    };

    // Store challenge in database
    const expiresAt = new Date(Date.now() + challengeExpiration);
    
    // Clean up any existing challenges for this email
    await supabaseAdmin
      .from('webauthn_challenges')
      .delete()
      .eq('email', email.toLowerCase())
      .eq('type', 'registration');

    // Store new challenge
    const { error: challengeError } = await supabaseAdmin
      .from('webauthn_challenges')
      .insert({
        email: email.toLowerCase(),
        challenge: options.challenge,
        type: 'registration',
        expires_at: expiresAt.toISOString(),
      });

    if (challengeError) {
      console.error('Failed to store challenge:', challengeError);
      return NextResponse.json(
        { error: 'Failed to generate registration options' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      options: optionsWithPRF,
      userExists: !!userExists,
    });
  } catch (error) {
    console.error('Registration options error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
