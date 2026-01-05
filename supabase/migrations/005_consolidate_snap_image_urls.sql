-- =====================================================
-- Consolidate Snap Image URLs Migration
-- Combines encrypted_image_url and encrypted_cropped_url into single storage_path field
-- =====================================================

BEGIN;

-- Add new storage_path column
ALTER TABLE public.snaps 
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Migrate existing data: prioritize cropped URL if exists, otherwise use original
-- This ensures no data is lost during migration
UPDATE public.snaps 
SET storage_path = COALESCE(encrypted_cropped_url, encrypted_image_url)
WHERE storage_path IS NULL;

-- Drop the old columns
ALTER TABLE public.snaps 
DROP COLUMN IF EXISTS encrypted_cropped_url;

ALTER TABLE public.snaps 
DROP COLUMN IF EXISTS encrypted_image_url;

-- Make storage_path NOT NULL now that data is migrated
ALTER TABLE public.snaps 
ALTER COLUMN storage_path SET NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN public.snaps.storage_path IS 'Storage path for encrypted image (original or cropped based on user selection)';

COMMIT;
