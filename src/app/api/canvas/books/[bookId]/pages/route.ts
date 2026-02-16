/**
 * Canvas Pages API — Add Page & Batch Save
 *
 * POST /api/canvas/books/[bookId]/pages          — add a new blank page
 * PUT  /api/canvas/books/[bookId]/pages          — batch save all pages (auto-save)
 *
 * @module api/canvas/books/[bookId]/pages
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import {
  checkRateLimit,
  rateLimitResponse,
  UPLOAD_LIMIT,
} from "../../../../../../lib/rate-limit";

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
interface PageRow {
  id: string;
  book_id: string;
  page_number: number;
  background: Record<string, unknown>;
  elements: unknown[];
  created_at: string;
  updated_at: string;
}

/** Auto-save rate: 30 requests per minute (debounced on client to 800ms) */
const AUTO_SAVE_LIMIT = { maxTokens: 30, refillRate: 30 / 60 };

type RouteContext = { params: Promise<{ bookId: string }> };

// -----------------------------------------------------------------------------
// Helper: verify book ownership
// -----------------------------------------------------------------------------
async function verifyBookOwnership(bookId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("canvas_books")
    .select("id, user_id")
    .eq("id", bookId)
    .single();

  if (error || !data) return false;
  return data.user_id === userId;
}

// -----------------------------------------------------------------------------
// POST /api/canvas/books/[bookId]/pages — add new page
// -----------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<{ page: PageRow } | { error: string }>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rl = checkRateLimit(`canvas-page-add:${userId}`, UPLOAD_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const { bookId } = await ctx.params;
    if (!(await verifyBookOwnership(bookId, userId))) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get the next page number
    const { data: existingPages } = await supabaseAdmin
      .from("canvas_pages")
      .select("page_number")
      .eq("book_id", bookId)
      .order("page_number", { ascending: false })
      .limit(1);

    const nextPageNumber = existingPages && existingPages.length > 0
      ? existingPages[0].page_number + 1
      : 1;

    const { data: page, error: pageErr } = await supabaseAdmin
      .from("canvas_pages")
      .insert({
        book_id: bookId,
        page_number: nextPageNumber,
        background: { type: "color", color: "#FFFFFF" },
        elements: [],
      })
      .select()
      .single();

    if (pageErr || !page) {
      console.error("[Canvas Pages API] Error creating page:", pageErr);
      return NextResponse.json({ error: "Failed to create page" }, { status: 500 });
    }

    // Touch book updated_at
    await supabaseAdmin
      .from("canvas_books")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", bookId);

    return NextResponse.json({ page: page as PageRow }, { status: 201 });
  } catch (err) {
    console.error("[Canvas Pages API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PUT /api/canvas/books/[bookId]/pages — batch save all pages (auto-save)
// -----------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<{ success: boolean } | { error: string }>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rl = checkRateLimit(`canvas-auto-save:${userId}`, AUTO_SAVE_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const { bookId } = await ctx.params;
    if (!(await verifyBookOwnership(bookId, userId))) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.pages)) {
      return NextResponse.json({ error: "Invalid request body: expected { pages: [...] }" }, { status: 400 });
    }

    // Validate and upsert each page
    for (const pg of body.pages) {
      if (!pg.id || typeof pg.id !== "string") continue;

      const updates: Record<string, unknown> = {};
      if (typeof pg.page_number === "number") updates.page_number = pg.page_number;
      if (pg.background && typeof pg.background === "object") updates.background = pg.background;
      if (Array.isArray(pg.elements)) updates.elements = pg.elements;

      if (Object.keys(updates).length === 0) continue;

      const { error } = await supabaseAdmin
        .from("canvas_pages")
        .update(updates)
        .eq("id", pg.id)
        .eq("book_id", bookId); // ensure page belongs to this book

      if (error) {
        console.error(`[Canvas Pages API] Error saving page ${pg.id}:`, error);
      }
    }

    // Touch book updated_at
    await supabaseAdmin
      .from("canvas_books")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", bookId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Canvas Pages API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
