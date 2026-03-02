# IsMyEmailSpam.com — Frontend

Next.js 16 app with TypeScript, Tailwind CSS, TanStack Query. Three pages: Homepage, Waiting Screen, Report Dashboard.

---

## Prerequisites

| Tool    | Version | Why                    |
|---------|---------|------------------------|
| Node.js | 18+     | Runtime                |
| npm     | 9+      | Package manager        |

---

## Quick Start (Local Dev)

### 1. Install Dependencies

```bash
cd frontend
npm install
```

> **Windows note:** If you get a `lightningcss.win32-x64-msvc.node` error, do a clean reinstall:
> ```bash
> Remove-Item -Recurse -Force node_modules, .next, package-lock.json
> npm install
> ```

### 2. Configure Environment

```bash
# .env.local is already created. Edit if needed:
```

`.env.local`:
```dotenv
# Points to your backend API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- For **local dev**: `http://localhost:8000` (backend running via Docker)
- For **production**: Change to your Railway backend URL

### 3. Start Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Make Sure Backend Is Running

The frontend calls three backend endpoints. Without the backend running, the "Start Free Test" button will fail.

```bash
# In a separate terminal:
cd ../backend
docker-compose up
```

---

## Pages

| Route             | File                              | Description                                     |
|-------------------|-----------------------------------|-------------------------------------------------|
| `/`               | `src/app/page.tsx`                | Homepage — CTA, test email, how it works        |
| `/check/[id]`     | `src/app/check/[id]/page.tsx`     | Waiting screen — polls every 5s, auto-redirects |
| `/report/[id]`    | `src/app/report/[id]/page.tsx`    | Report dashboard — score, details, action plan  |

### User Flow

```
  Homepage (/)
      │
      ├─ Click "Start Free Test"
      │  → POST /api/test/create
      │  → Shows test email address with copy button
      │
      ├─ Click "I've Sent It"
      │
      ▼
  Waiting Screen (/check/[id])
      │
      ├─ Polls GET /api/test/{id}/status every 5 seconds
      ├─ Shows pulsing animation
      │
      ├─ When status = "ready"
      │  → Auto-redirects to ▼
      │
      ▼
  Report Dashboard (/report/[id])
      │
      ├─ Score Hero (big score out of 100)
      ├─ Action Plan (WHY + HOW + IMPACT for each issue)
      ├─ Authentication details (SPF, DKIM, DMARC)
      ├─ Reputation details (blacklists, domain age)
      ├─ Content analysis (spam words, images, links)
      └─ SpamAssassin details (rules triggered)
```

---

## Project Structure

```
frontend/
├── .env.local                      # NEXT_PUBLIC_API_URL
├── package.json
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
│
└── src/
    ├── app/
    │   ├── globals.css              # Tailwind + custom animations
    │   ├── layout.tsx               # Root layout (Providers, Toaster, metadata)
    │   ├── page.tsx                 # Homepage
    │   ├── check/[id]/page.tsx      # Waiting screen
    │   └── report/[id]/page.tsx     # Report dashboard
    │
    ├── components/
    │   ├── providers.tsx            # TanStack Query provider
    │   └── ui/
    │       ├── alert.tsx            # Alert with success/warning/error variants
    │       ├── badge.tsx            # Status badges (pass/fail/warning)
    │       ├── button.tsx           # Primary/outline/ghost buttons
    │       ├── card.tsx             # Card, CardHeader, CardContent, etc.
    │       ├── collapsible.tsx      # Expandable sections with chevron
    │       ├── progress.tsx         # Score progress bars
    │       └── skeleton.tsx         # Loading placeholders
    │
    ├── hooks/
    │   ├── useCopyToClipboard.ts    # Copy email address with feedback
    │   └── useTestPolling.ts        # TanStack Query polling (5s interval)
    │
    ├── lib/
    │   ├── api.ts                   # API client (createTest, getTestStatus, getReport)
    │   ├── score.ts                 # Score color/label helpers
    │   └── utils.ts                 # cn() — Tailwind class merger
    │
    └── types/
        └── report.ts                # TypeScript types (mirrors backend schemas)
```

