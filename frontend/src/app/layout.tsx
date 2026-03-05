import type { Metadata } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/providers";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CheckEmailDelivery.com — Will Your Email Actually Reach the Inbox?",
  description:
    "Send a test email and get a full delivery audit — authentication, reputation, content, blacklists — with exact steps to fix every issue. Free, no signup.",
  keywords: [
    "email deliverability",
    "email spam test",
    "SPF check",
    "DKIM check",
    "DMARC check",
    "email blacklist check",
    "spam score",
    "email delivery test",
  ],
  metadataBase: new URL("https://checkemaildelivery.com"),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "CheckEmailDelivery.com — Will Your Email Actually Reach the Inbox?",
    description:
      "Send a test email and get a full delivery audit — authentication, reputation, content, blacklists — with exact steps to fix every issue. Free, no signup.",
    url: "https://checkemaildelivery.com",
    siteName: "CheckEmailDelivery",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CheckEmailDelivery.com — Free Email Deliverability Test",
    description:
      "Send a test email and get a full delivery audit with exact steps to fix every issue.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSerif.variable} ${plusJakarta.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors />
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
