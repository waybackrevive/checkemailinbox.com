"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTestPolling } from "@/hooks/useTestPolling";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

/* ─── Status helpers ─── */
type Step = "generated" | "waiting" | "analyzing" | "ready";

function getActiveStep(status: string | undefined): Step {
  if (!status) return "waiting";
  if (status === "ready") return "ready";
  if (status === "processing") return "analyzing";
  return "waiting";
}

function stepIndex(s: Step): number {
  return { generated: 0, waiting: 1, analyzing: 2, ready: 3 }[s];
}

/* ─── ICONS ─── */
function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5V9.5A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}


export default function WaitingPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id as string;
  const { data, isLoading } = useTestPolling(testId);
  const { copied, copy } = useCopyToClipboard();

  // Progressive step display — minimum 1.5s per step so user sees each stage
  const rawStep = getActiveStep(data?.status);
  const rawIdx = stepIndex(rawStep);
  const [displayIdx, setDisplayIdx] = useState(0);
  const advanceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (rawIdx > displayIdx) {
      // Advance one step at a time with minimum delay
      advanceTimer.current = setTimeout(() => {
        setDisplayIdx((prev) => Math.min(prev + 1, rawIdx));
      }, 1500);
      return () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); };
    }
  }, [rawIdx, displayIdx]);

  const activeIdx = displayIdx;
  const activeStep = (["generated", "waiting", "analyzing", "ready"] as Step[])[activeIdx];

  // Countdown timer — 1 hour from page load
  const [secondsLeft, setSecondsLeft] = useState(3600);
  useEffect(() => {
    const iv = setInterval(() => setSecondsLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(iv);
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pct = ((3600 - secondsLeft) / 3600) * 100;

  // Auto-redirect on ready (only after display catches up)
  useEffect(() => {
    if (activeStep === "ready") {
      const t = setTimeout(() => router.push(`/report/${testId}`), 2000);
      return () => clearTimeout(t);
    }
  }, [activeStep, testId, router]);

  const email = data?.email ?? "Loading...";

  const steps = useMemo<{ label: string; icon: string; key: Step }[]>(() => [
    { label: "Address Generated", icon: "✓", key: "generated" },
    { label: "Waiting for Email", icon: "📨", key: "waiting" },
    { label: "Analyzing Email", icon: "🔍", key: "analyzing" },
    { label: "Report Ready", icon: "📊", key: "ready" },
  ], []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <SiteHeader />
      <div className="flex-1 flex flex-col items-center justify-start py-16 px-5 relative overflow-hidden">

      {/* ─── ENVELOPE ANIMATION ─── */}
      <div className="relative mb-10" style={{ width: 200, height: 200 }}>
        {/* Pulse rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border-2 animate-ring-pulse"
              style={{
                width: 120 + i * 50,
                height: 120 + i * 50,
                borderColor: `rgba(14,166,110,${0.15 - i * 0.04})`,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}
        </div>

        {/* Floating envelope */}
        <div className="absolute inset-0 flex items-center justify-center animate-float">
          <div className="w-24 h-24 rounded-[22px] flex items-center justify-center" style={{ background: "linear-gradient(145deg, var(--color-navy), #1a3550)", boxShadow: "0 20px 60px rgba(12,26,46,0.25), 0 8px 24px rgba(12,26,46,0.15)" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="6" y="12" width="36" height="24" rx="4" stroke="white" strokeWidth="2.5" fill="none" />
              <path d="M6 16l18 12 18-12" stroke="#0ea66e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="38" cy="14" r="6" fill="#0ea66e" />
              <path d="M36 14l1.5 1.5L40 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── STATUS BADGE ─── */}
      <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6" style={{ background: activeStep === "ready" ? "var(--color-brand-light)" : "rgba(14,166,110,0.08)", border: `1px solid ${activeStep === "ready" ? "rgba(14,166,110,0.3)" : "rgba(14,166,110,0.15)"}` }}>
        <span className="w-2 h-2 rounded-full animate-blink" style={{ background: activeStep === "ready" ? "var(--color-brand)" : "var(--color-warn)" }} />
        <span className="text-xs font-semibold" style={{ color: activeStep === "ready" ? "var(--color-brand)" : "var(--color-navy)" }}>
          {activeStep === "ready" ? "Report Ready!" : activeStep === "analyzing" ? "Analyzing..." : "Awaiting Email"}
        </span>
      </div>

      {/* ─── PROGRESS STEPS ─── */}
      <div className="flex items-center gap-3 mb-8">
        {steps.map((s, i) => {
          const done = i <= activeIdx;
          const isActive = i === activeIdx;
          return (
            <div key={s.key} className="contents">
              {i > 0 && (
                <div className="w-10 h-[3px] rounded-full" style={{ background: done ? "var(--color-brand)" : "var(--color-border)" }} />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold transition-all ${done ? "text-white" : "text-muted-light"}`}
                  style={{
                    background: done ? "var(--color-brand)" : "var(--color-bg)",
                    border: done ? "none" : "2px solid var(--color-border)",
                    boxShadow: isActive ? "0 0 0 4px rgba(14,166,110,0.15)" : "none",
                  }}
                >
                  {done && i < activeIdx ? "✓" : s.icon}
                </div>
                <span className={`text-[11px] font-medium hidden sm:block ${done ? "text-navy" : "text-muted-light"}`}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── TITLE ─── */}
      <h1 className="font-display text-navy mb-2.5 text-center animate-fadeUp" style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 400, lineHeight: 1.18, letterSpacing: "-1px" }}>
        {activeStep === "ready" ? (
          <>Your report is <em className="italic text-brand">ready!</em></>
        ) : (
          <>Waiting for your <em className="italic text-brand">test email</em></>
        )}
      </h1>
      <p className="text-muted text-[15px] text-center max-w-[420px] mb-8 animate-fadeUp delay-100" style={{ lineHeight: 1.6 }}>
        {activeStep === "ready"
          ? "Redirecting you now..."
          : "Send an email from your regular client (Gmail, Outlook, etc.) to the address below. We'll analyze it instantly."}
      </p>

      {/* ─── EMAIL DISPLAY ─── */}
      <div className="w-full max-w-[480px] mb-8 animate-fadeUp delay-200">
        <div className="font-mono text-[10px] text-muted-light uppercase mb-2 text-left" style={{ letterSpacing: "1.5px" }}>
          Send your test email to:
        </div>
        <div className="flex items-center bg-white border-2 border-border rounded-[12px] py-1.5 pl-4 pr-1.5 gap-2 transition-all hover:border-brand" style={{ boxShadow: "0 2px 12px rgba(12,26,46,0.04)" }}>
          <span className="font-mono text-[13px] font-medium text-navy flex-1 select-all cursor-text truncate">
            {email}
          </span>
          <button
            onClick={() => copy(email)}
            disabled={!data?.email}
            className={`flex items-center gap-1.5 border-none cursor-pointer font-body text-xs font-semibold px-4 py-2.5 rounded-[8px] shrink-0 transition-all ${copied ? "bg-brand" : "bg-navy hover:bg-navy-soft"} text-white disabled:opacity-40`}
          >
            <CopyIcon />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* ─── TIMER CARD ─── */}
      <div className="w-full max-w-[480px] bg-white border border-border rounded-[14px] p-5 mb-5 animate-fadeUp delay-300" style={{ boxShadow: "0 2px 12px rgba(12,26,46,0.04)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold text-navy">⏱ Time Remaining</span>
          <span className="font-mono text-xl font-bold text-navy" style={{ letterSpacing: "-0.5px" }}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--color-border-soft)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${100 - pct}%`,
              background: secondsLeft < 300 ? "var(--color-danger)" : secondsLeft < 900 ? "var(--color-warn)" : "var(--color-brand)",
            }}
          />
        </div>
        <p className="text-[12px] text-muted-light mt-2">Test address expires after 1 hour for security reasons.</p>
      </div>

      {/* ─── TIPS CARD ─── */}
      <div className="w-full max-w-[480px] bg-white border border-border rounded-[14px] p-5 animate-fadeUp delay-400" style={{ boxShadow: "0 2px 12px rgba(12,26,46,0.04)" }}>
        <h3 className="text-sm font-semibold text-navy mb-3">💡 Tips for best results</h3>
        <div className="flex flex-col gap-2.5">
          {[
            { icon: "📧", text: "Send from your real business email — not a test alias" },
            { icon: "✍️", text: "Include your actual subject line and body content" },
            { icon: "🖼️", text: "Attach images if you normally use them in campaigns" },
            { icon: "🔗", text: "Include your real links — we check every URL" },
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[13px] text-muted" style={{ lineHeight: 1.5 }}>
              <span className="text-base shrink-0">{tip.icon}</span>
              <span>{tip.text}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
}
