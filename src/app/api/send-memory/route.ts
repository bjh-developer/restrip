/**
 * Send Memory Email API Route
 *
 * Manual endpoint to trigger or retry sending a memory email.
 * Uses the shared sendMemoryEmail function from lib/resend.
 *
 * @module api/send-memory
 */

import { NextRequest, NextResponse } from "next/server";
import { sendMemoryEmail } from "../../../lib/resend";

/**
 * POST /api/send-memory
 *
 * Body: { snapId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { snapId } = (await request.json()) as { snapId?: string };

    if (!snapId) {
      return NextResponse.json({ error: "Missing snapId" }, { status: 400 });
    }

    const result = await sendMemoryEmail(snapId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 },
      );
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
