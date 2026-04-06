<div align="center">
  <img src="ReStrip_logo_v2.png" alt="ReStrip Logo" width="120" height="120">
  <h1>ReStrip Technical Documentation</h1>
  <p><em>Photo strips that come back to you.</em></p>
  <p><em>Last updated: 10 Mar 2026</em></p>
</div>

> **This project is archived.** ReStrip is no longer actively maintained or deployed. This documentation is preserved for reference and for anyone exploring the codebase.

This document provides comprehensive technical documentation for the ReStrip project. It's designed to help developers—especially those with beginner to intermediate web development experience—understand the entire codebase, architecture, and development workflow.

---

## Table of Contents

1. [Introduction & Project Overview](#1-introduction--project-overview)
2. [Getting Started](#2-getting-started)
3. [Architecture Overview](#3-architecture-overview)
4. [Frontend Deep Dive](#4-frontend-deep-dive)
5. [Backend Deep Dive](#5-backend-deep-dive)
6. [Authentication System](#6-authentication-system)
7. [Encryption System](#7-encryption-system)
8. [Database & Storage](#8-database--storage)
9. [AI Image Processing Pipeline](#9-ai-image-processing-pipeline)
10. [Supabase Edge Functions (Delivery System)](#10-supabase-edge-functions-delivery-system)
11. [API Routes Reference](#11-api-routes-reference)
12. [Component Library](#12-component-library)
13. [State Management](#13-state-management)
14. [Styling & Design System](#14-styling--design-system)
15. [Development Workflow](#15-development-workflow)
16. [Security Best Practices](#16-security-best-practices)
17. [Troubleshooting Guide](#17-troubleshooting-guide)

---

## 1. Introduction & Project Overview

### What is ReStrip?

ReStrip is a **time-delayed memory delivery platform** that allows users to upload photo strips today and receive them back months later via email or Telegram. The platform implements **server-side encryption** for secure data storage and uses **Clerk** for modern OAuth authentication.

### Key Features

- 🔐 **Server-Side Encryption**: Server-side AES-256-GCM encryption for data at rest
- 🔑 **Modern Authentication**: Clerk OAuth (Google, email, and more)
- 🖼️ **Gallery View**: Browse and organize all your delivered memories
- 📚 **Scrapbook**: Create digital photo albums with drag-and-drop layouts
- 🤖 **AI Auto-Crop**: YOLO11-powered photo strip detection
- 📅 **Flexible Scheduling**: Random surprise, custom period, or specific date
- 🎨 **Beautiful UX**: Smooth animations and responsive design
- 🔒 **Privacy-First**: No third-party data sharing or AI training

### Technology Philosophy

ReStrip prioritizes:

1. **Privacy**: User data is secured with encryption at rest
2. **Security**: Modern standards (OAuth 2.0, AES-256-GCM)
3. **User Experience**: Simple, delightful interactions
4. **Developer Experience**: Clean code, TypeScript, modern tooling
5. **Performance**: Fast, responsive, optimized

### Project Status

**Version**: 2.0  
**Status**: Archived — Core features complete (Gallery, Scrapbook). No longer actively maintained.

---

## 2. Getting Started

### Prerequisites

| Tool | Minimum Version | Download |
| ---- | --------------- | -------- |
| **Node.js** | v18.0.0+ | [nodejs.org](https://nodejs.org/) |
| **npm** | v9.0.0+ | Comes with Node.js |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |
| **Docker** *(optional)* | Latest | [docker.com](https://www.docker.com/) — for RunPod local testing |

Verify your installations:

```bash
node --version   # Should be v18+
npm --version    # Should be v9+
git --version    # Any recent version
```

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/bjh-developer/restrip.git
cd restrip
```

#### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including Next.js, React, Supabase clients, and UI libraries.

#### 3. Set Up External Services

You'll need accounts for the following services:

##### A. Clerk (Required for Authentication)

1. Create a free account at [clerk.com](https://clerk.com/)
2. Create a new application
3. Navigate to **API Keys** to find your publishable and secret keys
4. Configure OAuth providers (Google, etc.) in the Clerk dashboard
5. Set redirect URLs to match your local development URL (e.g., `http://localhost:3000`)

##### B. Supabase (Required for Database & Storage)

1. Create a free account at [supabase.com](https://supabase.com/)
2. Create a new project
3. Navigate to **Settings > API** to find your project URL and keys
4. **Run database migrations** (see Step 5)

##### C. Resend (Required for Email Delivery)

1. Create a free account at [resend.com](https://resend.com/)
2. Navigate to **API Keys** to create a new API key
3. Configure your sending domain or use Resend's testing domain
4. Set the from email address (e.g., `memories@yourdomain.com`)

##### D. Photo Strip Crop Backend (Optional — choose one)

**Option 1: Local Crop Server (Recommended for Development)**

- Free, runs on your machine
- No RunPod account needed
- Requires model weights (`runpod/runs/segment/train/weights/best.pt`)

**Option 2: RunPod Serverless (For Production)**

1. Create an account at [runpod.io](https://www.runpod.io/)
2. Deploy the photostrip detection handler (see `runpod/DEPLOYMENT.md`)
3. Get your API key and endpoint ID from the RunPod dashboard

##### E. Turnstile CAPTCHA (Optional but Recommended)

1. Create an account at [cloudflare.com](https://www.cloudflare.com/)
2. Go to Turnstile in the dashboard
3. Create a new site and get your site key and secret key

#### 4. Environment Variables Setup

Copy the example environment file and configure it:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration values:

```dotenv
# Clerk Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption (Required)
# Generate with: openssl rand -base64 32
ENCRYPTION_SECRET=your-generated-secret

# Resend Email Delivery (Required for email delivery)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL="ReStrip Memories <memories@restrip.app>"

# Crop Backend Selection (Optional)
CROP_BACKEND=local                         # Use "local" for dev, "runpod" for production
LOCAL_CROP_URL=http://localhost:8000/crop   # Local crop server address

# RunPod Configuration (only needed if CROP_BACKEND=runpod)
RUNPOD_API_KEY=your-runpod-key
RUNPOD_ENDPOINT_ID=your-endpoint-id

# Turnstile CAPTCHA (Optional but Recommended)
TURNSTILE_SECRET_KEY=your-turnstile-secret
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key

# Telegram Bot (Optional)
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=https://restrip.vercel.app
NEXT_PUBLIC_ALLOWED_ORIGINS=*.vercel.app
```

> For `ENCRYPTION_SECRET` and `TELEGRAM_WEBHOOK_SECRET`, generate your own secrets using: `openssl rand -base64 32` or `openssl rand -hex 32`

#### 5. Supabase Setup

**Run Database Migrations:**

Apply migrations from `supabase/migrations/` in order in your Supabase SQL Editor (**Dashboard > SQL Editor**):

> [!CAUTION]
> If you have existing data in the database, follow these steps before running migrations 020 and 021:
>
> 1. Run migration 020
> 2. Run `NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ENCRYPTION_SECRET=... npx tsx scripts/migrate-scrapbook-encryption.ts` in terminal
> 3. Run `SELECT COUNT(*) FROM scrapbook_books WHERE encrypted_title = '';` and `SELECT COUNT(*) FROM scrapbook_pages WHERE encrypted_elements = '';` in the Supabase SQL editor (both outputs must be 0)
> 4. Run migration 021

| Step | Migration File | Purpose |
| ---- | -------------- | ------- |
| 1 | `001_passkey_auth.sql` | Core tables, RLS policies, storage bucket |
| 2 | `002_add_prf_salt_to_credentials.sql` | WebAuthn salt column |
| 3 | `003_delivery_status.sql` | Delivery tracking columns |
| 4 | `004_check_user_exists_rpc.sql` | User existence check RPC |
| 5 | `005_rpc_get_account_type.sql` | Account type lookup RPC |
| 6 | `006_consolidate_snap_image_urls.sql` | Consolidate image columns |
| 7 | `007_add_image_iv_to_snaps.sql` | Add image IV for decryption |
| 8 | `008_telegram_bot_integration.sql` | Telegram bot support |
| 9 | `009_add_key_wrapping.sql` | Cross-auth key wrapping |
| 10 | `010_gallery_rls_indexes.sql` | Gallery RLS policies and indexes |
| 11 | `011_clerk_migration.sql` | **Clerk migration — core tables and policies** |
| 12 | `012_ensure_encryption_columns.sql` | Ensure encryption columns exist |
| 13 | `013_telegram_link_token.sql` | Telegram link token support |
| 14 | `014_canvas_books.sql` | Scrapbook tables (initial creation) |
| 15 | `015_rename_to_scrapbook.sql` | Rename canvas to scrapbook |
| 16 | `016_nonce.sql` | Nonce table for upload verification |
| 17 | `017_resend_schedule_tracking.sql` | Resend schedule metadata on snaps |
| 18 | `018_testing_workflow.sql` | Test GitHub Actions |
| 19 | `019_pending_uploads.sql` | Pending uploads for sign-up flow |
| 20 | `020_scrapbook_encrypt_and_rename.sql` | Rename scrapbook_book → scrapbook_books, add encrypted columns |
| 21 | `21_scrapbook_drop_plaintext.sql` | Drop plaintext title and elements columns |

**Note:** Migration 011 creates all core tables needed for the current system. Migrations 001–009 are legacy migrations for the old passkey authentication system and are not needed for fresh installs.

**Verification:**

After running migrations, verify with:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('snaps', 'scrapbook_books', 'scrapbook_pages');

-- Check snaps table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'snaps';

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('snaps', 'scrapbook_books', 'scrapbook_pages');
```

#### 6. Set Up Supabase Edge Functions (Optional — for Telegram Delivery)

Email delivery uses the Resend API directly. Edge Functions are only needed for Telegram delivery and scheduled memory checks.

1. In your Supabase project, go to **Edge Functions > Deploy a new function > Via Editor**
2. Paste the code from `supabase/functions/telegram-bot/index.ts`, name it `telegram-bot`, and deploy
   - **Important:** after deploying, toggle **OFF** "Verify JWT with legacy secret" for this function
3. Repeat with `supabase/functions/restrip-memories/index.ts`, name it `restrip-memories`

**Configure Telegram Bot:**

4. Create a bot via [@BotFather](https://t.me/BotFather) and get your bot token and username
5. Set webhook: `curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<FUNCTION_URL>/<BOT_TOKEN>"`
6. Verify: `curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"`

**Add Edge Function Secrets** (Supabase project > **Edge Functions > Secrets**):

- `BASE_URL` — your app URL (e.g., `http://localhost:3000`)
- `TELEGRAM_BOT_TOKEN` — your bot token
- `TELEGRAM_WEBHOOK_SECRET` — generate with `openssl rand -hex 32`
- `ENCRYPTION_SECRET` — same value as in `.env.local`

**Set Up Cron Job** (Supabase project > **Integrations > Cron > Install Cron**):

- Name: `restrip_memories`
- Schedule: `*/5 * * * *` (every 5 minutes)
- Type: Supabase Edge Functions, Method: POST
- Edge Function: `restrip-memories`, Timeout: 1000ms
- HTTP Headers: `Authorization: Bearer <SUPABASE_ANON_KEY>`, `Content-Type: application/json`
- HTTP Request Body: `{"name":"Functions"}`

#### 7. Start the Crop Server (Optional — Local Development)

If using the local crop backend:

```bash
cd runpod
python server.py
```

This starts the FastAPI server on `http://localhost:8000/crop`. Leave it running in the background while developing.

#### 8. Start the Development Server

```bash
npm run dev
# Open http://localhost:3000
```

**Switching crop backends:**

```bash
CROP_BACKEND=local npm run dev    # local FastAPI (development)
CROP_BACKEND=runpod npm run dev   # RunPod serverless (production)
```

#### 9. Test Your Setup

1. **Sign in** — Authenticate with Clerk (Google OAuth or email/password)
2. **Upload** — Navigate to `/upload` and try uploading an image
3. **AI crop** — Upload with auto-crop enabled and verify the crop server responds
4. **Gallery** — View memories at `/gallery`
5. **Scrapbook** — Create a digital photo album at `/scrapbook`

### Project Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Create production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint code linting |
| `python runpod/server.py` | Start local crop server (development) |

### Quick Reference for New Developers

Here's a quick mental map of how everything connects:

**User Journey:**

```
Sign Up (Clerk) → Upload Photo → Auto-Crop (optional) → Add Caption → Schedule → Encrypt (server) → Store → [Time Passes] → Deliver → View
```

**Key Files to Understand First:**

| File                                              | Purpose                               | Priority |
| ------------------------------------------------- | ------------------------------------- | -------- |
| `src/app/(protected)/upload/page.tsx`             | Main upload flow (start here!)        | ⭐⭐⭐   |
| `src/app/(protected)/gallery/page.tsx`            | Gallery view for browsing memories    | ⭐⭐⭐   |
| `src/app/(protected)/scrapbook/[bookId]/page.tsx` | Scrapbook editor with drag-and-drop   | ⭐⭐⭐   |
| `src/proxy.ts`                                    | Clerk middleware for route protection | ⭐⭐     |
| `src/lib/simple-encryption.ts`                    | Server-side encryption utilities      | ⭐⭐     |
| `src/lib/rate-limit.ts`                           | API rate limiting                     | ⭐⭐     |
| `src/lib/scrapbook-api.ts`                        | Scrapbook API client                  | ⭐⭐     |
| `runpod/handler.py`                               | AI image cropping                     | ⭐       |

**Data Flow Summary:**

1. **Upload**: Image → Server receives → Server-side encryption → Supabase Storage
2. **Store**: Encrypted metadata → Supabase Database (snaps table)
3. **Deliver**: Email via Resend API (immediate) / Telegram via Edge Function (cron)
4. **View**: Fetch data → Server decrypts → Display in gallery or scrapbook

---

## 3. Architecture Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph Client["CLIENT (Browser)"]
        UI["React UI<br/>Components"]
        ClerkUI["Clerk Auth<br/>Components"]
        Cache["Client Cache<br/>(Gallery)"]
        UI --> ClerkUI
        UI --> Cache
    end

    subgraph Server["NEXT.JS SERVER (Vercel)"]
        API["API Routes<br/>(/api/*)"]
        Middleware["Clerk Middleware<br/>(Auth Gate)"]
        Encrypt["Server Encryption<br/>Layer"]
        SSR["SSR Pages<br/>(Rendering)"]
        Middleware --> API
        API --> Encrypt
    end

    subgraph External["External Services"]
        Clerk["Clerk<br/>Authentication"]
        Supabase["Supabase<br/>Database + Storage"]
        RunPod["RunPod/FastAPI<br/>YOLO AI Cropping"]
    end

    Client -->|HTTPS| Server
    Server --> Clerk
    Server --> Supabase
    Server --> RunPod
```

### Technology Stack Layers

#### Frontend

- **Framework**: Next.js 16 with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **State**: React Context + Hooks
- **Animations**: GSAP + ScrollTrigger

#### Backend

- **Runtime**: Next.js API Routes (Serverless)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk OAuth
- **Email Delivery**: Resend API
- **External Services**: RunPod/FastAPI (AI processing)

#### Security

- **Encryption**: Web Crypto API (AES-256-GCM, server-side)
- **Authentication**: OAuth 2.0 via Clerk
- **Rate Limiting**: Custom rate limiter
- **CAPTCHA**: Turnstile protection on uploads

### Request Flow Example

### Request Flow Example

**User uploads a photo:**

```mermaid
sequenceDiagram
    actor User
    participant Client as Client Browser
    participant Clerk as Clerk Auth
    participant Server as Next.js API
    participant AI as AI Crop Service
    participant Supabase as Supabase DB

    User->>Client: 1. Authenticate with Clerk
    Client->>Clerk: 2. OAuth flow
    Clerk-->>Client: 3. Session token

    User->>Client: 4. Select image in dropzone
    Client->>Client: 5. Convert image to base64
    Client->>Server: 6. POST /api/crop-image<br/>(with session token)
    Server->>Clerk: 7. Verify session token
    Clerk-->>Server: 8. Token valid
    Server->>AI: 9. Forward image for AI processing
    AI->>AI: 10. YOLO11 detects & crops photo strip
    AI-->>Server: 11. Return cropped image (base64)
    Server-->>Client: 12. Return cropped image
    Client->>Client: 13. Cache cropped image

    User->>Client: 14. Fill form & click submit
    Client->>Server: 15. POST /api/create-snap<br/>(with session token)
    Server->>Clerk: 16. Verify session & get user ID
    Server->>Server: 17. Encrypt image + caption<br/>(AES-256-GCM)
    Server->>Supabase: 18. Store encrypted snap
    Supabase-->>Server: 19. Confirm storage
    Server->>Server: 20. Schedule delivery job
    Server-->>Client: 21. Success response
    Client-->>User: 22. Show success message
```

**Key Steps:**

- **Steps 1-3**: Clerk authentication
- **Steps 4-13**: Image upload and AI auto-crop
- **Steps 14-22**: Server-side encryption and secure storage

### Memory Viewing Flow

**User views a delivered memory:**

```mermaid
sequenceDiagram
    actor User
    participant Client as Client Browser
    participant Clerk as Clerk Auth
    participant Server as Next.js API
    participant Supabase as Supabase DB/Storage

    User->>Client: 1. Click link in delivery email
    Client->>Clerk: 2. Check authentication status

    alt Not authenticated
        Clerk->>Client: 3. Redirect to sign-in
        User->>Clerk: 4. Authenticate via OAuth
        Clerk-->>Client: 5. Session established
    end

    Client->>Server: 6. GET /api/gallery/[id]<br/>(with session token)
    Server->>Clerk: 7. Verify session & get user ID
    Server->>Supabase: 8. Query snaps table (user_id match)
    Supabase-->>Server: 9. Return snap metadata

    Server->>Server: 10. Decrypt caption with server key
    Server->>Supabase: 11. storage.download(storage_path)
    Supabase-->>Server: 12. Return encrypted image blob
    Server->>Server: 13. Decrypt image with server key + IV

    Server-->>Client: 14. Return decrypted data
    Client-->>User: 15. Display memory in gallery
```

**Key Steps:**

- **Steps 1-5**: Clerk authentication (if needed)
- **Steps 6-9**: Fetch snap metadata with auth verification
- **Steps 10-13**: Server-side decryption
- **Steps 14-15**: Display in gallery or scrapbook

---

## 4. Frontend Deep Dive

### Next.js App Router Structure

#### Route Groups

Route groups use parentheses `()` to organize files without affecting URLs.

```
app/
  upload/                     # Public upload flow (no auth required)
    page.tsx        → URL: /upload
    layout.tsx      → Upload-specific layout
  (protected)/                # Auth required (Clerk middleware)
    gallery/
      page.tsx        → URL: /gallery
    new/
      page.tsx        → URL: /new
    scrapbook/
      page.tsx        → URL: /scrapbook
      [bookId]/
        page.tsx      → URL: /scrapbook/[bookId]
    layout.tsx        → Protected layout with Clerk auth
  (misc)/
    contact/
      page.tsx        → URL: /contact
    privacy-policy/
      page.tsx        → URL: /privacy-policy
  sign-in/
    [[...sign-in]]/
      page.tsx        → URL: /sign-in
  sign-up/
    [[...sign-up]]/
      page.tsx        → URL: /sign-up
  page.tsx              → URL: / (landing page)
```

**Benefits:**

- Shared layouts for route groups
- Logical organization
- Clean URLs

#### Key Pages

**1. Landing Page** (`src/app/page.tsx`)

Landing page with product information and call-to-action.

**2. Upload Page** (`src/app/upload/page.tsx`)

Main application page with multi-step flow (public, no auth required):

1. Upload photo strip
2. Write caption
3. Select delivery period
4. Choose delivery method

**Key State:**

```typescript
const [originalImage, setOriginalImage] = useState<string>();
const [croppedImage, setCroppedImage] = useState<string>();
const [autoCropEnabled, setAutoCropEnabled] = useState(false);
const [scheduledSendTime, setScheduledSendTime] = useState<Date>();
const [caption, setCaption] = useState<string>("");
```

**Form Validation:**

Uses Zod for type-safe validation:

```typescript
const SnapSchema = z
  .object({
    Image: z.string().min(1, "Image is required"),
    Caption: z.string().min(1),
    sendTime: z.date(),
    deliveryMethod: z.enum(["email", "telegram"]),
    Delivery_Address: z.string().min(1),
  })
  .refine((data) => {
    if (data.deliveryMethod === "email") {
      return z.string().email().safeParse(data.Delivery_Address).success;
    }
    return data.Delivery_Address.startsWith("@");
  });
```

**3. Gallery Page** (`src/app/(protected)/gallery/page.tsx`)

Browse and view all delivered memories with smart caching.

**Features:**

- Paginated gallery with masonry layout
- Server-side decryption of captions and images
- Client-side caching via IndexedDB
- Responsive grid layout

**4. Scrapbook Editor** (`src/app/(protected)/scrapbook/[bookId]/page.tsx`)

Digital photo album editor with drag-and-drop layouts.

**Features:**

- Canvas-based editor (Fabric.js)
- Drag-and-drop images, text, and stickers
- Multiple pages per scrapbook
- Encrypted storage of scrapbook data

### Key Components

#### UI Components

**PeriodPicker.tsx**

Date/period selection component with three options:

- **Surprise Me**: Random 30-180 days
- **Custom Period**: Select days/months/years
- **Custom Date**: Calendar picker

**DeliveryMethodPicker.tsx**

Choose delivery method:

- **Email**: Enter email address
- **Telegram** (future): Enter @username

**ScrollReveal.tsx**

GSAP-powered scroll animation wrapper.

**Usage:**

```typescript
<ScrollReveal baseOpacity={0} enableBlur={true}>
  <p>This text animates on scroll</p>
</ScrollReveal>
```

**ShinyText.tsx**

Animated gradient text effect.

```typescript
<ShinyText
  text="Photo strips that come back to you."
  speed={15}
/>
```

#### Shadcn UI Components

Custom components in `src/components/ui/shadcn-io/`:

- **Dropzone**: File upload with drag-and-drop
- **Spinner**: Loading indicator (pinwheel variant)
- **Banner**: Dismissible announcements
- **Announcement**: Info pills

### Hooks

The application uses Clerk's built-in hooks for authentication state management:

- `useUser()` from `@clerk/nextjs` — Current user info
- `useAuth()` from `@clerk/nextjs` — Auth state and sign out

No custom hooks directory exists — authentication state is managed entirely by Clerk.

---

## 5. Backend Deep Dive

### Next.js API Routes

API routes are serverless functions in `src/app/api/`.

**Structure:**

- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Receive `NextRequest`, return `NextResponse`
- Run on Vercel Edge Runtime

**Example:**

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({ received: body });
}
```

### Key API Routes

**Note:** All passkey authentication endpoints (`/api/auth/passkey/*`) have been removed. Authentication is now handled entirely by Clerk.

#### `/api/crop-image`

**Purpose**: Proxy image to RunPod or local FastAPI for AI cropping

**Why a proxy?**

- ✅ Keeps API key secret (server-side only)
- ✅ Prevents key exposure to client
- ✅ Allows rate limiting
- ✅ Error handling layer

**Implementation:**

```typescript
export async function POST(request: NextRequest) {
  const { image } = await request.json();

  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;

  const url = `https://api.runpod.ai/v2/${endpointId}/runsync`;

  // Remove data URL prefix
  const base64Data = image.split(",")[1] || image;

  // Call RunPod
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: { image: base64Data } }),
  });

  const data = await response.json();

  return NextResponse.json({
    success: true,
    photostrip: data.output.photostrip,
  });
}
```

### Middleware

**Purpose**: Protect routes, manage sessions, and enforce Content Security Policy

**File**: `src/proxy.ts`

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/gallery(.*)",
  "/new(.*)",
  "/scrapbook(.*)",
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  // Generate fresh nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Set CSP header with nonce + strict-dynamic
  const cspHeader = [
    `default-src 'self'`,
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `connect-src 'self' https://*.supabase.co https://*.clerk.accounts.dev`,
    `frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com`,
    `frame-ancestors 'none'`,
  ].join("; ");

  const response = NextResponse.next({
    headers: { "x-nonce": nonce },
  });
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

---

## 6. Authentication System

### Overview

ReStrip uses **Clerk** for authentication, providing a modern OAuth-based authentication system with support for multiple providers and secure session management.

### Clerk Authentication

**Supported Methods:**

1. **Google OAuth** - Sign in with Google account
2. **Email/Password** - Traditional email and password authentication
3. **Other OAuth Providers** - Configurable in Clerk dashboard (GitHub, Discord, etc.)

**How it works:**

1. **Sign Up/Sign In:**
   - User clicks "Sign In" button
   - Clerk modal appears with authentication options
   - User selects their preferred method (Google, email, etc.)
   - Clerk handles the OAuth flow or credential verification
   - Session token issued and stored in secure HTTP-only cookie
2. **Session Management:**
   - Sessions automatically refreshed by Clerk
   - Token verified on every API request
   - `auth()` helper from `@clerk/nextjs/server` provides user ID
3. **Route Protection:**
   - Clerk middleware (`src/proxy.ts`) protects routes
   - Unauthorized users redirected to sign-in page
   - Public routes explicitly allowed

**Benefits:**

- ✅ Modern OAuth 2.0 security
- ✅ Built-in rate limiting and bot protection
- ✅ No password management complexity
- ✅ Social login support
- ✅ Automatic token refresh
- ✅ Easy user management dashboard

### Implementation Details

**Clerk Middleware (`src/proxy.ts`):**

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/gallery(.*)",
  "/new(.*)",
  "/scrapbook(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
  // Also generates CSP nonce per request (see Security section)
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**API Route Authentication:**

```typescript
import { auth } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  const { userId } = auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use userId to query/store data
  const snaps = await supabase.from("snaps").select("*").eq("user_id", userId);

  return Response.json(snaps);
}
```

**Client-Side User Access:**

```typescript
"use client";
import { useUser } from "@clerk/nextjs";

export function UserProfile() {
  const { user, isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Sign in required</div>;

  return <div>Hello, {user.firstName}!</div>;
}
```

### Migration from Passkey System

The current codebase has migrated from a passkey/WebAuthn authentication system to Clerk. Key changes:

- ❌ Removed: `passkey_credentials` table
- ❌ Removed: `webauthn_challenges` table
- ❌ Removed: WebAuthn API endpoints (`/api/auth/passkey/*`)
- ❌ Removed: Client-side authentication hooks (`useAuth`, `usePasskeySupport`)
- ❌ Removed: Account linking system
- ✅ Added: Clerk middleware for route protection
- ✅ Updated: User ID changed from UUID to TEXT (Clerk user IDs)
- ✅ Simplified: RLS policies now use service role (API handles auth)

---

## 7. Encryption System

### Server-Side Encryption

**Overview:**

ReStrip uses **server-side encryption** to protect user data at rest. Unlike the previous zero-knowledge approach, the server now manages encryption keys and handles encryption/decryption operations.

**Why the change:**

- Clerk authentication eliminates the need for client-side key management
- Simplified architecture and better user experience
- Server can safely manage encryption keys
- Enables features like server-side image processing and caching

### Encryption Flow

```mermaid
graph LR
    A["User Data"] --> B["Upload to<br/>Server"]
    B --> C["Server Encryption<br/>(AES-256-GCM)"]
    C --> D["Supabase Storage<br/>(Encrypted at Rest)"]

    style A fill:#fff2c9
    style B fill:#cfe7ff
    style C fill:#ffc9d1
    style D fill:#ebebeb
```

### Encryption Implementation

**Key Management:**

- Single server-side encryption key stored in `ENCRYPTION_SECRET` environment variable
- Key should be generated using: `openssl rand -base64 32`
- Key never exposed to client
- Key rotations require re-encryption of existing data

**Encrypt Data (`src/lib/simple-encryption.ts`):**

```typescript
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for AES-GCM

export function encrypt(text: string): { encrypted: string; iv: string } {
  const key = Buffer.from(process.env.ENCRYPTION_SECRET!, "base64");
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted + authTag.toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decrypt(encrypted: string, ivHex: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_SECRET!, "base64");
  const iv = Buffer.from(ivHex, "base64");

  const authTagLength = 16; // 128 bits
  const encryptedData = Buffer.from(encrypted, "base64");
  const authTag = encryptedData.slice(-authTagLength);
  const ciphertext = encryptedData.slice(0, -authTagLength);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}
```

**Usage in API Routes:**

```typescript
import { auth } from "@clerk/nextjs/server";
import { encrypt, decrypt } from "@/lib/simple-encryption";

export async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { caption, image } = await request.json();

  // Encrypt caption
  const { encrypted: encryptedCaption, iv: captionIv } = encrypt(caption);

  // Encrypt image (if needed)
  const { encrypted: encryptedImage, iv: imageIv } = encrypt(image);

  // Store encrypted data
  await supabase.from("snaps").insert({
    user_id: userId,
    caption: encryptedCaption,
    image_iv: imageIv,
    storage_path: await uploadEncryptedImage(encryptedImage),
  });

  return Response.json({ success: true });
}
```

### Security Features

✅ **AES-256-GCM**: Industry-standard authenticated encryption  
✅ **Random IVs**: Each encryption uses a unique initialization vector  
✅ **Authentication Tags**: Prevents tampering with encrypted data  
✅ **Server-Side Only**: Encryption key never sent to client  
✅ **Environment Variable**: Key stored securely, not in code

### Security Considerations

**Strengths:**

- Server can safely decrypt and process data when needed
- Simplified key management (no client-side key derivation)
- Enables server-side features (caching, processing, etc.)
- Auth tag ensures data integrity

**Limitations:**

- Not zero-knowledge (server can decrypt data)
- Requires trusting the server infrastructure
- Key compromise affects all encrypted data
- Key rotation requires re-encryption

**Best Practices:**

- Store `ENCRYPTION_SECRET` in secure environment variables (never in code)
- Rotate encryption keys periodically
- Use separate keys for different environments (dev, staging, prod)
- Monitor access to encrypted data
- Implement audit logging for decrypt operations

### Migration from Zero-Knowledge

The codebase has migrated from client-side zero-knowledge encryption to server-side encryption:

- ❌ Removed: `src/lib/encryption.ts` (client-side encryption utilities)
- ❌ Removed: Key derivation from passkeys (PRF)
- ❌ Removed: Password-based key derivation (PBKDF2)
- ❌ Removed: Key wrapping system
- ❌ Removed: Client-side key storage (sessionStorage)
- ✅ Added: `src/lib/simple-encryption.ts` (server-side encryption)
- ✅ Simplified: Single encryption key for all data
- ✅ Updated: Database schema (removed client-side encryption columns)

---

## 8. Database & Storage

### Supabase Database

**Technology**: PostgreSQL with Row Level Security (RLS)

### Complete Database Schema

**All database migrations are located in `supabase/migrations/` folder.**

Run the current migrations in order in your Supabase SQL Editor:

> [!CAUTION]
> If you have existing data in database, make sure to do the following steps before running migration 020 and 021
>
> 1. Run migration 020
> 2. Run `NEXT_PUBLIC_SUPABASE_URL=... \ SUPABASE_SERVICE_ROLE_KEY=... \ ENCRYPTION_SECRET=... \ npx tsx scripts/migrate-scrapbook-encryption.ts` in terminal
> 3. Run `SELECT COUNT(*) FROM scrapbook_books WHERE encrypted_title = '';` & `SELECT COUNT(*) FROM scrapbook_pages WHERE encrypted_elements = '';` in supabase sql editor (make sure output is 0 for both)
> 4. Run migration 021

| Step | Migration File                                             | Purpose                                                            |
| ---- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| 1    | `supabase/migrations/001_passkey_auth.sql`                 | Core tables, RLS policies, storage bucket                          |
| 2    | `supabase/migrations/002_add_prf_salt_to_credentials.sql`  | WebAuthn salt column                                               |
| 3    | `supabase/migrations/003_delivery_status.sql`              | Delivery tracking columns                                          |
| 4    | `supabase/migrations/004_check_user_exists_rpc.sql`        | User existence check RPC                                           |
| 5    | `supabase/migrations/005_rpc_get_account_type.sql`         | Account type lookup RPC                                            |
| 6    | `supabase/migrations/006_consolidate_snap_image_urls.sql`  | Consolidate image columns                                          |
| 7    | `supabase/migrations/007_add_image_iv_to_snaps.sql`        | Add image IV for decryption                                        |
| 8    | `supabase/migrations/008_telegram_bot_integration.sql`     | Telegram bot support                                               |
| 9    | `supabase/migrations/009_add_key_wrapping.sql`             | Cross-auth key wrapping                                            |
| 10   | `supabase/migrations/010_gallery_rls_indexes.sql`          | Gallery rls indexes                                                |
| 11   | `supabase/migrations/011_clerk_migration.sql`              | Clerk migration                                                    |
| 12   | `supabase/migrations/012_ensure_encryption_columns.sql`    | Ensure encryption columns                                          |
| 13   | `supabase/migrations/013_telegram_link_token.sql`          | Telegram link token                                                |
| 14   | `supabase/migrations/014_canvas_books.sql`                 | Scrapbook tables (initial)                                         |
| 15   | `supabase/migrations/015_rename_to_scrapbook.sql`          | Rename to scrapbook                                                |
| 16   | `supabase/migrations/016_nonce.sql`                        | Nonce Table for Upload Verification                                |
| 17   | `supabase/migrations/017_resend_schedule_tracking.sql`     | Resend Schedule Metadata on Snaps                                  |
| 18   | `supabase/migrations/018_testing_workflow.sql`             | Test GitHub Actions                                                |
| 19   | `supabase/migrations/019_pending_uploads.sql`              | Pending Uploads for Sign-Up Flow                                   |
| 20   | `supabase/migrations/020_scrapbook_encrypt_and_rename.sql` | Rename scrapbook_book to scrapbook_books and Add Encrypted Columns |
| 21   | `supabase/migrations/21_scrapbook_drop_plaintext.sql`      | Drop Plaintext Title and Elements Column                           |

**Tables Created:**

- `snaps` - User's encrypted memories with delivery metadata
- `scrapbook_books` - Scrapbooks with encrypted metadata
- `scrapbook_pages` - Scrapbook pages with encrypted elements
- `pending_uploads` - Temporary storage of memory metadata when user transfers from anonymous quick send to account-based memory delivery
- `upload_nonces` - Nonce table for upload verification (to facilitate turnstile)

**Storage Bucket:**

- `encrypted-images` - Storage for encrypted images

### Schema Explanation

**Important Note:** All tables now use `user_id TEXT` (Clerk user IDs) instead of UUID. This is a key change from the legacy passkey system where user IDs were UUIDs from Supabase Auth.

**snaps table:**

```sql
CREATE TABLE public.snaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,  -- Clerk user ID

    -- Encrypted data
    storage_path TEXT NOT NULL,  -- Supabase Storage path
    image_iv TEXT NOT NULL,      -- IV for image decryption
    caption TEXT,                -- Caption (encrypted at rest)

    -- Delivery metadata
    delivery_method TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    telegram_chat_id BIGINT,
    telegram_link_token TEXT,
    scheduled_send_time TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Key changes from legacy schema:

- Removed `encrypted_caption` and `caption_iv` columns
- Added plain `caption` column (encrypted at rest in DB)
- Added `telegram_link_token` for Telegram account linking
- Simplified RLS (service role handles all, API validates auth)

**scrapbook_books table:**

```sql
CREATE TABLE public.scrapbook_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    encrypted_title TEXT NOT NULL,    -- AES-256-GCM encrypted title
    title_iv TEXT NOT NULL,           -- IV for title decryption
    cover_color TEXT NOT NULL,        -- One of 10 preset colors
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Stores scrapbook albums. Each user can have multiple books. Titles are encrypted server-side.

**scrapbook_pages table:**

```sql
CREATE TABLE public.scrapbook_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.scrapbook_books(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    encrypted_elements TEXT NOT NULL,  -- AES-256-GCM encrypted JSONB
    elements_iv TEXT NOT NULL,         -- IV for elements decryption
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_page_number UNIQUE (book_id, page_number)
);
```

Stores individual pages in scrapbooks. `encrypted_elements` contains an AES-256-GCM encrypted JSON array of:

- Image elements (with position, size, rotation)
- Text elements (with content, styling, position)
- Sticker elements (with type, position, size)

**Row Level Security:**

RLS policies are simplified in the Clerk migration:

- Service role has full access
- API routes validate Clerk authentication before database access
- Database policies trust the service role (no user-level RLS)

This approach simplifies the architecture while maintaining security through API-level authentication.

### Storage Buckets

**encrypted-images bucket:**

- Stores encrypted photo strip images
- Images encrypted server-side before storage
- Path format: `{user_id}/{snap_id}/image.png`
- RLS policies allow service role full access (API handles auth)

---

## 9. AI Image Processing Pipeline

### RunPod Serverless

**Purpose**: GPU-accelerated AI image processing

**Why RunPod?**

- ✅ Serverless (pay per use)
- ✅ GPU access (CUDA)
- ✅ Fast inference
- ✅ Auto-scaling

### YOLO11 Model

**Purpose**: Detect and segment photo strips from images

**How it works:**

1. **Input**: Base64-encoded image
2. **Detection**: YOLO11 identifies photo strip in image
3. **Segmentation**: Creates mask of photo strip pixels
4. **Cropping**: Extracts photo strip with transparent background
5. **Straightening**: Applies perspective transform
6. **Orientation**: Ensures vertical (portrait) orientation
7. **Output**: Base64-encoded cropped image

### Handler Implementation

**File**: `runpod/handler.py`

**Key Functions:**

```python
def detect_crop_photostrip(image_data):
    # Decode base64 image
    image_bytes = base64.b64decode(image_data)
    img = Image.open(BytesIO(image_bytes))

    # Run YOLO11 prediction
    results = model.predict(source=img)

    # Extract first detection
    for r in results:
        img = np.copy(r.orig_img)

        # Get segmentation mask
        for c in r:
            contour = c.masks.xy[0].astype(np.int32)

            # Create binary mask
            mask = np.zeros(img.shape[:2], np.uint8)
            cv2.drawContours(mask, [contour], -1, 255, cv2.FILLED)

            # Isolate photo strip with transparent background
            isolated = np.dstack([img, mask])

            # Get bounding box
            x1, y1, x2, y2 = c.boxes.xyxy.cpu().numpy().squeeze().astype(np.int32)
            iso_crop = isolated[y1:y2, x1:x2]

    # Straighten using perspective transform
    straightened = straighten_transparent_crop(iso_crop)

    # Ensure vertical orientation
    final = ensure_vertical_orientation(straightened)

    # Encode to base64
    success, buffer = cv2.imencode('.png', final)
    photostrip_base64 = base64.b64encode(buffer.tobytes()).decode('utf-8')

    return { 'success': True, 'photostrip': photostrip_base64 }
```

**Straightening Algorithm:**

```python
def straighten_transparent_crop(iso_crop):
    # Extract alpha channel (transparency mask)
    alpha = iso_crop[:, :, 3]

    # Find contour of photo strip
    contours, _ = cv2.findContours(alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contour = max(contours, key=cv2.contourArea)

    # Get minimum area rectangle (handles rotation)
    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect)

    # Order corners: top-left, top-right, bottom-right, bottom-left
    rect_ordered = order_points(box.astype("float32"))

    # Calculate output dimensions
    (tl, tr, br, bl) = rect_ordered
    maxWidth = max(
        int(np.sqrt((br[0] - bl[0])**2 + (br[1] - bl[1])**2)),
        int(np.sqrt((tr[0] - tl[0])**2 + (tr[1] - tl[1])**2))
    )
    maxHeight = max(
        int(np.sqrt((tr[0] - br[0])**2 + (tr[1] - br[1])**2)),
        int(np.sqrt((tl[0] - bl[0])**2 + (tl[1] - bl[1])**2))
    )

    # Define destination points (perfect rectangle)
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")

    # Get perspective transform matrix
    M = cv2.getPerspectiveTransform(rect_ordered, dst)

    # Apply transform
    straightened = cv2.warpPerspective(
        iso_crop, M, (maxWidth, maxHeight),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0)  # Transparent border
    )

    return straightened
```

### Running RunPod Locally (Without Deployment)

For development and testing, you can run the RunPod handler locally without deploying to RunPod's cloud infrastructure.

#### Prerequisites

- **Python 3.10+**
- **pip** (Python package manager)
- **Model weights** at `runpod/runs/segment/train/weights/best.pt`

> **Note:** The YOLO model weights file is not included in the repository. Contact the team lead to obtain the trained model weights.

#### Step 1: Set Up Python Environment

```bash
# Navigate to runpod directory
cd runpod

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**For CPU-only systems** (no NVIDIA GPU), install PyTorch CPU version instead:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

#### Step 2: Create Test Input

Place a test image (e.g., a photo containing a photo strip) in `runpod/test_files/`:

```bash
# Create test directory if needed
mkdir -p test_files

# Copy your test image
cp /path/to/your/photostrip_image.jpg test_files/IMG_1287.JPG
```

Generate the test input JSON:

```bash
python create_test_input.py
```

This creates `test_input.json` with your base64-encoded image.

#### Step 3: Run the Handler Locally

```bash
python test_handler.py
```

**Expected output:**

```
🚀 Testing handler...

📊 Results:
  Success: True
  Dimensions: {'width': 1536, 'height': 3366}
  Base64 length: 2847293 characters

✅ Output saved to test_output.json
✅ Image saved to test_output.png
```

The cropped photo strip will be saved as `test_output.png`.

#### Step 4: Integrate with Local Next.js App

To use your local RunPod handler with the Next.js application, you have two options:

**Option A: Mock the RunPod API (Recommended for Development)**

Create a local API endpoint that mimics RunPod. Add to your `.env.local`:

```env
# Leave RunPod env vars empty to disable cloud processing
RUNPOD_API_KEY=
RUNPOD_ENDPOINT_ID=
```

Then modify the crop-image API route to call a local Python server or skip AI cropping during development.

**Option B: Run the Local FastAPI Server**

The project includes a ready-made FastAPI server for local development:

**File**: `runpod/server.py`

```bash
cd runpod
pip install -r requirements.txt
python server.py
```

This starts a FastAPI server on `http://localhost:8000` that mimics the RunPod API.

Configure your `.env.local` to use it:

```env
CROP_BACKEND=local
LOCAL_CROP_URL=http://localhost:8000/crop
```

#### Troubleshooting Local RunPod

| Issue                                                   | Solution                                        |
| ------------------------------------------------------- | ----------------------------------------------- |
| `ModuleNotFoundError: No module named 'ultralytics'`    | Run `pip install ultralytics`                   |
| `FileNotFoundError: runs/segment/train/weights/best.pt` | Obtain model weights from team lead             |
| CUDA out of memory                                      | Use CPU version of PyTorch or reduce image size |
| Slow inference on CPU                                   | Expected - GPU recommended for production       |

### Docker Configuration

**File**: `Dockerfile`

```dockerfile
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY runpod/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model weights
COPY runpod/runs/segment/train/weights/best.pt /app/runs/segment/train/weights/best.pt

# Copy handler and metrics scripts
COPY runpod/handler.py .
COPY runpod/metrics.py .

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run as non-root user for security
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser

CMD ["python", "-u", "handler.py"]
```

### Dependencies

**File**: `runpod/requirements.txt`

```
runpod==1.6.2
Pillow==10.4.0
numpy==1.26.4
opencv-python-headless==4.10.0.84
ultralytics>=8.0.0
torch>=2.0.0
torchvision>=0.15.0
```

---

## 10. Email & Telegram Delivery System

ReStrip uses **Resend API** for immediate email delivery and **Supabase Edge Functions** for Telegram delivery and scheduled checks.

### Email Delivery (Resend API)

**Implementation:** `src/lib/resend.ts`

Email delivery is now handled immediately via Resend API when a snap is created:

1. User creates a snap via `/api/create-snap` or `/api/upload/authenticated`
2. Server encrypts the image and caption
3. Server immediately sends email via Resend API with decrypted content
4. Email is delivered with the memory image as an attachment

**Key Features:**

- ✅ Immediate delivery (no cron job needed)
- ✅ React Email templates (`src/components/emails/MemoryEmail.tsx`)
- ✅ Image attachments supported
- ✅ Reliable delivery via Resend infrastructure

**Required Environment Variables:**

- `RESEND_API_KEY` - Your Resend API key
- `RESEND_FROM_EMAIL` - From email address (e.g., `memories@restrip.app`)

**Manual Retry Endpoint:**

```typescript
// POST /api/send-memory
// Body: { snapId: string }
```

Can be used to manually trigger or retry email delivery for a specific snap.

### Supabase Edge Functions Overview

| Function           | Location                               | Purpose                                                               |
| ------------------ | -------------------------------------- | --------------------------------------------------------------------- |
| `restrip-memories` | `supabase/functions/restrip-memories/` | Scheduled memory checks (legacy function, now primarily for Telegram) |
| `telegram-bot`     | `supabase/functions/telegram-bot/`     | Webhook handler for Telegram bot interactions                         |

### Memory Delivery Function (`restrip-memories`)

**File:** `supabase/functions/restrip-memories/index.ts`

This function now primarily handles:

1. Telegram delivery for scheduled memories
2. Fallback checks for any memories that need delivery
3. Updates delivery status in the database

**Note:** Email delivery has been moved to Resend API for immediate delivery.

**Deployment:**

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy restrip-memories
```

**Required Secrets (set in Supabase Dashboard > Edge Functions > Secrets):**

| Secret                      | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| `SUPABASE_URL`              | Your Supabase project URL                               |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin access)                         |
| `ENCRYPTION_SECRET`         | Server-side decryption key (base64-encoded AES-256 key) |
| `TELEGRAM_BOT_TOKEN`        | Telegram bot token from BotFather                       |
| `BASE_URL`                  | Your application URL                                    |

**Note:** Email delivery secrets (Gmail credentials) are no longer needed as email is handled by Resend API.

**Cron Job Setup:**

In your Supabase project, create a cron job to trigger the function periodically:

```sql
-- Run every 5 minutes
SELECT cron.schedule(
  'send-due-memories',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/restrip-memories',
    headers := '{"Authorization": "Bearer your-service-role-key"}'::jsonb
  );
  $$
);
```

### Telegram Bot Function (`telegram-bot`)

**File:** `supabase/functions/telegram-bot/index.ts`

This function handles Telegram bot webhooks for:

- `/start snap_<id>` - Links a user's Telegram chat to their memory for delivery

**Deployment:**

```bash
supabase functions deploy telegram-bot
```

**Required Secrets:**

| Secret                      | Description                            |
| --------------------------- | -------------------------------------- |
| `TELEGRAM_BOT_TOKEN`        | Bot token from @BotFather              |
| `TELEGRAM_WEBHOOK_SECRET`   | Random secret for webhook verification |
| `SUPABASE_URL`              | Your Supabase project URL              |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key                       |

**Setting Up the Telegram Bot:**

1. **Create the bot:**
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Send `/newbot` and follow the prompts
   - Save the bot token

2. **Set up the webhook:**

   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://your-project-ref.supabase.co/functions/v1/telegram-bot",
       "secret_token": "your-webhook-secret"
     }'
   ```

3. **Test the webhook:**
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

### Server-Side Encryption Key

For the delivery system to work, the server needs the `ENCRYPTION_SECRET` environment variable to decrypt user memories before sending them.

**Generating the Key:**

```javascript
// Run this in a Node.js environment
const crypto = require("crypto");
const key = crypto.randomBytes(32); // 256 bits
const keyBase64 = key.toString("base64");
console.log("ENCRYPTION_SECRET:", keyBase64);
```

### Testing Edge Functions Locally

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test the function
curl -X POST http://localhost:54321/functions/v1/restrip-memories \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json"
```

### Monitoring and Debugging

- **Logs**: View in Supabase Dashboard > Edge Functions > Logs
- **Errors**: Check the `snaps.error_message` column for failed deliveries
- **Retry**: Failed deliveries are retried automatically (tracked in `snaps.retry_count`)

---

## 11. API Routes Reference

### Authentication

Authentication is handled by **Clerk** - no custom authentication endpoints needed. Use Clerk's built-in components and hooks:

- `<SignIn />` and `<SignUp />` components
- `useUser()`, `useAuth()` hooks on client
- `auth()` helper on server

### Image Processing

| Endpoint          | Method | Purpose                                 |
| ----------------- | ------ | --------------------------------------- |
| `/api/crop-image` | POST   | Proxy to RunPod/FastAPI for AI cropping |

**Request:**

```json
{
  "image": "base64-encoded-image"
}
```

**Response:**

```json
{
  "croppedImage": "base64-encoded-cropped-image"
}
```

### Memory Management

| Endpoint                    | Method | Purpose                                                |
| --------------------------- | ------ | ------------------------------------------------------ |
| `/api/create-snap`          | POST   | Create new memory (triggers immediate email)           |
| `/api/upload`               | POST   | Upload image (anonymous)                               |
| `/api/upload/authenticated` | POST   | Upload image (authenticated, triggers immediate email) |
| `/api/snaps/[id]`           | GET    | Get specific memory metadata                           |
| `/api/snaps/[id]`           | PATCH  | Update memory                                          |
| `/api/snaps/[id]`           | DELETE | Delete memory                                          |
| `/api/send-memory`          | POST   | Manual email delivery/retry                            |
| `/api/pending-upload`       | POST   | Track pending uploads for sign-up flow                 |
| `/api/resend/webhook`       | POST   | Resend email delivery webhook                          |
| `/api/stats`                | GET    | Usage statistics                                       |

**Send Memory Endpoint:**

```typescript
// POST /api/send-memory
// Body: { snapId: string }
// Response: { success: boolean, emailId?: string }
```

Used to manually trigger or retry email delivery for a specific snap.

### Gallery

| Endpoint            | Method | Purpose                              |
| ------------------- | ------ | ------------------------------------ |
| `/api/gallery`      | GET    | List all user's memories (paginated) |
| `/api/gallery/[id]` | GET    | Get specific memory details          |
| `/api/images/[id]`  | GET    | Serve image with caching             |

**Gallery list response:**

```json
{
  "snaps": [
    {
      "id": "uuid",
      "caption": "decrypted caption",
      "created_at": "timestamp",
      "delivered": boolean
    }
  ],
  "hasMore": boolean,
  "nextCursor": "string"
}
```

### Scrapbook

| Endpoint                                       | Method | Purpose                 |
| ---------------------------------------------- | ------ | ----------------------- |
| `/api/scrapbook/books`                         | GET    | List user's scrapbooks  |
| `/api/scrapbook/books`                         | POST   | Create new scrapbook    |
| `/api/scrapbook/books/[bookId]`                | GET    | Get scrapbook details   |
| `/api/scrapbook/books/[bookId]`                | PUT    | Update scrapbook        |
| `/api/scrapbook/books/[bookId]`                | DELETE | Delete scrapbook        |
| `/api/scrapbook/books/[bookId]/pages`          | GET    | List pages in scrapbook |
| `/api/scrapbook/books/[bookId]/pages`          | POST   | Create new page         |
| `/api/scrapbook/books/[bookId]/pages/[pageId]` | GET    | Get page details        |
| `/api/scrapbook/books/[bookId]/pages/[pageId]` | PUT    | Update page elements    |
| `/api/scrapbook/books/[bookId]/pages/[pageId]` | DELETE | Delete page             |

**Page elements structure:**

```json
{
  "elements": [
    {
      "type": "image",
      "id": "unique-id",
      "src": "image-url",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 300,
      "rotation": 0
    },
    {
      "type": "text",
      "id": "unique-id",
      "content": "text content",
      "x": 50,
      "y": 50,
      "fontSize": 16,
      "color": "#000000"
    },
    {
      "type": "sticker",
      "id": "unique-id",
      "stickerType": "cloud",
      "x": 150,
      "y": 200,
      "width": 100,
      "height": 100
    }
  ]
}
```

**All authenticated endpoints:**

- Require Clerk session token in cookie
- Return 401 if unauthorized
- Validate user ownership of resources

---

## 12. Component Library

### Base UI Components

From `components/ui/`:

- **Button** - Customizable button with variants
- **Input** - Text input field
- **Label** - Form label
- **Textarea** - Multi-line text input
- **Switch** - Toggle switch
- **Select** - Dropdown select
- **RadioGroup** - Radio button group
- **Calendar** - Date picker calendar
- **Card** - Content container
- **Separator** - Visual divider
- **Popover** - Floating content
- **Badge** - Status indicator

### Custom UI Components

From `src/components/ui/shadcn-io/`:

- **Dropzone** - File upload with drag-and-drop
- **Spinner** - Loading indicator
- **Banner** - Dismissible announcement banner
- **Announcement** - Info pill
- **Choicebox** - Selection component

### Feature Components

From `src/components/`:

- **PeriodPicker** - Date/period selection for memory scheduling
- **DeliveryMethodPicker** - Email/Telegram selection
- **ScrollReveal** - GSAP scroll animation wrapper
- **ShinyText** - Animated gradient text
- **Masonry** - Gallery masonry layout for photos
- **Providers** - Global context providers (ClerkProvider, etc.)

---

## 13. State Management

### Authentication State (Clerk)

Clerk handles authentication state globally:

**Client-side usage:**

```typescript
"use client";
import { useUser, useAuth } from "@clerk/nextjs";

function MyComponent() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useAuth();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <SignInButton />;

  return (
    <div>
      <p>Hello, {user.firstName}!</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

**Server-side usage:**

```typescript
import { auth, currentUser } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = auth();
  const user = await currentUser();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    userId,
    email: user?.emailAddresses[0]?.emailAddress,
  });
}
```

### Local State (useState)

Each component manages its own state:

```typescript
// Upload page state
const [originalImage, setOriginalImage] = useState<string>();
const [croppedImage, setCroppedImage] = useState<string>();
const [autoCropEnabled, setAutoCropEnabled] = useState(false);
const [caption, setCaption] = useState("");
const [scheduledSendTime, setScheduledSendTime] = useState<Date>();
```

### Form State

**Controlled Components:**

```typescript
<Textarea
  value={caption}
  onChange={(e) => setCaption(e.target.value)}
/>
```

**Validation with Zod:**

```typescript
const schema = z.object({
  caption: z.string().min(1, "Caption required"),
  email: z.string().email("Invalid email"),
});

const result = schema.safeParse(formData);
if (!result.success) {
  // Show errors
}
```

### Client-Side Caching

**Gallery Cache** (`src/lib/gallery-cache.ts`):

```typescript
// Cache gallery images to avoid re-fetching
const cache = new Map<string, { data: any; timestamp: number }>();

export function getCachedData(key: string) {
  const cached = cache.get(key);
  if (!cached) return null;

  // Check if cache is still valid (5 minutes)
  const age = Date.now() - cached.timestamp;
  if (age > 5 * 60 * 1000) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

export function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}
```

**Benefits:**

- Reduces API calls
- Improves perceived performance
- Automatic cache invalidation

---

## 14. Styling & Design System

### Tailwind CSS

**Configuration**: `tailwind.config.ts`

**Custom Colors:**

```typescript
colors: {
  'blush-pink': { DEFAULT: '#FFC9D1', hover: '#FFB3BD' },
  'soft-black': '#1C1C1C',
  'warm-beige': '#F3E8D8',
  'grey': '#6B6B6B',
  'pastel-blue': '#CFE7FF',
  'mist-grey': '#EBEBEB',
  'yellow-cream': '#FFF2C9',
}
```

**Custom Fonts:**

```typescript
fontFamily: {
  display: ['var(--font-display)', 'serif'],  // Playfair Display
  body: ['var(--font-body)', 'sans-serif'],    // Inter
  caption: ['var(--font-caption)', 'cursive'], // Caveat
}
```

**Custom Shadows:**

```typescript
boxShadow: {
  card: '0 1px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  'card-hover': '0 3px 8px rgba(0, 0, 0, 0.09), 0 1px 3px rgba(0, 0, 0, 0.05)',
}
```

### CSS Variables

**File**: `src/styles/globals.css`

```css
@layer base {
  :root {
    --radius: 0.5rem;
    --background: 0 0% 100%;
    --foreground: 0 0% 11%;
    /* ... more variables */
  }
}
```

### Component Styling Patterns

**Using Tailwind Classes:**

```typescript
<button className="bg-blush-pink hover:bg-yellow-cream
                   transition-all rounded-md px-4 py-2
                   font-body font-semibold">
  Click Me
</button>
```

**Conditional Classes:**

```typescript
<div className={`border rounded-lg ${
  error ? 'border-red-500' : 'border-gray-200'
}`}>
  {/* content */}
</div>
```

**Using cn() Utility:**

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  isDisabled && "disabled-classes"
)}>
```

### Animations

**GSAP ScrollTrigger:**

```typescript
gsap.from(element, {
  opacity: 0,
  y: 50,
  scrollTrigger: {
    trigger: element,
    start: "top 80%",
    end: "top 50%",
    scrub: 1,
  },
});
```

**Tailwind Animations:**

```typescript
// In tailwind.config.ts
animation: {
  shine: 'shine 5s linear infinite',
}

// Usage
<span className="animate-shine">Text</span>
```

---

## 15. Development Workflow

### Development Setup

```bash
# Start dev server
npm run dev

# Start on different port
npm run dev -- -p 3001

# Build for production
npm run build

# Run production build locally
npm run start
```

### Code Quality

**ESLint:**

```bash
npm run lint
```

**Fix auto-fixable issues:**

```bash
npm run lint -- --fix
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add my feature"

# Push to remote
git push origin feature/my-feature

# Create Pull Request on GitHub
```

### Commit Message Convention

```
feat: add new feature
fix: fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add tests
chore: update dependencies
```

### Environment Management

**Local Development:**

- `.env.local` - Git-ignored, for local secrets

**Production:**

- Set env vars in Vercel dashboard

**Never commit:**

- API keys
- Database passwords
- Private keys

---

## 16. Security Best Practices

### For Developers

**1. Never Log Sensitive Data**

```typescript
// ❌ DON'T
console.log("Password:", password);
console.log("Encryption key:", key);

// ✅ DO
console.log("Login successful");
```

**2. Validate All Inputs**

```typescript
// Use Zod schemas
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const result = schema.safeParse(input);
```

**3. Use Prepared Statements**

```typescript
// Supabase handles this automatically
const { data } = await supabase.from("snaps").select().eq("user_id", userId); // Safe from SQL injection
```

**4. Sanitize User Input**

```typescript
// For display
const sanitized = DOMPurify.sanitize(userInput);
```

**5. Implement Rate Limiting**

```typescript
// In API routes (future)
if (await isRateLimited(request)) {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}
```

### For Users

**Security Guidance:**

- ⚠️ Never use on shared/public computers
- ⚠️ Sign out after use on non-personal devices
- ⚠️ Use latest browser versions
- ⚠️ Enable account linking for redundancy
- ⚠️ Understand data loss risk

### Content Security Policy

**File**: `src/proxy.ts` (dynamic, per-request nonce)

CSP is enforced via nonce-based policy generated in the Clerk middleware (`proxy.ts`), not as a static header in `next.config.ts`. This allows `'strict-dynamic'` script trust propagation.

Non-CSP security headers are set statically in `next.config.ts`:

```typescript
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }];
}
```

---

## 17. Troubleshooting Guide

### Common Issues

#### Authentication Issues

**Issue**: Clerk authentication not working

**Solutions:**

- Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set in `.env.local`
- Ensure Clerk application has correct redirect URLs configured
- Check that OAuth providers (Google, etc.) are enabled in Clerk dashboard

**Issue**: Protected routes accessible without auth

**Solutions:**

- Verify `src/proxy.ts` middleware is properly configured
- Check that the route is listed in `isProtectedRoute` matcher
- Ensure middleware matcher pattern includes the route

#### Build Issues

**Issue**: "Prerendering error"

**Solution:**
Add to layout:

```typescript
export const dynamic = "force-dynamic";
```

**Issue**: "Module not found"

**Solution:**

```bash
rm -rf node_modules package-lock.json
npm install
```

#### Encryption Issues

**Issue**: Server encryption not working

**Solutions:**

- Verify `ENCRYPTION_SECRET` is set in `.env.local`
- Check the key was generated with `openssl rand -base64 32`
- Ensure the key is the same across all environments that need to decrypt data

#### Database Issues

**Issue**: Supabase connection fails

**Solutions:**

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly in `.env.local`
- Confirm your Supabase project is active and the API keys haven't been rotated

#### Image Processing Issues

**Issue**: "Local crop server error"

**Solution:**
Ensure `python server.py` is running in the `runpod/` directory before starting the dev server.

**Issue**: Crop image fails

**Solutions:**

- Check `CROP_BACKEND` is set correctly (`local` or `runpod`)
- Check `RUNPOD_API_KEY` is set correctly
- Verify `RUNPOD_ENDPOINT_ID` is correct
- Check RunPod endpoint is running
- Test with smaller image (< 5MB)

**Issue**: "No photostrip in response"

**Causes:**

- Photo strip not detected in image
- Image quality too low
- Photo strip too small or obscured

**Solutions:**

- Use clearer photo
- Ensure photo strip is main object
- Try without auto-crop

#### Memory Viewing Issues

**Issue**: Cannot view memory in gallery

**Solutions:**

- Verify you're logged in with the correct Clerk account
- Check the memory ID is valid
- Ensure the snap belongs to your user account

**Issue**: Image won't load or shows corrupted data

**Causes:**

- Wrong encryption key being used (different `ENCRYPTION_SECRET`)
- IV (initialization vector) mismatch
- Corrupted storage data

**Solutions:**

- Ensure `ENCRYPTION_SECRET` is the same key used to encrypt the data
- Check `image_iv` matches the encrypted image
- Verify storage path in database matches actual file in Supabase Storage

### Debugging Tips

**1. Check Console Logs:**

```bash
# Browser console (F12)
# Look for errors, warnings

# Server logs (terminal running npm run dev)
# Look for API errors
```

**2. Enable Verbose Logging:**

```typescript
// In components
console.log("Auth state:", { isSignedIn, user });

// In API routes
console.log("Request body:", body);
console.log("Response:", data);
```

**3. Test in Different Browsers:**

- Chrome
- Safari (iOS/macOS)
- Firefox (latest version)

**4. Check Network Tab:**

- Inspect API calls
- Check request/response
- Look for CORS errors
- Verify status codes

**5. Clear Cache:**

```bash
# Clear Next.js cache
rm -rf .next

# Clear browser cache
# Ctrl+Shift+Delete (Chrome/Firefox)
# Cmd+Shift+Delete (Safari)
```

### Getting Help

1. Check existing GitHub Issues
2. Search this documentation
3. Check browser console errors
4. Create detailed bug report with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and OS version
   - Console errors
   - Screenshots if applicable

---

## Conclusion

This technical documentation covers the complete ReStrip codebase, from frontend React components to backend API routes, authentication, encryption, and AI image processing.

---

## 📞 Support

- **Feature Requests:** [UserJot Board](https://restrip.userjot.com/)
- **Contact:** [/contact](/contact)
- **Issues:** [GitHub Issues](https://github.com/bjh-developer/restrip/issues)
