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
}

/** Storage bucket name for encrypted images */
const STORAGE_BUCKET = "encrypted-images";

/** Folder prefix for anonymous uploads */
const ANONYMOUS_FOLDER = "anonymous";

/**
 * Supabase admin client instance.
 * Uses service role key for elevated storage access.
 */
const supabaseAdmin: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
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
    const body = (await request.json()) as Partial<UploadRequestBody>;

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
