<div align="center">
  <img src="ReStrip_logo_v2.png" alt="ReStrip Logo" width="120" height="120">
  <h1>ReStrip</h1>
  <p><strong>Photo strips that come back to you.</strong></p>
  <p>
    <img src="https://img.shields.io/badge/status-archived-lightgrey" alt="Archived">
    <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js 16">
    <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript">
    <img src="https://img.shields.io/badge/Python-3.11-yellow" alt="Python">
    <img src="https://img.shields.io/badge/Supabase-PostgreSQL-green" alt="Supabase">
  </p>
</div>

---

## What is ReStrip?

Photo booths are one of the few physical things left in the digital age — a strip of four moments, held in your hand. I built ReStrip to honour that: upload your photo strip today, forget about it, and get it back as a surprise months later in your inbox.

ReStrip is a **time-delayed memory delivery platform**. Users upload photo strips that are encrypted and stored securely, then delivered as a surprise email or Telegram message on a future date they set — or let the platform choose for them. The result is a small, unexpected hit of nostalgia.

---

## How it Works

1. **Sign in** — Authenticate with Google or email via Clerk OAuth
2. **Upload** — Drag and drop a photo strip image
3. **Auto-crop** *(optional)* — AI-powered segmentation detects and isolates the strip
4. **Caption** — Write a note for your future self
5. **Schedule** — Choose a surprise window, a custom period, or a specific date
6. **Store** — Photo and caption are encrypted server-side and stored securely
7. **Receive** — Months later, a surprise email or Telegram message arrives
8. **Revisit** — View and organise delivered memories in the gallery or scrapbook editor

---

## Features

**Memory delivery** — Flexible scheduling (surprise me in 30–180 days, custom period, or pick an exact date). Delivery via Resend-powered email or a Telegram bot backed by Supabase Edge Functions.

**AI auto-crop** — An optional preprocessing step that isolates the photo strip from backgrounds, handles orientation correction, and applies perspective transforms. Originally built on YOLO11, later evolved to RF-DETR running on RunPod serverless GPU infrastructure.

**Gallery** — A paginated masonry view of all delivered memories with client-side IndexedDB caching to avoid redundant decryption round-trips.

**Scrapbook editor** — A drag-and-drop canvas editor (Fabric.js) where users arrange photo strips, text, and stickers into digital albums. Canvas state is serialised and encrypted before persistence.

**Security throughout** — AES-256-GCM server-side encryption for all images and captions, Clerk OAuth, Cloudflare Turnstile CAPTCHA, token bucket rate limiting, Content Security Policy with per-request nonces, and Row-Level Security on the database.

---

## Architecture

ReStrip is a full-stack Next.js application deployed on Vercel, backed by Supabase for storage and database, with a Python sidecar for AI image processing on RunPod.

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Shadcn UI, Radix UI |
| **Animations** | GSAP with ScrollTrigger, Fabric.js (scrapbook canvas) |
| **Backend** | Next.js API Routes (serverless / edge runtime), Supabase PostgreSQL |
| **Authentication** | Clerk (OAuth 2.0 — Google, email) |
| **Storage** | Supabase Storage (encrypted blobs) |
| **Encryption** | Web Crypto API — AES-256-GCM, server-side |
| **Delivery — email** | Resend API (scheduled sends + webhook tracking) |
| **Delivery — Telegram** | Supabase Edge Functions (Deno), Telegram Bot API |
| **AI processing** | RF-DETR (Python), RunPod serverless GPU, local FastAPI for dev |
| **Security** | Cloudflare Turnstile, token bucket rate limiter, CSP nonces, RLS |
| **Hosting** | Vercel (frontend + API), RunPod (GPU inference) |

**Data flow at a glance:**

```
User uploads image
  → POST /api/upload (Clerk auth verified)
  → [optional] POST /api/crop-image → RunPod RF-DETR → perspective-corrected PNG
  → Server encrypts image with AES-256-GCM (random IV per upload)
  → Encrypted blob stored in Supabase Storage
  → Snap record (with IV, schedule, delivery method) written to PostgreSQL

At scheduled time:
  → Supabase Edge Function cron wakes up
  → Queries snaps due for delivery
  → Server decrypts image
  → Sends via Resend (email) or Telegram Bot API
  → Marks snap as delivered
```

---

## Notable Engineering

### End-to-end encryption pipeline

Every image and caption is encrypted server-side using AES-256-GCM before it touches the database or storage. Each upload gets a random IV, so identical inputs produce different ciphertext. Keys never leave the server — the client only ever sees encrypted data or pre-signed URLs for already-delivered content. Decryption happens at delivery time, not at rest.

### AI auto-crop evolution

The photo strip detection pipeline started with YOLO11 (object detection) and evolved to RF-DETR (Recurrent Feature Dense Transformer) for better segmentation accuracy on varied backgrounds. The Python handler running on RunPod serverless GPU does more than detection: it applies perspective transforms to correct skew and rotation, extracts the alpha channel, and returns a clean PNG. A local FastAPI server mirrors the same interface for zero-cost development.

### Time-delayed delivery system

Delivery is a two-path system. Email delivery uses Resend's scheduled send API (supports up to 30 days ahead), with a webhook endpoint to track delivery status. Telegram delivery uses a Supabase Edge Function running on a cron schedule — it queries all snaps due in the current window, decrypts them, and sends via the Telegram Bot API. Both paths share the same scheduling logic in `src/lib/delivery-scheduling.ts`.

### Scrapbook editor

The scrapbook feature uses Fabric.js to provide a drag-and-drop canvas editor where users position photo strips, free text, and sticker assets. The entire canvas state (object positions, scales, rotations, content) is serialised to JSON, encrypted with AES-256-GCM, and stored in Supabase. Loading a page re-fetches, decrypts, and rehydrates the canvas — preserving exact layouts across sessions.

### Gallery caching

The gallery fetches memories in pages using SWR for data-fetching. To avoid re-decrypting images on every visit, decrypted image blobs are cached in the browser's IndexedDB keyed by snap ID and an ETag. Subsequent loads hit the cache instead of the API, significantly reducing server load and latency for users with large galleries.

### Security layers

Security is applied at multiple levels: Cloudflare Turnstile CAPTCHA on the upload endpoint to block bots, a token bucket rate limiter (5 uploads/minute/IP) implemented in-process, CSP headers with a per-request nonce generated in Clerk middleware, and Supabase Row-Level Security policies as a final backstop. Authentication is handled entirely by Clerk — the app never touches password hashing.

---

## Getting Started

Full setup instructions including prerequisites, environment variables, database migrations, and the Python AI pipeline are in [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md).

```bash
git clone https://github.com/bjh-developer/restrip.git
cd restrip && npm install
cp .env.local.example .env.local  # fill in your keys
npm run dev
```

---

## Contributors

| Contributor | GitHub |
|-------------|--------|
| Joon Hao | [@bjh-developer](https://github.com/bjh-developer) |
| Choco | [@Choco-Bloop](https://github.com/Choco-Bloop) |
| Naresh | [Nareshix](mailto:Nareshix66@gmail.com) |
| he | [wonghonern](mailto:wonghonern@gmail.com) |
| yanganyi | [@yanganyi](https://github.com/yanganyi) |

---

## License

No license has been added to this repository yet. If you intend to use or build on this code, please open an issue or reach out.
