<div align="center">
  <img src="ReStrip_logo_v2.png" alt="ReStrip Logo" width="120" height="120">
  <h1>ReStrip Technical Documentation</h1>
  <p><em>Photo strips that come back to you.</em></p>
  <p><em>Last updated: 31 Jan 2026</em></p>
</div>

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

ReStrip is a **time-delayed memory delivery platform** that allows users to upload photo strips today and receive them back months later via email. The platform implements **zero-knowledge encryption**, meaning even the server cannot decrypt users' photos.

### Key Features

- 🔐 **Zero-Knowledge Encryption**: Photos encrypted client-side before upload
- 🔑 **Modern Authentication**: Passkey (biometric) and password options
- 🤖 **AI Auto-Crop**: YOLO11-powered photo strip detection
- 📅 **Flexible Scheduling**: Random surprise, custom period, or specific date
- 🎨 **Beautiful UX**: Smooth animations and responsive design
- 🔒 **Privacy-First**: No third-party data sharing or AI training

### Technology Philosophy

ReStrip prioritizes:

1. **Privacy**: User data is sacred and encrypted
2. **Security**: Modern standards (WebAuthn, AES-256-GCM)
3. **User Experience**: Simple, delightful interactions
4. **Developer Experience**: Clean code, TypeScript, modern tooling
5. **Performance**: Fast, responsive, optimized

### Project Status

**Version**: 1.0 (MVP)  
**Status**: Finished - Core features and integration complete

---

