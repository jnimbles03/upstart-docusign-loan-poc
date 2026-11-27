"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isPrincipalWithinPolicy } from "@/lib/config/lender";
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
  employmentStatus: "" | "employed" | "self_employed" | "retired" | "other";
  employer: string;
  jobTitle: string;
  yearsEmployed: string;
  additionalIncome: number | "";
  housingPayment: number | "";
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
  "Identity verified — Docusign IDV",
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
      employmentStatus: "employed",
      employer: "State of Illinois",
      jobTitle: "Project Manager",
      yearsEmployed: "6",
      additionalIncome: "",
      housingPayment: 1450,
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
      employmentStatus: "self_employed",
      employer: "Morgan Consulting LLC",
      jobTitle: "Owner",
      yearsEmployed: "4",
      additionalIncome: 6000,
      housingPayment: 1900,
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
      employmentStatus: "employed",
      employer: "Riverside Diner",
      jobTitle: "Line Cook",
      yearsEmployed: "1",
      additionalIncome: "",
      housingPayment: 850,
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
    employmentStatus: "",
    employer: "",
    jobTitle: "",
    yearsEmployed: "",
    additionalIncome: "",
    housingPayment: "",
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
  const [phase, setPhase] = useState<"idv" | "decision">("idv");
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
      employmentStatus: "",
      employer: "",
      jobTitle: "",
      yearsEmployed: "",
      additionalIncome: "",
      housingPayment: "",
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
        ? ["Loan details", "Income & employment", "About you", "Vehicle", "Review"]
        : ["Loan details", "Income & employment", "About you", "Review"],
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
      if (!isPrincipalWithinPolicy(form.requestedAmount))
        e.requestedAmount = "Choose an amount between $1,000 and $50,000.";
    }
    if (label === "Income & employment") {
      if (!form.employmentStatus) e.employmentStatus = "Select your employment status.";
      if (
        (form.employmentStatus === "employed" ||
          form.employmentStatus === "self_employed") &&
        !form.employer.trim()
      )
        e.employer = "Required.";
      if (
        (form.employmentStatus === "employed" ||
          form.employmentStatus === "self_employed") &&
        !form.jobTitle.trim()
      )
        e.jobTitle = "Required.";
      if (form.annualIncome === "" || form.annualIncome <= 0)
        e.annualIncome = "Enter your annual income.";
      if (form.yearsEmployed && Number(form.yearsEmployed) > 60)
        e.yearsEmployed = "Enter years employed (0–60).";
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
    setPhase("idv");
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
      employmentStatus: form.employmentStatus || undefined,
      employer: form.employer || undefined,
      jobTitle: form.jobTitle || undefined,
      yearsEmployed: form.yearsEmployed ? Number(form.yearsEmployed) : undefined,
      additionalIncome:
        form.additionalIncome === "" ? undefined : Number(form.additionalIncome),
      housingPayment:
        form.housingPayment === "" ? undefined : Number(form.housingPayment),
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

    // Timeline: IDV phase (~7.2s), then the underwriting brain phase.
    const IDV_MS = 7200;
    const STAGE_MS = 3600;
    setTimeout(() => setPhase("decision"), IDV_MS);
    const timers = CHECK_STAGES.map((_, i) =>
      setTimeout(() => setStage(i + 1), IDV_MS + STAGE_MS * i),
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
    const minWait = IDV_MS + STAGE_MS * (CHECK_STAGES.length - 1) + 1200;
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
              onClick={() => router.push("/portal")}
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
          {steps[step] === "Income & employment" && (
            <StepIncome form={form} set={set} errors={errors} />
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
              {phase === "idv" ? (
                <>
                  <span className="inline-flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      Powered by
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#DC2C34" strokeWidth="1.8">
                        <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3Z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      <span className="text-[15px] font-bold tracking-tight text-ds-ink">
                        Docusign
                      </span>
                      <span className="text-[15px] font-medium tracking-tight text-gray-500">
                        ID Verification
                      </span>
                    </span>
                  </span>
                  <h2 className="mt-3 text-xl font-bold text-ds-ink">
                    Verifying your identity…
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Follow the instructions on your phone — don&apos;t close
                    this window, we&apos;ll pick up here automatically.
                  </p>
                </>
              ) : (
                <>
                  <PoweredByUpstart />
                  <h2 className="mt-3 text-xl font-bold text-up-ink">
                    Decisioning your application…
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Instant AI underwriting — usually just a few seconds.
                  </p>
                </>
              )}
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

            {/* right: IDV phone flow → the underwriting brain */}
            {phase === "idv" ? <IdvPanel /> : <AiBrainPanel form={form} />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------- Docusign ID Verification (IDV) */
// Simulates the jump-to-mobile flow: SMS link → license scan → selfie
// liveness → verification report, then hands off to underwriting.

const IDV_REPORT: { label: string; doneAt: number }[] = [
  { label: "Document authenticity", doneAt: 2 },
  { label: "Age validation", doneAt: 2 },
  { label: "Spoofing detection", doneAt: 3 },
  { label: "Liveness detected", doneAt: 3 },
  { label: "Face match", doneAt: 3 },
];

function IdvPanel() {
  const [sub, setSub] = useState(0); // 0 sms · 1 scan · 2 selfie · 3 done

  useEffect(() => {
    const t1 = setTimeout(() => setSub(1), 2000);
    const t2 = setTimeout(() => setSub(2), 4200);
    const t3 = setTimeout(() => setSub(3), 6400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="flex flex-col items-center rounded-2xl bg-[#0B1F33] p-5 text-white shadow-lift animate-scale-in">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ds-red opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ds-red" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
            Docusign ID Verification
          </p>
        </div>
        <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-[10px] font-semibold text-white/70">
          jump to mobile
        </span>
      </div>

      {/* phone mock */}
      <div className="mt-4 w-[190px] rounded-[1.8rem] border-[5px] border-gray-700 bg-white p-2 text-ds-ink shadow-lift">
        <div className="mx-auto mb-1.5 h-3.5 w-16 rounded-full bg-gray-800" />
        <div className="flex h-[240px] flex-col items-center justify-center rounded-2xl bg-gray-50 px-3 text-center">
          {sub === 0 && (
            <div className="w-full animate-fade-up">
              <div className="rounded-2xl rounded-bl-sm bg-gray-200 p-2.5 text-left">
                <p className="text-[10px] leading-snug text-gray-800">
                  <span className="font-bold">Docusign:</span> use this link to
                  verify your identity{" "}
                  <span className="text-ds-blue underline">
                    demo.services.docusign.net/id/QmUCaPuv0
                  </span>
                </p>
              </div>
              <p className="mt-2 text-[9px] text-gray-400">
                Text Message · SMS · just now
              </p>
            </div>
          )}
          {sub === 1 && (
            <div className="w-full animate-fade-up">
              <div className="relative overflow-hidden rounded-md border-2 border-ds-blue/60 bg-white p-2.5">
                {/* mock license */}
                <div className="flex gap-2">
                  <div className="h-10 w-8 rounded-sm bg-gradient-to-br from-gray-300 to-gray-400" />
                  <div className="flex-1 space-y-1.5 py-0.5">
                    <div className="h-1.5 w-3/4 rounded bg-gray-300" />
                    <div className="h-1.5 w-1/2 rounded bg-gray-200" />
                    <div className="h-1.5 w-2/3 rounded bg-gray-200" />
                  </div>
                </div>
                {/* scan line */}
                <div className="absolute inset-x-0 top-0 h-0.5 animate-[scan_1.2s_ease-in-out_infinite] bg-ds-blue shadow-[0_0_8px_2px_rgba(46,99,231,0.6)]" />
              </div>
              <p className="mt-2 text-[10px] font-semibold text-gray-700">
                Scanning front of driver&apos;s license
              </p>
            </div>
          )}
          {sub === 2 && (
            <div className="w-full animate-fade-up">
              <div className="relative mx-auto flex h-28 w-24 items-center justify-center">
                {/* corner brackets */}
                {["top-0 left-0 border-t-2 border-l-2 rounded-tl-lg", "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg", "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg", "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg"].map(
                  (pos) => (
                    <span key={pos} className={`absolute h-6 w-6 border-ds-blue ${pos}`} />
                  ),
                )}
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" className="animate-pulse">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
                </svg>
              </div>
              <p className="mt-1 text-[10px] font-semibold text-gray-700">
                Position your face in the frame
              </p>
            </div>
          )}
          {sub === 3 && (
            <div className="animate-scale-in">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ds-greenSoft">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ds-green text-white animate-pop-check">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              </span>
              <p className="mt-2 text-[11px] font-bold text-gray-800">
                Identity verified
              </p>
            </div>
          )}
        </div>
      </div>

      {/* verification report */}
      <ul className="mt-4 w-full space-y-1.5">
        {IDV_REPORT.map((r) => {
          const done = sub >= r.doneAt;
          return (
            <li key={r.label} className="flex items-center gap-2 text-[11px]">
              {done ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" className="shrink-0 animate-pop-check">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white/30" />
              )}
              <span className={done ? "text-white/85" : "text-white/35"}>
                {r.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------- AI underwriting brain */

type Signal = {
  label: string;
  detail: string;
  thought: string; // typed out in mono while the model "computes" this signal
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
    {
      label: "Identity & application integrity",
      detail: "verified",
      thought: `> identity_graph.lookup("${form.firstName} ${form.lastName}") → match_confidence=0.99`,
      w: 0.95,
      tone: "strong",
    },
    {
      label: "Income level",
      detail: `${money(income)}/yr`,
      thought: `> income_model.score(annual=${income}) → percentile=${income >= 80000 ? "81" : income >= 45000 ? "58" : "27"}`,
      w: income >= 80000 ? 0.9 : income >= 45000 ? 0.7 : 0.45,
      tone: income >= 80000 ? "strong" : income >= 45000 ? "good" : "fair",
    },
    {
      label: "Loan-to-income ratio",
      detail: `${Math.round(ratio * 100)}%`,
      thought: `> capacity.compute(principal=${form.requestedAmount}, income=${income}) → lti=${ratio.toFixed(2)}`,
      w: ratio < 0.3 ? 0.9 : ratio < 0.55 ? 0.65 : 0.35,
      tone: ratio < 0.3 ? "strong" : ratio < 0.55 ? "good" : "fair",
    },
    {
      label: "Employment & education signals",
      detail: "consistent",
      thought: `> employment.verify("${form.employer || "n/a"}", tenure=${form.yearsEmployed || "?"}y) → stability=0.78`,
      w: 0.78,
      tone: "good",
    },
    {
      label: "Credit history depth",
      detail: "established",
      thought: "> bureau.features(history_months, tradelines) → depth=0.72",
      w: 0.72,
      tone: "good",
    },
    {
      label: "Estimated existing obligations",
      detail: ratio < 0.4 ? "manageable" : "elevated",
      thought: `> obligations.estimate(housing=${form.housingPayment === "" ? "n/a" : form.housingPayment}/mo) → burden=${ratio < 0.4 ? "0.31" : "0.58"}`,
      w: ratio < 0.4 ? 0.75 : 0.45,
      tone: ratio < 0.4 ? "good" : "fair",
    },
    {
      label: "Fraud & velocity checks",
      detail: "pass",
      thought: "> fraud.scan(device, velocity, anomalies) → 0 flags",
      w: 0.98,
      tone: "strong",
    },
    {
      label: "Lender policy fit",
      detail: "Springfield 2026-Q3",
      thought: `> policy.match("${form.loanType}", return_curve=2026-Q3) → eligible`,
      w: 0.85,
      tone: "good",
    },
  ];

  const [shown, setShown] = useState(0);
  const [typed, setTyped] = useState(0);
  const [vars, setVars] = useState(0);

  // typewriter: type the current signal's thought, then lock it in
  useEffect(() => {
    if (shown >= signals.length) return;
    const thought = signals[shown].thought;
    let i = 0;
    const type = setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= thought.length) {
        clearInterval(type);
        setTimeout(() => {
          setShown((s) => s + 1);
          setTyped(0);
        }, 450);
      }
    }, 26);
    return () => clearInterval(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  // variables counter crawls up over the full sequence
  useEffect(() => {
    const v = setInterval(() => setVars((n) => Math.min(n + 10, 2531)), 50);
    return () => clearInterval(v);
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
      <ul className="mt-3 space-y-3">
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
            <p className="mt-0.5 truncate font-mono text-[10px] text-white/35">
              {s.thought}
            </p>
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
            <p className="mt-0.5 min-h-[14px] truncate font-mono text-[10px] text-[#0DBEA8]/90">
              {signals[shown].thought.slice(0, typed)}
              <span className="animate-pulse">▌</span>
            </p>
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

/* ------------------------------------------------- income & employment */

const EMPLOYMENT_OPTIONS: { value: FormState["employmentStatus"]; label: string }[] = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

function StepIncome({
  form,
  set,
  errors,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  const moneyInput = (
    key: "annualIncome" | "additionalIncome" | "housingPayment",
    label: string,
    placeholder: string,
    required: boolean,
  ) => (
    <Field label={label} required={required} error={errors[key]}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-gray-400">
          $
        </span>
        <input
          className={`${webformInput(!!errors[key])} pl-7`}
          type="number"
          min={0}
          step={500}
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) =>
            set(key, e.target.value === "" ? "" : Number(e.target.value))
          }
        />
      </div>
    </Field>
  );

  const working =
    form.employmentStatus === "employed" ||
    form.employmentStatus === "self_employed";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-[28px]">
        How do you earn?
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Upstart&apos;s model weighs income, employment, and housing — not just
        a credit score.
      </p>

      <Field label="Employment status" error={errors.employmentStatus}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {EMPLOYMENT_OPTIONS.map((o) => {
            const active = form.employmentStatus === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => set("employmentStatus", o.value)}
                className={`rounded border-2 px-3 py-2.5 text-[13px] font-semibold transition-all ${
                  active
                    ? "border-ds-blue bg-ds-blue/5 text-ds-blue"
                    : "border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </Field>

      {working && (
        <div className="animate-fade-up">
          <Field label="Employer" error={errors.employer}>
            <input
              className={webformInput(!!errors.employer)}
              placeholder="Company or organization"
              value={form.employer}
              onChange={(e) => set("employer", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Job title" error={errors.jobTitle}>
              <input
                className={webformInput(!!errors.jobTitle)}
                placeholder="Your role"
                value={form.jobTitle}
                onChange={(e) => set("jobTitle", e.target.value)}
              />
            </Field>
            <Field label="Years employed" required={false} error={errors.yearsEmployed}>
              <input
                className={webformInput(!!errors.yearsEmployed)}
                inputMode="numeric"
                placeholder="3"
                value={form.yearsEmployed}
                onChange={(e) => set("yearsEmployed", e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      {moneyInput("annualIncome", "Annual income (before taxes)", "65,000", true)}
      {moneyInput("additionalIncome", "Additional yearly income", "0", false)}
      {moneyInput("housingPayment", "Monthly rent or mortgage payment", "1,400", false)}
    </div>
  );
}

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
  const statusLabel =
    EMPLOYMENT_OPTIONS.find((o) => o.value === form.employmentStatus)?.label ??
    form.employmentStatus;
  const rows: [string, string][] = [
    ["Loan type", form.loanType === "auto" ? "Auto (secured)" : "Personal (unsecured)"],
    ["Requested amount", money(form.requestedAmount)],
    ["Employment", `${statusLabel}${form.employer ? ` · ${form.employer}` : ""}${form.yearsEmployed ? ` · ${form.yearsEmployed}y` : ""}`],
    ["Annual income", money(Number(form.annualIncome) || 0)],
  ];
  if (form.additionalIncome !== "" && Number(form.additionalIncome) > 0)
    rows.push(["Additional income", money(Number(form.additionalIncome))]);
  if (form.housingPayment !== "" && Number(form.housingPayment) > 0)
    rows.push(["Housing payment", `${money(Number(form.housingPayment))}/mo`]);
  rows.push(
    ["Name", `${form.firstName} ${form.lastName}`],
    ["Email", form.email],
    ["Address", `${form.street}, ${form.city}, ${form.state} ${form.zip}`],
  );
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
