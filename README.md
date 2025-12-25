# 📸 ReStrip

**Photo strips that come back to you.**

A nostalgic memory platform that transforms your photostrips into emotional time capsules. Memories resurface when you least expect them, creating joy, nostalgia, and shared experiences.

![ReStrip Banner](ReStrip_logo_v2.png)

---

## ✨ What is ReStrip?

ReStrip is a time-delayed memory delivery platform. You upload a photostrip today, and we send it back to you months later via a beautiful surprise email.

**Core Loop:**
1. 📷 **Upload** — Take a photo of your photostrip or upload a digital one
2. ✨ **Auto-crop** — YOLO AI model detects and crops your photostrip perfectly
3. 💬 **Caption** — Add a note for your future self
4. 📅 **Schedule** — Pick a future date (surprise me, custom period, or specific date)
5. 💌 **Receive** — Months later, open a beautiful email and smile

**That's it. That's the magic.**

---

## 🚀 Current Status

### Phase 1: MVP (In Development)
One-page website. No login required. Upload → Auto-crop → Caption → Schedule → Wait → Surprise.

**What's Working:**
- ✅ Image upload with drag & drop
- ✅ AI-powered auto-crop (YOLO11 segmentation model)
- ✅ RunPod serverless GPU processing
- ✅ Toggle between original/cropped preview
- ✅ In-memory caching for cropped images
- ✅ Period picker (surprise/custom period/custom date)
- ✅ Caption textarea
- ✅ Email input field
- ✅ UserJot feedback widget integration

**In Progress:**
- 🔄 Supabase storage integration
- 🔄 Email delivery system
- 🔄 Delivery scheduling & cron jobs

### Phase 2: Coming Soon
- User accounts (optional)
- Memory Vault dashboard
- Canvas to store photostrip memories
- Face detection & social connections
- User analytics
- Advanced scheduling options

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 16.0.4** (App Router, TypeScript)
- **Tailwind CSS** — Styling
- **Shadcn UI** — Component library (Spinner, Dropzone, Switch, Banner, etc.)
- **Lucide React** — Icons

