"use client";

import { useQuery } from "@tanstack/react-query";
import { getTestStatus } from "@/lib/api";
import type { TestStatusResponse } from "@/types/report";

/**
 * Polls GET /api/test/{id}/status every 5 seconds.
 * Stops polling once status is "ready" or "expired".
 */
export function useTestPolling(testId: string | null) {
  return useQuery<TestStatusResponse>({
    queryKey: ["test-status", testId],
    queryFn: () => getTestStatus(testId!),
    enabled: !!testId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "ready" || status === "expired") return false;
      return 5000; // Poll every 5 seconds
    },
    retry: 3,
    staleTime: 0,
  });
}
