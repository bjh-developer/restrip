/**
 * Authenticated Upload API Route Handler
 *
 * Handles image uploads for authenticated users with client-side encryption.
 * Unlike the anonymous /api/upload route, this does NOT encrypt on the server —
 * images arrive already encrypted from the client (zero-knowledge).
 *
 * Flow:
 * 1. Verify authenticated session
 * 2. Accept pre-encrypted image blob + metadata
 * 3. Upload encrypted blob to Supabase Storage under user's folder
 * 4. Create snap record in database with user_id
 *
 * @module api/upload/authenticated
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "../../../../lib/supabase/server";

/** Request body shape */
interface AuthUploadBody {
  encryptedImage: string;
  encryptedCaption: string;
  captionIv: string;
  imageIv: string;
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
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

/**
 * POST /api/upload/authenticated
 *
 * Accepts client-encrypted data and stores it in Supabase.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // Verify authentication
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Partial<AuthUploadBody>;

    // Validate required fields
    const requiredFields: (keyof AuthUploadBody)[] = [
      "encryptedImage",
      "encryptedCaption",
      "captionIv",
      "imageIv",
      "filePath",
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
      encryptedImage,
      encryptedCaption,
      captionIv,
      imageIv,
      filePath,
      scheduledSendTime,
      deliveryMethod,
      deliveryAddress,
      periodType,
    } = body as AuthUploadBody;

    // Verify the file path belongs to this user
    if (!filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: "Invalid storage path" },
        { status: 403 },
      );
    }

    // Validate email if delivery method is email
    if (deliveryMethod === "email" && !deliveryAddress) {
      return NextResponse.json(
        { error: "Email address is required for email delivery" },
        { status: 400 },
      );
    }

    // Parse send time
    const sendTime = new Date(scheduledSendTime);
    if (isNaN(sendTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled send time" },
        { status: 400 },
      );
    }

    // Convert base64 encrypted image to buffer for binary storage
    const encryptedBuffer = Buffer.from(encryptedImage, "base64");

    // Upload encrypted blob to Supabase Storage
    const { data: uploadData, error: storageError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, encryptedBuffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return NextResponse.json(
        { error: "Failed to upload encrypted image" },
        { status: 500 },
      );
    }

    console.log("✅ Encrypted image uploaded to:", uploadData.path);

    // Insert snap record into database with user_id
    const { data: snapData, error: dbError } = await supabaseAdmin
      .from("snaps")
      .insert({
        user_id: user.id,
        storage_path: uploadData.path,
        encrypted_caption: encryptedCaption,
        caption_iv: captionIv,
        image_iv: imageIv,
        send_date: sendTime.toISOString().split("T")[0],
        send_time: sendTime.toISOString(),
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress ?? "",
        period_type: periodType,
      })
      .select("id, storage_path")
      .single();

    if (dbError || !snapData) {
      console.error("Database error:", dbError);
      // Clean up uploaded file on DB failure
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([uploadData.path]);
      return NextResponse.json(
        { error: "Failed to save snap to database" },
        { status: 500 },
      );
    }

    console.log(`✅ Snap ${snapData.id} created for user ${user.id}`);

    return NextResponse.json({ snap: snapData }, { status: 200 });
  } catch (error) {
    console.error("Authenticated upload handler error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}
