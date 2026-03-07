/**
 * telegram-bot — Supabase Edge Function (webhook mode)
 *
 * Receives Telegram Bot API updates via HTTP POST and routes them through
 * grammY. The only command handled is /start, which processes deep-links
 * of the form:  t.me/<bot>?start=snap_{snapId}_{token}
 *
 * That deep-link is generated on the ReStrip web app and lets a user
 * associate their Telegram chat_id with a snap row in the database so that
 * the delivery worker can send the photostrip when send_time is reached.
 */
import { Bot } from "npm:grammy@1.39.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables — loaded at module start; bot token is required immediately.
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// Shared secret set during webhook registration to verify requests come from Telegram.
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN not set");
}
if (!WEBHOOK_SECRET) {
  throw new Error("TELEGRAM_WEBHOOK_SECRET not set");
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);
// Service-role client bypasses RLS so the bot can read/write any snap row.
const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

// bot.init() fetches bot metadata (username, id) from Telegram.
// Must be awaited at module level before any updates are dispatched.
await bot.init();

// =============================================================================
// /start command handler
// =============================================================================
// Handles deep-link activations: /start snap_{snapId}_{token}
// This is the only entry point for associating a Telegram chat with a snap.

bot.command("start", async (ctx) => {
  // ctx.match contains everything after "/start " in the incoming message.
  const startPayload = ctx.match;
  
  if (!startPayload || !startPayload.startsWith('snap_')) {
    return ctx.reply(
      '👋 Welcome to ReStrip!\n\n' +
      'To receive your photo strip memory, click the link from your ReStrip account.'
    );
  }

  // Parse snap_{id}_{token}: strip the "snap_" prefix, split on "_",
  // pop the last segment as the verification token, join the rest as the snap ID.
  const parts = startPayload.substring(5).split("_"); // remove "snap_" prefix
  if (parts.length < 2) {
    return ctx.reply(
      "❌ Invalid link format.\n\nPlease use the latest link from your ReStrip account."
    );
  }
  const token = parts.pop()!; // last segment is the token
  const snapId = parts.join("_"); // remaining segments form the id (UUIDs contain hyphens, not underscores, but be safe)
  const chatId = ctx.chat.id;

  try {
    // First verify the token matches
    const { data: snap, error: fetchError } = await supabase
      .from("snaps")
      .select("id, telegram_link_token, telegram_chat_id")
      .eq("id", snapId)
      .single();

    if (fetchError || !snap) {
      return ctx.reply(
        "❌ Could not find this memory.\n\nMake sure you're using the correct link from your ReStrip account."
      );
    }

    // Verify the token matches the one stored on the snap to prevent enumeration.
    if (!snap.telegram_link_token || snap.telegram_link_token !== token) {
      return ctx.reply(
        "❌ Invalid or expired link.\n\nPlease use the correct link from your ReStrip account."
      );
    }

    // Guard against duplicate linking: acknowledge without overwriting the existing chat_id.
    if (snap.telegram_chat_id) {
      return ctx.reply(
        "✅ This memory is already linked! You'll receive it when it's time."
      );
    }

    const { data, error } = await supabase
      .from("snaps")
      .update({ telegram_chat_id: chatId })
      .eq("id", snapId)
      .eq("telegram_link_token", token)
      .select()
      .single();

    if (error || !data) {
      console.error("Error linking snap:", error);
      return ctx.reply(
        "❌ Could not link this memory to your account.\n\n" +
          "Make sure you're using the correct link from your ReStrip account."
      );
    }

    await ctx.reply(
      "✅ Successfully linked!\n\n" +
        "You'll receive a surprise here soon!"
    );
  } catch (err) {
    console.error("Exception in start handler:", err);
    return ctx.reply("❌ Something went wrong. Please try again later.");
  }
});

// =============================================================================
// Webhook entry point
// =============================================================================
// Telegram sends all bot updates as POST to this URL.
// GET requests (e.g. uptime probes) receive a plain 200 OK.

Deno.serve(async (req) => {
  console.log('Request received:', req.method);
  
  if (req.method === "POST") {
    // Validate the shared secret set during webhook registration.
    // Rejects any request that did not originate from Telegram.
    const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secretToken !== WEBHOOK_SECRET) {
      console.error('Invalid secret token');
      return new Response('Unauthorized', { status: 401 });
    }
    
    try {
      const update = await req.json();
      console.log('Received update:', JSON.stringify(update));
      
      // Dispatch the update to the registered grammY command handlers.
      await bot.handleUpdate(update);
      
      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error("Error handling update:", err);
      // Always return 200 — a non-200 response causes Telegram to retry the
      // same update repeatedly, flooding the endpoint.
      return new Response('OK', { status: 200 });
    }
  }
  
  return new Response("OK");
});
