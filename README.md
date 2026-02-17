# 📸 ReStrip

**Photo strips that come back to you.**

A nostalgic memory platform that transforms your photostrips into emotional time capsules. Memories resurface when you least expect them, creating joy, nostalgia, and shared experiences.

![ReStrip Banner](ReStrip_logo_v2.png)

---

## ✨ What is ReStrip?

ReStrip is a time-delayed memory delivery platform. You upload a photostrip today, and we send it back to you months later via a beautiful surprise email.

**Core Loop:**

1. 🔐 **Sign In** — Create an account with Clerk authentication (Google, email, or other OAuth providers)
2. 📷 **Upload** — Take a photo of your photo strip or upload a digital one
3. ✨ **Auto-crop** — Optional AI-powered cropping (YOLO11 segmentation model)
4. 💬 **Caption** — Add a note for your future self
5. 📅 **Schedule** — Pick a future date (surprise me, custom period, or specific date)
6. 🔒 **Secure Storage** — Your photo and caption are securely encrypted and stored
7. 💌 **Receive** — Months later, get notified via email or Telegram
8. 👀 **View** — Authenticate to view your memory in the gallery or scrapbook

**That's it. That's the magic.**

---

## 🚀 Current Status

### ✅ Completed Features (Version 1.0)

**Authentication & Security:**

- ✅ **Clerk Authentication** — Modern OAuth with Google, email, and other providers
- ✅ **Session Management** — Secure sessions with middleware route protection
- ✅ **Server-Side Encryption** — AES-256-GCM encryption for secure data storage
- ✅ **Rate Limiting** — Protection against abuse with smart rate limiting
- ✅ **CAPTCHA Protection** — Turnstile CAPTCHA for upload endpoints

**Upload & Processing:**

- ✅ **Image Upload** — Drag & drop or click to upload
- ✅ **AI Auto-Crop** — YOLO11 segmentation model (RunPod serverless GPU or local FastAPI)
- ✅ **In-Memory Caching** — Cropped images cached to avoid re-processing
- ✅ **Image Preview** — Toggle between original and cropped versions
- ✅ **Switchable Backend** — Choose between local FastAPI or cloud RunPod for cropping
- ✅ **Storage Management** — Images securely stored in Supabase Storage

**User Experience:**

- ✅ **Period Picker** — Surprise me / Custom period / Specific date
- ✅ **Caption Input** — Add notes for your future self
- ✅ **Delivery Method** — Email or Telegram
- ✅ **Working Delivery** — Via Email or Telegram, triggered by a Cron job on Supabase, running Supabase's Edge Functions
- ✅ **Gallery View** — Browse and view all your delivered memories with smart caching
- ✅ **Scrapbook Feature** — Create digital photo albums with drag-and-drop layouts, stickers, and text
- ✅ **Memory Viewing** — Secure view interface for delivered memories
- ✅ **Form Validation** — Zod schemas with user-friendly error messages
- ✅ **Scroll Animations** — GSAP ScrollTrigger for smooth reveals
- ✅ **Responsive Design** — Mobile-first with Tailwind CSS

**Developer Experience:**

- ✅ **Next.js 16 App Router** — File-based routing with route groups
- ✅ **TypeScript** — Full type safety
- ✅ **Middleware** — Route protection and session validation
- ✅ **API Routes** — Backend endpoints for auth and processing
- ✅ **Technical Documentation** — Comprehensive docs for onboarding developers

### 🔄 In Progress


### 📋 Roadmap

**Phase 2: Memory Management** ✅ Completed

- ✅ Gallery view with paginated memory browsing
- ✅ View past and scheduled memories
- ✅ Digital scrapbook for organizing photo strips
- ✅ Drag-and-drop photo layouts with stickers and text

**Phase 3: Social & Discovery**

- [ ] Face detection and friend tagging (optional, privacy-respecting)
- [ ] Share memories with friends
- [ ] Social graph for connections

**Phase 4: Advanced Features**

- [ ] Mobile app (React Native)
- [ ] Advanced image processing (color enhancement, filters)
- [ ] Multiple delivery methods (push notifications, SMS)
- [ ] Premium features and monetization

