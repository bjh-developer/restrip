/**
 * Stats API
 *
 * GET /api/stats — returns the total number of snaps ever created
 *
 * @module api/stats
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Cache the response for 60 seconds instead of hitting the DB on every request
export const revalidate = 60;

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
// GET /api/stats
// -----------------------------------------------------------------------------
export async function GET() {
  try {
    const { count, error } = await supabaseAdmin
      .from("snaps")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({ count: count ?? 0 });
  } catch (error) {
    console.error("[Stats API] Error fetching count:", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
