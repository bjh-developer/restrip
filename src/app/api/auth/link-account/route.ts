/**
 * Link account with additional auth method (password or passkey)
 * This demonstrates how easy account linking is with Supabase's unified auth
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { method, password, userId } = await request.json();
    console.log('Link account request:', { method, hasPassword: !!password, userId });

    if (!method) {
      return NextResponse.json(
        { error: "Method is required (password or passkey)" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify the user exists and get their data
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (getUserError || !userData.user) {
      console.log('User not found:', { userId, error: getUserError });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userData.user;
    console.log('Found user:', { userId: user.id, email: user.email });

    let result;

    if (method === "password") {
      // Add password to existing account
      if (!password) {
        return NextResponse.json(
          { error: "Password is required" },
          { status: 400 }
        );
      }

      console.log('Updating user password for user:', user.id);
      result = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password,
      });
      console.log('Password update result:', { error: result.error, success: !result.error });
    } else if (method === "passkey") {
      // For passkey linking, the user would go through the normal passkey registration flow
      // Since they're already authenticated, it would link to their existing account
      return NextResponse.json({
        message: "For passkey linking, use the passkey registration flow",
        redirect: "/auth/passkey",
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid method. Use "password" or "passkey"' },
        { status: 400 }
      );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${method} linked to account successfully`,
    });
  } catch (error) {
    console.error("Link account error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
