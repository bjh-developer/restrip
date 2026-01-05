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
- 🔄 Finish upload and storage integration
- 🔄 Launch email delivery system
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

## 🤝 Contributing

ReStrip is currently in active development. Contributions are welcome!

**How to Contribute:**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Areas for Contribution:**

- Bug fixes and testing
- Documentation improvements
- UI/UX enhancements
- Performance optimizations
- Security audits
- Accessibility improvements

Please read `TECHNICAL_DOCUMENTATION.md` before contributing to understand the architecture.

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
