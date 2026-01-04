/**
 * Fetch wrapped encryption key for a specific passkey credential
 * Used during passkey login to unwrap the master encryption key
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get("credentialId");

    if (!credentialId) {
      return NextResponse.json(
        { error: "Credential ID is required" },
        { status: 400 },
      );
    }

    // Fetch the wrapped key from the credentials table
    const { data, error } = await supabaseAdmin
      .from("passkey_credentials")
      .select("wrapped_encryption_key")
      .eq("credential_id", credentialId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      wrappedKey: data.wrapped_encryption_key,
    });
  } catch (error) {
    console.error("Failed to fetch wrapped key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
