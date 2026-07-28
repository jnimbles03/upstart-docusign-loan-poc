"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LoanType } from "@/lib/types";

/* ------------------------------------------------------------------ types */

type LoanCaseResponse = {
  caseId: string;
  decision: {
    status: "approved" | "declined" | "manual_review";
  } | null;
};

type FormState = {
  loanType: LoanType;
  requestedAmount: number;
  annualIncome: number | "";
  firstName: string;
  lastName: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleMileage: string;
  vin: string;
};

/* ----------------------------------------------------------------- helpers */

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function estimateTerm(amount: number) {
  return amount > 25000 ? 60 : amount > 10000 ? 48 : 36;
}

function estimatePayment(amount: number) {
  const apr = 0.1199; // mid-band estimate for preview only
  const months = estimateTerm(amount);
  const r = apr / 12;
  return (amount * r) / (1 - Math.pow(1 + r, -months));
}

const CHECK_STAGES = [
  "Application sent via secure API",
  "Credit decisioning — 2,500+ variables",
  "Returning risk-based pricing & terms",
];

/* ------------------------------------------------- Upstart brand (POC) */

function UpstartMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 13.5 12 5.8l8.5 7.7" fill="none" stroke="#0DBEA8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 18.2h8" fill="none" stroke="#0DBEA8" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function PoweredByUpstart() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        Powered by
      </span>
      <span className="inline-flex items-center gap-1.5">
        <UpstartMark size={18} />
        <span className="text-[15px] font-bold tracking-tight text-up-ink">
          Upstart
        </span>
        <span className="text-[15px] font-medium tracking-tight text-gray-500">
          Credit Decision
        </span>
      </span>
    </span>
  );
}

/* ------------------------------------------- demo personas (right-click) */

type Persona = {
  id: string;
  label: string;
  hint: string;
  data: FormState;
};

const PERSONAS: Persona[] = [
  {
    id: "jordan",
    label: "Jordan Lee",
    hint: "Personal · likely approved",
    data: {
      loanType: "personal",
      requestedAmount: 12000,
      annualIncome: 95000,
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan.lee@example.com",
      street: "123 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62701",
      vehicleYear: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleMileage: "",
      vin: "",
    },
  },
  {
    id: "alex",
    label: "Alex Morgan",
    hint: "Auto · likely approved",
    data: {
      loanType: "auto",
      requestedAmount: 18000,
      annualIncome: 88000,
      firstName: "Alex",
      lastName: "Morgan",
      email: "alex.morgan@example.com",
      street: "4820 Walnut Ave",
      city: "Springfield",
      state: "IL",
      zip: "62704",
      vehicleYear: "2021",
      vehicleMake: "Honda",
      vehicleModel: "Civic",
      vehicleMileage: "42500",
      vin: "19XFC2F59ME012345",
    },
  },
  {
    id: "sam",
    label: "Sam Roe",
    hint: "Personal · likely declined",
    data: {
      loanType: "personal",
      requestedAmount: 30000,
      annualIncome: 18000,
      firstName: "Sam",
      lastName: "Roe",
      email: "sam.roe@example.com",
      street: "7 Oak Hollow Rd",
      city: "Springfield",
      state: "IL",
      zip: "62702",
      vehicleYear: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleMileage: "",
      vin: "",
    },
  },
];

/* -------------------------------------------------------------------- page */

