import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "../../../lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

// Save snap metadata to database
export async function POST(request: NextRequest) {
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

    const {
      storagePath,
      encryptedCaption,
      captionIv,
      imageIv,
      scheduledSendTime,
      deliveryMethod,
      deliveryAddress,
      periodType,
    } = await request.json();

    if (
      !storagePath ||
      !encryptedCaption ||
      !captionIv ||
      !imageIv ||
      !scheduledSendTime ||
      !deliveryMethod ||
      !deliveryAddress ||
      !periodType
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const sendTime = new Date(scheduledSendTime);
    if (isNaN(sendTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled send time" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("snaps")
      .insert({
        user_id: sessionUser.id,
        storage_path: storagePath,
        encrypted_caption: encryptedCaption,
        caption_iv: captionIv,
        image_iv: imageIv,
        send_date: sendTime.toISOString().split("T")[0], // YYYY-MM-DD
        send_time: sendTime.toISOString(), // Full ISO timestamp
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress,
        period_type: periodType,
      })
      .select();

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "Failed to create snap" },
        { status: 500 },
      );
    }

    return NextResponse.json({ snap: data[0] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create snap" },
      { status: 500 },
    );
  }
}
