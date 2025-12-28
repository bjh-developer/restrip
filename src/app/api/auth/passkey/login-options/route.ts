/**
 * Generate WebAuthn authentication (login) options
 * 
 * Flow:
 * 1. Client sends email (optional for autofill)
 * 2. Server generates challenge
 * 3. Server retrieves user's credentials (if email provided)
 * 4. Returns options for navigator.credentials.get()
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';
import { 
  rpConfig, 
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
    const { email } = await request.json();

    // Find user if email provided
    let userId: string | undefined;
    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];

    if (email) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const user = users?.users?.find(
        u => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!user) {
        return NextResponse.json(
          { error: 'No account found with this email' },
          { status: 404 }
        );
      }

      userId = user.id;

      // Get user's credentials
      const { data: credentials, error: credError } = await supabaseAdmin
        .from('passkey_credentials')
        .select('credential_id, transports')
        .eq('user_id', user.id);

      console.log('🔍 Credentials lookup for user:', user.id);
      console.log('🔍 Credentials found:', credentials);
      console.log('🔍 Credential error:', credError);

      if (!credentials || credentials.length === 0) {
        return NextResponse.json(
          { error: 'No passkeys found for this account. Please use password login.' },
          { status: 404 }
        );
      }

      allowCredentials = credentials.map(cred => ({
        id: cred.credential_id,
        transports: cred.transports as AuthenticatorTransport[] || ['internal', 'hybrid'],
      }));
      
      console.log('🔍 allowCredentials:', JSON.stringify(allowCredentials));
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: rpConfig.rpID,
      timeout,
      userVerification: 'required',
      // If email provided, limit to user's credentials
      // If no email, allow any credential (for autofill)
      allowCredentials: email ? allowCredentials : undefined,
    });

    console.log('🔍 Generated options.allowCredentials:', JSON.stringify(options.allowCredentials));
    console.log('🔍 rpID:', rpConfig.rpID);

    // Add PRF extension manually after generation
    // The salt needs to be base64url-encoded for the client to use
    const prfSalt = Buffer.from('restrip-encryption-key-v1').toString('base64url');
    const optionsWithPRF = {
      ...options,
      extensions: {
        ...options.extensions,
        prf: {
          eval: {
            first: prfSalt,
          },
        },
      },
    };

    // Store challenge
    const expiresAt = new Date(Date.now() + challengeExpiration);

    // Clean up existing challenges
    if (email) {
      await supabaseAdmin
        .from('webauthn_challenges')
        .delete()
        .eq('email', email.toLowerCase())
        .eq('type', 'authentication');
    }

    const { error: challengeError } = await supabaseAdmin
      .from('webauthn_challenges')
      .insert({
        email: email?.toLowerCase() || null,
        user_id: userId || null,
        challenge: options.challenge,
        type: 'authentication',
        expires_at: expiresAt.toISOString(),
      });

    if (challengeError) {
      console.error('Failed to store challenge:', challengeError);
      return NextResponse.json(
        { error: 'Failed to generate login options' },
        { status: 500 }
      );
    }

    return NextResponse.json({ options: optionsWithPRF });
  } catch (error) {
    console.error('Login options error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
