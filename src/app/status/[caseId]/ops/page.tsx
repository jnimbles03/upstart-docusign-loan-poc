"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ types */

type Decision = {
  applicationId: string;
  status: "approved" | "declined" | "manual_review";
  approvedAmount?: number;
  apr?: number;
  termMonths?: number;
  monthlyPayment?: number;
  lossRate?: number;
  originationFee?: number;
  riskScore?: number;
  modelVersion: string;
  policyVersion: string;
  decisionedAt: string;
  reasons?: string[];
  adverseActionNotice?: string;
};

type Doc = {
  documentId: string;
  name: string;
  templateId: string;
  format: string;
  sizeBytes: number;
  generatedAt: string;
  preview: string;
};

type Workspace = {
  workspaceId: string;
  name: string;
  caseId: string;
  createdAt: string;
  documents: Doc[];
};

type EnvSigner = { name: string; email: string; role: string };
type Envelope = {
  envelopeId: string;
  name: string;
  documentId: string;
  signers: EnvSigner[];
  status: "sent" | "delivered" | "completed" | "declined";
  sentAt: string;
  completedAt?: string;
  signingUrl: string;
};

type Step = {
  key: string;
  label: string;
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  detail?: string;
};

type Case = {
  caseId: string;
  createdAt: string;
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
  offerAccepted: boolean | null;
  workspace: Workspace | null;
  envelopes: Envelope[];
  steps: Step[];
};

type Toast = { id: number; message: string };

/* ------------------------------------------------------------- constants */

const ENV_PILL: Record<Envelope["status"], { label: string; cls: string }> = {
  sent: { label: "Need to Sign", cls: "bg-[#FFF3CD] text-[#8A6D1A]" },
  delivered: { label: "Waiting for Others", cls: "bg-blue-50 text-blue-700" },
  completed: { label: "Completed", cls: "bg-ds-greenSoft text-ds-green" },
  declined: { label: "Declined", cls: "bg-red-100 text-red-700" },
};

const POLL_MS = 2500;

function money(n?: number) {
  if (n === undefined) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function money0(n?: number) {
  if (n === undefined) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function pct(n?: number) {
  if (n === undefined) return "—";
  return `${(n * 100).toFixed(2)}%`;
}
function pmt(principal: number, apr: number, months: number) {
  const r = apr / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/* ------------------------------------------------------------------ logos */

function DsLogo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden>
        <rect width="28" height="28" rx="6" fill="#DC2C34" />
        <path d="M7 18.5c3.2-.8 4.8-5 5.6-9.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M10.5 17.5c3.8 1 7.5-.8 10.5-5.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span className="text-[17px] font-bold tracking-tight text-ds-ink">
        Docusign
      </span>
    </span>
  );
}

function UpstartMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M3.5 13.5 12 5.8l8.5 7.7"
        fill="none"
        stroke="#0DBEA8"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 18.2h8"
        fill="none"
        stroke="#0DBEA8"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UpstartLogo() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <UpstartMark />
      <span className="text-[17px] font-bold tracking-tight text-up-ink">
        Upstart
      </span>
    </span>
  );
}

const NAV_ICONS: Record<string, React.ReactNode> = {
  Home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  Agreements: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  Templates: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  Workflows: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M7.5 12h6M13.5 12l3-4.5M13.5 12l3 4.5" />
    </svg>
  ),
  Reports: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  Settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.23.6.83 1 1.5 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </svg>
  ),
};

/* ----------------------------------------------------------- step icons */

function StepIcon({ stepKey }: { stepKey: string }) {
  const cls = "h-5 w-5";
  switch (stepKey) {
    case "webform":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4" />
        </svg>
      );
    case "decision":
      return <UpstartMark />;
    case "offer":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
        </svg>
      );
    case "docprep":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
          <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
          <path d="M14 2v6h6M9 13h6M9 17h6" />
        </svg>
      );
    case "workspace":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        </svg>
      );
    case "esign":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
          <path d="m14.5 4.5 5 5L8 21H3v-5L14.5 4.5Z" />
          <path d="m12.5 6.5 5 5" />
        </svg>
      );
    case "adverse":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="1.8">
          <path d="M4 6h16v12H4z" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ page */

