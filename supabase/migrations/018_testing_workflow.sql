-- Migration: testing workflow
-- Created: 2026-03-01
-- Description: using this to test github action workflow for supabase CI

COMMENT ON COLUMN public.snaps.user_id IS 'The user ID of the snap owner (via clerk auth). Null for anonymous snaps.';