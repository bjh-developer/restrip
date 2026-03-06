/**
 * restrip-memories — Supabase Edge Function (cron-triggered)
 *
 * Processes pending snap deliveries for both email (via Resend) and Telegram.
 *
 * Delivery state machine:
 *   pending → scheduling → scheduled  (email, future send)
 *                       ↘ sent        (email immediate, or Telegram)
 *                       ↘ failed      (error — retried on next invocation)
 *
 * Snaps whose send_time is more than 30 days away stay as "pending" until a
 * later invocation brings them inside the Resend scheduling window.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  encode as base64Encode,
  decode as base64Decode,
} from "https://deno.land/std@0.168.0/encoding/base64.ts";

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of snaps processed per invocation (prevents timeouts). */
const MAX_MEMORIES_TO_PROCESS = 50;

/**
 * Resend only supports scheduling up to 30 days ahead. Snaps whose send_time
 * is further out remain "pending" and are picked up by a later run once they
 * enter this window.
 */
const RESEND_SCHEDULING_WINDOW_DAYS = 30;

/** Resend REST endpoint for creating (and optionally scheduling) emails. */
const RESEND_API_URL = "https://api.resend.com/emails";

// =============================================================================
// Base64 / ArrayBuffer helpers
// =============================================================================

/** Convert a base64 string to an ArrayBuffer (required by the Web Crypto API). */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = base64Decode(base64);
  return bytes.buffer;
}

/** Convert a raw ArrayBuffer to a base64 string (used for email attachments). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return base64Encode(new Uint8Array(buffer));
}

// =============================================================================
// AES-GCM decryption utilities
// =============================================================================
// Images and captions are encrypted client-side with AES-256-GCM before upload.
// These helpers reconstruct plaintext using the ENCRYPTION_SECRET env var.

/**
 * Import a raw AES-256-GCM key from its base64 representation so the
 * Web Crypto API can use it for decryption.
 */
async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyBase64);
  return await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM", length: 256 },
    false,       // non-extractable — key is confined to this runtime instance
    ["decrypt"],
  );
}

/**
 * Core AES-GCM decryption.
 * All arguments are base64-encoded; returns raw plaintext as an ArrayBuffer.
 */
async function decryptData(
  encryptedBase64: string,
  ivBase64: string,
  keyBase64: string,
): Promise<ArrayBuffer> {
  const key = await importKey(keyBase64);
  const encrypted = base64ToArrayBuffer(encryptedBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  return await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    encrypted,
  );
}

/** Decrypt a caption string, returning UTF-8 plaintext. */
async function decryptCaption(
  encryptedCaption: string,
  captionIv: string,
  encryptionKey: string,
): Promise<string> {
  const decrypted = await decryptData(encryptedCaption, captionIv, encryptionKey);
  return new TextDecoder().decode(decrypted);
}

/** Decrypt an image, returning raw bytes ready to attach to an email or send to Telegram. */
async function decryptImage(
  encryptedImageBase64: string,
  imageIv: string,
  encryptionKey: string,
): Promise<Uint8Array> {
  const decrypted = await decryptData(encryptedImageBase64, imageIv, encryptionKey);
  return new Uint8Array(decrypted);
}

// =============================================================================
// Email helpers
// =============================================================================

/** Escape HTML special characters so user captions cannot inject markup. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Build the HTML body for the delivery email. Caption is optional. */
function buildEmailHtml(caption: string): string {
  const safeCaption = escapeHtml(caption || "");
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">A memory from your past 📸</h2>
      ${safeCaption ? `<p style="margin:0">${safeCaption}</p>` : "<p style=\"margin:0\">Your photostrip memory is attached.</p>"}
    </div>
  `;
}

/**
 * Create (and optionally schedule) an email via the Resend API.
 *
 * When `scheduledAt` is provided the email is queued for future delivery;
 * omitting it triggers an immediate send.
 * Returns the Resend email ID, which is persisted in the DB for tracking.
 */
async function scheduleEmailWithResend(
  to: string,
  imageBytes: Uint8Array,
  caption: string,
  scheduledAt?: string,
): Promise<string> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    throw new Error("RESEND_API_KEY not configured");
  }
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "ReStrip <onboarding@resend.dev>";
  // Resend expects attachments as base64-encoded strings.
  const imageBase64 = base64Encode(imageBytes);
  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject: "📸 A memory from your past!",
    html: buildEmailHtml(caption),
    attachments: [
      {
        filename: "memory.png",
        content: imageBase64,
      },
    ],
  };
  // Only include scheduled_at for future sends; omitting it triggers immediate delivery.
  if (scheduledAt) {
    payload.scheduled_at = scheduledAt;
  }
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Resend API error: ${JSON.stringify(json)}`);
  }
  return (json as { id?: string }).id ?? "unknown";
}

