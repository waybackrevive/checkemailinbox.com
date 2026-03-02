"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Send,
  ClipboardCopy,
  Check,
  Shield,
  Search,
  FileText,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createTest } from "@/lib/api";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

export default function HomePage() {
  const router = useRouter();
  const { copied, copy } = useCopyToClipboard();
  const [testEmail, setTestEmail] = useState<string | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleStartTest() {
    setLoading(true);
    try {
      const data = await createTest();
      setTestEmail(data.email);
      setTestId(data.id);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (testEmail) {
      copy(testEmail);
      toast.success("Email address copied!");
    }
  }

  function handleGoToWaiting() {
    if (testId) {
      router.push(`/check/${testId}`);
    }
  }

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

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            Will Your Email Land in
            <br />
            <span className="text-blue-600">Inbox or Spam?</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Send us a test email and we&apos;ll tell you exactly what&apos;s wrong — and
            how to fix it. In plain English. No jargon.
          </p>
        </div>

        {/* CTA Area */}
        <div className="max-w-lg mx-auto mb-16">
          {!testEmail ? (
            <div className="text-center">
              <Button
                size="lg"
                onClick={handleStartTest}
                disabled={loading}
                className="text-lg px-8 py-6 h-auto"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                {loading ? "Getting your test email..." : "Start Free Test"}
              </Button>
              <p className="text-sm text-gray-400 mt-3">
                No signup required. Results in under 60 seconds.
              </p>
            </div>
          ) : (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-blue-800 mb-2">
                  Step 1: Send an email to this address
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 bg-white border border-blue-200 rounded-lg px-4 py-3 font-mono text-sm text-gray-900 select-all">
                    {testEmail}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Send from the email address you want to test. Use your normal
                  email client (Gmail, Outlook, etc.)
                </p>
                <Button
                  onClick={handleGoToWaiting}
                  className="w-full"
                  size="lg"
                >
                  I&apos;ve Sent It
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                icon: Send,
                title: "Send a Test Email",
                desc: "We give you a unique email address. Send a real email to it from your inbox.",
              },
              {
                step: "2",
                icon: Search,
                title: "We Analyze Everything",
                desc: "We check SPF, DKIM, DMARC, blacklists, spam words, content, and more.",
              },
              {
                step: "3",
                icon: FileText,
                title: "Get Your Report",
                desc: "A plain-English report with your score, what's wrong, and exactly how to fix it.",
              },
            ].map((item) => (
              <Card key={item.step} className="text-center">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* What We Check */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            What We Check
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: Shield,
                title: "Email Authentication (SPF, DKIM, DMARC)",
                desc: "Is your server authorized to send emails for your domain?",
              },
              {
                icon: Search,
                title: "Blacklist Status",
                desc: "Is your IP or domain on any email blacklists?",
              },
              {
                icon: FileText,
                title: "Content Analysis",
                desc: "Spam trigger words, image ratio, broken links, URL shorteners.",
              },
              {
                icon: Mail,
                title: "SpamAssassin Score",
                desc: "What would the #1 spam filter in the world think of your email?",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <item.icon className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-400">
          <p>
            Your emails are analyzed and automatically deleted within 1 hour. We
            don&apos;t store or read your email content.
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
