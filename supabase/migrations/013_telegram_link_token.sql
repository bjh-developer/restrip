-- =============================================================================
-- Migration: Add Telegram Link Token for IDOR Prevention
-- =============================================================================
-- Adds a one-time token to snaps for secure Telegram bot linking.
-- The deep link format changes from snap_{id} to snap_{id}_{token}.
-- The bot verifies both the snap ID and token before linking a chat.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Step 1: Add the telegram_link_token column
ALTER TABLE public.snaps
  ADD COLUMN IF NOT EXISTS telegram_link_token TEXT;

-- Step 2: Generate tokens for existing telegram snaps that don't have one
UPDATE public.snaps
SET telegram_link_token = encode(gen_random_bytes(8), 'hex')
WHERE delivery_method = 'telegram'
  AND telegram_link_token IS NULL;

-- Step 3: Add a comment
COMMENT ON COLUMN public.snaps.telegram_link_token IS 'One-time token for secure Telegram bot deep link verification (IDOR prevention)';