export default function ApplyWizard({ initialType }: { initialType: LoanType }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    loanType: initialType,
    requestedAmount: 10000,
    annualIncome: "",
    firstName: "",
    lastName: "",
    email: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleMileage: "",
    vin: "",
  });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState(0);
  const [fillMenu, setFillMenu] = useState<{ x: number; y: number } | null>(null);
  const resultRef = useRef<{ caseId: string } | { error: string } | null>(null);
  const fillMenuRef = useRef<HTMLDivElement>(null);

  /* --------------------------------------------- demo autofill (POC) */

  function openFillMenu(e: React.MouseEvent) {
    e.preventDefault();
    setFillMenu({ x: e.clientX, y: e.clientY });
  }

  function fillPersona(p: Persona) {
    setForm(p.data);
    setErrors({});
    setSubmitError(null);
    setFillMenu(null);
  }

  function clearForm() {
    setForm({
      loanType: initialType,
      requestedAmount: 10000,
      annualIncome: "",
      firstName: "",
      lastName: "",
      email: "",
      street: "",
      city: "",
      state: "",
      zip: "",
      vehicleYear: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleMileage: "",
      vin: "",
    });
    setErrors({});
    setFillMenu(null);
  }

  // close the fill menu on click-away / Escape
  useEffect(() => {
    if (!fillMenu) return;
    function onDown(e: MouseEvent) {
      if (fillMenuRef.current && !fillMenuRef.current.contains(e.target as Node)) {
        setFillMenu(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFillMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [fillMenu]);

  const steps = useMemo(
    () =>
      form.loanType === "auto"
        ? ["Loan details", "About you", "Vehicle", "Review"]
        : ["Loan details", "About you", "Review"],
    [form.loanType],
  );
  const lastStep = steps.length - 1;
  const pctDone = Math.max(4, Math.round((step / steps.length) * 100));

  useEffect(() => {
    setStep((s) => Math.min(s, steps.length - 1));
  }, [steps.length]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  /* ---------------------------------------------------------- validation */

  function validateStep(s: number): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    const label = steps[s];

    if (label === "Loan details") {
      if (form.requestedAmount < 1000 || form.requestedAmount > 50000)
        e.requestedAmount = "Choose an amount between $1,000 and $50,000.";
      if (form.annualIncome === "" || form.annualIncome <= 0)
        e.annualIncome = "Enter your annual income.";
    }
    if (label === "About you") {
      if (!form.firstName.trim()) e.firstName = "Required.";
      if (!form.lastName.trim()) e.lastName = "Required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        e.email = "Enter a valid email address.";
      if (!form.street.trim()) e.street = "Required.";
      if (!form.city.trim()) e.city = "Required.";
      if (!/^[A-Za-z]{2}$/.test(form.state)) e.state = "2-letter code.";
      if (!/^\d{5}(-\d{4})?$/.test(form.zip)) e.zip = "Enter a valid ZIP.";
    }
    if (label === "Vehicle") {
      const yr = Number(form.vehicleYear);
      if (!yr || yr < 1980 || yr > 2027) e.vehicleYear = "Enter a year 1980–2027.";
      if (!form.vehicleMake.trim()) e.vehicleMake = "Required.";
      if (!form.vehicleModel.trim()) e.vehicleModel = "Required.";
      if (form.vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(form.vin))
        e.vin = "VIN must be 17 characters.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, lastStep));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function back() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------------------------------------------------- submission */

  async function submit() {
    if (!validateStep(step)) return;
    setSubmitError(null);
    setChecking(true);
    setStage(0);
    resultRef.current = null;

    const body: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      street: form.street,
      city: form.city,
      state: form.state,
      zip: form.zip,
      annualIncome: Number(form.annualIncome),
      loanType: form.loanType,
      requestedAmount: form.requestedAmount,
    };
    if (form.loanType === "auto") {
      body.vehicleYear = Number(form.vehicleYear);
      body.vehicleMake = form.vehicleMake;
      body.vehicleModel = form.vehicleModel;
      body.vehicleMileage = Number(form.vehicleMileage || 0);
      if (form.vin) body.vin = form.vin;
    }

    // Advance the checklist on a cadence that roughly matches mock latency.
    const STAGE_MS = 2800;
    const timers = CHECK_STAGES.map((_, i) =>
      setTimeout(() => setStage(i + 1), STAGE_MS * (i + 1)),
    );

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as LoanCaseResponse & { error?: string };
      resultRef.current = res.ok
        ? { caseId: data.caseId }
        : { error: data.error ?? "Submission failed." };
    } catch {
      resultRef.current = { error: "Network error submitting application." };
    }

    // Let the checklist finish before revealing the result.
    const minWait = STAGE_MS * CHECK_STAGES.length + 1200;
    setTimeout(() => {
      timers.forEach(clearTimeout);
      const r = resultRef.current;
      if (r && "caseId" in r) {
        router.push(`/status/${r.caseId}`);
      } else {
        setChecking(false);
        setSubmitError(r && "error" in r ? r.error : "Submission failed.");
      }
    }, minWait);
  }

  /* -------------------------------------------------------------- render */

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* --------------------------------------------- bank-branded header */}
      <header className="bg-bank-green">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <span className="flex items-center gap-2.5 text-white">
            <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
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
            <span className="text-[16px] font-extrabold tracking-tight">
              Springfield Community Bank
            </span>
          </span>
          <div className="flex items-center gap-2.5">
            <span className="hidden rounded-full bg-white px-4 py-1.5 text-xs font-bold tracking-wide text-bank-green sm:block">
              HELP
            </span>
            <button
              onClick={() => router.push("/")}
              className="rounded-full bg-white px-4 py-1.5 text-xs font-bold tracking-wide text-bank-green transition hover:bg-bank-soft"
            >
              EXIT
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------- webform body */}
      <main
        className="mx-auto w-full max-w-xl flex-1 px-6 py-10"
        onContextMenu={openFillMenu}
      >
        {/* percent progress */}
        <p className="text-sm font-medium text-gray-700">{pctDone}% completed</p>
        <div className="mt-2 h-[5px] w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-ds-blue transition-all duration-500 ease-out"
            style={{ width: `${pctDone}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-[11px] text-gray-300">
          Demo tip: right-click the form to autofill an applicant
        </p>

        {/* section */}
        <div key={step} className="mt-8 animate-fade-up">
          {steps[step] === "Loan details" && (
            <StepLoan form={form} set={set} errors={errors} />
          )}
          {steps[step] === "About you" && (
            <StepAbout form={form} set={set} errors={errors} />
          )}
          {steps[step] === "Vehicle" && (
            <StepVehicle form={form} set={set} errors={errors} />
          )}
          {steps[step] === "Review" && <StepReview form={form} />}
        </div>

        {submitError && (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 animate-fade-in">
            {submitError}
          </p>
        )}

        {/* nav — DocuSign webform style: Back / Next bottom right */}
        <div className="mt-10 flex items-center justify-end gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="btn border border-gray-300 bg-white px-7 py-2.5 text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          )}
          {step < lastStep ? (
            <button
              type="button"
              onClick={next}
              className="btn bg-ds-blue px-8 py-2.5 text-white shadow-sm hover:brightness-110"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              className="btn bg-ds-blue px-8 py-2.5 text-white shadow-sm hover:brightness-110"
            >
              Submit
            </button>
          )}
        </div>
      </main>

      {/* --------------------------------------------------- webform footer */}
      <footer className="pb-8 pt-4 text-center text-sm text-gray-500">
        Powered by <span className="font-bold text-gray-700">DocuSign</span>
        <span className="mx-2 text-gray-300">|</span>
        <a href="#" onClick={(e) => e.preventDefault()} className="underline hover:text-gray-700">
          Privacy and Terms
        </a>
      </footer>

      {/* ------------------------------------------- autofill context menu */}
      {fillMenu && (
        <div
          ref={fillMenuRef}
          className="fixed z-40 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-lift animate-scale-in"
          style={{
            left: Math.min(fillMenu.x, window.innerWidth - 270),
            top: Math.min(fillMenu.y, window.innerHeight - 240),
          }}
        >
          <p className="px-4 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Fill demo applicant
          </p>
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => fillPersona(p)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-gray-800">{p.label}</span>
              <span className="text-[11px] text-gray-400">{p.hint}</span>
            </button>
          ))}
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={clearForm}
            className="flex w-full px-4 py-2.5 text-left text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
          >
            Clear form
          </button>
        </div>
      )}

      {/* -------------------------------------------- rate-check overlay */}
      {checking && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-white/95 p-4 backdrop-blur-sm animate-fade-in">
          <div className="grid w-full max-w-3xl items-center gap-8 md:grid-cols-[1fr_1.15fr]">
            {/* left: process stages */}
            <div className="text-center md:text-left">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-up-soft md:mx-0">
                <svg
                  className="animate-spin-slow text-up-green"
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.2-8.56" />
                </svg>
              </div>
              <PoweredByUpstart />
              <h2 className="mt-3 text-xl font-bold text-up-ink">
                Decisioning your application…
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Instant AI underwriting — usually just a few seconds.
              </p>
              <ul className="mx-auto mt-6 max-w-xs space-y-3 text-left md:mx-0">
                {CHECK_STAGES.map((label, i) => {
                  const done = stage > i;
                  const active = stage === i;
                  return (
                    <li key={label} className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                          done ? "bg-up-green" : active ? "bg-up-soft" : "bg-gray-100"
                        }`}
                      >
                        {done ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="animate-pop-check">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        ) : active ? (
                          <span className="h-2 w-2 animate-pulse rounded-full bg-up-green" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-gray-300" />
                        )}
                      </span>
                      <span
                        className={`font-medium transition-colors duration-300 ${
                          done ? "text-up-ink" : active ? "text-up-dark" : "text-gray-400"
                        }`}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* right: the underwriting brain */}
            <AiBrainPanel form={form} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------- AI underwriting brain */

type Signal = {
  label: string;
  detail: string;
  w: number; // 0-1 bar strength
  tone: "strong" | "good" | "fair";
};

const TONE_CLS: Record<Signal["tone"], { chip: string; bar: string }> = {
  strong: { chip: "bg-emerald-400/15 text-emerald-300", bar: "bg-emerald-400" },
  good: { chip: "bg-teal-400/15 text-teal-300", bar: "bg-teal-400" },
  fair: { chip: "bg-amber-400/15 text-amber-300", bar: "bg-amber-400" },
};

function AiBrainPanel({ form }: { form: FormState }) {
  const income = Number(form.annualIncome) || 0;
  const ratio = form.requestedAmount / Math.max(income, 1);

  // mirrors the mock model's risk heuristic so the readout feels connected
  const targetRisk = Math.max(
    4,
    Math.min(
      96,
      Math.round(
        30 +
          ratio * 60 -
          (form.loanType === "auto" ? 6 : 0) -
          (income > 80000 ? 10 : 0) +
          (income < 25000 ? 12 : 0),
      ),
    ),
  );

  const signals: Signal[] = [
    { label: "Identity & application integrity", detail: "verified", w: 0.95, tone: "strong" },
    {
      label: "Income level",
      detail: `${money(income)}/yr`,
      w: income >= 80000 ? 0.9 : income >= 45000 ? 0.7 : 0.45,
      tone: income >= 80000 ? "strong" : income >= 45000 ? "good" : "fair",
    },
    {
      label: "Loan-to-income ratio",
      detail: `${Math.round(ratio * 100)}%`,
      w: ratio < 0.3 ? 0.9 : ratio < 0.55 ? 0.65 : 0.35,
      tone: ratio < 0.3 ? "strong" : ratio < 0.55 ? "good" : "fair",
    },
    { label: "Employment & education signals", detail: "consistent", w: 0.78, tone: "good" },
    { label: "Credit history depth", detail: "established", w: 0.72, tone: "good" },
    {
      label: "Estimated existing obligations",
      detail: ratio < 0.4 ? "manageable" : "elevated",
      w: ratio < 0.4 ? 0.75 : 0.45,
      tone: ratio < 0.4 ? "good" : "fair",
    },
    { label: "Fraud & velocity checks", detail: "pass", w: 0.98, tone: "strong" },
    { label: "Lender policy fit", detail: "Springfield 2026-Q3", w: 0.85, tone: "good" },
  ];

  const [shown, setShown] = useState(0);
  const [vars, setVars] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setShown((s) => Math.min(s + 1, signals.length)),
      1050,
    );
    const v = setInterval(() => setVars((n) => Math.min(n + 14, 2531)), 50);
    return () => {
      clearInterval(t);
      clearInterval(v);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = shown / signals.length;
  const risk = Math.round(82 + (targetRisk - 82) * progress);
  const riskColor =
    risk < 45 ? "text-emerald-300" : risk < 72 ? "text-amber-300" : "text-red-300";

  return (
    <div className="rounded-2xl bg-[#0B1F33] p-5 text-white shadow-lift animate-scale-in">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0DBEA8] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0DBEA8]" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
            Upstart AI underwriting
          </p>
        </div>
        <span className="rounded-full border border-[#0DBEA8]/50 px-2.5 py-0.5 text-[10px] font-semibold text-[#0DBEA8]">
          on-demand intelligence
        </span>
      </div>

      {/* variables counter */}
      <p className="mt-3 font-mono text-xs text-white/50">
        <span className="text-[#0DBEA8] tabular-nums">
          {vars.toLocaleString()}
        </span>{" "}
        variables analyzed
      </p>

      {/* signals */}
      <ul className="mt-3 space-y-2.5">
        {signals.slice(0, shown).map((s) => (
          <li key={s.label} className="animate-fade-up">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-medium text-white/85">
                {s.label}
              </p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide animate-pop-check ${TONE_CLS[s.tone].chip}`}
              >
                {s.detail}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${TONE_CLS[s.tone].bar} transition-all duration-700`}
                style={{ width: `${s.w * 100}%` }}
              />
            </div>
          </li>
        ))}
        {shown < signals.length && (
          <li key="pending" className="animate-fade-in">
            <div className="flex items-baseline justify-between gap-2">
              <p className="flex items-center gap-2 truncate text-xs font-medium text-white/50">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#0DBEA8]" />
                {signals[shown].label}
              </p>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white/40">
                computing
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="skeleton h-full w-full bg-white/10" />
            </div>
          </li>
        )}
      </ul>

      {/* risk readout */}
      <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
            Preliminary risk score
          </p>
          <p className="text-[10px] text-white/35">lower is better</p>
        </div>
        <p className={`font-mono text-3xl font-bold tabular-nums ${riskColor}`}>
          {risk}
          <span className="text-sm text-white/40">/100</span>
        </p>
      </div>
      <p className="mt-2 text-[10px] text-white/35">
        Final pricing &amp; terms returned by the Upstart Credit Decision API
        per Springfield Community Bank&apos;s credit policy.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- step UI */

