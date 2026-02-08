/**
 * Gallery API Route Handler
 *
 * Fetches a paginated list of the authenticated user's snaps.
 * Requires a valid Supabase session (enforced by middleware).
 *
 * @module api/gallery
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "../../../lib/supabase/server";

/** Shape of a snap item returned in the gallery list */
interface GallerySnapItem {
  id: string;
  storage_path: string;
  encrypted_caption: string;
  caption_iv: string;
  image_iv: string;
  send_date: string;
  send_time: string;
  delivery_method: string;
  delivery_address: string;
  period_type: string;
  delivery_status: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

/** Paginated gallery response */
interface GalleryResponse {
  snaps: GallerySnapItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Default page size for gallery pagination */
const DEFAULT_PAGE_SIZE = 20;

/** Maximum allowed page size */
const MAX_PAGE_SIZE = 50;

/**
 * Supabase admin client for direct database queries.
 * Used after verifying user identity via session.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

/**
 * GET /api/gallery
 *
 * Returns the authenticated user's snaps, ordered by creation date (newest first).
 * Supports pagination via `page` and `pageSize` query parameters.
 *
 * @param request - Incoming request with optional page/pageSize query params
 * @returns Paginated list of snaps or error
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<GalleryResponse | { error: string }>> {
  try {
    // Verify authentication via Supabase server client
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10)),
    );
    const offset = (page - 1) * pageSize;

    // Fetch total count for user's snaps
    const { count, error: countError } = await supabaseAdmin
      .from("snaps")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error("Gallery count error:", countError);
      return NextResponse.json(
        { error: "Failed to fetch gallery count" },
        { status: 500 },
      );
    }

    // Fetch paginated snaps
    const { data: snaps, error: fetchError } = await supabaseAdmin
      .from("snaps")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (fetchError) {
      console.error("Gallery fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch gallery" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      snaps: (snaps ?? []) as GallerySnapItem[],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Gallery handler error:", error);
    return NextResponse.json(
      { error: "Failed to load gallery" },
      { status: 500 },
    );
  }
}
