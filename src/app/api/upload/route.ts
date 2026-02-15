/**
 * Upload API Route Handler
 *
 * Handles anonymous image uploads with server-side encryption.
 * Images and captions are encrypted using AES-256-GCM before
 * being stored in Supabase Storage.
 *
 * Security model:
 * - Server-side encryption with environment-based key
 * - No authentication required (anonymous uploads)
 * - Encrypted blobs stored with unique timestamps
 *
 * @module api/upload
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  encryptImage,
  encryptData,
  getServerEncryptionKey,
} from "../../../lib/simple-encryption";
import { checkRateLimit, getClientIp, rateLimitResponse, UPLOAD_LIMIT } from "../../../lib/rate-limit";
import { verifyTurnstileToken } from "../../../lib/turnstile";

/** Maximum request body size: 10 MB */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

/** Allowed origin for CORS (set to your production domain) */
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Response shape for successful upload */
interface UploadSuccessResponse {
  storagePath: string;
  encryptedCaption: string;
  captionIv: string;
  imageIv: string;
}

/** Response shape for errors */
interface ErrorResponse {
  error: string;
}

/** Request body shape */
interface UploadRequestBody {
  image: string;
  caption: string;
  turnstileToken?: string;
}

/** Storage bucket name for encrypted images */
const STORAGE_BUCKET = "encrypted-images";

/** Folder prefix for anonymous uploads */
const ANONYMOUS_FOLDER = "anonymous";

/**
 * Supabase admin client instance.
 * Uses service role key for elevated storage access.
 */
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("FATAL: Supabase environment variables are not set");
}

const supabaseAdmin: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Generates a unique file path for storage.
 *
 * Creates a path combining timestamp and random ID to ensure uniqueness
 * while maintaining chronological ordering.
 *
 * @returns Unique file path in format "anonymous/{timestamp}-{randomId}.enc"
 */
function generateUniqueFilePath(): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 9);
  return `${ANONYMOUS_FOLDER}/${timestamp}-${randomId}.enc`;
}

/**
 * Validates the upload request body.
 *
 * @param body - Parsed request body
 * @returns Object with validation result and optional error message
 */
function validateRequestBody(
  body: Partial<UploadRequestBody>,
): { valid: boolean; error?: string } {
  if (!body.image || typeof body.image !== "string") {
    return { valid: false, error: "Missing or invalid image field" };
  }

  if (!body.caption || typeof body.caption !== "string") {
    return { valid: false, error: "Missing or invalid caption field" };
  }

  return { valid: true };
}

/**
 * Handles POST requests for anonymous image uploads.
 *
 * Process flow:
 * 1. Validate request body (image and caption required)
 * 2. Encrypt image using server encryption key
 * 3. Encrypt caption using server encryption key
 * 4. Upload encrypted blob to Supabase Storage
 * 5. Return storage path and encryption metadata
 *
 * @param request - Incoming Next.js request object
 * @returns JSON response with storage path and IVs, or error
 *
 * @example
 * // Request body
 * {
 *   "image": "data:image/png;base64,iVBORw0KGgo...",
 *   "caption": "My memory caption"
 * }
 *
 * // Success response (200)
 * {
 *   "storagePath": "anonymous/1234567890-abc123.enc",
 *   "encryptedCaption": "base64-encrypted-caption",
 *   "captionIv": "base64-iv",
 *   "imageIv": "base64-iv"
 * }
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<UploadSuccessResponse | ErrorResponse>> {
  try {
    // CORS check for anonymous routes
    const origin = request.headers.get("origin");
    if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting by IP
    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`upload:${clientIp}`, UPLOAD_LIMIT);
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

    const body = (await request.json()) as Partial<UploadRequestBody>;

    // CAPTCHA verification (Cloudflare Turnstile)
    const turnstileValid = await verifyTurnstileToken(
      body.turnstileToken ?? "",
      clientIp,
    );
    if (!turnstileValid) {
      return NextResponse.json(
        { error: "CAPTCHA verification failed. Please try again." },
        { status: 403 },
      );
    }

    // Validate required fields
    const validation = validateRequestBody(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error ?? "Invalid request body" },
        { status: 400 },
      );
    }

    const { image, caption } = body as UploadRequestBody;

    // Get server-side encryption key
    const encryptionKey = getServerEncryptionKey();

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

    // Generate unique storage path
    const filePath = generateUniqueFilePath();

    // Upload encrypted blob to Supabase Storage
    const { data, error: storageError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, encryptedBuffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      console.error("Supabase storage error:", storageError);
      return NextResponse.json(
        { error: "Failed to upload encrypted image to storage" },
        { status: 500 },
      );
    }

    console.log("✅ Encrypted image uploaded to:", data.path);

    // Return storage metadata for database record
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
    console.error("Upload handler error:", error);

    // Avoid leaking error details to client
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}
