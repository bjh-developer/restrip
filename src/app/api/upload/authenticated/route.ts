/**
 * Authenticated Upload API Route Handler
 *
 * Handles image uploads for authenticated users.
 * Images are stored as-is (no client-side encryption).
 *
 * Flow:
 * 1. Verify authenticated session via Clerk
 * 2. Accept image + metadata
 * 3. Upload image to Supabase Storage under user's folder
 * 4. Create snap record in database with user_id
 *
 * @module api/upload/authenticated
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import {
  encryptImage,
  encryptData,
  getServerEncryptionKey,
} from "../../../../lib/simple-encryption";
import { checkRateLimit, rateLimitResponse, UPLOAD_LIMIT } from "../../../../lib/rate-limit";
import { scheduleOrSendMemoryEmail } from "../../../../lib/resend";

/** Maximum request body size: 10 MB */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

/** Email validation regex */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Request body shape */
interface AuthUploadBody {
  image: string;
  caption: string;
  filePath: string;
  scheduledSendTime: string;
  deliveryMethod: "email" | "telegram";
  deliveryAddress: string;
  periodType: string;
}

/** Success response shape */
interface SuccessResponse {
  snap: {
    id: string;
    storage_path: string;
    encrypted_caption: string;
    caption_iv: string;
    image_iv: string;
  };
}

/** Error response shape */
interface ErrorResponse {
  error: string;
}

/** Storage bucket name */
const STORAGE_BUCKET = "encrypted-images";

/**
 * Supabase admin client for elevated storage/database access.
 */
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("FATAL: Supabase environment variables are not set");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * POST /api/upload/authenticated
 *
 * Accepts image data and stores it in Supabase.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // Verify authentication via Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Rate limiting by userId
    const rl = checkRateLimit(`auth-upload:${userId}`, UPLOAD_LIMIT);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    // Body size check
    const contentLength = parseInt(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large (max 10 MB)" },
        { status: 413 },
      );
    }

    const body = (await request.json()) as Partial<AuthUploadBody>;

    // Validate required fields
    const requiredFields: (keyof AuthUploadBody)[] = [
      "image",
      "caption",
      "scheduledSendTime",
      "deliveryMethod",
      "periodType",
    ];

    const missing = requiredFields.filter((f) => !body[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 },
      );
    }

    const {
      image,
      caption,
      scheduledSendTime,
      deliveryMethod,
      deliveryAddress,
      periodType,
    } = body as AuthUploadBody;

    // Get server-side encryption key
    const encryptionKey = getServerEncryptionKey();

    // Validate email if delivery method is email
    if (deliveryMethod === "email") {
      if (!deliveryAddress) {
        return NextResponse.json(
          { error: "Email address is required for email delivery" },
          { status: 400 },
        );
      }
      if (!EMAIL_REGEX.test(deliveryAddress)) {
        return NextResponse.json(
          { error: "Invalid email address format" },
          { status: 400 },
        );
      }
    }

    // Parse send time
    const sendTime = new Date(scheduledSendTime);
    if (isNaN(sendTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled send time" },
        { status: 400 },
      );
    }

    // Encrypt the image
    console.log("🔐 Encrypting image server-side...");
    const { encrypted: encryptedImage, iv: imageIv } = await encryptImage(
      image,
      encryptionKey,
    );
    console.log("✅ Image encrypted successfully");

    // Encrypt the caption
    console.log("🔐 Encrypting caption server-side...");
    const { encrypted: encryptedCaption, iv: captionIv } = await encryptData(
      caption,
      encryptionKey,
    );
    console.log("✅ Caption encrypted successfully");

    // Convert encrypted base64 to buffer for binary storage
    const encryptedBuffer = Buffer.from(encryptedImage, "base64");

    // Generate unique storage path with .enc extension
    // Sanitize userId to prevent path traversal — Clerk IDs are alphanumeric but
    // stripping anything outside [a-zA-Z0-9_-] ensures no '../' can sneak through.
    const safeUserId = userId.replace(/[^a-zA-Z0-9_\-]/g, "");
    if (!safeUserId) {
      return NextResponse.json({ error: "Invalid user identity" }, { status: 400 });
    }
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const filePath = `${safeUserId}/${timestamp}-${randomId}.enc`;

    // Upload encrypted image to Supabase Storage
    const { data: uploadData, error: storageError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, encryptedBuffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 },
      );
    }

    console.log("✅ Encrypted image uploaded to:", uploadData.path);

    // Generate a link token for telegram delivery to prevent IDOR
    // 8 bytes = 16 hex chars (keeps deep link under Telegram's 64-char limit)
    const telegramLinkToken = deliveryMethod === "telegram"
      ? randomBytes(8).toString("hex")
      : null;

    // Insert snap record into database with user_id and encrypted data
    const { data: snapData, error: dbError } = await supabaseAdmin
      .from("snaps")
      .insert({
        user_id: userId,
        storage_path: uploadData.path,
        encrypted_caption: encryptedCaption,
        caption_iv: captionIv,
        image_iv: imageIv,
        send_date: sendTime.toISOString().split("T")[0],
        send_time: sendTime.toISOString(),
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress ?? "",
        period_type: periodType,
        ...(telegramLinkToken ? { telegram_link_token: telegramLinkToken } : {}),
      })
      .select("id, storage_path, encrypted_caption, caption_iv, image_iv, telegram_link_token")
      .single();

    if (dbError || !snapData) {
      console.error("Database error:", dbError);
      // Clean up uploaded file on DB failure — use the locally constructed
      // filePath (already sanitized) rather than the server-echoed path.
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([filePath]);
      return NextResponse.json(
        { error: "Failed to save snap to database" },
        { status: 500 },
      );
    }

    console.log(`✅ Snap ${snapData.id} created for user ${userId}`);

    // once again, 30d on resend
    if (deliveryMethod === "email") {
      console.log("[authenticated] Enqueueing email delivery for snap:", snapData.id);
      try {
        const emailResult = await scheduleOrSendMemoryEmail(snapData.id);
        console.log("[authenticated] Email result:", emailResult);
      } catch (err) {
        console.error("[authenticated] Failed to enqueue email:", err);
      }
    }

    return NextResponse.json({ snap: snapData }, { status: 200 });
  } catch (error) {
    console.error("Authenticated upload handler error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}
