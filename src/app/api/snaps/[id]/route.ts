import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "../../../../lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

// Fetch snap metadata for viewing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Verify authenticated user
    const supabase = await createServerClient();
    const {
      data: { user: sessionUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !sessionUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id: snapId } = await params;

    // Fetch snap from database
    const { data: snap, error } = await supabaseAdmin
      .from("snaps")
      .select("*")
      .eq("id", snapId)
      .single();

    if (error || !snap) {
      return NextResponse.json({ error: "Snap not found" }, { status: 404 });
    }

    // Verify the snap belongs to the authenticated user
    if (snap.user_id !== sessionUser.id) {
      return NextResponse.json(
        { error: "Unauthorized to view this snap" },
        { status: 403 },
      );
    }

    // Return snap metadata (encrypted data + IVs, but no decryption server-side)
    return NextResponse.json(
      {
        id: snap.id,
        storage_path: snap.storage_path,
        encrypted_caption: snap.encrypted_caption,
        caption_iv: snap.caption_iv,
        image_iv: snap.image_iv,
        send_date: snap.send_date,
        send_time: snap.send_time,
        delivery_method: snap.delivery_method,
        period_type: snap.period_type,
        delivered: snap.delivered,
        delivered_at: snap.delivered_at,
        created_at: snap.created_at,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to fetch snap:", error);
    return NextResponse.json(
      { error: "Failed to fetch snap" },
      { status: 500 },
    );
  }
}
