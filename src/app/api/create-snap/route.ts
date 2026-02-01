/**
 * Create Snap API Route Handler
 *
 * Saves snap metadata to the database after image upload and encryption.
 * Supports anonymous uploads (no authentication required) with configurable
 * delivery methods (email or Telegram).
 *
 * @module api/create-snap
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Supported delivery methods for snap notifications */
type DeliveryMethod = "email" | "telegram";

/** Request body shape for creating a snap */
interface CreateSnapRequestBody {
  storagePath: string;
  encryptedCaption: string;
  captionIv: string;
  imageIv: string;
  scheduledSendTime: string;
  deliveryMethod: DeliveryMethod;
  deliveryAddress?: string;
  periodType: string;
}

/** Shape of a snap record in the database */
interface SnapRecord {
  id: string;
  user_id: string | null;
  storage_path: string;
  encrypted_caption: string;
  caption_iv: string;
  image_iv: string;
  send_date: string;
  send_time: string;
  delivery_method: DeliveryMethod;
  delivery_address: string;
  period_type: string;
  created_at: string;
}

/** Success response shape */
interface SuccessResponse {
  snap: SnapRecord;
}

/** Error response shape */
interface ErrorResponse {
  error: string;
}

/**
 * Required fields for snap creation.
 * Used for validation to provide clear error messages.
 */
const REQUIRED_FIELDS: readonly (keyof CreateSnapRequestBody)[] = [
  "storagePath",
  "encryptedCaption",
  "captionIv",
  "imageIv",
  "scheduledSendTime",
  "deliveryMethod",
  "periodType",
] as const;

/**
 * Supabase admin client with elevated permissions.
 * Uses service role key for direct database access.
 */
const supabaseAdmin: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

/**
 * Validates that all required fields are present in the request body.
 *
 * @param body - Parsed request body
 * @returns Object with validation result and missing fields if any
 */
function validateRequiredFields(
  body: Partial<CreateSnapRequestBody>,
): { valid: boolean; missing?: string[] } {
  const missing = REQUIRED_FIELDS.filter((field) => !body[field]);

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
}

/**
 * Validates the scheduled send time is a valid date.
 *
 * @param dateString - ISO date string to validate
 * @returns Parsed Date object or null if invalid
 */
function parseScheduledTime(dateString: string): Date | null {
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Handles POST requests to create a new snap record.
 *
 * Process flow:
 * 1. Validate required fields are present
 * 2. Validate email address if delivery method is email
 * 3. Parse and validate scheduled send time
 * 4. Insert snap record into database
 * 5. Return created snap data
 *
 * @param request - Incoming Next.js request object
 * @returns JSON response with created snap or error
 *
 * @example
 * // Request body
 * {
 *   "storagePath": "anonymous/1234567890-abc.enc",
 *   "encryptedCaption": "base64-encrypted-caption",
 *   "captionIv": "base64-iv",
 *   "imageIv": "base64-iv",
 *   "scheduledSendTime": "2024-06-15T18:00:00.000Z",
 *   "deliveryMethod": "email",
 *   "deliveryAddress": "user@example.com",
 *   "periodType": "surprise"
 * }
 *
 * // Success response (200)
 * {
 *   "snap": { ... snap record ... }
 * }
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const body = (await request.json()) as Partial<CreateSnapRequestBody>;

    // Validate required fields
    const validation = validateRequiredFields(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Missing required fields: ${validation.missing?.join(", ")}` },
        { status: 400 },
      );
    }

    const {
      storagePath,
      encryptedCaption,
      captionIv,
      imageIv,
      scheduledSendTime,
      deliveryMethod,
      deliveryAddress,
      periodType,
    } = body as CreateSnapRequestBody;

    // Validate email address for email delivery
    if (deliveryMethod === "email" && !deliveryAddress) {
      return NextResponse.json(
        { error: "Email address is required for email delivery" },
        { status: 400 },
      );
    }

    // Parse and validate send time
    const sendTime = parseScheduledTime(scheduledSendTime);
    if (!sendTime) {
      return NextResponse.json(
        { error: "Invalid scheduled send time format" },
        { status: 400 },
      );
    }

    // Insert snap record into database
    const { data, error: dbError } = await supabaseAdmin
      .from("snaps")
      .insert({
        user_id: null, // Anonymous upload - null is allowed by schema
        storage_path: storagePath,
        encrypted_caption: encryptedCaption,
        caption_iv: captionIv,
        image_iv: imageIv,
        send_date: sendTime.toISOString().split("T")[0], // Extract YYYY-MM-DD
        send_time: sendTime.toISOString(), // Full ISO timestamp
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress ?? "",
        period_type: periodType,
      })
      .select()
      .single();

    if (dbError || !data) {
      console.error("Database error creating snap:", dbError);
      return NextResponse.json(
        { error: "Failed to save snap to database" },
        { status: 500 },
      );
    }

    console.log("✅ Snap created successfully:", data.id);

    return NextResponse.json(
      { snap: data as SnapRecord },
      { status: 200 },
    );
  } catch (error) {
    console.error("Create snap handler error:", error);

    return NextResponse.json(
      { error: "Failed to create snap" },
      { status: 500 },
    );
  }
}