export default function StatusPage({
  params,
}: {
  params: { caseId: string };
}) {
  const caseId = params.caseId;
  const router = useRouter();
  const [c, setCase] = useState<Case | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [termChoice, setTermChoice] = useState<"primary" | "alt">("primary");
  const prevCompletedRef = useRef<number | null>(null);
  const wsMenuRef = useRef<HTMLDivElement>(null);

  const pushToast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const fetchCase = useCallback(async (): Promise<Case | null> => {
    try {
      const res = await fetch(`/api/case/${caseId}`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as Case;
    } catch {
      return null;
    }
  }, [caseId]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    fetchCase().then((data) => {
      if (cancelled) return;
      if (data) {
        setCase(data);
        prevCompletedRef.current = data.envelopes.filter(
          (e) => e.status === "completed",
        ).length;
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchCase]);

  // Live polling while envelopes await signature (e.g. signing in another tab)
  useEffect(() => {
    if (!c || c.envelopes.length === 0) return;
    if (c.envelopes.every((e) => e.status === "completed")) return;

    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden) return;
      const data = await fetchCase();
      if (!data || stopped) return;
      const nowCompleted = data.envelopes.filter(
        (e) => e.status === "completed",
      ).length;
      if (
        prevCompletedRef.current !== null &&
        nowCompleted > prevCompletedRef.current
      ) {
        const newly = data.envelopes.filter(
          (e) =>
            e.status === "completed" &&
            !c.envelopes.some(
              (p) => p.envelopeId === e.envelopeId && p.status === "completed",
            ),
        );
        newly.forEach((e) => pushToast(`“${e.name}” was signed and completed.`));
      }
      prevCompletedRef.current = nowCompleted;
      setCase(data);
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [c, fetchCase, pushToast]);

  // close workspace overflow menu on outside click
  useEffect(() => {
    if (!wsMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [wsMenuOpen]);

  async function acceptOffer() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/case/${caseId}/accept`, { method: "POST" });
      const data = (await res.json()) as Case & { error?: string };
      if (res.ok) {
        setCase(data);
        prevCompletedRef.current = 0;
        pushToast("Envelopes sent to the borrower for eSignature.");
      } else {
        setNotice(data.error ?? "Could not accept offer.");
      }
    } catch {
      setNotice("Network error accepting offer.");
    }
    setBusy(false);
  }

  /* ---------------------------------------------------- loading / errors */

  if (loading) {
    return <StatusSkeleton />;
  }
  if (notFound || !c) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ds-bg animate-fade-in">
        <p className="text-sm font-medium text-red-600">Case not found.</p>
        <button className="btn-ghost" onClick={() => router.push("/")}>
          Back to portal
        </button>
      </div>
    );
  }

  const d = c.decision;
  const b = c.borrower;
  const completedEnvs = c.envelopes.filter((e) => e.status === "completed").length;
  const allDone = c.envelopes.length > 0 && completedEnvs === c.envelopes.length;
  const live = c.envelopes.length > 0 && !allDone;

  const overall = d?.status === "declined"
    ? { label: "Declined", cls: "bg-red-100 text-red-700" }
    : d?.status === "manual_review"
      ? { label: "In Review", cls: "bg-amber-100 text-amber-700" }
      : allDone
        ? { label: "Completed", cls: "bg-ds-greenSoft text-ds-green" }
        : c.envelopes.some((e) => e.status === "sent")
          ? { label: "Need to Sign", cls: "bg-[#FFF3CD] text-[#8A6D1A]" }
          : { label: "In Progress", cls: "bg-gray-100 text-gray-600" };

  /* ------------------------------------------------------ workflow model */

  // Synthetic first card: the web form application that started the case.
  const webformStep: Step = {
    key: "webform",
    label: "Collect Data from Web Forms",
    status: "complete",
    detail: `${b.loanType === "auto" ? "Auto" : "Personal"} loan application submitted`,
    completedAt: c.createdAt,
  };
  const flowSteps = [webformStep, ...c.steps];
  const declinedPath = d?.status === "declined" || d?.status === "manual_review";

  /* ---------------------------------------------------------------- render */

  return (
    <div className="flex min-h-screen bg-ds-bg text-ds-ink">
      {/* --------------------------------------------------------- sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ds-line bg-white md:flex">
        <div className="flex h-14 items-center border-b border-ds-line px-5">
          <DsLogo />
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {["Home", "Agreements", "Templates", "Workflows", "Reports", "Settings"].map(
            (item) => {
              const active = item === "Agreements";
              return (
                <a
                  key={item}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#FCEBEC] text-ds-red"
                      : "text-ds-grayText hover:bg-gray-50"
                  }`}
                >
                  {NAV_ICONS[item]}
                  {item}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-ds-red" />
                  )}
                </a>
              );
            },
          )}
        </nav>
        <div className="border-t border-ds-line p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ds-ink text-xs font-bold text-white">
              LO
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Loan Operations</p>
              <p className="truncate text-xs text-ds-grayText">
                Springfield Community Bank
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* --------------------------------------------------------- main col */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="flex h-14 items-center gap-4 border-b border-ds-line bg-white px-6">
          <div className="md:hidden">
            <DsLogo />
          </div>
          <div className="relative hidden max-w-md flex-1 md:block">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="w-full rounded-full border border-ds-line bg-ds-bg py-1.5 pl-9 pr-3 text-sm transition focus:border-ds-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-ds-red/10"
              placeholder="Search agreements"
            />
          </div>
          <div className="ml-auto flex items-center gap-4">
            {live && (
              <span className="hidden items-center gap-1.5 rounded-full bg-ds-greenSoft px-3 py-1 text-xs font-semibold text-ds-green sm:flex">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ds-green opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ds-green" />
                </span>
                Live
              </span>
            )}
            <span className="hidden items-center gap-1.5 rounded-full bg-up-soft px-3 py-1 text-xs font-semibold text-up-dark sm:flex">
              <UpstartMark size={13} />
              Upstart App connected
            </span>
            <button className="relative text-ds-grayText transition-colors hover:text-ds-ink" aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ds-red" />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ds-ink text-xs font-bold text-white">
              LO
            </span>
          </div>
        </header>

        {/* content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
          {/* breadcrumb + title */}
          <div className="animate-fade-up">
            <p className="mb-1 text-xs text-ds-grayText">
              Agreements <span className="mx-1">/</span> {c.caseId}{" "}
              <span className="mx-1">/</span> Ops
            </p>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">
                  {b.loanType === "auto" ? "Auto" : "Personal"} Loan —{" "}
                  {b.firstName} {b.lastName}
                </h1>
                <span className={`ds-pill ${overall.cls}`}>{overall.label}</span>
                <span className="ds-pill bg-ds-ink text-white">
                  Behind the scenes · ops only
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-ghost"
                  onClick={() => router.push(`/status/${c.caseId}`)}
                >
                  Borrower view
                </button>
                <button className="btn-ghost" onClick={() => router.push("/")}>
                  Back to portal
                </button>
              </div>
            </div>
          </div>

          {/* ------------------------------------ workflow builder canvas */}
          <section className="card mb-6 overflow-hidden animate-fade-up" style={{ animationDelay: "60ms" }}>
            {/* builder chrome */}
            <div className="flex items-center gap-3 bg-ds-ink px-4 py-2.5 text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-white/70">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <svg width="18" height="18" viewBox="0 0 28 28" aria-hidden>
                <rect width="28" height="28" rx="6" fill="#DC2C34" />
                <path d="M7 18.5c3.2-.8 4.8-5 5.6-9.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M10.5 17.5c3.8 1 7.5-.8 10.5-5.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-semibold">Consumer Loan Origination</p>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ds-ink">
                Published
              </span>
              <div className="ml-auto flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/50">
                  <circle cx="5" cy="12" r="1.7" />
                  <circle cx="12" cy="12" r="1.7" />
                  <circle cx="19" cy="12" r="1.7" />
                </svg>
                <span className="btn pointer-events-none bg-ds-purple px-4 py-1.5 text-xs text-white">
                  Review &amp; Publish
                </span>
              </div>
            </div>

            {/* dotted canvas */}
            <div
              className="scroll-x-thin overflow-x-auto bg-ds-canvas px-6 py-8"
              style={{
                backgroundImage: "radial-gradient(#D8DCE1 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            >
              <div className="mx-auto flex w-full max-w-[430px] min-w-[340px] flex-col items-center">
                {/* start pill */}
                <div className="flex items-center gap-1.5 rounded-md bg-ds-ink px-3 py-1.5 text-xs font-semibold text-white shadow animate-fade-up">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
                    <circle cx="16" cy="6" r="2" />
                    <circle cx="10" cy="12" r="2" />
                    <circle cx="16" cy="18" r="2" />
                  </svg>
                  Start
                </div>

                {flowSteps.map((s, i) => {
                  const reached = s.status === "complete" || s.status === "running";
                  return (
                    <div key={s.key} className="flex w-full flex-col items-center">
                      <Connector reached={reached} delay={i * 100} />
                      <BuilderCard
                        step={s}
                        appLabel={appLabelFor(s.key)}
                        expanded={expandedStep === s.key}
                        onToggle={() =>
                          setExpandedStep(expandedStep === s.key ? null : s.key)
                        }
                        delay={i * 100 + 60}
                      />
                      {/* branch chips under the decision card */}
                      {s.key === "decision" && (
                        <div className="mt-3 flex w-full items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: `${i * 100 + 160}ms` }}>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                              !declinedPath
                                ? "border-ds-green/40 bg-ds-greenSoft text-ds-green"
                                : "border-gray-200 bg-white text-gray-300"
                            }`}
                          >
                            Rule met · Approved
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                              declinedPath
                                ? d?.status === "manual_review"
                                  ? "border-amber-300 bg-amber-50 text-amber-700"
                                  : "border-red-300 bg-red-50 text-red-600"
                                : "border-gray-200 bg-white text-gray-300"
                            }`}
                          >
                            Rule not met · {d?.status === "manual_review" ? "Manual review" : "Declined"}
                          </span>
                        </div>
                      )}
                      {/* adverse action end-node on the declined path */}
                      {s.key === "decision" && declinedPath && (
                        <div className="flex w-full flex-col items-center">
                          <Connector reached delay={i * 100 + 200} tone="red" />
                          <div
                            className="w-full rounded-xl border border-red-200 bg-white px-4 py-3.5 shadow-card animate-fade-up"
                            style={{ animationDelay: `${i * 100 + 260}ms` }}
                          >
                            <div className="flex items-start justify-between">
                              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
                                <StepIcon stepKey="adverse" />
                              </span>
                              <Kebab />
                            </div>
                            <p className="mt-2.5 text-sm font-semibold text-ds-ink">
                              {d?.status === "manual_review"
                                ? "Route to Manual Underwriting"
                                : "Issue Adverse Action Notice"}
                            </p>
                            <p className="mt-0.5 text-xs text-ds-grayText">
                              {d?.status === "manual_review"
                                ? "Task · Lending team queue"
                                : "Send an Email · FCRA notice attached"}
                            </p>
                            <p className="mt-2 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                              Terminal step
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ------------------------------------------- decision panel */}
          {d && (
            <section className="card mb-6 overflow-hidden animate-fade-up" style={{ animationDelay: "120ms" }}>
              <div className="flex items-center justify-between border-b border-ds-line bg-white px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <UpstartLogo />
                  <span className="text-sm font-semibold">Credit Decision</span>
                  <span className="text-xs text-ds-grayText">
                    · app result via workflow
                  </span>
                </div>
                <span
                  className={`ds-pill ${
                    d.status === "approved"
                      ? "bg-ds-greenSoft text-ds-green"
                      : d.status === "declined"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {d.status.replace("_", " ")}
                </span>
              </div>
              <div className="px-5 py-4">
                {d.status === "approved" && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric label="Approved amount" value={money(d.approvedAmount)} />
                    <Metric label="APR" value={pct(d.apr)} />
                    <Metric label="Term" value={`${d.termMonths} mo`} />
                    <Metric label="Monthly payment" value={money(d.monthlyPayment)} />
                    <Metric label="Origination fee" value={money(d.originationFee)} />
                    <Metric label="Modeled loss rate" value={pct(d.lossRate)} />
                    <Metric label="Risk score" value={`${d.riskScore ?? "—"}/100`} />
                    <Metric label="Model" value={d.modelVersion} small />
                  </div>
                )}

                {d.status === "declined" && (
                  <div className="space-y-3">
                    <ul className="list-disc pl-5 text-sm text-gray-700">
                      {d.reasons?.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    {d.adverseActionNotice && (
                      <details className="rounded-md border border-ds-line bg-gray-50 p-3">
                        <summary className="cursor-pointer text-sm font-medium text-gray-700">
                          View Adverse Action Notice (auto-generated)
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">
                          {d.adverseActionNotice}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {d.status === "manual_review" && (
                  <p className="text-sm text-amber-700">
                    {d.reasons?.[0] ??
                      "Application routed to manual underwriting (borderline risk)."}
                  </p>
                )}

                <p className="mt-3 text-xs text-gray-400">
                  Decisioned {new Date(d.decisionedAt).toLocaleString()} · Policy{" "}
                  {d.policyVersion}
                </p>
              </div>
            </section>
          )}

          {/* ---------------------------- offer: Upstart approval style */}
          {d?.status === "approved" && !c.offerAccepted && (
            <UpstartOffer
              d={d}
              busy={busy}
              notice={notice}
              termChoice={termChoice}
              setTermChoice={setTermChoice}
              onAccept={acceptOffer}
            />
          )}

          {/* ------------------------------------------- workspace */}
          {c.workspace && (
            <section className="card mb-6 overflow-hidden animate-fade-up" style={{ animationDelay: "200ms" }}>
              {/* workspace header */}
              <div className="flex flex-wrap items-center gap-3 border-b border-ds-line bg-white px-5 py-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FCEBEC]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2C34" strokeWidth="1.8">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">
                      {c.workspace.name}
                    </h2>
                    <span
                      className={`ds-pill ${
                        allDone
                          ? "bg-gray-100 text-gray-500"
                          : "bg-ds-greenSoft text-ds-green"
                      }`}
                    >
                      {allDone ? "Closed" : "Active"}
                    </span>
                  </div>
                  <p className="text-xs text-ds-grayText">
                    {c.workspace.workspaceId} · created{" "}
                    {new Date(c.workspace.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    className={`btn px-4 py-1.5 text-xs ${
                      c.envelopes.length > 0
                        ? "cursor-default bg-gray-100 text-gray-500"
                        : "bg-ds-red text-white shadow-sm hover:bg-ds-redDark"
                    }`}
                    disabled={c.envelopes.length > 0}
                  >
                    {c.envelopes.length > 0 ? "Sent for signature" : "Get signatures"}
                  </button>
                  <div className="relative" ref={wsMenuRef}>
                    <button
                      className="btn-ghost px-2.5 py-1.5"
                      onClick={() => setWsMenuOpen((o) => !o)}
                      aria-label="Workspace actions"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.7" />
                        <circle cx="12" cy="12" r="1.7" />
                        <circle cx="12" cy="19" r="1.7" />
                      </svg>
                    </button>
                    {wsMenuOpen && (
                      <div className="absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-xl border border-ds-line bg-white py-1.5 shadow-lift animate-scale-in">
                        {["View history", "Download all", "Rename", "Change status"].map(
                          (item) => (
                            <button
                              key={item}
                              disabled
                              className="flex w-full cursor-not-allowed items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-gray-400"
                            >
                              {item}
                              <span className="text-[10px]">POC</span>
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* personalized message to recipients */}
              <div className="flex items-start gap-2.5 border-b border-ds-line bg-[#FBFBFD] px-5 py-3">
                <svg className="mt-0.5 shrink-0 text-ds-grayText" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
                </svg>
                <p className="text-xs italic leading-relaxed text-ds-grayText">
                  Message to recipients: “Hi {b.firstName} — your{" "}
                  {b.loanType === "auto" ? "auto" : "personal"} loan documents are
                  ready. Please review and sign each item below.”
                </p>
              </div>

              {/* participants */}
              <div className="flex flex-wrap items-center gap-2 border-b border-ds-line px-5 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-ds-grayText">
                  Participants
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ds-line bg-white py-1 pl-1 pr-2.5 text-xs font-medium text-gray-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ds-ink text-[9px] font-bold text-white">
                    LO
                  </span>
                  Loan Operations
                  <span className="text-ds-grayText">· Owner (Manage)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ds-line bg-white py-1 pl-1 pr-2.5 text-xs font-medium text-gray-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ds-red text-[9px] font-bold text-white">
                    {b.firstName[0]}
                    {b.lastName[0]}
                  </span>
                  {b.firstName} {b.lastName}
                  <span className="text-ds-grayText">· Participate</span>
                </span>
              </div>

              {/* documents */}
              <ul className="divide-y divide-gray-100">
                {c.workspace.documents.map((doc) => (
                  <li key={doc.documentId}>
                    <div className="flex w-full items-center gap-3 px-5 py-3">
                      <span className="h-4 w-4 shrink-0 rounded border border-gray-300" />
                      <button
                        className="flex min-w-0 flex-1 items-center justify-between text-left transition-colors hover:bg-gray-50"
                        onClick={() =>
                          setOpenDoc(openDoc === doc.documentId ? null : doc.documentId)
                        }
                      >
                        <span className="flex min-w-0 items-center gap-3 text-sm font-medium text-gray-800">
                          <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2C34" strokeWidth="1.8">
                            <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
                            <path d="M14 2v6h6" />
                          </svg>
                          <span className="truncate">{doc.name}</span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                            {doc.format}
                          </span>
                        </span>
                        <span className="ml-3 inline-flex shrink-0 items-center gap-1.5 text-xs text-ds-grayText">
                          {Math.round(doc.sizeBytes / 1024)} KB
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            className={`transition-transform duration-200 ${openDoc === doc.documentId ? "rotate-180" : ""}`}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                      </button>
                    </div>
                    {openDoc === doc.documentId && (
                      <pre className="whitespace-pre-wrap border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-700 animate-fade-in">
                        {doc.preview}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
              {c.envelopes.length > 0 && (
                <p className="border-t border-ds-line bg-[#FBFBFD] px-5 py-2.5 text-[11px] text-ds-grayText">
                  These documents were sent for signature and are now part of
                  their envelopes (see Agreements below).
                </p>
              )}
            </section>
          )}

          {/* ------------------------------------------- agreements table */}
          {c.envelopes.length > 0 && (
            <section className="card mb-6 overflow-hidden animate-fade-up" style={{ animationDelay: "240ms" }}>
              <div className="flex items-center justify-between border-b border-ds-line bg-white px-5 py-3">
                <h2 className="text-sm font-semibold">Agreements</h2>
                <div className="flex items-center gap-3">
                  <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 sm:block">
                    <div
                      className="h-full rounded-full bg-ds-green transition-all duration-700"
                      style={{
                        width: `${(completedEnvs / c.envelopes.length) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-ds-grayText">
                    {completedEnvs}/{c.envelopes.length} completed
                  </span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ds-line bg-gray-50 text-left text-xs uppercase tracking-wide text-ds-grayText">
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Subject</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">
                      Recipients
                    </th>
                    <th className="hidden px-3 py-2.5 font-medium md:table-cell">
                      Last changed
                    </th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {c.envelopes.map((env) => {
                    const pill = ENV_PILL[env.status];
                    return (
                      <tr key={env.envelopeId} className="transition-colors hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <span className={`ds-pill ${pill.cls}`}>{pill.label}</span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-ds-ink">{env.name}</p>
                          <p className="text-xs text-ds-grayText">
                            {env.envelopeId}
                          </p>
                        </td>
                        <td className="hidden px-3 py-3 sm:table-cell">
                          {env.signers.map((s, i) => (
                            <p key={i} className="text-xs text-ds-grayText">
                              <span className="font-medium text-gray-700">
                                {s.role}:
                              </span>{" "}
                              {s.name}
                            </p>
                          ))}
                        </td>
                        <td className="hidden px-3 py-3 text-xs text-ds-grayText md:table-cell">
                          {new Date(
                            env.completedAt ?? env.sentAt,
                          ).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {env.status === "sent" ? (
                            <button
                              className="btn bg-ds-red px-4 py-1.5 text-xs text-white shadow-sm hover:bg-ds-redDark"
                              onClick={() =>
                                router.push(`/sign/${c.caseId}/${env.envelopeId}`)
                              }
                            >
                              Sign
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ds-green">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="animate-pop-check">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                              Signed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {allDone && (
                <div className="flex items-center gap-3 border-t border-ds-line bg-ds-greenSoft px-5 py-3.5 animate-fade-in">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ds-green text-white animate-pop-check">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <p className="text-sm font-semibold text-ds-green">
                    Loan closed — all envelopes completed. Funds disbursement
                    would follow (mocked).
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ----------------------- app center + workflow templates */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* App Center */}
            <section className="card mb-6 overflow-hidden animate-fade-up" style={{ animationDelay: "280ms" }}>
              <div className="flex items-center justify-between border-b border-ds-line bg-white px-5 py-3">
                <div>
                  <h2 className="text-sm font-semibold">App Center</h2>
                  <p className="text-xs text-ds-grayText">
                    Extension apps in this workflow
                  </p>
                </div>
                <span className="cursor-pointer text-xs font-semibold text-ds-red">
                  Browse apps
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                <AppTile
                  icon={<UpstartMark size={22} />}
                  name="Upstart"
                  desc="AI credit decisions inside your workflow"
                  installed
                />
                <AppTile
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
                      <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3Z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  }
                  name="ID Verification"
                  desc="Verify signer identity (KYC)"
                />
                <AppTile
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
                      <path d="M6.5 18a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 17.7 10 3.8 3.8 0 0 1 17.5 18h-11Z" />
                    </svg>
                  }
                  name="OneDrive"
                  desc="Archive completed agreements"
                />
                <AppTile
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
                      <path d="m4 7 8-4 8 4-8 4-8-4Z" />
                      <path d="m4 7v10l8 4 8-4V7" />
                      <path d="M12 11v10" />
                    </svg>
                  }
                  name="Box"
                  desc="Archive completed agreements"
                />
              </div>
            </section>

            {/* Workflow Templates */}
            <section className="card mb-6 overflow-hidden animate-fade-up" style={{ animationDelay: "320ms" }}>
              <div className="flex items-center justify-between border-b border-ds-line bg-white px-5 py-3">
                <div>
                  <h2 className="text-sm font-semibold">Workflow Templates</h2>
                  <p className="text-xs text-ds-grayText">
                    Pre-packaged by Docusign
                  </p>
                </div>
                <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs">
                  Create Workflow
                </span>
              </div>
              <div className="space-y-3 p-4">
                <TemplateCard
                  icons={["webform", "decision", "esign"]}
                  title="Consumer Loan with Upstart"
                  desc="Web Form application → AI credit decision → multi-envelope eSign."
                  inUse
                />
                <TemplateCard
                  icons={["idv"]}
                  title="Know your customer"
                  desc="Use Identity Verification to establish your customer's identity."
                />
                <TemplateCard
                  icons={["esign", "cloud"]}
                  title="Mutual NDA with OneDrive"
                  desc="Send an NDA, and save signed copies in OneDrive."
                />
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* --------------------------------------------------------- toasts */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-ds-line bg-white px-4 py-3 shadow-toast animate-slide-in-right"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ds-greenSoft text-ds-green">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <p className="text-[13px] font-medium leading-snug text-ds-ink">
              {t.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- helpers */

function appLabelFor(key: string): string {
  switch (key) {
    case "webform":
      return "Docusign Web Forms";
    case "decision":
      return "Upstart · Credit Decision app";
    case "offer":
      return "Borrower action";
    case "docprep":
      return "Docusign Document Prep";
    case "workspace":
      return "Docusign Workspaces";
    case "esign":
      return "Docusign eSignature";
    default:
      return "Step";
  }
}

function Kebab() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-300">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function Connector({
  reached,
  delay,
  tone = "blue",
}: {
  reached: boolean;
  delay: number;
  tone?: "blue" | "red";
}) {
  const dot = tone === "red" ? "bg-red-400" : "bg-ds-blue";
  return (
    <div className="relative flex h-7 items-center justify-center">
      <div
        className={`h-full w-px origin-top ${reached ? "bg-gray-400" : "bg-gray-300"} animate-grow-x`}
        style={{ animationDelay: `${delay}ms`, transform: "scaleY(1)" }}
      />
      <span
        className={`absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${
          reached ? dot : "bg-gray-300"
        }`}
      />
    </div>
  );
}

function BuilderCard({
  step,
  appLabel,
  expanded,
  onToggle,
  delay,
}: {
  step: Step;
  appLabel: string;
  expanded: boolean;
  onToggle: () => void;
  delay: number;
}) {
  const skipped = step.status === "skipped";
  const statusPill =
    step.status === "complete"
      ? { label: "Done", cls: "bg-ds-greenSoft text-ds-green" }
      : step.status === "running"
        ? { label: "Running", cls: "bg-amber-100 text-amber-700" }
        : step.status === "failed"
          ? { label: "Failed", cls: "bg-red-100 text-red-600" }
          : skipped
            ? { label: "Skipped", cls: "bg-gray-100 text-gray-400" }
            : { label: "Not started", cls: "bg-gray-100 text-gray-400" };

  return (
    <div
      className={`w-full rounded-xl border bg-white px-4 py-3.5 shadow-card transition-shadow hover:shadow-lift animate-fade-up ${
        step.status === "running"
          ? "border-amber-300 animate-pulse-ring"
          : "border-gray-200"
      } ${skipped ? "opacity-45" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-gray-100">
          <StepIcon stepKey={step.key} />
          {step.status === "complete" && (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-ds-green text-white animate-pop-check">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          )}
          {step.status === "running" && (
            <span className="absolute -bottom-1 -right-1 h-4 w-4 animate-pulse rounded-full bg-amber-400 ring-2 ring-white" />
          )}
        </span>
        <Kebab />
      </div>
      <p className="mt-2.5 text-sm font-semibold text-ds-ink">{step.label}</p>
      <p className="mt-0.5 text-xs text-ds-grayText">{appLabel}</p>

      {expanded && (
        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-ds-grayText animate-fade-in">
          <p className="font-medium text-gray-700">
            {step.detail ?? "No details for this step."}
          </p>
          {step.completedAt && (
            <p className="mt-1">
              Completed {new Date(step.completedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className={`ds-pill ${statusPill.cls}`}>{statusPill.label}</span>
        <button
          onClick={onToggle}
          className="rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          {expanded ? "Hide" : "View Details"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------ Upstart offer panel */

function UpstartOffer({
  d,
  busy,
  notice,
  termChoice,
  setTermChoice,
  onAccept,
}: {
  d: Decision;
  busy: boolean;
  notice: string | null;
  termChoice: "primary" | "alt";
  setTermChoice: (t: "primary" | "alt") => void;
  onAccept: () => void;
}) {
  const principal = d.approvedAmount ?? 0;
  const apr = d.apr ?? 0;
  const term = d.termMonths ?? 36;
  const fee = d.originationFee ?? 0;

  const altTerm = term === 60 ? 36 : 60;
  const altApr = +(apr + 0.023).toFixed(4);
  const altPayment = pmt(principal, altApr, altTerm);

  return (
    <section className="card mb-6 overflow-hidden animate-fade-up" style={{ animationDelay: "180ms" }}>
      <div className="p-5 sm:p-6">
        <UpstartLogo />
        <h2 className="mt-3 text-xl font-extrabold tracking-tight text-up-ink">
          Congrats, you qualify!
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Continue with an Upstart-powered loan from Springfield Community Bank.
        </p>

        {/* primary option */}
        <OfferOption
          selected={termChoice === "primary"}
          onSelect={() => setTermChoice("primary")}
          apr={apr}
          years={term / 12}
          monthly={d.monthlyPayment ?? pmt(principal, apr, term)}
          amount={principal}
          fee={fee}
          delay={220}
        />
        {/* alternative term */}
        <OfferOption
          selected={termChoice === "alt"}
          onSelect={() => setTermChoice("alt")}
          apr={altApr}
          years={altTerm / 12}
          monthly={altPayment}
          amount={principal}
          fee={fee}
          delay={280}
        />
        <p className="mt-2 text-[11px] text-gray-400">
          Term selection is illustrative — the POC accepts the approved terms
          returned by the credit model.
        </p>

        {notice && (
          <p className="mt-3 text-sm font-medium text-red-700 animate-fade-in">
            {notice}
          </p>
        )}
        <button className="btn-upstart mt-4 w-full sm:w-auto" onClick={onAccept} disabled={busy}>
          {busy ? (
            <>
              <svg className="animate-spin-slow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.2-8.56" />
              </svg>
              Preparing documents…
            </>
          ) : (
            "Accept offer & prepare documents"
          )}
        </button>
      </div>
    </section>
  );
}

function OfferOption({
  selected,
  onSelect,
  apr,
  years,
  monthly,
  amount,
  fee,
  delay,
}: {
  selected: boolean;
  onSelect: () => void;
  apr: number;
  years: number;
  monthly: number;
  amount: number;
  fee: number;
  delay: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mt-4 block w-full rounded-xl border-2 p-4 text-left transition-all duration-150 animate-fade-up ${
        selected
          ? "border-up-green bg-up-soft/40 shadow-sm"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
              selected ? "border-up-green bg-up-green" : "border-gray-300 bg-white"
            }`}
          >
            {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          <span className="text-lg font-extrabold text-up-ink underline decoration-dotted decoration-gray-300 underline-offset-4">
            {pct(apr)} APR
          </span>
        </span>
        <span className="text-sm font-bold text-up-teal">
          {years} year{years === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <p className="text-sm font-extrabold tabular-nums text-up-ink">
            {money(monthly)}
          </p>
          <p className="text-[11px] text-gray-500">/Month</p>
        </div>
        <div>
          <p className="text-sm font-extrabold tabular-nums text-up-ink">
            {money0(amount)}
          </p>
          <p className="text-[11px] text-gray-500">Loan Amount</p>
        </div>
        <div>
          <p className="text-sm font-extrabold tabular-nums text-up-ink underline decoration-dotted decoration-gray-300 underline-offset-2">
            {money(fee)}
          </p>
          <p className="text-[11px] text-gray-500">Origination fee</p>
        </div>
      </div>
      <div className="mt-3 border-t border-gray-100 pt-2.5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-up-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-up-green" />
          You&apos;ll get {money(amount - fee)}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------ app center / templates */

function AppTile({
  icon,
  name,
  desc,
  installed,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  installed?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 transition-shadow hover:shadow-sm ${
        installed ? "border-up-green/40 bg-up-soft/30" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            installed ? "bg-white ring-1 ring-up-green/30" : "bg-gray-50 ring-1 ring-gray-100"
          }`}
        >
          {icon}
        </span>
        <p className="text-sm font-bold text-ds-ink">{name}</p>
      </div>
      <p className="mt-2 text-xs leading-snug text-ds-grayText">{desc}</p>
      <div className="mt-2.5">
        {installed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-up-green px-2.5 py-1 text-[10px] font-bold text-white">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Installed
          </span>
        ) : (
          <span className="inline-flex cursor-pointer items-center rounded-full border border-gray-300 px-2.5 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-50">
            + Add
          </span>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  icons,
  title,
  desc,
  inUse,
}: {
  icons: string[];
  title: string;
  desc: string;
  inUse?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 transition-shadow hover:shadow-sm ${
        inUse ? "border-ds-purple/40 bg-ds-purple/5" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {icons.map((k, i) => (
            <span
              key={i}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200"
            >
              {k === "decision" ? (
                <UpstartMark size={15} />
              ) : k === "idv" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
                  <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              ) : k === "cloud" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
                  <path d="M6.5 18a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 17.7 10 3.8 3.8 0 0 1 17.5 18h-11Z" />
                </svg>
              ) : (
                <StepIcon stepKey={k} />
              )}
            </span>
          ))}
        </div>
        {inUse && (
          <span className="rounded-full bg-ds-purple px-2.5 py-1 text-[10px] font-bold text-white">
            In use
          </span>
        )}
      </div>
      <p className="mt-2.5 text-sm font-bold text-ds-ink">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-ds-grayText">{desc}</p>
    </div>
  );
}

/* ------------------------------------------------------------- skeleton */

function StatusSkeleton() {
  return (
    <div className="flex min-h-screen bg-ds-bg">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ds-line bg-white md:flex">
        <div className="flex h-14 items-center border-b border-ds-line px-5">
          <div className="skeleton h-6 w-28" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-ds-line bg-white px-6">
          <div className="skeleton h-8 w-full max-w-md rounded-full" />
          <div className="ml-auto skeleton h-8 w-8 rounded-full" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
          <div className="skeleton mb-2 h-3 w-40" />
          <div className="skeleton mb-6 h-7 w-72" />
          <div className="card mb-6 overflow-hidden">
            <div className="skeleton h-11 w-full rounded-none" />
            <div className="flex flex-col items-center gap-4 px-6 py-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-24 w-full max-w-[430px] rounded-xl" />
              ))}
            </div>
          </div>
          <div className="card p-5">
            <div className="skeleton mb-4 h-4 w-48" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- metric */

function Metric({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 transition-shadow hover:shadow-sm">
      <p className="text-xs uppercase tracking-wide text-ds-grayText">{label}</p>
      <p
        className={
          small
            ? "text-xs font-semibold text-gray-700"
            : "text-lg font-bold text-ds-ink"
        }
      >
        {value}
      </p>
    </div>
  );
}
