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
import { randomBytes } from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  UPLOAD_LIMIT,
} from "../../../lib/rate-limit";
import { scheduleOrSendMemoryEmail } from "../../../lib/resend";

/** Maximum request body size: 1 MB (metadata only, no image) */
const MAX_BODY_SIZE = 1 * 1024 * 1024;

/** Allowed origin for CORS */
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Email validation regex */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  turnstileToken?: string;
  uploadNonce?: string;
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
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("FATAL: Supabase environment variables are not set");
}

const supabaseAdmin: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Validates that all required fields are present in the request body.
 *
 * @param body - Parsed request body
 * @returns Object with validation result and missing fields if any
 */
function validateRequiredFields(body: Partial<CreateSnapRequestBody>): {
  valid: boolean;
  missing?: string[];
} {
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
 * Verify and consume the nonce to prevent replay attacks.
 *
 * @param nonce - The unique nonce generated during upload
 * @returns Whether the nonce is valid and has been consumed
 *
 * The nonce is a cryptographically random single-use token with a short expiry.
 * IP binding is intentionally omitted: edge proxies may assign different IPs to
 * the /api/upload and /api/create-snap legs of the same browser session.
 */
async function verifyAndConsumeNonce(nonce: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("upload_nonces")
    .update({ used: true })
    .eq("nonce", nonce)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .select()
    .single();

  return !error && !!data;
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
    // CORS check for anonymous routes
    const origin = request.headers.get("origin");
    if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting by IP
    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`create-snap:${clientIp}`, UPLOAD_LIMIT);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSeconds);
    }

    // Body size check
    const contentLength = parseInt(
      request.headers.get("content-length") ?? "0",
    );
    if (contentLength > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 },
      );
    }

    const body = (await request.json()) as Partial<CreateSnapRequestBody>;
    const {
      storagePath,
      encryptedCaption,
      captionIv,
      imageIv,
      scheduledSendTime,
      deliveryMethod,
      deliveryAddress,
      periodType,
      uploadNonce,
    } = body as CreateSnapRequestBody;

    // Nonce verification (Cloudflare Turnstile)
    if (!uploadNonce) {
      return NextResponse.json(
        { error: "Missing upload verification token" },
        { status: 403 },
      );
    }

    const nonceValid = await verifyAndConsumeNonce(uploadNonce);
    if (!nonceValid) {
      return NextResponse.json(
        { error: "Invalid or expired upload token. Please start over." },
        { status: 403 },
      );
    }

    // Validate required fields
    const validation = validateRequiredFields(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Missing required fields: ${validation.missing?.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate email address for email delivery
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

    // Parse and validate send time
    const sendTime = parseScheduledTime(scheduledSendTime);
    if (!sendTime) {
      return NextResponse.json(
        { error: "Invalid scheduled send time format" },
        { status: 400 },
      );
    }

    // Generate a link token for telegram delivery to prevent IDOR
    // 8 bytes = 16 hex chars (keeps deep link under Telegram's 64-char limit)
    const telegramLinkToken =
      deliveryMethod === "telegram" ? randomBytes(8).toString("hex") : null;

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
        ...(telegramLinkToken
          ? { telegram_link_token: telegramLinkToken }
          : {}),
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

    // resend has a 30d limit oops
    if (deliveryMethod === "email") {
      console.log("[create-snap] Enqueueing email delivery for snap:", data.id);
      try {
        const emailResult = await scheduleOrSendMemoryEmail(data.id);
        console.log("[create-snap] Email result:", emailResult);
      } catch (err) {
        console.error("[create-snap] Failed to enqueue email:", err);
      }
    }

    return NextResponse.json({ snap: data as SnapRecord }, { status: 200 });
  } catch (error) {
    console.error("Create snap handler error:", error);

    return NextResponse.json(
      { error: "Failed to create snap" },
      { status: 500 },
    );
  }
}
