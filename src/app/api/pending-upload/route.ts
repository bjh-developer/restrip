import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("FATAL: Supabase environment variables are not set");
}

const supabaseAdmin: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** Maximum form_data size: 10 MB */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/pending-upload
 *
 * Temporarily stores form data for the sign-up redirect flow.
 * Returns a unique token that can be used to retrieve the data later.
 */
export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Payload too large" },
        { status: 413 },
      );
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const token = randomBytes(32).toString("hex");

    // Clean up expired rows opportunistically
    await supabaseAdmin
      .from("pending_uploads")
      .delete()
      .lt("expires_at", new Date().toISOString());

    const { error } = await supabaseAdmin.from("pending_uploads").insert({
      token,
      form_data: body,
    });

    if (error) {
      console.error("Failed to store pending upload:", error);
      return NextResponse.json(
        { error: "Failed to store form data" },
        { status: 500 },
      );
    }

    return NextResponse.json({ token });
  } catch (err) {
    console.error("Pending upload error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/pending-upload?token=<token>
 *
 * Retrieves and deletes the stored form data for the given token.
 * Only returns non-expired data. The row is deleted after retrieval
 * to prevent replay.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json(
        { error: "Invalid or missing token" },
        { status: 400 },
      );
    }

    // Atomically delete and return the row — prevents TOCTOU replay
    const { data: rows, error } = await supabaseAdmin
      .from("pending_uploads")
      .delete()
      .eq("token", token)
      .select("form_data, expires_at");

    if (error || !rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Token not found or expired" },
        { status: 404 },
      );
    }

    const row = rows[0];

    // Check expiry on the deleted row
    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 410 },
      );
    }

    return NextResponse.json({ formData: row.form_data });
  } catch (err) {
    console.error("Pending upload retrieval error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
