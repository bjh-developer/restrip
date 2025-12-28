/**
 * Verify WebAuthn authentication and create session
 * 
 * Flow:
 * 1. Client sends authentication response from navigator.credentials.get()
 * 2. Server retrieves stored challenge
 * 3. Server looks up the credential
 * 4. Server verifies the response
 * 5. Server updates counter (replay attack prevention)
 * 6. Returns session token
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';
import { rpConfig, getDomainFromRequest, getOriginFromRequest } from '../../../../../lib/webauthn/config';

// Create Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { response: credential, email } = await request.json();

    if (!credential) {
      return NextResponse.json(
        { error: 'Credential is required' },
        { status: 400 }
      );
    }

    // Find the credential in database
    const { data: storedCredential, error: credError } = await supabaseAdmin
      .from('passkey_credentials')
      .select('*, user_id')
      .eq('credential_id', credential.id)
      .single();

    if (credError || !storedCredential) {
      console.error('Credential not found:', credError);
      return NextResponse.json(
        { error: 'Passkey not found. It may have been deleted.' },
        { status: 404 }
      );
    }

    // Get user info
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      storedCredential.user_id
    );

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      );
    }

    // Find the challenge - try by email first, then by user_id
    let challengeData;
    
    if (email) {
      const { data } = await supabaseAdmin
        .from('webauthn_challenges')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('type', 'authentication')
        .single();
      challengeData = data;
    }

    if (!challengeData) {
      const { data } = await supabaseAdmin
        .from('webauthn_challenges')
        .select('*')
        .eq('user_id', storedCredential.user_id)
        .eq('type', 'authentication')
        .single();
      challengeData = data;
    }

    // Also try without any filter for autofill scenarios
    if (!challengeData) {
      const { data } = await supabaseAdmin
        .from('webauthn_challenges')
        .select('*')
        .eq('type', 'authentication')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      challengeData = data;
    }

    if (!challengeData) {
      return NextResponse.json(
        { error: 'Login session expired. Please try again.' },
        { status: 400 }
      );
    }

    // Check if challenge is expired
    if (new Date(challengeData.expires_at) < new Date()) {
      await supabaseAdmin
        .from('webauthn_challenges')
        .delete()
        .eq('id', challengeData.id);

      return NextResponse.json(
        { error: 'Login session expired. Please try again.' },
        { status: 400 }
      );
    }

    // Decode the stored public key
    const publicKeyBuffer = Buffer.from(storedCredential.public_key, 'base64');

    // Get dynamic domain and origin from request
    const rpID = getDomainFromRequest(request);
    const expectedOrigin = getOriginFromRequest(request);
    
    // Verify the authentication response
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challengeData.challenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: storedCredential.credential_id,
          publicKey: publicKeyBuffer,
          counter: storedCredential.counter || 0,
          transports: storedCredential.transports as AuthenticatorTransport[] || undefined,
        },
        requireUserVerification: true,
      });
    } catch (verifyError) {
      console.error('Authentication verification failed:', verifyError);
      return NextResponse.json(
        { error: 'Authentication failed. Please try again.' },
        { status: 400 }
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Authentication verification failed' },
        { status: 400 }
      );
    }

    // Clean up the challenge
    await supabaseAdmin
      .from('webauthn_challenges')
      .delete()
      .eq('id', challengeData.id);

    // Update credential counter and last_used_at
    await supabaseAdmin
      .from('passkey_credentials')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', storedCredential.id);

    // Generate a session using magic link
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email!,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`,
      },
    });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Extract the token from the action link
    const actionLink = sessionData.properties?.action_link;
    const token = actionLink ? new URL(actionLink).searchParams.get('token') : null;

    return NextResponse.json({
      success: true,
      userId: userData.user.id,
      email: userData.user.email,
      // Return the token for automatic sign-in
      token,
      actionLink,
      // Include PRF result info
      prfEnabled: credential.clientExtensionResults?.prf !== undefined,
    });
  } catch (error) {
    console.error('Login verify error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
