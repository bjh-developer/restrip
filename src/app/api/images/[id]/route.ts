/**
 * Image Decryption API Route Handler
 *
 * Returns a decrypted image as binary data with HTTP cache headers.
 * This enables the browser's native cache to avoid re-downloading
 * and re-decrypting images on subsequent visits.
 *
 * Cache strategy:
 * - `Cache-Control: private, max-age=86400, immutable`
 * - `ETag` based on snap ID (content doesn't change)
 * - Supports `If-None-Match` for 304 Not Modified responses
 *
 * @module api/images/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import {
  decryptImage,
  getServerEncryptionKey,
} from "../../../../lib/simple-encryption";
import { checkRateLimit, rateLimitResponse, READ_LIMIT } from "../../../../lib/rate-limit";

/** Storage bucket name */
const STORAGE_BUCKET = "encrypted-images";

/** Cache duration: 24 hours (images are immutable once uploaded) */
const CACHE_MAX_AGE = 86400;

/**
 * Supabase admin client for storage access.
 */
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("FATAL: Supabase environment variables are not set");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * GET /api/images/[id]
 *
 * Downloads, decrypts, and returns the image for a given snap ID.
 * Sets cache headers so the browser caches the decrypted result.
 *
 * @param request - Incoming request (may include If-None-Match header)
 * @param context - Route context with snap ID param
 * @returns Decrypted image binary with cache headers, or 304/error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: snapId } = await params;

    // Verify authentication via Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Rate limiting by userId
    const rl = checkRateLimit(`images:${userId}`, READ_LIMIT);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    // Fetch snap to verify ownership FIRST (before ETag check)
    const { data: snap, error: fetchError } = await supabaseAdmin
      .from("snaps")
      .select("id, user_id, storage_path, image_iv")
      .eq("id", snapId)
      .single();

    if (fetchError || !snap) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 },
      );
    }

    // Verify ownership
    if (snap.user_id !== userId) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 },
      );
    }

    // Generate ETag scoped to user + snap (prevents cross-user cache confusion)
    const etag = `"snap-${snapId}-${userId}"`;

    // Check If-None-Match for conditional requests (AFTER ownership verified)
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": `private, max-age=${CACHE_MAX_AGE}, immutable`,
        },
      });
    }

    // Download encrypted image from storage
    const { data: encryptedBlob, error: downloadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(snap.storage_path);

    if (downloadError || !encryptedBlob) {
      console.error("[Image API] Download error for snap", snapId, downloadError);
      return NextResponse.json(
        { error: "Failed to load image" },
        { status: 500 },
      );
    }

    // Convert blob to base64 for decryption
    const arrayBuffer = await encryptedBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const encryptedBase64 = Buffer.from(binary, "binary").toString("base64");

    // Decrypt image
    const encryptionKey = getServerEncryptionKey();
    const decryptedDataUrl = await decryptImage(
      encryptedBase64,
      snap.image_iv,
      encryptionKey,
      "image/jpeg",
    );

    // Extract the raw binary from the data URL
    const base64Data = decryptedDataUrl.split(",")[1];
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Return as binary image with cache headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(imageBuffer.byteLength),
        "Cache-Control": `private, max-age=${CACHE_MAX_AGE}, immutable`,
        ETag: etag,
        // Prevent CDN/proxy caching of private encrypted content
        Vary: "Authorization, Cookie",
      },
    });
  } catch (error) {
    console.error("[Image API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to load image" },
      { status: 500 },
    );
  }
}