---

## 🔐 Authentication & Security System

ReStrip implements a modern authentication and security architecture using **Clerk** for user management and **server-side encryption** for data protection.

### Authentication with Clerk

#### 🔑 Modern OAuth Authentication

- **Technology**: Clerk authentication platform
- **Methods Supported**: 
  - Google OAuth
  - Email/Password
  - Other OAuth providers (configurable)
- **Security**: Industry-standard OAuth 2.0 flows
- **Benefits**:
  - Fast and secure authentication
  - Social login support
  - Built-in security features (rate limiting, bot protection)
  - Easy user management
  - Session management and token refresh

#### 🛡️ Session Management

- **Middleware Protection**: Routes are protected using Clerk middleware
- **Session Verification**: API routes verify user identity with `auth()` from `@clerk/nextjs/server`
- **Automatic Token Refresh**: Sessions are automatically refreshed
- **Secure Cookies**: HttpOnly cookies for session tokens

### Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                     │
│                                                         │
│  1. User authenticates via Clerk (OAuth or email/pwd)  │
│  2. Clerk issues secure session token                  │
│  3. Token stored in secure HttpOnly cookie             │
│  4. User uploads photo and caption                     │
│  5. Data sent to server with session token             │
└─────────────────────────────────────────────────────────┘
                             ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│                    SERVER (Vercel/API)                  │
