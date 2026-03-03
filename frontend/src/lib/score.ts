import type { CheckStatus, RiskLevel } from "@/types/report";

/**
 * Score → color class mapping for the big score circle and bars.
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-orange-500";
  return "text-red-600";
}

export function getScoreBg(score: number): string {
  if (score >= 80) return "bg-green-600";
  if (score >= 50) return "bg-orange-500";
  return "bg-red-600";
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 50) return "Needs Work";
  return "Poor";
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "text-green-600";
    case "medium":
      return "text-orange-500";
    case "high":
      return "text-red-600";
  }
}

export function getStatusColor(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "text-green-600";
    case "warning":
      return "text-orange-500";
    case "fail":
      return "text-red-600";
    case "missing":
      return "text-orange-500";
  }
}

export function getStatusBadgeVariant(
  status: CheckStatus
): "success" | "warning" | "destructive" {
  switch (status) {
    case "pass":
      return "success";
    case "warning":
      return "warning";
    case "fail":
      return "destructive";
    case "missing":
      return "warning";
  }
}

export function getStatusIcon(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "✓";
    case "warning":
      return "⚠";
    case "fail":
      return "✗";
    case "missing":
      return "⚠";
  }
}

/**
 * Format score as "X / 100"
 */
export function formatScore(score: number): string {
  return `${Math.round(score)} / 100`;
}
