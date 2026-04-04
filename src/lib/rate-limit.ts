/**
 * In-Memory Rate Limiter (Token Bucket)
 *
 * Simple rate limiting for API routes using an in-memory store.
 * Each serverless instance maintains its own bucket, so this provides
 * per-instance protection rather than global rate limiting.
 *
 * PRODUCTION UPGRADE: For distributed rate limiting across Vercel
 * serverless instances, replace this with @upstash/ratelimit + @upstash/redis.
 *
 * @module lib/rate-limit
 */

import { NextRequest, NextResponse } from "next/server";

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/** In-memory store keyed by identifier (IP or userId) */
const buckets = new Map<string, TokenBucket>();

/** Clean up stale entries every 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  // Remove entries older than 10 minutes
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > 10 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}

/**
 * Extract a client identifier from the request.
 * Prefers Vercel's forwarded IP, falls back to other headers.
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

interface RateLimitConfig {
  /** Maximum tokens (requests) allowed in the window */
  maxTokens: number;
  /** Refill rate: tokens added per second */
  refillRate: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Check rate limit for a given identifier.
 *
 * @param identifier - Unique key (IP address or userId)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  cleanup();

  const now = Date.now();
  let bucket = buckets.get(identifier);

  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(identifier, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    config.maxTokens,
    bucket.tokens + elapsedSeconds * config.refillRate,
  );
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  }

  // Calculate when next token will be available
  const retryAfterSeconds = Math.ceil((1 - bucket.tokens) / config.refillRate);
  return { allowed: false, remaining: 0, retryAfterSeconds };
}

/**
 * Return a 429 Too Many Requests response.
 */
export function rateLimitResponse(
  retryAfterSeconds: number = 60,
): NextResponse<{ error: string }> {
  return NextResponse.json<{ error: string }>(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

// =============================================================================
// Pre-configured rate limit presets
// =============================================================================

/** Upload routes: 5 requests per minute */
export const UPLOAD_LIMIT: RateLimitConfig = {
  maxTokens: 5,
  refillRate: 5 / 60, // 5 per minute
};

/** Crop image: 10 requests per minute */
export const CROP_LIMIT: RateLimitConfig = {
  maxTokens: 10,
  refillRate: 10 / 60,
};

/** Gallery / read routes: 60 requests per minute */
export const READ_LIMIT: RateLimitConfig = {
  maxTokens: 60,
  refillRate: 60 / 60, // 1 per second
};

/** Delete routes: 20 requests per minute */
export const DELETE_LIMIT: RateLimitConfig = {
  maxTokens: 20,
  refillRate: 20 / 60,
};
