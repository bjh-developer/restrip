/**
 * Crop Image API Route Handler
 *
 * Proxies image cropping requests to RunPod's serverless YOLO model.
 * The model detects and extracts photo strips from uploaded images,
 * applying perspective correction and orientation normalization.
 *
 * @module api/crop-image
 */

import { NextRequest, NextResponse } from "next/server";

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
 *
 * Handles both formats:
 * - Data URL: "data:image/png;base64,iVBORw0KGgo..."
 * - Raw base64: "iVBORw0KGgo..."
 *
 * @param image - Image string (data URL or raw base64)
 * @returns Pure base64-encoded image data
 */
function extractBase64Data(image: string): string {
  const commaIndex = image.indexOf(",");
  return commaIndex !== -1 ? image.substring(commaIndex + 1) : image;
}

/**
 * Validates required environment variables for RunPod integration.
 *
 * @returns Object with validation result and missing vars if any
 */
function validateRunPodConfig(): { valid: boolean; missing?: string[] } {
  const missing: string[] = [];

  if (!process.env.RUNPOD_API_KEY) {
    missing.push("RUNPOD_API_KEY");
  }
  if (!process.env.RUNPOD_ENDPOINT_ID) {
    missing.push("RUNPOD_ENDPOINT_ID");
  }

  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  };
}

/**
 * Handles POST requests for image cropping via RunPod.
 *
 * Process flow:
 * 1. Validate RunPod configuration is present
 * 2. Extract base64 image data from request
 * 3. Send to RunPod YOLO endpoint for processing
 * 4. Return cropped photostrip or error
 *
 * @param request - Incoming Next.js request object
 * @returns JSON response with cropped photostrip or error
 *
 * @example
 * // Request body
 * {
 *   "image": "data:image/png;base64,iVBORw0KGgo..."
 * }
 *
 * // Success response (200)
 * {
 *   "success": true,
 *   "photostrip": "base64-encoded-png"
 * }
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const body = (await request.json()) as Partial<CropImageRequestBody>;
    const { image } = body;

    // Validate image is provided
    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "No image provided or invalid format" },
        { status: 400 },
      );
    }

    // Validate RunPod configuration
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

    // Extract pure base64 data (remove data URL prefix if present)
    const base64Data = extractBase64Data(image);

    // Call RunPod API
    console.log("🚀 Sending image to RunPod for processing...");
    const response = await fetch(runpodUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          image: base64Data,
        },
      }),
    });

    if (!response.ok) {
      console.error(`RunPod API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `RunPod API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as RunPodResponse;
    console.log("📥 RunPod response status:", data.status);

    // Extract cropped photostrip from response
    if (data.output?.photostrip) {
      console.log("✅ Photostrip extracted successfully");
      return NextResponse.json({
        success: true,
        photostrip: data.output.photostrip,
      });
    }

    // Handle case where no photostrip was detected
    const errorMessage = data.output?.error ?? data.error ?? "No photostrip detected in image";
    console.error("RunPod processing error:", errorMessage);

    return NextResponse.json(
      { error: errorMessage },
      { status: 422 },
    );
  } catch (error) {
    console.error("Crop image handler error:", error);

    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 },
    );
  }
}
