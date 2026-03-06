"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

// Spam trigger words database - categorized by severity
const SPAM_WORDS = {
  high: [
    "ACT NOW", "URGENT", "FREE", "FREE GIFT", "100% FREE", "ZERO COST", 
    "NO COST", "NO OBLIGATION", "CLICK HERE", "CLICK BELOW", "BUY NOW",
    "ORDER NOW", "MAKE MONEY", "EARN MONEY", "CASH BONUS", "DOUBLE YOUR",
    "MILLION DOLLARS", "WINNER", "CONGRATULATIONS", "YOU HAVE WON",
    "CLAIM YOUR", "RISK FREE", "NO RISK", "GUARANTEE", "GUARANTEED",
    "LIMITED TIME", "EXPIRES", "LAST CHANCE", "FINAL WARNING", "IMMEDIATE",
    "$$", "EXTRA CASH", "FAST CASH", "INCREDIBLE DEAL", "LOWEST PRICE",
    "BEST PRICE", "UNBELIEVABLE", "AMAZING", "MIRACLE", "SECRET",
  ],
  medium: [
    "offer", "discount", "save", "savings", "deal", "bonus", "credit",
    "free trial", "sample", "preview", "exclusive", "special", "limited",
    "opportunity", "today only", "ending soon", "don't miss", "hurry",
    "act fast", "apply now", "sign up", "subscribe", "join now",
    "get started", "learn more", "find out", "discover", "reveal",
  ],
};

// Check for spam words in text
function detectSpamWords(text: string): { word: string; severity: "high" | "medium" }[] {
  const found: { word: string; severity: "high" | "medium" }[] = [];
  const upperText = text.toUpperCase();
  
  // Check high severity words
  for (const word of SPAM_WORDS.high) {
    if (upperText.includes(word.toUpperCase())) {
      found.push({ word, severity: "high" });
    }
  }
  
  // Check medium severity words
  for (const word of SPAM_WORDS.medium) {
    if (upperText.includes(word.toUpperCase())) {
      found.push({ word, severity: "medium" });
    }
  }
  
  return found;
}

// Tone options
const TONES = [
  { value: "professional", label: "Professional", description: "Clear and business-appropriate", icon: "💼" },
  { value: "warm", label: "Warm", description: "Friendly and approachable", icon: "☀️" },
  { value: "concise", label: "Concise", description: "Brief and to the point", icon: "⚡" },
  { value: "formal", label: "Formal", description: "Traditional and respectful", icon: "🎩" },
  { value: "casual", label: "Casual", description: "Relaxed and conversational", icon: "😊" },
  { value: "persuasive", label: "Persuasive", description: "Compelling and convincing", icon: "🎯" },
];

declare global {
  interface Window {
    puter: {
      ai: {
        chat: (prompt: string, options?: { model?: string; stream?: boolean }) => Promise<string>;
      };
    };
  }
}

