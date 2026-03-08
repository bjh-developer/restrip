/**
 * Canvas Books API — List & Create
 *
 * GET  /api/scrapbook/books      — list all books for the authenticated user
 * POST /api/scrapbook/books      — create a new book with one blank page
 *
 * @module api/scrapbook/books
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, rateLimitResponse, READ_LIMIT, UPLOAD_LIMIT } from "../../../../lib/rate-limit";
import { encryptData, decryptDataAsString, getServerEncryptionKey } from "../../../../lib/simple-encryption";

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

// -----------------------------------------------------------------------------
// GET /api/scrapbook/books
// -----------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
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
      .from("scrapbook_books")
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
    const bookIds = books.map((b: BookDbRow) => b.id);
    const { data: pages, error: pagesErr } = await supabaseAdmin
      .from("scrapbook_pages")
      .select("*")
      .in("book_id", bookIds)
      .order("page_number", { ascending: true });

    if (pagesErr) {
      console.error("[Canvas Books API] Error fetching pages:", pagesErr);
      return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
    }

    // Decrypt
    const key = getServerEncryptionKey();

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

    // Assemble books with their pages
    const pagesByBook = new Map<string, PageRow[]>();
    for (const page of decryptedPages) {
      const arr = pagesByBook.get(page.book_id) || [];
      arr.push(page);
      pagesByBook.set(page.book_id, arr);
    }

    const booksWithPages: BookWithPages[] = [];
    for (const b of books as BookDbRow[]) {
      const title = b.encrypted_title && b.title_iv
        ? await decryptDataAsString(b.encrypted_title, b.title_iv, key)
        : "";
      booksWithPages.push({
        id: b.id, user_id: b.user_id, title, cover_color: b.cover_color,
        created_at: b.created_at, updated_at: b.updated_at,
        pages: pagesByBook.get(b.id) || [],
      });
    }

    return NextResponse.json({ books: booksWithPages });
  } catch (err) {
    console.error("[Canvas Books API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST /api/scrapbook/books
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

    // Encrypt title
    const key = getServerEncryptionKey();
    const { encrypted: encryptedTitle, iv: titleIv } = await encryptData(title, key);

    // Create the book
    const { data: book, error: bookErr } = await supabaseAdmin
      .from("scrapbook_books")
      .insert({ user_id: userId, encrypted_title: encryptedTitle, title_iv: titleIv, cover_color: coverColor })
      .select()
      .single();

    if (bookErr || !book) {
      console.error("[Canvas Books API] Error creating book:", bookErr);
      return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
    }

    // Encrypt empty elements for the initial page
    const { encrypted: encryptedElements, iv: elementsIv } = await encryptData(JSON.stringify([]), key);

    // Create one blank page
    const { data: page, error: pageErr } = await supabaseAdmin
      .from("scrapbook_pages")
      .insert({
        book_id: book.id,
        page_number: 1,
        background: { type: "color", color: "#FFFFFF" },
        encrypted_elements: encryptedElements,
        elements_iv: elementsIv,
      })
      .select()
      .single();

    if (pageErr || !page) {
      console.error("[Canvas Books API] Error creating initial page:", pageErr);
      // Clean up the book
      await supabaseAdmin.from("scrapbook_books").delete().eq("id", book.id);
      return NextResponse.json({ error: "Failed to create initial page" }, { status: 500 });
    }

    // Return decrypted view to client
    const bookRow: BookRow = {
      id: book.id, user_id: book.user_id, title, cover_color: book.cover_color,
      created_at: book.created_at, updated_at: book.updated_at,
    };
    const pageRow: PageRow = {
      id: page.id, book_id: page.book_id, page_number: page.page_number,
      background: page.background, elements: [], created_at: page.created_at, updated_at: page.updated_at,
    };

    return NextResponse.json(
      { book: { ...bookRow, pages: [pageRow] } as BookWithPages },
      { status: 201 },
    );
  } catch (err) {
    console.error("[Canvas Books API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
