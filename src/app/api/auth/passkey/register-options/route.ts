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
  getAuthenticatorSelection,
  isMobileDevice,
  supportedAlgorithmIDs,
  timeout,
  challengeExpiration,
  generateRandomSalt
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
    let existingCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];
    if (userExists) {
      const { data: credentials } = await supabaseAdmin
        .from('passkey_credentials')
        .select('credential_id, transports')
        .eq('user_id', userExists.id);
      
      existingCredentials = credentials?.map(c => ({
        id: c.credential_id,
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })) || [];
    }

    // Get dynamic domain from request
    const rpID = getDomainFromRequest(request);
    
    // Detect if user is on mobile
    const isMobile = isMobileDevice(request);
    const authenticatorSelection = getAuthenticatorSelection(isMobile);
    
    console.log('📱 Device type:', isMobile ? 'Mobile' : 'Desktop');
    console.log('🔐 Authenticator attachment:', authenticatorSelection.authenticatorAttachment);
    
    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: rpConfig.rpName,
      rpID,
      userName: email,
      userDisplayName: displayName || email.split('@')[0],
      // Don't allow re-registration of existing credentials
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.id,
        transports: cred.transports ?? (['internal', 'hybrid'] as AuthenticatorTransport[]),
      })),
      authenticatorSelection,
      supportedAlgorithmIDs,
      timeout,
      attestationType: 'none', // We don't need attestation for our use case
    });

    // Generate a cryptographically random salt for this credential
    // This salt will be used by the authenticator during registration
    // and stored with the credential for use during authentication
    const credentialSalt = generateRandomSalt();
    
    // Add PRF extension for zero-knowledge encryption
    // Each credential gets a unique salt for per-credential isolation
    const optionsWithPRF = {
      ...options,
      extensions: {
        ...options.extensions,
        prf: {
          eval: {
            first: Buffer.from(credentialSalt, 'base64'),
          },
        },
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
      // Return the salt so client can store it and use it during credential verification
      salt: credentialSalt,
    });
  } catch (error) {
    console.error('Registration options error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
