"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Mail,
  Shield,
  Globe,
  FileText,
  Bug,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { getReport } from "@/lib/api";
import type { EmailReport, CheckStatus, ActionItem } from "@/types/report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible } from "@/components/ui/collapsible";
import { Alert } from "@/components/ui/alert";
import {
  getScoreColor,
  getScoreBg,
  getScoreLabel,
  getStatusBadgeVariant,
  formatScore,
} from "@/lib/score";

// ---------------------------------------------------------------------------
// Status icon helper
// ---------------------------------------------------------------------------
function StatusIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    case "fail":
      return <XCircle className="h-5 w-5 text-red-600" />;
  }
}

// ---------------------------------------------------------------------------
// Score Hero — big score at the top
// ---------------------------------------------------------------------------
function ScoreHero({ report }: { report: EmailReport }) {
  const colorClass = getScoreColor(report.final_score);
  const bgClass = getScoreBg(report.final_score);

  return (
    <Card className="mb-8">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Score circle */}
          <div className="relative">
            <div className="w-36 h-36 rounded-full border-8 border-gray-100 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-4xl font-bold ${colorClass}`}>
                  {report.final_score}
                </div>
                <div className="text-sm text-gray-500">out of 100</div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
              <Badge
                variant={getStatusBadgeVariant(
                  report.risk_level === "low"
                    ? "pass"
                    : report.risk_level === "medium"
                    ? "warning"
                    : "fail"
                )}
              >
                {getScoreLabel(report.final_score)}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Your Email Deliverability Score
            </h1>
            <p className="text-gray-600">{report.risk_summary}</p>
            <div className="mt-4 text-sm text-gray-400">
              Tested: {new Date(report.tested_at).toLocaleString()} •{" "}
              From: {report.from_address}
            </div>
          </div>
        </div>

        {/* Section score bars */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Authentication",
              score: report.authentication.score,
              icon: Shield,
            },
            {
              label: "Reputation",
              score: report.reputation.score,
              icon: Globe,
            },
            {
              label: "Content",
              score: report.content.score,
              icon: FileText,
            },
            {
              label: "SpamAssassin",
              score: report.spamassassin.section_score,
              icon: Bug,
            },
          ].map((section) => (
            <div key={section.label} className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <section.icon className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">{section.label}</span>
              </div>
              <div className={`text-lg font-bold ${getScoreColor(section.score)}`}>
                {Math.round(section.score)}
              </div>
              <Progress
                value={section.score}
                className="h-2 mt-1"
                indicatorClassName={bgClass}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Authentication Section
// ---------------------------------------------------------------------------
function AuthSection({ report }: { report: EmailReport }) {
  const { authentication } = report;

  return (
    <Collapsible
      title="Email Authentication"
      defaultOpen={authentication.score < 100}
      icon={<Shield className="h-5 w-5 text-blue-600" />}
      badge={
        <Badge variant={getStatusBadgeVariant(
          authentication.score >= 80 ? "pass" : authentication.score >= 50 ? "warning" : "fail"
        )}>
          {formatScore(authentication.score)}
        </Badge>
      }
      className="mb-4"
    >
      <div className="space-y-3">
        {authentication.checks.map((check) => (
          <div
            key={check.name}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
          >
            <StatusIcon status={check.status} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{check.name}</span>
                <Badge variant={getStatusBadgeVariant(check.status)} className="text-xs">
                  {check.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">{check.description}</p>
              {check.details && (
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  {check.details}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Reputation Section
// ---------------------------------------------------------------------------
function ReputationSection({ report }: { report: EmailReport }) {
  const { reputation } = report;

  return (
    <Collapsible
      title="Sender Reputation"
      defaultOpen={reputation.score < 100}
      icon={<Globe className="h-5 w-5 text-blue-600" />}
      badge={
        <Badge variant={getStatusBadgeVariant(
          reputation.score >= 80 ? "pass" : reputation.score >= 50 ? "warning" : "fail"
        )}>
          {formatScore(reputation.score)}
        </Badge>
      }
      className="mb-4"
    >
      <div className="space-y-4">
        {/* IP Blacklists */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            IP Blacklists ({reputation.ip_blacklist_count} found)
          </h4>
          {reputation.ip_blacklist_count === 0 ? (
            <p className="text-sm text-green-600">
              ✓ Your IP is not on any blacklists
            </p>
          ) : (
            <div className="space-y-1">
              {reputation.ip_blacklists
                .filter((bl) => bl.listed)
                .map((bl) => (
                  <div
                    key={bl.list_name}
                    className="flex items-center gap-2 text-sm text-red-600"
                  >
                    <XCircle className="h-4 w-4" />
                    {bl.list_name}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Domain Blacklists */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Domain Blacklists ({reputation.domain_blacklist_count} found)
          </h4>
          {reputation.domain_blacklist_count === 0 ? (
            <p className="text-sm text-green-600">
              ✓ Your domain is not on any blacklists
            </p>
          ) : (
            <div className="space-y-1">
              {reputation.domain_blacklists
                .filter((bl) => bl.listed)
                .map((bl) => (
                  <div
                    key={bl.list_name}
                    className="flex items-center gap-2 text-sm text-red-600"
                  >
                    <XCircle className="h-4 w-4" />
                    {bl.list_name}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Domain Age */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
          <StatusIcon status={reputation.domain_age_status} />
          <div>
            <span className="font-medium text-gray-900 text-sm">Domain Age</span>
            <p className="text-sm text-gray-600">{reputation.domain_age_description}</p>
            {reputation.domain_age_days !== null && reputation.domain_age_days !== undefined && (
              <p className="text-xs text-gray-400 mt-1">
                {reputation.domain_age_days} days old
              </p>
            )}
          </div>
        </div>

        {reputation.sending_ip && (
          <p className="text-xs text-gray-400">Sending IP: {reputation.sending_ip}</p>
        )}
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Content Section
// ---------------------------------------------------------------------------
function ContentSection({ report }: { report: EmailReport }) {
  const { content } = report;

  return (
    <Collapsible
      title="Content Analysis"
      defaultOpen={content.score < 100}
      icon={<FileText className="h-5 w-5 text-blue-600" />}
      badge={
        <Badge variant={getStatusBadgeVariant(
          content.score >= 80 ? "pass" : content.score >= 50 ? "warning" : "fail"
        )}>
          {formatScore(content.score)}
        </Badge>
      }
      className="mb-4"
    >
      <div className="space-y-4">
        {/* Subject Line */}
        <div className="p-3 rounded-lg bg-gray-50">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon status={content.subject_has_caps ? "warning" : "pass"} />
            <span className="font-medium text-gray-900 text-sm">Subject Line</span>
          </div>
          <p className="text-sm text-gray-600 ml-7">&quot;{content.subject_line}&quot;</p>
          {content.subject_has_caps && (
            <p className="text-xs text-orange-600 ml-7 mt-1">
              ⚠ Using ALL CAPS in subject — this triggers spam filters
            </p>
          )}
        </div>

        {/* Spam Words */}
        <div className="p-3 rounded-lg bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <StatusIcon status={content.spam_word_count > 3 ? "fail" : content.spam_word_count > 0 ? "warning" : "pass"} />
            <span className="font-medium text-gray-900 text-sm">
              Spam Trigger Words ({content.spam_word_count} found)
            </span>
          </div>
          {content.spam_trigger_words.length > 0 && (
            <div className="flex flex-wrap gap-1 ml-7">
              {content.spam_trigger_words.map((sw, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {sw.word}
                  <span className="text-gray-400 ml-1">({sw.category})</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Image Ratio */}
        <div className="p-3 rounded-lg bg-gray-50">
          <div className="flex items-center gap-2">
            <StatusIcon status={content.image_ratio_status} />
            <span className="font-medium text-gray-900 text-sm">Image-to-Text Ratio</span>
            <span className="text-sm text-gray-500">
              {Math.round(content.image_to_text_ratio * 100)}% images
            </span>
          </div>
        </div>

        {/* Links */}
        {content.broken_links.length > 0 && (
          <div className="p-3 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon status="fail" />
              <span className="font-medium text-gray-900 text-sm">
                Broken Links ({content.broken_links.length})
              </span>
            </div>
            <div className="ml-7 space-y-1">
              {content.broken_links.map((link, i) => (
                <p key={i} className="text-xs text-red-600 font-mono truncate">
                  {link}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* URL Shorteners */}
        {content.has_url_shorteners && (
          <div className="p-3 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon status="warning" />
              <span className="font-medium text-gray-900 text-sm">
                URL Shorteners Found
              </span>
            </div>
            <div className="ml-7 space-y-1">
              {content.url_shorteners_found.map((url, i) => (
                <p key={i} className="text-xs text-orange-600 font-mono">
                  {url}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* SpamAssassin */}
        <div className="p-3 rounded-lg bg-gray-50">
          <div className="flex items-center gap-2">
            <StatusIcon status={content.spamassassin_status} />
            <span className="font-medium text-gray-900 text-sm">SpamAssassin Score</span>
            <span className="text-sm text-gray-500">
              {content.spamassassin_score.toFixed(1)} / 5.0 threshold
            </span>
          </div>
        </div>
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// SpamAssassin Detail Section
// ---------------------------------------------------------------------------
function SpamAssassinSection({ report }: { report: EmailReport }) {
  const { spamassassin } = report;

  return (
    <Collapsible
      title="SpamAssassin Details"
      defaultOpen={spamassassin.is_spam}
      icon={<Bug className="h-5 w-5 text-blue-600" />}
      badge={
        <Badge variant={spamassassin.is_spam ? "destructive" : "success"}>
          {spamassassin.is_spam ? "SPAM" : "NOT SPAM"}
        </Badge>
      }
      className="mb-4"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">Score:</span>
          <span className={`font-bold ${spamassassin.is_spam ? "text-red-600" : "text-green-600"}`}>
            {spamassassin.score.toFixed(1)}
          </span>
          <span className="text-gray-500">Threshold:</span>
          <span className="font-medium text-gray-700">{spamassassin.threshold.toFixed(1)}</span>
        </div>

        {spamassassin.rules_hit.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Rules Triggered ({spamassassin.rules_hit.length})
            </h4>
            <div className="flex flex-wrap gap-1">
              {spamassassin.rules_hit.map((rule) => (
                <Badge key={rule} variant="outline" className="text-xs font-mono">
                  {rule}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Action Plan — THE MOST IMPORTANT SECTION
// ---------------------------------------------------------------------------
function ActionPlanSection({ actions }: { actions: ActionItem[] }) {
  if (actions.length === 0) {
    return (
      <Alert variant="success" title="All Clear!">
        No issues found. Your email is well-configured for deliverability.
      </Alert>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-blue-600" />
          <CardTitle>What to Fix — Action Plan</CardTitle>
        </div>
        <p className="text-sm text-gray-500">
          Ordered by impact. Fix these issues to improve your deliverability.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {actions.map((action, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl border ${
                action.status === "fail"
                  ? "border-red-200 bg-red-50/50"
                  : "border-orange-200 bg-orange-50/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold text-white shrink-0 ${
                    action.status === "fail" ? "bg-red-600" : "bg-orange-500"
                  }`}
                >
                  {action.priority}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">
                      {action.title}
                    </h3>
                    <Badge
                      variant={
                        action.status === "fail" ? "destructive" : "warning"
                      }
                      className="text-xs"
                    >
                      {action.status === "fail" ? "Must Fix" : "Should Fix"}
                    </Badge>
                  </div>

                  {/* WHY */}
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Why it matters:
                    </p>
                    <p className="text-sm text-gray-600">{action.why}</p>
                  </div>

                  {/* HOW */}
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      How to fix it:
                    </p>
                    <div className="text-sm text-gray-600 whitespace-pre-line bg-white rounded-lg p-3 border border-gray-100">
                      {action.how}
                    </div>
                  </div>

                  {/* IMPACT */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600 font-medium">
                      📈 {action.impact}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Report Page
// ---------------------------------------------------------------------------
export default function ReportPage() {
  const params = useParams();
  const testId = params.id as string;

  const { data: report, isLoading, isError } = useQuery<EmailReport>({
    queryKey: ["report", testId],
    queryFn: () => getReport(testId),
    enabled: !!testId,
    staleTime: Infinity, // Report doesn't change
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading your report...</p>
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Report Not Found
          </h1>
          <p className="text-gray-500 mb-4">
            This report may have expired or doesn&apos;t exist.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Start New Test
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-lg text-gray-900">
              IsMyEmailSpam
            </span>
          </a>
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            New Test
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Score Hero */}
        <ScoreHero report={report} />

        {/* Action Plan — FIRST because it's the most important */}
        <ActionPlanSection actions={report.action_plan} />

        {/* Detail Sections */}
        <div className="space-y-0">
          <AuthSection report={report} />
          <ReputationSection report={report} />
          <ContentSection report={report} />
          <SpamAssassinSection report={report} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-400">
          <p>
            This report will be automatically deleted within 1 hour. We don&apos;t
            store your email content.
          </p>
          <p className="mt-2">
            &copy; {new Date().getFullYear()} IsMyEmailSpam.com — Free email
            deliverability testing.
          </p>
        </div>
      </footer>
    </div>
  );
}
