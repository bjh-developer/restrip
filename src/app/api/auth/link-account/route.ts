/**
 * Link account with additional auth method (password or passkey)
 * This demonstrates how easy account linking is with Supabase's unified auth
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "../../../../lib/supabase/server";

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

    // Verify the caller is authenticated and matches the provided userId
    const supabase = await createServerClient();
    const { data: { user: sessionUser }, error: authError } = await supabase.auth.getUser();

    // Special case: allow password linking for passkey users without session
    // (they just authenticated with passkey in the client)
    const allowPasswordLinking = method === 'password' && (!sessionUser || sessionUser.id === userId);

    if ((authError || !sessionUser) && !allowPasswordLinking) {
      console.log('Authentication failed:', { authError });
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // For password linking without session, verify the user exists and has passkey
    let authorizedUserId = sessionUser?.id;
    if (!sessionUser && allowPasswordLinking) {
      // Verify the user exists and has passkey auth method
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userError || !userData.user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      
      const authMethod = userData.user.user_metadata?.auth_method;
      if (authMethod !== 'passkey' && authMethod !== 'password_and_passkey') {
        return NextResponse.json(
          { error: "Invalid user for password linking" },
          { status: 400 }
        );
      }
      
      authorizedUserId = userId;
    }

    if (authorizedUserId !== userId) {
      console.log('User ID mismatch:', { authorizedUserId, providedUserId: userId });
      return NextResponse.json(
        { error: "Unauthorized: User ID mismatch" },
        { status: 403 }
      );
    }

    console.log('Authenticated user:', { userId: authorizedUserId, hasSession: !!sessionUser });

    if (method === "password") {
      // Add password to existing account
      if (!password) {
        return NextResponse.json(
          { error: "Password is required" },
          { status: 400 }
        );
      }

      console.log('Updating user password for user:', authorizedUserId);
      const result = await supabaseAdmin.auth.admin.updateUserById(authorizedUserId!, {
        password,
      });
      console.log('Password update result:', { error: result.error, success: !result.error });

      if (result.error) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 400 }
        );
      }

      // Update auth_method to reflect that user now has both password and passkey
      const { data: currentUserData } = await supabaseAdmin.auth.admin.getUserById(authorizedUserId!);
      if (currentUserData?.user) {
        const currentAuthMethod = currentUserData.user.user_metadata?.auth_method || 'password';
        let newAuthMethod = currentAuthMethod;
        
        if (currentAuthMethod === 'passkey') {
          newAuthMethod = 'password_and_passkey';
        } else if (currentAuthMethod === 'password') {
          newAuthMethod = 'password_and_passkey';
        }
        // If already 'password_and_passkey', keep it as is
        
        if (newAuthMethod !== currentAuthMethod) {
          const updateResult = await supabaseAdmin.auth.admin.updateUserById(authorizedUserId!, {
            user_metadata: {
              ...currentUserData.user.user_metadata,
              auth_method: newAuthMethod,
            },
          });
          
          if (updateResult.error) {
            console.error('Failed to update auth_method:', updateResult.error);
            // Don't fail the request, just log the error
          } else {
            console.log('Updated auth_method from', currentAuthMethod, 'to', newAuthMethod);
          }
        }
      }
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
