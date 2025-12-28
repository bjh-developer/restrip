/**
 * WebAuthn Configuration
 * Relying Party (RP) settings for passkey authentication
 */

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';

// Helper to get domain from request headers (for API routes)
export const getDomainFromRequest = (request: Request): string => {
  const host = request.headers.get('host') || 'localhost';
  // Remove port if present
  return host.split(':')[0];
};

// Helper to get origin from request headers (for API routes)
export const getOriginFromRequest = (request: Request): string => {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  
  // Fallback: construct from host header
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = isDevelopment ? 'http' : 'https';
  return `${protocol}://${host}`;
};

// Relying Party configuration (static parts)
export const rpConfig = {
  // Relying Party Name (shown to users during registration)
  rpName: 'ReStrip',
};

// Authenticator selection criteria
export const authenticatorSelection = {
  // 'platform' = built-in (Touch ID, Face ID, Windows Hello)
  // 'cross-platform' = external (YubiKey, etc.)
  // undefined = allow both
  authenticatorAttachment: undefined as AuthenticatorAttachment | undefined,
  
  // Require user verification (biometric/PIN)
  userVerification: 'required' as UserVerificationRequirement,
  
  // Require resident key (discoverable credential)
  // 'required' enables passkey autofill
  residentKey: 'required' as ResidentKeyRequirement,
  
  // Require resident credential (same as residentKey for backwards compat)
  requireResidentKey: true,
};

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
