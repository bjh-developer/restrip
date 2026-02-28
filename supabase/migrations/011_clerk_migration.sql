-- =============================================================================
-- Migration: Clerk Authentication Adapter
-- =============================================================================
-- Migrates from Supabase Auth (UUID user_id) to Clerk (TEXT user_id)
-- 
-- This migration:
-- 1. Clears existing test data
-- 2. Drops old WebAuthn/passkey tables
-- 3. Drops ALL existing RLS policies (they block column type changes)
-- 4. Changes user_id column from UUID to TEXT
-- 5. Creates simple new policies (service role only, since API bypasses RLS)
--
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Step 1: Clear existing data
DELETE FROM public.snaps WHERE user_id IS NOT NULL;
-- Optionally clear anonymous snaps: DELETE FROM public.snaps WHERE user_id IS NULL;

-- Step 2: Drop old authentication tables
DROP TABLE IF EXISTS public.webauthn_challenges CASCADE;
DROP TABLE IF EXISTS public.passkey_credentials CASCADE;

-- Step 3: Drop ALL policies on snaps table (required before altering user_id)
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'snaps'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.snaps', pol.policyname);
    END LOOP;
END $$;

-- Step 4: Drop ALL policies on storage.objects (may reference user folders)
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Step 5: Drop foreign key constraint and indexes
ALTER TABLE public.snaps DROP CONSTRAINT IF EXISTS snaps_user_id_fkey;
DROP INDEX IF EXISTS idx_snaps_user_id;
DROP INDEX IF EXISTS idx_snaps_user_id_created_at;
DROP INDEX IF EXISTS idx_snaps_user_id_send_date;

-- Step 6: Change user_id column type from UUID to TEXT
ALTER TABLE public.snaps 
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Step 6a: Remove encryption columns (no longer using client-side encryption with Clerk)
ALTER TABLE public.snaps DROP COLUMN IF EXISTS encrypted_caption;
ALTER TABLE public.snaps DROP COLUMN IF EXISTS caption_iv;
ALTER TABLE public.snaps DROP COLUMN IF EXISTS image_iv;

-- Step 6b: Add plain text caption column
ALTER TABLE public.snaps ADD COLUMN IF NOT EXISTS caption TEXT;

-- Step 7: Recreate indexes
CREATE INDEX idx_snaps_user_id 
  ON public.snaps(user_id) 
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_snaps_user_id_created_at 
  ON public.snaps(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_snaps_user_id_send_date 
  ON public.snaps(user_id, send_date DESC) 
  WHERE user_id IS NOT NULL;

-- Step 8: Create simple RLS policies (service role only)
-- NOTE: Your API uses supabaseAdmin (service role key) which bypasses RLS.
-- These policies prevent any accidental direct database connections.

CREATE POLICY "service_role_all_access"
  ON public.snaps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "block_direct_access"
  ON public.snaps
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Step 9: Create storage policies (service role only)
CREATE POLICY "service_role_storage_access"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'encrypted-images')
  WITH CHECK (bucket_id = 'encrypted-images');

CREATE POLICY "block_direct_storage_access"
  ON storage.objects
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Step 10: Verify migration
-- Uncomment to check results:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'snaps' AND column_name = 'user_id';
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'snaps' OR tablename = 'objects';