## 2. Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher ([Download](https://nodejs.org/))
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Git**: For version control
- **Supabase Account**: For database and auth ([Sign up](https://supabase.com/))
- **RunPod Account** (optional): For AI image processing

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

#### 3. Environment Variables Setup

Copy the example environment file and configure it:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration values. The example file contains all available options with descriptions.

**Key environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `RUNPOD_API_KEY` | Optional | RunPod API key for AI cropping |
| `RUNPOD_ENDPOINT_ID` | Optional | RunPod endpoint ID |
| `NEXT_PUBLIC_APP_URL` | Yes | Your application URL |
| `ENCRYPTION_SECRET` | Optional | Server-side encryption key for delivery |

#### 4. Supabase Setup

**Run Database Migrations:**

Apply all migrations from `supabase/migrations/` in order in your Supabase SQL Editor:

1. **001_passkey_auth.sql** - Core tables (passkey_credentials, snaps, webauthn_challenges, storage bucket, RLS policies)
2. **002_add_prf_salt_to_credentials.sql** - Add salt column to passkey_credentials for WebAuthn isolation
3. **003_delivery_status.sql** - Add delivery status tracking columns
4. **004_check_user_exists_rpc.sql** - RPC function to check if user exists by email
5. **005_rpc_get_account_type.sql** - RPC function for efficient account type lookup
6. **006_consolidate_snap_image_urls.sql** - Consolidate image URL columns into storage_path
7. **007_add_image_iv_to_snaps.sql** - Add image_iv column for decryption
8. **008_telegram_bot_integration.sql** - Add telegram_chat_id column
9. **009_add_key_wrapping.sql** - Add key wrapping support for cross-compatible authentication

**Quick Setup:**

Copy the migration files from `supabase/migrations/` into your Supabase project, or run each SQL file content in the SQL Editor sequentially.

**Verification:**

After running migrations, verify with:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check passkey_credentials has all columns
SELECT column_name FROM information_schema.columns WHERE table_name = 'passkey_credentials';

-- Verify RLS is enabled on main tables
SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('passkey_credentials', 'snaps');
```

#### 5. Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

### Project Scripts

```bash
npm run dev    # Start development server
npm run build  # Create production build
npm run start  # Start production server
npm run lint   # Run ESLint
```

### Quick Reference for New Developers

Here's a quick mental map of how everything connects:

**User Journey:**
```
Sign Up → Upload Photo → Auto-Crop (optional) → Add Caption → Schedule → Encrypt → Store → [Time Passes] → Deliver → Decrypt & View
```

**Key Files to Understand First:**

Current version without authentication
| File | Purpose | Priority |
|------|---------|----------|
| `src/app/upload/page.tsx` | Main upload flow (start here!) | ⭐⭐⭐ |
| `middleware.ts` | Route protection | ⭐⭐ |
| `runpod/handler.py` | AI image cropping | ⭐ |

Version with authentication
| File | Purpose | Priority |
|------|---------|----------|
| `src/app/(protected)/upload/page.tsx` | Main upload flow (start here!) | ⭐⭐⭐ |
| `src/hooks/useAuth.tsx` | Authentication state management | ⭐⭐⭐ |
| `src/lib/encryption.ts` | All encryption/decryption logic | ⭐⭐⭐ |
| `src/app/api/auth/passkey/*` | WebAuthn server endpoints | ⭐⭐ |
| `middleware.ts` | Route protection | ⭐⭐ |
| `runpod/handler.py` | AI image cropping | ⭐ |

**Data Flow Summary:**

1. **Upload**: Image → Client-side encryption → Supabase Storage
2. **Store**: Encrypted metadata → Supabase Database (snaps table)
3. **Deliver**: Cron job → Edge Function → Decrypt → Email/Telegram
4. **View**: Fetch encrypted data → Client-side decryption → Display

---

## 3. Architecture Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph Client["CLIENT (Browser)"]
        UI["React UI<br/>Components"]
        Auth["Auth Context<br/>(hooks)"]
        Encrypt["Encryption<br/>Layer"]
        UI --> Auth
        Auth --> Encrypt
    end

    subgraph Server["NEXT.JS SERVER (Vercel)"]
        API["API Routes<br/>(/api/*)"]
        Middleware["Middleware<br/>(Auth Gate)"]
        SSR["SSR Pages<br/>(Rendering)"]
    end

    subgraph External["External Services"]
        Supabase["Supabase<br/>Database + Auth"]
        RunPod["RunPod<br/>Serverless (YOLO AI)"]
        Storage["Storage<br/>(Future)"]
    end

    Client -->|HTTPS| Server
    Server --> Supabase
    Server --> RunPod
    Server --> Storage
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
- **Authentication**: Supabase Auth + SimpleWebAuthn
- **External Services**: RunPod (AI processing)

#### Security

- **Encryption**: Web Crypto API (AES-256-GCM)
- **Key Derivation**: HKDF (passkey) + PBKDF2 (password)
- **Authentication**: WebAuthn/FIDO2 + Email/Password

### Request Flow Example

### Request Flow Example

**User uploads a photo:**

```mermaid
sequenceDiagram
    actor User
    participant Client as Client Browser
    participant Server as Next.js API
    participant RunPod as RunPod AI
    participant Supabase as Supabase DB

    User->>Client: 1. Select image in dropzone
    Client->>Client: 2. Convert image to base64
    Client->>Server: 3. POST /api/crop-image<br/>(base64 image)
    Server->>RunPod: 4. Forward image for AI processing
    RunPod->>RunPod: 5. YOLO11 detects & crops photo strip
    RunPod-->>Server: 6. Return cropped image (base64)
    Server-->>Client: 7. Return cropped image
    Client->>Client: 8. Cache cropped image

    User->>Client: 9. Fill form & click submit
    Client->>Client: 10. Derive encryption key<br/>(passkey/password)
    Client->>Client: 11. Encrypt image + caption<br/>(AES-256-GCM)
    Client->>Server: 12. POST encrypted data
    Server->>Supabase: 13. Store encrypted snap
    Supabase-->>Server: 14. Confirm storage
    Server->>Server: 15. Schedule delivery job
    Server-->>Client: 16. Success response
    Client-->>User: 17. Show success message
```

**Key Steps:**

- **Steps 1-7**: Image upload and AI auto-crop
- **Steps 8-11**: Client-side encryption (zero-knowledge)
- **Steps 12-17**: Secure storage and scheduling

### Memory Viewing Flow

**User views a delivered memory:**

```mermaid
sequenceDiagram
    actor User
    participant Client as Client Browser
    participant Server as Next.js API
    participant Supabase as Supabase DB/Storage

    User->>Client: 1. Click link in delivery email
    Client->>Client: 2. Check if authenticated
    
    alt Not authenticated or key expired
        Client->>User: 3. Redirect to /memory/[id]/auth
        User->>Client: 4. Authenticate (passkey/password)
        Client->>Client: 5. Derive KEK from auth method
        Client->>Server: 6. Fetch wrapped master key
        Server->>Supabase: 7. Query passkey_credentials or user_metadata
        Supabase-->>Server: 8. Return wrapped key
        Server-->>Client: 9. Return wrapped key
        Client->>Client: 10. Unwrap master key with KEK
        Client->>Client: 11. Store master key in sessionStorage
    end

    Client->>Server: 12. GET /api/snaps/[id]
    Server->>Supabase: 13. Query snaps table
    Supabase-->>Server: 14. Return snap metadata
    Server-->>Client: 15. Return encrypted metadata

    Client->>Server: 16. Download encrypted image
    Server->>Supabase: 17. storage.download(storage_path)
    Supabase-->>Server: 18. Return encrypted image blob
    Server-->>Client: 19. Return encrypted image

    Client->>Client: 20. Decrypt image with master key + IV
    Client->>Client: 21. Decrypt caption with master key + IV
    Client-->>User: 22. Display decrypted memory
```

**Key Steps:**

- **Steps 1-11**: Authentication and key unwrapping (if needed)
- **Steps 12-15**: Fetch encrypted snap metadata
- **Steps 16-19**: Download encrypted image from storage
- **Steps 20-22**: Client-side decryption and display

---

## 4. Frontend Deep Dive

### Next.js App Router Structure

#### Route Groups

Route groups use parentheses `()` to organize files without affecting URLs.

Current version without authentication
```
app/
  upload/
    page.tsx        → URL: /upload
  (misc)/
    contact/
      page.tsx        → URL: /contact
    privacy-policy/
      page.tsx        → URL: /privacy-policy
  page.tsx        → URL: / (but auto redirects to /upload)
```

Version with authentication
```
app/
  (auth)/
    reset-password/
      page.tsx        → URL: /reset-password
    page.tsx          → URL: /
  (protected)/
    memory/
      [id]/
        auth/
          page.tsx    → URL: /memory/[id]/auth
      page.tsx        → URL: /memory
    upload/
      page.tsx        → URL: /upload
  (misc)/
    contact/
      page.tsx        → URL: /contact
    privacy-policy/
      page.tsx        → URL: /privacy-policy
```

**Benefits:**

- Shared layouts for route groups
- Logical organization
- Clean URLs

#### Key Pages

**1. Authentication Page** (`src/app/(auth)/page.tsx`)

Landing page with sign-in/sign-up functionality.

**Features:**

- Passkey authentication (primary)
- Email/password authentication (fallback)
- Tab switcher based on passkey support
- Email verification handling
- Auto-redirect when authenticated

**Key Logic:**

```typescript
// Redirect if authenticated
useEffect(() => {
  if (user && hasEncryptionKey) {
    router.push("/upload");
  }
}, [user, hasEncryptionKey, router]);
```

**2. Upload Page** (`src/app/(protected)/upload/page.tsx`)

Main application page with 4-step flow:

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

**3. Memory Viewing Pages** (`src/app/(protected)/memory/[id]/page.tsx`)

Secure page for viewing delivered memories with client-side decryption.

**Features:**

- Fetch encrypted snap metadata from server
- Download encrypted image from Supabase Storage
- Decrypt image and caption using master encryption key
- Display decrypted memory with metadata
- Handle authentication requirement for decryption

**Key Logic:**

```typescript
// Fetch snap metadata
const { data: snapData } = await supabase
  .from("snaps")
  .select("*")
  .eq("id", snapId)
  .single();

// Download encrypted image
const { data: imageBlob } = await supabase.storage
  .from("encrypted-images")
  .download(snapData.storage_path);

// Decrypt image
const encryptionKey = await getEncryptionKey();
const decryptedImageBlob = await decryptImage(
  imageBlob,
  snapData.image_iv,
  encryptionKey
);

// Decrypt caption
const decryptedCaption = await decryptDataAsString(
  snapData.encrypted_caption,
  snapData.caption_iv,
  encryptionKey
);
```

**4. Re-authentication Page** (`src/app/(protected)/memory/[id]/auth/page.tsx`)

Handles re-authentication when encryption key expires or is missing.

- Redirects to memory page after successful authentication
- Ensures encryption key is derived and available
- Seamless UX for accessing delivered memories

### Key Components

#### Auth Components

**PasskeyAuth.tsx**

Handles WebAuthn passkey registration and authentication.

**Flow:**

1. Check if email exists → Register or Login
2. If registering, send email verification first
3. User verifies email via link
4. Get WebAuthn options from server
5. Call browser WebAuthn API
6. Verify with server
7. Derive encryption key from PRF output
8. Store key in sessionStorage

**EmailPasswordAuth.tsx**

Traditional email/password authentication.

**Features:**

- Sign up with email verification
- Sign in with password
- Password reset flow
- Encryption key derivation from password using PBKDF2

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

#### useAuth Hook

Centralized authentication state management.

**Provides:**

```typescript
const {
  user, // Current user or null
  session, // Supabase session
  authMethod, // 'passkey' | 'password' | null
  isLoading, // Auth check in progress
  hasEncryptionKey, // Encryption key available
  signOut, // Sign out function
  setEncryptionKeyFromPRF, // Set key from passkey
  setEncryptionKeyFromPassword, // Set key from password
} = useAuth();
```

**Implementation:**

```typescript
export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        // Check for encryption key
        const key = await getEncryptionKey();
        if (key) setEncryptionKeySet(true);
      }
      setIsLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setUser(session.user);
        } else {
          setUser(null);
          clearEncryptionKey();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{/* ... */}}>
      {children}
    </AuthContext.Provider>
  );
}
```

#### usePasskeySupport Hook

Detects if browser/device supports passkeys.

```typescript
export function usePasskeySupport() {
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSupport = async () => {
      if (!window.PublicKeyCredential) {
        setPasskeySupported(false);
        return;
      }

      const available =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setPasskeySupported(available);
      setIsLoading(false);
    };

    checkSupport();
  }, []);

  return { passkeySupported, isLoading };
}
```

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

#### `/api/crop-image`

**Purpose**: Proxy image to RunPod for AI cropping

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

#### `/api/auth/passkey/register-options`

Generate WebAuthn registration options.

**Request:**

```json
{ "email": "user@example.com" }
```

**Response:**

```json
{
  "options": {
    "challenge": "...",
    "rp": { "name": "ReStrip", "id": "localhost" },
    "user": { "id": "...", "name": "...", "displayName": "..." },
    "extensions": { "prf": {} }
  },
  "salt": "base64-salt"
}
```

#### `/api/auth/passkey/register-verify`

Verify WebAuthn registration response.

**Process:**

1. Verify WebAuthn response
2. Create/sign in user with Supabase
3. Store credential in database
4. Return success

#### `/api/auth/passkey/login-options`

Generate WebAuthn authentication options.

#### `/api/auth/passkey/login-verify`

Verify WebAuthn authentication response.

### Middleware

**Purpose**: Protect routes and manage sessions

**File**: `middleware.ts`

```typescript
export async function middleware(request: NextRequest) {
  // Create Supabase client with cookie handling
  const supabase = createServerClient(/* ... */);

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect /upload route
  if (request.nextUrl.pathname.startsWith("/upload")) {
    if (!session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/", "/upload/:path*"],
};
```

---

## 6. Authentication System

> **⚠️ Current Status:** Authentication is not currently required. Users can access the upload flow directly without signing in. Authentication features (passkey and email/password) are implemented but disabled for the current release. This section documents the authentication architecture for future reference.

### Overview

ReStrip supports two authentication methods:

1. **Passkey (WebAuthn)** - Biometric authentication
2. **Email/Password** - Traditional authentication

Both can be linked to the same account for redundancy.

### Passkey Authentication (WebAuthn)

**How it works:**

1. **Registration:**
   - User provides email
   - Supabase sends verification email
   - User clicks verification link in email
   - Server generates WebAuthn challenge
   - Browser prompts for biometric (Face ID, fingerprint)
   - Device creates cryptographic key pair
   - Public key sent to server, private key stays on device
   - PRF extension derives encryption key

2. **Login:**
   - User initiates login
   - Server generates challenge
   - Browser prompts for biometric
   - Device signs challenge with private key
   - Server verifies signature
   - PRF generates same encryption key

**Benefits:**

- ✅ Phishing-resistant
- ✅ No passwords to remember
- ✅ Hardware-backed security
- ✅ Fast and convenient

**Browser Support:**

- Chrome/Edge 67+
- Safari 16+
- Firefox 119+

### Email/Password Authentication

**How it works:**

1. **Sign Up:**
   - User provides email and password
   - Supabase sends verification email
   - User clicks verification link in email
   - Encryption key derived from password using PBKDF2

2. **Sign In:**
   - User enters email and password
   - Supabase verifies credentials
   - Encryption key derived from password

**Key Derivation:**

```typescript
async function deriveKeyFromPassword(password: string, salt: Uint8Array) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 600000, // OWASP 2024 recommendation
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  return key;
}
```

### Account Linking

Users can add both authentication methods to one account:

**Scenarios:**

- Passkey user adds password backup
- Password user upgrades to passkey

**Implementation:**

```typescript
// Add password to passkey account
await supabase.auth.updateUser({ password: newPassword });

// Add passkey to password account
// Use passkey registration flow (auto-links to existing user)
```

---

## 7. Encryption System

### Zero-Knowledge Encryption

**What it means:**

- Data encrypted on client before upload
- Encryption key never leaves user's device
- Server cannot decrypt data
- True privacy by design

### Encryption Flow

```mermaid
graph LR
    A["User Data"] --> B["Encryption Key<br/>Derivation"]
    B --> C["AES-256-GCM<br/>Encryption"]
    C --> D["Upload to<br/>Server"]
    D --> E["Server Storage<br/>(Encrypted at Rest)"]

    style A fill:#fff2c9
    style B fill:#cfe7ff
    style C fill:#ffc9d1
    style D fill:#f3e8d8
    style E fill:#ebebeb
```

### Key Derivation

**From Passkey (PRF):**

```typescript
async function deriveKeyFromPRF(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    "HKDF",
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("restrip-encryption-v1"),
      info: new TextEncoder().encode("image-encryption"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  return key;
}
```

**From Password (PBKDF2):**

Uses 600,000 iterations (OWASP 2024 recommendation).

### Encryption Implementation

**Encrypt Data:**

```typescript
async function encryptData(data: ArrayBuffer, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits for AES-GCM

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
  };
}
```

**Decrypt Data:**

```typescript
async function decryptData(
  encryptedBase64: string,
  ivBase64: string,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  const encrypted = base64ToArrayBuffer(encryptedBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    encrypted,
  );

  return decrypted;
}
```

### Key Storage

**Challenge**: Persist key across page refreshes while maintaining security

**Solution**: Store in `sessionStorage` with 10-minute timeout

**Security Tradeoffs:**

- ⚠️ Vulnerable to XSS attacks
- ✅ Cleared on tab close
- ✅ 10-minute expiry
- ✅ CSP headers reduce XSS risk

**Implementation:**

```typescript
export async function setEncryptionKey(key: CryptoKey): Promise<void> {
  encryptionKeyStore = key; // In-memory

  // Export and store in sessionStorage
  const exportedKey = await crypto.subtle.exportKey("raw", key);
  const keyBase64 = arrayBufferToBase64(exportedKey);
  const timestamp = Date.now().toString();

  sessionStorage.setItem("restrip_encryption_key", keyBase64);
  sessionStorage.setItem("restrip_encryption_key_timestamp", timestamp);
}

export async function getEncryptionKey(): Promise<CryptoKey | null> {
  // If key is in memory, return it
  if (encryptionKeyStore) {
    return encryptionKeyStore;
  }

  // Try to restore from sessionStorage
  try {
    const keyBase64 = sessionStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY);
    const timestampStr = sessionStorage.getItem(ENCRYPTION_KEY_TIMESTAMP_KEY);

    if (!keyBase64 || !timestampStr) {
      return null;
    }

    // Check if key has expired
    const timestamp = parseInt(timestampStr, 10);
    const age = Date.now() - timestamp;

    if (age > KEY_EXPIRY_MS) {
      console.warn(
        "⚠️ Encryption key expired (10 min timeout). Please re-authenticate.",
      );
      clearEncryptionKey();
      return null;
    }

    const keyBuffer = base64ToArrayBuffer(keyBase64);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM", length: 256 },
      true, // Make it extractable so it can be persisted again if needed
      ["encrypt", "decrypt"],
    );

    encryptionKeyStore = key;
    console.log("✅ Encryption key restored from sessionStorage");
    return key;
  } catch (error) {
    console.error("Failed to restore encryption key:", error);
    // Clear invalid stored key
    clearEncryptionKey();
    return null;
  }
}
```

### Key Wrapping System

**Problem**: Users who register with passkey and later add password (or vice versa) need to access their encrypted data with both authentication methods. Each method derives a different encryption key.

**Solution**: Key wrapping enables cross-compatible authentication by storing a master encryption key that is wrapped (encrypted) with each authentication method's derived key.

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                 First Authentication                    │
│                                                         │
│  1. User registers with passkey (or password)           │
│  2. Derive Key Encryption Key (KEK) from auth method    │
│  3. Generate random Master Encryption Key (MEK)         │
│  4. Wrap MEK with KEK → Wrapped MEK                     │
│  5. Store Wrapped MEK in database                       │
│     - Passkey: passkey_credentials.wrapped_encryption_key│
│     - Password: auth.users.user_metadata.wrapped_encryption_key│
│  6. Use MEK for encrypting user data                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Adding Second Auth Method                  │
│                                                         │
│  1. User adds password (or passkey) to account          │
│  2. Authenticate with existing method → unwrap MEK      │
│  3. Derive new KEK from new auth method                 │
│  4. Wrap MEK with new KEK → Second Wrapped MEK          │
│  5. Store second Wrapped MEK in database                │
│  6. Now both methods can unwrap the same MEK            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                Future Authentication                    │
│                                                         │
│  1. User logs in with either method                     │
│  2. Derive KEK from chosen auth method                  │
│  3. Fetch corresponding Wrapped MEK from database       │
│  4. Unwrap MEK using KEK                                │
│  5. Use MEK to decrypt user data                        │
│  ✅ Same MEK works for all user's encrypted data        │
└─────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// Step 1: Generate Master Encryption Key (first registration)
const masterKey = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true, // extractable
  ["encrypt", "decrypt"]
);

// Step 2: Wrap master key with KEK derived from auth method
const kek = await deriveKekFromAuthMethod(); // From passkey PRF or password PBKDF2
const wrappedKey = await crypto.subtle.wrapKey(
  "raw",
  masterKey,
  kek,
  "AES-KW" // AES Key Wrap algorithm (RFC 3394) - no IV required
);

// Step 3: Store wrapped key in database
await storeWrappedKey(wrappedKey); // In passkey_credentials or user_metadata

// Later: Unwrap master key during authentication
const kek = await deriveKekFromAuthMethod();
const wrappedKeyFromDb = await fetchWrappedKey();
const masterKey = await crypto.subtle.unwrapKey(
  "raw",
  wrappedKeyFromDb,
  kek,
  "AES-KW", // Same algorithm used for wrapping
  { name: "AES-GCM", length: 256 }, // Unwrapped key will be AES-GCM for data encryption
  true,
  ["encrypt", "decrypt"]
);
```

