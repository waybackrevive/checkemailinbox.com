/**
 * Cloudflare Email Worker — CheckEmailDelivery.com
 * =================================================
 *
 * This Worker receives inbound emails via Cloudflare Email Routing
 * and forwards the complete raw RFC-2822 email to the backend API.
 *
 * Setup:
 *   1. Cloudflare Dashboard → your domain → Email → Email Routing → Enable
 *   2. Workers & Pages → create worker or use `wrangler deploy`
 *   3. Email Routing → Routing Rules → Catch-all → Send to Worker
 *   4. Set environment variables in Worker settings:
 *        BACKEND_URL    = https://your-api.up.railway.app
 *        WORKER_SECRET  = same value as CLOUDFLARE_WORKER_SECRET in backend .env
 */

export default {
  // Handle HTTP requests to the worker URL (health check / browser visits)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Backend -> Worker relay for contact form notifications (no SMTP on backend)
    if (request.method === "POST" && url.pathname === "/contact/send") {
      const providedSecret = request.headers.get("x-worker-secret") || "";
      if ((env.WORKER_SECRET || "") && providedSecret !== env.WORKER_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const body = await request.json();
        const toEmail = body?.to_email || env.CONTACT_EMAIL || "";
        const subject = body?.subject || "Contact Form Submission";
        const text = body?.text || "";
        const html = body?.html || "";
        const fromName = body?.from_name || "CheckEmailDelivery Contact";
        const replyTo = body?.reply_to || "";

        if (!toEmail) {
          return new Response(JSON.stringify({ ok: false, error: "Missing recipient (to_email or CONTACT_EMAIL)" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const mailchannelsPayload = {
          personalizations: [{ to: [{ email: toEmail }] }],
          from: {
            email: env.CONTACT_FROM_EMAIL || "noreply@checkemaildelivery.com",
            name: fromName,
          },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html },
          ],
          reply_to: replyTo ? { email: replyTo } : undefined,
        };

        const mcResp = await fetch("https://api.mailchannels.net/tx/v1/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mailchannelsPayload),
        });

        if (!mcResp.ok) {
          const err = await mcResp.text();
          return new Response(JSON.stringify({ ok: false, error: err }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err?.message || "Bad Request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Email Worker is running. It handles inbound test emails and /contact/send relay.", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  },

  async email(message, env, ctx) {
    const recipient = message.to;
    const sender = message.from;

    console.log(`Received email from ${sender} to ${recipient}`);

    // Validate env vars are set
    if (!env.BACKEND_URL) {
      console.error("BACKEND_URL env variable is not set!");
      message.setReject("Configuration error");
      return;
    }

    try {
      // Read the complete raw email stream as an ArrayBuffer then decode
      const rawArrayBuffer = await new Response(message.raw).arrayBuffer();
      const rawEmail = new TextDecoder("utf-8").decode(rawArrayBuffer);

      if (!rawEmail || rawEmail.length < 10) {
        console.error("Raw email is empty or too small");
        message.setReject("Empty email");
        return;
      }

      console.log(`Raw email size: ${rawEmail.length} bytes, posting to ${env.BACKEND_URL}`);

      // Forward to FastAPI backend (strip trailing slash from BACKEND_URL to avoid double-slash)
      const baseUrl = env.BACKEND_URL.replace(/\/+$/, "");
      const url = `${baseUrl}/api/webhook/cloudflare`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "message/rfc822",
          "X-Worker-Secret": env.WORKER_SECRET || "",
          "X-Recipient": recipient,
          "X-Sender": sender,
        },
        body: rawEmail,
      });

      const responseText = await response.text();
      console.log(`Backend responded: ${response.status} - ${responseText}`);

      if (!response.ok) {
        console.error(`Backend error ${response.status}: ${responseText}`);
        message.setReject(`Backend error ${response.status}`);
        return;
      }

      // Success — email processed, do NOT reject
      console.log(`Successfully processed email for ${recipient}`);

    } catch (error) {
      console.error("Worker error:", error.message, error.stack);
      message.setReject("Worker processing failed");
    }
  },
};
