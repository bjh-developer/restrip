import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  encryptImage,
  encryptData,
  getServerEncryptionKey,
} from "../../../lib/simple-encryption";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

// Upload to Supabase Storage with server-side encryption (anonymous - no auth required)
export async function POST(request: NextRequest) {
  try {
    const { image, caption } = await request.json();

    if (!image || !caption) {
      return NextResponse.json(
        { error: "Missing required fields (image and caption)" },
        { status: 400 },
      );
    }

    // Get server encryption key
    const encryptionKey = getServerEncryptionKey();

    // Encrypt the image server-side
    console.log("🔐 Encrypting image server-side...");
    const { encrypted: encryptedImage, iv: imageIv } = await encryptImage(
      image,
      encryptionKey,
    );
    console.log("✅ Image encrypted successfully");

    // Encrypt the caption server-side
    console.log("🔐 Encrypting caption server-side...");
    const { encrypted: encryptedCaption, iv: captionIv } = await encryptData(
      caption,
      encryptionKey,
    );
    console.log("✅ Caption encrypted successfully");

    // Convert encrypted image base64 to buffer for upload
    const buffer = Buffer.from(encryptedImage, "base64");

    // Generate unique file path using anonymous folder
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filePath = `anonymous/${timestamp}-${randomId}.enc`;

    // Upload encrypted blob to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from("encrypted-images")
      .upload(filePath, buffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage error:", error);
      return NextResponse.json(
        { error: "Failed to upload to storage" },
        { status: 500 },
      );
    }

    // Return the storage path and encrypted caption data
    return NextResponse.json(
      {
        storagePath: data.path,
        encryptedCaption,
        captionIv,
        imageIv,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
