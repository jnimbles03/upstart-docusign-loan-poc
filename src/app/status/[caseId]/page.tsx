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
  method?: "esign" | "clickwrap";
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
type Tab = "overview" | "tasks" | "documents" | "details" | "settings";

/* ------------------------------------------------------------- constants */

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
function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ logos */

function UpstartMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 13.5 12 5.8l8.5 7.7" fill="none" stroke="#0DBEA8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 18.2h8" fill="none" stroke="#0DBEA8" strokeWidth="2.8" strokeLinecap="round" />
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

/* ------------------------------------------------------------------ page */

export default function BorrowerStatusPage({
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
  const [notice, setNotice] = useState<string | null>(null);
  const [termChoice, setTermChoice] = useState<"primary" | "alt">("primary");
  const [tab, setTab] = useState<Tab>("overview");
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [agreeEnv, setAgreeEnv] = useState<Envelope | null>(null);
  const [agreeing, setAgreeing] = useState(false);
  const prevCompletedRef = useRef<number | null>(null);

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

  // live polling while tasks await signature
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
        newly.forEach((e) => pushToast(`“${e.name}” signed.`));
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

  async function acceptOffer() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/case/${caseId}/accept`, { method: "POST" });
      const data = (await res.json()) as Case & { error?: string };
      if (res.ok) {
        setCase(data);
        prevCompletedRef.current = 0;
        setTab("overview");
        pushToast("Your workspace is ready — documents are waiting for signature.");
      } else {
        setNotice(data.error ?? "Could not accept offer.");
      }
    } catch {
      setNotice("Network error accepting offer.");
    }
    setBusy(false);
  }

  async function agreeTo(env: Envelope) {
    setAgreeing(true);
    try {
      const res = await fetch(
        `/api/case/${caseId}?envelopeId=${env.envelopeId}`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = (await res.json()) as Case;
        setCase(data);
        prevCompletedRef.current = data.envelopes.filter(
          (e) => e.status === "completed",
        ).length;
        pushToast(`“${env.name}” agreed to.`);
      }
    } finally {
      setAgreeing(false);
      setAgreeEnv(null);
    }
  }

  /* ---------------------------------------------------- loading / errors */

  if (loading) return <BorrowerSkeleton />;

  if (notFound || !c) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F4F6F5] animate-fade-in">
        <p className="text-sm font-medium text-red-600">Case not found.</p>
        <button className="btn-ghost" onClick={() => router.push("/portal")}>
          Back to portal
        </button>
      </div>
    );
  }

  const d = c.decision;
  const b = c.borrower;
  const initials = `${b.firstName[0] ?? ""}${b.lastName[0] ?? ""}`;

  /* ----------------------------------------- pre-workspace decision UI */

  if (!c.workspace) {
    return (
      <div className="min-h-screen bg-[#F4F6F5]">
        <header className="bg-bank-green">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
            <span className="flex items-center gap-2.5 text-white">
              <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
                <rect width="32" height="32" rx="8" fill="#fff" fillOpacity="0.15" />
                <path d="M8 22V14l8-6 8 6v8" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 22v-5h6v5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
              </svg>
              <span className="text-[16px] font-extrabold tracking-tight">
                Springfield Community Bank
              </span>
            </span>
            <span className="hidden items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white sm:flex">
              <UpstartMark size={13} />
              Powered by Upstart
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-10">
          {d?.status === "approved" && (
            <>
              <UpstartOffer
                d={d}
                busy={busy}
                notice={notice}
                termChoice={termChoice}
                setTermChoice={setTermChoice}
                onAccept={acceptOffer}
              />
              {/* what happens next */}
              <div className="mt-6 grid grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: "320ms" }}>
                {[
                  { n: "1", t: "Review your offer", s: "You're here" },
                  { n: "2", t: "Sign in Docusign", s: "Secure workspace" },
                  { n: "3", t: "Get funded", s: "After all signatures" },
                ].map((s, i) => (
                  <div key={s.n} className={`rounded-xl border p-3.5 text-center ${i === 0 ? "border-up-green/50 bg-up-soft/50" : "border-gray-200 bg-white"}`}>
                    <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-up-green text-white" : "bg-gray-100 text-gray-400"}`}>
                      {s.n}
                    </span>
                    <p className="mt-1.5 text-xs font-bold text-gray-800">{s.t}</p>
                    <p className="text-[10px] text-gray-400">{s.s}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {d?.status === "declined" && (
            <section className="card p-6 animate-fade-up">
              <h1 className="text-xl font-bold text-gray-900">
                We couldn&apos;t approve this request
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                After review, we&apos;re unable to offer credit at this time.
              </p>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-700">
                {d.reasons?.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              {d.adverseActionNotice && (
                <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    View Adverse Action Notice
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">
                    {d.adverseActionNotice}
                  </pre>
                </details>
              )}
              <button className="btn-ghost mt-6" onClick={() => router.push("/portal")}>
                Back to portal
              </button>
            </section>
          )}

          {d?.status === "manual_review" && (
            <section className="card p-6 animate-fade-up">
              <span className="ds-pill bg-amber-100 text-amber-700">In review</span>
              <h1 className="mt-3 text-xl font-bold text-gray-900">
                Your application is with our lending team
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                {d.reasons?.[0] ??
                  "Your application needs a quick manual review. We'll follow up by email within one business day."}
              </p>
              <button className="btn-ghost mt-6" onClick={() => router.push("/portal")}>
                Back to portal
              </button>
            </section>
          )}

          <p className="mt-10 text-center text-xs text-gray-400">
            <button
              className="underline hover:text-gray-600"
              onClick={() => router.push(`/status/${c.caseId}/ops`)}
            >
              Behind the scenes: see the workflow that processed this application →
            </button>
          </p>
        </main>
      </div>
    );
  }

  /* --------------------------------------------------- workspace view */

  const ws = c.workspace;
  const completedEnvs = c.envelopes.filter((e) => e.status === "completed").length;
  const totalEnvs = c.envelopes.length;
  const openTasks = totalEnvs - completedEnvs;
  const allDone = totalEnvs > 0 && completedEnvs === totalEnvs;
  const clickwrapPending = c.envelopes.some(
    (e) => e.method === "clickwrap" && e.status === "sent",
  );
  const progress = totalEnvs === 0 ? 40 : Math.round(40 + 60 * (completedEnvs / totalEnvs));

  // activity feed, newest first
  const activity: { title: string; desc: string; time: string; ts: string }[] = [];
  for (const e of c.envelopes) {
    if (e.status === "completed" && e.completedAt) {
      activity.push({
        title: `${e.name} e-signed`,
        desc: `Signed by ${b.firstName} ${b.lastName}.`,
        time: timeOf(e.completedAt),
        ts: e.completedAt,
      });
    }
  }
  if (c.envelopes[0]) {
    activity.push({
      title: "Tasks sent",
      desc: `${totalEnvs} signature task${totalEnvs === 1 ? "" : "s"} sent to ${b.firstName} ${b.lastName}.`,
      time: timeOf(c.envelopes[0].sentAt),
      ts: c.envelopes[0].sentAt,
    });
  }
  if (ws.documents[0]) {
    activity.push({
      title: "Documents generated",
      desc: `${ws.documents.length} documents prepared via Document Prep.`,
      time: timeOf(ws.documents[0].generatedAt),
      ts: ws.documents[0].generatedAt,
    });
  }
  activity.push({
    title: "Workspace created",
    desc: "Created from the Consumer Loan with Upstart template.",
    time: timeOf(ws.createdAt),
    ts: ws.createdAt,
  });
  activity.sort((a, b2) => b2.ts.localeCompare(a.ts));

  const TABS: { key: Tab; label: string }[] = [
    { key: "tasks", label: "Tasks" },
    { key: "overview", label: "Overview" },
    { key: "documents", label: "Documents" },
    { key: "details", label: "Details" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* ------------------------------------------------------ top bar */}
      <header className="flex h-14 items-center gap-4 border-b border-ds-line bg-white px-4 sm:px-6">
        <span className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden>
            <rect width="28" height="28" rx="6" fill="#DC2C34" />
            <path d="M7 18.5c3.2-.8 4.8-5 5.6-9.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M10.5 17.5c3.8 1 7.5-.8 10.5-5.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          <span className="text-[16px] font-bold tracking-tight text-ds-ink">
            Docusign
          </span>
          <span className="ml-1 hidden border-l border-ds-line pl-3 text-sm font-medium text-ds-grayText sm:block">
            Workspaces
          </span>
        </span>
        <div className="relative mx-auto hidden w-full max-w-sm md:block">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="w-full rounded-full border border-ds-line bg-ds-bg py-1.5 pl-9 pr-3 text-sm focus:border-ds-purple focus:bg-white focus:outline-none"
            placeholder="Search workspaces"
          />
        </div>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <span className="hidden cursor-pointer items-center gap-1.5 rounded-full border border-ds-purple px-3.5 py-1.5 text-xs font-bold text-ds-purple sm:flex">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4L12 2Z" />
            </svg>
            Ask the AI assistant
          </span>
          <button className="relative text-ds-grayText" aria-label="Notifications">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {openTasks > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ds-purple" />
            )}
          </button>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ds-purple text-xs font-bold text-white">
            {initials}
          </span>
        </div>
      </header>

      {/* -------------------------------------------------- bank band */}
      <div className="bg-ds-ink text-white">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-2.5 px-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </svg>
          <span className="text-sm font-bold tracking-wide">
            Springfield Community Bank
          </span>
          <span className="text-sm text-white/50">Consumer lending</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6">
        {/* --------------------------------------------- workspace header */}
        <div className="flex flex-wrap items-center gap-3 pt-5">
          <button
            onClick={() => router.push("/portal")}
            className="text-ds-grayText transition-colors hover:text-ds-ink"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-ds-ink">
            {b.loanType === "auto" ? "Auto" : "Personal"} Loan — {b.firstName}{" "}
            {b.lastName}
          </h1>
          <span
            className={`ds-pill ${
              allDone ? "bg-gray-100 text-gray-500" : "bg-ds-greenSoft text-ds-green"
            }`}
          >
            {allDone ? "Closed" : "Active"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex -space-x-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ds-purple text-[10px] font-bold text-white ring-2 ring-white">
                {initials}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ds-ink text-[10px] font-bold text-white ring-2 ring-white">
                LO
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-500 ring-2 ring-white">
                +1
              </span>
            </div>
            <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs">
              Add
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------ tabs */}
        <div className="mt-4 flex gap-6 border-b border-ds-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative pb-2.5 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "text-ds-purple"
                  : "text-ds-grayText hover:text-ds-ink"
              }`}
            >
              {t.label}
              {t.key === "tasks" && openTasks > 0 && (
                <span className="ml-1.5 rounded-full bg-ds-purple px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {openTasks}
                </span>
              )}
              {tab === t.key && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ds-purple" />
              )}
            </button>
          ))}
        </div>

        {/* ---------------------------------------------------- content */}
        <div className="grid gap-6 py-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {/* ---------------------------------------------- overview */}
            {tab === "overview" && (
              <div className="space-y-6 animate-fade-in">
                {/* welcome banner */}
                <div className="rounded-2xl bg-[#F1EDFB] p-6">
                  <h2 className="text-lg font-extrabold tracking-tight text-ds-ink sm:text-xl">
                    Welcome back, {b.firstName} — here&apos;s where your loan
                    stands.
                  </h2>
                  <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ds-grayText">
                    Springfield Community Bank prepared your loan package.{" "}
                    {openTasks > 0
                      ? `${completedEnvs} of ${totalEnvs} documents signed — ${openTasks} still waiting on you.`
                      : "Everything is signed — your loan is complete."}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <p className="shrink-0 text-xs font-semibold text-ds-grayText">
                      Overall progress
                    </p>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-ds-purple transition-all duration-700"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="shrink-0 text-sm font-extrabold text-ds-purple">
                      {progress}% complete
                    </p>
                  </div>
                  {openTasks > 0 && (
                    <button
                      className="btn mt-4 bg-ds-purple px-5 py-2 text-xs text-white shadow-sm hover:brightness-110"
                      onClick={() => setTab("tasks")}
                    >
                      Go to your tasks ({openTasks} waiting)
                    </button>
                  )}
                </div>

                {/* stat cards */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat label="Open tasks" value={String(openTasks)} sub={openTasks === 0 ? "All caught up" : "Waiting on you"} accent={openTasks > 0 ? "text-ds-ink" : "text-ds-green"} />
                  <Stat label="Loan" value={money0(d?.approvedAmount)} sub={b.loanType === "auto" ? "Auto · secured" : "Personal · unsecured"} accent="text-ds-purple" />
                  <Stat label="Docs signed" value={`${completedEnvs}/${totalEnvs}`} sub="Offer accepted" />
                  <Stat label="Next step" value={allDone ? "Funding" : "Sign"} sub={allDone ? "Loan complete" : `${openTasks} to go`} accent={allDone ? "text-ds-green" : "text-amber-500"} />
                </div>

                {/* recent activity list */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-ds-grayText">
                    Recent signatures &amp; uploads
                  </h3>
                  <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                    {activity.slice(0, 4).map((a, i) => (
                      <li key={i} className="flex items-center gap-3 px-4 py-3.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ds-greenSoft">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1B7F3B" strokeWidth="3">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ds-ink">
                            {a.title}
                          </p>
                          <p className="truncate text-xs text-ds-grayText">{a.desc}</p>
                        </div>
                        <span className="shrink-0 text-xs text-ds-grayText">{a.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* ------------------------------------------------- tasks */}
            {tab === "tasks" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-end">
                  <span className="pointer-events-none rounded-lg border border-dashed border-ds-purple px-3.5 py-2 text-xs font-bold text-ds-purple">
                    + New task
                  </span>
                </div>

                <TaskGroup title="Disclosures">
                  {c.envelopes
                    .filter((e) => e.method === "clickwrap")
                    .map((env) => {
                      const done = env.status === "completed";
                      return (
                        <TaskRow
                          key={env.envelopeId}
                          icon="click"
                          done={done}
                          badge={done ? undefined : "Click to agree · first"}
                          title={done ? env.name : `Review and agree to ${env.name.charAt(0).toLowerCase()}${env.name.slice(1)}`}
                          sub={done ? `Agreed ${env.completedAt ? timeOf(env.completedAt) : ""}` : "Acknowledgement required before signing"}
                          action={
                            done ? (
                              <span className="btn-ghost pointer-events-none shrink-0 px-4 py-1.5 text-xs">
                                View
                              </span>
                            ) : (
                              <button
                                className="btn shrink-0 border border-ds-purple px-4 py-1.5 text-xs text-ds-purple hover:bg-ds-purple hover:text-white"
                                onClick={() => setAgreeEnv(env)}
                              >
                                Review and agree
                              </button>
                            )
                          }
                        />
                      );
                    })}
                </TaskGroup>

                <TaskGroup title="Loan documentation">
                  {c.envelopes
                    .filter((e) => e.method !== "clickwrap")
                    .map((env) => {
                      const done = env.status === "completed";
                      const locked = !done && clickwrapPending;
                      return (
                        <TaskRow
                          key={env.envelopeId}
                          icon="pen"
                          done={done}
                          title={done ? env.name : `Sign ${env.name.charAt(0).toLowerCase()}${env.name.slice(1)}`}
                          sub={
                            done
                              ? `Signed ${env.completedAt ? timeOf(env.completedAt) : ""}`
                              : locked
                                ? "Accept the E-Consent Agreement first"
                                : "Signature required"
                          }
                          action={
                            done ? (
                              <span className="btn-ghost pointer-events-none shrink-0 px-4 py-1.5 text-xs">
                                View
                              </span>
                            ) : locked ? (
                              <span className="btn shrink-0 cursor-not-allowed bg-gray-100 px-4 py-1.5 text-xs text-gray-400">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="4" y="10" width="16" height="10" rx="2" />
                                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                                </svg>
                                Sign
                              </span>
                            ) : (
                              <button
                                className="btn shrink-0 bg-ds-red px-5 py-1.5 text-xs text-white shadow-sm hover:bg-ds-redDark"
                                onClick={() => router.push(`/sign/${c.caseId}/${env.envelopeId}`)}
                              >
                                Sign
                              </button>
                            )
                          }
                        />
                      );
                    })}
                </TaskGroup>

                {allDone && (
                  <div className="flex items-center gap-3 rounded-xl border border-ds-green/30 bg-ds-greenSoft px-4 py-3.5 animate-fade-in">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ds-green text-white animate-pop-check">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                    <p className="text-sm font-semibold text-ds-green">
                      All tasks complete — your loan is closed. Funding would
                      follow (mocked).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* --------------------------------------------- documents */}
            {tab === "documents" && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white animate-fade-in">
                <ul className="divide-y divide-gray-100">
                  {ws.documents.map((doc) => (
                    <li key={doc.documentId}>
                      <button
                        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
                        onClick={() => setOpenDoc(openDoc === doc.documentId ? null : doc.documentId)}
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
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={`transition-transform duration-200 ${openDoc === doc.documentId ? "rotate-180" : ""}`}>
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                      </button>
                      {openDoc === doc.documentId && (
                        <pre className="whitespace-pre-wrap border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-700 animate-fade-in">
                          {doc.preview}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ------------------------------------------------ details */}
            {tab === "details" && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 animate-fade-in">
                <dl className="divide-y divide-gray-100">
                  {(
                    [
                      ["Borrower", `${b.firstName} ${b.lastName}`],
                      ["Email", b.email],
                      ["Address", `${b.street}, ${b.city}, ${b.state} ${b.zip}`],
                      ["Loan type", b.loanType === "auto" ? "Auto (secured)" : "Personal (unsecured)"],
                      ["Approved amount", money(d?.approvedAmount)],
                      ["APR", pct(d?.apr)],
                      ["Term", `${d?.termMonths} months`],
                      ["Monthly payment", money(d?.monthlyPayment)],
                      ["Workspace", ws.workspaceId],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-[13px] font-medium text-ds-grayText">{k}</dt>
                      <dd className="text-right text-sm font-semibold text-ds-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* ----------------------------------------------- settings */}
            {tab === "settings" && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center animate-fade-in">
                <p className="text-sm text-ds-grayText">
                  Workspace settings are managed by Springfield Community Bank.
                </p>
                <p className="mt-1 text-xs text-gray-400">POC placeholder</p>
              </div>
            )}
          </div>

          {/* ---------------------------------------------- activity rail */}
          <aside className="h-fit rounded-xl border border-gray-200 bg-white animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-bold text-ds-purple">Activity</h3>
              <span className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-ds-grayText">
                <span className="h-1.5 w-1.5 rounded-full bg-ds-purple" />
                Ask the AI assistant
              </span>
            </div>
            <ul className="divide-y divide-gray-100">
              {activity.slice(0, 6).map((a, i) => (
                <li key={i} className="flex gap-3 px-4 py-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F1EDFB]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#6E45E2">
                      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-bold text-ds-ink">
                        {a.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-ds-grayText">{a.time}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-ds-grayText">
                      {a.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <p className="pb-10 text-center text-xs text-gray-400">
          <button
            className="underline hover:text-gray-600"
            onClick={() => router.push(`/status/${c.caseId}/ops`)}
          >
            Behind the scenes: see the workflow powering this workspace →
          </button>
        </p>
      </div>

      {/* ------------------------------------------ click-to-agree modal */}
      {agreeEnv && (
        <ClickAgreeModal
          env={agreeEnv}
          busy={agreeing}
          onAgree={() => agreeTo(agreeEnv)}
          onClose={() => setAgreeEnv(null)}
        />
      )}

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

/* --------------------------------------------------------------- stat */

function Stat({
  label,
  value,
  sub,
  accent = "text-ds-ink",
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ds-grayText">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-extrabold tabular-nums tracking-tight ${accent}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-ds-grayText">{sub}</p>
    </div>
  );
}

/* ------------------------------------------------- task group / rows */

function TaskGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3.5">
        <h3 className="text-sm font-bold text-ds-ink">{title}</h3>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-gray-400">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      <ul className="divide-y divide-gray-100 border-t border-gray-100">
        {children}
      </ul>
    </div>
  );
}

function TaskRow({
  icon,
  done,
  badge,
  title,
  sub,
  action,
}: {
  icon: "pen" | "click";
  done: boolean;
  badge?: string;
  title: string;
  sub: string;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          done ? "bg-ds-greenSoft" : "bg-gray-50 ring-1 ring-gray-100"
        }`}
      >
        {done ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B7F3B" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : icon === "pen" ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
            <path d="m14.5 4.5 5 5L8 21H3v-5L14.5 4.5Z" />
            <path d="m12.5 6.5 5 5" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
            <path d="M9 11.5V5.5a1.5 1.5 0 0 1 3 0v5l4.5 1a2 2 0 0 1 1.5 2.3l-1 5A3 3 0 0 1 14 21h-3.2a3 3 0 0 1-2.3-1.1L5 16l1.6-1.9a1.5 1.5 0 0 1 2.4.2v-2.8Z" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-ds-ink">
          <span className="truncate">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-ds-purple/10 px-2 py-0.5 text-[10px] font-bold text-ds-purple">
              {badge}
            </span>
          )}
        </p>
        <p className="text-xs text-ds-grayText">{sub}</p>
      </div>
      <span
        className={`hidden shrink-0 text-xs font-medium sm:block ${
          done ? "text-ds-green" : "text-ds-grayText"
        }`}
      >
        {done ? "Completed" : "Waiting"}
      </span>
      {action}
    </li>
  );
}

