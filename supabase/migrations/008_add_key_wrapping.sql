-- Migration: Add key wrapping support for cross-compatible authentication
-- This enables password and passkey users to share the same master encryption key

-- Add wrapped_encryption_key to passkey_credentials table (for passkey users)
-- Each passkey credential gets its own wrapped version of the master key
ALTER TABLE public.passkey_credentials
ADD COLUMN IF NOT EXISTS wrapped_encryption_key TEXT;

COMMENT ON COLUMN public.passkey_credentials.wrapped_encryption_key IS 
'Master encryption key wrapped with passkey PRF-derived KEK. Enables cross-auth compatibility.';

-- For password users, we store the wrapped key in user metadata
-- This is accessible via auth.users().user_metadata
-- No schema change needed, just update via Supabase client:
-- await supabase.auth.updateUser({ data: { wrapped_encryption_key: '...' } })

COMMENT ON TABLE public.passkey_credentials IS 
'WebAuthn credentials for passkey authentication. Each credential stores a wrapped master encryption key for zero-knowledge encryption.';
