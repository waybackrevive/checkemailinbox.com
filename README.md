# IsMyEmailSpam.com

**Free email deliverability diagnostic tool.** Send a test email, get a plain-English report on what's wrong and how to fix it.

> "People send emails that silently die in spam folders. Existing tools say 'SPF: PASS' — which means nothing to them. We tell them WHY it's failing and WHAT to fix, in plain English."

---

## What It Does

1. **User visits homepage** → gets a unique test email address
2. **User sends an email** to that address from their real inbox
3. **We analyze everything**: SPF, DKIM, DMARC, blacklists, spam words, content quality, SpamAssassin
4. **User gets a report** with a 0-100 score, clear explanations, and a step-by-step action plan

---

## Project Structure

```
ismyemailspam/
├── backend/          # Python FastAPI + SpamAssassin (Docker)
│   └── README.md     # ← Full backend setup guide
│
├── frontend/         # Next.js 16 + TypeScript + Tailwind
│   └── README.md     # ← Full frontend setup guide
│
└── README.md         # ← You are here
```

Each directory has its own detailed README with setup instructions.

---

## Local Development — Full Setup

### Step 1: Start the Backend

```bash
cd backend

# Copy env template and fill in your values
cp ".env copy.example" .env
# Edit .env → add Upstash Redis URL/Token, Resend Webhook Secret

# Option A: With Docker (includes SpamAssassin)
docker-compose up --build

# Option B: Without Docker (SpamAssassin gracefully degrades)
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac
pip install -r requirements.txt python-dotenv
cd ..
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be at `http://localhost:8000`. Verify: `curl http://localhost:8000/health`

### Step 2: Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be at `http://localhost:3000`.

### Step 3: Set Up Resend (for receiving test emails)

1. Add your domain at [resend.com](https://resend.com) → verify DNS
2. Set MX record: `MX @ inbound-smtp.resend.com 10`
3. Create a webhook:
   - Endpoint: `https://YOUR_PUBLIC_URL/api/webhook/resend`
   - Events: `email.received`

For local testing, expose your backend with ngrok:

```bash
ngrok http 8000
# → https://abc123.ngrok.io
# Use this URL in Resend webhook: https://abc123.ngrok.io/api/webhook/resend
```

### Step 4: Test the Full Flow

1. Open `http://localhost:3000`
2. Click **"Start Free Test"** → copy the test email address
3. Send an email to that address from Gmail/Outlook
4. Wait on the checking screen (polls every 5 seconds)
5. View your deliverability report

---

## Required External Services (All Free Tier)

| Service        | Purpose                  | Free Tier              | Setup Link                              |
|----------------|--------------------------|------------------------|-----------------------------------------|
| Upstash Redis  | Temp session storage     | 10,000 requests/day    | [upstash.com](https://upstash.com)      |
| Resend         | Receive inbound emails   | 100 emails/day         | [resend.com](https://resend.com)        |
| ngrok          | Local webhook tunnel     | Unlimited (with limits)| [ngrok.com](https://ngrok.com)          |

---

## Production Deployment

| Component    | Platform       | Cost      |
|-------------|----------------|-----------|
| **Frontend** | Vercel         | Free      |
| **Backend**  | Railway.app    | ~$5/month |
| **Redis**    | Upstash        | Free      |
| **Email**    | Resend         | Free      |
| **DNS**      | Cloudflare     | Free      |

### Deploy Steps

1. Push to GitHub
2. **Frontend**: Import repo in [Vercel](https://vercel.com), set root directory to `frontend`, add `NEXT_PUBLIC_API_URL`
3. **Backend**: Import repo in [Railway](https://railway.app), add SpamAssassin as Docker service, set env vars
4. **Resend**: Update webhook URL to Railway URL, verify MX records
5. **DNS**: Point `ismyemailspam.com` to Vercel via Cloudflare

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for detailed deployment instructions.

---

## Tech Stack

| Layer     | Technology                                                    |
|-----------|---------------------------------------------------------------|
| Frontend  | Next.js 16, React 19, TypeScript, Tailwind CSS v4, TanStack Query |
| Backend   | Python 3.11, FastAPI, Pydantic                                |
| Analysis  | dkimpy, pyspf, checkdmarc, SpamAssassin, BeautifulSoup       |
| Storage   | Upstash Redis (serverless, TTL auto-expire)                   |
| Email     | Resend Inbound Webhooks                                       |
| Hosting   | Vercel (frontend) + Railway (backend)                         |

---

## Scoring Formula

```
Final Score = (Authentication × 0.35) + (Reputation × 0.25) + (SpamAssassin × 0.25) + (Content × 0.15)
```

| Score   | Risk Level | Meaning                        |
|---------|------------|--------------------------------|
| 80-100  | Low        | Good — should reach inbox      |
| 50-79   | Medium     | Needs work — may land in spam  |
| 0-49    | High       | Poor — likely going to spam    |

---

## Environment Variables Summary

### Backend (`backend/.env`)

| Variable                | Required | Description                              |
|-------------------------|----------|------------------------------------------|
| `MAIL_DOMAIN`           | No       | Domain for test emails                   |
| `UPSTASH_REDIS_URL`     | **Yes**  | Upstash Redis REST URL                   |
| `UPSTASH_REDIS_TOKEN`   | **Yes**  | Upstash Redis auth token                 |
| `RESEND_WEBHOOK_SECRET` | No       | Resend webhook signing secret (prod)     |
| `SPAMASSASSIN_HOST`     | No       | Default: `spamassassin` (Docker)         |
| `SPAMASSASSIN_PORT`     | No       | Default: `783`                           |
| `FRONTEND_URL`          | No       | CORS origin, default: `localhost:3000`   |

### Frontend (`frontend/.env.local`)

| Variable               | Required | Description                      |
|------------------------|----------|----------------------------------|
| `NEXT_PUBLIC_API_URL`  | **Yes**  | Backend API URL                  |