### Backend
- **Supabase** — Database, auth, storage
- **RunPod Serverless** — GPU-based image processing (YOLO inference)
- **Vercel** — Frontend hosting & API routes
- **Next.js API Routes** — Server-side processing (\`/api/crop-image\`)

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
│   ├── app/
│   │   ├── (main)/
│   │   │   └── page.tsx          # Main landing/upload page (4-step flow)
│   │   ├── (misc)/
│   │   │   ├── contact/          # Contact page
│   │   │   └── privacy-policy/   # Privacy policy
│   │   └── api/
│   │       └── crop-image/       # Server-side RunPod API proxy
│   ├── components/
│   │   ├── PeriodPicker.tsx      # Date/period selection component
│   │   ├── ScrollReveal.tsx      # GSAP scroll reveal animation
│   │   ├── ShinyText.tsx         # Animated shiny text effect
│   │   └── ui/shadcn-io/         # Shadcn UI components
│   ├── lib/
│   │   ├── supabase/             # Supabase client & server
│   │   └── utils.ts              # Helper functions
│   └── styles/
│       └── globals.css           # Global styles + custom colors
├── runpod/
│   ├── handler.py                # RunPod serverless handler (YOLO inference)
│   ├── requirements.txt          # Python dependencies
│   └── runs/segment/train/weights/
│       └── best.pt               # YOLO11 trained model weights
├── Dockerfile                     # Docker config for RunPod deployment
└── .env.local                     # Environment variables
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
- Your photos are yours
- We never sell or use them for AI training
- Delete anytime, instantly gone (planned)
- No aggressive tracking
- Transparent data usage

**Security Implementation:**
- ✅ RunPod API key secured server-side (never exposed to client)
- ✅ API route \`/api/crop-image\` proxies RunPod calls
- ✅ Client never sees API keys
- ✅ Environment variables properly scoped (no \`NEXT_PUBLIC_\` for secrets)
- ✅ HTTPS everywhere (Vercel + RunPod)
- 🔄 Supabase Row Level Security (in progress)
- 🔄 Rate limiting (planned)

---

## 📈 Database Schema

### Phase 1 (Planned)

```sql
-- Email-based snaps table (no user accounts yet)
CREATE TABLE snaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  original_image_url TEXT NOT NULL,
  cropped_image_url TEXT,
  caption TEXT,
  period_type VARCHAR(20) NOT NULL,
  send_date DATE NOT NULL,
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX snaps_send_date_idx ON snaps(send_date, delivered);
CREATE INDEX snaps_email_idx ON snaps(email);
```

### Phase 2 (Future)

```sql
-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Social connections & face detection
CREATE TABLE connections (...);
CREATE TABLE face_detections (...);
```

---

## 🐛 Known Issues & Roadmap

### Known Issues
- [x] ~~ScrollReveal animation broke after image upload~~ (Fixed: cleanup now only kills component's own triggers)
- [x] ~~Spinner size not adjustable~~ (Fixed: added inline styles)
- [x] ~~API key exposed to client~~ (Fixed: moved to server-side API route)

### Roadmap
- [x] ✅ Auto-crop feature with YOLO11
- [x] ✅ RunPod serverless deployment
- [x] ✅ Secure API architecture
- [ ] 🔄 Complete Supabase integration (storage + database)
- [ ] 🔄 Email delivery system (Resend or similar)
- [ ] 🔄 Cron job for scheduled delivery
- [ ] Phase 2: User accounts & dashboard
- [ ] Phase 2: Canvas to store photostrip memories
- [ ] Phase 2: Face detection & social connections
- [ ] Advanced image processing (color enhancement, filters)
- [ ] Mobile app (React Native)

See [UserJot Feedback Board](https://restrip.userjot.com/) to suggest features.

---

## 🎯 Project Goals

**Phase 1 (Current):**
- ✅ Build working auto-crop with YOLO AI
- ✅ Deploy RunPod serverless processing
- ✅ Secure API architecture
- 🔄 Complete end-to-end flow (upload → schedule → deliver)
- 🔄 Launch MVP publicly
- 🎯 Get 100+ early testers
- 🎯 Validate core concept
- 🎯 10%+ email open rate

**Phase 2:**
- Build community features (Memory Vault, canvas)
- 20%+ Phase 1 user upgrade rate
- 30% weekly active users
- Launch social graph

**Long-term:**
- Become the go-to platform for nostalgic memories
- Build genuine community around shared moments
- Monetize through premium features

---

## 👥 Team

- **Bek Joon Hao** — Full-stack development, product design

---

## 📞 Support

- **Feature Requests:** [UserJot Board](https://restrip.userjot.com/)
- **Contact:** [/contact](/contact)
- **Issues:** [GitHub Issues](https://github.com/bjh-developer/rereel/issues)

---

## 💝 Acknowledgments

Inspired by photobooth culture and the magic of surprise. Built with love for nostalgia and memories.

Powered by amazing open-source tools:
- [Next.js](https://nextjs.org/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Ultralytics YOLO](https://github.com/ultralytics/ultralytics)
- [RunPod](https://www.runpod.io/)
- [Supabase](https://supabase.com/)
- [GSAP](https://greensock.com/gsap/)

---

## 🎬 The Vision

We live in a world where memories are fleeting, photo strips pile up, and feelings fade. ReStrip slows time down. You capture a moment today and, months later, it comes back to make you smile. 

**ReStrip is a time machine for your happiest moments.**

---

**Photo strips that come back to you.** 📸✨

---

## ⭐ Star This Project

If you like ReStrip, please give it a star! It helps us reach more people and build a better product.

[![GitHub stars](https://img.shields.io/github/stars/bjh-developer/rereel?style=social)](https://github.com/bjh-developer/rereel)