**Benefits:**

- ✅ Seamless cross-auth compatibility
- ✅ Single master key for all user data
- ✅ No data re-encryption needed when adding auth methods
- ✅ Zero-knowledge architecture maintained (server never sees unwrapped MEK)

**API Endpoints:**

- `POST /api/auth/passkey/store-wrapped-key` - Store wrapped key after passkey registration
- `GET /api/auth/passkey/wrapped-key?credentialId=...` - Fetch wrapped key during login

---

## 8. Database & Storage

### Supabase Database

**Technology**: PostgreSQL with Row Level Security (RLS)

### Complete Database Schema

**All database migrations are located in `supabase/migrations/` folder.**

Run the migrations in order in your Supabase SQL Editor:

**Migration Files (in order):**

1. `001_passkey_auth.sql` - Creates core tables and RLS policies
2. `002_add_prf_salt_to_credentials.sql` - Adds per-credential salt for WebAuthn isolation
3. `003_delivery_status.sql` - Adds delivery status tracking
4. `004_check_user_exists_rpc.sql` - Creates `check_user_exists()` RPC function
5. `005_rpc_get_account_type.sql` - Creates `get_account_type()` RPC function
6. `006_consolidate_snap_image_urls.sql` - Consolidates image URL columns
7. `007_add_image_iv_to_snaps.sql` - Adds image_iv for decryption
8. `008_telegram_bot_integration.sql` - Adds Telegram integration
9. `009_add_key_wrapping.sql` - Adds key wrapping for cross-auth support

