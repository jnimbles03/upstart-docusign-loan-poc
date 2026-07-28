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
    const timers = CHECK_STAGES.map((_, i) =>
      setTimeout(() => setStage(i + 1), 650 * (i + 1)),
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
    const minWait = 650 * CHECK_STAGES.length + 500;
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-white/95 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm px-6 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-up-soft">
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
            <ul className="mx-auto mt-6 max-w-xs space-y-3 text-left">
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
        </div>
      )}
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
