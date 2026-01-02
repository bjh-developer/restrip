/**
 * Check what type of account exists for an email (for account linking)
 * This is used to determine if we should offer account linking when signup fails
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Use RPC function for efficient server-side lookup
    const { data: accountData, error: rpcError } = await supabaseAdmin.rpc(
      "get_account_type",
      {
        user_email: email,
      },
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return NextResponse.json(
        { error: "Failed to check account type" },
        { status: 500 },
      );
    }

    if (!accountData || accountData.length === 0) {
      return NextResponse.json({ accountType: "none" }, { status: 200 });
    }

    console.log("Account data:", accountData);

    return NextResponse.json({
      accountType: accountData[0].account_type || "password",
      hasPasskey: accountData[0].has_passkey || false,
    });
  } catch (error) {
    console.error("Check account type error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
