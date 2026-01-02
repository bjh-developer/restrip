import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "../../../lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

// Upload to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const supabase = await createServerClient();
    const {
      data: { user: sessionUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !sessionUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { encryptedImage } = await request.json();

    if (!encryptedImage) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Convert base64 to buffer for upload
    const base64Data = encryptedImage.replace(/^data:.*?;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filePath = `${sessionUser.id}/${timestamp}-${randomId}.enc`;

    // Upload encrypted blob to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from("encrypted-images")
      .upload(filePath, buffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage error:", error);
      return NextResponse.json(
        { error: "Failed to upload to storage" },
        { status: 500 },
      );
    }

    // Return the storage path (not the full URL, just the path)
    return NextResponse.json(
      {
        storagePath: data.path,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
