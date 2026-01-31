-- =====================================================
-- Add image_iv column to snaps table
-- Required for decrypting the encrypted image later
-- =====================================================

BEGIN;

-- Add image_iv column for storing the initialization vector
ALTER TABLE public.snaps 
ADD COLUMN IF NOT EXISTS image_iv TEXT NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN public.snaps.image_iv IS 'Initialization vector (IV) for decrypting the encrypted image stored at storage_path';

-- Note: send_date and send_time columns already exist from migration 001
-- The API route will split scheduledSendTime ISO string into these two fields

COMMIT;
