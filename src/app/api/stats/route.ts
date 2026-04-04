/**
 * Stats API
 *
 * GET /api/stats — returns the total number of snaps created and current service status
 *
 * @module api/stats
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Cache the response for 60 seconds instead of hitting upstream APIs on every request
export const revalidate = 60;

// -----------------------------------------------------------------------------
// Supabase admin client
// -----------------------------------------------------------------------------
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("FATAL: Supabase environment variables are not set");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// -----------------------------------------------------------------------------
// Better Stack status helper
// Maps monitor statuses → a single display status
// -----------------------------------------------------------------------------
type DisplayStatus =
  | "online"
  | "offline"
  | "maintenance"
  | "degraded"
  | "error";

async function getBetterStackStatus(): Promise<DisplayStatus> {
  const token = process.env.BETTERSTACK_API_TOKEN;
  if (!token) return "online"; // no token configured — assume online

  const res = await fetch("https://uptime.betterstack.com/api/v2/monitors", {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  });

  if (!res.ok) return "degraded";

  const json = (await res.json()) as {
    data: { attributes: { status: string } }[];
  };

  const statuses = json.data.map((m) => m.attributes.status);

  if (statuses.some((s) => s === "up")) return "online";
  if (statuses.some((s) => s === "down")) return "offline";
  if (statuses.some((s) => s === "maintenance")) return "maintenance";
  if (statuses.some((s) => s === "validating" || s === "pending"))
    return "degraded";
  return "error";
}

// -----------------------------------------------------------------------------
// GET /api/stats
// -----------------------------------------------------------------------------
export async function GET() {
  try {
    const [{ count, error }, status] = await Promise.all([
      supabaseAdmin.from("snaps").select("*", { count: "exact", head: true }),
      getBetterStackStatus(),
    ]);

    if (error) throw error;

    return NextResponse.json({ count: count ?? 0, status });
  } catch (error) {
    console.error("[Stats API] Error:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 },
    );
  }
}
