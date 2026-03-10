"use client";

import { useEffect, useRef, useState } from "react";

const LAUNCH_DATE = new Date("2026-03-10T00:00:00Z");
const EXPIRY_DAYS = 7;
const LS_KEY = "ced_launch_v1";

function isExpired() {
  const expiry = new Date(LAUNCH_DATE.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return new Date() > expiry;
}

function hasSeenBefore(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return true;
  }
}

function markAsSeen() {
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch {
    // ignore
  }
}

function runConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [
    "#0ea66e", "#3b82f6", "#f59e0b", "#ef4444",
    "#8b5cf6", "#ec4899", "#ffffff", "#fbbf24",
  ];

  const pieces = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height * 0.6,
    w: Math.random() * 9 + 4,
    h: Math.random() * 5 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 3.5 + 1.5,
    rotation: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.18,
  }));

  const startTime = performance.now();
  const duration = 4000;

  function animate(now: number) {
    const elapsed = now - startTime;
    if (elapsed > duration) {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    const opacity = elapsed > 2800 ? 1 - (elapsed - 2800) / 1200 : 1;

    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;
      if (p.y > canvas.height + 10) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }

      ctx!.save();
      ctx!.globalAlpha = Math.max(0, opacity);
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rotation);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx!.restore();
    });

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

export default function LaunchCelebration() {
  const [mounted, setMounted] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isExpired() || hasSeenBefore()) return;

    setMounted(true);

    if (canvasRef.current) {
      runConfetti(canvasRef.current);
    }

    const cardTimer = setTimeout(() => setCardVisible(true), 900);
    const dismissTimer = setTimeout(() => dismiss(), 9000);

    return () => {
      clearTimeout(cardTimer);
      clearTimeout(dismissTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    setCardVisible(false);
    setTimeout(() => setMounted(false), 500);
    markAsSeen();
  }

  if (!mounted) return null;

  return (
    <>
      {/* Confetti canvas — pointer-events none so nothing is blocked */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 998, width: "100%", height: "100%" }}
      />

      {/* Warm personal card */}
      <div
        className="fixed bottom-6 right-6 pointer-events-auto"
        style={{ zIndex: 999, maxWidth: "300px" }}
      >
        <div
          className={`transition-all duration-500 ease-out ${
            cardVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
          }`}
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            boxShadow:
              "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
            padding: "20px",
            position: "relative",
          }}
        >
          {/* Close */}
          <button
            onClick={dismiss}
            aria-label="Close"
            style={{
              position: "absolute",
              top: "12px",
              right: "14px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
              color: "#b0b8c1",
              padding: "2px 4px",
            }}
          >
            ×
          </button>

          {/* Emoji */}
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🎉</div>

          {/* Headline */}
          <p
            style={{
              margin: "0 0 6px",
              fontWeight: 700,
              fontSize: "15px",
              color: "#111827",
              lineHeight: 1.3,
            }}
          >
            You&apos;re one of our first visitors
          </p>

          {/* Personal message */}
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "13px",
              color: "#6b7280",
              lineHeight: 1.65,
            }}
          >
            We just launched — and you found us. That genuinely means a lot to
            us. Thank you for being here this early. ✨
          </p>

          {/* Product Hunt badge */}
          <a
            href="https://www.producthunt.com/products/checkemaildelivery?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-checkemaildelivery"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="CheckEmailDelivery on Product Hunt"
              width="210"
              height="46"
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1094499&theme=light&t=1773155296647"
              style={{ display: "block" }}
            />
          </a>
        </div>
      </div>
    </>
  );
}
