import { Bot } from "npm:grammy@1.39.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN not set");
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);
const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

// Initialize bot
await bot.init();

bot.command("start", async (ctx) => {
  const startPayload = ctx.match;
  
  if (!startPayload || !startPayload.startsWith('snap_')) {
    return ctx.reply(
      '👋 Welcome to ReStrip!\n\n' +
      'To receive your photo strip memory, click the link from your ReStrip account.'
    );
  }

  // Parse snap_{id}_{token} format
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

    if (!snap.telegram_link_token || snap.telegram_link_token !== token) {
      return ctx.reply(
        "❌ Invalid or expired link.\n\nPlease use the correct link from your ReStrip account."
      );
    }

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
        "📸 You'll receive a surprise here in this chat soon!"
    );
  } catch (err) {
    console.error("Exception in start handler:", err);
    return ctx.reply("❌ Something went wrong. Please try again later.");
  }
});

Deno.serve(async (req) => {
  console.log('Request received:', req.method);
  
  if (req.method === "POST") {
    // Verify secret token from Telegram
    const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (WEBHOOK_SECRET && secretToken !== WEBHOOK_SECRET) {
      console.error('Invalid secret token');
      return new Response('Unauthorized', { status: 401 });
    }
    
    try {
      const update = await req.json();
      console.log('Received update:', JSON.stringify(update));
      
      // Process the update with grammY
      await bot.handleUpdate(update);
      
      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error("Error handling update:", err);
      return new Response('OK', { status: 200 }); // Still return 200 to prevent Telegram retries
    }
  }
  
  return new Response("OK");
});