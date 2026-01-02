/**
 * WebAuthn Configuration
 * Relying Party (RP) settings for passkey authentication
 */

// Environment detection
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Allowed RP domains for WebAuthn operations
 * ⚠️ SECURITY: RP ID determines which domains can use the passkey
 * Only add trusted domains that will actually use this RP ID
 *
 * Environment variables:
 * - NEXT_PUBLIC_APP_URL: Primary production domain (extracted from URL)
 * - NEXT_PUBLIC_ALLOWED_RP_DOMAINS: Comma-separated list of additional allowed domains
 *
 * Examples:
 * - example.com (will match example.com and *.example.com)
 * - sub.example.com (matches only this subdomain)
 */
const getAllowedRPDomains = (): string[] => {
  const domains: string[] = [];

  // Extract domain from production URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const url = new URL(process.env.NEXT_PUBLIC_APP_URL);
      domains.push(url.hostname.toLowerCase());
    } catch (error) {
      console.error("Invalid NEXT_PUBLIC_APP_URL:", error);
    }
  }

  // Additional allowed domains from env
  if (process.env.NEXT_PUBLIC_ALLOWED_RP_DOMAINS) {
    const additionalDomains = process.env.NEXT_PUBLIC_ALLOWED_RP_DOMAINS.split(
      ",",
    )
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    domains.push(...additionalDomains);
  }

  // Development fallback
  if (isDevelopment) {
    domains.push("localhost", "127.0.0.1");
  }

  return domains;
};

const ALLOWED_RP_DOMAINS = getAllowedRPDomains();

/**
 * Validate domain against allowlist
 * Supports exact match and parent domain match (e.g., sub.example.com matches example.com)
 */
