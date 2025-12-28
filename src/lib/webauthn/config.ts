/**
 * WebAuthn Configuration
 * Relying Party (RP) settings for passkey authentication
 */

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';

// Get the domain from environment variables
// VERCEL_URL is available in all Vercel deployments (preview and production)
const getVercelDomain = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use window.location
    return window.location.hostname;
  }
  // Server-side: use environment variable
  return process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'restrip.vercel.app';
};

const productionDomain = isDevelopment ? 'localhost' : getVercelDomain();

// Relying Party configuration
export const rpConfig = {
  // Relying Party Name (shown to users during registration)
  rpName: 'ReStrip',
  
  // Relying Party ID (must match the domain or be a subdomain)
  // For localhost development, use 'localhost'
  rpID: productionDomain,
  
  // Expected origin(s) - where the requests come from
  // Include both www and non-www versions if applicable
  expectedOrigin: isDevelopment 
    ? ['http://localhost:3000', 'http://localhost:3001']
    : [`https://${productionDomain}`],
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
