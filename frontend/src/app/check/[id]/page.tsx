"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mail, Loader2, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTestPolling } from "@/hooks/useTestPolling";

export default function WaitingPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id as string;
  const { data, isError } = useTestPolling(testId);

  // Auto-redirect when report is ready
  useEffect(() => {
    if (data?.status === "ready") {
      router.push(`/report/${testId}`);
    }
  }, [data?.status, testId, router]);

  const status = data?.status || "waiting";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2">
          <Mail className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-lg text-gray-900">
            IsMyEmailSpam
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-24">
        <div className="text-center">
          {/* Pulsing Animation */}
          <div className="relative inline-flex items-center justify-center mb-8">
            <div className="absolute w-24 h-24 rounded-full bg-blue-100 animate-pulse-ring" />
            <div className="relative w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
              {status === "waiting" && (
                <Mail className="h-8 w-8 text-white" />
              )}
              {status === "received" && (
                <CheckCircle2 className="h-8 w-8 text-white" />
              )}
              {status === "processing" && (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              )}
              {status === "expired" && (
                <AlertCircle className="h-8 w-8 text-white" />
              )}
            </div>
          </div>

          {/* Status Text */}
          {status === "waiting" && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Waiting for Your Email
              </h1>
              <p className="text-gray-500 mb-6">
                Send your test email to the address we gave you. We&apos;re
                listening...
              </p>
              {data?.email && (
                <Card className="border-blue-200 bg-blue-50/50 mb-6">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Send to:</p>
                    <p className="font-mono text-sm text-gray-900 select-all">
                      {data.email}
                    </p>
                  </CardContent>
                </Card>
              )}
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Clock className="h-4 w-4" />
                <span>Checking every 5 seconds...</span>
              </div>
            </>
          )}

          {status === "received" && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Email Received!
              </h1>
              <p className="text-gray-500">
                Got it! Starting analysis now...
              </p>
            </>
          )}

          {status === "processing" && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Analyzing Your Email
              </h1>
              <p className="text-gray-500 mb-4">
                Checking authentication, blacklists, content, and more...
              </p>
              <div className="space-y-2 text-left max-w-xs mx-auto">
                {[
                  "Checking SPF, DKIM & DMARC",
                  "Scanning blacklists",
                  "Analyzing content",
                  "Running SpamAssassin",
                  "Building your report",
                ].map((step) => (
                  <div
                    key={step}
                    className="flex items-center gap-2 text-sm text-gray-500"
                  >
                    <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                    {step}
                  </div>
                ))}
              </div>
            </>
          )}

          {status === "expired" && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Test Expired
              </h1>
              <p className="text-gray-500 mb-4">
                We didn&apos;t receive your email within the time limit. Please
                start a new test.
              </p>
              <a
                href="/"
                className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                Start New Test
              </a>
            </>
          )}

          {isError && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something Went Wrong
              </h1>
              <p className="text-gray-500 mb-4">
                We couldn&apos;t check your test status. Please try again.
              </p>
              <a
                href="/"
                className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                Start Over
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