function Req() {
  return <span className="ml-0.5 text-red-500">*</span>;
}

function Field({
  label,
  error,
  required = true,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-[15px] font-medium text-gray-800">
        {label}
        {required && <Req />}
      </p>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

const webformInput = (invalid: boolean) =>
  `w-full rounded border bg-white px-3.5 py-2.5 text-[15px] shadow-sm transition focus:outline-none focus:ring-4 ${
    invalid
      ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
      : "border-gray-300 hover:border-gray-400 focus:border-ds-blue focus:ring-ds-blue/15"
  }`;

function StepLoan({
  form,
  set,
  errors,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-[28px]">
        What kind of loan are you looking for?
      </h1>

      <Field label="Loan type">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              { type: "personal" as LoanType, title: "Personal Loan", desc: "Unsecured · $1,000–$50,000" },
              { type: "auto" as LoanType, title: "Auto Loan", desc: "Secured by your vehicle" },
            ]
          ).map((opt) => {
            const active = form.loanType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => set("loanType", opt.type)}
                className={`rounded border-2 p-4 text-left transition-all duration-150 ${
                  active
                    ? "border-ds-blue bg-ds-blue/5"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <p className={`text-sm font-bold ${active ? "text-ds-blue" : "text-gray-800"}`}>
                  {opt.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="How much would you like to borrow?" error={errors.requestedAmount}>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-extrabold tabular-nums text-gray-900">
            {money(form.requestedAmount)}
          </span>
          <span className="text-xs font-medium text-gray-400">$1,000 – $50,000</span>
        </div>
        <input
          type="range"
          min={1000}
          max={50000}
          step={500}
          value={form.requestedAmount}
          onChange={(e) => set("requestedAmount", Number(e.target.value))}
          className="mt-3 w-full accent-ds-blue"
          aria-label="Requested amount"
        />
        <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium text-gray-500">
            Estimated payment · {estimateTerm(form.requestedAmount)} mo term
          </p>
          <p className="text-sm font-extrabold tabular-nums text-gray-900">
            {money(estimatePayment(form.requestedAmount))}
            <span className="text-xs font-semibold text-gray-500">/mo</span>
          </p>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">
          Preview at a mid-band APR — your personalized rate is set by the
          Upstart model after you apply.
        </p>
      </Field>

      <Field label="Annual income (before taxes)" error={errors.annualIncome}>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-gray-400">
            $
          </span>
          <input
            className={`${webformInput(!!errors.annualIncome)} pl-7`}
            type="number"
            min={0}
            step={1000}
            placeholder="65,000"
            value={form.annualIncome}
            onChange={(e) =>
              set("annualIncome", e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>
      </Field>
    </div>
  );
}

function StepAbout({
  form,
  set,
  errors,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-[28px]">
        Please confirm your contact details:
      </h1>

      <Field label="First name" error={errors.firstName}>
        <input
          className={webformInput(!!errors.firstName)}
          autoComplete="given-name"
          value={form.firstName}
          onChange={(e) => set("firstName", e.target.value)}
        />
      </Field>
      <Field label="Last name" error={errors.lastName}>
        <input
          className={webformInput(!!errors.lastName)}
          autoComplete="family-name"
          value={form.lastName}
          onChange={(e) => set("lastName", e.target.value)}
        />
      </Field>
      <Field label="Email" error={errors.email}>
        <input
          className={webformInput(!!errors.email)}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </Field>
      <Field label="Street address" error={errors.street}>
        <input
          className={webformInput(!!errors.street)}
          autoComplete="street-address"
          value={form.street}
          onChange={(e) => set("street", e.target.value)}
        />
      </Field>
      <Field label="City" error={errors.city}>
        <input
          className={webformInput(!!errors.city)}
          autoComplete="address-level2"
          value={form.city}
          onChange={(e) => set("city", e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="State" error={errors.state}>
          <input
            className={webformInput(!!errors.state)}
            maxLength={2}
            placeholder="IL"
            autoComplete="address-level1"
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
          />
        </Field>
        <Field label="ZIP" error={errors.zip}>
          <input
            className={webformInput(!!errors.zip)}
            inputMode="numeric"
            autoComplete="postal-code"
            value={form.zip}
            onChange={(e) => set("zip", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function StepVehicle({
  form,
  set,
  errors,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-[28px]">
        Tell us about the vehicle:
      </h1>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Year" error={errors.vehicleYear}>
          <input
            className={webformInput(!!errors.vehicleYear)}
            inputMode="numeric"
            placeholder="2021"
            value={form.vehicleYear}
            onChange={(e) => set("vehicleYear", e.target.value)}
          />
        </Field>
        <Field label="Make" error={errors.vehicleMake}>
          <input
            className={webformInput(!!errors.vehicleMake)}
            placeholder="Honda"
            value={form.vehicleMake}
            onChange={(e) => set("vehicleMake", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Model" error={errors.vehicleModel}>
        <input
          className={webformInput(!!errors.vehicleModel)}
          placeholder="Civic"
          value={form.vehicleModel}
          onChange={(e) => set("vehicleModel", e.target.value)}
        />
      </Field>
      <Field label="Odometer (miles)" required={false} error={errors.vehicleMileage}>
        <input
          className={webformInput(!!errors.vehicleMileage)}
          inputMode="numeric"
          placeholder="42,500"
          value={form.vehicleMileage}
          onChange={(e) => set("vehicleMileage", e.target.value)}
        />
      </Field>
      <Field label="VIN" required={false} error={errors.vin}>
        <input
          className={webformInput(!!errors.vin)}
          maxLength={17}
          placeholder="17-character VIN (optional)"
          value={form.vin}
          onChange={(e) => set("vin", e.target.value)}
        />
      </Field>
    </div>
  );
}

function StepReview({ form }: { form: FormState }) {
  const rows: [string, string][] = [
    ["Loan type", form.loanType === "auto" ? "Auto (secured)" : "Personal (unsecured)"],
    ["Requested amount", money(form.requestedAmount)],
    ["Annual income", money(Number(form.annualIncome) || 0)],
    ["Name", `${form.firstName} ${form.lastName}`],
    ["Email", form.email],
    ["Address", `${form.street}, ${form.city}, ${form.state} ${form.zip}`],
  ];
  if (form.loanType === "auto") {
    rows.push([
      "Vehicle",
      `${form.vehicleYear} ${form.vehicleMake} ${form.vehicleModel}`.trim(),
    ]);
    if (form.vin) rows.push(["VIN", form.vin.toUpperCase()]);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-[28px]">
        Review and submit:
      </h1>
      <p className="mt-2 text-[15px] text-gray-600">
        Confirm everything looks right. Checking your rate won&apos;t affect
        your credit score.
      </p>

      <dl className="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-[13px] font-medium text-gray-500">{k}</dt>
            <dd className="text-right text-sm font-semibold text-gray-900">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex items-start gap-3 rounded-lg bg-gray-50 px-4 py-3">
        <svg className="mt-0.5 shrink-0 text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <p className="text-xs leading-relaxed text-gray-600">
          By submitting, you authorize Springfield Community Bank to obtain a
          credit decision through the Upstart Credit Decision API and, if
          approved, to prepare loan documents for electronic signature via
          DocuSign.
        </p>
      </div>
    </div>
  );
}
