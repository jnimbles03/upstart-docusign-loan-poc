"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ logos */

function DocusignGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="14" height="14" rx="3" fill="#6E45E2" />
      <rect x="7" y="7" width="14" height="14" rx="3" fill="#DC2C34" fillOpacity="0.9" />
      <rect x="10" y="10" width="12" height="12" rx="3" fill="#FFCE00" fillOpacity="0.85" />
    </svg>
  );
}

function UpstartMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 13.5 12 5.8l8.5 7.7" fill="none" stroke="#0DBEA8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 18.2h8" fill="none" stroke="#0DBEA8" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

/* ----------------------------------------------------------- app icons */

function AppIcon({ id, size = 30 }: { id: string; size?: number }) {
  const s = size;
  switch (id) {
    case "box":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#fff" />
          <path d="M7 13c0-2 1.6-3.5 3.5-3.5S14 11 14 13v4c0 2-1.6 3.5-3.5 3.5S7 19 7 17v-4Z" fill="#1579C6" />
          <path d="M15 13c0-2 1.6-3.5 3.5-3.5S22 11 22 13v1.5h-4.5V13c0-.8.4-1.3 1-1.3s1 .5 1 1.3V17c0 2-1.6 3.5-3.5 3.5S15 19 15 17v-4Z" fill="#1579C6" opacity="0.75" />
        </svg>
      );
    case "dropbox":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#0061FF" />
          <path d="m10 7 5 3.2-5 3.2-5-3.2L10 7ZM20 7l5 3.2-5 3.2-5-3.2L20 7ZM5 16.6l5-3.2 5 3.2-5 3.2-5-3.2ZM15 16.6l5-3.2 5 3.2-5 3.2-5-3.2ZM10 21.5l5 3 5-3-5-3.2-5 3.2Z" fill="#fff" />
        </svg>
      );
    case "drive":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#fff" />
          <path d="M12 5.5 5.5 17h6l6.5-11.5H12Z" fill="#FABB05" />
          <path d="m18 5.5 6.5 11.5h-6L12 5.5h6Z" fill="#34A853" />
          <path d="M5.5 17 8.5 22h13l3-5h-19Z" fill="#188038" />
          <path d="M5.5 17h9l-6 5-3-5Z" fill="#1E88E5" />
        </svg>
      );
    case "hubspot":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#FF5C35" />
          <circle cx="15" cy="15" r="4" fill="#fff" />
          <circle cx="21.5" cy="8.5" r="2.2" fill="#fff" />
          <path d="M17.5 11.5l2.5-2.5M12 18.5 7 24" stroke="#fff" strokeWidth="2" />
        </svg>
      );
    case "email":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#E8262E" />
          <circle cx="15" cy="15" r="6.5" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx="15" cy="15" r="2" fill="#fff" />
          <path d="M17 13.5V17a2.5 2.5 0 0 0 4 2" fill="none" stroke="#fff" strokeWidth="2" />
        </svg>
      );
    case "onedrive":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#0364B8" />
          <path d="M10 21a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 21.2 13 3.8 3.8 0 0 1 21 21H10Z" fill="#fff" />
        </svg>
      );
    case "sharepoint":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#0F7B6C" />
          <circle cx="13" cy="15" r="7" fill="#fff" />
          <text x="13" y="18.5" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0F7B6C">S</text>
          <circle cx="21" cy="10" r="4" fill="#fff" opacity="0.85" />
          <circle cx="22" cy="19" r="5" fill="#fff" opacity="0.7" />
        </svg>
      );
    case "prisidio":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#F4B942" />
          <path d="M15 5l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V9l8-4Z" fill="#fff" />
          <path d="M15 8l5.5 2.8V15c0 3.6-2.4 6-5.5 7.2-3.1-1.2-5.5-3.6-5.5-7.2v-4.2L15 8Z" fill="#F4B942" />
        </svg>
      );
    case "quik":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#7A1FA2" />
          <path d="M17.5 17.5a6 6 0 1 1 2-2L23 19l-2 2-3.5-3.5Z" fill="#fff" />
          <circle cx="13" cy="13" r="2.5" fill="#7A1FA2" />
        </svg>
      );
    case "salesforce":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#00A1E0" />
          <path d="M11 21a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.5A3.4 3.4 0 0 1 20.5 21H11Z" fill="#fff" />
        </svg>
      );
    case "stripe":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#635BFF" />
          <path d="M15 12.5c0-.8.7-1.1 1.7-1.1 1.5 0 3.3.5 4.8 1.3V8.4c-1.6-.6-3.2-.9-4.8-.9-3.9 0-6.5 2-6.5 5.4 0 5.3 7.3 4.4 7.3 6.7 0 .9-.8 1.2-1.9 1.2-1.6 0-3.7-.7-5.4-1.6v4.3c1.8.8 3.7 1.3 5.4 1.3 4 0 6.7-2 6.7-5.3 0-5.6-7.3-4.6-7.3-7Z" fill="#fff" />
        </svg>
      );
    case "vonage":
      return (
        <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden>
          <rect width="30" height="30" rx="6" fill="#fff" />
          <path d="M6 7h5l4 10 4-10h5L18 23h-6L6 7Z" fill="#1A1A2E" />
        </svg>
      );
    case "upstart":
      return (
        <span className="flex items-center justify-center rounded-md bg-up-soft" style={{ width: s, height: s }}>
          <UpstartMark size={s * 0.65} />
        </span>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------ app data */

type App = {
  id: string;
  name: string;
  vendor: string;
  desc: string;
  badge?: string;
};

const APPS: App[] = [
  { id: "box", name: "Box", vendor: "Docusign", desc: "Archive signed documents in a Box folder" },
  { id: "dropbox", name: "Dropbox", vendor: "Docusign", desc: "Archive signed documents in a DropBox folder" },
  { id: "email", name: "Email Verification", vendor: "Docusign", desc: "Verify email addresses in real-time data from LexisNexis® Risk Solutions" },
  { id: "drive", name: "Google Drive", vendor: "Docusign", desc: "Archive signed documents in a Google Drive folder" },
  { id: "hubspot", name: "HubSpot", vendor: "Docusign", desc: "Attach a signed doc to customer record in HubSpot" },
  { id: "onedrive", name: "Microsoft OneDrive", vendor: "Docusign", desc: "Archive signed documents to OneDrive folder" },
  { id: "sharepoint", name: "Microsoft Sharepoint", vendor: "Docusign", desc: "Archive signed documents to SharePoint folder" },
  { id: "prisidio", name: "Prisidio", vendor: "Prisidio", desc: "Store your signed documents in a vault" },
  { id: "quik", name: "Quik!", vendor: "QuickForms", desc: "Archive signed doc to Quik to extract data from signed docs" },
  { id: "salesforce", name: "Salesforce", vendor: "Docusign", desc: "Keep workflows intact and your Salesforce data accurate", badge: "Early Access" },
  { id: "stripe", name: "Stripe", vendor: "Docusign", desc: "Create a customer subscription in Stripe after signing" },
  { id: "upstart", name: "Upstart", vendor: "Upstart", desc: "AI credit decisions with risk-based pricing inside your agreement workflow" },
  { id: "vonage", name: "Vonage", vendor: "Docusign", desc: "Verify phone number during signature" },
];

/* -------------------------------------------------------------------- page */

export default function AppCenterPage() {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ------------------------------------------------------- top bar */}
      <header className="flex h-14 items-center gap-4 border-b border-ds-line bg-white px-6">
        <span className="flex items-center gap-2">
          <DocusignGlyph />
          <span className="text-[16px] font-bold tracking-tight text-ds-ink">
            docusign
          </span>
        </span>
        <span className="border-l border-ds-line pl-4 text-sm font-semibold text-ds-ink">
          App Center
        </span>
        <nav className="ml-4 flex items-center gap-6 self-stretch text-sm font-medium">
          <span className="relative flex h-full items-center font-bold text-ds-ink">
            Browse
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-ds-ink" />
          </span>
          <span className="cursor-pointer text-ds-grayText transition-colors hover:text-ds-ink">
            Manage
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden cursor-pointer items-center gap-2 rounded-md border border-gray-400 px-3.5 py-1.5 text-xs font-semibold text-ds-ink sm:flex">
            Try in Demo Account
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="8" y="8" width="13" height="13" rx="2" />
              <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
            </svg>
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8A33D] text-xs font-bold text-white">
            PS
          </span>
        </div>
      </header>

      {/* ---------------------------------------------------------- hero */}
      <div className="bg-gradient-to-r from-[#188FB4] via-[#7A4FC9] to-[#C2399B] px-6 py-12 text-center text-white">
        <h1 className="text-[28px] font-medium tracking-tight sm:text-4xl animate-fade-up">
          Work seamlessly with Docusign
        </h1>
        <p className="mt-2 text-sm text-white/90 animate-fade-up" style={{ animationDelay: "70ms" }}>
          Connect all your apps into Docusign-without the hassle of switching tools
        </p>
        <div className="mx-auto mt-6 flex max-w-lg shadow-lift animate-fade-up" style={{ animationDelay: "130ms" }}>
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="w-full rounded-l-md py-2.5 pl-9 pr-3 text-sm text-ds-ink focus:outline-none"
              placeholder="Search apps"
            />
          </div>
          <span className="cursor-pointer rounded-r-md bg-ds-blue px-6 py-2.5 text-sm font-semibold text-white">
            Search
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------- body */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-7">
        {/* filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ds-grayText">
            Filters:
          </span>
          {["Works with", "Price", "Approved for you"].map((f) => (
            <span
              key={f}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-400 px-3.5 py-1.5 text-xs font-medium text-ds-ink hover:bg-gray-50"
            >
              {f}
              {f !== "Approved for you" && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              )}
            </span>
          ))}
          <div className="ml-auto flex items-center gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ds-grayText">
              Sort by:
            </span>
            <span className="flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-400 px-3.5 py-1.5 text-xs font-medium text-ds-ink hover:bg-gray-50">
              Name (A–Z)
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[230px_1fr]">
          {/* left rail cards */}
          <aside className="hidden space-y-5 lg:block">
            {[
              { t: "Want to build an app?", d: "Learn how to build extension apps", b: "Start Building" },
              { t: "Not seeing an app?", d: "Fill out this form to request an extension app you'd like to see", b: "Request App" },
              { t: "Have feedback?", d: "Let us know what you think. We want to hear from you.", b: "Give Feedback" },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-ds-line p-4">
                <h3 className="text-sm font-bold text-ds-ink">{x.t}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ds-grayText">
                  {x.d}
                </p>
                <span className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-400 px-3.5 py-1.5 text-xs font-semibold text-ds-ink hover:bg-gray-50">
                  {x.b}
                  {x.b === "Give Feedback" && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  )}
                </span>
              </div>
            ))}
          </aside>

          {/* apps grid */}
          <section>
            <h2 className="flex items-center gap-1.5 text-base font-bold text-ds-ink">
              Extension apps
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {APPS.map((a, i) => {
                const isUpstart = a.id === "upstart";
                return (
                  <button
                    key={a.id}
                    onClick={() => isUpstart && setDetailOpen(true)}
                    className={`relative rounded-lg border bg-white p-4 text-left transition-all animate-fade-up ${
                      isUpstart
                        ? added
                          ? "border-up-green ring-1 ring-up-green/40 shadow-card"
                          : "border-gray-200 shadow-sm hover:-translate-y-0.5 hover:border-up-green/60 hover:shadow-lift"
                        : "cursor-default border-gray-200 hover:shadow-sm"
                    }`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {a.badge && (
                      <span className="absolute right-3 top-3 rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-500">
                        {a.badge}
                      </span>
                    )}
                    {isUpstart && added && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-up-green px-2.5 py-0.5 text-[10px] font-bold text-white animate-pop-check">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        Added
                      </span>
                    )}
                    <AppIcon id={a.id} />
                    <p className="mt-2.5 text-sm font-bold text-ds-ink">{a.name}</p>
                    <p className="text-[11px] text-ds-grayText">By {a.vendor}</p>
                    <p className="mt-2 text-xs leading-snug text-ds-grayText">
                      {a.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* -------------------------------------------------------- footer */}
      <footer className="flex items-center justify-between bg-black px-6 py-4 text-xs text-white/70">
        <div className="flex gap-6">
          <span className="cursor-pointer hover:text-white">Terms of use</span>
          <span className="cursor-pointer hover:text-white">Privacy Policy</span>
        </div>
        <span>© DocuSign Inc. 2024</span>
      </footer>

      {/* -------------------------------------------- app detail modal */}
      {detailOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4 animate-fade-in"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* modal header */}
            <div className="flex items-center gap-4 border-b border-ds-line px-6 py-5">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-up-soft">
                <UpstartMark size={30} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-ds-ink">Upstart</h2>
                <p className="text-xs text-ds-grayText">By Upstart · Extension app</p>
              </div>
              {added ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-up-green px-4 py-2 text-xs font-bold text-white">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Added
                </span>
              ) : (
                <button
                  onClick={() => setAdded(true)}
                  className="btn bg-ds-blue px-6 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110"
                >
                  Add
                </button>
              )}
            </div>

            {/* modal body */}
            <div className="px-6 py-5">
              <h3 className="text-sm font-bold text-ds-ink">
                AI credit decisions, inside the agreement flow
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ds-grayText">
                The Upstart app brings Upstart&apos;s Credit Decision API into
                Docusign Workflow Builder. Applications collected via Web Forms
                are decisioned in real time — approvals, risk-based APR and
                term options, or declines with adverse action notices — then
                the workflow continues to document prep, a borrower workspace,
                and eSignature.
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  "Real-time decisions using 2,500+ variables per applicant",
                  "Risk-based pricing configured to your credit policy",
                  "Adverse action notices generated automatically on declines",
                  "Works with personal and auto loan workflows",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-700">
                    <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0AAF60" strokeWidth="2.6">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex gap-2">
                {["Web Forms", "Workflow Builder", "eSignature", "Workspaces"].map((w) => (
                  <span key={w} className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-500">
                    Works with {w}
                  </span>
                ))}
              </div>
            </div>

            {/* modal footer */}
            <div className="flex items-center justify-between border-t border-ds-line bg-gray-50 px-6 py-4">
              <button
                className="text-xs font-semibold text-ds-grayText hover:text-ds-ink"
                onClick={() => setDetailOpen(false)}
              >
                Close
              </button>
              {added && (
                <button
                  className="btn bg-ds-purple px-5 py-2 text-xs text-white shadow-sm hover:brightness-110"
                  onClick={() => router.push("/demo/workflow")}
                >
                  Open Workflow Builder
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------- added → next step */}
      {added && !detailOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ds-line bg-white/95 shadow-[0_-8px_30px_rgba(19,3,46,0.12)] backdrop-blur animate-fade-up">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-up-soft">
              <UpstartMark size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ds-ink">
                Upstart added to your account
              </p>
              <p className="text-xs text-ds-grayText">
                Now build it into a workflow — it takes about a minute.
              </p>
            </div>
            <button
              className="btn bg-ds-purple px-6 py-2.5 text-sm text-white shadow-lift hover:brightness-110"
              onClick={() => router.push("/demo/workflow")}
            >
              Open Workflow Builder
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
