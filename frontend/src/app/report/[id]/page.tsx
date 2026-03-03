"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getReport } from "@/lib/api";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import type {
  EmailReport,
  CheckStatus,
  AuthCheck,
  ActionItem,
} from "@/types/report";

/* ─── helpers ─── */
function statusBadge(status: CheckStatus, label?: string) {
  const map: Record<CheckStatus, { bg: string; border: string; text: string; fallback: string }> = {
    pass:    { bg: "bg-brand-light", border: "border-brand/20",  text: "text-brand",  fallback: "✓ PASS" },
    fail:    { bg: "bg-danger-light", border: "border-danger/20", text: "text-danger", fallback: "✕ FAIL" },
    warning: { bg: "bg-warn-light", border: "border-warn/25",   text: "text-warn",   fallback: "⚠ WARNING" },
    missing: { bg: "bg-warn-light", border: "border-warn/25",   text: "text-warn",   fallback: "⚠ MISSING" },
  };
  const s = map[status] || map.warning;
  return (
    <span className={`font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${s.bg} ${s.border} ${s.text}`}>
      {label || s.fallback}
    </span>
  );
}

function scoreBarColor(score: number) {
  if (score >= 80) return "score-bar-green";
  if (score >= 50) return "score-bar-amber";
  return "score-bar-red";
}

function riskBadge(level: string) {
  const m: Record<string, { icon: string; label: string; bg: string; border: string; color: string }> = {
    low:    { icon: "✅", label: "Low Risk",    bg: "rgba(14,166,110,0.2)", border: "rgba(14,166,110,0.4)", color: "var(--color-brand)" },
    medium: { icon: "⚠️", label: "Medium Risk", bg: "rgba(245,158,11,0.2)", border: "rgba(245,158,11,0.4)", color: "var(--color-warn)" },
    high:   { icon: "🚨", label: "High Risk",   bg: "rgba(229,55,58,0.2)", border: "rgba(229,55,58,0.4)", color: "var(--color-danger)" },
  };
  const r = m[level] || m.medium;
  return (
    <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: r.bg, border: `1px solid ${r.border}`, color: r.color }}>
      {r.icon} {r.label}
    </div>
  );
}

function countStats(report: EmailReport) {
  let critical = 0, warnings = 0, passed = 0;
  report.action_plan.forEach((a) => { if (a.status === "fail") critical++; else if (a.status === "warning" || a.status === "missing") warnings++; });
  report.authentication.checks.forEach((c) => { if (c.status === "pass") passed++; });
  // reputation items
  if (report.reputation.ip_blacklist_count === 0) passed++;
  if (report.reputation.domain_blacklist_count === 0) passed++;
  if (report.reputation.domain_age_status === "pass") passed++;
  // content items
  if (!report.content.subject_has_caps) passed++;
  if (report.content.spam_word_count === 0) passed++;
  if (report.content.image_ratio_status === "pass") passed++;
  if (report.content.links_valid) passed++;
  if (!report.content.has_url_shorteners) passed++;
  if (report.content.spamassassin_status === "pass") passed++;
  return { critical, warnings, passed };
}