---

## Available Scripts

| Command           | Description                           |
|-------------------|---------------------------------------|
| `npm run dev`     | Start dev server (http://localhost:3000) |
| `npm run build`   | Production build                      |
| `npm run start`   | Start production server               |
| `npm run lint`    | Run ESLint                            |

---

## Tech Stack

| Library               | Purpose                            |
|-----------------------|------------------------------------|
| Next.js 16            | SSR framework (SEO-critical)       |
| React 19              | UI library                         |
| TypeScript            | Type safety                        |
| Tailwind CSS v4       | Utility-first styling              |
| TanStack Query        | Polling, caching, server state     |
| Lucide React          | Icons                              |
| Sonner                | Toast notifications                |
| class-variance-authority | Component variant management    |
| clsx + tailwind-merge | Conditional class merging          |

---

## Production Deployment (Vercel)

### 1. Push to GitHub

Make sure your repo is pushed:

```bash
git add .
git commit -m "frontend ready"
git push
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your GitHub repo
2. Vercel auto-detects Next.js — no config needed
3. Set the **Root Directory** to `frontend` (since backend and frontend are in the same repo)
4. Add environment variable:

| Variable             | Value                                      |
|----------------------|--------------------------------------------|
| `NEXT_PUBLIC_API_URL`| `https://your-api.up.railway.app`          |

5. Click **Deploy**

### 3. Custom Domain (Optional)

1. In Vercel → Project Settings → Domains → Add `ismyemailspam.com`
2. Update DNS at your registrar (Cloudflare recommended):
   - Type: `CNAME`
   - Name: `@`
   - Target: `cname.vercel-dns.com`

### 4. Update Backend CORS

After deploying, update the backend's `FRONTEND_URL` environment variable:

```dotenv
FRONTEND_URL=https://ismyemailspam.com
```

### 5. Estimated Cost

| Service | Cost |
|---------|------|
| Vercel  | Free |

---

## Environment Variables

| Variable               | Required | Default                  | Description                      |
|------------------------|----------|--------------------------|----------------------------------|
| `NEXT_PUBLIC_API_URL`  | **Yes**  | `http://localhost:8000`  | Backend API base URL             |

> **Important:** `NEXT_PUBLIC_` prefix makes it available in browser code. This is intentional — the API URL is not a secret.

---

## Troubleshooting

| Problem                                        | Fix                                                                |
|------------------------------------------------|--------------------------------------------------------------------|
| `lightningcss.win32-x64-msvc.node` not found   | Delete `node_modules`, `.next`, `package-lock.json` → `npm install` |
| "Start Free Test" button fails                 | Backend not running. Start it: `cd ../backend && docker-compose up` |
| CORS errors in browser console                 | Backend `FRONTEND_URL` doesn't match frontend origin               |
| Page shows "Report Not Found"                  | Report expired (1 hour TTL) or test ID is invalid                  |
| Port 3000 already in use                       | Kill the old process: `Get-Process node | Stop-Process -Force`     |
| Build fails with SWC warning                   | Run `npm install` again to patch lockfile                          |

---

## Local Dev Checklist

Before testing the full flow locally, make sure:

- [ ] Backend is running (`docker-compose up` in `backend/`)
- [ ] Frontend dev server is running (`npm run dev` in `frontend/`)
- [ ] `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`
- [ ] Backend `.env` has valid Upstash Redis credentials
- [ ] Mailgun route is set up (use ngrok for local: `ngrok http 8000`)
- [ ] Open `http://localhost:3000` in browser

### Testing Without Mailgun (Mock Flow)

If you don't have Mailgun set up yet, you can test the UI by manually inserting data into Redis:

1. Start the backend and frontend
2. Call `POST http://localhost:8000/api/test/create` in your browser or Postman
3. Use the test ID to visit `http://localhost:3000/check/{id}` (you'll see the waiting screen)
4. Manually hit the webhook endpoint with test data to simulate an email arrival
