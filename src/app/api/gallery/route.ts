/**
 * Gallery API Route Handler
 *
 * Fetches a paginated list of the authenticated user's snaps.
 * Authentication is enforced by Clerk middleware.
 *
 * @module api/gallery
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import {
  decryptImage,
  decryptDataAsString,
  getServerEncryptionKey,
} from "../../../lib/simple-encryption";

/** Shape of a snap item returned in the gallery list */
interface GallerySnapItem {
  id: string;
  storage_path: string;
  caption: string;
  image_url: string | null;
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

/** Storage bucket name */
const STORAGE_BUCKET = "encrypted-images";

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
    // Verify authentication via Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    console.log("[Gallery API] Fetching for user:", userId);

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

    // Fetch paginated snaps
    const { data: snaps, error: fetchError } = await supabaseAdmin
      .from("snaps")
      .select("*")
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

    // Generate signed URLs and decrypt data for each snap
    const encryptionKey = getServerEncryptionKey();
    
    const snapsWithUrls = await Promise.all(
      (snaps ?? []).map(async (snap) => {
        try {
          // Download encrypted image from storage
          const { data: encryptedBlob, error: downloadError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .download(snap.storage_path);

          if (downloadError || !encryptedBlob) {
            console.error("[Gallery API] Download error for snap", snap.id, downloadError);
            return {
              ...snap,
              image_url: null,
              caption: "Failed to load",
            } as GallerySnapItem;
          }

          // Convert blob to base64
          const arrayBuffer = await encryptedBlob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const encryptedBase64 = Buffer.from(binary, "binary").toString("base64");

          // Decrypt image
          const decryptedImageDataUrl = await decryptImage(
            encryptedBase64,
            snap.image_iv,
            encryptionKey,
            "image/jpeg",
          );

          // Decrypt caption
          const decryptedCaption = await decryptDataAsString(
            snap.encrypted_caption,
            snap.caption_iv,
            encryptionKey,
          );

          return {
            ...snap,
            image_url: decryptedImageDataUrl,
            caption: decryptedCaption,
          } as GallerySnapItem;
        } catch (error) {
          console.error("[Gallery API] Decryption error for snap", snap.id, error);
          return {
            ...snap,
            image_url: null,
            caption: "Decryption failed",
          } as GallerySnapItem;
        }
      }),
    );

    return NextResponse.json({
      snaps: snapsWithUrls,
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
