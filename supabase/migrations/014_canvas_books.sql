-- =============================================================================
-- Migration: Canvas Books & Pages
-- =============================================================================
-- Creates tables for the scrapbook/canvas feature:
-- 1. canvas_books  - a book belongs to a Clerk user
-- 2. canvas_pages  - pages within a book, each with background + elements JSON
--
-- Authentication is handled by Clerk (user_id = Clerk userId string).
-- RLS is NOT used because we use a service-role client after verifying
-- the Clerk session in API routes (same pattern as snaps table).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. canvas_books table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.canvas_books (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT 'Untitled Book',
  cover_color TEXT NOT NULL DEFAULT '#FFC9D1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX idx_canvas_books_user_id ON public.canvas_books (user_id);
CREATE INDEX idx_canvas_books_updated_at ON public.canvas_books (updated_at DESC);

-- -----------------------------------------------------------------------------
-- 2. canvas_pages table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.canvas_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID NOT NULL REFERENCES public.canvas_books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL DEFAULT 1,
  background  JSONB NOT NULL DEFAULT '{"type":"color","color":"#FFFFFF"}'::jsonb,
  elements    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by book
CREATE INDEX idx_canvas_pages_book_id ON public.canvas_pages (book_id);
CREATE INDEX idx_canvas_pages_ordering ON public.canvas_pages (book_id, page_number);

-- -----------------------------------------------------------------------------
-- 3. Auto-update updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_canvas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_canvas_books_updated_at
  BEFORE UPDATE ON public.canvas_books
  FOR EACH ROW EXECUTE FUNCTION update_canvas_updated_at();

CREATE TRIGGER trg_canvas_pages_updated_at
  BEFORE UPDATE ON public.canvas_pages
  FOR EACH ROW EXECUTE FUNCTION update_canvas_updated_at();
