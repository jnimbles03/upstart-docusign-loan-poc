"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ types */

type Decision = {
  status: "approved" | "declined" | "manual_review";
  approvedAmount?: number;
  apr?: number;
  termMonths?: number;
  monthlyPayment?: number;
  originationFee?: number;
  lossRate?: number;
};

type Doc = {
  documentId: string;
  name: string;
  templateId: string;
  preview: string;
};

type EnvSigner = { name: string; email: string; role: string };
type Envelope = {
  envelopeId: string;
  name: string;
  documentId: string;
  method?: "esign" | "clickwrap";
  signers: EnvSigner[];
  status: "sent" | "delivered" | "completed" | "declined";
  sentAt: string;
  completedAt?: string;
};

type Case = {
  caseId: string;
  borrower: {
    firstName: string;
    lastName: string;
    email: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    annualIncome: number;
    loanType: "personal" | "auto";
    requestedAmount: number;
    vehicleYear?: number;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleMileage?: number;
    vin?: string;
  };
  decision: Decision | null;
  workspace: { documents: Doc[] } | null;
  envelopes: Envelope[];
};

/* ----------------------------------------------------------------- helpers */

function money(n?: number) {
  if (n === undefined) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function pct(n?: number) {
  if (n === undefined) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

// DocuSign-style signature font styles (system stacks, cursive fallbacks)
const SIG_STYLES: { name: string; fontFamily: string; slant?: boolean }[] = [
  { name: "Style 1", fontFamily: "'Segoe Script','Savoye LET','Brush Script MT',cursive" },
  { name: "Style 2", fontFamily: "'Snell Roundhand','Apple Chancery',cursive" },
  { name: "Style 3", fontFamily: "'Brush Script MT','Lucida Handwriting',cursive" },
  { name: "Style 4", fontFamily: "Georgia,'Times New Roman',serif", slant: true },
];

// mock hex signature ID derived from the envelope id
function signatureId(seed: string) {
  let h = "";
  for (let i = 0; i < seed.length; i++) {
    h += (seed.charCodeAt(i) * 7 + i * 13).toString(16).toUpperCase();
  }
  return h.replace(/[^0-9A-F]/g, "").slice(0, 14).padEnd(14, "0") + "…";
}

/* ------------------------------------------------------------------ page */

export default function SignPage({
  params,
}: {
  params: { caseId: string; envelopeId: string };
}) {
  const router = useRouter();
  const [c, setCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [signed, setSigned] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [styleIdx, setStyleIdx] = useState(0);
  const signBlockRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/case/${params.caseId}`)
      .then(async (res) => {
        if (res.ok) setCase((await res.json()) as Case);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.caseId]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const env = c?.envelopes.find((e) => e.envelopeId === params.envelopeId);
  const doc = c?.workspace?.documents.find((d) => d.documentId === env?.documentId);
  const d = c?.decision ?? null;
  const b = c?.borrower ?? null;
  const borrowerName = b ? `${b.firstName} ${b.lastName}` : "";
  const alreadyCompleted = env?.status === "completed";
  const today = new Date().toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const sig = SIG_STYLES[styleIdx];

  async function finish() {
    setFinishing(true);
    await fetch(`/api/case/${params.caseId}?envelopeId=${params.envelopeId}`, {
      method: "POST",
    });
    setFinished(true);
    setTimeout(() => router.push(`/status/${params.caseId}`), 1900);
  }

  function scrollToField() {
    setStarted(true);
    signBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ------------------------------------------------------------ loading */

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#E8EAED]">
        <div className="flex h-12 items-center bg-ds-ink px-4">
          <div className="skeleton h-4 w-40 bg-white/20" />
        </div>
        <main className="flex-1 py-8">
          <div className="mx-auto w-full max-w-[860px] px-6">
            <div className="rounded-sm bg-white p-10 shadow-sheet sm:p-14">
              <div className="skeleton mb-3 h-3 w-56" />
              <div className="skeleton mb-2 h-8 w-96 max-w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton mb-3 h-4 w-full" />
              ))}
              <div className="skeleton mt-10 h-10 w-56" />
            </div>
          </div>
        </main>
      </div>
    );
  }
  if (!c || !env || !doc || !b) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#E8EAED] animate-fade-in">
        <p className="text-sm font-medium text-red-600">Signing session unavailable.</p>
        <button
          className="btn-ghost"
          onClick={() => router.push(`/status/${params.caseId}`)}
        >
          Back to workspace
        </button>
      </div>
    );
  }
  if (env.method === "clickwrap") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#E8EAED] animate-fade-in">
        <p className="max-w-sm text-center text-sm font-medium text-ds-ink">
          “{env.name}” is a click-to-agree item — complete it from your
          workspace Tasks tab.
        </p>
        <button
          className="btn-ghost"
          onClick={() => router.push(`/status/${params.caseId}`)}
        >
          Back to workspace
        </button>
      </div>
    );
  }

  /* --------------------------------------------------------------- render */

  return (
    <div className="flex min-h-screen flex-col bg-[#E8EAED]">
      {/* ---------------------------------------------- dark session bar */}
      <header className="sticky top-0 z-20 flex h-12 items-center gap-3 bg-ds-ink px-4 text-white">
        <p className="text-[15px] font-semibold">Review and complete</p>
        <div className="ml-auto flex items-center gap-2">
          {!alreadyCompleted && (
            <div className="flex overflow-hidden rounded border border-white/70">
              <button
                onClick={finish}
                disabled={!signed || finishing}
                className="px-4 py-1.5 text-sm font-semibold transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {finishing ? "Finishing…" : "Finish"}
              </button>
              <span className="w-px bg-white/40" />
              <button
                className="px-2 py-1.5 transition hover:bg-white/10"
                aria-label="Finish options"
                onClick={scrollToField}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          )}
          <div className="relative" ref={menuRef}>
            <button
              className="rounded p-1.5 transition hover:bg-white/10"
              aria-label="More actions"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="12" cy="19" r="1.7" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 w-56 overflow-hidden rounded-xl border border-ds-line bg-white py-1.5 text-ds-ink shadow-lift animate-scale-in">
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50"
                  onClick={() => router.push(`/status/${params.caseId}`)}
                >
                  Finish later
                </button>
                <button
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-gray-400"
                >
                  Decline to sign
                  <span className="text-[10px]">POC</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------- document */}
      <main className="relative flex-1 overflow-y-auto py-8 pb-24">
        {/* right icon toolbar (visual) */}
        <div className="fixed right-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-5 text-ds-grayText md:flex">
          {[
            <svg key="a" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M9 8h6M9 12h6M9 16h4" />
            </svg>,
            <svg key="b" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
            </svg>,
            <svg key="c" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
            </svg>,
            <svg key="d" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" />
            </svg>,
          ].map((icon, i) => (
            <span key={i} className="cursor-pointer transition-colors hover:text-ds-ink">
              {icon}
            </span>
          ))}
        </div>

        <div className="relative mx-auto w-full max-w-[860px] px-6">
          {/* START tag */}
          {!started && !signed && !alreadyCompleted && (
            <button
              onClick={scrollToField}
              className="absolute -left-1 top-40 z-10 rounded-sm bg-ds-purple px-4 py-2.5 text-xs font-bold tracking-wide text-white shadow-sheet transition hover:brightness-110 animate-fade-in"
            >
              START
            </button>
          )}

          {/* sheet */}
          <div className="rounded-sm bg-white p-10 shadow-sheet sm:p-14">
            {/* letterhead */}
            <div className="mb-8 border-b border-gray-200 pb-6">
              <p className="text-xs uppercase tracking-widest text-ds-grayText">
                Springfield Community Bank · Consumer Lending
              </p>
              <h1 className="mt-2 text-2xl font-bold text-ds-ink">{doc.name}</h1>
              <p className="mt-1 text-xs text-ds-grayText">
                Generated via Docusign Document Prep · Template {doc.templateId}
              </p>
            </div>

            {/* parties */}
            <div className="mb-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-ds-grayText">Borrower</p>
                <p className="font-medium">{borrowerName}</p>
                <p className="text-ds-grayText">
                  {b.street}, {b.city}, {b.state} {b.zip}
                </p>
                <p className="text-ds-grayText">{b.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ds-grayText">Lender</p>
                <p className="font-medium">Springfield Community Bank</p>
                <p className="text-ds-grayText">lending@springfieldbank.example</p>
              </div>
            </div>

            {/* terms */}
            {d?.status === "approved" && (
              <table className="mb-6 w-full border-collapse text-sm">
                <tbody>
                  {[
                    ["Loan type", b.loanType === "auto" ? "Auto (secured)" : "Personal (unsecured)"],
                    ["Principal amount", money(d.approvedAmount)],
                    ["Annual Percentage Rate (APR)", pct(d.apr)],
                    ["Term", `${d.termMonths} months`],
                    ["Monthly payment", money(d.monthlyPayment)],
                    ["Origination fee", money(d.originationFee)],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b border-gray-100">
                      <td className="py-2 text-ds-grayText">{k}</td>
                      <td className="py-2 text-right font-semibold">{v}</td>
                    </tr>
                  ))}
                  {b.loanType === "auto" && (
                    <>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-ds-grayText">Vehicle</td>
                        <td className="py-2 text-right font-semibold">
                          {b.vehicleYear} {b.vehicleMake} {b.vehicleModel}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-ds-grayText">VIN / Odometer</td>
                        <td className="py-2 text-right font-semibold">
                          {b.vin || "N/A"} · {(b.vehicleMileage ?? 0).toLocaleString()} mi
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            )}

            {/* legal text (mock) */}
            <div className="mb-12 space-y-3 text-xs leading-relaxed text-ds-grayText">
              <p>
                By signing below, Borrower agrees to the terms of this{" "}
                {doc.name}, including the repayment schedule, fees, and
                disclosures set forth herein. This document was prepared
                electronically and presented for signature via Docusign.
              </p>
              <p>
                Borrower acknowledges receipt of all required disclosures and
                agrees that an electronic signature has the same legal effect as
                a handwritten signature under the ESIGN Act and applicable state
                law. (POC content — not a real agreement.)
              </p>
            </div>

            {/* signature block */}
            <div ref={signBlockRef} className="scroll-mt-24">
              <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
                {/* borrower */}
                <div>
                  <div className="relative">
                    {/* yellow Sign tag */}
                    {!signed && !alreadyCompleted && (
                      <button
                        onClick={() => setAdoptOpen(true)}
                        className="absolute -top-9 left-24 z-10 flex flex-col items-center animate-fade-in"
                      >
                        <span className="rounded-sm bg-ds-yellow px-3 py-1.5 text-xs font-bold text-ds-ink shadow-sheet transition hover:brightness-95">
                          Sign
                        </span>
                        <svg width="16" height="12" viewBox="0 0 16 12" className="text-ds-yellow">
                          <path d="M8 12 0 0h16L8 12Z" fill="currentColor" />
                        </svg>
                      </button>
                    )}
                    <p className="border-b border-gray-800 pb-1 text-xs font-bold uppercase tracking-wide text-gray-800">
                      Signature of Borrower
                    </p>
                  </div>

                  {signed || alreadyCompleted ? (
                    /* DocuSigned stamp */
                    <div className="mt-3 inline-block animate-fade-in">
                      <div className="rounded-md border-2 border-[#3E63DD] px-4 pb-2 pt-5">
                        <p className="-mt-8 mb-1 bg-white px-1 text-[11px] font-semibold text-[#3E63DD]">
                          DocuSigned by:
                        </p>
                        <p
                          className="text-3xl leading-none text-[#1B2A6B]"
                          style={{
                            fontFamily: sig.fontFamily,
                            fontStyle: sig.slant ? "italic" : "normal",
                          }}
                        >
                          {borrowerName}
                        </p>
                        <p className="mt-1.5 text-[10px] tracking-wide text-[#3E63DD]">
                          {signatureId(env.envelopeId)}
                        </p>
                      </div>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-800">
                        {b.firstName} {b.lastName}
                        <span className="ml-6 font-normal normal-case text-ds-grayText">
                          {today}
                        </span>
                      </p>
                      <p className="text-[10px] uppercase text-ds-grayText">
                        Name <span className="ml-16">Date</span>
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAdoptOpen(true)}
                      className="ds-field mt-3 cursor-pointer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2C34" strokeWidth="2">
                        <path d="M4 22V2M4 3h13l-3 4.5L17 12H4" />
                      </svg>
                      <span className="text-sm font-semibold text-ds-ink">
                        Sign Here
                      </span>
                    </button>
                  )}
                </div>

                {/* lender */}
                <div>
                  <p className="border-b border-gray-300 pb-1 text-xs font-bold uppercase tracking-wide text-gray-400">
                    Signature of Lender
                  </p>
                  <div className="mt-3 rounded-sm border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
                    <p className="text-sm text-ds-grayText">Springfield Community Bank</p>
                    <p className="text-[10px] text-ds-grayText">
                      Routed after borrower completion
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------ bottom bar */}
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-ds-line bg-[#F1F2F4]">
        <div className="relative mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-6">
          <p className="truncate text-xs font-medium text-ds-grayText">
            {doc.name.replace(/\s+/g, "_")}.pdf
          </p>
          {!alreadyCompleted && (
            <button
              onClick={finish}
              disabled={!signed || finishing}
              className="btn absolute left-1/2 -translate-x-1/2 bg-ds-purple px-10 py-2.5 text-sm tracking-wide text-white shadow-lift hover:brightness-110"
            >
              {finishing ? "FINISHING…" : "FINISH"}
            </button>
          )}
          {alreadyCompleted && (
            <span className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-xs font-semibold text-ds-green">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Completed{env.completedAt ? ` · ${new Date(env.completedAt).toLocaleString()}` : ""}
            </span>
          )}
          <div className="flex items-center gap-3 text-xs text-ds-grayText">
            <span>1 of 1</span>
            <span className="hidden items-center gap-2 sm:flex">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="cursor-pointer hover:text-ds-ink">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5M8 11h6" />
              </svg>
              <span className="tabular-nums">100%</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="cursor-pointer hover:text-ds-ink">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
              </svg>
            </span>
          </div>
        </div>
      </footer>

      {/* ------------------------------------------------- adopt signature */}
      {adoptOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 animate-fade-in"
          onClick={() => setAdoptOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-md bg-white shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-start justify-between border-b border-ds-line px-7 pb-4 pt-5">
              <h2 className="text-xl font-bold text-ds-ink">Adopt Your Signature</h2>
              <button
                onClick={() => setAdoptOpen(false)}
                className="text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-7 py-5">
              <p className="text-sm text-gray-700">
                Confirm your name, initials, and signature.
              </p>
              <p className="mt-1 text-xs text-ds-grayText">* Required</p>

              {/* name / initials */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-800">
                    Full Name<span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-sm border border-gray-400 px-3 py-2 text-sm focus:border-ds-purple focus:outline-none"
                    defaultValue={borrowerName}
                    readOnly
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-800">
                    Initials<span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-sm border border-gray-400 px-3 py-2 text-sm focus:border-ds-purple focus:outline-none"
                    defaultValue={`${b.firstName[0] ?? ""}${b.lastName[0] ?? ""}`}
                    readOnly
                  />
                </div>
              </div>

              {/* tabs */}
              <div className="mt-5 flex gap-6 border-b border-ds-line">
                <span className="relative pb-2 text-xs font-bold tracking-wide text-ds-blue">
                  SELECT STYLE
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ds-blue" />
                </span>
                {["DRAW", "UPLOAD"].map((t) => (
                  <span
                    key={t}
                    className="flex cursor-not-allowed items-center gap-1.5 pb-2 text-xs font-bold tracking-wide text-gray-400"
                  >
                    {t}
                    <span className="rounded bg-gray-100 px-1 text-[9px]">POC</span>
                  </span>
                ))}
              </div>

              {/* preview */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-700">
                  Preview
                </p>
                <button
                  onClick={() => setStyleIdx((i) => (i + 1) % SIG_STYLES.length)}
                  className="rounded-full border-2 border-ds-green px-3.5 py-1 text-xs font-semibold text-ds-green transition hover:bg-ds-greenSoft"
                >
                  Change Style
                </button>
              </div>
              <div className="mt-2 flex items-center gap-6 rounded-sm border border-gray-300 px-5 py-4">
                <div className="inline-block rounded-md border-2 border-[#3E63DD] px-4 pb-2 pt-5">
                  <p className="-mt-8 mb-1 bg-white px-1 text-[11px] font-semibold text-[#3E63DD]">
                    DocuSigned by:
                  </p>
                  <p
                    className="text-3xl leading-none text-[#1B2A6B]"
                    style={{
                      fontFamily: sig.fontFamily,
                      fontStyle: sig.slant ? "italic" : "normal",
                    }}
                  >
                    {borrowerName}
                  </p>
                  <p className="mt-1.5 text-[10px] tracking-wide text-[#3E63DD]">
                    {signatureId(env.envelopeId)}
                  </p>
                </div>
                <div className="inline-block rounded-md border-2 border-[#3E63DD] px-4 py-3">
                  <p
                    className="text-2xl leading-none text-[#1B2A6B]"
                    style={{
                      fontFamily: sig.fontFamily,
                      fontStyle: sig.slant ? "italic" : "normal",
                    }}
                  >
                    {b.firstName[0]}
                    {b.lastName[0]}
                  </p>
                </div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">
                  {sig.name}
                </p>
              </div>

              {/* legal */}
              <p className="mt-4 text-xs leading-relaxed text-ds-grayText">
                By selecting Adopt and Sign, I agree that the signature and
                initials will be the electronic representation of my signature
                and initials for all purposes when I (or my agent) use them on
                documents, including legally binding contracts — just the same
                as a pen-and-paper signature or initial.
              </p>
            </div>

            {/* footer */}
            <div className="flex items-center gap-4 border-t border-ds-line px-7 py-4">
              <button
                className="rounded-sm bg-ds-yellow px-6 py-2.5 text-xs font-bold tracking-wide text-ds-ink shadow-sm transition hover:brightness-95"
                onClick={() => {
                  setAdoptOpen(false);
                  setSigned(true);
                  setStarted(true);
                }}
              >
                ADOPT AND SIGN
              </button>
              <button
                className="text-xs font-bold tracking-wide text-gray-500 transition-colors hover:text-gray-700"
                onClick={() => setAdoptOpen(false)}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ success overlay */}
      {finished && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/95 backdrop-blur-sm animate-fade-in">
          <div className="text-center animate-scale-in">
            <span className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-ds-greenSoft">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ds-green text-white animate-pop-check">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </span>
            <h2 className="text-2xl font-bold text-ds-ink">You&apos;re all set</h2>
            <p className="mt-1.5 text-sm text-ds-grayText">
              {env.name} was signed and completed.
              <br />
              Returning to your workspace…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
