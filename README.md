# 🎬 ReReel

**Capture now. Feel later.**

A nostalgic memory platform that transforms your photostrips into emotional time capsules. Memories resurface when you least expect them, creating joy, nostalgia, and shared experiences.

![ReReel Banner](ReReel_logo_v1.png)

---

## ✨ What is ReReel?

ReReel is a time-delayed memory delivery platform. You upload a photostrip today, and we send it back to you months later via a beautiful surprise email.

**Core Loop:**
1. 📷 **Capture** — Take a photo of your photostrip or upload a digital one
2. ✨ **Process** — AI auto-detects and enhances your photostrip
3. 💬 **Caption** — Add a note for your future self
4. 📅 **Schedule** — Pick a future date (or let us surprise you)
5. 💌 **Receive** — Months later, open a beautiful email and smile

**That's it. That's the magic.**

---

## 🚀 Quick Start

### Phase 1: MVP (Live Now)
One-page website. No login required. Capture → Schedule → Wait → Surprise.

### Phase 2: Coming Soon
User accounts, Memory Vault dashboard, social features, face detection, and more.

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14+** (App Router, TypeScript)
- **Tailwind CSS** — Styling
- **React Hook Form** + **Zod** — Form validation
- **Lucide React** — Icons

### Backend
- **Supabase** — Database, auth, storage, cron jobs
- **RunPod** — Serverless GPU for Python image processing
- **Resend** — Email delivery
- **Vercel** — Hosting & deployment

### Image Processing
- **Python** + **OpenCV** — Photostrip detection & cropping
- **Pillow** — Image enhancement

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase account
- RunPod account
- Resend account

### 1. Clone & Install

```bash
git clone https://github.com/bjh-developer/rereel.git
cd rereel
npm install
```

### 2. Environment Variables

Create a `.env.local` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# RunPod (Python image processing)
RUNPOD_ENDPOINT=your_runpod_api_endpoint

# Resend (Email)
RESEND_API_KEY=your_resend_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up Supabase

```bash
# Create database tables
supabase db push

# Create storage buckets
supabase storage create snaps-original
supabase storage create snaps-processed
```

### 4. Deploy RunPod Handler

See `/runpod/handler.py` for the photostrip detection Python code.

1. Create RunPod account
2. Upload handler code
3. Deploy
4. Add endpoint URL to `.env.local`

### 5. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000`

---

## 📁 Project Structure

```
rereel/
├── src/
│   ├── app/
│   │   ├── (main)/
│   │   │   ├── page.tsx          # Main landing/upload page
│   │   │   └── layout.tsx
│   │   ├── (auth)/               # Phase 2: Authentication routes
│   │   ├── (protected)/          # Phase 2: Dashboard, upload, settings
│   │   ├── api/
│   │   │   ├── upload/           # Upload to Supabase Storage
│   │   │   ├── process-snap/     # Call RunPod for image processing
│   │   │   └── create-snap/      # Save snap metadata to database
│   │   └── layout.tsx
│   ├── components/
│   │   ├── CameraCapture.tsx     # Live camera + capture
│   │   ├── CaptionForm.tsx       # Caption + email + date form
│   │   └── shared/               # Reusable components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # Client-side Supabase
│   │   │   └── server.ts         # Server-side Supabase
│   │   ├── validators/           # Zod schemas
│   │   └── utils.ts              # Helper functions
│   └── styles/
│       └── globals.css
├── public/
│   ├── logo.svg
│   └── favicon.ico
├── runpod/
│   ├── handler.py                # Python photostrip detection
│   └── requirements.txt
├── .env.local                    # Environment variables (DO NOT COMMIT)
├── next.config.js
├── tailwind.config.js
└── README.md
```

---

## 🎨 Brand & Design

**Tagline:** "Capture now. Feel later."

**Color Palette:**
- Warm Beige: `#F3E8D8`
- Soft Black: `#1C1C1C`
- Blush Pink: `#FFC9D1`
- Pastel Blue: `#CFE7FF`

**Typography:**
- Headlines: Playfair Display
- Body: Inter
- Accents: Caveat (handwritten)

See `BRAND.md` for full brand guidelines.

---

## 📊 Key Features

### Phase 1 (MVP - Live)
- ✅ Camera capture + file upload
- ✅ AI photostrip detection & processing
- ✅ Caption & scheduling
- ✅ Email collection
- ✅ Cron job for email delivery
- ✅ Beautiful email template

