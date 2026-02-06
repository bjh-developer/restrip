# 📸 ReStrip

**Photo strips that come back to you.**

A nostalgic memory platform that transforms your photostrips into emotional time capsules. Memories resurface when you least expect them, creating joy, nostalgia, and shared experiences.

![ReStrip Banner](ReStrip_logo_v2.png)

---

## ✨ What is ReStrip?

ReStrip is a time-delayed memory delivery platform. You upload a photostrip today, and we send it back to you months later via a beautiful surprise email.

**Core Loop:**

1. 🔐 **Sign In** — Create an account with passkey (biometric) or password authentication
2. 📷 **Upload** — Take a photo of your photo strip or upload a digital one
3. ✨ **Auto-crop** — Optional AI-powered cropping (YOLO11 segmentation model)
4. 💬 **Caption** — Add a note for your future self
5. 📅 **Schedule** — Pick a future date (surprise me, custom period, or specific date)
6. 🔐 **Encrypt** — Your photo and caption are encrypted _on your device_ before upload
7. 💌 **Receive** — Months later, get notified via email or Telegram
8. 👀 **Decrypt & View** — Authenticate to decrypt and view your memory

**That's it. That's the magic.**

---

## 🚀 Current Status

### ✅ Completed Features (Version 1.0)

**Authentication & Security:**

- ✅ **Passkey Authentication (WebAuthn/FIDO2)** — Passwordless sign-in with biometrics
- ✅ **Email/Password Authentication** — Traditional fallback with Supabase Auth
- ✅ **Account Linking** — Add both passkey and password to the same account
- ✅ **Zero-Knowledge Encryption** — AES-256-GCM encryption on client before upload
- ✅ **Encryption Key Derivation** — HKDF from passkey PRF (600,000 PBKDF2 iterations for passwords)
- ✅ **Key Wrapping System** — Cross-compatible encryption between passkey and password auth
- ✅ **Session Management** — Secure sessions with middleware route protection

**Upload & Processing:**

- ✅ **Image Upload** — Drag & drop or click to upload
- ✅ **AI Auto-Crop** — YOLO11 segmentation model (RunPod serverless GPU)
- ✅ **In-Memory Caching** — Cropped images cached to avoid re-processing
- ✅ **Image Preview** — Toggle between original and cropped versions
- ✅ **Client-Side Encryption** — Images encrypted in browser before transmission
- ✅ **Storage Management** — Encrypted images stored in Supabase Storage

**User Experience:**

- ✅ **Period Picker** — Surprise me / Custom period / Specific date
- ✅ **Caption Input** — Add notes for your future self
- ✅ **Delivery Method** — Email or Telegram
- ✅ **Working Delivery** — Via Email or Telegram, triggered by a Cron job on Supabase, running Supabase's Edge Functions.
- ✅ **Memory Viewing** — Secure decrypt and view interface for delivered memories
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

**Phase 2: Memory Management**

- [ ] User dashboard with encrypted memory vault
- [ ] View past and scheduled memories
- [ ] Edit/delete memories
- [ ] Memory canvas for organizing photo strips

**Phase 3: Social & Discovery**

- [ ] Face detection and friend tagging (optional, privacy-respecting)
- [ ] Share memories with friends (encrypted)
- [ ] Social graph for connections

**Phase 4: Advanced Features**

- [ ] Mobile app (React Native)
- [ ] Advanced image processing (color enhancement, filters)
- [ ] Multiple delivery methods (push notifications, SMS)
- [ ] Premium features and monetization

---

## 🔐 Authentication & Encryption System

ReStrip implements a **zero-knowledge encryption** architecture where the server never has access to your unencrypted photos. This is achieved through a combination of modern authentication methods and client-side encryption.

### Authentication Methods

#### 🔑 Passkey Authentication (Recommended)