│                                                         │
│  1. Verify session token with Clerk                    │
│  2. Encrypt photo and caption (AES-256-GCM)            │
│  3. Store encrypted data in Supabase                   │
│  4. At delivery time: Decrypt and send to user         │
│                                                         │
│  ✅ Server encrypts data at rest                       │
│  ✅ Server controls encryption keys securely           │
│  ✅ Session tokens verified on every request           │
└─────────────────────────────────────────────────────────┘
```

### Security Features

✅ **Server-Side Encryption**: Data encrypted at rest using AES-256-GCM  
✅ **Secure Authentication**: OAuth 2.0 with Clerk  
✅ **Rate Limiting**: Smart rate limiting to prevent abuse  
✅ **CAPTCHA Protection**: Turnstile CAPTCHA on upload endpoints  
✅ **HTTPS Only**: All data transmission over secure connections  
✅ **Row-Level Security**: Database policies enforced via Supabase

### Implementation Details

**Libraries Used:**

- `@clerk/nextjs` — Authentication and session management
- Web Crypto API — Server-side encryption
- Supabase — Database and storage
- `zod` — Request validation and schema enforcement

**Key Files:**

- `src/proxy.ts` — Clerk middleware for route protection
- `src/lib/simple-encryption.ts` — Encryption utilities
- `src/lib/rate-limit.ts` — Rate limiting implementation
- `src/lib/turnstile.ts` — CAPTCHA verification
- `src/app/api/*` — API routes with Clerk auth verification

---

## 🛠️ Tech Stack

### Frontend

- **Next.js 16.0.10** — React framework with App Router and TypeScript
- **React 19.2.0** — UI library
- **Tailwind CSS** — Utility-first styling
- **Shadcn UI** — Component library (customized)
- **Radix UI** — Accessible UI primitives (Switch, Popover, Radio, etc.)
- **GSAP** — Professional animations (ScrollTrigger)
- **Lucide React** — Icon library
- **Zod 4.2.1** — Schema validation
- **date-fns** — Date manipulation

### Authentication & Security

- **@clerk/nextjs** — Modern OAuth authentication platform
- **Supabase** — Database and storage (authentication handled by Clerk)
- **Web Crypto API** — Server-side encryption (AES-256-GCM)
- **Turnstile** — CAPTCHA protection

### Backend

- **Next.js API Routes** — Serverless functions (Edge Runtime)
- **Supabase** — PostgreSQL database, auth, and storage
- **@supabase/ssr** — Server-side Supabase client
- **Vercel** — Hosting and deployment

### External Services

- **RunPod Serverless** — GPU-based AI image processing (optional, for cloud deployment)
- **Local Crop Server** — FastAPI server for local development (optional, zero cost)
- **UserJot** — Feedback and feature request widget
- **Vercel Analytics** — Usage analytics
- **Vercel Speed Insights** — Performance monitoring

### Image Processing (Python on RunPod)

- **Ultralytics YOLO11** — Object detection & segmentation for photostrip detection
- **PyTorch 2.1.0 + CUDA 11.8** — Deep learning inference
- **OpenCV** — Image processing & perspective transforms
- **NumPy 1.26.4** — Array operations
- **Pillow** — Image handling & format conversion
- **Docker** — Containerization

---

## 📁 Project Structure

```
restrip/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (protected)/            # Protected route group
│   │   │   ├── upload/
│   │   │   │   └── page.tsx        # Main upload form
│   │   │   ├── gallery/
│   │   │   │   └── page.tsx        # Browse all memories
│   │   │   ├── scrapbook/
│   │   │   │   ├── page.tsx        # Scrapbook list view
│   │   │   │   └── [bookId]/
│   │   │   │       └── page.tsx    # Scrapbook editor
│   │   │   ├── new/
│   │   │   │   └── page.tsx        # Create new content
│   │   │   ├── memory/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # View delivered memory
│   │   │   └── layout.tsx          # Protected layout with Clerk auth
│   │   ├── (misc)/                 # Miscellaneous pages
│   │   │   ├── contact/            # Contact page
│   │   │   └── privacy-policy/     # Privacy policy
│   │   ├── sign-in/                # Clerk sign-in page
│   │   ├── sign-up/                # Clerk sign-up page
│   │   ├── api/                    # Backend API routes
│   │   │   ├── create-snap/        # Create new memory
│   │   │   ├── crop-image/         # RunPod/FastAPI proxy for AI cropping
│   │   │   ├── upload/             # Upload data
│   │   │   │   └── authenticated/  # Authenticated upload
│   │   │   ├── snaps/
│   │   │   │   └── [id]/           # Fetch specific snap
│   │   │   ├── gallery/            # Gallery endpoints
│   │   │   │   ├── route.ts        # List memories
│   │   │   │   └── [id]/           # Get specific memory
│   │   │   ├── images/
│   │   │   │   └── [id]/           # Serve images with caching
│   │   │   └── scrapbook/          # Scrapbook API
│   │   │       └── books/          # Book CRUD operations
│   │   │           ├── route.ts    # List/create books
│   │   │           └── [bookId]/
│   │   │               ├── route.ts # Get/update/delete book
│   │   │               └── pages/  # Page CRUD operations
│   │   ├── page.tsx                # Landing page
│   │   └── layout.tsx              # Root layout (ClerkProvider)
│   ├── components/
│   │   ├── ui/                     # shadcn UI components
│   │   │   ├── input-group.tsx    # Input with prefix/suffix
│   │   │   └── skeleton.tsx       # Loading skeletons
│   │   ├── Masonry.tsx             # Gallery masonry layout
│   │   ├── Providers.tsx           # React Context providers
│   │   ├── PeriodPicker.tsx        # Date/period selection
│   │   ├── DeliveryMethodPicker.tsx
│   │   ├── ScrollReveal.tsx        # GSAP scroll animations
│   │   └── ShinyText.tsx           # Animated text effect
│   ├── hooks/
│   ├── lib/
│   │   ├── simple-encryption.ts    # Server-side encryption utils
│   │   ├── rate-limit.ts           # API rate limiting
│   │   ├── turnstile.ts            # CAPTCHA verification
│   │   ├── gallery-cache.ts        # Client-side gallery caching
│   │   ├── scrapbook-api.ts        # Scrapbook API client
│   │   ├── scrapbook-types.ts      # TypeScript types for scrapbook
│   │   ├── stickers.ts             # Sticker assets helper
│   │   ├── userjot.ts              # UserJot integration
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser Supabase client
│   │   │   └── server.ts           # Server Supabase client
│   │   ├── utils.ts                # General utilities (cn, etc.)
│   │   └── validators/
│   │       └── index.ts            # Zod schemas
│   ├── proxy.ts                    # Clerk middleware for route protection
│   └── types/
│       └── global.d.ts             # Global TypeScript types
├── components/ui/                   # Legacy shadcn UI location
├── public/                         # Static assets
│   └── stickers/                   # Scrapbook sticker assets
├── supabase/                       # Database migrations & Edge Functions
│   ├── migrations/                 # SQL migration files (010-015)
│   └── functions/                  # Edge Functions (delivery system)
├── runpod/                         # AI Image Processing (Python)
│   ├── handler.py                  # RunPod serverless handler (YOLO model)
│   ├── server.py                   # Local FastAPI server (dev alternative)
│   ├── requirements.txt            # Python dependencies
│   └── Dockerfile                  # Docker config
├── next.config.ts                  # Next.js configuration
├── tailwind.config.ts              # Tailwind CSS config
├── tsconfig.json                   # TypeScript config
├── package.json                    # Dependencies
├── TECHNICAL_DOCUMENTATION.md      # Full technical docs
└── README.md                       # This file
```

---

## 🎨 Brand & Design

**Tagline:** "Photo strips that come back to you."

**Color Palette:**

- Warm Beige: \`#F3E8D8\` (background)
- Soft Black: \`#1C1C1C\` (text)
- Blush Pink: \`#FFC9D1\` (primary CTA)
- Yellow Cream: \`#FFF2C9\` (hover state)
- Pastel Blue: \`#CFE7FF\` (accent)
- Grey: \`#6B7280\` (secondary text)

**Components:**

- Shadcn UI base
- Custom animations with GSAP
- Smooth scroll reveals
- Pinwheel loading spinner (128px, pastel-blue)

---

## 🔐 Security & Privacy

**Privacy Promise:**

**Privacy Philosophy:**

- ✅ **Server-Side Encryption** — Data encrypted at rest with AES-256-GCM
- ✅ **Secure Storage** — Encrypted photos stored in Supabase with strict access controls
- ✅ **No Third-Party Training** — Your photos are never used for AI training
- ✅ **Transparent Security** — Open about implementation and threat model
- ✅ **User Control** — You own your data (delete anytime)

**Security Implementation:**

- ✅ AES-256-GCM encryption (military-grade)
- ✅ OAuth 2.0 authentication via Clerk
- ✅ TLS/HTTPS everywhere (Vercel + RunPod + Supabase)
- ✅ Content Security Policy headers
- ✅ Rate limiting and CAPTCHA protection
- ✅ Row Level Security on Supabase
- ✅ Secure session management
- ✅ Secure API architecture with token verification

---

## 📈 Database Schema

### Current Schema (v2.0 - Clerk Migration)

```sql
-- Users managed by Clerk (external service)
-- User IDs are TEXT (Clerk user IDs) instead of UUID

-- Encrypted memories/snaps
CREATE TABLE public.snaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,                      -- Clerk user ID (TEXT, not UUID)

    -- Encrypted data
    storage_path TEXT NOT NULL,                 -- Supabase Storage path to encrypted image
    image_iv TEXT NOT NULL,                     -- Initialization vector for image

    -- Caption data (now plain text with optional encryption)
    caption TEXT,                               -- Caption text (encrypted at rest in DB)

    -- Metadata (not encrypted)
    delivery_method TEXT NOT NULL,              -- 'email' or 'telegram'
    delivery_address TEXT NOT NULL,             -- Email address or Telegram username
    telegram_chat_id BIGINT,                    -- Telegram chat ID for bot delivery
    telegram_link_token TEXT,                   -- Token for linking Telegram account
    scheduled_send_time TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_delivery_method CHECK (delivery_method IN ('email', 'telegram'))
);

-- Indexes for efficient queries
CREATE INDEX idx_snaps_user_id ON public.snaps(user_id);
CREATE INDEX idx_snaps_scheduled_send ON public.snaps(scheduled_send_time, delivered);
CREATE INDEX idx_snaps_delivery_status ON public.snaps(user_id, delivered);
CREATE INDEX idx_snaps_telegram_chat_id ON public.snaps(telegram_chat_id);

-- Row Level Security (simplified - API handles auth)
ALTER TABLE public.snaps ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (API validates Clerk auth before DB access)
CREATE POLICY "Service role full access"
    ON public.snaps
    USING (true)
    WITH CHECK (true);
```

```sql
-- Scrapbook / Digital Photo Albums
CREATE TABLE public.canvas_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,                      -- Clerk user ID
    title TEXT NOT NULL,
    cover_color TEXT NOT NULL,                  -- One of 10 preset colors
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.canvas_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.canvas_books(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    elements JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of page elements (images, text, stickers)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_page_number UNIQUE (book_id, page_number)
);

CREATE INDEX idx_canvas_books_user_id ON public.canvas_books(user_id);
CREATE INDEX idx_canvas_pages_book_id ON public.canvas_pages(book_id);
```

### Storage Buckets (Supabase Storage)

```sql
-- Encrypted images bucket
-- Images are stored encrypted with server-side key
CREATE BUCKET IF NOT EXISTS encrypted_images;

-- Storage structure: {user_id}/{snap_id}/image.png
-- Path stored in snaps.storage_path column

-- RLS policies for storage (simplified)
CREATE POLICY "Service role full access"
    ON storage.objects FOR ALL
    USING (bucket_id = 'encrypted_images');
```

---

## 🐛 Known Issues & Troubleshooting

### Common Setup Issues

**Issue**: Clerk authentication not working

- **Solution**: Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set correctly in `.env.local`
- **Root Cause**: Clerk requires valid API keys for authentication

**Issue**: Build fails with prerendering errors

- **Solution**: Add `export const dynamic = "force-dynamic"` to layouts using Clerk auth
- **Root Cause**: Client components with auth hooks cannot be prerendered

**Issue**: Database connection errors

- **Solution**: Check Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- **Root Cause**: Invalid or missing Supabase credentials

**Issue**: Image cropping not working

- **Solution**: Check `CROP_BACKEND` setting and verify RunPod/FastAPI credentials
- **Root Cause**: Cropping backend not configured or not running

### Browser Compatibility

**Authentication Support:**

- ✅ Chrome/Edge 90+ (Windows, macOS, Android)
- ✅ Safari 15+ (macOS, iOS)
- ✅ Firefox 90+
- ❌ Internet Explorer (not supported)

**Web Crypto API:**

- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ❌ IE 11 and older

### Performance Tips

1. **Enable auto-crop selectively**: AI processing takes 2-5 seconds
2. **Use local FastAPI for development**: Faster than RunPod for testing
3. **Optimize images before upload**: Smaller files = faster processing
4. **Clear browser cache periodically**: Prevents storage buildup

---

## 🎯 Project Goals & Metrics

**Current Focus (Q1 2026):**

- ✅ Migrate to Clerk authentication
- ✅ Implement server-side encryption architecture
- ✅ Complete gallery and scrapbook features
- ✅ Finish upload and storage integration
- ✅ Launch email and Telegram delivery systems
- 🎯 Get first 100 beta users
- 🎯 Validate core concept and user satisfaction

**Success Metrics:**

- **User Retention**: 50%+ of users create second memory
- **Delivery Success**: 95%+ messages delivered on time
- **Security**: Zero data breaches or leaks
- **Privacy**: 100% of uploaded data encrypted at rest
- **Performance**: < 3s image processing time
- **Satisfaction**: 4+ star average rating on feedback

**Long-term Vision:**

- Build the most trusted platform for private memories
- Enable 1M+ memories delivered annually
- Expand to social features while preserving privacy
- Mobile app for easier photo capture
- Premium features for power users

---

## 👥 Team

- **Bek Joon Hao** — Full-stack development, product design

---

## 📞 Support

- **Feature Requests:** [UserJot Board](https://restrip.userjot.com/)
- **Contact:** [/contact](/contact)
- **Issues:** [GitHub Issues](https://github.com/bjh-developer/restrip/issues)

---

## 💝 Acknowledgments

Inspired by photobooth culture and the magic of surprise. Built with love for nostalgia and privacy.

**Special Thanks:**

- The Next.js team for an amazing framework
- Supabase for making backend development accessible
- The WebAuthn/FIDO Alliance for modern authentication standards
- Ultralytics for YOLO11 and computer vision tools
- The open-source community

**Powered by:**

- [Next.js](https://nextjs.org/) — React framework
- [Supabase](https://supabase.com/) — Backend as a Service
- [SimpleWebAuthn](https://simplewebauthn.dev/) — WebAuthn library
- [Shadcn UI](https://ui.shadcn.com/) — Component library
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [Radix UI](https://www.radix-ui.com/) — Accessible primitives
- [GSAP](https://greensock.com/gsap/) — Professional animations
- [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) — AI image processing
- [RunPod](https://www.runpod.io/) — Serverless GPU compute
- [Vercel](https://vercel.com/) — Hosting and deployment

---

## 🚀 Getting Started for New Team Members

Welcome to the ReStrip team! This section will guide you through setting up your local development environment from scratch.

### Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Minimum Version | Download |
|------|-----------------|----------|
| **Node.js** | v18.0.0+ | [nodejs.org](https://nodejs.org/) |
| **npm** | v9.0.0+ | Comes with Node.js |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |
| **Docker** (optional) | Latest | [docker.com](https://www.docker.com/) - for RunPod local testing |

Verify your installations:

```bash
node --version   # Should be v18+
npm --version    # Should be v9+
git --version    # Any recent version
```

### Step 1: Clone the Repository

```bash
git clone https://github.com/bjh-developer/restrip.git
cd restrip
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including Next.js, React, Supabase clients, and UI libraries.

### Step 3: Set Up External Services

You'll need accounts for the following services:

#### A. Clerk (Required for Authentication)

1. Create a free account at [clerk.com](https://clerk.com/)
2. Create a new application
3. Navigate to **API Keys** to find your publishable and secret keys
4. Configure OAuth providers (Google, etc.) in the Clerk dashboard
5. Set redirect URLs to match your local development URL (e.g., `http://localhost:3000`)

#### B. Supabase (Required for Database & Storage)

1. Create a free account at [supabase.com](https://supabase.com/)
2. Create a new project
3. Navigate to **Settings > API** to find your project URL and keys
4. **Run database migrations** (see Step 5)

#### C. Photo Strip Crop Backend (Optional - choose one)

**Option 1: Local Crop Server (Recommended for Development)**

- Free, runs on your machine
- No RunPod account needed
- Requires YOLO model weights (`runpod/runs/segment/train/weights/best.pt`)

**Option 2: RunPod Serverless (For Production)**

1. Create an account at [runpod.io](https://www.runpod.io/)
2. Deploy the photostrip detection handler (see `runpod/DEPLOYMENT.md`)
3. Get your API key and endpoint ID from the RunPod dashboard

#### D. Turnstile CAPTCHA (Optional but Recommended)

1. Create an account at [cloudflare.com](https://www.cloudflare.com/)
2. Go to Turnstile in the dashboard
3. Create a new site and get your site key and secret key

### Step 4: Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your configuration. See `.env.local.example` for all available options and descriptions.

**Key Environment Variables:**

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

# Crop Backend Selection (Optional)
CROP_BACKEND=local                      # Use "local" for dev, "runpod" for production
LOCAL_CROP_URL=http://localhost:8000/crop  # Local crop server address

# RunPod Configuration (only needed if CROP_BACKEND=runpod)
RUNPOD_API_KEY=your-runpod-key
RUNPOD_ENDPOINT_ID=your-endpoint-id

# Encryption (Required)
# Generate with: openssl rand -base64 32
ENCRYPTION_SECRET=your-generated-secret

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

***For ENCRYPTION_SECRET and TELEGRAM_WEBHOOK_SECRET, generate your own secrets using: ```openssl rand -base64 32``` or ```openssl rand -hex 32```***

### Step 5: Set Up Supabase Database

Run the SQL migrations in order in your Supabase SQL Editor (**Dashboard > SQL Editor**):

| Step | Migration File | Purpose |
|------|----------------|---------|
| 1 | `supabase/migrations/001_passkey_auth.sql` | Core tables, RLS policies, storage bucket |
| 2 | `supabase/migrations/002_add_prf_salt_to_credentials.sql` | WebAuthn salt column |
| 3 | `supabase/migrations/003_delivery_status.sql` | Delivery tracking columns |
| 4 | `supabase/migrations/004_check_user_exists_rpc.sql` | User existence check RPC |
| 5 | `supabase/migrations/005_rpc_get_account_type.sql` | Account type lookup RPC |
| 6 | `supabase/migrations/006_consolidate_snap_image_urls.sql` | Consolidate image columns |
| 7 | `supabase/migrations/007_add_image_iv_to_snaps.sql` | Add image IV for decryption |
| 8 | `supabase/migrations/008_telegram_bot_integration.sql` | Telegram bot support |
| 9 | `supabase/migrations/009_add_key_wrapping.sql` | Cross-auth key wrapping |
| 10 | `supabase/migrations/010_gallery_rls_indexes.sql` | Gallery rls indexes |
| 11 | `supabase/migrations/011_clerk_migration.sql` | Clerk migration |
| 12 | `supabase/migrations/012_ensure_encryption_columns.sql` | Ensure encryption columns |
| 13 | `supabase/migrations/013_telegram_link_token.sql` | Telegram link token |
| 14 | `supabase/migrations/014_canvas_books.sql` | Canvas books |
| 15 | `supabase/migrations/015_rename_to_scrapbook.sql` | Rename to scrapbook |

**Verification queries:**

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('snaps', 'canvas_books', 'canvas_pages');

-- Verify snaps structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'snaps';

-- Confirm RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('snaps', 'canvas_books', 'canvas_pages');
```

### Step 6: Set Up Supabase Edge Functions (Optional - for Delivery System)

**Setting up Supabase Edge Functions for email/telegram functionality:**

1. In your Supabase project, go to Edge Functions > Deploy a new function > Via Editor
2. Replace the code inside with the code in supabase/functions/restrip-memories/index.ts (included in repo)
3. Rename the function name to "restrip-memories"
4. Click "deploy function"
5. Repeat steps 1-4 but with supabase/functions/telegram-bot/index.ts (included in repo)
   - **TAKE NOTE: for telegram-bot function, make sure to toggle OFF "Verify JWT with legacy secret" after you've deployed the function.**

**Configure Email Delivery (Optional):**

6. Create a new Gmail account for ReStrip testing purposes
7. Go to https://myaccount.google.com/apppasswords to create a Google App Password
8. In your Supabase project, go to Authentication > Email (under notifications) > SMTP Settings
9. Toggle on Enable Custom SMTP
10. Fill in:
    - Sender email address: (your Gmail address)
    - Sender name: ReStrip
    - Host: smtp.gmail.com
    - Port number: 465
    - Minimum interval per user: 5 seconds
    - Username: (your Gmail address)
    - Password: (your Google App Password)

**Configure Telegram Bot (Optional):**

11. Create a Telegram bot via [@BotFather](https://t.me/BotFather)
12. Get your bot token and username
13. Set webhook: `curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<FUNCTION_URL>/<BOT_TOKEN>"`
14. Verify: `curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"`

**Configure Edge Function Secrets:**

15. In your Supabase project, go to Edge Functions > Secrets
16. Add the following secrets:
    - `GMAIL_USER` → (your Gmail address)
    - `GMAIL_APP_PASSWORD` → (your Google App Password)
    - `BASE_URL` → (your app URL, e.g., http://localhost:3000)
    - `TELEGRAM_BOT_TOKEN` → (your bot token)
    - `TELEGRAM_WEBHOOK_SECRET` → (generate with `openssl rand -hex 32`)
    - `ENCRYPTION_SECRET` → (use the same one from .env.local)

**Set Up Cron Job:**

17. In your Supabase project, go to Integrations > Cron > Install Cron
18. Create a new job:
    - Name: restrip_memories
    - Schedule: `*/5 * * * *` (every 5 minutes)
    - Type: Supabase Edge Functions
    - Method: POST
    - Edge Function: restrip-memories
    - Timeout: 1000ms
    - HTTP Headers:
      - `Authorization: Bearer <SUPABASE_ANON_KEY>`
      - `Content-Type: application/json`
    - HTTP Request Body: `{"name":"Functions"}`
19. Click save cron job

### Step 7: Start the Crop Server (Optional)

If using **local crop backend** (recommended for development):

```bash
cd runpod
python server.py
```

This starts the FastAPI server on `http://localhost:8000/crop`. Leave it running in the background.

