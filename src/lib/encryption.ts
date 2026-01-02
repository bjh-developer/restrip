/**
 * Zero-Knowledge Encryption Utilities
 *
 * Uses Web Crypto API for:
 * - Key derivation from passkey PRF output or password
 * - AES-GCM encryption/decryption of images and text
 *
 * ⚠️ CRITICAL SECURITY NOTICE ⚠️
 *
 * This implementation stores encryption keys in sessionStorage for UX reasons
 * (persistence across page refreshes). This creates an XSS vulnerability:
 *
 * THREAT MODEL:
 * - Any malicious script with DOM access can steal keys from sessionStorage
 * - Compromised CDN, malicious browser extension, or XSS attack = full data exposure
 * - Once key is stolen, ALL encrypted user data can be decrypted
 *
 * MITIGATIONS IMPLEMENTED:
 * ✓ 30-minute session timeout (limits exposure window)
 * ✓ Content Security Policy headers (reduces XSS attack surface)
 * ✓ Subresource Integrity for external scripts (prevents tampering)
 * ✓ sessionStorage only (cleared on tab close, not persistent across sessions)
 *
 * USER SAFETY GUIDELINES:
 * ⚠️ NEVER use this application on shared/public computers
 * ⚠️ NEVER use this application on untrusted/compromised devices
 * ⚠️ Always use latest browser versions with security patches
 * ⚠️ Log out immediately after use on any non-personal device
 * ⚠️ Be aware: If device is compromised, ALL data is exposed
 *
 * This is a fundamental tradeoff: Zero-knowledge encryption with persistence
 * requires client-side key storage, which is vulnerable to XSS. Alternative
 * approaches (IndexedDB, Service Workers) have the same vulnerability.
 * Server-side key storage defeats zero-knowledge encryption entirely.
 */

// Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert Base64URL to Base64 (WebAuthn uses Base64URL)
export function base64UrlToBase64(base64url: string): string {
  return base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");
}

// PBKDF2 iteration count for password-based key derivation
// OWASP 2024 recommends minimum 600,000 iterations for PBKDF2-SHA256
// This significantly increases resistance to brute-force attacks
const PBKDF2_ITERATIONS = 600000;

/**
 * Derive encryption key from passkey PRF output
 * PRF output is a cryptographically secure random value tied to the passkey
 */
export async function deriveKeyFromPRF(
  prfOutput: ArrayBuffer,
): Promise<CryptoKey> {
  // Import the PRF output as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    "HKDF",
    false,
    ["deriveKey"],
  );

  // Derive AES-GCM key using HKDF
  const key = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("restrip-encryption-v1"),
      info: new TextEncoder().encode("image-encryption"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // Extractable (needed to persist across page refreshes)
    ["encrypt", "decrypt"],
  );

  return key;
}

/**
 * Derive encryption key from password (fallback for non-passkey users)
 * Uses PBKDF2 with OWASP 2024 recommended iteration count (600,000+)
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // Derive AES-GCM key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS, // OWASP 2024 minimum: 600,000+ iterations
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // Extractable (needed to persist across page refreshes)
    ["encrypt", "decrypt"],
  );

  return key;
}

/**
 * Generate a random salt for password-based key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generate a random IV for AES-GCM encryption
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)); // 96 bits for AES-GCM
}

/**
 * Encrypt data using AES-GCM
 * Returns: { encrypted: base64, iv: base64 }
 */
export async function encryptData(
  data: ArrayBuffer | string,
  key: CryptoKey,
): Promise<{ encrypted: string; iv: string }> {
  const iv = generateIV();

  // Convert string to ArrayBuffer if needed
  const dataBuffer =
    typeof data === "string" ? new TextEncoder().encode(data) : data;

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    dataBuffer,
  );

  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(
  encryptedBase64: string,
  ivBase64: string,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  const encrypted = base64ToArrayBuffer(encryptedBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) as BufferSource },
    key,
    encrypted as BufferSource,
  );

  return decrypted;
}

/**
 * Decrypt data as string
 */
