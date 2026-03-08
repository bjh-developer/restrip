-- Migration: Drop plaintext title and elements columns
-- Created: 2025-07-14
-- Description:
--   Remove the now-redundant plaintext columns after running the data migration script:
--     npx tsx scripts/migrate-scrapbook-encryption.ts
--
-- PREREQUISITE: Run scripts/migrate-scrapbook-encryption.ts first and verify all rows
--   in scrapbook_books have non-empty encrypted_title, and all rows in scrapbook_pages
--   have non-empty encrypted_elements.
--
-- Verification queries before running this migration:
--   SELECT COUNT(*) FROM scrapbook_books WHERE encrypted_title = '';   -- must be 0
--   SELECT COUNT(*) FROM scrapbook_pages WHERE encrypted_elements = ''; -- must be 0

ALTER TABLE public.scrapbook_books
  DROP COLUMN IF EXISTS title;

ALTER TABLE public.scrapbook_pages
  DROP COLUMN IF EXISTS elements;
