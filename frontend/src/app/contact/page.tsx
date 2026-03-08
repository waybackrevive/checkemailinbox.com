"use client";

import { useState } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { toast } from "sonner";

type ContactType = "feedback" | "complaint" | "buy-report" | "other";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contactType: "feedback" as ContactType,
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buildDirectMailto = () => {
    const subject = `[Contact] ${formData.contactType} from ${formData.name || "Website User"}`;
    const body = [
      `Name: ${formData.name || ""}`,
      `Email: ${formData.email || ""}`,
      `Contact Type: ${formData.contactType}`,
      "",
      "Message:",
      formData.message || "",
    ].join("\n");

    return `mailto:connect@checkemaildelivery.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Message sent successfully! We'll get back to you soon.");
        // Reset form
        setFormData({
          name: "",
          email: "",
          contactType: "feedback",
          message: "",
        });
      } else {
        toast.error(data.error || "Sending failed. Use direct email fallback below.");
      }
    } catch (error) {
      console.error("Contact form error:", error);
      toast.error("Network error. Please use direct email fallback below.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <SiteHeader />

      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-[800px] mx-auto">
          <span
            className="inline-block font-mono text-[11px] font-semibold text-brand uppercase mb-4"
            style={{ letterSpacing: "2px" }}
          >
            Get in Touch
          </span>
          <h1
            className="font-display text-navy mb-4"
            style={{
              fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 400,
              letterSpacing: "-0.8px",
            }}
          >
            Contact &amp; Feedback
          </h1>
          <p className="text-muted text-[17px] mb-12" style={{ lineHeight: 1.7 }}>
            We&apos;re a small team building this tool for the community. Your
            feedback helps us decide what to build next and keeps us motivated.
          </p>

          {/* Contact Form */}
          <div
            className="rounded-2xl border p-6 sm:p-8 mb-10"
            style={{
              background: "white",
              borderColor: "rgba(14, 166, 110, 0.15)",
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Autofill compatibility field for browser extensions */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                tabIndex={-1}
                aria-hidden="true"
                className="hidden"
              />

              {/* Name Field */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-navy mb-2"
                >
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                  placeholder="John Doe"
                />
              </div>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-navy mb-2"
                >
                  Your Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition"
                  placeholder="john@example.com"
                />
              </div>

              {/* Contact Type Dropdown */}
              <div>
                <label
                  htmlFor="contactType"
                  className="block text-sm font-medium text-navy mb-2"
                >
                  Contact Type
                </label>
                <select
                  id="contactType"
                  name="contactType"
                  value={formData.contactType}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition cursor-pointer bg-white"
                >
                  <option value="feedback">💬 Feedback</option>
                  <option value="complaint">⚠️ Complaint</option>
                  <option value="buy-report">📊 Buy Detailed Report</option>
                  <option value="other">✉️ Other</option>
                </select>
              </div>

              {/* Message Field */}
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-navy mb-2"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  autoComplete="off"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition resize-none"
                  placeholder="Tell us more about your inquiry..."
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand hover:bg-brand/90 text-white font-semibold py-3.5 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  "Send Message"
                )}
              </button>

              <a
                href={buildDirectMailto()}
                className="block w-full text-center border border-brand text-brand hover:bg-brand hover:text-white font-semibold py-3.5 px-6 rounded-lg transition-all duration-200"
              >
                Send via Email App (Direct Fallback)
              </a>
            </form>

            {/* Alternative Contact */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-muted">
                Or email us directly at{" "}
                <a
                  href="mailto:connect@checkemaildelivery.com"
                  className="text-brand hover:text-brand/80 transition font-medium"
                >
                  connect@checkemaildelivery.com
                </a>
              </p>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16">
            <h2
              className="font-display text-navy mb-6"
              style={{ fontSize: "24px", fontWeight: 400 }}
            >
              Common Questions
            </h2>
            <div className="space-y-6 text-[15px]" style={{ lineHeight: 1.7 }}>
              <div>
                <h3 className="font-semibold text-navy mb-1">
                  I hit the daily test limit. Can I get more?
                </h3>
                <p className="text-muted">
                  We&apos;re in early beta and currently limit each user to 5
                  tests per day to keep the service running smoothly for
                  everyone. This limit will increase as we grow. If you need
                  more tests for a specific reason, email us and we&apos;ll see
                  how we can help.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-navy mb-1">
                  Is the report accurate?
                </h3>
                <p className="text-muted">
                  We use industry-standard spam scoring engines and real DNS
                  lookups to generate your report. While no tool can guarantee
                  inbox placement, our checks cover the same criteria most
                  inbox providers use to filter email.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-navy mb-1">
                  Will this tool always be free?
                </h3>
                <p className="text-muted">
                  Yes. The core deliverability test will always be free. We
                  believe email diagnostics should be accessible to everyone —
                  solo founders, small businesses, and developers alike.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-navy mb-1">
                  How do I report a bug?
                </h3>
                <p className="text-muted">
                  Use the form above or send an email to{" "}
                  <a
                    href="mailto:connect@checkemaildelivery.com?subject=Bug%20Report"
                    className="text-brand underline"
                  >
                    connect@checkemaildelivery.com
                  </a>{" "}
                  with a description of what happened. Screenshots help a lot!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
