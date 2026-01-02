import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Save snap metadata to database
export async function POST(request: NextRequest) {
  try {
    const {
      userId,
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
      !userId ||
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
        { status: 400 }
      );
    }

    const sendTime = new Date(scheduledSendTime);

    const { data, error } = await supabase.from("snaps").insert({
      user_id: userId,
      storage_path: storagePath,
      encrypted_caption: encryptedCaption,
      caption_iv: captionIv,
      image_iv: imageIv,
      send_date: sendTime.toISOString().split("T")[0], // YYYY-MM-DD
      send_time: sendTime.toISOString(), // Full ISO timestamp
      delivery_method: deliveryMethod,
      delivery_address: deliveryAddress,
      period_type: periodType,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to create snap" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Create snap endpoint" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create snap" },
      { status: 500 }
    );
  }
}
