/**
 * Cloudflare Turnstile CAPTCHA Verification
 *
 * Server-side verification of Turnstile tokens for anonymous routes.
 * The client must include a `turnstileToken` field in the request body.
 *
 * Setup:
 * 1. Create a Turnstile widget at https://dash.cloudflare.com/?to=/:account/turnstile
 * 2. Set TURNSTILE_SECRET_KEY in your environment variables
 * 3. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY for the client-side widget
 *
 * @module lib/turnstile
 */

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify a Turnstile CAPTCHA token server-side.
 *
 * @param token - The cf-turnstile-response token from the client
 * @param remoteIp - Optional client IP for additional validation
 * @returns Whether the token is valid
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Skip verification if Turnstile is not configured (development)
  if (!secretKey) {
    console.warn(
      "⚠️ TURNSTILE_SECRET_KEY not set — skipping CAPTCHA verification. " +
      "Set it in production to enable CAPTCHA protection."
    );
    return true;
  }

  if (!token) {
    console.error("[Turnstile] No token provided");
    return false;
  }

  try {
    const body: Record<string, string> = {
      secret: secretKey,
      response: token,
    };

    if (remoteIp) {
      body.remoteip = remoteIp;
    }

    console.log("[Turnstile] Verifying token...", { hasIp: !!remoteIp });

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams(body),
    });

    const data = (await response.json()) as TurnstileVerifyResponse;
    
    console.log("[Turnstile] Verification response:", {
      success: data.success,
      errorCodes: data["error-codes"],
      hostname: data.hostname,
      challenge_ts: data.challenge_ts,
    });

    return data.success === true;
  } catch (error) {
    console.error("[Turnstile] Verification error:", error);
    return false;
  }
}
