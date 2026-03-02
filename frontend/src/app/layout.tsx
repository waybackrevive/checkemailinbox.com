import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IsMyEmailSpam.com — Free Email Deliverability Test",
  description:
    "Send a test email and get a plain-English report on what's wrong and how to fix it. Check SPF, DKIM, DMARC, blacklists, spam words, and more.",
  keywords: [
    "email deliverability",
    "spam test",
    "SPF check",
    "DKIM check",
    "DMARC check",
    "email spam checker",
    "blacklist check",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
