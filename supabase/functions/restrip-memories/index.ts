// supabase/functions/send-strips/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

function minifyHtml(html: string): string {
  return html
    .replace(/\n/g, "") // Remove newlines
    .replace(/[\t ]+</g, "<") // Remove spaces/tabs before tags
    .replace(/>[\t ]+/g, ">") // Remove spaces/tabs after tags
    .replace(/[\t ]+/g, " ") // Replace multiple spaces with single space
    .trim();
}

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

async function sendEmailWithGmail(
  to: string,
  snapId: string,
  imageBase64: string,
  caption: string,
) {
  // Create SMTP client per email to avoid connection issues
  const smtpClient = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: Deno.env.get("GMAIL_USER")!,
        password: Deno.env.get("GMAIL_APP_PASSWORD")!,
      },
    },
  });

  try {
    const emailHtml = minifyHtml(`
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif; background-color: #F3E8D8;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3E8D8;">
              <tr>
                  <td align="center" style="padding: 40px 20px;">
                      <table width="100%" maxwidth="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(28, 28, 28, 0.08);">
                          <tr>
                              <td align="center" style="padding: 40px 24px; background-color: #1C1C1C;">
                                  <div style="font-size: 32px; font-weight: 700; color: #F3E8D8; letter-spacing: -0.5px;">ReStrip</div>
                                  <div style="font-size: 14px; color: #EBEBEB; margin-top: 6px; font-weight: 300; letter-spacing: 0.5px;">Photo strips that come back to you.</div>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 48px 40px;">
                                  <p style="margin: 0 0 24px 0; font-size: 18px; color: #1C1C1C; line-height: 1.5; font-weight: 500;">A memory from your past! 🤗</p>
                                  ${caption ? `<p style="margin: 0 0 28px 0; font-size: 16px; color: #6B6B6B; line-height: 1.7; font-style: italic;">"${caption}"</p>` : ''}
                                  <p style="margin: 24px 0 0 0; font-size: 14px; color: #6B6B6B; text-align: center;">Your photo is attached to this email 📎</p>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 28px 40px; border-top: 1px solid #EBEBEB; background-color: #F3E8D8;">
                                  <p style="margin: 0 0 12px 0; font-size: 13px; color: #6B6B6B; text-align: center;">ReStrip by Joon Hao • Photo strips that come back to you.</p>
                                  <p style="margin: 0; font-size: 12px; color: #6B6B6B; text-align: center;">
                                      <a href="https://restrip.vercel.app/privacy-policy" style="color: #1C1C1C; text-decoration: none; font-weight: 500;">Privacy Policy</a> • 
                                      <a href="https://restrip.vercel.app/contact" style="color: #1C1C1C; text-decoration: none; font-weight: 500;">Contact Us</a>
                                  </p>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
          </table>
      </body>
      </html>
    `);

    await smtpClient.send({
      from: Deno.env.get("GMAIL_USER")!,
      to: to,
      subject: "📸 A memory from your past!",
      html: emailHtml,
      attachments: [
        {
          filename: "memory.png",
          content: imageBase64,
          encoding: "base64",
          contentType: "image/png",
        },
      ],
    });

    console.log(`✅ Sent email with image to ${to}`);
  } finally {
    // Always close the connection after sending
    await smtpClient.close();
  }
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
    ? `📸 A memory from your past!\n\n"${caption}"`
    : `📸 A memory from your past!`;

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

/**
 * Sends a Telegram message with a link to view the memory.
 * Used for authenticated (zero-knowledge) snaps that can't be decrypted server-side.
 */
async function sendTelegramLink(chatId: number, memoryLink: string) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN not configured");
  }

  const message =
    `📸 A memory from your past is ready!\n\n` +
    `Your encrypted memory is waiting for you. ` +
    `Sign in to decrypt and view it:\n\n` +
    `🔗 ${memoryLink}\n\n` +
    `🔐 Your memory is end-to-end encrypted — only you can view it.`;

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}

/**
 * Sends an email with a link to view the memory.
 * Used for authenticated (zero-knowledge) snaps that can't be decrypted server-side.
 */
