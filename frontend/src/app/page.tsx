"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTest, ApiError } from "@/lib/api";
import { logger } from "@/lib/logger";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5V9.5A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { copied, copy } = useCopyToClipboard();
  const [testEmail, setTestEmail] = useState<string | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const revealRef = useRef<HTMLDivElement[]>([]);

  // Intersection observer for reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function handleStartTest() {
    setLoading(true);
    setErrorMsg(null);
    createTest()
      .then((data) => {
        setTestEmail(data.email);
        setTestId(data.id);
      })
      .catch((err) => {
        logger.error("handleStartTest failed:", err);
        logger.debug("API URL:", process.env.NEXT_PUBLIC_API_URL || "undefined (using default)");
        
        if (err instanceof ApiError && err.status === 429) {
          setErrorMsg("RATE_LIMIT");
        } else if (err.message?.includes("Failed to fetch") || err.name === "TypeError") {
          setErrorMsg("Cannot connect to server. Please check your internet connection or try again later.");
        } else {
          setErrorMsg(err.message || "Something went wrong. Please try again in a moment.");
        }
      })
      .finally(() => setLoading(false));
  }

  function handleCopy() {
    if (testEmail) {
      copy(testEmail);
      setHasCopied(true);
      toast.success("Email copied! Now send your email to it.");
    }
  }

  function handleGoWaiting() {
    if (testId) router.push(`/check/${testId}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <SiteHeader />

      {/* ─── HERO ─── */}
      <section className="relative z-[1] pt-[90px] pb-20 px-6 text-center overflow-hidden">
        <div className="hero-bg" />
        <div className="hero-grid" />

        {/* Badge */}
        <div className="inline-flex items-center gap-[7px] bg-brand-light border border-brand/25 text-brand text-xs font-semibold px-3.5 py-1.5 rounded-full mb-7 animate-fadeUp" style={{ letterSpacing: "0.3px" }}>
          <span className="w-[7px] h-[7px] bg-brand rounded-full animate-pulse-dot" />
          Free · No signup · Results in 60 seconds
        </div>

        {/* Heading */}
        <h1 className="font-display text-navy mb-5 animate-fadeUp delay-100" style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 400, lineHeight: 1.12, letterSpacing: "-1.5px" }}>
          Will Your Email<br />Actually <em className="italic text-brand">Reach</em> the Inbox?
        </h1>

        {/* Subtext */}
        <p className="text-muted max-w-[500px] mx-auto mb-11 animate-fadeUp delay-200" style={{ fontSize: "clamp(15px, 2vw, 18px)", fontWeight: 400, lineHeight: 1.65 }}>
          Send us a test email. We run a full delivery audit — authentication,
          reputation, content, blacklists — and show you exactly what to fix.
        </p>

        {/* ─── EMAIL BOX ─── */}
        <div id="hero-cta" className="max-w-[560px] mx-auto mb-4 animate-fadeUp delay-300">

          {/* State: not started yet — show CTA button */}
          {!testEmail && !loading && !errorMsg && (
            <button
              onClick={handleStartTest}
              className="w-full bg-navy text-white border-none cursor-pointer font-body text-sm sm:text-[15px] font-semibold px-4 sm:px-8 py-3 sm:py-4 rounded-[14px] transition-all hover:bg-navy-soft"
              style={{ boxShadow: "0 4px 24px rgba(12,26,46,0.14), 0 1px 3px rgba(12,26,46,0.06)" }}
            >
              🚀 Start Free Test — Generate My Test Address
            </button>
          )}

          {/* State: loading */}
          {loading && (
            <div className="flex items-center justify-center gap-3 bg-white border-2 border-border rounded-[14px] py-4 px-6" style={{ boxShadow: "0 4px 24px rgba(12,26,46,0.06)" }}>
              <span className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted font-medium">Creating your unique test address…</span>
            </div>
          )}

          {/* State: rate limit */}
          {errorMsg === "RATE_LIMIT" && !loading && (
            <div className="rounded-[14px] p-5" style={{ background: "rgba(14,166,110,0.06)", border: "1.5px solid rgba(14,166,110,0.2)" }}>
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">🌱</span>
                <div>
                  <p className="text-sm font-semibold text-navy mb-1">You&apos;ve used today&apos;s free tests</p>
                  <p className="text-[13px] text-muted mb-3" style={{ lineHeight: 1.6 }}>
                    We&apos;re in early beta and currently offer <strong className="text-navy">5 free tests per day</strong> per
                    user. This tool is free forever — we just have limited resources right now and want
                    to make sure everyone gets a fair share.
                  </p>
                  <p className="text-[13px] text-muted mb-3" style={{ lineHeight: 1.6 }}>
                    Your tests reset daily at <strong className="text-navy">00:00 UTC</strong>.
                    Come back after reset for a fresh set.
                  </p>
                  <a
                    href="/contact"
                    className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand hover:underline"
                  >
                    💬 Share feedback or request more tests
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* State: generic error */}
          {errorMsg && errorMsg !== "RATE_LIMIT" && !loading && (
            <div className="rounded-[14px] p-5" style={{ background: "rgba(245,158,11,0.08)", border: "1.5px solid rgba(245,158,11,0.3)" }}>
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-navy mb-1">Something went wrong</p>
                  <p className="text-[13px] text-muted" style={{ lineHeight: 1.6 }}>{errorMsg}</p>
                </div>
              </div>
            </div>
          )}

          {/* State: test created — show email + copy */}
          {testEmail && !loading && (
            <>
              <div className="font-mono text-[11px] text-muted-light uppercase mb-2.5 text-left" style={{ letterSpacing: "1.5px" }}>
                Your unique test address
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white border-2 border-border rounded-[14px] py-1.5 sm:pl-[18px] sm:pr-1.5 p-3 sm:p-0 gap-2 sm:gap-2.5 transition-all hover:border-brand hover:shadow-[0_0_0_4px_rgba(14,166,110,0.1),0_4px_24px_rgba(12,26,46,0.06)]" style={{ boxShadow: "0 4px 24px rgba(12,26,46,0.06), 0 1px 3px rgba(12,26,46,0.04)" }}>
                <span className="font-mono text-xs sm:text-sm font-medium text-navy flex-1 select-all cursor-text break-all sm:break-normal text-center sm:text-left py-2 sm:py-0">
                  {testEmail}
                </span>
                <button
                  onClick={handleCopy}
                  className={`flex items-center justify-center gap-[7px] border-none cursor-pointer font-body text-xs sm:text-[13px] font-semibold px-4 sm:px-5 py-2.5 sm:py-[11px] rounded-[10px] shrink-0 whitespace-nowrap transition-all ${copied ? "bg-brand" : "bg-navy hover:bg-navy-soft"} text-white w-full sm:w-auto`}
                >
                  <CopyIcon />
                  <span>{copied ? "✓ Copied!" : "Copy Address"}</span>
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-muted-light text-center animate-fadeUp delay-350">
          🔒 Deleted automatically after 1 hour · We never read your content · 5 free tests/day, reset 00:00 UTC
        </p>

        {/* ─── "I've Sent It" CTA — appears after copy ─── */}
        {hasCopied && testId && (
          <div className="mt-5 animate-fadeUp">
            <button
              onClick={handleGoWaiting}
              className="bg-brand text-white text-xs sm:text-sm font-semibold px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl border-none cursor-pointer transition-all hover:opacity-90 w-full sm:w-auto max-w-xs sm:max-w-none mx-auto"
              style={{ boxShadow: "0 4px 16px rgba(14,166,110,0.3)" }}
            >
              I&apos;ve Sent My Email → Check Status
            </button>
          </div>
        )}

        {/* ─── STEPS ROW ─── */}
        <div className="flex items-center justify-center gap-2 sm:gap-1.5 flex-wrap max-w-[620px] mx-auto mt-9 animate-fadeUp delay-400 px-2">
          {[
            { num: "1", text: "Copy the address above" },
            { num: "2", text: "Send your real email to it" },
            { num: "3", text: "Come back for your full report" },
          ].map((step, i) => (
            <div key={step.num} className="contents">
              {i > 0 && <span className="text-muted-light text-base hidden sm:inline">→</span>}
              <div className="flex items-center gap-1.5 sm:gap-2 bg-white border border-border rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-[13px] text-navy font-medium w-full sm:w-auto justify-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <span className="w-4 h-4 sm:w-5 sm:h-5 bg-navy text-white rounded-full text-[10px] sm:text-[11px] font-bold flex items-center justify-center shrink-0 font-mono">
                  {step.num}
                </span>
                <span className="hidden sm:inline">{step.text}</span>
                <span className="sm:hidden">{step.text.replace("Copy the address above", "Copy address").replace("Send your real email to it", "Send email").replace("Come back for your full report", "Get report")}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TRUST BAR ─── */}
      <div className="bg-white border-y border-border py-3 sm:py-4 px-4 sm:px-6 text-center">
        <div className="max-w-[800px] mx-auto flex items-center justify-center gap-3 sm:gap-8 flex-wrap">
          {["✅ SPF · DKIM · DMARC checked", "🌍 15+ Blacklist databases", "📊 SpamAssassin powered", "🔒 Data deleted in 1 hour", "⚡ No signup required"].map((item, i) => (
            <div key={i} className="contents">
              {i > 0 && <span className="text-border text-lg hidden md:inline">|</span>}
              <span className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-[12.5px] text-muted font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── HOW IT WORKS ─── */}
      <section className="bg-white py-20 px-6" id="how">
        <div className="max-w-[1100px] mx-auto">
          <div className="reveal">
            <span className="inline-block font-mono text-[11px] font-semibold text-brand uppercase mb-3.5" style={{ letterSpacing: "2px" }}>How it works</span>
            <h2 className="font-display text-navy mb-3.5" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, lineHeight: 1.18, letterSpacing: "-0.8px" }}>
              Three steps to <em className="italic text-brand">full clarity</em>
            </h2>
            <p className="text-[15px] text-muted max-w-[520px]" style={{ lineHeight: 1.7 }}>
              No technical knowledge needed. Just send us an email — we handle everything else.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[2px] mt-13 border-2 border-border rounded-[18px] overflow-hidden reveal" style={{ transitionDelay: "0.1s" }}>
            {[
              { step: "STEP 01", icon: "📧", title: "Send a test email", desc: "Copy the unique address we generate for you. Open your email client — Gmail, Outlook, anything. Send your real campaign email to that address, exactly as you would to a client." },
              { step: "STEP 02", icon: "🔍", title: "We audit everything", desc: "The moment your email arrives, we run it through 6 layers of checks — authentication, blacklists, spam scoring, content analysis, link safety, and domain reputation. All in under 60 seconds." },
              { step: "STEP 03", icon: "✅", title: "Get your action plan", desc: "See your full Delivery Health Report. Not just pass/fail — every issue comes with a plain-English explanation of why it matters and the exact steps to fix it." },
            ].map((card) => (
              <div key={card.step} className="p-9 bg-white hover:bg-bg transition-colors md:border-l-2 md:first:border-l-0 border-border max-md:border-t-2 max-md:first:border-t-0">
                <div className="font-mono text-[11px] text-muted-light uppercase mb-5" style={{ letterSpacing: "2px" }}>{card.step}</div>
                <div className="w-[52px] h-[52px] bg-brand-light rounded-[14px] flex items-center justify-center mb-5 text-2xl">{card.icon}</div>
                <h3 className="font-display text-xl text-navy mb-2.5" style={{ fontWeight: 400, letterSpacing: "-0.3px" }}>{card.title}</h3>
                <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHAT WE CHECK ─── */}
      <section className="py-20 px-6" id="checks" style={{ background: "var(--color-bg)" }}>
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-13 items-start mt-0">

            {/* Left - Text + Checks */}
            <div>
              <span className="inline-block font-mono text-[11px] font-semibold text-brand uppercase mb-3.5 reveal" style={{ letterSpacing: "2px" }}>What we check</span>
              <h2 className="font-display text-navy mb-3.5 reveal" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, lineHeight: 1.18, letterSpacing: "-0.8px", transitionDelay: "0.05s" }}>
                Every reason<br />an email <em className="italic text-brand">fails</em>
              </h2>
              <p className="text-[15px] text-muted max-w-[520px] reveal" style={{ lineHeight: 1.7, transitionDelay: "0.1s" }}>
                Most tools tell you one thing. We check everything that matters — the same signals real spam filters use.
              </p>

              <div className="flex flex-col gap-1 mt-8">
                {[
                  { icon: "🔐", color: "bg-brand-light", title: "Email Authentication (SPF, DKIM, DMARC)", desc: "The \"Big Three\" that Gmail & Outlook verify. Missing any = instant trust loss." },
                  { icon: "🌍", color: "bg-navy/5", title: "IP & Domain Blacklist Status", desc: "We check 15+ real-time blacklists. Being listed = your emails blocked globally." },
                  { icon: "📊", color: "bg-warn-light", title: "SpamAssassin Spam Score", desc: "Industry's #1 spam engine. The same filter most mail servers run by default." },
                  { icon: "✍️", color: "bg-brand-light", title: "Content Analysis", desc: "Spam trigger words, ALL CAPS subject lines, image-to-text ratio, URL shorteners." },
                  { icon: "🔗", color: "bg-navy/5", title: "Link Safety Check", desc: "Every link in your email is tested — broken links and blacklisted domains both flag." },
                  { icon: "📅", color: "bg-warn-light", title: "Domain Age & Reputation", desc: "New domains are treated with suspicion. We surface this risk before it hurts you." },
                ].map((item, i) => (
                  <div key={item.title} className="flex items-start gap-4 p-5 bg-white border border-border rounded-xl transition-all hover:border-brand hover:shadow-[0_4px_20px_rgba(14,166,110,0.08)] hover:translate-x-1 cursor-default reveal" style={{ transitionDelay: `${0.1 + i * 0.05}s` }}>
                    <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-lg shrink-0 ${item.color}`}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-navy mb-0.5">{item.title}</h4>
                      <p className="text-[13px] text-muted" style={{ lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Report Preview */}
            <div className="reveal" style={{ transitionDelay: "0.2s" }}>
              <div className="bg-white border border-border rounded-[18px] overflow-hidden" style={{ boxShadow: "0 8px 40px rgba(12,26,46,0.08)" }}>
                {/* Browser bar */}
                <div className="bg-navy px-5 py-4 flex items-center gap-2.5">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
                  </div>
                  <div className="flex-1 rounded-md px-3 py-1" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <span className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>checkemaildelivery.com/report/a7x2k</span>
                  </div>
                </div>

                <div className="p-5">
                  {/* Score */}
                  <div className="rp-score-block rounded-xl p-5 mb-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-mono text-[10px] uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "2px" }}>Delivery Score</div>
                      <div className="font-display text-5xl text-white" style={{ fontWeight: 400, lineHeight: 1, letterSpacing: "-2px" }}>
                        62<span className="text-2xl text-warn">/100</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border text-[11px] font-semibold" style={{ background: "rgba(245,158,11,0.2)", borderColor: "rgba(245,158,11,0.4)", color: "var(--color-warn)" }}>
                        ⚠️ Medium Risk
                      </div>
                    </div>
                    <div className="flex-[2]">
                      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.1)" }}>
                        <div className="h-full rounded-full score-bar-amber animate-fillBar" style={{ width: "62%" }} />
                      </div>
                      <div className="flex justify-between font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        <span>0</span><span>50</span><span>100</span>
                      </div>
                    </div>
                  </div>

                  {/* Check rows */}
                  <div className="flex flex-col gap-2">
                    {[
                      { icon: "🔐", label: "SPF Authentication", status: "pass", text: "✓ PASS" },
                      { icon: "✍️", label: "DKIM Signature", status: "fail", text: "✕ FAIL" },
                      { icon: "🛡️", label: "DMARC Policy", status: "warn", text: "⚠ MISSING" },
                      { icon: "🌍", label: "Blacklist Status", status: "pass", text: "✓ CLEAN" },
                      { icon: "📊", label: "SpamAssassin", status: "warn", text: "⚠ 5.2 / 10" },
                      { icon: "✍️", label: "Spam Words Found", status: "fail", text: "✕ 3 FOUND" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between p-3 rounded-lg border border-border text-[13px]" style={{ background: "var(--color-bg)" }}>
                        <span className="flex items-center gap-2.5 font-medium text-navy">{row.icon} {row.label}</span>
                        <span className={`font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          row.status === "pass" ? "text-brand bg-brand-light border-brand/20" :
                          row.status === "fail" ? "text-danger bg-danger-light border-danger/20" :
                          "text-warn bg-warn-light border-warn/25"
                        }`}>{row.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action preview */}
                  <div className="mt-3 rounded-[10px] p-4" style={{ background: "linear-gradient(135deg, rgba(14,166,110,0.05), rgba(14,166,110,0.02))", border: "1px solid rgba(14,166,110,0.2)" }}>
                    <div className="font-mono text-xs font-bold text-brand uppercase mb-2" style={{ letterSpacing: "1px" }}>🔧 Your Action Plan</div>
                    {[
                      { dot: "bg-danger", text: <><strong>Add DKIM record</strong> — Without it, Gmail can&apos;t verify you. Inbox placement drops by up to 40%.</> },
                      { dot: "bg-danger", text: <><strong>Remove &quot;FREE&quot; and &quot;ACT NOW&quot;</strong> — Replace with &quot;complimentary&quot; and &quot;available now&quot;.</> },
                      { dot: "bg-warn", text: <span className="text-muted">Add DMARC policy to protect your sender reputation...</span> },
                    ].map((fix, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12.5px] text-navy mb-1.5 last:mb-0" style={{ lineHeight: 1.5 }}>
                        <span className={`w-[5px] h-[5px] ${fix.dot} rounded-full shrink-0 mt-[7px]`} />
                        <span>{fix.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="bg-navy py-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center max-w-[520px] mx-auto reveal">
            <span className="inline-block font-mono text-[11px] font-semibold uppercase mb-3.5" style={{ color: "rgba(14,166,110,0.8)", letterSpacing: "2px" }}>What users say</span>
            <h2 className="font-display text-white mb-3.5" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, lineHeight: 1.18, letterSpacing: "-0.8px" }}>
              Tools they <em className="italic text-brand">actually</em> bookmark
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            {[
              { text: "\"Finally a tool that doesn't just say 'SPF: PASS' and leave me confused. It told me exactly why my DKIM was failing and gave me the DNS record to fix it. Took 10 minutes.\"", name: "Sarah R.", role: "Freelance Consultant", initials: "SR" },
              { text: "\"My cold email open rates went from 12% to 34% after fixing the issues this tool found. I had no idea my domain was on a blacklist. This should be everyone's first stop.\"", name: "Marcus K.", role: "Sales Lead, B2B Agency", initials: "MK" },
              { text: "\"I set this up for clients before any email campaign. It's replaced three separate tools I was using. The action plan alone is worth more than most paid tools charge.\"", name: "Amir J.", role: "Email Marketing Specialist", initials: "AJ" },
            ].map((t, i) => (
              <div key={i} className="rounded-[14px] p-7 transition-colors reveal" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", transitionDelay: `${0.1 + i * 0.05}s` }}>
                <div className="text-[#fbbf24] text-sm mb-3.5">★★★★★</div>
                <p className="text-sm italic mb-5" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-brand font-mono" style={{ background: "rgba(14,166,110,0.2)", border: "2px solid rgba(14,166,110,0.3)" }}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-white">{t.name}</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 px-6" style={{ background: "var(--color-bg)" }}>
        <div className="max-w-[1100px] mx-auto">
          <div className="bg-white border border-border rounded-3xl py-16 px-10 text-center relative overflow-hidden max-w-[700px] mx-auto reveal" style={{ boxShadow: "0 4px 40px rgba(12,26,46,0.06)" }}>
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg, var(--color-brand), #34d399, var(--color-brand))" }} />
            <span className="inline-block font-mono text-[11px] font-semibold text-brand uppercase mb-3.5" style={{ letterSpacing: "2px" }}>Run your free test</span>
            <h2 className="font-display text-navy mb-3" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, lineHeight: 1.18, letterSpacing: "-0.8px" }}>
              Check <em className="italic text-brand">before</em> you send
            </h2>
            <p className="text-[15px] text-muted max-w-[520px] mx-auto mb-9" style={{ lineHeight: 1.7 }}>
              Copy the address below, send your email, and see your full report in under 60 seconds. Free. No signup.
            </p>
            <div className="max-w-[480px] mx-auto">
              {/* Not started yet */}
              {!testEmail && !loading && !errorMsg && (
                <button
                  onClick={handleStartTest}
                  className="w-full bg-brand text-white border-none cursor-pointer font-body text-[15px] font-bold px-8 py-4 rounded-[14px] transition-all hover:opacity-90 mb-3"
                  style={{ boxShadow: "0 4px 16px rgba(14,166,110,0.3)" }}
                >
                  🚀 Generate My Test Address
                </button>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center gap-3 rounded-[14px] py-4 px-6 mb-3" style={{ background: "var(--color-bg)", border: "2px solid var(--color-border)" }}>
                  <span className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted font-medium">Creating…</span>
                </div>
              )}

              {/* Rate limit */}
              {errorMsg === "RATE_LIMIT" && !loading && (
                <div className="rounded-[14px] p-4 mb-3" style={{ background: "rgba(14,166,110,0.06)", border: "1.5px solid rgba(14,166,110,0.2)" }}>
                  <p className="text-[13px] text-muted text-center mb-1.5" style={{ lineHeight: 1.5 }}>
                    🌱 Today&apos;s 5 free tests are used up — resets at 00:00 UTC.
                  </p>
                  <p className="text-center">
                    <a href="/contact" className="text-[12px] font-semibold text-brand hover:underline">Need more? Share feedback →</a>
                  </p>
                </div>
              )}

              {/* Generic error */}
              {errorMsg && errorMsg !== "RATE_LIMIT" && !loading && (
                <div className="rounded-[14px] p-4 mb-3" style={{ background: "rgba(245,158,11,0.08)", border: "1.5px solid rgba(245,158,11,0.3)" }}>
                  <p className="text-[13px] text-muted text-center" style={{ lineHeight: 1.5 }}>⚠️ {errorMsg}</p>
                </div>
              )}

              {/* Test created */}
              {testEmail && !loading && (
                <div className="flex items-center border-2 border-border rounded-[14px] py-1.5 pl-[18px] pr-1.5 gap-2.5 mb-3 transition-colors hover:border-brand" style={{ background: "var(--color-bg)" }}>
                  <span className="font-mono text-[13px] text-navy flex-1">{testEmail}</span>
                  <button
                    onClick={handleCopy}
                    className="bg-brand text-white border-none cursor-pointer font-body text-[13px] font-bold px-5 py-3 rounded-[10px] whitespace-nowrap transition-all hover:opacity-90"
                  >
                    {copied ? "✓ Copied!" : "Copy & Start Test"}
                  </button>
                </div>
              )}

              <p className="text-xs text-muted-light text-center">
                🔒 Auto-deleted in 1 hour · Works with Gmail, Outlook, any provider · 5 free tests/day, reset 00:00 UTC
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI EMAIL WRITER CTA ─── */}
      <section className="py-16 px-6 reveal" style={{ background: "linear-gradient(135deg, rgba(14,166,110,0.05) 0%, rgba(12,26,46,0.03) 100%)" }}>
        <div className="max-w-[900px] mx-auto">
          <div className="bg-white border border-border rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-8" style={{ boxShadow: "0 4px 40px rgba(12,26,46,0.06)" }}>
            <div className="w-16 h-16 bg-gradient-to-br from-brand to-brand/70 rounded-2xl flex items-center justify-center shrink-0">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-display text-navy text-2xl mb-2">Need Help Writing Your Email?</h3>
              <p className="text-muted text-[15px] mb-0">
                Transform your rough ideas into polished, <span className="text-brand font-semibold">spam-free</span> professional emails with our free AI-powered writing assistant.
              </p>
            </div>
            <a
              href="/tools/email-writer"
              className="shrink-0 bg-navy text-white font-semibold px-6 py-3 rounded-xl hover:bg-navy/90 transition-all flex items-center gap-2"
            >
              ✨ Try AI Email Writer
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <SiteFooter />
    </div>
  );
}