const isRPDomainAllowed = (domain: string): boolean => {
  const normalizedDomain = domain.toLowerCase();

  // Exact match
  if (ALLOWED_RP_DOMAINS.includes(normalizedDomain)) {
    return true;
  }

  // Parent domain match (e.g., sub.example.com matches example.com)
  for (const allowedDomain of ALLOWED_RP_DOMAINS) {
    if (
      normalizedDomain === allowedDomain ||
      normalizedDomain.endsWith(`.${allowedDomain}`)
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Allowed origins for WebAuthn operations
 * ⚠️ SECURITY: Only add trusted origins to this list
 *
 * Environment variables:
 * - NEXT_PUBLIC_APP_URL: Primary production URL
 * - NEXT_PUBLIC_ALLOWED_ORIGINS: Comma-separated list of additional allowed origins
 *
 * For Vercel deployments:
 * - Set NEXT_PUBLIC_ALLOWED_ORIGINS in Vercel dashboard
 * - Use wildcard pattern like "*.vercel.app" for preview deployments
 */
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  // Production URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  // Additional allowed origins from env
  if (process.env.NEXT_PUBLIC_ALLOWED_ORIGINS) {
    const additionalOrigins = process.env.NEXT_PUBLIC_ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    origins.push(...additionalOrigins);
  }

  // Development fallback
  if (isDevelopment) {
    origins.push(
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
    );
  }

  return origins;
};

const ALLOWED_ORIGINS = getAllowedOrigins();

/**
 * Validate origin against whitelist
 * Supports exact match and wildcard patterns (*.example.com)
 */
const isOriginAllowed = (origin: string): boolean => {
  // Exact match
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Wildcard pattern match (e.g., *.vercel.app)
  for (const allowedOrigin of ALLOWED_ORIGINS) {
    if (allowedOrigin.startsWith("*.")) {
      const domain = allowedOrigin.slice(2); // Remove '*.'
      const originUrl = new URL(origin);
      if (originUrl.hostname.endsWith(domain)) {
        return true;
      }
    }
  }

  return false;
};

// Helper to get domain from request headers (for API routes)
// RP ID must match the current domain - passkeys are domain-bound
// ⚠️ SECURITY: Validates host header against allowlist to prevent spoofing
export const getDomainFromRequest = (request: Request): string => {
  const hostHeader = request.headers.get("host");

  // If no host header, use safe default
  if (!hostHeader) {
    if (isDevelopment) {
      return "localhost";
    }

    const defaultDomain = ALLOWED_RP_DOMAINS[0];
    if (!defaultDomain) {
      const error =
        "❌ SECURITY: Missing host header and no allowed RP domains configured.";
      console.error(error);
      throw new Error(error);
    }

    console.warn(
      "⚠️ Missing host header, using default domain:",
      defaultDomain,
    );
    return defaultDomain;
  }

  // Parse and normalize host (strip port, lowercase)
  const domain = hostHeader.split(":")[0].toLowerCase();

  // Validate against allowlist
  if (!isRPDomainAllowed(domain)) {
    const error = `❌ SECURITY: Host header "${domain}" is not in allowed RP domains. Configured domains: ${ALLOWED_RP_DOMAINS.join(", ")}`;
    console.error(error);
    throw new Error(error);
  }

  console.log("✅ RP domain validated:", domain);
  return domain;
};

// Helper to get origin from request headers (for API routes)
export const getOriginFromRequest = (request: Request): string => {
  const origin = request.headers.get("origin");

  // If no origin header, require default origin from config
  if (!origin) {
    const defaultOrigin = process.env.NEXT_PUBLIC_APP_URL;
    if (!defaultOrigin) {
      const error =
        "❌ SECURITY: Missing origin header and no NEXT_PUBLIC_APP_URL configured. WebAuthn requires explicit origin validation.";
      console.error(error);
      throw new Error(error);
    }

    console.warn("⚠️ Missing origin header, using default:", defaultOrigin);
    return defaultOrigin;
  }

  // Validate origin against whitelist
  if (!isOriginAllowed(origin)) {
    const error = `❌ SECURITY: Origin "${origin}" is not in allowed origins list. Configured origins: ${ALLOWED_ORIGINS.join(", ")}`;
    console.error(error);
    throw new Error(error);
  }

  console.log("✅ Origin validated:", origin);
  return origin;
};

// Helper to detect if request is from mobile device
export const isMobileDevice = (request: Request): boolean => {
  const userAgent = request.headers.get("user-agent") || "";
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent,
  );
};

// Relying Party configuration (static parts)
export const rpConfig = {
  // Relying Party Name (shown to users during registration)
  rpName: "ReStrip",
};

// Get authenticator selection based on device type
// Desktop: Force cross-platform (QR code → phone biometrics)
// Mobile: Allow platform authenticator (local biometrics)
export const getAuthenticatorSelection = (isMobile: boolean) => ({
  // On desktop: 'cross-platform' forces QR code flow to use phone
  // On mobile: 'platform' uses local biometrics (Touch ID, Face ID, etc.)
  authenticatorAttachment: (isMobile
    ? "platform"
    : "cross-platform") as AuthenticatorAttachment,

  // Require user verification (biometric/PIN)
  userVerification: "required" as UserVerificationRequirement,

  // Require resident key (discoverable credential)
  residentKey: "required" as ResidentKeyRequirement,

  // Require resident credential
  requireResidentKey: true,
});

// Supported algorithms (in order of preference, per RFC 9864)
// -19 = Ed25519 (EdDSA) - Preferred, most secure modern algorithm
// -9 = ECDSA 256/64 (P-256 variant) - Secondary choice
// -7 = ES256 (ECDSA with P-256 and SHA-256) - Legacy support
// -8 = EdDSA - Additional EdDSA support
// ⚠️ RS256 (-257) is deprecated and removed; should not be used in new deployments
export const supportedAlgorithmIDs = [-19, -9, -7, -8];

// Timeout for WebAuthn operations (in milliseconds)
export const timeout = 60000; // 60 seconds

// Challenge expiration (in milliseconds)
export const challengeExpiration = 10 * 60 * 1000; // 10 minutes

/**
 * PRF (Pseudo-Random Function) salt generation
 *
 * ⚠️ SECURITY CRITICAL: Per-credential salts required by WebAuthn spec
 *
 * Each credential MUST have a unique cryptographically random salt:
 * - Random: Generated via crypto.getRandomValues() (not static strings)
 * - Per-credential: Different for each registered passkey
 * - Persistent: Stored with credential metadata in database
 * - Non-reusable: Salt cannot be shared across users or credentials
 *
 * The salt is sent during registration/login WebAuthn ceremonies and the
 * authenticator uses it to derive the PRF output. This ensures each credential
 * produces different encryption keys, providing per-credential isolation.
 */

/**
 * Generate a cryptographically random 32-byte salt for a new credential
 * Returns base64-encoded string for database storage
 *
 * Should be called once per credential during registration
 * Never reuse the same salt across multiple credentials or users
 */
export const generateRandomSalt = (): string => {
  const saltBytes = new Uint8Array(32);

  // Use crypto.getRandomValues() for cryptographically secure randomness
  if (typeof window !== "undefined" && window.crypto) {
    // Browser environment
    window.crypto.getRandomValues(saltBytes);
  } else if (typeof global !== "undefined" && global.crypto) {
    // Node.js environment (with webcrypto API)
    global.crypto.getRandomValues(saltBytes);
  } else {
    // Fallback (should not happen in modern Node.js/browsers)
    const { randomBytes } = require("crypto");
    const buffer = randomBytes(32);
    saltBytes.set(new Uint8Array(buffer));
  }

  // Encode to base64 for database storage
  return Buffer.from(saltBytes).toString("base64");
};

/**
 * Decode a base64-encoded salt back to bytes for use in PRF extension
 * @param saltBase64 Base64-encoded salt from database
 * @returns Uint8Array for use in WebAuthn PRF extension
 */
export const decodeSalt = (saltBase64: string): Uint8Array => {
  return new Uint8Array(Buffer.from(saltBase64, "base64"));
};

// Type for credential transport
export type CredentialTransport = "internal" | "hybrid" | "usb" | "ble" | "nfc";
