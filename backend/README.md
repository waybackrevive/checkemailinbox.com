# IsMyEmailSpam.com — Backend API

FastAPI + SpamAssassin backend that receives emails via Resend inbound webhook, runs full deliverability analysis (SPF, DKIM, DMARC, blacklists, content, SpamAssassin), and returns a plain-English report.

---

## Architecture

```
┌────────────────────────────────────────────────┐
│  Docker Compose                                │
│                                                │
│  ┌──────────────────┐  ┌────────────────────┐  │
│  │  FastAPI (api)   │  │  SpamAssassin      │  │
│  │  Port 8000       │──│  Port 783          │  │
│  └──────────────────┘  └────────────────────┘  │
│          │                                     │
│          ├── Upstash Redis (cloud)             │
│          └── Resend Webhook (inbound email)    │
└────────────────────────────────────────────────┘
```

## Prerequisites

| Tool      | Version | Why                        |
|-----------|---------|----------------------------|
| Docker    | 20+     | Runs API + SpamAssassin    |
| Python    | 3.11+   | Only if running without Docker |

---

## Quick Start (Local Dev)

### 1. Set Up External Services (Free Tier)

You need two external services. Both have free tiers:

#### Upstash Redis (temp storage)
1. Go to [upstash.com](https://upstash.com) → Create a free Redis database
2. Copy the **REST URL** and **REST Token** from the dashboard

#### Resend (inbound email)
1. Go to [resend.com](https://resend.com) → sign up (free: 100 emails/day)
2. Add your domain → verify it (DNS records)
3. Set up **Inbound Emails**:
   - Go to **Settings** → **Webhooks** → **Add Webhook**
   - Endpoint URL: `https://YOUR_BACKEND_URL/api/webhook/resend`
   - Events: select `email.received`
   - (For local dev, use [ngrok](https://ngrok.com) to expose localhost:8000)
4. Set **MX records** on your domain pointing to Resend:
   ```
   MX  @  inbound-smtp.resend.com  10
   ```
5. Copy the **Webhook Signing Secret** from the webhook settings

### 2. Configure Environment

```bash
cd backend

# Copy the example env file
cp ".env copy.example" .env

# Edit .env with your real values
```

Fill in your `.env`:

```dotenv
# Domain for test email addresses
MAIL_DOMAIN=ismyemailspam.com

# Upstash Redis
UPSTASH_REDIS_URL=https://your-db.upstash.io
UPSTASH_REDIS_TOKEN=your-token-here

# Resend
RESEND_WEBHOOK_SECRET=whsec_your-secret-here

# SpamAssassin (keep defaults for Docker)
SPAMASSASSIN_HOST=spamassassin
SPAMASSASSIN_PORT=783

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 3. Run with Docker Compose

```bash
docker-compose up --build
```

This starts:
- **FastAPI** on `http://localhost:8000`
- **SpamAssassin** on port 783 (internal, used by API)

### 4. Verify It's Running

```bash
# Health check
curl http://localhost:8000/health
# → {"status":"ok"}

# API docs (auto-generated)
open http://localhost:8000/docs
```

---

## Running WITHOUT Docker (Dev Only)

If you prefer running Python directly (SpamAssassin will gracefully degrade):

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt python-dotenv

# Edit .env — set SPAMASSASSIN_HOST=localhost
# (SpamAssassin won't be available, but the API still works — SA returns score 0.0)

# Start the API (run from the parent directory so imports resolve)
cd ..
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

> **Note:** Without SpamAssassin, the SA section returns a neutral 0.0 score. All other analysis (SPF, DKIM, DMARC, blacklists, content) works fully.

---

## API Endpoints

| Method | Path                       | Description                              |
|--------|----------------------------|------------------------------------------|
| POST   | `/api/test/create`         | Create a new test session, get test email |
| GET    | `/api/test/{id}/status`    | Poll for email arrival (every 5s)        |
| POST   | `/api/webhook/resend`      | Resend posts inbound emails here         |
| GET    | `/api/report/{id}`         | Get the full analysis report             |
| GET    | `/health`                  | Health check for Docker/Railway          |
| GET    | `/docs`                    | Auto-generated Swagger UI                |

### Test Flow

```
1. Frontend calls POST /api/test/create
   → Returns: { id: "7a2b4f8e", email: "test-7a2b4f8e@ismyemailspam.com" }

2. User sends email to test-7a2b4f8e@ismyemailspam.com

3. Resend receives it (via MX records) → POSTs JSON to /api/webhook/resend
   → Runs SPF, DKIM, DMARC, blacklists, content, SpamAssassin analysis
   → Saves report to Redis, sets status to "ready"

4. Frontend polls GET /api/test/7a2b4f8e/status every 5 seconds
   → Returns: { status: "waiting" | "received" | "processing" | "ready" }

5. When status is "ready", frontend calls GET /api/report/7a2b4f8e
   → Returns full EmailReport JSON
```

---

## Project Structure

```
backend/
├── main.py                     # FastAPI app entry point
├── config.py                   # Settings from environment variables
├── Dockerfile                  # Python 3.11 container
├── docker-compose.yml          # API + SpamAssassin
├── requirements.txt            # Python dependencies
├── .env                        # Your local env (DO NOT COMMIT)
├── .env copy.example           # Template for .env
│
├── api/routes/
│   ├── test.py                 # POST /api/test/create, GET /api/test/{id}/status
│   ├── webhook.py              # POST /api/webhook/resend
│   └── report.py               # GET /api/report/{id}
│
├── services/
│   ├── email_generator.py      # Generates test IDs and test email addresses
│   ├── header_parser.py        # SPF, DKIM, DMARC checks
│   ├── content_analyzer.py     # Spam words, image ratio, links, content scoring
│   ├── blacklist_checker.py    # IP & domain blacklist DNS lookups
│   ├── spamassassin.py         # TCP client for SpamAssassin daemon
│   ├── score_calculator.py     # Weighted score formula (Auth 35%, Rep 25%, SA 25%, Content 15%)
│   └── report_builder.py       # Builds full report with action plan (WHY + HOW + IMPACT)
│
├── models/
│   └── schemas.py              # Pydantic models (data contract with frontend)
│
├── storage/
│   └── redis_client.py         # Upstash Redis wrapper
│
└── data/
    ├── spam_words.json          # 80+ trigger words in 6 categories
    └── blacklists.json          # IP blacklists (12 RBLs) + domain blacklists (8 DBLs)
```

---

## Testing Locally with ngrok

Resend needs a public URL to send webhooks. Use [ngrok](https://ngrok.com) during local dev:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 8000

# You'll get a URL like: https://abc123.ngrok.io
# Use this in your Resend webhook settings:
# Endpoint URL: https://abc123.ngrok.io/api/webhook/resend
```

---

## Production Deployment (Railway.app)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/your-user/ismyemailspam.git
git push -u origin main
```

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your repo
3. Railway will auto-detect the Dockerfile
4. Add a **new service** for SpamAssassin:
   - Click **+ New** → **Docker Image** → `instantlinux/spamassassin:latest`
   - This creates a private network hostname (e.g., `spamassassin.railway.internal`)

### 3. Set Environment Variables in Railway

In your API service settings, add:

| Variable                       | Value                                      |
|--------------------------------|--------------------------------------------|
| `MAIL_DOMAIN`                  | `ismyemailspam.com`                        |
| `UPSTASH_REDIS_URL`            | `https://your-db.upstash.io`               |
| `UPSTASH_REDIS_TOKEN`          | `your-token`                               |
| `RESEND_WEBHOOK_SECRET`        | `whsec_your-secret`                        |
| `SPAMASSASSIN_HOST`            | `spamassassin.railway.internal`            |
| `SPAMASSASSIN_PORT`            | `783`                                      |
| `FRONTEND_URL`                 | `https://ismyemailspam.com`                |

### 4. Update Resend Webhook

In Resend dashboard → Webhooks → update the endpoint URL:
```
https://your-api.up.railway.app/api/webhook/resend
```

### 5. Estimated Cost

| Service        | Cost          |
|----------------|---------------|
| Railway API    | ~$5/mo        |
| SpamAssassin   | included      |
| Upstash Redis  | Free (10K/day)|
| Resend         | Free (100/day)|

---

## Environment Variable Reference

| Variable                | Required | Default                | Description                              |
|-------------------------|----------|------------------------|------------------------------------------|
| `MAIL_DOMAIN`           | No       | `ismyemailspam.com`    | Domain for test email addresses          |
| `UPSTASH_REDIS_URL`     | **Yes**  | —                      | Upstash Redis REST API URL               |
| `UPSTASH_REDIS_TOKEN`   | **Yes**  | —                      | Upstash Redis auth token                 |
| `RESEND_WEBHOOK_SECRET` | No       | —                      | Resend webhook signing secret (skip in dev) |
| `SPAMASSASSIN_HOST`     | No       | `spamassassin`         | SA host (`spamassassin` in Docker, `localhost` for local dev) |
| `SPAMASSASSIN_PORT`     | No       | `783`                  | SpamAssassin spamd port                  |
| `FRONTEND_URL`          | No       | `http://localhost:3000`| CORS origin for frontend                 |

---

## Troubleshooting

| Problem                            | Fix                                                              |
|------------------------------------|------------------------------------------------------------------|
| `Connection refused` on port 783   | SpamAssassin not running. Use `docker-compose up` or set `SPAMASSASSIN_HOST=localhost` (graceful fallback) |
| Redis errors                       | Check `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` in `.env`   |
| Webhook not receiving emails       | Check Resend webhook URL + MX records. Use ngrok for local dev   |
| Rate limit hit (429)               | Max 3 tests/day per IP. Wait 24h or clear Redis                 |
| CORS errors in browser             | Check `FRONTEND_URL` matches your frontend origin                |
| Docker build fails on Windows      | Make sure Docker Desktop is running with WSL2 backend            |
