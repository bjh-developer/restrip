/**
 * Simple Server-Side Encryption Utilities
 *
 * This module provides straightforward AES-256-GCM encryption for anonymous uploads.
 * Uses a single server-side encryption key from environment variables.
 *
 * SECURITY MODEL:
 * - Single server encryption key: Stored in ENCRYPTION_SECRET env var
 * - Server-managed: Not zero-knowledge, server can decrypt
 * - AES-256-GCM: Industry-standard authenticated encryption
 *
 * This is suitable for:
 * - Anonymous uploads where users don't need accounts
 * - Simplified UX without key management
 * - Cases where server-side key storage is acceptable
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

/**
 * Generate a random encryption key (256-bit)
 * Returns base64-encoded key for easy storage
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32)); // 256 bits
  return arrayBufferToBase64(key.buffer);
}

/**
 * Get the server encryption key from environment variable
 * Falls back to generating a new one if not set (for development)
 */
export function getServerEncryptionKey(): string {
  if (typeof window === "undefined") {
    // Server-side: use environment variable
    const envKey = process.env.ENCRYPTION_SECRET;
    if (!envKey) {
      throw new Error(
        "FATAL: ENCRYPTION_SECRET environment variable is not set. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
      );
    }
    return envKey;
  } else {
    // Client-side: fetch from API or use a placeholder
    // The actual encryption happens server-side
    throw new Error("getServerEncryptionKey should only be called server-side");
  }
}

/**
 * Generate a random IV for AES-GCM (96-bit)
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)); // 96 bits for AES-GCM
}

/**
 * Import a base64 key string into a CryptoKey for encryption/decryption
 */
export async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyBase64);
  return await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt data using AES-GCM
 * Returns: { encrypted: base64, iv: base64 }
 */
export async function encryptData(
  data: ArrayBuffer | string,
  keyBase64: string,
): Promise<{ encrypted: string; iv: string }> {
  const key = await importKey(keyBase64);
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
  keyBase64: string,
): Promise<ArrayBuffer> {
  const key = await importKey(keyBase64);
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
  keyBase64: string,
): Promise<string> {
  const decrypted = await decryptData(encryptedBase64, ivBase64, keyBase64);
  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt an image (base64 data URL)
 * Handles the data URL prefix properly
 */
export async function encryptImage(
  base64Image: string,
  keyBase64: string,
): Promise<{ encrypted: string; iv: string }> {
  // Remove data URL prefix if present
  const base64Data = base64Image.includes(",")
    ? base64Image.split(",")[1]
    : base64Image;

  // Convert base64 to ArrayBuffer
  const imageBuffer = base64ToArrayBuffer(base64Data);

  // Encrypt the raw image data
  return encryptData(imageBuffer, keyBase64);
}

/**
 * Decrypt an image back to base64 data URL
 */
export async function decryptImage(
  encryptedBase64: string,
  ivBase64: string,
  keyBase64: string,
  mimeType: string = "image/png",
): Promise<string> {
  const decrypted = await decryptData(encryptedBase64, ivBase64, keyBase64);
  const base64 = arrayBufferToBase64(decrypted);
  return `data:${mimeType};base64,${base64}`;
}