/* ------------------------------------------- click-to-agree (Click) */

const CLICK_TERMS: { heading?: string; body: string }[] = [
  {
    body: "Please read this Electronic Disclosures and E-Consent Agreement (“Agreement”) carefully before proceeding. It governs the electronic delivery of disclosures, notices, and records related to your loan from Springfield Community Bank (“we”, “us”, or “our”).",
  },
  {
    heading: "Consent to Electronic Records",
    body: "By agreeing, you consent to receive all communications, agreements, disclosures, and records relating to your loan in electronic form, including the loan agreement, Truth-in-Lending disclosures, and any adverse action notices. You agree that electronic delivery satisfies any legal requirement that such communications be in writing.",
  },
  {
    heading: "Consent to Electronic Signatures",
    body: "You agree that your electronic signature — whether applied by clicking an acceptance button or by an adopted signature — is the legal equivalent of your handwritten signature and is binding on all documents executed through this service.",
  },
  {
    heading: "Hardware and Software Requirements",
    body: "To access and retain electronic records you need a device with internet access, a current web browser, and a valid email address. You may request paper copies of any record at no charge by contacting Springfield Community Bank.",
  },
  {
    heading: "Withdrawing Consent",
    body: "You may withdraw your consent to electronic records at any time by contacting us. Withdrawing consent will not affect the legal validity of any documents signed or agreed to before the withdrawal.",
  },
  {
    heading: "Links to Other Web Sites",
    body: "The service may contain links to third-party web sites or services that are not owned or controlled by Springfield Community Bank. We have no control over, and assume no responsibility for, the content or practices of any third-party sites or services.",
  },
];

