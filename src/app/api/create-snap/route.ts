import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

// Save snap metadata to database (anonymous - no auth required)
export async function POST(request: NextRequest) {
  try {
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
      !periodType
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // deliveryAddress is only required for email, not for telegram
    if (deliveryMethod === "email" && !deliveryAddress) {
      return NextResponse.json(
        { error: "Email address is required for email delivery" },
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
        user_id: null, // Anonymous upload - null is allowed by schema
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
