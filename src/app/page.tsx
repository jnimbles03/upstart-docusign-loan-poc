import Link from "next/link";

/* ----------------------------------------------------------- portal data */

const ACCOUNTS = [
  {
    name: "Everyday Checking",
    mask: "••••4821",
    balance: "$4,218.66",
    sub: "Available balance",
  },
  {
    name: "High-Yield Savings",
    mask: "••••7790",
    balance: "$12,540.11",
    sub: "4.10% APY",
  },
  {
    name: "Cash-Back Credit Card",
    mask: "••••3054",
    balance: "$382.19",
    sub: "Current balance · $7,500 limit",
  },
];

const NAV = ["Accounts", "Move Money", "Loans", "Cards", "Support"];

/* -------------------------------------------------------------------- page */

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-[#F4F6F5]">
      {/* --------------------------------------------------------- header */}
      <header className="bg-bank-green text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          {/* logo */}
          <span className="flex items-center gap-2.5">
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
              <rect width="32" height="32" rx="8" fill="#fff" fillOpacity="0.15" />
              <path
                d="M8 22V14l8-6 8 6v8"
                stroke="#fff"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M13 22v-5h6v5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
            </svg>
            <span className="text-[17px] font-extrabold tracking-tight">
              Springfield Community Bank
            </span>
          </span>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <span
                key={item}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  item === "Accounts"
                    ? "bg-white/15 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item}
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <button className="relative text-white/80 transition-colors hover:text-white" aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FFCE00]" />
            </button>
            <span className="hidden rounded-full bg-white px-4 py-1.5 text-xs font-bold tracking-wide text-bank-green sm:block">
              LOG OUT
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bank-dark text-xs font-bold">
              JL
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* ------------------------------------------------------ greeting */}
        <div className="flex flex-wrap items-end justify-between gap-3 animate-fade-up">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-bank-ink">
              Good afternoon, Jordan
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Member since 2019 · Last sign in today at 9:41 AM
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bank-soft px-3 py-1 text-xs font-semibold text-bank-green">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Secure session
          </span>
        </div>

        {/* ------------------------------------------------------ accounts */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTS.map((a, i) => (
            <div
              key={a.name}
              className="card p-5 transition-shadow hover:shadow-lift animate-fade-up"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{a.name}</p>
                <span className="text-xs font-medium text-gray-400">{a.mask}</span>
              </div>
              <p className="mt-3 text-2xl font-extrabold tabular-nums tracking-tight text-bank-ink">
                {a.balance}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{a.sub}</p>
              <div className="mt-4 flex gap-2">
                <button className="btn-ghost px-3 py-1.5 text-xs">Details</button>
                <button className="btn-ghost px-3 py-1.5 text-xs">Transfer</button>
              </div>
            </div>
          ))}
        </section>

        {/* ------------------------------------------- pre-qualified banner */}
        <section
          className="mt-8 overflow-hidden rounded-2xl bg-bank-dark text-white shadow-lift animate-fade-up"
          style={{ animationDelay: "180ms" }}
        >
          <div className="flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                Exclusive member offer
              </p>
              <h2 className="mt-1.5 text-xl font-extrabold sm:text-2xl">
                You&apos;re pre-qualified for up to $25,000
              </h2>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-white/75">
                Check your rate in minutes with an instant AI decision — no
                impact to your credit score, and close 100% online.
              </p>
            </div>
            <Link
              href="/apply?type=personal"
              className="btn shrink-0 bg-white px-6 py-3 text-sm text-bank-dark shadow hover:bg-bank-soft"
            >
              Check my rate
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>

        {/* ----------------------------------------------- self-service row */}
        <h2 className="mt-10 text-sm font-bold uppercase tracking-widest text-gray-400 animate-fade-up" style={{ animationDelay: "240ms" }}>
          Self-service
        </h2>
        <section className="mt-3 grid gap-4 sm:grid-cols-2">
          <Link
            href="/apply?type=personal"
            className="card group flex items-start gap-4 p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift animate-fade-up"
            style={{ animationDelay: "280ms" }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bank-soft text-bank-green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-bank-ink group-hover:text-bank-green">
                  Personal Loan
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-bank-green">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-gray-500">
                $1,000–$50,000 unsecured. Debt consolidation, home projects,
                major purchases.
              </span>
              <span className="mt-2 block text-xs font-semibold text-bank-green">
                Instant decision · eSign to close
              </span>
            </span>
          </Link>

          <Link
            href="/apply?type=auto"
            className="card group flex items-start gap-4 p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift animate-fade-up"
            style={{ animationDelay: "340ms" }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bank-soft text-bank-green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
                <rect x="3" y="11" width="18" height="6" rx="1.5" />
                <circle cx="7.5" cy="17" r="1.5" />
                <circle cx="16.5" cy="17" r="1.5" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-bank-ink group-hover:text-bank-green">
                  Auto Loan
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-bank-green">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-gray-500">
                Finance or refinance your vehicle. Secured rates, flexible
                36–60 month terms.
              </span>
              <span className="mt-2 block text-xs font-semibold text-bank-green">
                Instant decision · eSign to close
              </span>
            </span>
          </Link>
        </section>

        {/* ------------------------------------------------------ footer */}
        <footer className="mt-12 border-t border-gray-200 pt-6 pb-4 text-center">
          <p className="text-xs text-gray-400">
            Springfield Community Bank · Member FDIC · Equal Housing Lender
          </p>
          <p className="mt-1 text-[11px] text-gray-300">
            POC demo — no real accounts, credit pulls, or documents.
          </p>
          <p className="mt-2 text-xs">
            <Link href="/demo" className="font-semibold text-bank-green underline hover:text-bank-dark">
              Presenter? Start the guided demo from the Docusign App Center →
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