**Tables Created:**

- `passkey_credentials` - WebAuthn credential storage with wrapped encryption keys
- `snaps` - User's encrypted memories with delivery metadata
- `webauthn_challenges` - Temporary challenge storage for WebAuthn flows

**Storage Bucket:**

- `encrypted-images` - Private storage for encrypted images and cropped versions

### Schema Explanation

**passkey_credentials table:**

- Stores WebAuthn public keys for passkey authentication
- Each credential has a unique salt for PRF-based encryption key derivation
- `wrapped_encryption_key` column stores the master encryption key wrapped with the passkey's PRF-derived KEK
- Enables cross-compatible authentication with password method
- Tracks device information and usage

**snaps table:**

- Stores encrypted photo strip memories
- `storage_path` field references the encrypted image in Supabase Storage (consolidates previous dual URL fields)
- `image_iv` and `caption_iv` store initialization vectors for decryption
- `telegram_chat_id` field ready for Telegram bot integration (schema prepared, bot implementation in progress)
- Tracks delivery schedule and status

**webauthn_challenges table:**

- Temporary storage for WebAuthn challenges
- Expires after use for security

**Helper Functions:**

- `cleanup_expired_challenges()`: Clean up old challenges
- `check_user_exists()`: Check if email is registered
- `get_account_type()`: Get user's authentication method

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

