import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  encode as base64Encode,
  decode as base64Decode,
} from "https://deno.land/std@0.168.0/encoding/base64.ts";


// memories > 30d are in database as pending, cron schedules them after they enter 30d window
// resend handles frm there

const MAX_MEMORIES_TO_PROCESS = 50;
const RESEND_SCHEDULING_WINDOW_DAYS = 30;
const RESEND_API_URL = "https://api.resend.com/emails";

// ===== Decryption utilities =====
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = base64Decode(base64);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return base64Encode(new Uint8Array(buffer));
}

async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyBase64);
  return await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

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

async function decryptCaption(
  encryptedCaption: string,
  captionIv: string,
  encryptionKey: string,
): Promise<string> {
  const decrypted = await decryptData(encryptedCaption, captionIv, encryptionKey);
  return new TextDecoder().decode(decrypted);
}

async function decryptImage(
  encryptedImageBase64: string,
  imageIv: string,
  encryptionKey: string,
): Promise<Uint8Array> {
  const decrypted = await decryptData(encryptedImageBase64, imageIv, encryptionKey);
  return new Uint8Array(decrypted);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailHtml(caption: string): string {
  const safeCaption = escapeHtml(caption || "");
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">A memory from your past 📸</h2>
      ${safeCaption ? `<p style="margin:0">${safeCaption}</p>` : "<p style=\"margin:0\">Your photostrip memory is attached.</p>"}
    </div>
  `;
}

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

serve(async () => {
  try {
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
        const sendTime = new Date(strip.send_time);
        if (Number.isNaN(sendTime.getTime())) {
          throw new Error("Invalid send_time");
        }
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
        const scheduledAt = sendTime > now ? sendTime.toISOString() : undefined;
        const resendEmailId = await scheduleEmailWithResend(
          strip.delivery_address,
          decryptedImageBytes,
          decryptedCaption,
          scheduledAt,
        );
        if (scheduledAt) {
          await supabase
            .from("snaps")
            .update({
              delivery_status: "scheduled",
              resend_email_id: resendEmailId,
              resend_scheduled_at: scheduledAt,
              error_message: null,
            })
            .eq("id", strip.id);
          console.log(
            `📬 Scheduled email for strip ${strip.id} at ${scheduledAt} (Resend id: ${resendEmailId})`,
          );
        } else {
          await supabase
            .from("snaps")
            .update({
              delivery_status: "sent",
              delivered_at: new Date().toISOString(),
              resend_email_id: resendEmailId,
              resend_scheduled_at: null,
              error_message: null,
            })
            .eq("id", strip.id);
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("Function error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});