function ClickAgreeModal({
  env,
  busy,
  onAgree,
  onClose,
}: {
  env: Envelope;
  busy: boolean;
  onAgree: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 animate-fade-in"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-md bg-white shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* title */}
        <div className="border-b border-ds-line px-7 py-4">
          <h2 className="text-lg font-bold text-ds-ink">{env.name}</h2>
        </div>

        {/* scrollable terms */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          <p className="text-sm font-bold tracking-wide text-[#DC2C34]">
            DEMONSTRATION PURPOSES ONLY
          </p>
          <p className="mt-4 text-xs text-gray-500">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          {CLICK_TERMS.map((s, i) => (
            <div key={i} className="mt-4">
              {s.heading && (
                <p className="text-sm font-bold text-gray-800 underline underline-offset-2">
                  {s.heading}
                </p>
              )}
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-700">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        {/* agree footer */}
        <div className="border-t border-ds-line bg-white px-7 py-4 shadow-[0_-4px_16px_rgba(19,3,46,0.06)]">
          <p className="text-[13px] leading-snug text-gray-800">
            <span className="font-bold">
              By clicking the button below, I agree to the above.
            </span>{" "}
            Additionally, I have read and understand the{" "}
            <span className="cursor-pointer font-semibold text-ds-blue underline">
              Electronic Record and Signature Disclosure
            </span>
            .
          </p>
          <button
            onClick={onAgree}
            disabled={busy}
            className="btn mt-3 bg-ds-blue px-7 py-2 text-xs font-bold tracking-wide text-white shadow-sm hover:brightness-110"
          >
            {busy ? "RECORDING…" : "AGREE"}
          </button>
        </div>

        {/* powered-by footer */}
        <div className="border-t border-ds-line px-7 py-3">
          <p className="text-xs text-gray-500">
            Powered by <span className="font-bold text-gray-700">DocuSign</span>
          </p>
        </div>
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
    <section className="card overflow-hidden animate-fade-up">
      <div className="p-5 sm:p-7">
        <UpstartLogo />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-up-ink">
          Congrats, you qualify!
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Continue with an Upstart-powered loan from Springfield Community Bank.
        </p>

        <OfferOption
          selected={termChoice === "primary"}
          onSelect={() => setTermChoice("primary")}
          apr={apr}
          years={term / 12}
          monthly={d.monthlyPayment ?? pmt(principal, apr, term)}
          amount={principal}
          fee={fee}
          delay={160}
        />
        <OfferOption
          selected={termChoice === "alt"}
          onSelect={() => setTermChoice("alt")}
          apr={altApr}
          years={altTerm / 12}
          monthly={altPayment}
          amount={principal}
          fee={fee}
          delay={240}
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
        <button className="btn-upstart mt-5 w-full sm:w-auto" onClick={onAccept} disabled={busy}>
          {busy ? (
            <>
              <svg className="animate-spin-slow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.2-8.56" />
              </svg>
              Opening your Docusign workspace…
            </>
          ) : (
            "Accept offer & continue to signing"
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

/* ------------------------------------------------------------- skeleton */

function BorrowerSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="flex h-14 items-center gap-4 border-b border-ds-line bg-white px-6">
        <div className="skeleton h-6 w-36" />
        <div className="skeleton mx-auto h-8 w-full max-w-sm rounded-full" />
        <div className="skeleton ml-auto h-8 w-8 rounded-full" />
      </header>
      <div className="skeleton h-11 w-full rounded-none" />
      <div className="mx-auto max-w-6xl px-6">
        <div className="skeleton mt-5 h-7 w-80" />
        <div className="skeleton mt-4 h-9 w-full max-w-md" />
        <div className="grid gap-6 py-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="skeleton h-44 rounded-2xl" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
            <div className="skeleton h-40 rounded-xl" />
          </div>
          <div className="skeleton h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
