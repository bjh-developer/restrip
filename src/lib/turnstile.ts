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

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as TurnstileVerifyResponse;
    return data.success === true;
  } catch (error) {
    console.error("[Turnstile] Verification error:", error);
    return false;
  }
}
