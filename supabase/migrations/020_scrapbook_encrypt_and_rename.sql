-- Migration: Rename scrapbook_book → scrapbook_books & add encrypted columns
-- Created: 2025-07-14
-- Description:
--   1. Rename table scrapbook_book → scrapbook_books (plural consistency)
--   2. Add encrypted_title / title_iv alongside existing title on scrapbook_books
--   3. Add encrypted_elements / elements_iv alongside existing elements on scrapbook_pages
--   4. Update indexes and triggers to use the new table name
--
-- NOTE: The plaintext 'title' and 'elements' columns are intentionally kept here
--       so that existing data can be migrated via scripts/migrate-scrapbook-encryption.ts
--       before they are removed in migration 021_scrapbook_drop_plaintext.sql.

-- =============================================================================
-- 1. Rename Table
-- =============================================================================

ALTER TABLE IF EXISTS public.scrapbook_book RENAME TO scrapbook_books;

-- =============================================================================
-- 2. Rename Indexes
-- =============================================================================

ALTER INDEX IF EXISTS idx_scrapbook_book_user_id RENAME TO idx_scrapbook_books_user_id;
ALTER INDEX IF EXISTS idx_scrapbook_book_updated_at RENAME TO idx_scrapbook_books_updated_at;

-- =============================================================================
-- 3. Recreate triggers on the renamed table
-- =============================================================================

DROP TRIGGER IF EXISTS trg_scrapbook_book_updated_at ON public.scrapbook_books;
CREATE TRIGGER trg_scrapbook_books_updated_at
  BEFORE UPDATE ON public.scrapbook_books
  FOR EACH ROW EXECUTE FUNCTION update_canvas_updated_at();

-- =============================================================================
-- 4. Add encrypted columns to scrapbook_books (title stays until 021)
-- =============================================================================

ALTER TABLE public.scrapbook_books
  ADD COLUMN IF NOT EXISTS encrypted_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_iv TEXT NOT NULL DEFAULT '';

-- =============================================================================
-- 5. Add encrypted columns to scrapbook_pages (elements stays until 021)
-- =============================================================================

ALTER TABLE public.scrapbook_pages
  ADD COLUMN IF NOT EXISTS encrypted_elements TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS elements_iv TEXT NOT NULL DEFAULT '';