- **Technology**: WebAuthn/FIDO2 standard
- **How it works**: Uses device biometrics (Face ID, fingerprint, Windows Hello)
- **Security**: Hardware-backed cryptographic keys that never leave your device
- **Encryption**: Uses PRF (Pseudo-Random Function) extension to derive unique encryption keys
- **Benefits**:
  - No passwords to remember or lose
  - Phishing-resistant (works only on registered domain)
  - Fast and convenient (biometric unlock)
  - Each passkey has its own encryption key via PRF

#### 🔒 Email/Password Authentication (Fallback)

- **Technology**: Supabase Auth with email verification
- **How it works**: Traditional username/password with secure password hashing
- **Encryption**: 600,000 PBKDF2 iterations to derive encryption key from password
- **Benefits**:
  - Works on all devices/browsers
  - No special hardware required
  - Can be recovered via email (with data loss warning)

#### 🔗 Account Linking

- **Flexibility**: Add both passkey and password to the same account
- **Use case**: Use passkey on your primary device, password as backup
- **Process**: Authenticate with one method, then add the other securely
- **Security**: Each method has its own encryption key derivation path
- **Key Wrapping**: Master encryption key is wrapped with each auth method's key for cross-compatibility

### Encryption Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                     │
│                                                         │
│  1. User authenticates with passkey or password         │
│     ├─ Passkey: Get PRF output from authenticator       │
│     └─ Password: User enters password                   │
│                                                         │
│  2. Derive Key Encryption Key (KEK)                     │
│     ├─ Passkey: HKDF(PRF output) → AES-256 KEK          │
│     └─ Password: PBKDF2(pwd, salt, 600k) → AES-256 KEK  │
│                                                         │
│  3. Unwrap Master Encryption Key                        │
│     ├─ Fetch wrapped master key from server             │
│     └─ Decrypt with KEK to get master key               │
│                                                         │
│  4. Store master key in sessionStorage (10-min timeout) │
│                                                         │
│  5. Encrypt data before upload                          │
│     ├─ Image: AES-256-GCM with random IV                │
│     └─ Caption: AES-256-GCM with random IV              │
│                                                         │
│  6. Send encrypted data + IV to server                  │
│     └─ Master key NEVER leaves the browser              │
└─────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│                    SERVER (Vercel)                      │
│                                                         │
│  1. Receive encrypted data + IV (initialization vector) │
│  2. Store in Supabase (cannot decrypt - no master key)  │
│  3. At delivery time: Send encrypted package to user    │
│                                                         │
│  ❌ Server never has master key                         │
│  ❌ Server never sees plaintext photos                  │
│  ✅ Server stores wrapped master key (useless alone)    │
└─────────────────────────────────────────────────────────┘
```

### Security Guarantees

✅ **Zero-Knowledge**: Server cannot decrypt your photos  
✅ **End-to-End Encrypted**: Data encrypted before leaving your device  
✅ **Forward Secrecy**: Each upload uses unique random IV  
✅ **Hardware-Backed Keys**: Passkeys use secure enclaves (when available)  
✅ **Industry Standard**: AES-256-GCM, PBKDF2 (600k iterations), HKDF

### Security Tradeoffs

⚠️ **Key Storage**: Master encryption key stored in `sessionStorage` for UX (persistence across page refreshes)

- **Risk**: Vulnerable to XSS attacks (malicious scripts can steal keys)
- **Mitigation**: 10-minute timeout, CSP headers, Subresource Integrity
- **Best Practice**: Never use ReStrip on shared/public computers

⚠️ **Data Loss Risk**: If you lose ALL your authentication methods (both passkey AND password if you've linked them), your data is **permanently lost**

- This is the cost of true privacy
- We cannot recover your data (by design)
- Account linking provides redundancy: if you have both passkey and password, you can access data with either method
- The key wrapping system ensures data remains accessible via any registered authentication method

### Implementation Details

**Libraries Used:**

- `@simplewebauthn/browser` + `@simplewebauthn/server` — WebAuthn implementation
- Web Crypto API — Browser-native encryption (no external dependencies)
- Supabase Auth — Session management and user authentication

**Key Files:**

- `src/lib/encryption.ts` — Encryption utilities (key derivation, AES-GCM)
- `src/lib/webauthn/config.ts` — WebAuthn configuration (RP settings)
- `src/hooks/useAuth.tsx` — Authentication context and state management
- `src/components/auth/PasskeyAuth.tsx` — Passkey authentication UI
- `src/components/auth/EmailPasswordAuth.tsx` — Password authentication UI
- `src/app/api/auth/passkey/*` — WebAuthn server endpoints

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

- **@simplewebauthn/browser** — WebAuthn client
- **@simplewebauthn/server** — WebAuthn server verification
- **Supabase Auth** — User management and sessions
- **Web Crypto API** — Native browser encryption (AES-256-GCM)

### Backend

- **Next.js API Routes** — Serverless functions (Edge Runtime)
- **Supabase** — PostgreSQL database, auth, and storage
- **@supabase/ssr** — Server-side Supabase client
- **Vercel** — Hosting and deployment

### External Services

- **RunPod Serverless** — GPU-based AI image processing
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
rereel/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (auth)/                 # Auth route group (/)
│   │   │   ├── page.tsx            # Landing/sign-in page
│   │   │   ├── layout.tsx          # Force-dynamic layout
│   │   │   └── reset-password/     # Password reset flow
│   │   ├── (protected)/            # Protected route group
│   │   │   ├── upload/
│   │   │   │   ├── page.tsx        # Main upload form (4-step flow)
│   │   │   │   └── layout.tsx      # Force-dynamic layout
│   │   │   └── memory/
│   │   │       └── [id]/
│   │   │           ├── page.tsx    # View delivered memory
│   │   │           └── auth/
│   │   │               └── page.tsx # Re-auth for decryption
│   │   ├── (misc)/                 # Miscellaneous pages
│   │   │   ├── contact/            # Contact page
│   │   │   └── privacy-policy/     # Privacy policy
│   │   ├── api/                    # Backend API routes
│   │   │   ├── auth/               # Authentication endpoints
│   │   │   │   ├── passkey/        # WebAuthn APIs (register/login)
│   │   │   │   │   ├── store-wrapped-key/ # Store wrapped encryption key
│   │   │   │   │   └── wrapped-key/       # Fetch wrapped key
│   │   │   │   ├── link-account/   # Account linking
│   │   │   │   ├── check-account-type/
│   │   │   │   └── check-email/
│   │   │   ├── create-snap/        # Create new memory
│   │   │   ├── crop-image/         # RunPod proxy for AI cropping
│   │   │   ├── upload/             # Upload encrypted data
│   │   │   └── snaps/
│   │   │       └── [id]/           # Fetch specific snap
│   │   ├── layout.tsx              # Root layout (AuthProvider)
│   │   └── favicon.ico
│   ├── components/
│   │   ├── auth/                   # Authentication components
│   │   │   ├── PasskeyAuth.tsx
│   │   │   ├── EmailPasswordAuth.tsx
│   │   │   └── PasswordLinkingModal.tsx
│   │   ├── ui/shadcn-io/           # Custom shadcn components
│   │   │   ├── announcement/
│   │   │   ├── banner/
│   │   │   ├── dropzone/
│   │   │   ├── spinner/
│   │   │   └── choicebox/
│   │   ├── Providers.tsx           # React Context providers
│   │   ├── PeriodPicker.tsx        # Date/period selection
│   │   ├── DeliveryMethodPicker.tsx
│   │   ├── ScrollReveal.tsx        # GSAP scroll animations
│   │   └── ShinyText.tsx           # Animated text effect
│   ├── hooks/
│   │   ├── useAuth.tsx             # Authentication context & hook
│   │   └── usePasskeySupport.ts    # Detect passkey support
│   ├── lib/
│   │   ├── encryption.ts           # Zero-knowledge encryption utils
│   │   ├── webauthn/
│   │   │   └── config.ts           # WebAuthn RP configuration
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser Supabase client
│   │   │   └── server.ts           # Server Supabase client
│   │   ├── utils.ts                # General utilities (cn, etc.)
│   │   └── validators/
│   │       └── index.ts            # Zod schemas
│   └── styles/
│       └── globals.css             # Global Tailwind + custom colors
├── components/ui/                   # Legacy shadcn UI location
├── lib/                            # Legacy lib location
├── public/                         # Static assets
├── supabase/                       # Database migrations
│   └── migrations/                 # SQL migration files (001-008)
├── runpod/                         # AI Image Processing (Python)
│   ├── handler.py                  # RunPod serverless handler
│   ├── requirements.txt            # Python dependencies
│   └── Dockerfile                  # Docker config
├── middleware.ts                   # Next.js middleware (route protection)
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

- ✅ **Zero-Knowledge Encryption** — We literally cannot see your photos
- ✅ **End-to-End Encrypted** — Data encrypted on your device before upload
- ✅ **No Third-Party Training** — Your photos are never used for AI training
- ✅ **Transparent Security** — Open about tradeoffs and threat model
- ✅ **User Control** — You own your data (delete anytime)

**Security Implementation:**

- ✅ AES-256-GCM encryption (military-grade)
- ✅ PBKDF2 (600,000 iterations) for password-based key derivation
- ✅ HKDF with passkey PRF for hardware-backed keys
- ✅ TLS/HTTPS everywhere (Vercel + RunPod + Supabase)
- ✅ Content Security Policy headers
- ✅ Subresource Integrity for external scripts
- ✅ Row Level Security on Supabase
- ✅ 10-minute session timeout for master encryption key
- ✅ Secure API architecture (keys never exposed to client)

---

## 📈 Database Schema

### Current Schema (v1.0)

```sql
-- Users (managed by Supabase Auth)
-- Located in auth.users table

-- Passkey credentials
CREATE TABLE public.passkey_credentials (
    credential_id TEXT PRIMARY KEY,         -- Credential ID from WebAuthn
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    public_key BYTEA NOT NULL,              -- Public key for verification
    counter BIGINT NOT NULL DEFAULT 0,      -- Signature counter (anti-replay)
    transports TEXT[],                      -- Supported transports (usb, nfc, ble, internal)
    backup_eligible BOOLEAN DEFAULT FALSE,  -- Can be backed up
    backup_state BOOLEAN DEFAULT FALSE,     -- Is backed up
    salt TEXT NOT NULL,                     -- Salt for PRF key derivation
    wrapped_encryption_key TEXT,            -- Master key wrapped with PRF-derived KEK
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_user_credential UNIQUE (user_id, credential_id)
);

-- Indexes
CREATE INDEX idx_passkey_credentials_user_id ON public.passkey_credentials(user_id);
```

```sql
-- Encrypted memories/snaps
CREATE TABLE public.snaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Encrypted data
    storage_path TEXT NOT NULL,             -- Supabase Storage path to encrypted image
    image_iv TEXT NOT NULL,                 -- Initialization vector for image
    encrypted_caption TEXT,                 -- Encrypted caption text
    caption_iv TEXT,                        -- Initialization vector for caption

    -- Metadata (not encrypted)
    delivery_method TEXT NOT NULL,          -- 'email' or 'telegram'
    delivery_address TEXT NOT NULL,         -- Email address or Telegram username
    telegram_chat_id BIGINT,                -- Telegram chat ID for bot delivery
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

-- Row Level Security
ALTER TABLE public.snaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snaps"
    ON public.snaps FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snaps"
    ON public.snaps FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snaps"
    ON public.snaps FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own snaps"
    ON public.snaps FOR DELETE
    USING (auth.uid() = user_id);
```

### Storage Buckets (Supabase Storage)

```sql
-- Encrypted images bucket
-- Images are stored encrypted, so no additional encryption needed
CREATE BUCKET IF NOT EXISTS encrypted_images;

-- Storage structure: {user_id}/{snap_id}/image.png
-- Path stored in snaps.storage_path column

-- RLS policies for storage
CREATE POLICY "Users can upload own images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'encrypted_images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'encrypted_images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'encrypted_images' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 🐛 Known Issues & Troubleshooting

### Common Setup Issues

**Issue**: `useAuth must be used within an AuthProvider`

- **Solution**: Make sure `src/components/Providers.tsx` exists and wraps children in root layout
- **Root Cause**: AuthProvider must be a client component wrapping the app

**Issue**: Passkey registration fails with "RP ID mismatch"

- **Solution**: Set `NEXT_PUBLIC_RP_ID` to match your domain (e.g., `localhost` for local dev)
- **Root Cause**: WebAuthn requires exact domain match for security

**Issue**: Build fails with prerendering errors

- **Solution**: Add `export const dynamic = "force-dynamic"` to layouts using auth
- **Root Cause**: Client components with hooks cannot be prerendered

**Issue**: Encryption key not persisting across page refreshes

- **Solution**: Check browser sessionStorage is enabled (not in private mode)
- **Root Cause**: Keys stored in sessionStorage for UX

### Browser Compatibility

**Passkey Support:**

- ✅ Chrome/Edge 67+ (Windows, macOS, Android)
- ✅ Safari 16+ (macOS, iOS)
- ✅ Firefox 119+
- ❌ Internet Explorer (not supported)

**Web Crypto API:**

- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ❌ IE 11 and older

### Performance Tips

1. **Enable auto-crop selectively**: AI processing takes 2-5 seconds
2. **Clear sessionStorage periodically**: Prevents memory buildup
3. **Use passkeys over passwords**: Faster and more secure
4. **Optimize images before upload**: Smaller files = faster encryption

---

## 🎯 Project Goals & Metrics

**Current Focus (Q1 2026):**

- ✅ Complete zero-knowledge encryption architecture
- ✅ Implement passkey and password authentication
- ✅ Finish upload and storage integration
- ✅ Launch email delivery system
- 🎯 Get first 100 beta users
- 🎯 Validate core concept and user satisfaction

**Success Metrics:**

- **User Retention**: 50%+ of users create second memory
- **Delivery Success**: 95%+ emails delivered on time
- **Security**: Zero data breaches or leaks
- **Privacy**: 100% of uploaded data encrypted client-side
- **Performance**: < 3s image encryption time
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

#### A. Supabase (Required)

1. Create a free account at [supabase.com](https://supabase.com/)
2. Create a new project
3. Navigate to **Settings > API** to find your project URL and keys
4. **Run database migrations** (see Step 4)

#### B. RunPod (Optional - for AI auto-crop feature)

1. Create an account at [runpod.io](https://www.runpod.io/)
2. Deploy the photostrip detection handler (see `runpod/DEPLOYMENT.md`)
3. Get your API key and endpoint ID from the RunPod dashboard

### Step 4: Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your configuration. See `.env.local.example` for all available options and descriptions.

***For ENCRYPTION_SECRET, generate your own secret using the following terminal command ```openssl rand -base64 32```***

### Step 5: Set Up Supabase Database

Run the SQL migrations in order in your Supabase SQL Editor (**Dashboard > SQL Editor**):

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/001_passkey_auth.sql` | Core tables, RLS policies, storage bucket |
| 2 | `supabase/migrations/002_add_prf_salt_to_credentials.sql` | WebAuthn salt column |
| 3 | `supabase/migrations/003_delivery_status.sql` | Delivery tracking columns |
| 4 | `supabase/migrations/004_check_user_exists_rpc.sql` | User existence check RPC |
| 5 | `supabase/migrations/005_rpc_get_account_type.sql` | Account type lookup RPC |
| 6 | `supabase/migrations/006_consolidate_snap_image_urls.sql` | Consolidate image columns |
| 7 | `supabase/migrations/007_add_image_iv_to_snaps.sql` | Add image IV for decryption |
| 8 | `supabase/migrations/008_telegram_bot_integration.sql` | Telegram bot support |
| 9 | `supabase/migrations/009_add_key_wrapping.sql` | Cross-auth key wrapping |

**Verification queries:**

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Verify passkey_credentials structure
SELECT column_name FROM information_schema.columns WHERE table_name = 'passkey_credentials';

-- Confirm RLS is enabled
SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('passkey_credentials', 'snaps');
```

**Setting up Supabase Edge Functions for email/telegram functionality:**

1. In your Supabase project, go to Edge Functions > Deploy a new function > Via Editor
2. Replace the code inside with the code in supabase/functions/restrip-memories/index.ts (included in repo)
3. Rename the function name to "restrip-memories".
4. Click "deploy function"
5. Repeat steps 1-4 but with supabase/functions/telegram-bot/index.ts (included in repo)
- **TAKE NOTE: for telegram-bot function, make sure to toggle OFF "Verify JWT with legacy secret" after you've deployed the function.**
6. Create a new gmail account for restrip testing purposes.
7. Go to https://myaccount.google.com/u/1/apppasswords to create a Google App Password (I suggest you name the Google App Password as restrip)
8. In your Supabase project, go to Authentication > Email (under notifications) > SMTP Settings
9. Toggle on Enable Custom SMTP
10. Sender email address: (your created gmail address)
11. Sender name: ReStrip
12. Host: smtp.gmail.com
13. Port number: 465
14. Minimum interval per user: 5 seconds
15. Username: (your created gmail address)
16. Password: (your Google App Password)
17. Create a Telegram bot via [@BotFather](https://t.me/BotFather)
18. Get your bot token ("Use this token to access the HTTP API") and username
19. Enter the following terminal command to connect telegram bot with supabase edge function: ```curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<FUNCTION_URL>/<BOT_TOKEN>"``` whereby <BOT_TOKEN> is the telegram bot token and <FUNCTION_URL> is the supabase edge function's endpoint url (retrieved by Functions > "your function name" > Details)
20. To confirm its connected, enter the following command: ```curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"```, you should get an output of "```{"ok":true,"result":{"url":"https://cervbsflzlvngmbuzmhq.supabase.co/functions/v1/telegram-bot/<BOT_TOKEN>","has_custom_certificate":false,"pending_update_count":0,"max_connections":40,"ip_address":"172.64.149.246"}}```"
21. In your Supabase project, go to Edge Functions > Secrets
22. Add the following secrets:
- "GMAIL_USER" -> (your created gmail address)
- "GMAIL_APP_PASSWORD" -> (your Google App Password)
- "BASE_URL" -> (your localhost address)
- "TELEGRAM_BOT_TOKEN" -> (your created telegram bot token)
- "TELEGRAM_WEBHOOK_SECRET" -> (generate your own webhook secret with the following terminal command ```openssl rand -hex 32```)
- "ENCRYPTION_SECRET" -> (use the same ENCRYPTION_SECRET that you've generated previously for the .env.local)
23. In your Supabase project, go to Integrations > Cron > Install Cron (following the relevant instructions shown on screen to install Cron and its dependencies)
24. In Cron, clicked Jobs and create job.
25. Name: restrip_memories
26. Schedule: */5 * * * *
27. Type: Supabase Edge Functions
28. Method: POST
29. Edge Function: restrip-memories
30. Timeout: 1000ms
31. HTTP Headers:
- Authorization: Bearer <SUPABASE_ANON_KEY>
- Content-Type: application/json
32. HTTP Request Body: {"name":"Functions"}
33. Click save cron job.


### Step 6: Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see the ReStrip upload page!

> **Note:** Currently, no authentication is required. Users can directly access the upload flow without signing in. Authentication features will be added in a future update.

### Step 7: Test Your Setup

1. **Test upload flow**: Navigate to `/upload` and try uploading an image
2. **Test AI cropping** (if RunPod configured): Upload an image with auto-crop enabled
3. **Test form validation**: Try submitting with missing fields to see validation errors

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Create production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint code linting |

### Troubleshooting Setup Issues

| Issue | Solution |
|-------|----------|
| `Module not found` errors | Delete `node_modules` and run `npm install` |
| Supabase connection fails | Verify env variables are set correctly |
| Passkey registration fails | Ensure `NEXT_PUBLIC_ALLOWED_RP_DOMAINS` includes `localhost` |
| Build/prerender errors | Add `export const dynamic = "force-dynamic"` to affected layouts |

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