**Option B: Run a Local Flask Server**

Create a simple Flask wrapper for the handler:

```python
# runpod/local_server.py
from flask import Flask, request, jsonify
from handler import handler

app = Flask(__name__)

@app.route('/runsync', methods=['POST'])
def process():
    data = request.json
    result = handler(data)
    return jsonify({'output': result})

if __name__ == '__main__':
    app.run(port=8000, debug=True)
```

Run the server:

```bash
pip install flask
python local_server.py
```

**Note:** The local Flask server approach requires modifying the `/api/crop-image/route.ts` to detect and handle local development mode. This is an advanced configuration that may not be necessary for most development workflows. For simpler testing, use the direct Python test approach described above.

#### Troubleshooting Local RunPod

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'ultralytics'` | Run `pip install ultralytics` |
| `FileNotFoundError: runs/segment/train/weights/best.pt` | Obtain model weights from team lead |
| CUDA out of memory | Use CPU version of PyTorch or reduce image size |
| Slow inference on CPU | Expected - GPU recommended for production |

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

# Copy handler
COPY runpod/handler.py .

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

## 10. Supabase Edge Functions (Delivery System)

ReStrip uses Supabase Edge Functions to handle scheduled memory delivery. These serverless functions run on Deno and are triggered by a cron job.

### Edge Functions Overview

| Function | Location | Purpose |
|----------|----------|---------|
| `restrip-memories` | `supabase/functions/restrip-memories/` | Main delivery function - sends due memories via email or Telegram |
| `telegram-bot` | `supabase/functions/telegram-bot/` | Webhook handler for Telegram bot interactions |

### Memory Delivery Function (`restrip-memories`)

**File:** `supabase/functions/restrip-memories/index.ts`

This function:
1. Queries the database for memories that are due for delivery
2. Downloads encrypted images from Supabase Storage
3. Decrypts images using the server-side encryption key
4. Sends memories via the user's chosen delivery method (email or Telegram)
5. Updates delivery status in the database

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

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin access) |
| `ENCRYPTION_SECRET` | Server-side decryption key (base64-encoded AES-256 key) |
| `GMAIL_USER` | Gmail address for sending emails |
| `GMAIL_APP_PASSWORD` | Gmail app password (not your regular password) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather |

**Setting Up Gmail for Email Delivery:**

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication (required)
3. Go to **App passwords** and generate a new app password
4. Use this app password for `GMAIL_APP_PASSWORD`

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

| Secret | Description |
|--------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret for webhook verification |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |

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

For the delivery system to work, you need a server-side encryption key that can decrypt user memories. This is the `ENCRYPTION_SECRET` environment variable.

**⚠️ Security Note:** This breaks the "zero-knowledge" property for delivery. The server needs to decrypt images to send them. If you require true zero-knowledge, consider alternative delivery methods where the client decrypts.

**Generating the Key:**

```javascript
// Run this in a Node.js environment
const crypto = require('crypto');
const key = crypto.randomBytes(32); // 256 bits
const keyBase64 = key.toString('base64');
console.log('ENCRYPTION_SECRET:', keyBase64);
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

