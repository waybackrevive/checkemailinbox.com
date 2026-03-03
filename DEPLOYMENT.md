# Production Deployment Guide

Complete step-by-step guide to deploy CheckEmailDelivery.com to Railway (backend) + Vercel (frontend).

---

## Prerequisites

Before you start, you need:

- [x] GitHub repo with your code
- [x] Upstash Redis account → [upstash.com/redis](https://upstash.com)
- [x] Resend account → [resend.com](https://resend.com)
- [x] Railway account → [railway.app](https://railway.app)
- [x] Vercel account → [vercel.com](https://vercel.com)
- [x] Domain (optional: Hostinger, Namecheap, etc.)

---

## PART 1: Deploy Backend to Railway

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **"Deploy from GitHub repo"**
3. Choose your repo: `checkemaildelivery.com`
4. Railway will auto-detect the Dockerfile and start building

### 1.2 Set Environment Variables

Go to your Railway service → **Variables** tab → Add these:

| Variable | Value | Example |
|----------|-------|---------|
| `MAIL_DOMAIN` | Your domain | `checkemaildelivery.com` |
| `UPSTASH_REDIS_URL` | From Upstash dashboard | `https://your-db.upstash.io` |
| `UPSTASH_REDIS_TOKEN` | From Upstash dashboard | `AXqtACQ...` |
| `RESEND_WEBHOOK_SECRET` | From Resend webhook settings | `whsec_abc123...` |
| `SPAMASSASSIN_HOST` | Docker service name | `spamassassin` |
| `SPAMASSASSIN_PORT` | SpamAssassin port | `783` |
| `FRONTEND_URL` | Your frontend URLs (comma-separated) | See below ⬇️ |

**For `FRONTEND_URL`, use comma-separated list:**
```
https://checkemaildelivery.vercel.app,https://checkemaildelivery.com,http://localhost:3000
```
👆 Replace `checkemaildelivery.vercel.app` with your actual Vercel URL

### 1.3 Get Railway Backend URL

After deployment completes:
1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://checkemaildelivery-production.up.railway.app`)
4. **Save this URL** — you'll need it for Vercel and Resend!

### 1.4 Test Backend Health

```bash
curl https://your-backend.up.railway.app/health
# Should return: {"status":"ok"}
```

---

## PART 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Project

1. Go to [vercel.com](https://vercel.com) → **Add New...** → **Project**
2. Import your GitHub repo: `checkemaildelivery.com`
3. **Root Directory**: `frontend`
4. **Framework Preset**: Next.js (auto-detected)

### 2.2 Set Environment Variable

Before clicking **Deploy**, add this environment variable:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your Railway backend URL from step 1.3 |

👆 Example: `https://checkemaildelivery-production.up.railway.app`

⚠️ **CRITICAL REQUIREMENTS:**
- ✅ **MUST start with `https://`** — Do not omit the protocol!
- ✅ **No trailing slash** at the end
- ❌ Wrong: `checkemaildelivery-production.up.railway.app` (missing https://)
- ❌ Wrong: `https://checkemaildelivery-production.up.railway.app/` (trailing slash)
- ✅ Correct: `https://checkemaildelivery-production.up.railway.app`

### 2.3 Deploy

Click **Deploy** → Wait 1-2 minutes → ✅ Done!

### 2.4 Get Vercel URL

After deployment:
1. Copy the Vercel URL (e.g., `https://checkemaildelivery-production.vercel.app`)
2. **Go back to Railway** → Variables → Update `FRONTEND_URL` to include this URL

---

## PART 3: Configure Resend Webhook

### 3.1 Set Webhook URL

1. Go to [resend.com/webhooks](https://resend.com/webhooks)
2. Click **"Add Webhook"**
3. **Endpoint URL**: `https://your-backend.up.railway.app/api/webhook/resend`
   👆 Replace with your Railway backend URL
4. **Events**: Select **"Email Received"** (`email.received`)
5. Click **"Create Webhook"**

### 3.2 Get Webhook Secret

1. After creating the webhook, copy the **Signing Secret** (starts with `whsec_`)
2. Go to **Railway** → Variables → Update `RESEND_WEBHOOK_SECRET`

---

## PART 4: Configure Domain (Optional)

### 4.1 Point Domain to Vercel

If you have a custom domain (e.g., from Hostinger):

**In Hostinger DNS:**
| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `76.76.19.21` | 3600 |
| CNAME | www | `cname.vercel-dns.com` | 3600 |

**In Vercel Dashboard:**
1. Go to your project → **Settings** → **Domains**
2. Add `checkemaildelivery.com`
3. Add `www.checkemaildelivery.com`
4. Vercel will auto-verify and provision SSL (takes 5-10 min)

### 4.2 Configure Email Routing (Resend)

**In Hostinger (or your DNS provider):**

Add MX records for Resend:

| Type | Name | Value | Priority | TTL |
|------|------|-------|----------|-----|
| MX | @ | `feedback-smtp.us-east-1.amazonses.com` | 10 | 3600 |

**In Resend Dashboard:**
1. Go to **Domains** → Add `checkemaildelivery.com`
2. Verify DNS records
3. Wait for green checkmarks (5-15 min)

---

## PART 5: Verification Checklist

### ✅ Backend (Railway)

- [ ] Health check works: `curl https://your-backend.up.railway.app/health`
- [ ] Swagger docs accessible: `https://your-backend.up.railway.app/docs`
- [ ] All environment variables set (8 total)
- [ ] CORS includes all frontend URLs

### ✅ Frontend (Vercel)

- [ ] Site loads: `https://your-site.vercel.app`
- [ ] `NEXT_PUBLIC_API_URL` environment variable set
- [ ] Console shows no CORS errors
- [ ] "Run Free Test" button creates test email

### ✅ Resend

- [ ] Domain verified (green checkmarks)
- [ ] Webhook endpoint set to Railway URL
- [ ] Webhook secret added to Railway variables
- [ ] MX records pointing to Resend

### ✅ Custom Domain (if applicable)

- [ ] DNS records added (A + CNAME)
- [ ] Domain added in Vercel
- [ ] SSL certificate issued
- [ ] `FRONTEND_URL` in Railway updated with custom domain

---

## Troubleshooting

### "405 Method Not Allowed" or URL concatenation error

**Problem:** Console shows URLs like `https://yoursite.vercel.app/yourbackend.railway.app/api/...`

**Cause:** `NEXT_PUBLIC_API_URL` in Vercel is missing the `https://` protocol prefix.

**Fix:**
1. Go to Vercel → Settings → Environment Variables
2. Find `NEXT_PUBLIC_API_URL`
3. Make sure it starts with `https://`:
   - ❌ Wrong: `checkemaildelivery-production.up.railway.app`
   - ✅ Correct: `https://checkemaildelivery-production.up.railway.app`
4. Save and **Redeploy**

**Note:** Our code now auto-adds `https://` if missing, but it's best to set it correctly.

### "Something went wrong" error on frontend

**Problem:** Frontend can't reach backend or CORS error.

**Check:**
1. Open browser DevTools → Console tab
2. Look for errors like:
   - `Failed to fetch` → Backend URL wrong or backend crashed
   - `CORS policy` → `FRONTEND_URL` not set correctly in Railway
3. Verify `NEXT_PUBLIC_API_URL` in Vercel matches Railway backend URL

**Fix:**
1. Go to Railway → Variables → Check `FRONTEND_URL` includes your Vercel URL
2. Go to Vercel → Settings → Environment Variables → Check `NEXT_PUBLIC_API_URL`
3. Redeploy both services

### Backend crashes on Railway

**Check logs:**
Railway Dashboard → your service → Deployments → View Logs

**Common issues:**
- Missing environment variables → Add them in Variables tab
- Port binding error → Railway provides `$PORT` env var (our code handles this)
- Redis connection failed → Check `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN`

### Webhook not receiving emails

**Check:**
1. Resend dashboard → Webhooks → Check endpoint URL matches Railway
2. Send test email → Check Railway logs for POST `/api/webhook/resend`
3. Verify `RESEND_WEBHOOK_SECRET` in Railway matches Resend dashboard

### Domain not working

**Check:**
1. DNS propagation (can take up to 24h, usually 5-10 min)
2. Use [dnschecker.org](https://dnschecker.org) to verify records
3. Vercel → Settings → Domains → Check status

---

## Cost Summary

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Railway | Free / Hobby | $0 - $5 |
| Vercel | Hobby | $0 |
| Upstash Redis | Free | $0 (10K requests/day) |
| Resend | Free | $0 (100 emails/day) |
| Hostinger Domain | One-time | ~$10/year |
| **TOTAL** | | **$0 - $5/mo** |

---

## Environment Variables Quick Reference

### Railway (Backend) — 8 variables

```bash
MAIL_DOMAIN=checkemaildelivery.com
UPSTASH_REDIS_URL=https://your-db.upstash.io
UPSTASH_REDIS_TOKEN=AXqtACQ...
RESEND_WEBHOOK_SECRET=whsec_abc123...
SPAMASSASSIN_HOST=spamassassin
SPAMASSASSIN_PORT=783
FRONTEND_URL=https://yourdomain.vercel.app,https://yourdomain.com
```

### Vercel (Frontend) — 1 variable

```bash
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

---

## Need Help?

If deployment fails:
1. Check Railway logs (Deployments → View Logs)
2. Check Vercel logs (Deployments → Function Logs)
3. Check browser console (F12 → Console tab)
4. Verify all environment variables are set correctly
5. Make sure no trailing slashes in URLs
6. Confirm CORS origins match exactly (https vs http, www vs non-www)
