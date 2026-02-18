import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// =============================================================================
// NOTE: Email delivery via Supabase Edge Function has been DEPRECATED
// Email delivery is now handled by Resend SDK via Next.js API routes:
// - /api/send-memory (immediate delivery, called at snap creation)
// - src/lib/resend.ts (shared email logic with React Email templates)
// 
// This Edge Function now ONLY handles TELEGRAM delivery via scheduled cron.
// =============================================================================

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

async function sendTelegramPhoto(
  chatId: number,
  snapId: string,
  imageBytes: Uint8Array,
  caption: string,
) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN not configured");
  }

  // Build caption with optional user caption
  const telegramCaption = caption 
    ? `A memory from your past! 🤗\n\n"${caption}"`
    : `A memory from your past! 🤗`;

  // Create form data to send photo as file
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

serve(async (req) => {
  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get encryption key
    const encryptionKey = Deno.env.get("ENCRYPTION_SECRET");
    if (!encryptionKey) {
      throw new Error("ENCRYPTION_SECRET not configured");
    }

    const now = new Date().toISOString();
    const MAX_MEMORIES_TO_SEND = 50;

    // ==========================================================================
    // TELEGRAM-ONLY DELIVERY
    // 
    // This Edge Function now ONLY handles Telegram delivery. Email delivery
    // has been moved to Next.js API routes using Resend SDK for immediate
    // delivery at snap creation time (see /api/send-memory and src/lib/resend.ts).
    // ==========================================================================
    const { data: dueStrips, error } = await supabase
      .from("snaps")
      .select("*")
      .eq("delivery_method", "telegram")
      .or("delivery_status.eq.pending,delivery_status.eq.failed,delivery_status.is.null")
      // .lte("send_time", now)  // TODO: Re-enable after beta testing
      .limit(MAX_MEMORIES_TO_SEND); // Rate limiting

    if (error) throw error;

    console.log(`Found ${dueStrips?.length || 0} strips to send`);

    // Send each photo strip
    for (const strip of dueStrips || []) {
      try {
        // =====================================================================
        // ALL SNAPS: Decrypt server-side and send image directly
        // Server-side encryption allows us to decrypt and send images
        // =====================================================================
        
        // Download encrypted image from storage
        const { data: imageData, error: downloadError } = await supabase.storage
          .from("encrypted-images")
          .download(strip.storage_path);

        if (downloadError) {
          throw new Error(`Failed to download image: ${downloadError.message}`);
        }

        // Read the encrypted image data as ArrayBuffer, then convert to base64
        const imageBuffer = await imageData.arrayBuffer();
        const encryptedImageBase64 = arrayBufferToBase64(imageBuffer);

        // Decrypt the image
        const decryptedImageBytes = await decryptImage(
          encryptedImageBase64,
          strip.image_iv,
          encryptionKey,
        );

        // Decrypt the caption if present
        let decryptedCaption = "";
        if (strip.encrypted_caption && strip.caption_iv) {
          decryptedCaption = await decryptCaption(
            strip.encrypted_caption,
            strip.caption_iv,
            encryptionKey,
          );
        }

        // Send via Telegram (only delivery method handled by this Edge Function)
        if (!strip.telegram_chat_id) {
          throw new Error("User has not started the bot yet");
        }

        await sendTelegramPhoto(
          strip.telegram_chat_id,
          strip.id,
          decryptedImageBytes,
          decryptedCaption,
        );

        console.log(
          `✅ Sent Telegram photo for strip ${strip.id} to chat ${strip.telegram_chat_id}`,
        );

        // Mark as sent
        await supabase
          .from("snaps")
          .update({
            delivery_status: "sent",
            delivered_at: new Date().toISOString(),
          })
          .eq("id", strip.id);
      } catch (deliveryError) {
        console.error(`❌ Failed to send strip ${strip.id}:`, deliveryError);

        // Mark as failed with error message
        await supabase
          .from("snaps")
          .update({
            delivery_status: "failed",
            error_message: deliveryError.message,
            retry_count: (strip.retry_count || 0) + 1,
          })
          .eq("id", strip.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: dueStrips?.length || 0,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