export async function decryptDataAsString(
  encryptedBase64: string,
  ivBase64: string,
  key: CryptoKey,
): Promise<string> {
  const decrypted = await decryptData(encryptedBase64, ivBase64, key);
  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt an image (base64 data URL)
 * Handles the data URL prefix properly
 */
export async function encryptImage(
  base64Image: string,
  key: CryptoKey,
): Promise<{ encrypted: string; iv: string }> {
  // Remove data URL prefix if present
  const base64Data = base64Image.includes(",")
    ? base64Image.split(",")[1]
    : base64Image;

  // Convert base64 to ArrayBuffer
  const imageBuffer = base64ToArrayBuffer(base64Data);

  // Encrypt the raw image data
  return encryptData(imageBuffer, key);
}

/**
 * Decrypt an image back to base64 data URL
 */
export async function decryptImage(
  encryptedBase64: string,
  ivBase64: string,
  key: CryptoKey,
  mimeType: string = "image/png",
): Promise<string> {
  const decrypted = await decryptData(encryptedBase64, ivBase64, key);
  const base64 = arrayBufferToBase64(decrypted);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Store encryption key with persistent backup
 * Key is stored in sessionStorage to survive page refreshes
 * (sessionStorage is cleared when tab closes for security)
 *
 * ⚠️ SECURITY TRADEOFF WARNING ⚠️
 *
 * Storing encryption keys in sessionStorage creates an XSS vulnerability:
 * - Any malicious script with DOM access can steal the key from sessionStorage
 * - Once stolen, attackers can decrypt all user data
 * - This is a fundamental tradeoff between UX (persistence) and security
 *
 * Mitigations implemented:
 * 1. Session timeout (10 minutes) - limits exposure window
 * 2. Content Security Policy - reduces XSS attack surface
 * 3. Subresource Integrity - prevents script tampering
 *
 * ⚠️ USER GUIDANCE ⚠️
 * Users should be warned:
 * - Never use this application on shared or untrusted devices
 * - Always use up-to-date browsers with latest security patches
 * - Log out immediately after use on public computers
 * - If compromised, all encrypted data should be considered exposed
 *
 * Alternative approaches (not implemented):
 * - IndexedDB with encryption (still vulnerable to XSS)
 * - Service Workers (complex, still vulnerable)
 * - Server-side key management (defeats zero-knowledge encryption)
 * - No persistence (poor UX, user must re-auth on every page load)
 */
let encryptionKeyStore: CryptoKey | null = null;
const ENCRYPTION_KEY_STORAGE_KEY = "restrip_encryption_key";
const ENCRYPTION_KEY_TIMESTAMP_KEY = "restrip_encryption_key_timestamp";
const KEY_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export async function setEncryptionKey(key: CryptoKey): Promise<void> {
  encryptionKeyStore = key;

  // Export key to raw format and store in sessionStorage
  try {
    const exportedKey = await crypto.subtle.exportKey("raw", key);
    const keyBase64 = arrayBufferToBase64(exportedKey);
    const timestamp = Date.now().toString();

    sessionStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, keyBase64);
    sessionStorage.setItem(ENCRYPTION_KEY_TIMESTAMP_KEY, timestamp);
  } catch (error) {
    console.error("Failed to persist encryption key:", error);
    // Key still works in memory, just won't persist across refresh
  }
}

export async function getEncryptionKey(): Promise<CryptoKey | null> {
  // If key is in memory, return it
  if (encryptionKeyStore) {
    return encryptionKeyStore;
  }

  // Try to restore from sessionStorage
  try {
    const keyBase64 = sessionStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY);
    const timestampStr = sessionStorage.getItem(ENCRYPTION_KEY_TIMESTAMP_KEY);

    if (!keyBase64 || !timestampStr) {
      return null;
    }

    // Check if key has expired
    const timestamp = parseInt(timestampStr, 10);
    const age = Date.now() - timestamp;

    if (age > KEY_EXPIRY_MS) {
      console.warn(
        "⚠️ Encryption key expired (10 min timeout). Please re-authenticate.",
      );
      clearEncryptionKey();
      return null;
    }

    const keyBuffer = base64ToArrayBuffer(keyBase64);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM", length: 256 },
      true, // Make it extractable so it can be persisted again if needed
      ["encrypt", "decrypt"],
    );

    encryptionKeyStore = key;
    console.log("✅ Encryption key restored from sessionStorage");
    return key;
  } catch (error) {
    console.error("Failed to restore encryption key:", error);
    // Clear invalid stored key
    clearEncryptionKey();
    return null;
  }
}

export function clearEncryptionKey(): void {
  encryptionKeyStore = null;
  sessionStorage.removeItem(ENCRYPTION_KEY_STORAGE_KEY);
  sessionStorage.removeItem(ENCRYPTION_KEY_TIMESTAMP_KEY);
}

/**
 * Check if encryption key is available (in-memory or sessionStorage)
 */
export function hasEncryptionKey(): boolean {
  // Check in-memory store first
  if (encryptionKeyStore !== null) {
    return true;
  }

  // Check sessionStorage synchronously
  const keyBase64 = sessionStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY);
  return keyBase64 !== null;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password) {
    return { valid: false, error: "Password is required" };
  }
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (password.length > 128) {
    return { valid: false, error: "Password must be less than 128 characters" };
  }
  return { valid: true };
}
