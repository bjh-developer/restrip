-- =============================================================================
-- Migration: Gallery Feature - RLS Policies & Indexes
-- =============================================================================
-- This migration adds:
-- 1. RLS policies for authenticated gallery access to snaps
-- 2. Indexes for efficient gallery queries (user_id, created_at)
-- 3. Storage policies for authenticated user folders
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enable RLS on snaps table (if not already enabled)
-- -----------------------------------------------------------------------------
ALTER TABLE public.snaps ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. RLS Policies for snaps table
-- -----------------------------------------------------------------------------

-- Allow service role to insert anonymous snaps (user_id IS NULL)
-- This is used by the anonymous upload flow via supabaseAdmin
-- Note: supabaseAdmin (service_role key) bypasses RLS, so no explicit policy needed.

-- Allow authenticated users to read their own snaps
CREATE POLICY "Users can view their own snaps"
  ON public.snaps
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own snaps
CREATE POLICY "Users can create their own snaps"
  ON public.snaps
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own snaps
CREATE POLICY "Users can delete their own snaps"
  ON public.snaps
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to update their own snaps (e.g., mark as delivered)
CREATE POLICY "Users can update their own snaps"
  ON public.snaps
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Indexes for gallery queries
-- -----------------------------------------------------------------------------

-- Index for fetching user's snaps ordered by creation date (gallery view)
CREATE INDEX IF NOT EXISTS idx_snaps_user_id_created_at
  ON public.snaps (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Index for fetching user's snaps ordered by send_date (timeline view)
CREATE INDEX IF NOT EXISTS idx_snaps_user_id_send_date
  ON public.snaps (user_id, send_date DESC)
  WHERE user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Storage policies for authenticated user uploads
-- -----------------------------------------------------------------------------
-- These allow authenticated users to manage files in their own folder
-- Path pattern: encrypted-images/{user_id}/*

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'encrypted-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read from their own folder
CREATE POLICY "Users can read own folder"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'encrypted-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete from their own folder
CREATE POLICY "Users can delete from own folder"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'encrypted-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 5. Verify: Check that everything was created
-- -----------------------------------------------------------------------------
-- You can run this SELECT to verify policies were created:
-- SELECT policyname, tablename, cmd FROM pg_policies WHERE tablename = 'snaps';
-- SELECT policyname, tablename, cmd FROM pg_policies WHERE tablename = 'objects';
