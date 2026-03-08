/**
 * Canvas Single Book API — Get, Update, Delete
 *
 * GET    /api/scrapbook/books/[bookId]  — get a single book with pages
 * PATCH  /api/scrapbook/books/[bookId]  — update book metadata (title, coverColor)
 * DELETE /api/scrapbook/books/[bookId]  — delete the book and all its pages
 *
 * @module api/scrapbook/books/[bookId]
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
import { encryptData, decryptDataAsString, getServerEncryptionKey } from "../../../../../lib/simple-encryption";

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
// Types (DB rows have encrypted columns; client sees plaintext)
// -----------------------------------------------------------------------------
interface BookDbRow {
  id: string;
  user_id: string;
  encrypted_title: string;
  title_iv: string;
  cover_color: string;
  created_at: string;
  updated_at: string;
}

interface PageDbRow {
  id: string;
  book_id: string;
  page_number: number;
  background: Record<string, unknown>;
  encrypted_elements: string;
  elements_iv: string;
  created_at: string;
  updated_at: string;
}

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
async function getOwnedBook(bookId: string, userId: string): Promise<BookDbRow | null> {
  const { data, error } = await supabaseAdmin
    .from("scrapbook_books")
    .select("*")
    .eq("id", bookId)
    .single();

  if (error || !data) return null;
  if ((data as BookDbRow).user_id !== userId) return null;
  return data as BookDbRow;
}

// -----------------------------------------------------------------------------
// GET /api/scrapbook/books/[bookId]
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
      .from("scrapbook_pages")
      .select("*")
      .eq("book_id", bookId)
      .order("page_number", { ascending: true });

    if (pagesErr) {
      console.error("[Canvas Book API] Error fetching pages:", pagesErr);
      return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
    }

    // Decrypt
    const key = getServerEncryptionKey();
    const title = book.encrypted_title && book.title_iv
      ? await decryptDataAsString(book.encrypted_title, book.title_iv, key)
      : "";

    const decryptedPages: PageRow[] = [];
    for (const p of (pages || []) as PageDbRow[]) {
      const elements = p.encrypted_elements && p.elements_iv
        ? JSON.parse(await decryptDataAsString(p.encrypted_elements, p.elements_iv, key))
        : [];
      decryptedPages.push({
        id: p.id, book_id: p.book_id, page_number: p.page_number,
        background: p.background, elements, created_at: p.created_at, updated_at: p.updated_at,
      });
    }

    const bookRow: BookRow = {
      id: book.id, user_id: book.user_id, title, cover_color: book.cover_color,
      created_at: book.created_at, updated_at: book.updated_at,
    };

    return NextResponse.json({
      book: { ...bookRow, pages: decryptedPages },
    });
  } catch (err) {
    console.error("[Canvas Book API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH /api/scrapbook/books/[bookId]
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
      const key = getServerEncryptionKey();
      const { encrypted, iv } = await encryptData(body.title.trim(), key);
      updates.encrypted_title = encrypted;
      updates.title_iv = iv;
    }
    if (typeof body.coverColor === "string") {
      updates.cover_color = body.coverColor;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("scrapbook_books")
      .update(updates)
      .eq("id", bookId)
      .select()
      .single();

    if (error || !data) {
      console.error("[Canvas Book API] Error updating book:", error);
      return NextResponse.json({ error: "Failed to update book" }, { status: 500 });
    }

    // Decrypt for the response
    const dbRow = data as BookDbRow;
    const key = getServerEncryptionKey();
    const title = dbRow.encrypted_title && dbRow.title_iv
      ? await decryptDataAsString(dbRow.encrypted_title, dbRow.title_iv, key)
      : "";

    return NextResponse.json({
      book: {
        id: dbRow.id, user_id: dbRow.user_id, title, cover_color: dbRow.cover_color,
        created_at: dbRow.created_at, updated_at: dbRow.updated_at,
      } as BookRow,
    });
  } catch (err) {
    console.error("[Canvas Book API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE /api/scrapbook/books/[bookId]
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
      .from("scrapbook_books")
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