/* ─── CopyIcon ─── */
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5V9.5A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/* ─── Section Component ─── */
function Section({
  icon,
  title,
  issueCount,
  issueType,
  children,
  defaultOpen = true,
}: {
  icon: string;
  title: string;
  issueCount?: number;
  issueType?: "critical" | "warn";
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-border rounded-[14px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(12,26,46,0.04)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 cursor-pointer border-none bg-transparent text-left group"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="text-[15px] font-semibold text-navy">{title}</span>
          {issueCount != null && issueCount > 0 && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              issueType === "critical" ? "bg-danger-light text-danger" : "bg-warn-light text-warn"
            }`}>
              {issueCount} {issueCount === 1 ? "Issue" : "Issues"}
            </span>
          )}
        </div>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={`text-muted-light transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-6 pb-5 flex flex-col gap-2">{children}</div>}
    </div>
  );
}

/* ─── Check Row ─── */
function CheckRow({
  icon,
  label,
  status,
  statusLabel,
  detail,
  fix,
}: {
  icon: string;
  label: string;
  status: CheckStatus;
  statusLabel?: string;
  detail?: string;
  fix?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasFix = (status === "fail" || status === "warning" || status === "missing") && (detail || fix);

  return (
    <div
      className={`rounded-[10px] border transition-all ${
        status === "fail" ? "border-danger/20 bg-danger-light/50" :
        (status === "warning" || status === "missing") ? "border-warn/20 bg-warn-light/50" :
        "border-border bg-bg"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2.5 text-[13px] font-medium text-navy">
          <span className="text-base shrink-0">{icon}</span>
          {label}
        </span>
        <div className="flex items-center gap-2">
          {statusBadge(status, statusLabel)}
          {hasFix && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-transparent border border-border text-muted hover:text-navy hover:border-navy/30 cursor-pointer transition-colors"
            >
              {expanded ? "Hide" : "Fix ↓"}
            </button>
          )}
        </div>
      </div>
      {expanded && hasFix && (
        <div className="px-4 pb-3 border-t border-border/50 pt-3 animate-fadeUp" style={{ animationDuration: "0.2s" }}>
          {detail && <p className="text-[12.5px] text-muted mb-2" style={{ lineHeight: 1.6 }}>{detail}</p>}
          {fix && (
            <div className="font-mono text-[11px] text-brand bg-navy rounded-lg px-3.5 py-2.5 overflow-x-auto" style={{ lineHeight: 1.6 }}>
              {fix}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ─── MAIN PAGE ─── */
export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id as string;
  const { copied, copy } = useCopyToClipboard();

  const { data: report, isLoading, error } = useQuery<EmailReport>({
    queryKey: ["report", testId],
    queryFn: () => getReport(testId),
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-brand border-t-transparent animate-spin" />
          <span className="text-sm text-muted">Loading your report...</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <div className="text-center">
          <p className="text-xl mb-2">😕</p>
          <p className="text-navy font-semibold">Report not found</p>
          <p className="text-sm text-muted mb-4">This test may have expired or does not exist.</p>
          <button onClick={() => router.push("/")} className="bg-navy text-white text-sm font-semibold px-5 py-2 rounded-lg border-none cursor-pointer hover:bg-navy-soft transition-colors">
            Run New Test →
          </button>
        </div>
      </div>
    );
  }

  const stats = countStats(report);
  const reportUrl = typeof window !== "undefined" ? window.location.href : "";

  // Auth issues
  const authIssues = report.authentication.checks.filter((c) => c.status !== "pass").length;
  // Reputation issues
  let repIssues = 0;
  if (report.reputation.ip_blacklist_count > 0) repIssues++;
  if (report.reputation.domain_blacklist_count > 0) repIssues++;
  if (report.reputation.domain_age_status !== "pass") repIssues++;
  // Content issues
  let contentIssues = 0;
  if (report.content.subject_has_caps) contentIssues++;
  if (report.content.spam_word_count > 0) contentIssues++;
  if (report.content.image_ratio_status !== "pass") contentIssues++;
  if (!report.content.links_valid) contentIssues++;
  if (report.content.has_url_shorteners) contentIssues++;
  if (report.content.spamassassin_status !== "pass") contentIssues++;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <SiteHeader />

      {/* Thin progress bar at top */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-50" style={{ background: "var(--color-border)" }}>
        <div className={`h-full ${scoreBarColor(report.final_score)} animate-fillBar`} style={{ width: `${report.final_score}%` }} />
      </div>

      <div className="max-w-[1200px] mx-auto py-8 px-5 grid gap-6" style={{ gridTemplateColumns: "340px 1fr" }}>

        {/* ═════════ SIDEBAR ═════════ */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-5 self-start max-lg:order-first">

          {/* ── Score Card ── */}
          <div className="rp-score-block rounded-[16px] p-6 text-center">
            <div className="font-mono text-[10px] uppercase mb-3" style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "2px" }}>
              Delivery Health Score
            </div>
            <div className="font-display mb-1" style={{ fontSize: 72, fontWeight: 400, lineHeight: 1, letterSpacing: "-3px", color: "white" }}>
              {report.final_score}
              <span className="text-3xl" style={{
                color:
                  report.final_score >= 80 ? "var(--color-brand)" :
                  report.final_score >= 50 ? "var(--color-warn)" :
                  "var(--color-danger)"
              }}>/100</span>
            </div>
            {riskBadge(report.risk_level)}

            {/* Score bar */}
            <div className="mt-5 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div className={`h-full rounded-full ${scoreBarColor(report.final_score)} animate-fillBar`} style={{ width: `${report.final_score}%` }} />
            </div>
            <div className="flex justify-between font-mono text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              <span>0</span><span>50</span><span>100</span>
            </div>

            <p className="text-[13px] mt-4" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
              {report.risk_summary}
            </p>
          </div>

          {/* ── Quick Stats ── */}
          <div className="bg-white border border-border rounded-[14px] p-4 grid grid-cols-2 gap-3" style={{ boxShadow: "0 2px 12px rgba(12,26,46,0.04)" }}>
            {[
              { label: "Critical Issues", value: stats.critical, color: "text-danger", bg: "bg-danger-light" },
              { label: "Warnings", value: stats.warnings, color: "text-warn", bg: "bg-warn-light" },
              { label: "Checks Passed", value: stats.passed, color: "text-brand", bg: "bg-brand-light" },
              { label: "SpamAssassin", value: report.spamassassin.available === false ? "N/A" : report.spamassassin.score.toFixed(1), color: report.spamassassin.available === false ? "text-muted" : report.spamassassin.is_spam ? "text-danger" : "text-warn", bg: report.spamassassin.available === false ? "bg-bg" : report.spamassassin.is_spam ? "bg-danger-light" : "bg-warn-light" },
            ].map((s) => (
              <div key={s.label} className={`rounded-[10px] p-3 text-center ${s.bg}`}>
                <div className={`font-display text-2xl ${s.color}`} style={{ fontWeight: 400, lineHeight: 1, letterSpacing: "-1px" }}>
                  {s.value}
                </div>
                <div className="text-[11px] text-muted font-medium mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Share Card ── */}
          <div className="bg-white border border-border rounded-[14px] p-5" style={{ boxShadow: "0 2px 12px rgba(12,26,46,0.04)" }}>
            <h3 className="text-sm font-semibold text-navy mb-3">📤 Share Report</h3>
            <div className="flex items-center border border-border rounded-lg px-3 py-2 mb-3" style={{ background: "var(--color-bg)" }}>
              <span className="font-mono text-[11px] text-muted flex-1 truncate">{reportUrl}</span>
              <button onClick={() => copy(reportUrl)} className="text-brand text-[11px] font-semibold bg-transparent border-none cursor-pointer hover:underline flex items-center gap-1">
                <CopyIcon />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex gap-2">
              <a href={`https://twitter.com/intent/tweet?text=My%20email%20delivery%20score:%20${report.final_score}/100&url=${encodeURIComponent(reportUrl)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-[12px] font-semibold no-underline px-3 py-2 rounded-lg transition-colors" style={{ background: "#1da1f2", color: "white" }}>
                Tweet
              </a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(reportUrl)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-[12px] font-semibold no-underline px-3 py-2 rounded-lg transition-colors" style={{ background: "#0077b5", color: "white" }}>
                LinkedIn
              </a>
            </div>
          </div>

          {/* ── Tested Info ── */}
          <div className="bg-white border border-border rounded-[14px] p-4" style={{ boxShadow: "0 2px 12px rgba(12,26,46,0.04)" }}>
            <div className="text-[12px] text-muted space-y-1.5">
              <div className="flex justify-between"><span>From:</span><span className="font-mono text-navy">{report.from_address}</span></div>
              <div className="flex justify-between"><span>Domain:</span><span className="font-mono text-navy">{report.from_domain}</span></div>
              <div className="flex justify-between"><span>Subject:</span><span className="font-mono text-navy truncate max-w-[180px]">{report.subject}</span></div>
              <div className="flex justify-between"><span>Tested:</span><span className="font-mono text-navy">{new Date(report.tested_at).toLocaleString()}</span></div>
            </div>
          </div>
        </aside>

        {/* ═════════ MAIN CONTENT ═════════ */}
        <main className="flex flex-col gap-4 min-w-0">

          {/* ── Authentication ── */}
          <Section icon="🔐" title="Email Authentication" issueCount={authIssues} issueType="critical" defaultOpen={true}>
            {report.authentication.checks.map((check: AuthCheck) => (
              <CheckRow
                key={check.name}
                icon={check.name === "SPF" ? "🔐" : check.name === "DKIM" ? "✍️" : "🛡️"}
                label={`${check.name} ${check.name === "SPF" ? "Authentication" : check.name === "DKIM" ? "Signature" : "Policy"}`}
                status={check.status}
                statusLabel={
                  check.status === "pass" ? `✓ PASS` :
                  check.status === "fail" ? `✕ FAIL` :
                  check.status === "missing" ? `⚠ MISSING` :
                  `⚠ ${check.name === "DMARC" ? "MISSING" : "WARNING"}`
                }
                detail={check.description}
                fix={check.details ?? undefined}
              />
            ))}
          </Section>

          {/* ── Reputation ── */}
          <Section icon="🌍" title="Sender Reputation" issueCount={repIssues} issueType={repIssues > 0 ? "warn" : undefined}>
            <CheckRow
              icon="🌐"
              label="IP Blacklists"
              status={report.reputation.ip_blacklist_count > 0 ? "fail" : "pass"}
              statusLabel={report.reputation.ip_blacklist_count > 0 ? `✕ LISTED (${report.reputation.ip_blacklist_count})` : "✓ CLEAN"}
              detail={report.reputation.ip_blacklist_count > 0 ? `Your sending IP ${report.reputation.sending_ip || ""} was found on ${report.reputation.ip_blacklist_count} blacklist(s): ${report.reputation.ip_blacklists.filter((b) => b.listed).map((b) => b.list_name).join(", ")}` : undefined}
            />
            <CheckRow
              icon="🏢"
              label="Domain Blacklists"
              status={report.reputation.domain_blacklist_count > 0 ? "fail" : "pass"}
              statusLabel={report.reputation.domain_blacklist_count > 0 ? `✕ LISTED (${report.reputation.domain_blacklist_count})` : "✓ CLEAN"}
              detail={report.reputation.domain_blacklist_count > 0 ? `Domain found on: ${report.reputation.domain_blacklists.filter((b) => b.listed).map((b) => b.list_name).join(", ")}` : undefined}
            />
            <CheckRow
              icon="📅"
              label="Domain Age"
              status={report.reputation.domain_age_status}
              statusLabel={
                report.reputation.domain_age_status === "pass" ? "✓ ESTABLISHED" :
                report.reputation.domain_age_status === "warning" ? `⚠ ${report.reputation.domain_age_days ?? "?"} days` :
                "✕ NEW"
              }
              detail={report.reputation.domain_age_description}
            />
          </Section>

          {/* ── Content Analysis ── */}
          <Section icon="✍️" title="Content Analysis" issueCount={contentIssues} issueType={contentIssues > 2 ? "critical" : "warn"}>
            {/* Subject Line */}
            <CheckRow
              icon="📝"
              label={`Subject Line: "${report.content.subject_line}"`}
              status={report.content.subject_has_caps ? "fail" : "pass"}
              statusLabel={report.content.subject_has_caps ? "✕ ALL CAPS" : "✓ GOOD"}
              detail={report.content.subject_has_caps ? "Subject lines with excessive capitalization trigger spam filters in Gmail and Outlook. Use sentence case instead." : undefined}
            />

            {/* Spam Words */}
            <CheckRow
              icon="🚫"
              label="Spam Trigger Words"
              status={report.content.spam_word_count > 0 ? "fail" : "pass"}
              statusLabel={report.content.spam_word_count > 0 ? `✕ ${report.content.spam_word_count} FOUND` : "✓ CLEAN"}
              detail={report.content.spam_word_count > 0 ? `Found: ${report.content.spam_trigger_words.map((w) => `"${w.word}" (${w.category})`).join(", ")}` : undefined}
            />

            {/* Image Ratio */}
            <CheckRow
              icon="🖼️"
              label="Image-to-Text Ratio"
              status={report.content.image_ratio_status}
              statusLabel={
                report.content.image_ratio_status === "pass" ? "✓ GOOD" :
                report.content.image_ratio_status === "warning" ? `⚠ ${(report.content.image_to_text_ratio * 100).toFixed(0)}%` :
                `✕ ${(report.content.image_to_text_ratio * 100).toFixed(0)}%`
              }
              detail={report.content.image_ratio_status !== "pass" ? "Emails with too many images and not enough text often get flagged. Aim for at least 60% text content." : undefined}
            />

            {/* Links */}
            <CheckRow
              icon="🔗"
              label="Link Validation"
              status={report.content.links_valid ? "pass" : "fail"}
              statusLabel={report.content.links_valid ? "✓ ALL VALID" : `✕ ${report.content.broken_links.length} BROKEN`}
              detail={!report.content.links_valid ? `Broken links found: ${report.content.broken_links.join(", ")}` : undefined}
            />

            {/* URL Shorteners */}
            <CheckRow
              icon="🔗"
              label="URL Shorteners"
              status={report.content.has_url_shorteners ? "warning" : "pass"}
              statusLabel={report.content.has_url_shorteners ? `⚠ ${report.content.url_shorteners_found.length} FOUND` : "✓ NONE"}
              detail={report.content.has_url_shorteners ? `URL shorteners like ${report.content.url_shorteners_found.join(", ")} are often used in phishing. Use full URLs instead.` : undefined}
            />

            {/* SpamAssassin */}
            <div className="rounded-[10px] border border-border bg-bg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2.5 text-[13px] font-medium text-navy">
                  📊 SpamAssassin Score
                </span>
                {report.spamassassin.available === false ? (
                  statusBadge("warning", "⚠ UNAVAILABLE")
                ) : (
                  statusBadge(
                    report.spamassassin.is_spam ? "fail" : report.content.spamassassin_status,
                    report.spamassassin.is_spam ? `✕ ${report.spamassassin.score} / ${report.spamassassin.threshold}` : `${report.spamassassin.score} / ${report.spamassassin.threshold}`
                  )
                )}
              </div>
              {report.spamassassin.available === false ? (
                <p className="text-[12.5px] text-muted" style={{ lineHeight: 1.6 }}>
                  SpamAssassin scan is not available right now. Your overall score is calculated using the other checks. This does not affect SPF, DKIM, DMARC, or blacklist results.
                </p>
              ) : (
                <>
                  {/* Score bar */}
                  <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: "var(--color-border)" }}>
                    <div
                      className={`h-full rounded-full ${scoreBarColor(Math.max(0, 100 - report.spamassassin.score * 10))}`}
                      style={{ width: `${Math.min(100, (report.spamassassin.score / report.spamassassin.threshold) * 100)}%`, transition: "width 1s ease" }}
                    />
                  </div>
                  {/* Rules */}
                  {report.spamassassin.rules_hit.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] font-semibold text-muted uppercase mb-1.5" style={{ letterSpacing: "1px" }}>Rules triggered:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {report.spamassassin.rules_hit.map((rule) => (
                          <span key={rule} className="font-mono text-[10px] text-muted bg-white border border-border rounded px-2 py-0.5">
                            {rule}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Section>

          {/* ── Action Plan ── */}
          {report.action_plan.length > 0 && (
            <div className="action-section-bg rounded-[14px] p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xl">🔧</span>
                <h2 className="font-display text-xl text-navy" style={{ fontWeight: 400, letterSpacing: "-0.3px" }}>Your Action Plan</h2>
              </div>
              <div className="flex flex-col gap-3">
                {report.action_plan.map((item: ActionItem, i: number) => (
                  <ActionCard key={i} item={item} index={i + 1} />
                ))}
              </div>
            </div>
          )}

          {/* ── Disclaimer ── */}
          <div className="bg-white border border-border rounded-xl px-5 py-4 text-center" style={{ boxShadow: "0 2px 12px rgba(12,26,46,0.04)" }}>
            <p className="text-xs text-muted-light" style={{ lineHeight: 1.6 }}>
              This report was generated automatically. Results are based on publicly available DNS records, blacklist databases, and content analysis.
              Your test email has been securely deleted. We do not store, read, or share email content.
            </p>
          </div>

          {/* ── Retest Banner ── */}
          <div className="bg-navy rounded-[14px] p-6 flex items-center justify-between gap-4 flex-wrap" style={{ boxShadow: "0 4px 24px rgba(12,26,46,0.15)" }}>
            <div>
              <h3 className="font-display text-xl text-white mb-1" style={{ fontWeight: 400 }}>
                Made changes? <em className="italic text-brand">Test again.</em>
              </h3>
              <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                Run another free test to verify your fixes are working.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="bg-brand text-white border-none cursor-pointer font-body text-sm font-semibold px-6 py-3 rounded-xl whitespace-nowrap transition-all hover:opacity-90"
              style={{ boxShadow: "0 4px 16px rgba(14,166,110,0.3)" }}
            >
              Run New Test →
            </button>
          </div>
        </main>
      </div>

      {/* Footer */}
      <SiteFooter />

      {/* ───── Responsive overrides ───── */}
      <style>{`
        @media (max-width: 900px) {
          .max-w-\\[1200px\\] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}


/* ─── Action Card sub-component ─── */
function ActionCard({ item, index }: { item: ActionItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-brand/15 rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(14,166,110,0.06)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 border-none bg-transparent cursor-pointer text-left"
      >
        <span className="w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0 font-mono">
          {index}
        </span>
        <span className="text-[14px] font-semibold text-navy flex-1">{item.title}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
          item.status === "fail" ? "bg-danger-light text-danger" : "bg-warn-light text-warn"
        }`}>
          {item.status === "fail" ? "Critical" : "Recommended"}
        </span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`text-muted-light transition-transform ${expanded ? "rotate-180" : ""}`}>
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t border-brand/10 pt-4 animate-fadeUp" style={{ animationDuration: "0.2s" }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-danger-light/50 rounded-lg p-3">
              <div className="text-[10px] font-bold text-danger uppercase mb-1" style={{ letterSpacing: "1px" }}>WHY</div>
              <p className="text-[12.5px] text-navy" style={{ lineHeight: 1.5 }}>{item.why}</p>
            </div>
            <div className="bg-brand-light/50 rounded-lg p-3">
              <div className="text-[10px] font-bold text-brand uppercase mb-1" style={{ letterSpacing: "1px" }}>HOW</div>
              <p className="text-[12.5px] text-navy" style={{ lineHeight: 1.5 }}>{item.how}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: "rgba(14,166,110,0.04)", border: "1px solid rgba(14,166,110,0.1)" }}>
              <div className="text-[10px] font-bold text-navy uppercase mb-1" style={{ letterSpacing: "1px" }}>IMPACT</div>
              <p className="text-[12.5px] text-navy" style={{ lineHeight: 1.5 }}>{item.impact}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
