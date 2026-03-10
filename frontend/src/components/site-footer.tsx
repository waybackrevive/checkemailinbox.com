import Link from "next/link";

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

const footerColumns = [
  {
    title: "Tools",
    links: [
      { label: "Run Free Test", href: "/" },
      { label: "AI Email Writer", href: "/ai-email-writer" },
      { label: "How It Works", href: "/#how" },
      { label: "What We Check", href: "/#checks" },
      { label: "Sample Report", href: "/sample-report" },
    ],
  },
  {
    title: "Blog",
    links: [
      { label: "Why Emails Go to Spam", href: "/blog/why-emails-go-to-spam" },
      { label: "How to Fix DKIM", href: "/blog/how-to-fix-dkim" },
      { label: "What is DMARC?", href: "/blog/what-is-dmarc" },
      { label: "Blacklist Removal Guide", href: "/blog/email-blacklist-removal" },
    ],
  },
  {
    title: "Legal & Info",
    links: [
      { label: "About Us", href: "/about-us" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Contact & Feedback", href: "/contact-us" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer
      className="bg-navy pt-12 pb-8 px-6"
      style={{ color: "rgba(255,255,255,0.5)" }}
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-start justify-between gap-10 flex-wrap mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <LogoMark />
              <span
                className="font-mono text-sm font-semibold text-white"
                style={{ letterSpacing: "-0.3px" }}
              >
                Check<span className="text-brand">Email</span>Delivery
              </span>
            </div>
            <p
              className="text-[13px] max-w-[260px]"
              style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}
            >
              Free email delivery audit tool. Check authentication, reputation,
              and content before you hit send.
            </p>

            {/* Product Hunt badge */}
            <div className="mt-5">
              <a
                href="https://www.producthunt.com/products/checkemaildelivery?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-checkemaildelivery"
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="CheckEmailDelivery - Email deliverability audit + AI writer. Free. 60 seconds. | Product Hunt"
                  width="250"
                  height="54"
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1094499&theme=light&t=1773155296647"
                  style={{ display: "block" }}
                />
              </a>
            </div>
          </div>

          {/* Columns */}
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4
                className="font-mono text-xs font-semibold uppercase mb-3.5"
                style={{
                  color: "rgba(255,255,255,0.6)",
                  letterSpacing: "1.5px",
                }}
              >
                {col.title}
              </h4>
              <ul className="list-none space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] no-underline hover:text-white transition-colors"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="border-t pt-6 flex items-center justify-between flex-wrap gap-3"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            © 2026 CheckEmailDelivery.com — Free email deliverability testing.
          </span>
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            <span className="w-1.5 h-1.5 bg-brand rounded-full" />
            All test data deleted within 1 hour. We never store or read your
            email content.
          </div>
        </div>
      </div>
    </footer>
  );
}
