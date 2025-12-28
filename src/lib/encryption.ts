/**
 * Zero-Knowledge Encryption Utilities
 * 
 * Uses Web Crypto API for:
 * - Key derivation from passkey PRF output or password
 * - AES-GCM encryption/decryption of images and text
 */

// Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
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
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=');
}

// Convert Base64 to Base64URL
export function base64ToBase64Url(base64: string): string {
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Derive encryption key from passkey PRF output
 * PRF output is a cryptographically secure random value tied to the passkey
 */
export async function deriveKeyFromPRF(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  // Import the PRF output as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    prfOutput,
    'HKDF',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using HKDF
  const key = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('restrip-encryption-v1'),
      info: new TextEncoder().encode('image-encryption'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // Not extractable
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Derive encryption key from password (fallback for non-passkey users)
 * Uses PBKDF2 with high iteration count for security
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000, // High iteration count for security
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // Not extractable
    ['encrypt', 'decrypt']
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
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const iv = generateIV();
  
  // Convert string to ArrayBuffer if needed
  const dataBuffer = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    dataBuffer
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
  key: CryptoKey
): Promise<ArrayBuffer> {
  const encrypted = base64ToArrayBuffer(encryptedBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) as BufferSource },
    key,
    encrypted as BufferSource
  );

  return decrypted;
}

/**
 * Decrypt data as string
 */
export async function decryptDataAsString(
  encryptedBase64: string,
  ivBase64: string,
  key: CryptoKey
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
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  // Remove data URL prefix if present
  const base64Data = base64Image.includes(',') 
    ? base64Image.split(',')[1] 
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
  mimeType: string = 'image/png'
): Promise<string> {
  const decrypted = await decryptData(encryptedBase64, ivBase64, key);
  const base64 = arrayBufferToBase64(decrypted);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Store encryption key in memory (never persisted)
 * Uses a closure to keep the key private
 */
let encryptionKeyStore: CryptoKey | null = null;

export function setEncryptionKey(key: CryptoKey): void {
  encryptionKeyStore = key;
}

export function getEncryptionKey(): CryptoKey | null {
  return encryptionKeyStore;
}

export function clearEncryptionKey(): void {
  encryptionKeyStore = null;
}

/**
 * Check if encryption key is available
 */
export function hasEncryptionKey(): boolean {
  return encryptionKeyStore !== null;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must be less than 128 characters' };
  }
  return { valid: true };
}
