/**
 * Verify WebAuthn registration and create user
 * 
 * Flow:
 * 1. Client sends registration response from navigator.credentials.create()
 * 2. Server retrieves stored challenge
 * 3. Server verifies the response
 * 4. Server creates user (if new) and stores credential
 * 5. Returns session token
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';
import { rpConfig, getDomainFromRequest, getOriginFromRequest } from '../../../../../lib/webauthn/config';

// Create Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, response: credential, deviceName, salt } = await request.json();

    if (!email || !credential || !salt) {
      return NextResponse.json(
        { error: 'Email, credential response, and salt are required' },
        { status: 400 }
      );
    }

    // Retrieve stored challenge
    const { data: challengeData, error: challengeError } = await supabaseAdmin
      .from('webauthn_challenges')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('type', 'registration')
      .single();

    if (challengeError || !challengeData) {
      return NextResponse.json(
        { error: 'Challenge not found or expired. Please try again.' },
        { status: 400 }
      );
    }

    // Check if challenge is expired
    if (new Date(challengeData.expires_at) < new Date()) {
      // Clean up expired challenge
      await supabaseAdmin
        .from('webauthn_challenges')
        .delete()
        .eq('id', challengeData.id);

      return NextResponse.json(
        { error: 'Challenge expired. Please try again.' },
        { status: 400 }
      );
    }

    // Get dynamic domain and origin from request
    const rpID = getDomainFromRequest(request);
    const expectedOrigin = getOriginFromRequest(request);
    
    // Verify the registration response
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challengeData.challenge,
        expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch (verifyError) {
      console.error('Verification failed:', verifyError);
      return NextResponse.json(
        { error: 'Failed to verify credential. Please try again.' },
        { status: 400 }
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      );
    }

    const { registrationInfo } = verification;

    // Clean up the challenge
    await supabaseAdmin
      .from('webauthn_challenges')
      .delete()
      .eq('id', challengeData.id);

    // Check if user exists
    // TODO: Optimise by using RPC
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    // Create user if doesn't exist
    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        email_confirm: true, // We'll handle email verification separately
        user_metadata: {
          auth_method: 'passkey',
        },
      });

      if (createError || !newUser.user) {
        console.error('Failed to create user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }

      user = newUser.user;
    } else {
      // User exists - update their auth_method to reflect they now have passkey
      const currentAuthMethod = user.user_metadata?.auth_method || 'password';
      let newAuthMethod = 'passkey'; // Default for existing users adding passkey
      
      if (currentAuthMethod === 'password') {
        newAuthMethod = 'password_and_passkey';
      } else if (currentAuthMethod === 'passkey') {
        newAuthMethod = 'passkey'; // Already has passkey
      } else if (currentAuthMethod === 'password_and_passkey') {
        newAuthMethod = 'password_and_passkey'; // Already has both
      }

      if (newAuthMethod !== currentAuthMethod) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            auth_method: newAuthMethod,
          },
        });

        if (updateError) {
          console.error('Failed to update user auth_method:', updateError);
          // Continue anyway - the passkey will still be registered
        }
      }
    }

    // Use the credential ID directly from the client response (already base64url-encoded)
    // This ensures we store the exact same ID the browser knows about
    const credentialId = credential.id;
    const publicKeyBase64 = Buffer.from(registrationInfo.credential.publicKey).toString('base64');

    console.log('🔐 Storing credential ID:', credentialId);
    console.log('🔐 Original response.id:', credential.id);

    // Store the credential with the per-credential salt
    const { error: credentialError } = await supabaseAdmin
      .from('passkey_credentials')
      .insert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKeyBase64,
        counter: registrationInfo.credential.counter,
        device_type: registrationInfo.credentialDeviceType,
        backed_up: registrationInfo.credentialBackedUp,
        transports: credential.response.transports || [],
        aaguid: registrationInfo.aaguid,
        device_name: deviceName || getDeviceName(credential.response.transports, request.headers.get('user-agent') || undefined),
        last_used_at: new Date().toISOString(),
        salt,
      });

    if (credentialError) {
      console.error('Failed to store credential:', credentialError);
      return NextResponse.json(
        { error: 'Failed to store credential' },
        { status: 500 }
      );
    }

    // Create a session for the user
    // Note: Supabase doesn't have a direct "create session" API for admin
    // We'll generate a magic link token that auto-signs in
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`,
      },
    });

    // Use the hashed token from the session data
    const token = sessionData?.properties?.hashed_token;

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      // Still return success since passkey was registered
      return NextResponse.json({
        success: true,
        userId: user.id,
        credentialId,
        message: 'Passkey registered successfully. Please sign in.',
        needsSignIn: true,
        // Include PRF support info so client knows to generate MEK
        prfEnabled: credential.clientExtensionResults?.prf !== undefined,
      });
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      credentialId,
      token,
      // Include PRF support info so client knows to generate MEK
      prfEnabled: credential.clientExtensionResults?.prf !== undefined,
    });
  } catch (error) {
    console.error('Registration verify error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper to generate friendly device name from transports
// userAgent: Optional user agent string from request headers (server-side only)
function getDeviceName(transports?: string[], userAgent?: string): string {
  if (!transports || transports.length === 0) {
    return 'Unknown Device';
  }
  
  if (transports.includes('internal')) {
    // Platform authenticator - detect based on user agent
    const ua = userAgent || '';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iPhone/iPad';
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Android')) return 'Android Device';
    return 'This Device';
  }
  
  if (transports.includes('usb')) return 'Security Key (USB)';
  if (transports.includes('nfc')) return 'Security Key (NFC)';
  if (transports.includes('ble')) return 'Security Key (Bluetooth)';
  if (transports.includes('hybrid')) return 'Phone/Tablet';
  
  return 'Security Key';
}
