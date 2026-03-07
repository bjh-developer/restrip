/**
 * Resend Email Delivery Service
 * @module lib/resend
 */

import { Resend } from "resend";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { MemoryEmail } from "../components/emails/MemoryEmail";
import {
  decryptData,
  arrayBufferToBase64,
  getServerEncryptionKey,
} from "./simple-encryption";

const RESEND_SCHEDULING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RESEND_MIN_SCHEDULE_AHEAD_MS = 5 * 60 * 1000;

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "ReStrip <onboarding@resend.dev>";

interface SnapRow {
  id: string;
  storage_path: string;
  image_iv: string;
  encrypted_caption: string | null;
  caption_iv: string | null;
  send_time: string;
  delivery_method: "email" | "telegram";
  delivery_address: string;
  delivery_status: string | null;
  retry_count: number | null;
  resend_email_id: string | null;
  resend_scheduled_at: string | null;
}

let _resend: Resend | null = null;
let _supabase: SupabaseClient | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase env vars are not set");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export interface SendResult {
  success: boolean;
  emailId?: string;
  status?: "sent" | "scheduled" | "deferred" | "already-sent" | "already-scheduled";
  error?: string;
}

export async function sendMemoryEmail(snapId: string): Promise<SendResult> {
  const supabase = getSupabaseAdmin();
  const snap = await fetchSnap(supabase, snapId);
  if (!snap.success) return snap.result;
  if (snap.row.delivery_status === "sent") {
    return { success: true, emailId: snap.row.resend_email_id ?? "already-sent", status: "already-sent" };
  }
  if (snap.row.delivery_status === "scheduled" && snap.row.resend_email_id) {
    return {
      success: true,
      emailId: snap.row.resend_email_id,
      status: "already-scheduled",
    };
  }
  try {
    const emailId = await deliverViaResend(snap.row);
    await markAsSent(supabase, snap.row.id, emailId);
    return { success: true, emailId, status: "sent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markAsFailed(supabase, snap.row.id, snap.row.retry_count ?? 0, message);
    return { success: false, error: message };
  }
}

export async function scheduleOrSendMemoryEmail(
  snapId: string,
): Promise<SendResult> {
  const supabase = getSupabaseAdmin();
  const snap = await fetchSnap(supabase, snapId);
  if (!snap.success) return snap.result;
  if (snap.row.delivery_status === "sent") {
    return { success: true, emailId: snap.row.resend_email_id ?? "already-sent", status: "already-sent" };
  }
  if (snap.row.delivery_status === "scheduled" && snap.row.resend_email_id) {
    return { success: true, emailId: snap.row.resend_email_id, status: "already-scheduled" };
  }
  const sendAt = new Date(snap.row.send_time);
  if (Number.isNaN(sendAt.getTime())) {
    const error = "Invalid send_time on snap";
    await markAsFailed(supabase, snap.row.id, snap.row.retry_count ?? 0, error);
    return { success: false, error };
  }
  const now = new Date();
  const latestDirectSchedule = new Date(now.getTime() + RESEND_SCHEDULING_WINDOW_MS);

  // long horizon ( > 30d )
  if (sendAt.getTime() > latestDirectSchedule.getTime()) {
    await supabase
      .from("snaps")
      .update({ delivery_status: "pending", error_message: null })
      .eq("id", snap.row.id);
    return { success: true, status: "deferred" };
  }
  const canSchedule = sendAt.getTime() > now.getTime() + RESEND_MIN_SCHEDULE_AHEAD_MS;
  try {
    const emailId = await deliverViaResend(
      snap.row,
      canSchedule ? sendAt.toISOString() : undefined,
    );
    if (canSchedule) {
      await markAsScheduled(supabase, snap.row.id, emailId, sendAt.toISOString());
      return { success: true, emailId, status: "scheduled" };
    }
    await markAsSent(supabase, snap.row.id, emailId);
    return { success: true, emailId, status: "sent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markAsFailed(supabase, snap.row.id, snap.row.retry_count ?? 0, message);
    return { success: false, error: message };
  }
}

async function fetchSnap(
  supabase: SupabaseClient,
  snapId: string,
): Promise<
  | { success: true; row: SnapRow }
  | { success: false; result: SendResult }
> {
  const { data, error } = await supabase
    .from("snaps")
    .select(
      "id, storage_path, image_iv, encrypted_caption, caption_iv, send_time, delivery_method, delivery_address, delivery_status, retry_count, resend_email_id, resend_scheduled_at",
    )
    .eq("id", snapId)
    .single();
  if (error || !data) {
    console.error("[resend] Snap not found:", error);
    return { success: false, result: { success: false, error: "Snap not found" } };
  }
  const row = data as SnapRow;
  if (row.delivery_method !== "email") {
    return {
      success: false,
      result: { success: false, error: "Delivery method is not email" },
    };
  }
  if (!row.delivery_address) {
    return {
      success: false,
      result: { success: false, error: "Missing delivery_address" },
    };
  }
  return { success: true, row };
}

async function decryptEmailPayload(snap: SnapRow): Promise<{
  caption: string;
  imageBase64: string;
}> {
  const supabase = getSupabaseAdmin();
  // Sanitize the storage path sourced from the database to prevent path traversal.
  // Remove any '../' or '..\ ' sequences and strip leading slashes.
  const safePath = snap.storage_path
    .replace(/\.\.[/\\]/g, "")
    .replace(/^[/\\]+/, "");
  if (!safePath || safePath !== snap.storage_path) {
    throw new Error(`Unsafe storage path rejected: ${snap.storage_path}`);
  }
  const { data: imageBlob, error: dlError } = await supabase
    .storage
    .from("encrypted-images")
    .download(safePath);
  if (dlError || !imageBlob) {
    throw new Error(`Failed to download image: ${dlError?.message}`);
  }
  const encryptionKey = getServerEncryptionKey();
  const imageBuffer = await imageBlob.arrayBuffer();
  const encryptedImageBase64 = arrayBufferToBase64(imageBuffer);
  const decryptedBuffer = await decryptData(
    encryptedImageBase64,
    snap.image_iv,
    encryptionKey,
  );
  let caption = "";
  if (snap.encrypted_caption && snap.caption_iv) {
    const captionBuf = await decryptData(
      snap.encrypted_caption,
      snap.caption_iv,
      encryptionKey,
    );
    caption = new TextDecoder().decode(captionBuf);
  }
  return {
    caption,
    imageBase64: arrayBufferToBase64(decryptedBuffer),
  };
}

async function deliverViaResend(
  snap: SnapRow,
  scheduledAt?: string,
): Promise<string> {
  const resend = getResend();
  const payload = await decryptEmailPayload(snap);
  const { data: emailResult, error: emailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [snap.delivery_address],
    subject: "📸 A memory from your past!",
    react: MemoryEmail({ caption: payload.caption }),
    attachments: [
      {
        filename: "memory.png",
        content: payload.imageBase64,
      },
    ],
    ...(scheduledAt ? { scheduledAt } : {}),
  });
  if (emailError) {
    throw new Error(emailError.message ?? JSON.stringify(emailError));
  }
  return emailResult?.id ?? "unknown";
}

async function markAsSent(
  supabase: SupabaseClient,
  snapId: string,
  emailId: string,
): Promise<void> {
  await supabase
    .from("snaps")
    .update({
      delivery_status: "sent",
      delivered_at: new Date().toISOString(),
      resend_email_id: emailId,
      resend_scheduled_at: null,
      error_message: null,
    })
    .eq("id", snapId);
}

async function markAsScheduled(
  supabase: SupabaseClient,
  snapId: string,
  emailId: string,
  scheduledAt: string,
): Promise<void> {
  await supabase
    .from("snaps")
    .update({
      delivery_status: "scheduled",
      resend_email_id: emailId,
      resend_scheduled_at: scheduledAt,
      error_message: null,
    })
    .eq("id", snapId);
}

async function markAsFailed(
  supabase: SupabaseClient,
  snapId: string,
  retryCount: number,
  message: string,
): Promise<void> {
  await supabase
    .from("snaps")
    .update({
      delivery_status: "failed",
      error_message: message,
      retry_count: retryCount + 1,
    })
    .eq("id", snapId);
}
