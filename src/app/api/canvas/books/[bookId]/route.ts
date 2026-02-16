/**
 * Canvas Single Book API — Get, Update, Delete
 *
 * GET    /api/canvas/books/[bookId]  — get a single book with pages
 * PATCH  /api/canvas/books/[bookId]  — update book metadata (title, coverColor)
 * DELETE /api/canvas/books/[bookId]  — delete the book and all its pages
 *
 * @module api/canvas/books/[bookId]
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import {
  checkRateLimit,
  rateLimitResponse,
  READ_LIMIT,
  DELETE_LIMIT,
  UPLOAD_LIMIT,
} from "../../../../../lib/rate-limit";

// -----------------------------------------------------------------------------
// Supabase admin client
// -----------------------------------------------------------------------------
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("FATAL: Supabase environment variables are not set");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface BookRow {
  id: string;
  user_id: string;
  title: string;
  cover_color: string;
  created_at: string;
  updated_at: string;
}

interface PageRow {
  id: string;
  book_id: string;
  page_number: number;
  background: Record<string, unknown>;
  elements: unknown[];
  created_at: string;
  updated_at: string;
}

interface BookWithPages extends BookRow {
  pages: PageRow[];
}

type RouteContext = { params: Promise<{ bookId: string }> };

// -----------------------------------------------------------------------------
// Helper: fetch book + verify ownership
// -----------------------------------------------------------------------------
async function getOwnedBook(bookId: string, userId: string): Promise<BookRow | null> {
  const { data, error } = await supabaseAdmin
    .from("canvas_books")
    .select("*")
    .eq("id", bookId)
    .single();

  if (error || !data) return null;
  if ((data as BookRow).user_id !== userId) return null;
  return data as BookRow;
}

// -----------------------------------------------------------------------------
// GET /api/canvas/books/[bookId]
// -----------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<{ book: BookWithPages } | { error: string }>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rl = checkRateLimit(`canvas-book:${userId}`, READ_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const { bookId } = await ctx.params;
    const book = await getOwnedBook(bookId, userId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const { data: pages, error: pagesErr } = await supabaseAdmin
      .from("canvas_pages")
      .select("*")
      .eq("book_id", bookId)
      .order("page_number", { ascending: true });

    if (pagesErr) {
      console.error("[Canvas Book API] Error fetching pages:", pagesErr);
      return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
    }

    return NextResponse.json({
      book: { ...book, pages: (pages || []) as PageRow[] },
    });
  } catch (err) {
    console.error("[Canvas Book API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH /api/canvas/books/[bookId]
// -----------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<{ book: BookRow } | { error: string }>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rl = checkRateLimit(`canvas-book-update:${userId}`, UPLOAD_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const { bookId } = await ctx.params;
    const book = await getOwnedBook(bookId, userId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if (typeof body.coverColor === "string") {
      updates.cover_color = body.coverColor;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("canvas_books")
      .update(updates)
      .eq("id", bookId)
      .select()
      .single();

    if (error || !data) {
      console.error("[Canvas Book API] Error updating book:", error);
      return NextResponse.json({ error: "Failed to update book" }, { status: 500 });
    }

    return NextResponse.json({ book: data as BookRow });
  } catch (err) {
    console.error("[Canvas Book API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE /api/canvas/books/[bookId]
// -----------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<{ success: boolean } | { error: string }>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rl = checkRateLimit(`canvas-book-delete:${userId}`, DELETE_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const { bookId } = await ctx.params;
    const book = await getOwnedBook(bookId, userId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Pages cascade-delete via FK constraint
    const { error } = await supabaseAdmin
      .from("canvas_books")
      .delete()
      .eq("id", bookId);

    if (error) {
      console.error("[Canvas Book API] Error deleting book:", error);
      return NextResponse.json({ error: "Failed to delete book" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Canvas Book API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