// =============================================================================
// Telegram helper
// =============================================================================

/**
 * Send the decrypted photostrip to a Telegram user via the Bot API (sendPhoto).
 *
 * Uses multipart/form-data so the image is streamed as binary rather than
 * base64-encoded in JSON — this is required by the Telegram sendPhoto endpoint.
 */
async function sendTelegramPhoto(
  chatId: number,
  imageBytes: Uint8Array,
  caption: string,
) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN not configured");
  }

  const telegramCaption = caption
    ? `A memory from your past! 🤗\n\n"${caption}"`
    : `A memory from your past! 🤗`;

  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  formData.append("photo", new Blob([imageBytes], { type: "image/png" }), "memory.png");
  formData.append("caption", telegramCaption);

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendPhoto`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}

// =============================================================================
// Main invocation handler
// =============================================================================

serve(async () => {
  try {
    // Service-role client bypasses Row Level Security so we can read/write all snaps.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const encryptionKey = Deno.env.get("ENCRYPTION_SECRET");
    if (!encryptionKey) {
      throw new Error("ENCRYPTION_SECRET not configured");
    }

    const now = new Date();
    const nowIso = now.toISOString();
    // Snaps stuck in "scheduling" for more than 10 minutes are considered stale
    // (e.g. a previous invocation crashed mid-flight) and will be recovered below.
    const staleSchedulingIso = new Date(
      now.getTime() - 10 * 60 * 1000,
    ).toISOString();

    // -------------------------------------------------------------------------
    // Step 1 — Recover stale locks
    // -------------------------------------------------------------------------
    // Recover snaps claimed ("scheduling") by a previous invocation that never
    // finished — reset to "pending" so they are retried on the next run.
    const { error: recoverError } = await supabase
      .from("snaps")
      .update({
        delivery_status: "pending",
        error_message: "Recovered stale scheduling lock",
      })
      .eq("delivery_method", "email")
      .eq("delivery_status", "scheduling")
      .is("resend_email_id", null)         // no email ID means Resend was never called
      .lt("updated_at", staleSchedulingIso);
    if (recoverError) {
      console.error("Failed to recover stale scheduling locks:", recoverError);
    }

    // -------------------------------------------------------------------------
    // Step 2 — Process email deliveries
    // -------------------------------------------------------------------------
    // Only pick up snaps whose send_time is within the 30-day Resend window;
    // snaps further out stay "pending" until a later run.
    const scheduleWindowEnd = new Date(
      now.getTime() + RESEND_SCHEDULING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const { data: emailCandidates, error: emailQueryError } = await supabase
      .from("snaps")
      .select("*")
      .eq("delivery_method", "email")
      .or("delivery_status.eq.pending,delivery_status.eq.failed,delivery_status.is.null")
      .is("resend_email_id", null)
      .lte("send_time", scheduleWindowEnd.toISOString())
      .limit(MAX_MEMORIES_TO_PROCESS);
    if (emailQueryError) throw emailQueryError;
    let emailsProcessed = 0;
    for (const strip of emailCandidates || []) {
      try {
        // Optimistic lock: transition snap to "scheduling" before any external calls.
        // If a concurrent invocation already claimed this snap the update matches 0 rows
        // and `claimed` will be null — we skip silently to avoid double-sending.
        const { data: claimed, error: claimError } = await supabase
          .from("snaps")
          .update({
            delivery_status: "scheduling",
            error_message: null,
          })
          .eq("id", strip.id)
          .is("resend_email_id", null)
          .or("delivery_status.eq.pending,delivery_status.eq.failed,delivery_status.is.null")
          .select("id")
          .single();

        if (claimError || !claimed) {
          continue;
        }

        const sendTime = new Date(strip.send_time);
        if (Number.isNaN(sendTime.getTime())) {
          throw new Error("Invalid send_time");
        }
        // Download the encrypted image blob from Supabase Storage.
        const { data: imageData, error: downloadError } = await supabase.storage
          .from("encrypted-images")
          .download(strip.storage_path);
        if (downloadError) {
          throw new Error(`Failed to download image: ${downloadError.message}`);
        }
        // Decrypt the image using the stored IV and the shared encryption key.
        const imageBuffer = await imageData.arrayBuffer();
        const encryptedImageBase64 = arrayBufferToBase64(imageBuffer);
        const decryptedImageBytes = await decryptImage(
          encryptedImageBase64,
          strip.image_iv,
          encryptionKey,
        );
        // Decrypt the caption if one was stored (captions are optional).
        let decryptedCaption = "";
        if (strip.encrypted_caption && strip.caption_iv) {
          decryptedCaption = await decryptCaption(
            strip.encrypted_caption,
            strip.caption_iv,
            encryptionKey,
          );
        }
        // Future send_time → schedule via Resend; past send_time → send immediately.
        const scheduledAt = sendTime > now ? sendTime.toISOString() : undefined;
        const resendEmailId = await scheduleEmailWithResend(
          strip.delivery_address,
          decryptedImageBytes,
          decryptedCaption,
          scheduledAt,
        );
        if (scheduledAt) {
          const { error: updateError } = await supabase
            .from("snaps")
            .update({
              delivery_status: "scheduled",
              resend_email_id: resendEmailId,
              resend_scheduled_at: scheduledAt,
              error_message: null,
            })
            .eq("id", strip.id);
          if (updateError) {
            throw new Error(`Failed to save scheduled state: ${updateError.message}`);
          }
          console.log(
            `📬 Scheduled email for strip ${strip.id} at ${scheduledAt} (Resend id: ${resendEmailId})`,
          );
        } else {
          const { error: updateError } = await supabase
            .from("snaps")
            .update({
              delivery_status: "sent",
              delivered_at: new Date().toISOString(),
              resend_email_id: resendEmailId,
              resend_scheduled_at: null,
              error_message: null,
            })
            .eq("id", strip.id);
          if (updateError) {
            throw new Error(`Failed to save sent state: ${updateError.message}`);
          }
          console.log(
            `✅ Sent email immediately for strip ${strip.id} (Resend id: ${resendEmailId})`,
          );
        }
        emailsProcessed += 1;
      } catch (deliveryError) {
        const message =
          deliveryError instanceof Error
            ? deliveryError.message
            : String(deliveryError);
        console.error(`❌ Failed to schedule email for strip ${strip.id}:`, message);
        await supabase
          .from("snaps")
          .update({
            delivery_status: "failed",
            error_message: message,
            retry_count: (strip.retry_count || 0) + 1,
          })
          .eq("id", strip.id);
      }
    }
    // -------------------------------------------------------------------------
    // Step 3 — Process Telegram deliveries
    // -------------------------------------------------------------------------
    // The Telegram Bot API has no native scheduling; only process snaps whose
    // send_time has already passed.
    const { data: telegramDue, error: telegramQueryError } = await supabase
      .from("snaps")
      .select("*")
      .eq("delivery_method", "telegram")
      .or("delivery_status.eq.pending,delivery_status.eq.failed,delivery_status.is.null")
      .lte("send_time", nowIso)
      .limit(MAX_MEMORIES_TO_PROCESS);

    if (telegramQueryError) throw telegramQueryError;

    let telegramProcessed = 0;

    for (const strip of telegramDue || []) {
      try {
        const { data: imageData, error: downloadError } = await supabase.storage
          .from("encrypted-images")
          .download(strip.storage_path);

        if (downloadError) {
          throw new Error(`Failed to download image: ${downloadError.message}`);
        }

        const imageBuffer = await imageData.arrayBuffer();
        const encryptedImageBase64 = arrayBufferToBase64(imageBuffer);

        const decryptedImageBytes = await decryptImage(
          encryptedImageBase64,
          strip.image_iv,
          encryptionKey,
        );

        let decryptedCaption = "";
        if (strip.encrypted_caption && strip.caption_iv) {
          decryptedCaption = await decryptCaption(
            strip.encrypted_caption,
            strip.caption_iv,
            encryptionKey,
          );
        }

        // The user must have started the bot (via the deep-link) for us to know
        // their chat_id. Without it we cannot deliver the message.
        if (!strip.telegram_chat_id) {
          throw new Error("User has not started the bot yet");
        }

        await sendTelegramPhoto(
          strip.telegram_chat_id,
          decryptedImageBytes,
          decryptedCaption,
        );

        await supabase
          .from("snaps")
          .update({
            delivery_status: "sent",
            delivered_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", strip.id);
        console.log(
          `✅ Sent Telegram photo for strip ${strip.id} to chat ${strip.telegram_chat_id}`,
        );
        telegramProcessed += 1;
      } catch (deliveryError) {
        const message =
          deliveryError instanceof Error
            ? deliveryError.message
            : String(deliveryError);
        console.error(`❌ Failed to send Telegram strip ${strip.id}:`, message);
        await supabase
          .from("snaps")
          .update({
            delivery_status: "failed",
            error_message: message,
            retry_count: (strip.retry_count || 0) + 1,
          })
          .eq("id", strip.id);
      }
    }

    // -------------------------------------------------------------------------
    // Step 4 — Return summary
    // -------------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        emailsProcessed,
        telegramProcessed,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    // Top-level catch — something failed before we could process any snaps.
    const message = error instanceof Error ? error.message : String(error);
    console.error("Function error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
