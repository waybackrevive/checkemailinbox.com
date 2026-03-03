# Logging Approach

## Frontend (Next.js on Vercel)

### Development Mode
- All logs appear in browser console
- Use `logger.info()`, `logger.error()`, `logger.warn()`, `logger.debug()`
- Logs are automatically suppressed in production builds

### Production Mode
- Console logs are disabled to avoid exposing sensitive data
- Use Vercel Analytics for monitoring:
  - Go to Vercel Dashboard → Your Project → Analytics
  - View real-time errors, performance metrics

### Logger Usage

```typescript
import { logger } from "@/lib/logger";

logger.info("User action:", data);
logger.error("API call failed:", error);
logger.warn("Rate limit approaching");
logger.debug("Request details:", req);
```

**Only logs in development mode** — production builds strip these automatically.

---

## Backend (FastAPI on Railway)

### Railway Logs
Access real-time logs:
1. Railway Dashboard → Your service → **Deployments**
2. Click on a deployment → **View Logs**
3. Filter by level: INFO, ERROR, WARN

### Python Logging
Backend uses Python's built-in `logging` module:

```python
import logging

logging.info("Test created: %s", test_id)
logging.error("Redis connection failed: %s", err)
logging.warning("Rate limit hit for IP: %s", ip)
```

### Log Levels
- **INFO** — Normal operations (test created, email received)
- **ERROR** — Failures (Redis down, API error, webhook failed)
- **WARNING** — Non-critical issues (rate limit, SA unavailable)
- **DEBUG** — Detailed diagnostics (only in dev)

---

## Monitoring Production Issues

### Frontend (Vercel)
1. **Vercel Dashboard** → Analytics → Runtime Logs
2. **Browser DevTools** (F12) → Console tab (for user-side debugging)

### Backend (Railway)
1. **Railway Dashboard** → Deployments → View Logs
2. Filter by time range or search for keywords
3. Export logs if needed for analysis

---

## Best Practices

✅ **Do:**
- Use `logger.*` in frontend (dev-only logging)
- Use `logging.*` in backend (Railway captures all)
- Log errors with context (user ID, test ID, timestamp)
- Use appropriate log levels (INFO vs ERROR vs WARNING)

❌ **Don't:**
- Don't use `console.log` directly in production frontend code
- Don't log sensitive data (passwords, tokens, full user emails)
- Don't log excessive debug info in production
- Don't rely on file-based logs in serverless (Vercel)

---

## Debugging Workflow

**When something breaks in production:**

1. **Check Railway logs** (backend issues)
   - Errors, crashes, webhook failures
   
2. **Check Vercel logs** (frontend issues)
   - Build errors, runtime errors

3. **Check browser console** (user-side issues)
   - CORS errors, API failures, JS errors

4. **Reproduce locally** with DevTools open
   - Run `npm run dev` and check detailed logs
