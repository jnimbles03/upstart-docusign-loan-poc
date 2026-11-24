// POST /api/apply — submit borrower webform, run the Upstart decision step,
// return the new case (with decision or decline/manual_review outcome).

import { readJsonBody } from "@/lib/http";
import { clientAddress, takeRateLimit } from "@/lib/rateLimit";
import { runDecision, newCase } from "@/lib/services/orchestrator";
import { saveCase } from "@/lib/store";
import type { BorrowerInput, LoanType } from "@/lib/types";
import { NextResponse } from "next/server";

// This endpoint is public and every accepted request is held in process
// memory, so body size, field size, and creation rate are all capped.
const MAX_BODY_BYTES = 64 * 1024;
const MAX_FIELD_CHARS = 200;
const MAX_CREATES_PER_ADDRESS = 10;
const RATE_WINDOW_MS = 60_000;

const EMPLOYMENT_STATUSES = ["employed", "self_employed", "retired", "other"] as const;

type Range = { min: number; max: number };
const RANGES = {
  annualIncome: { min: 1, max: 100_000_000 },
  requestedAmount: { min: 1_000, max: 1_000_000 },
  yearsEmployed: { min: 0, max: 80 },
  additionalIncome: { min: 0, max: 100_000_000 },
  housingPayment: { min: 0, max: 1_000_000 },
  vehicleYear: { min: 1900, max: 2100 },
  vehicleMileage: { min: 0, max: 2_000_000 },
} satisfies Record<string, Range>;

class FieldError extends Error {}

function text(
  body: Record<string, unknown>,
  k: string,
  transform: (s: string) => string = (s) => s,
): string {
  const v = body[k];
  if (typeof v !== "string" && typeof v !== "number") {
    throw new FieldError(`Invalid field: ${k}`);
  }
  // Checked after the transform: case mapping can lengthen some Unicode text.
  const s = transform(String(v).trim());
  if (s.length > MAX_FIELD_CHARS) {
    throw new FieldError(`Field too long: ${k} (max ${MAX_FIELD_CHARS} characters)`);
  }
  return s;
}

function optionalText(
  body: Record<string, unknown>,
  k: string,
  transform?: (s: string) => string,
): string | undefined {
  return body[k] ? text(body, k, transform) : undefined;
}

function num(body: Record<string, unknown>, k: keyof typeof RANGES): number {
  const v = body[k];
  const n = typeof v === "number" || typeof v === "string" ? Number(v) : NaN;
  const { min, max } = RANGES[k];
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new FieldError(`Invalid field: ${k} (must be between ${min} and ${max})`);
  }
  return n;
}

function optionalNum(body: Record<string, unknown>, k: keyof typeof RANGES): number | undefined {
  return body[k] ? num(body, k) : undefined;
}

export async function POST(req: Request) {
  if (!takeRateLimit(`apply:${clientAddress(req)}`, MAX_CREATES_PER_ADDRESS, RATE_WINDOW_MS)) {
    await req.body?.cancel().catch(() => undefined);
    return NextResponse.json(
      { error: "Too many applications. Try again later." },
      { status: 429, headers: { "retry-after": String(RATE_WINDOW_MS / 1000) } },
    );
  }

  const parsed = await readJsonBody(req, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = parsed.value as Record<string, unknown>;

  // Minimal validation — name/address/income + loan context.
  const required: (keyof BorrowerInput)[] = [
    "firstName",
    "lastName",
    "email",
    "street",
    "city",
    "state",
    "zip",
    "annualIncome",
    "loanType",
    "requestedAmount",
  ];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === "") {
      return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 });
    }
  }
  if (body.loanType !== "personal" && body.loanType !== "auto") {
    return NextResponse.json({ error: "loanType must be 'personal' or 'auto'." }, { status: 400 });
  }
  if (
    body.employmentStatus &&
    !EMPLOYMENT_STATUSES.includes(body.employmentStatus as (typeof EMPLOYMENT_STATUSES)[number])
  ) {
    return NextResponse.json({ error: "Invalid field: employmentStatus" }, { status: 400 });
  }

  let borrower: BorrowerInput;
  try {
    borrower = {
      firstName: text(body, "firstName"),
      lastName: text(body, "lastName"),
      email: text(body, "email"),
      street: text(body, "street"),
      city: text(body, "city"),
      state: text(body, "state"),
      zip: text(body, "zip"),
      annualIncome: num(body, "annualIncome"),
      loanType: body.loanType as LoanType,
      requestedAmount: num(body, "requestedAmount"),
      employmentStatus: body.employmentStatus
        ? (body.employmentStatus as BorrowerInput["employmentStatus"])
        : undefined,
      employer: optionalText(body, "employer"),
      jobTitle: optionalText(body, "jobTitle"),
      yearsEmployed: optionalNum(body, "yearsEmployed"),
      additionalIncome: optionalNum(body, "additionalIncome"),
      housingPayment: optionalNum(body, "housingPayment"),
      vehicleYear: optionalNum(body, "vehicleYear"),
      vehicleMake: optionalText(body, "vehicleMake"),
      vehicleModel: optionalText(body, "vehicleModel"),
      vehicleMileage: optionalNum(body, "vehicleMileage"),
      vin: optionalText(body, "vin", (s) => s.toUpperCase()),
    };
  } catch (err) {
    if (err instanceof FieldError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  if (borrower.loanType === "auto") {
    if (!borrower.vehicleMake || !borrower.vehicleModel || !borrower.vehicleYear) {
      return NextResponse.json(
        { error: "Auto loans require vehicle year, make, and model." },
        { status: 400 },
      );
    }
  }

  let c = newCase(borrower);
  c = await runDecision(c);
  saveCase(c);

  return NextResponse.json(c, { status: 201 });
}
