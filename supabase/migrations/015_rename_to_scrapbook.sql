-- Migration: Rename canvas_books and canvas_pages to scrapbook_book and scrapbook_pages
-- Created: 2026-02-17
-- Description: Rename tables and indexes from canvas to scrapbook naming convention

-- =============================================================================
-- Rename Tables
-- =============================================================================

ALTER TABLE IF EXISTS public.canvas_books RENAME TO scrapbook_book;
ALTER TABLE IF EXISTS public.canvas_pages RENAME TO scrapbook_pages;

-- =============================================================================
-- Rename Indexes
-- =============================================================================

ALTER INDEX IF EXISTS idx_canvas_books_user_id RENAME TO idx_scrapbook_book_user_id;
ALTER INDEX IF EXISTS idx_canvas_books_updated_at RENAME TO idx_scrapbook_book_updated_at;
ALTER INDEX IF EXISTS idx_canvas_pages_book_id RENAME TO idx_scrapbook_pages_book_id;
ALTER INDEX IF EXISTS idx_canvas_pages_ordering RENAME TO idx_scrapbook_pages_ordering;

-- =============================================================================
-- Ensure trigger function exists (replace or create)
-- =============================================================================

CREATE OR REPLACE FUNCTION update_canvas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Recreate triggers on new table names (idempotent: drop if exists, then create)
-- =============================================================================

-- Drop any triggers left with old or new names on the target tables to ensure idempotency
DROP TRIGGER IF EXISTS trg_canvas_books_updated_at ON public.scrapbook_book;
DROP TRIGGER IF EXISTS trg_scrapbook_book_updated_at ON public.scrapbook_book;

DROP TRIGGER IF EXISTS trg_canvas_pages_updated_at ON public.scrapbook_pages;
DROP TRIGGER IF EXISTS trg_scrapbook_pages_updated_at ON public.scrapbook_pages;

-- Create triggers with the new names on the renamed tables
CREATE TRIGGER trg_scrapbook_book_updated_at
  BEFORE UPDATE ON public.scrapbook_book
  FOR EACH ROW EXECUTE FUNCTION update_canvas_updated_at();

CREATE TRIGGER trg_scrapbook_pages_updated_at
  BEFORE UPDATE ON public.scrapbook_pages
  FOR EACH ROW EXECUTE FUNCTION update_canvas_updated_at();