### Step 8: Start the Development Server

In a new terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see the ReStrip landing page!

### Step 9: Test Your Setup

1. **Sign in**: Click "Sign In" and authenticate with Clerk (Google OAuth or email/password)
2. **Test upload flow**: Navigate to `/upload` and try uploading an image
3. **Test AI cropping**: Upload an image with auto-crop enabled
4. **Test gallery**: View your memories at `/gallery`
5. **Test scrapbook**: Create a digital photo album at `/scrapbook`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Create production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint code linting || `python runpod/server.py` | Start local crop server (development) |

**Switching Crop Backends:**

```bash
# Use local server (development)
CROP_BACKEND=local npm run dev

# Use RunPod (production)
CROP_BACKEND=runpod npm run dev
```
### Troubleshooting Setup Issues

| Issue | Solution |
|-------|----------|
| `Module not found` errors | Delete `node_modules` and run `npm install` |
| Supabase connection fails | Verify env variables are set correctly |
| Passkey registration fails | Ensure `NEXT_PUBLIC_ALLOWED_RP_DOMAINS` includes `localhost` |
| Build/prerender errors | Add `export const dynamic = "force-dynamic"` to affected layouts |
| "Local crop server error" | Ensure `python server.py` is running in `runpod/` directory |
| Crop processing fails | Check `CROP_BACKEND` is set correctly (`local` or `runpod`) |
| "Connection refused" on localhost:8000 | Verify local server is running: `python runpod/server.py` |