### Authentication Endpoints

| Endpoint                                 | Method | Purpose                                  |
| ---------------------------------------- | ------ | ---------------------------------------- |
| `/api/auth/passkey/register-options`     | POST   | Generate WebAuthn registration options   |
| `/api/auth/passkey/register-verify`      | POST   | Verify WebAuthn registration response    |
| `/api/auth/passkey/login-options`        | POST   | Generate WebAuthn authentication options |
| `/api/auth/passkey/login-verify`         | POST   | Verify WebAuthn authentication response  |
| `/api/auth/passkey/store-wrapped-key`    | POST   | Store wrapped master encryption key      |
| `/api/auth/passkey/wrapped-key`          | GET    | Fetch wrapped key for credential         |
| `/api/auth/check-email`                  | POST   | Check if email exists                    |
| `/api/auth/check-account-type`           | POST   | Get user's authentication methods        |
| `/api/auth/link-account`                 | POST   | Link password to passkey account         |

### Image Processing

| Endpoint          | Method | Purpose                         |
| ----------------- | ------ | ------------------------------- |
| `/api/crop-image` | POST   | Proxy to RunPod for AI cropping |

### Memory Management

| Endpoint           | Method | Purpose                           |
| ------------------ | ------ | --------------------------------- |
| `/api/create-snap` | POST   | Create new encrypted memory       |
| `/api/upload`      | POST   | Upload encrypted image to storage |
| `/api/snaps/[id]`  | GET    | Get specific memory metadata      |
| `/api/snaps/[id]`  | DELETE | Delete memory (planned)           |

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

