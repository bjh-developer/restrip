import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Upload to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const { encryptedImage, userId } = await request.json();

    if (!encryptedImage || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Convert base64 to buffer for upload
    const base64Data = encryptedImage.replace(/^data:.*?;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filePath = `${userId}/${timestamp}-${randomId}.enc`;

    // Upload encrypted blob to Supabase Storage
    const { data, error } = await supabase.storage
      .from("encrypted-images")
      .upload(filePath, buffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage error:", error);
      return NextResponse.json(
        { error: "Failed to upload to storage" },
        { status: 500 }
      );
    }

    // Return the storage path (not the full URL, just the path)
    return NextResponse.json(
      {
        storagePath: data.path,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