For more detailed troubleshooting, see `TECHNICAL_DOCUMENTATION.md` Section 17.

---

## 🤝 Contributing

ReStrip is currently in active development. Contributions are welcome!

### Development Workflow

1. **Fork the repository** and clone your fork locally
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following our code standards
4. **Test thoroughly** - ensure builds pass and features work
5. **Commit with meaningful messages**:
   ```bash
   git commit -m "feat: add new awesome feature"
   ```
6. **Push and create a Pull Request**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Convention

We follow conventional commits:

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `style:` | Formatting, no code change |
| `refactor:` | Code restructuring |
| `test:` | Adding/fixing tests |
| `chore:` | Build, dependencies, tooling |

### Code Standards

- **TypeScript**: All code must be type-safe
- **ESLint**: Run `npm run lint` before committing
- **Formatting**: Use Prettier (config in `.prettierrc`)
- **Components**: Follow existing patterns in `src/components/`
- **API Routes**: Place in `src/app/api/` with proper error handling

### Areas for Contribution

| Area | Description |
|------|-------------|
| 🐛 **Bug fixes** | Check GitHub Issues for reported bugs |
| 📖 **Documentation** | Improve docs, add examples |
| 🎨 **UI/UX** | Enhance user interface and experience |
| ⚡ **Performance** | Optimize rendering, reduce bundle size |
| 🔒 **Security** | Security audits, vulnerability fixes |
| ♿ **Accessibility** | Improve ARIA support, keyboard navigation |
| 🧪 **Testing** | Add unit/integration tests |

### Before Contributing

1. **Read `TECHNICAL_DOCUMENTATION.md`** - Understand the architecture
2. **Check existing issues** - Avoid duplicate work
3. **Discuss major changes** - Open an issue first for big features
4. **Keep PRs focused** - One feature/fix per PR

---

## 🎬 The Vision

We live in a world where memories are fleeting, photo strips pile up, and feelings fade. ReStrip slows time down. You capture a moment today and, months later, it comes back to make you smile.

**ReStrip is a time machine for your happiest moments.**

---

**Photo strips that come back to you.** 📸✨

---

## ⭐ Star This Project

If you like ReStrip, please give it a star! It helps us reach more people and build a better product.

[![GitHub stars](https://img.shields.io/github/stars/bjh-developer/restrip?style=social)](https://github.com/bjh-developer/restrip)
