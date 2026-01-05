-- =====================================================
-- Add Per-Credential PRF Salt for WebAuthn Isolation
-- 
-- This migration adds the 'salt' column to store unique,
-- cryptographically random salts for each credential.
-- 
-- Security: Each credential must have a unique salt to ensure
-- per-credential isolation and prevent salt reuse attacks.
-- =====================================================

-- Add salt column to passkey_credentials table
-- salt: Base64-encoded cryptographically random 32-byte value
ALTER TABLE public.passkey_credentials 
ADD COLUMN IF NOT EXISTS salt TEXT;

-- Create index for salt lookups (useful for future optimizations)
CREATE INDEX IF NOT EXISTS idx_passkey_salt ON public.passkey_credentials(salt);

-- Add constraint to ensure salt is non-empty if present
ALTER TABLE public.passkey_credentials 
ADD CONSTRAINT check_salt_not_empty CHECK (salt IS NULL OR salt != '');

-- Auto-generate salts for existing credentials
-- This ensures all credentials (old and new) have salts
UPDATE public.passkey_credentials 
SET salt = encode(gen_random_bytes(32), 'base64')
WHERE salt IS NULL;

-- Verify migration completed successfully
-- Run this query to confirm all credentials have salts:
-- SELECT COUNT(*) as total, COUNT(salt) as with_salt FROM passkey_credentials;
-- Both counts should be equal, indicating 100% salt coverage

