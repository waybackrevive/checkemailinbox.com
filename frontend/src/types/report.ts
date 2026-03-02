// TypeScript types — mirrors backend Pydantic schemas exactly

export type CheckStatus = "pass" | "fail" | "warning";
export type TestStatus = "waiting" | "received" | "processing" | "ready" | "expired";
export type RiskLevel = "low" | "medium" | "high";

// API Response types
export interface CreateTestResponse {
  id: string;
  email: string;
  expires_at: string; // ISO datetime
}

export interface TestStatusResponse {
  id: string;
  status: TestStatus;
  email: string;
}

// Report sub-sections
export interface AuthCheck {
  name: string;
  status: CheckStatus;
  description: string;
  details?: string;
}

export interface AuthenticationResult {
  checks: AuthCheck[];
  score: number;
}

export interface BlacklistEntry {
  list_name: string;
  listed: boolean;
}

export interface ReputationResult {
  ip_blacklists: BlacklistEntry[];
  domain_blacklists: BlacklistEntry[];
  ip_blacklist_count: number;
  domain_blacklist_count: number;
  domain_age_days?: number;
  domain_age_status: CheckStatus;
  domain_age_description: string;
  sending_ip?: string;
  score: number;
}

export interface SpamWord {
  word: string;
  category: string;
}

export interface ContentResult {
  spam_trigger_words: SpamWord[];
  spam_word_count: number;
  subject_line: string;
  subject_has_caps: boolean;
  image_to_text_ratio: number;
  image_ratio_status: CheckStatus;
  links_valid: boolean;
  broken_links: string[];
  has_url_shorteners: boolean;
  url_shorteners_found: string[];
  spamassassin_score: number;
  spamassassin_status: CheckStatus;
  score: number;
}

export interface SpamAssassinResult {
  score: number;
  threshold: number;
  is_spam: boolean;
  rules_hit: string[];
  section_score: number;
}

export interface ActionItem {
  priority: number;
  status: CheckStatus;
  title: string;
  why: string;
  how: string;
  impact: string;
}

export interface EmailReport {
  id: string;
  tested_at: string;
  from_address: string;
  from_domain: string;
  subject: string;
  final_score: number;
  risk_level: RiskLevel;
  risk_summary: string;
  authentication: AuthenticationResult;
  reputation: ReputationResult;
  content: ContentResult;
  spamassassin: SpamAssassinResult;
  action_plan: ActionItem[];
}
