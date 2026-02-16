/**
 * Canvas Books API — List & Create
 *
 * GET  /api/canvas/books      — list all books for the authenticated user
 * POST /api/canvas/books      — create a new book with one blank page
 *
 * @module api/canvas/books
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, rateLimitResponse, READ_LIMIT, UPLOAD_LIMIT } from "../../../../lib/rate-limit";

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

// -----------------------------------------------------------------------------
// GET /api/canvas/books
// -----------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
): Promise<NextResponse<{ books: BookWithPages[] } | { error: string }>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rl = checkRateLimit(`canvas-books:${userId}`, READ_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    // Fetch books
    const { data: books, error: booksErr } = await supabaseAdmin
      .from("canvas_books")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (booksErr) {
      console.error("[Canvas Books API] Error fetching books:", booksErr);
      return NextResponse.json({ error: "Failed to load books" }, { status: 500 });
    }

    if (!books || books.length === 0) {
      return NextResponse.json({ books: [] });
    }

    // Fetch all pages for these books in a single query
    const bookIds = books.map((b: BookRow) => b.id);
    const { data: pages, error: pagesErr } = await supabaseAdmin
      .from("canvas_pages")
      .select("*")
      .in("book_id", bookIds)
      .order("page_number", { ascending: true });

    if (pagesErr) {
      console.error("[Canvas Books API] Error fetching pages:", pagesErr);
      return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
    }

    // Assemble books with their pages
    const pagesByBook = new Map<string, PageRow[]>();
    for (const page of (pages || []) as PageRow[]) {
      const arr = pagesByBook.get(page.book_id) || [];
      arr.push(page);
      pagesByBook.set(page.book_id, arr);
    }

    const booksWithPages: BookWithPages[] = (books as BookRow[]).map((book) => ({
      ...book,
      pages: pagesByBook.get(book.id) || [],
    }));

    return NextResponse.json({ books: booksWithPages });
  } catch (err) {
    console.error("[Canvas Books API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST /api/canvas/books
// -----------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ book: BookWithPages } | { error: string }>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rl = checkRateLimit(`canvas-books-create:${userId}`, UPLOAD_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled Book";
    const coverColor = typeof body.coverColor === "string" ? body.coverColor : "#FFC9D1";

    // Create the book
    const { data: book, error: bookErr } = await supabaseAdmin
      .from("canvas_books")
      .insert({ user_id: userId, title, cover_color: coverColor })
      .select()
      .single();

    if (bookErr || !book) {
      console.error("[Canvas Books API] Error creating book:", bookErr);
      return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
    }

    // Create one blank page
    const { data: page, error: pageErr } = await supabaseAdmin
      .from("canvas_pages")
      .insert({
        book_id: book.id,
        page_number: 1,
        background: { type: "color", color: "#FFFFFF" },
        elements: [],
      })
      .select()
      .single();

    if (pageErr || !page) {
      console.error("[Canvas Books API] Error creating initial page:", pageErr);
      // Clean up the book
      await supabaseAdmin.from("canvas_books").delete().eq("id", book.id);
      return NextResponse.json({ error: "Failed to create initial page" }, { status: 500 });
    }

    return NextResponse.json(
      { book: { ...book, pages: [page] } as BookWithPages },
      { status: 201 },
    );
  } catch (err) {
    console.error("[Canvas Books API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
