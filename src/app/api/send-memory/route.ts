/**
 * Send Memory Email API Route
 *
 * Manual endpoint to trigger or retry sending a memory email.
 * Uses the shared sendMemoryEmail function from lib/resend.
 *
 * @module api/send-memory
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { sendMemoryEmail } from "../../../lib/resend";

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("FATAL: Supabase environment variables are not set");
}
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/send-memory
 *
 * Body: { snapId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.SEND_MEMORY_SECRET;
    const providedSecret = request.headers.get("x-send-memory-secret");
    const isInternalCall =
      !!secret && !!providedSecret && providedSecret === secret;

    let userId: string | null = null;
    if (!isInternalCall) {
      const authResult = await auth();
      userId = authResult.userId;
      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }
    }

    const { snapId } = (await request.json()) as { snapId?: string };

    if (!snapId) {
      return NextResponse.json({ error: "Missing snapId" }, { status: 400 });
    }

    // ownership check
    if (!isInternalCall && userId) {
      const { data: snap, error: fetchError } = await supabaseAdmin
        .from("snaps")
        .select("id, user_id, delivery_method")
        .eq("id", snapId)
        .single();

      if (fetchError || !snap || snap.user_id !== userId) {
        return NextResponse.json({ error: "Snap not found" }, { status: 404 });
      }
      if (snap.delivery_method !== "email") {
        return NextResponse.json(
          { error: "Delivery method is not email" },
          { status: 400 },
        );
      }
    }

    const result = await sendMemoryEmail(snapId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailId: result.emailId });
  } catch (error) {
    console.error("[send-memory] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
