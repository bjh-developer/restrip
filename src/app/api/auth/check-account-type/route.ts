/**
 * Check what type of account exists for an email (for account linking)
 * This is used to determine if we should offer account linking when signup fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Use admin API to list users and find by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json(
        { error: 'Failed to check account type' },
        { status: 500 }
      );
    }

    // Find user by email
    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { accountType: 'none' },
        { status: 200 }
      );
    }

    // Check user metadata for auth method
    const authMethod = user.user_metadata?.auth_method || 'password';
    console.log('User metadata auth_method:', authMethod);
    console.log('User ID:', user.id);
    console.log('User email:', user.email);

    // Also check if user has any passkey credentials
    const { data: passkeyCredentials, error: passkeyError } = await supabaseAdmin
      .from('passkey_credentials')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (passkeyError) {
      console.error('Error querying passkey credentials:', passkeyError);
      // Don't fail the whole request, but log the error
    }

    const hasPasskeyCredentials = !passkeyError && passkeyCredentials && passkeyCredentials.length > 0;
    console.log('Has passkey credentials:', hasPasskeyCredentials, 'Error:', passkeyError);
    console.log('Passkey credentials count:', passkeyCredentials?.length || 0);

    const hasPasskey = hasPasskeyCredentials || authMethod === 'passkey' || authMethod === 'passkey_pending_verification';
    console.log('Final hasPasskey result:', hasPasskey);

    return NextResponse.json({
      accountType: authMethod,
      hasPasskey: hasPasskey
    });
  } catch (error) {
    console.error('Check account type error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}