async function sendEmailWithLink(
  to: string,
  snapId: string,
  memoryLink: string,
) {
  const smtpClient = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: Deno.env.get("GMAIL_USER")!,
        password: Deno.env.get("GMAIL_APP_PASSWORD")!,
      },
    },
  });

  try {
    const emailHtml = minifyHtml(`
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif; background-color: #F3E8D8;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3E8D8;">
              <tr>
                  <td align="center" style="padding: 40px 20px;">
                      <table width="100%" maxwidth="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(28, 28, 28, 0.08);">
                          <tr>
                              <td align="center" style="padding: 40px 24px; background-color: #1C1C1C;">
                                  <div style="font-size: 32px; font-weight: 700; color: #F3E8D8; letter-spacing: -0.5px;">ReStrip</div>
                                  <div style="font-size: 14px; color: #EBEBEB; margin-top: 6px; font-weight: 300; letter-spacing: 0.5px;">Photo strips that come back to you.</div>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 48px 40px; text-align: center;">
                                  <p style="margin: 0 0 16px 0; font-size: 18px; color: #1C1C1C; line-height: 1.5; font-weight: 500;">A memory from your past is ready! 📸</p>
                                  <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B6B6B; line-height: 1.6;">Your encrypted memory is waiting for you. Sign in to decrypt and view it.</p>
                                  <a href="${memoryLink}" style="display: inline-block; padding: 14px 32px; background-color: #1C1C1C; color: #F3E8D8; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">View Your Memory</a>
                                  <p style="margin: 24px 0 0 0; font-size: 13px; color: #6B6B6B;">🔐 End-to-end encrypted — only you can view it.</p>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 28px 40px; border-top: 1px solid #EBEBEB; background-color: #F3E8D8;">
                                  <p style="margin: 0 0 12px 0; font-size: 13px; color: #6B6B6B; text-align: center;">ReStrip by Joon Hao • Photo strips that come back to you.</p>
                                  <p style="margin: 0; font-size: 12px; color: #6B6B6B; text-align: center;">
                                      <a href="https://restrip.vercel.app/privacy-policy" style="color: #1C1C1C; text-decoration: none; font-weight: 500;">Privacy Policy</a> • 
                                      <a href="https://restrip.vercel.app/contact" style="color: #1C1C1C; text-decoration: none; font-weight: 500;">Contact Us</a>
                                  </p>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
          </table>
      </body>
      </html>
    `);

    await smtpClient.send({
      from: Deno.env.get("GMAIL_USER")!,
      to: to,
      subject: "📸 A memory from your past is ready!",
      html: emailHtml,
    });

    console.log(`✅ Sent email with link to ${to}`);
  } finally {
    await smtpClient.close();
  }
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

    // Get photo strips that are due to be sent
    const { data: dueStrips, error } = await supabase
      .from("snaps")
      .select("*")
      .or("delivery_status.eq.pending,delivery_status.eq.failed")
      // .lte("send_time", now)
      .limit(MAX_MEMORIES_TO_SEND); // Rate limiting

    if (error) throw error;

    console.log(`Found ${dueStrips?.length || 0} strips to send`);

    const APP_URL = Deno.env.get("APP_URL") || "https://restrip.vercel.app";

    // Send each photo strip
    for (const strip of dueStrips || []) {
      try {
        const isAuthenticated = !!strip.user_id;

        if (isAuthenticated) {
          // =====================================================================
          // AUTHENTICATED SNAP: Send a link to /memory/[id]/auth (zero-knowledge)
          // Server cannot decrypt — user must log in and decrypt client-side
          // =====================================================================
          const memoryLink = `${APP_URL}/memory/${strip.id}/auth`;

          if (strip.delivery_method === "telegram") {
            if (!strip.telegram_chat_id) {
              throw new Error("User has not started the bot yet");
            }
            await sendTelegramLink(strip.telegram_chat_id, memoryLink);
            console.log(`✅ Sent Telegram link for strip ${strip.id} to chat ${strip.telegram_chat_id}`);
          } else {
            // Email delivery - validate address first
            if (!strip.delivery_address || strip.delivery_address.trim() === "") {
              throw new Error("Missing or invalid email address for email delivery");
            }
            // Basic email format validation
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strip.delivery_address)) {
              throw new Error(`Invalid email address format: ${strip.delivery_address}`);
            }
            await sendEmailWithLink(strip.delivery_address, strip.id, memoryLink);
            console.log(`✅ Sent email link for strip ${strip.id} to ${strip.delivery_address}`);
          }
        } else {
          // =====================================================================
          // ANONYMOUS SNAP: Decrypt server-side and send image directly
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

          // Convert to base64 for email attachment
          const imageBase64 = arrayBufferToBase64(decryptedImageBytes.buffer);

          if (strip.delivery_method === "telegram") {
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
          } else {
            // Email delivery - validate address first
            if (!strip.delivery_address || strip.delivery_address.trim() === "") {
              throw new Error("Missing or invalid email address for email delivery");
            }
            // Basic email format validation
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strip.delivery_address)) {
              throw new Error(`Invalid email address format: ${strip.delivery_address}`);
            }
            
            await sendEmailWithGmail(
              strip.delivery_address,
              strip.id,
              imageBase64,
              decryptedCaption,
            );

            console.log(`✅ Sent strip ${strip.id} with image to ${strip.delivery_address}`);
          }
        }

        // Mark as sent (works for both methods)
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
