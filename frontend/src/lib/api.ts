import type {
  CreateTestResponse,
  TestStatusResponse,
  EmailReport,
} from "@/types/report";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(body || `Request failed: ${res.status}`, res.status);
  }

  return res.json();
}

/**
 * POST /api/test/create — Start a new test. Returns the unique test email.
 */
export async function createTest(): Promise<CreateTestResponse> {
  return request<CreateTestResponse>("/api/test/create", { method: "POST" });
}

/**
 * GET /api/test/{id}/status — Poll waiting screen.
 */
export async function getTestStatus(id: string): Promise<TestStatusResponse> {
  return request<TestStatusResponse>(`/api/test/${id}/status`);
}

/**
 * GET /api/report/{id} — Full report data.
 */
export async function getReport(id: string): Promise<EmailReport> {
  return request<EmailReport>(`/api/report/${id}`);
}

export { ApiError };
