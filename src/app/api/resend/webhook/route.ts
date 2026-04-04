import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
  };
};

const FINAL_SENT_EVENTS = new Set(["email.sent", "email.delivered"]);
const FINAL_FAILED_EVENTS = new Set([
  "email.failed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
]);

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

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing webhook signature headers" },
      { status: 400 },
    );
  }

  let payload: string;
  try {
    payload = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook body" },
      { status: 400 },
    );
  }

  let event: ResendWebhookEvent;
  try {
    const resend = getResend();
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret,
    }) as ResendWebhookEvent;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[resend-webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  const eventType = event.type ?? "";
  const resendEmailId = event.data?.email_id ?? "";
  if (!eventType || !resendEmailId) {
    return NextResponse.json(
      { received: true, ignored: true },
      { status: 200 },
    );
  }

  if (FINAL_SENT_EVENTS.has(eventType)) {
    const { error } = await supabaseAdmin
      .from("snaps")
      .update({
        delivery_status: "sent",
        delivered_at: event.created_at ?? new Date().toISOString(),
        error_message: null,
      })
      .eq("delivery_method", "email")
      .eq("resend_email_id", resendEmailId);

    if (error) {
      console.error("[resend-webhook] Failed to mark sent:", error);
      return NextResponse.json(
        { error: "Failed to persist sent event" },
        { status: 500 },
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (FINAL_FAILED_EVENTS.has(eventType)) {
    const { error } = await supabaseAdmin
      .from("snaps")
      .update({
        delivery_status: "failed",
        error_message: `Resend webhook event: ${eventType}`,
      })
      .eq("delivery_method", "email")
      .eq("resend_email_id", resendEmailId)
      .or("delivery_status.is.null,delivery_status.neq.sent");

    if (error) {
      console.error("[resend-webhook] Failed to mark failed:", error);
      return NextResponse.json(
        { error: "Failed to persist failed event" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true, ignored: true }, { status: 200 });
}
