/**
 * Resend Email Delivery Service
 *
 * Decrypts a snap's image and caption, then sends an email with the
 * image attached via the Resend SDK.
 *
 * This module is used by:
 *   - /api/create-snap (immediate send after snap creation)
 *   - /api/send-memory (manual retry / webhook endpoint)
 *
 * TODO: Use Resend's `scheduledAt` parameter for delayed delivery.
 *       Resend supports scheduling up to 30 days in advance (ISO 8601).
 *       For snaps beyond 30 days, a cron/queue is needed to enqueue
 *       them within the 30-day window.
 *
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

// ---------------------------------------------------------------------------
// Singleton instances (created once at module load)
// ---------------------------------------------------------------------------

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

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "ReStrip <onboarding@resend.dev>";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SendResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Send a memory email for a given snap ID.
 *
 * 1. Fetches the snap record
 * 2. Downloads & decrypts the image from Supabase Storage
 * 3. Decrypts caption
 * 4. Sends email via Resend (React template + image attachment)
 * 5. Updates delivery_status in the database
 */
export async function sendMemoryEmail(snapId: string): Promise<SendResult> {
  console.log("[resend] sendMemoryEmail called for snapId:", snapId);
  const supabase = getSupabaseAdmin();
  const resend = getResend();
  console.log("[resend] Clients initialised, fetching snap...");

  // 1. Fetch snap ----------------------------------------------------------
  const { data: snap, error: fetchError } = await supabase
    .from("snaps")
    .select("*")
    .eq("id", snapId)
    .single();

  if (fetchError || !snap) {
    console.error("[resend] Snap not found:", fetchError);
    return { success: false, error: "Snap not found" };
  }

  if (snap.delivery_method !== "email") {
    return { success: false, error: "Delivery method is not email" };
  }

  if (snap.delivery_status === "sent") {
    return { success: true, emailId: "already-sent" };
  }

  try {
    // 2. Download encrypted image ------------------------------------------
    const { data: imageBlob, error: dlError } = await supabase
      .storage
      .from("encrypted-images")
      .download(snap.storage_path);

    if (dlError || !imageBlob) {
      throw new Error(`Failed to download image: ${dlError?.message}`);
    }

    const encryptionKey = getServerEncryptionKey();
    const imageBuffer = await imageBlob.arrayBuffer();
    const encryptedImageBase64 = arrayBufferToBase64(imageBuffer);

    // 3. Decrypt image -----------------------------------------------------
    const decryptedBuffer = await decryptData(
      encryptedImageBase64,
      snap.image_iv,
      encryptionKey,
    );
    const decryptedImageBase64 = arrayBufferToBase64(decryptedBuffer);

    // 4. Decrypt caption ---------------------------------------------------
    let caption = "";
    if (snap.encrypted_caption && snap.caption_iv) {
      const captionBuf = await decryptData(
        snap.encrypted_caption,
        snap.caption_iv,
        encryptionKey,
      );
      caption = new TextDecoder().decode(captionBuf);
    }

    // 5. Send via Resend ---------------------------------------------------
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [snap.delivery_address],
      subject: "📸 A memory from your past!",
      react: MemoryEmail({ caption }),
      attachments: [
        {
          filename: "memory.png",
          content: decryptedImageBase64,
        },
      ],
      // TODO: scheduledAt: snap.send_time,
    });

    if (emailError) {
      console.error("[resend] Send error:", emailError);

      await supabase
        .from("snaps")
        .update({
          delivery_status: "failed",
          error_message: emailError.message ?? JSON.stringify(emailError),
          retry_count: (snap.retry_count || 0) + 1,
        })
        .eq("id", snapId);

      return {
        success: false,
        error: emailError.message ?? "Resend send failed",
      };
    }

    // 6. Mark sent ---------------------------------------------------------
    await supabase
      .from("snaps")
      .update({
        delivery_status: "sent",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", snapId);

    console.log(
      `✅ [resend] Email sent for snap ${snapId} → ${snap.delivery_address} (id: ${emailResult?.id})`,
    );

    return { success: true, emailId: emailResult?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[resend] Unexpected error:", msg);

    // Mark failed in DB
    await supabase
      .from("snaps")
      .update({
        delivery_status: "failed",
        error_message: msg,
        retry_count: (snap.retry_count || 0) + 1,
      })
      .eq("id", snapId);

    return { success: false, error: msg };
  }
}