export default function EmailWriterPage() {
  const [rawThoughts, setRawThoughts] = useState("");
  const [tone, setTone] = useState("professional");
  const [contextEmail, setContextEmail] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [spamWarnings, setSpamWarnings] = useState<{ word: string; severity: "high" | "medium" }[]>([]);
  const [puterReady, setPuterReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load Puter.js script
  useEffect(() => {
    if (typeof window !== "undefined" && !document.getElementById("puter-js")) {
      const script = document.createElement("script");
      script.id = "puter-js";
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      script.onload = () => {
        // Give it a moment to initialize
        setTimeout(() => {
          if (window.puter && window.puter.ai) {
            setPuterReady(true);
          }
        }, 500);
      };
      script.onerror = () => {
        setErrorMsg("Failed to load AI service. Please refresh the page.");
      };
      document.head.appendChild(script);
    } else if (typeof window !== "undefined" && window.puter && window.puter.ai) {
      setPuterReady(true);
    }
  }, []);

  // Detect spam words whenever generated email changes
  useEffect(() => {
    if (generatedEmail && !generatedEmail.startsWith("Sorry,") && !generatedEmail.startsWith("Error:")) {
      const warnings = detectSpamWords(generatedEmail);
      setSpamWarnings(warnings);
    } else {
      setSpamWarnings([]);
    }
  }, [generatedEmail]);

  const generateEmail = async () => {
    if (!rawThoughts.trim()) return;

    setIsLoading(true);
    setGeneratedEmail("");
    setSpamWarnings([]);
    setErrorMsg("");

    try {
      // Check if Puter is available
      if (!window.puter || !window.puter.ai) {
        throw new Error("AI service not loaded. Please refresh the page.");
      }

      const contextPart = contextEmail.trim()
        ? `\n\nContext - I am responding to this email:\n"${contextEmail}"\n\n`
        : "";

      const prompt = `You are an expert email writer who specializes in writing emails that avoid spam filters. Transform the following raw thoughts into a well-crafted email with a ${tone} tone.

Raw thoughts: "${rawThoughts}"${contextPart}

IMPORTANT GUIDELINES:
- Write a complete, professional email body
- Use a ${tone} tone throughout
- Make it clear, engaging, and well-structured
- Ensure proper email etiquette
- AVOID spam trigger words like: FREE, URGENT, ACT NOW, CLICK HERE, LIMITED TIME, GUARANTEED, etc.
- Use natural, conversational language
- Don't use ALL CAPS for emphasis
- Don't make unrealistic promises
- Keep it genuine and trustworthy

Do NOT include a subject line. Respond with ONLY the email body content.`;

      // Use correct model name from Puter docs
      const response = await window.puter.ai.chat(prompt, {
        model: "claude-sonnet-4-0",
      });

      if (typeof response === "string") {
        setGeneratedEmail(response.trim());
      } else if (response && typeof response === "object") {
        // Handle if response is an object with text property
        const text = (response as { text?: string }).text || JSON.stringify(response);
        setGeneratedEmail(text.trim());
      } else {
        setGeneratedEmail(String(response).trim());
      }
    } catch (error: unknown) {
      console.error("Error generating email:", error);
      const errMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (errMessage.includes("auth") || errMessage.includes("login") || errMessage.includes("sign")) {
        setErrorMsg("Please sign in to Puter to use this feature. A popup may have opened - please complete sign-in and try again.");
      } else if (errMessage.includes("limit") || errMessage.includes("quota") || errMessage.includes("rate")) {
        setErrorMsg("Daily limit reached. Please try again tomorrow or sign in to Puter for more credits.");
      } else {
        setErrorMsg("Could not generate email. Please try again.");
      }
      setGeneratedEmail("");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      generateEmail();
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <SiteHeader />

      {/* Hero Section */}
      <div className="relative overflow-hidden py-12 md:py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-navy/5"></div>
        <div className="relative max-w-[1100px] mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand to-brand/80 rounded-2xl mb-6 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          
          <h1 className="font-display text-navy mb-4" style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 400, lineHeight: 1.2 }}>
            AI Email Writer
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto mb-4">
            Transform your thoughts into polished, <span className="text-brand font-semibold">spam-free</span> emails.
            Powered by AI with built-in deliverability checks.
          </p>
          
          <div className="flex items-center justify-center gap-3 flex-wrap mt-6">
            <span className="inline-flex items-center gap-1.5 bg-brand/10 text-brand text-sm font-medium px-3 py-1.5 rounded-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              Spam-Safe Content
            </span>
            <span className="inline-flex items-center gap-1.5 bg-navy/10 text-navy text-sm font-medium px-3 py-1.5 rounded-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              6 Writing Tones
            </span>
            <span className="inline-flex items-center gap-1.5 bg-navy/10 text-navy text-sm font-medium px-3 py-1.5 rounded-full">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Free & Unlimited
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1100px] mx-auto px-6 pb-16">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          
          {/* Input Section */}
          <div className="space-y-6">
            
            {/* Your Thoughts */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center">
                  <span className="text-xl">💭</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-navy">Your Thoughts</h2>
                  <p className="text-sm text-muted">What do you want to say?</p>
                </div>
              </div>
              
              <textarea
                ref={textareaRef}
                value={rawThoughts}
                onChange={(e) => setRawThoughts(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Write what you want to communicate... Don't worry about grammar or structure - just get your ideas down."
                className="w-full h-36 p-4 border border-border rounded-xl resize-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all text-navy placeholder-muted/60"
                style={{ background: "var(--color-bg)" }}
              />
              
              <p className="mt-3 text-xs text-muted">
                💡 Tip: Press <kbd className="bg-navy/10 px-1.5 py-0.5 rounded text-navy font-mono text-[10px]">Ctrl</kbd> + <kbd className="bg-navy/10 px-1.5 py-0.5 rounded text-navy font-mono text-[10px]">Enter</kbd> to generate
              </p>
            </div>

            {/* Tone Selection */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-navy/10 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🎨</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-navy">Email Tone</h2>
                  <p className="text-sm text-muted">Choose the style of your email</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TONES.map((toneOption) => (
                  <button
                    key={toneOption.value}
                    onClick={() => setTone(toneOption.value)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      tone === toneOption.value
                        ? "border-brand bg-brand/5 shadow-sm"
                        : "border-border bg-white hover:border-muted hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{toneOption.icon}</span>
                      <span className={`font-medium text-sm ${tone === toneOption.value ? "text-brand" : "text-navy"}`}>
                        {toneOption.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-snug">{toneOption.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Context Email Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted/20 rounded-xl flex items-center justify-center">
                    <span className="text-xl">📧</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-navy">Reply Context</h2>
                    <p className="text-sm text-muted">Optional: paste email you&apos;re replying to</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowContext(!showContext)}
                  className="text-brand hover:text-brand/80 text-sm font-medium transition-colors"
                >
                  {showContext ? "Hide" : "Show"}
                </button>
              </div>
              
              {showContext && (
                <textarea
                  value={contextEmail}
                  onChange={(e) => setContextEmail(e.target.value)}
                  placeholder="Paste the original email here for better context..."
                  className="w-full h-28 p-4 border border-border rounded-xl resize-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all text-navy placeholder-muted/60"
                  style={{ background: "var(--color-bg)" }}
                />
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={generateEmail}
              disabled={isLoading || !rawThoughts.trim()}
              className="w-full bg-brand text-white py-4 px-8 rounded-xl font-semibold text-lg shadow-lg hover:bg-brand/90 hover:shadow-xl transform hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Crafting your email...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Generate Email
                </>
              )}
            </button>
            
            {/* Error Message */}
            {errorMsg && (
              <div className="bg-warn/10 border border-warn/30 rounded-xl p-4 text-center">
                <p className="text-navy text-sm">{errorMsg}</p>
                <p className="text-muted text-xs mt-2">
                  💡 This uses a free AI service. If issues persist, try refreshing the page.
                </p>
              </div>
            )}
            
            {!puterReady && !errorMsg && (
              <p className="text-center text-sm text-muted">
                <span className="inline-block w-3 h-3 border-2 border-brand/30 border-t-brand rounded-full animate-spin mr-2"></span>
                Loading AI...
              </p>
            )}
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            
            {/* Generated Email */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center">
                    <span className="text-xl">✉️</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-navy">Generated Email</h2>
                    <p className="text-sm text-muted">Your polished email</p>
                  </div>
                </div>
                
                {generatedEmail && (
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-4 py-2 bg-navy/5 hover:bg-navy/10 rounded-lg transition-colors text-navy font-medium text-sm"
                  >
                    {copied ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {generatedEmail ? (
                <div className="bg-gray-50 rounded-xl p-5 border border-border">
                  <pre className="whitespace-pre-wrap font-sans text-navy text-[15px] leading-relaxed">
                    {generatedEmail}
                  </pre>
                </div>
              ) : errorMsg ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40 mb-4 text-warn">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-lg">Could not generate email</p>
                  <p className="text-sm mt-1 text-center max-w-[280px]">Please check the error message below and try again</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40 mb-4">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M2 8l10 6 10-6" />
                  </svg>
                  <p className="text-lg">Your email will appear here</p>
                  <p className="text-sm mt-1">Enter your thoughts and select a tone to get started</p>
                </div>
              )}
            </div>

            {/* Spam Warnings */}
            {spamWarnings.length > 0 && (
              <div className="bg-warn/5 border border-warn/20 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="font-semibold text-navy mb-2">Potential Spam Triggers Detected</h3>
                    <p className="text-sm text-muted mb-3">
                      The following words may trigger spam filters. Consider rephrasing:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {spamWarnings.slice(0, 10).map((warning, idx) => (
                        <span
                          key={idx}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono ${
                            warning.severity === "high"
                              ? "bg-danger/15 text-danger"
                              : "bg-warn/20 text-warn"
                          }`}
                        >
                          {warning.word}
                        </span>
                      ))}
                      {spamWarnings.length > 10 && (
                        <span className="text-muted text-xs px-2 py-1">
                          +{spamWarnings.length - 10} more
                        </span>
                      )}
                    </div>
                    <Link
                      href="/blog/spam-trigger-words"
                      className="inline-block mt-3 text-brand text-sm hover:underline"
                    >
                      View full list of spam trigger words →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Pro Tips */}
            <div className="bg-brand/5 border border-brand/20 rounded-2xl p-5">
              <h3 className="font-semibold text-navy mb-3">✨ Pro Tips for Better Emails</h3>
              <ul className="text-sm text-muted space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-brand mt-0.5">•</span>
                  Be specific about what you want to achieve
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand mt-0.5">•</span>
                  Include key details even if roughly written
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand mt-0.5">•</span>
                  Try different tones to see what works best
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand mt-0.5">•</span>
                  Add context when replying for more personalized responses
                </li>
              </ul>
            </div>

            {/* CTA to main tool */}
            <div className="bg-navy rounded-2xl p-6 text-center">
              <h3 className="font-semibold text-white mb-2">Check Your Email Deliverability</h3>
              <p className="text-white/70 text-sm mb-4">
                Great email content is just the start. Make sure your SPF, DKIM, and DMARC are set up correctly.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-white text-navy font-semibold px-5 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Run Free Deliverability Test
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
