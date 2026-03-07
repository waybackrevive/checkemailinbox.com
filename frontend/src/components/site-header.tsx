"use client";

import Link from "next/link";
import { useState } from "react";

function LogoMark() {
  return (
    <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center shrink-0">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="4" width="16" height="11" rx="2" stroke="white" strokeWidth="1.5" />
        <path d="M1 7l8 5 8-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="14" cy="5" r="3" fill="#0ea66e" />
      </svg>
    </div>
  );
}

export default function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 animate-slideDown"
      style={{
        background: "rgba(248,249,251,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
        height: 60,
      }}
    >
      <div className="max-w-[1100px] mx-auto w-full h-full px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <LogoMark />
          <span
            className="font-mono text-sm font-semibold text-navy"
            style={{ letterSpacing: "-0.3px" }}
          >
            Check<span className="text-brand">Email</span>Delivery
          </span>
        </Link>
        
        {/* Desktop Navigation */}
        <ul className="hidden md:flex items-center gap-1.5 list-none">
          <li>
            <Link
              href="/#how"
              className="text-[13px] font-medium text-muted no-underline px-3 py-1.5 rounded-md hover:text-navy hover:bg-border-soft transition-colors"
            >
              How It Works
            </Link>
          </li>
          <li>
            <Link
              href="/#checks"
              className="text-[13px] font-medium text-muted no-underline px-3 py-1.5 rounded-md hover:text-navy hover:bg-border-soft transition-colors"
            >
              What We Check
            </Link>
          </li>
          <li>
            <Link
              href="/tools/email-writer"
              className="text-[13px] font-medium text-brand no-underline px-3 py-1.5 rounded-md hover:text-brand/80 hover:bg-brand/5 transition-colors"
            >
              ✨ AI Email Writer
            </Link>
          </li>
          <li>
            <Link
              href="/blog"
              className="text-[13px] font-medium text-muted no-underline px-3 py-1.5 rounded-md hover:text-navy hover:bg-border-soft transition-colors"
            >
              Blog
            </Link>
          </li>
          <li>
            <Link
              href="/contact"
              className="text-[13px] font-medium text-muted no-underline px-3 py-1.5 rounded-md hover:text-navy hover:bg-border-soft transition-colors"
            >
              Contact
            </Link>
          </li>
          <li>
            <Link
              href="/#hero-cta"
              className="bg-navy text-white text-[13px] font-semibold px-4 py-1.5 rounded-lg hover:bg-navy-soft transition-all cursor-pointer border-none no-underline"
            >
              Run Free Test →
            </Link>
          </li>
        </ul>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex items-center justify-center w-10 h-10 bg-transparent border-none cursor-pointer text-navy"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden absolute top-[60px] left-0 right-0 bg-white border-b border-border shadow-lg"
          style={{ backdropFilter: "blur(12px)" }}
        >
          <ul className="flex flex-col list-none p-4 gap-1">
            <li>
              <Link
                href="/#how"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-[14px] font-medium text-muted no-underline px-4 py-3 rounded-md hover:text-navy hover:bg-border-soft transition-colors"
              >
                How It Works
              </Link>
            </li>
            <li>
              <Link
                href="/#checks"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-[14px] font-medium text-muted no-underline px-4 py-3 rounded-md hover:text-navy hover:bg-border-soft transition-colors"
              >
                What We Check
              </Link>
            </li>
            <li>
              <Link
                href="/tools/email-writer"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-[14px] font-medium text-brand no-underline px-4 py-3 rounded-md hover:text-brand/80 hover:bg-brand/5 transition-colors"
              >
                ✨ AI Email Writer
              </Link>
            </li>
            <li>
              <Link
                href="/blog"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-[14px] font-medium text-muted no-underline px-4 py-3 rounded-md hover:text-navy hover:bg-border-soft transition-colors"
              >
                Blog
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-[14px] font-medium text-muted no-underline px-4 py-3 rounded-md hover:text-navy hover:bg-border-soft transition-colors"
              >
                Contact
              </Link>
            </li>
            <li className="mt-2">
              <Link
                href="/#hero-cta"
                onClick={() => setMobileMenuOpen(false)}
                className="block bg-navy text-white text-center text-[14px] font-semibold px-4 py-3 rounded-lg hover:bg-navy-soft transition-all no-underline"
              >
                Run Free Test →
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