### Phase 2 (Coming Soon)
- 🔜 User authentication (Google OAuth)
- 🔜 Memory Vault dashboard
- 🔜 Face detection & social connections
- 🔜 User analytics
- 🔜 Advanced scheduling
- 🔜 Shareable links

---

## 🔐 Security & Privacy

**Privacy Promise:**
- Your photos are yours
- We never sell or use them for AI training
- Delete anytime, instantly gone
- No aggressive tracking
- Optional local-only processing

**Security Measures:**
- Supabase Row Level Security (RLS) enabled
- Service key only used on server
- Environment variables never exposed
- HTTPS everywhere
- Rate limiting on API routes

See `PRIVACY.md` for full privacy policy.

---

## 📈 Database Schema

### Phase 1 (MVP)

```sql
-- Email-based snaps table (no user accounts yet)
CREATE TABLE snaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  image_url TEXT NOT NULL,
  processed_image_url TEXT,
  caption TEXT,
  send_date DATE NOT NULL,
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX snaps_send_date_idx ON snaps(send_date, delivered);
```

### Phase 2 (Additive)

```sql
-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Social connections
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  connected_user_id UUID NOT NULL REFERENCES auth.users(id),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Face detection data
CREATE TABLE face_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snap_id UUID NOT NULL REFERENCES snaps(id),
  face_encoding TEXT,
  face_x INT, face_y INT, face_w INT, face_h INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Camera captures photo correctly
- [ ] File upload works on desktop & mobile
- [ ] Image processing completes successfully
- [ ] Email form validates correctly
- [ ] Scheduled snap saves to database
- [ ] Confirmation email sent
- [ ] Cron job triggers daily
- [ ] Email arrives on scheduled date
- [ ] Email renders beautifully on mobile

### Run Tests

```bash
# End-to-end testing (coming soon)
npm run test

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## 🐛 Known Issues & Roadmap

### Known Issues
- [ ] Image processing timeout on very large files (workaround: compress before upload)
- [ ] Email sometimes takes 5+ minutes to deliver (Resend occasional delay)

### Roadmap
- [ ] Phase 2: User accounts & dashboard
- [ ] Phase 2: Face detection & social connections
- [ ] Advanced image processing (perspective correction, color enhancement)
- [ ] Mobile app (React Native)
- [ ] Analytics dashboard
- [ ] Monetization features (premium tiers)

See [Issues](https://github.com/yourusername/rereel/issues) for more.

---

## 🤝 Contributing

Contributions welcome! Please read `CONTRIBUTING.md` first.

### Development Workflow

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style
- Use TypeScript (no `any` types)
- Follow ESLint rules
- Format with Prettier
- Write descriptive commit messages

---

## 📚 Documentation

- **[Brand Guidelines](./BRAND.md)** — Logo, colors, typography, tone
- **[Privacy Policy](./PRIVACY.md)** — Data handling & user rights
- **[API Documentation](./docs/API.md)** — Endpoint reference
- **[Deployment Guide](./docs/DEPLOYMENT.md)** — How to deploy

---

## 🎯 Project Goals

**Phase 1:** 
- Launch viral MVP
- Get 100+ users
- Validate core concept
- 10%+ email open rate

**Phase 2:**
- Build community features
- 20%+ Phase 1 user upgrade rate
- 30% weekly active users
- Launch social graph

**Long-term:**
- Become the go-to platform for nostalgic memories
- Build genuine community around shared moments
- Monetize through premium features
- Possible acquisition target

---

## 👥 Team

- **Bek Joon Hao** — Full-stack development, product design

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/rereel/issues)

---

## 💝 Acknowledgments

- Inspired by photobooth culture and the magic of surprise
- Built with love for nostalgia
- Powered by amazing open-source tools

---

## 🎬 The Vision

We live in a world where memories are fleeting and photos pile up endlessly. ReReel slows time down. You capture a moment today, and months later, it comes back to make you smile.

**ReReel is a time machine for your happiest moments.**

---

**Capture now. Feel later.** ✨

---

## Star ⭐

If you like ReReel, please give it a star! It helps us reach more people and build a better product.

[![GitHub stars](https://img.shields.io/github/stars/bjh-developer/rereel?style=social)](https://github.com/bjh-developer/rereel)