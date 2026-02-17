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

ReStrip is a **time-delayed memory delivery platform** that allows users to upload photo strips today and receive them back months later via email or Telegram. The platform implements **server-side encryption** for secure data storage and uses **Clerk** for modern OAuth authentication.

### Key Features

- 🔐 **Secure Storage**: Server-side AES-256-GCM encryption for data at rest
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

**Version**: 2.0 (Clerk Migration)  
**Status**: Active Development - Core features complete, new features added (Gallery, Scrapbook)

---

## 2. Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher ([Download](https://nodejs.org/))
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Git**: For version control
- **Clerk Account**: For authentication ([Sign up](https://clerk.com/))
- **Supabase Account**: For database and storage ([Sign up](https://supabase.com/))
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
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (server-side only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `ENCRYPTION_SECRET` | Yes | Server-side encryption key (generate with `openssl rand -base64 32`) |
| `CROP_BACKEND` | No | `local` or `runpod` (default: `runpod`) |
| `LOCAL_CROP_URL` | No | Local FastAPI crop server URL |
| `RUNPOD_API_KEY` | No | RunPod API key for AI cropping |
| `RUNPOD_ENDPOINT_ID` | No | RunPod endpoint ID |
| `TURNSTILE_SECRET_KEY` | No | Cloudflare Turnstile secret key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | Cloudflare Turnstile site key |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `TELEGRAM_WEBHOOK_SECRET` | No | Telegram webhook secret |

#### 4. Supabase Setup

**Run Database Migrations:**

Apply migrations from `supabase/migrations/` in order in your Supabase SQL Editor:

10. **010_gallery_rls_indexes.sql** - Gallery RLS policies and indexes
11. **011_clerk_migration.sql** - Clerk authentication migration (core tables and policies)
12. **012_ensure_encryption_columns.sql** - Ensure encryption columns exist
13. **013_telegram_link_token.sql** - Telegram link token support
14. **014_canvas_books.sql** - Scrapbook tables (canvas_books, canvas_pages)
15. **015_rename_to_scrapbook.sql** - Rename canvas to scrapbook

**Note:** Migration 011 creates all core tables needed for the current system. Migrations 001-009 are legacy migrations for the old passkey authentication system and are not needed.

**Verification:**

After running migrations, verify with:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('snaps', 'canvas_books', 'canvas_pages');

-- Check snaps table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'snaps';

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('snaps', 'canvas_books', 'canvas_pages');
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
Sign Up (Clerk) → Upload Photo → Auto-Crop (optional) → Add Caption → Schedule → Encrypt (server) → Store → [Time Passes] → Deliver → View
```

**Key Files to Understand First:**

| File | Purpose | Priority |
|------|---------|----------|
| `src/app/(protected)/upload/page.tsx` | Main upload flow (start here!) | ⭐⭐⭐ |
| `src/app/(protected)/gallery/page.tsx` | Gallery view for browsing memories | ⭐⭐⭐ |
| `src/app/(protected)/scrapbook/[bookId]/page.tsx` | Scrapbook editor with drag-and-drop | ⭐⭐⭐ |
| `src/proxy.ts` | Clerk middleware for route protection | ⭐⭐ |
| `src/lib/simple-encryption.ts` | Server-side encryption utilities | ⭐⭐ |
| `src/lib/rate-limit.ts` | API rate limiting | ⭐⭐ |
| `src/lib/scrapbook-api.ts` | Scrapbook API client | ⭐⭐ |
| `runpod/handler.py` | AI image cropping | ⭐ |

**Data Flow Summary:**

1. **Upload**: Image → Server receives → Server-side encryption → Supabase Storage
2. **Store**: Encrypted metadata → Supabase Database (snaps table)
3. **Deliver**: Cron job → Edge Function → Decrypt (server) → Email/Telegram
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

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/upload(.*)",
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
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
  const snaps = await supabase
    .from("snaps")
    .select("*")
    .eq("user_id", userId);
    
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

**Migration Files (current system):**

**Note:** Migration numbering starts at 010 because migrations 001-009 were for the legacy passkey authentication system and are no longer needed. New installations only need to run migrations 010-015.

10. `010_gallery_rls_indexes.sql` - Gallery RLS policies and performance indexes
11. `011_clerk_migration.sql` - Clerk authentication migration (creates core tables, removes passkey tables)
12. `012_ensure_encryption_columns.sql` - Ensures encryption columns exist
13. `013_telegram_link_token.sql` - Adds Telegram link token support
14. `014_canvas_books.sql` - Creates scrapbook tables (canvas_books, canvas_pages)
15. `015_rename_to_scrapbook.sql` - Renames canvas references to scrapbook

**Important:** Migration 011 creates all necessary core tables. Migrations 001-009 are legacy and not required.

**Tables Created:**

- `snaps` - User's encrypted memories with delivery metadata
- `canvas_books` - Scrapbook albums
- `canvas_pages` - Scrapbook pages with JSONB elements

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

**canvas_books table:**

```sql
CREATE TABLE public.canvas_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    cover_color TEXT NOT NULL,  -- One of 10 preset colors
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Stores scrapbook albums. Each user can have multiple books.

**canvas_pages table:**

```sql
CREATE TABLE public.canvas_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.canvas_books(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    elements JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_page_number UNIQUE (book_id, page_number)
);
```

Stores individual pages in scrapbooks. `elements` is a JSONB array containing:
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

### Authentication

Authentication is handled by **Clerk** - no custom authentication endpoints needed. Use Clerk's built-in components and hooks:

- `<SignIn />` and `<SignUp />` components
- `useUser()`, `useAuth()` hooks on client
- `auth()` helper on server

### Image Processing

| Endpoint          | Method | Purpose                                      |
| ----------------- | ------ | -------------------------------------------- |
| `/api/crop-image` | POST   | Proxy to RunPod/FastAPI for AI cropping     |

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

| Endpoint              | Method | Purpose                            |
| --------------------- | ------ | ---------------------------------- |
| `/api/create-snap`    | POST   | Create new memory                  |
| `/api/upload`         | POST   | Upload image (anonymous)           |
| `/api/upload/authenticated` | POST | Upload image (authenticated) |
| `/api/snaps/[id]`     | GET    | Get specific memory metadata       |
| `/api/snaps/[id]`     | DELETE | Delete memory                      |

### Gallery

| Endpoint          | Method | Purpose                           |
| ----------------- | ------ | --------------------------------- |
| `/api/gallery`    | GET    | List all user's memories (paginated) |
| `/api/gallery/[id]` | GET  | Get specific memory details       |
| `/api/images/[id]` | GET   | Serve image with caching          |

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

| Endpoint                                        | Method | Purpose                     |
| ----------------------------------------------- | ------ | --------------------------- |
| `/api/scrapbook/books`                          | GET    | List user's scrapbooks      |
| `/api/scrapbook/books`                          | POST   | Create new scrapbook        |
| `/api/scrapbook/books/[bookId]`                 | GET    | Get scrapbook details       |
| `/api/scrapbook/books/[bookId]`                 | PUT    | Update scrapbook            |
| `/api/scrapbook/books/[bookId]`                 | DELETE | Delete scrapbook            |
| `/api/scrapbook/books/[bookId]/pages`           | GET    | List pages in scrapbook     |
| `/api/scrapbook/books/[bookId]/pages`           | POST   | Create new page             |
| `/api/scrapbook/books/[bookId]/pages/[pageId]` | GET    | Get page details            |
| `/api/scrapbook/books/[bookId]/pages/[pageId]` | PUT    | Update page elements        |
| `/api/scrapbook/books/[bookId]/pages/[pageId]` | DELETE | Delete page                 |

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

  return Response.json({ userId, email: user?.emailAddresses[0]?.emailAddress });
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
