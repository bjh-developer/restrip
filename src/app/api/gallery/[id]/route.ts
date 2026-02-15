/**
 * Gallery Snap Delete API Route Handler
 *
 * Deletes a specific snap belonging to the authenticated user.
 * Removes both the database record and the image file from storage.
 *
 * @module api/gallery/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

/**
 * Supabase admin client for direct database and storage access.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

/** Storage bucket name for images */
const STORAGE_BUCKET = "encrypted-images";

/**
 * DELETE /api/gallery/[id]
 *
 * Deletes a snap record and its associated file from storage.
 * Verifies ownership before deletion.
 *
 * @param request - Incoming request
 * @param context - Route context with snap ID param
 * @returns Success confirmation or error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ success: boolean } | { error: string }>> {
  try {
    const { id } = await params;

    // Verify authentication via Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Fetch the snap to verify ownership and get storage path
    const { data: snap, error: fetchError } = await supabaseAdmin
      .from("snaps")
      .select("id, user_id, storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !snap) {
      return NextResponse.json(
        { error: "Snap not found" },
        { status: 404 },
      );
    }

    // Verify the user owns this snap
    if (snap.user_id !== userId) {
      return NextResponse.json(
        { error: "Not authorized to delete this snap" },
        { status: 403 },
      );
    }

    // Delete the file from storage
    if (snap.storage_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove([snap.storage_path]);

      if (storageError) {
        console.warn("Storage delete warning (continuing):", storageError);
        // Continue with DB delete even if storage fails
      }
    }

    // Delete the database record
    const { error: deleteError } = await supabaseAdmin
      .from("snaps")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Database delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete snap" },
        { status: 500 },
      );
    }

    console.log(`✅ Snap ${id} deleted by user ${userId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete snap handler error:", error);
    return NextResponse.json(
      { error: "Failed to delete snap" },
      { status: 500 },
    );
  }
}
