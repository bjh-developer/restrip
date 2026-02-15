import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import {
  decryptImage,
  decryptDataAsString,
  getServerEncryptionKey,
} from "../../../../lib/simple-encryption";
import { checkRateLimit, rateLimitResponse, READ_LIMIT } from "../../../../lib/rate-limit";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("FATAL: Supabase environment variables are not set");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Fetch snap metadata for viewing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Verify authenticated user via Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Rate limiting by userId
    const rl = checkRateLimit(`snaps:${userId}`, READ_LIMIT);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
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
    if (snap.user_id !== userId) {
      return NextResponse.json(
        { error: "Snap not found" },
        { status: 404 },
      );
    }

    // Get server encryption key
    const encryptionKey = getServerEncryptionKey();

    // Download encrypted image from storage
    const { data: encryptedBlob, error: downloadError } = await supabaseAdmin.storage
      .from("encrypted-images")
      .download(snap.storage_path);

    if (downloadError || !encryptedBlob) {
      console.error("Failed to download encrypted image:", downloadError);
      return NextResponse.json(
        { error: "Failed to load image" },
        { status: 500 },
      );
    }

    // Convert blob to base64
    const arrayBuffer = await encryptedBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const encryptedBase64 = Buffer.from(binary, "binary").toString("base64");

    // Decrypt image
    const decryptedImageDataUrl = await decryptImage(
      encryptedBase64,
      snap.image_iv,
      encryptionKey,
      "image/jpeg",
    );

    // Decrypt caption
    const decryptedCaption = await decryptDataAsString(
      snap.encrypted_caption,
      snap.caption_iv,
      encryptionKey,
    );

    // Return snap metadata with decrypted data
    return NextResponse.json(
      {
        id: snap.id,
        storage_path: snap.storage_path,
        caption: decryptedCaption,
        image_url: decryptedImageDataUrl,
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
