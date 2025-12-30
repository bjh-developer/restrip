/**
 * WebAuthn Configuration
 * Relying Party (RP) settings for passkey authentication
 */

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';

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
    const additionalOrigins = process.env.NEXT_PUBLIC_ALLOWED_ORIGINS
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    origins.push(...additionalOrigins);
  }
  
  // Development fallback
  if (isDevelopment) {
    origins.push('http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000');
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
    if (allowedOrigin.startsWith('*.')) {
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
export const getDomainFromRequest = (request: Request): string => {
  const host = request.headers.get('host') || 'localhost';
  // Remove port if present (localhost:3000 -> localhost)
  return host.split(':')[0];
};

// Helper to get origin from request headers (for API routes)
export const getOriginFromRequest = (request: Request): string => {
  const origin = request.headers.get('origin');
  
  // If no origin header, require default origin from config
  if (!origin) {
    const defaultOrigin = process.env.NEXT_PUBLIC_APP_URL;
    if (!defaultOrigin) {
      const error = '❌ SECURITY: Missing origin header and no NEXT_PUBLIC_APP_URL configured. WebAuthn requires explicit origin validation.';
      console.error(error);
      throw new Error(error);
    }
    
    console.warn('⚠️ Missing origin header, using default:', defaultOrigin);
    return defaultOrigin;
  }
  
  // Validate origin against whitelist
  if (!isOriginAllowed(origin)) {
    const error = `❌ SECURITY: Origin "${origin}" is not in allowed origins list. Configured origins: ${ALLOWED_ORIGINS.join(', ')}`;
    console.error(error);
    throw new Error(error);
  }
  
  console.log('✅ Origin validated:', origin);
  return origin;
};

// Helper to detect if request is from mobile device
export const isMobileDevice = (request: Request): boolean => {
  const userAgent = request.headers.get('user-agent') || '';
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
};

// Relying Party configuration (static parts)
export const rpConfig = {
  // Relying Party Name (shown to users during registration)
  rpName: 'ReStrip',
};

// Get authenticator selection based on device type
// Desktop: Force cross-platform (QR code → phone biometrics)
// Mobile: Allow platform authenticator (local biometrics)
export const getAuthenticatorSelection = (isMobile: boolean) => ({
  // On desktop: 'cross-platform' forces QR code flow to use phone
  // On mobile: 'platform' uses local biometrics (Touch ID, Face ID, etc.)
  authenticatorAttachment: (isMobile ? 'platform' : 'cross-platform') as AuthenticatorAttachment,
  
  // Require user verification (biometric/PIN)
  userVerification: 'required' as UserVerificationRequirement,
  
  // Require resident key (discoverable credential)
  residentKey: 'required' as ResidentKeyRequirement,
  
  // Require resident credential
  requireResidentKey: true,
});

// Supported algorithms (in order of preference)
// -7 = ES256 (ECDSA with P-256 and SHA-256) - Most common
// -257 = RS256 (RSASSA-PKCS1-v1_5 with SHA-256) - Fallback
export const supportedAlgorithmIDs = [-7, -257];

// Timeout for WebAuthn operations (in milliseconds)
export const timeout = 60000; // 60 seconds

// Challenge expiration (in milliseconds)
export const challengeExpiration = 5 * 60 * 1000; // 5 minutes

// PRF (Pseudo-Random Function) extension for key derivation
// This is what makes zero-knowledge encryption possible
export const prfSalt = new TextEncoder().encode('restrip-encryption-key-v1');

// Type for credential transport
export type CredentialTransport = 'internal' | 'hybrid' | 'usb' | 'ble' | 'nfc';
