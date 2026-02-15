/**
 * Gallery API Route Handler
 *
 * Fetches a paginated list of the authenticated user's snap metadata.
 * Images are NOT included — they are loaded separately via /api/images/[id]
 * to enable HTTP caching and progressive loading.
 *
 * Authentication is enforced by Clerk middleware.
 *
 * @module api/gallery
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import {
  decryptDataAsString,
  getServerEncryptionKey,
} from "../../../lib/simple-encryption";

/** Shape of a snap item returned in the gallery list (metadata only, no image) */
interface GallerySnapItem {
  id: string;
  storage_path: string;
  caption: string;
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
 * Used after verifying user identity via Clerk.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

/**
 * GET /api/gallery
 *
 * Returns the authenticated user's snap metadata, ordered by creation date
 * (newest first). Supports pagination via `page` and `pageSize` query params.
 *
 * Images are NOT included — fetch them via /api/images/[id] which supports
 * HTTP caching for fast repeat loads.
 *
 * @param request - Incoming request with optional page/pageSize query params
 * @returns Paginated list of snap metadata or error
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<GalleryResponse | { error: string }>> {
  try {
    // Verify authentication via Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    console.log("[Gallery API] Fetching metadata for user:", userId);

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const parsedPage = parseInt(searchParams.get("page") ?? "1", 10);
    const parsedPageSize = parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10);
    
    // Validate and fallback to defaults if NaN
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0
      ? Math.min(MAX_PAGE_SIZE, parsedPageSize)
      : DEFAULT_PAGE_SIZE;
    
    const offset = (page - 1) * pageSize;

    // Fetch total count for user's snaps
    const { count, error: countError } = await supabaseAdmin
      .from("snaps")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      console.error("[Gallery API] Count error:", {
        error: countError,
        userId,
        message: countError.message,
        details: countError.details,
      });
      return NextResponse.json(
        { error: `Database error: ${countError.message}` },
        { status: 500 },
      );
    }

    // Fetch paginated snaps (metadata columns only — skip encrypted image data)
    const { data: snaps, error: fetchError } = await supabaseAdmin
      .from("snaps")
      .select(
        "id, storage_path, encrypted_caption, caption_iv, send_date, send_time, delivery_method, delivery_address, period_type, delivery_status, error_message, retry_count, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (fetchError) {
      console.error("[Gallery API] Fetch error:", {
        error: fetchError,
        userId,
        message: fetchError.message,
        details: fetchError.details,
      });
      return NextResponse.json(
        { error: `Database error: ${fetchError.message}` },
        { status: 500 },
      );
    }

    // Decrypt captions only (images loaded separately via /api/images/[id])
    const encryptionKey = getServerEncryptionKey();

    const snapsWithCaptions: GallerySnapItem[] = await Promise.all(
      (snaps ?? []).map(async (snap) => {
        let caption = "";
        try {
          if (snap.encrypted_caption && snap.caption_iv) {
            caption = await decryptDataAsString(
              snap.encrypted_caption,
              snap.caption_iv,
              encryptionKey,
            );
          }
        } catch (error) {
          console.error("[Gallery API] Caption decryption error for snap", snap.id, error);
          caption = "Decryption failed";
        }

        return {
          id: snap.id,
          storage_path: snap.storage_path,
          caption,
          send_date: snap.send_date,
          send_time: snap.send_time,
          delivery_method: snap.delivery_method,
          delivery_address: snap.delivery_address,
          period_type: snap.period_type,
          delivery_status: snap.delivery_status,
          error_message: snap.error_message,
          retry_count: snap.retry_count,
          created_at: snap.created_at,
        };
      }),
    );

    return NextResponse.json({
      snaps: snapsWithCaptions,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[Gallery API] Unexpected error:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to load gallery" 
      },
      { status: 500 },
    );
  }
}