- **PeriodPicker** - Date/period selection
- **DeliveryMethodPicker** - Email/Telegram selection
- **ScrollReveal** - GSAP scroll animation wrapper
- **ShinyText** - Animated gradient text

### Auth Components

From `src/components/auth/`:

- **PasskeyAuth** - Passkey registration/login
- **EmailPasswordAuth** - Email/password auth
- **PasswordLinkingModal** - Add password to passkey account
- **AuthGate** - Protected route wrapper
- **AccountLinking** - Link auth methods

---

## 13. State Management

### Global State (React Context)

**AuthProvider** (`src/hooks/useAuth.tsx`)

Manages authentication state:

- User object
- Session
- Auth method
- Encryption key status
- Sign in/out functions

**Usage:**

```typescript
function MyComponent() {
  const { user, hasEncryptionKey } = useAuth();

  if (!user) return <SignIn />;
  if (!hasEncryptionKey) return <SetupEncryption />;

  return <App />;
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

### Session Storage

**Encryption Key:**

```typescript
sessionStorage.setItem("restrip_encryption_key", keyBase64);
sessionStorage.setItem("restrip_encryption_key_timestamp", timestamp);
```

**Benefits:**

- Persists across page refreshes
- Cleared on tab close
- Not shared between tabs

---

## 14. Styling & Design System

### Tailwind CSS

**Configuration**: `tailwind.config.ts`

**Custom Colors:**

```typescript
colors: {
  'blush-pink': '#FFC9D1',
  'soft-black': '#1C1C1C',
  'warm-beige': '#F3E8D8',
  'grey': '#6B6B6B',
  'pastel-blue': '#CFE7FF',
  'yellow-cream': '#FFF2C9',
}
```

**Custom Fonts:**

```typescript
fontFamily: {
  display: ['var(--font-display)', 'serif'],  // Playfair Display
  body: ['var(--font-body)', 'sans-serif'],    // Inter
}
```

**Custom Shadows:**

```typescript
boxShadow: {
  card: '0 2px 8px rgba(0, 0, 0, 0.08)',
  'card-hover': '0 4px 12px rgba(0, 0, 0, 0.12)',
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

**File**: `next.config.ts`

```typescript
async headers() {
  return [{
    source: '/:path*',
    headers: [
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://cdn.userjot.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "connect-src 'self' https://*.supabase.co",
          "frame-ancestors 'none'",
        ].join('; '),
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
    ],
  }];
}
```

---

## 17. Troubleshooting Guide

### Common Issues

#### Authentication Issues

**Issue**: "useAuth must be used within an AuthProvider"

**Solution:**

- Ensure `Providers.tsx` wraps app in root layout
- Check `AuthProvider` is exported correctly

**Issue**: Passkey registration fails

**Solutions:**

- Check `NEXT_PUBLIC_RP_ID` matches domain
- For localhost: use `localhost` (no port)
- For production: use domain without https://
- Ensure browser supports WebAuthn

**Issue**: Email verification not working

**Solutions:**

- Check Supabase email settings
- Verify Site URL in Supabase dashboard
- Check Redirect URLs include your domain

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

**Issue**: Encryption key not persisting

**Solutions:**

- Check browser not in private/incognito mode
- Verify sessionStorage is enabled
- Check for console errors

**Issue**: "Encryption key expired"

**Solution:**

- This is by design (10-minute timeout)
- User must re-authenticate
- Consider account linking for easier re-auth

#### Image Processing Issues

**Issue**: Crop image fails

**Solutions:**

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

**Issue**: Cannot decrypt memory - "Encryption key expired"

**Solutions:**

- Re-authenticate using ANY of your registered authentication methods (passkey or password)
- With key wrapping, you can access data via either method if you've linked accounts
- If you lose ALL authentication methods, data cannot be recovered (by design)
- Account linking provides redundancy for data access

**Issue**: Memory page shows "Not found" or 404

**Causes:**

- Memory belongs to different user
- Memory ID is invalid
- Row Level Security blocking access

**Solutions:**

- Verify you're logged in with the correct account
- Check memory ID in URL is correct
- Verify snap exists in database

**Issue**: Image won't decrypt or shows corrupted data

**Causes:**

- Wrong encryption key being used
- IV (initialization vector) mismatch
- Corrupted storage data

**Solutions:**

- Ensure you're using the same authentication method
- Check `image_iv` matches the encrypted image
- Verify storage path in database matches actual file

**Issue**: "Failed to fetch wrapped key"

**Causes:**

- Credential ID not found in database
- Network error
- Database connection issue

**Solutions:**

- Re-authenticate to refresh credential
- Check network connectivity
- Verify `passkey_credentials` table has entries

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
// In useAuth
console.log("Auth state:", { user, hasEncryptionKey });

// In API routes
console.log("Request body:", body);
console.log("Response:", data);
```

**3. Test in Different Browsers:**

- Chrome (best WebAuthn support)
- Safari (iOS/macOS passkeys)
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

**Key Takeaways:**

- ReStrip uses zero-knowledge encryption for privacy
- Modern authentication with WebAuthn passkeys and email/password
- Next.js 16 App Router with TypeScript
- Supabase for database and auth
- RunPod + YOLO11 for AI image processing
- Security-first architecture

**Next Steps:**

1. Set up local development environment
2. Explore the codebase
3. Make small changes to understand flow
4. Review authentication flow in detail
5. Experiment with encryption utilities
6. Try building a new feature

**Resources:**

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [WebAuthn Guide](https://webauthn.guide/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [YOLO Documentation](https://docs.ultralytics.com/)

---

## 📞 Support

- **Feature Requests:** [UserJot Board](https://restrip.userjot.com/)
- **Contact:** [/contact](/contact)
- **Issues:** [GitHub Issues](https://github.com/bjh-developer/restrip/issues)
