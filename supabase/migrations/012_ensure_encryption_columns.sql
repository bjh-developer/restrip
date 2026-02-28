-- =============================================================================
-- Migration: Ensure Encryption Columns Exist
-- =============================================================================
-- This migration ensures the snaps table has the proper encryption columns
-- and removes any plain text caption column if it exists.
--
-- Context: After Clerk migration, ensuring server-side encryption columns
-- are properly configured for encrypted storage and captions.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Step 1: Add encryption columns if they don't exist
ALTER TABLE public.snaps ADD COLUMN IF NOT EXISTS encrypted_caption TEXT;
ALTER TABLE public.snaps ADD COLUMN IF NOT EXISTS caption_iv TEXT;
ALTER TABLE public.snaps ADD COLUMN IF NOT EXISTS image_iv TEXT;

-- Step 2: Drop plain text caption column if it exists
ALTER TABLE public.snaps DROP COLUMN IF EXISTS caption;

-- Step 3: Add helpful comments
COMMENT ON COLUMN public.snaps.encrypted_caption IS 'AES-256-GCM encrypted caption (server-side encryption)';
COMMENT ON COLUMN public.snaps.caption_iv IS 'Initialization vector for caption decryption';
COMMENT ON COLUMN public.snaps.image_iv IS 'Initialization vector for image decryption';

-- Verify columns exist
-- Uncomment to check:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'snaps' 
-- AND column_name IN ('encrypted_caption', 'caption_iv', 'image_iv', 'caption')
-- ORDER BY column_name;
