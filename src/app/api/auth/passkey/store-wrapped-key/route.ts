/**
 * Store wrapped encryption key for a passkey credential
 * Called after passkey registration completes and PRF output is obtained via authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "../../../../../lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { credentialId, wrappedKey } = await request.json();

    if (!credentialId || !wrappedKey) {
      return NextResponse.json(
        { error: "Credential ID and wrapped key are required" },
        { status: 400 },
      );
    }

    // Update the credential with the wrapped key
    // Verify the credential belongs to the authenticated user
    const { error: updateError } = await supabaseAdmin
      .from("passkey_credentials")
      .update({ wrapped_encryption_key: wrappedKey })
      .eq("credential_id", credentialId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to store wrapped key:", updateError);
      return NextResponse.json(
        { error: "Failed to store wrapped key" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to store wrapped key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
