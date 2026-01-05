-- =====================================================
-- ReStrip Passkey Authentication Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Create passkey_credentials table to store public keys
CREATE TABLE IF NOT EXISTS public.passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,           -- Base64URL encoded credential ID
  public_key TEXT NOT NULL,                      -- Base64URL encoded public key
  counter BIGINT DEFAULT 0,                      -- For replay attack prevention
  device_type TEXT DEFAULT 'platform',           -- 'platform' or 'cross-platform'
  backed_up BOOLEAN DEFAULT false,               -- Is credential synced (iCloud Keychain, etc)
  transports TEXT[],                             -- ['internal', 'hybrid', 'usb', etc]
  aaguid TEXT,                                   -- Authenticator identifier
  device_name TEXT,                              -- User-friendly device name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_passkey_user_id ON public.passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credential_id ON public.passkey_credentials(credential_id);

-- 2. Create snaps table with user_id for authenticated uploads
CREATE TABLE IF NOT EXISTS public.snaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_method TEXT NOT NULL DEFAULT 'email',  -- 'email' or 'telegram'
  delivery_address TEXT NOT NULL,                 -- Email or @telegram_username
  encrypted_image_url TEXT NOT NULL,              -- URL to encrypted image in storage
  encrypted_cropped_url TEXT,                     -- URL to encrypted cropped image
  encrypted_caption TEXT,                         -- AES encrypted caption
  caption_iv TEXT,                                -- IV for caption decryption
  period_type TEXT NOT NULL,                      -- 'surprise', 'custom_period', 'custom_date'
  send_date DATE NOT NULL,
  send_time TIMESTAMPTZ NOT NULL,
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for snaps
CREATE INDEX IF NOT EXISTS idx_snaps_user_id ON public.snaps(user_id);
CREATE INDEX IF NOT EXISTS idx_snaps_send_date ON public.snaps(send_date, delivered);
CREATE INDEX IF NOT EXISTS idx_snaps_delivery ON public.snaps(delivery_address);

-- 3. Create challenge store for WebAuthn (temporary storage)
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,                                     -- For registration before user exists
  challenge TEXT NOT NULL,                        -- Base64URL encoded challenge
  type TEXT NOT NULL,                             -- 'registration' or 'authentication'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_email ON public.webauthn_challenges(email);
CREATE INDEX IF NOT EXISTS idx_challenge_user_id ON public.webauthn_challenges(user_id);


-- 4. Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Passkey credentials: Users can only see/manage their own credentials
CREATE POLICY "Users can view own passkey credentials"
  ON public.passkey_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own passkey credentials"
  ON public.passkey_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own passkey credentials"
  ON public.passkey_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own passkey credentials"
  ON public.passkey_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Snaps: Users can only see/manage their own snaps
CREATE POLICY "Users can view own snaps"
  ON public.snaps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snaps"
  ON public.snaps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snaps"
  ON public.snaps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own snaps"
  ON public.snaps FOR DELETE
  USING (auth.uid() = user_id);

-- WebAuthn challenges: Service role only (API routes use service role)
-- No policies needed - handled by service role key

-- Email verifications: Service role only
-- No policies needed - handled by service role key

-- 5. Create storage bucket for encrypted images
INSERT INTO storage.buckets (id, name, public)
VALUES ('encrypted-images', 'encrypted-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Users can only access their own files
CREATE POLICY "Users can upload own encrypted images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'encrypted-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own encrypted images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'encrypted-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own encrypted images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'encrypted-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 6. Function to clean up expired challenges (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS void AS $$
BEGIN
  DELETE FROM public.webauthn_challenges WHERE expires_at < NOW();
  DELETE FROM public.email_verifications WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to update snaps timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER snaps_updated_at
  BEFORE UPDATE ON public.snaps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
