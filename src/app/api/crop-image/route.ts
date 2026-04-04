/**
 * Crop Image API Route Handler
 *
 * Proxies image cropping requests to either a local Python server
 * or RunPod's serverless YOLO model, controlled by the CROP_BACKEND
 * environment variable.
 *
 * Backends:
 * - "local"  → LOCAL_CROP_URL (default http://localhost:8000/crop)
 * - "runpod" → RunPod serverless API (default)
 *
 * @module api/crop-image
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  CROP_LIMIT,
} from "../../../lib/rate-limit";

/** Maximum request body size: 10 MB */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

/** Allowed origin for CORS */
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Request body shape */
interface CropImageRequestBody {
  image: string;
}

/** RunPod API response shape */
interface RunPodResponse {
  output?: {
    success?: boolean;
    photostrip?: string;
    error?: string;
  };
  error?: string;
  status?: string;
}

/** Local backend response shape */
interface LocalCropResponse {
  success: boolean;
  photostrip?: string;
  error?: string;
}

/** Success response shape */
interface SuccessResponse {
  success: true;
  photostrip: string;
}

/** Error response shape */
interface ErrorResponse {
  error: string;
}

/**
 * Extracts base64 image data from a data URL or returns raw base64.
 */
function extractBase64Data(image: string): string {
  const commaIndex = image.indexOf(",");
  return commaIndex !== -1 ? image.substring(commaIndex + 1) : image;
}

/**
 * Validates required environment variables for RunPod integration.
 */
function validateRunPodConfig(): { valid: boolean; missing?: string[] } {
  const missing: string[] = [];

  if (!process.env.RUNPOD_API_KEY) missing.push("RUNPOD_API_KEY");
  if (!process.env.RUNPOD_ENDPOINT_ID) missing.push("RUNPOD_ENDPOINT_ID");

  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  };
}

/** Whether the crop backend is set to local */
function isLocalBackend(): boolean {
  return (process.env.CROP_BACKEND ?? "runpod").toLowerCase() === "local";
}

// =============================================================================
// Local backend handler
// =============================================================================

/**
 * Sends the image to the local Python crop server.
 */
async function cropViaLocal(
  base64Data: string,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const localUrl = process.env.LOCAL_CROP_URL ?? "http://localhost:8000/crop";

  console.log(`🏠 Sending image to local crop server at ${localUrl}...`);

  const response = await fetch(localUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Data }),
  });

  if (!response.ok) {
    console.error(`Local crop server error: ${response.status}`);
    return NextResponse.json(
      { error: "Image processing failed" },
      { status: 502 },
    );
  }

  const data = (await response.json()) as LocalCropResponse;

  if (data.success && data.photostrip) {
    console.log("✅ Photostrip extracted successfully (local)");
    return NextResponse.json({ success: true, photostrip: data.photostrip });
  }

  const errorMessage = data.error ?? "No photostrip detected in image";
  console.error("Local crop error:", errorMessage);
  return NextResponse.json({ error: errorMessage }, { status: 422 });
}

// =============================================================================
// RunPod backend handler
// =============================================================================

/**
 * Sends the image to RunPod's serverless YOLO endpoint.
 */
async function cropViaRunPod(
  base64Data: string,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const configValidation = validateRunPodConfig();
  if (!configValidation.valid) {
    console.error(
      "Missing RunPod configuration:",
      configValidation.missing?.join(", "),
    );
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const apiKey = process.env.RUNPOD_API_KEY!;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID!;
  const runpodUrl = `https://api.runpod.ai/v2/${endpointId}/runsync`;

  console.log("🚀 Sending image to RunPod for processing...");
  const response = await fetch(runpodUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: { image: base64Data } }),
  });

  if (!response.ok) {
    console.error(`RunPod API error: ${response.status}`);
    return NextResponse.json(
      { error: "Image processing failed" },
      { status: 502 },
    );
  }

  const data = (await response.json()) as RunPodResponse;
  console.log("📥 RunPod response status:", data.status);

  if (data.output?.photostrip) {
    console.log("✅ Photostrip extracted successfully (RunPod)");
    return NextResponse.json({
      success: true,
      photostrip: data.output.photostrip,
    });
  }

  const errorMessage =
    data.output?.error ?? data.error ?? "No photostrip detected in image";
  console.error("RunPod processing error:", errorMessage);
  return NextResponse.json({ error: errorMessage }, { status: 422 });
}

// =============================================================================
// Route handler
// =============================================================================

/**
 * POST /api/crop-image
 *
 * Routes to the local Python server or RunPod based on CROP_BACKEND env var.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // Authentication check — require Clerk session
    const { userId } = await auth();
    if (!userId) {
      // Fall back to IP-based rate limiting for anonymous users
      const origin = request.headers.get("origin");
      if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const clientIp = getClientIp(request);
      const rl = checkRateLimit(`crop:${clientIp}`, CROP_LIMIT);
      if (!rl.allowed) {
        return rateLimitResponse(rl.retryAfterSeconds);
      }
    } else {
      const rl = checkRateLimit(`crop:${userId}`, CROP_LIMIT);
      if (!rl.allowed) {
        return rateLimitResponse(rl.retryAfterSeconds);
      }
    }

    // Body size check
    const contentLength = parseInt(
      request.headers.get("content-length") ?? "0",
    );
    if (contentLength > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large (max 10 MB)" },
        { status: 413 },
      );
    }

    const body = (await request.json()) as Partial<CropImageRequestBody>;
    const { image } = body;

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "No image provided or invalid format" },
        { status: 400 },
      );
    }

    const base64Data = extractBase64Data(image);

    if (isLocalBackend()) {
      return await cropViaLocal(base64Data);
    }

    return await cropViaRunPod(base64Data);
  } catch (error) {
    console.error("Crop image handler error:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 },
    );
  }
}
