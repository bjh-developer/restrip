/**
 * Canvas Single Page API — Delete
 *
 * DELETE /api/scrapbook/books/[bookId]/pages/[pageId]  — delete a page
 *
 * @module api/scrapbook/books/[bookId]/pages/[pageId]
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import {
  checkRateLimit,
  rateLimitResponse,
  DELETE_LIMIT,
} from "../../../../../../../lib/rate-limit";

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

type RouteContext = { params: Promise<{ bookId: string; pageId: string }> };

// -----------------------------------------------------------------------------
// DELETE /api/scrapbook/books/[bookId]/pages/[pageId]
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

    const rl = checkRateLimit(`canvas-page-delete:${userId}`, DELETE_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const { bookId, pageId } = await ctx.params;

    // Verify book ownership
    const { data: book } = await supabaseAdmin
      .from("scrapbook_books")
      .select("id, user_id")
      .eq("id", bookId)
      .single();

    if (!book || book.user_id !== userId) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Ensure at least 1 page remains
    const { count } = await supabaseAdmin
      .from("scrapbook_pages")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId);

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "A book must have at least one page" }, { status: 400 });
    }

    // Delete the page
    const { error } = await supabaseAdmin
      .from("scrapbook_pages")
      .delete()
      .eq("id", pageId)
      .eq("book_id", bookId);

    if (error) {
      console.error("[Canvas Page API] Error deleting page:", error);
      return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
    }

    // Re-number remaining pages
    const { data: remaining } = await supabaseAdmin
      .from("scrapbook_pages")
      .select("id")
      .eq("book_id", bookId)
      .order("page_number", { ascending: true });

    if (remaining) {
      for (let i = 0; i < remaining.length; i++) {
        await supabaseAdmin
          .from("scrapbook_pages")
          .update({ page_number: i + 1 })
          .eq("id", remaining[i].id);
      }
    }

    // Touch book updated_at
    await supabaseAdmin
      .from("scrapbook_books")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", bookId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Canvas Page API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
