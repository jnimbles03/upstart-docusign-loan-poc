// POST /api/apply — submit borrower webform, run the Upstart decision step,
// return the new case (with decision or decline/manual_review outcome).

import { runDecision, newCase } from "@/lib/services/orchestrator";
import { saveCase } from "@/lib/store";
import type { BorrowerInput, LoanType } from "@/lib/types";
import { NextResponse } from "next/server";

const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

// Strict numeric parse: plain decimal numbers or decimal strings only, and the
// result must be finite. Anything else (NaN, Infinity, "1e309", "0x1", "50,000",
// objects, arrays) returns null so the caller can reject the request.
function parseFiniteNumber(value: unknown): number | null {
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string" && DECIMAL.test(value.trim())) {
    n = Number(value.trim());
  } else {
    return null;
  }
  return Number.isFinite(n) ? n : null;
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export async function POST(req: Request) {
  let body: Partial<BorrowerInput> & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

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

  const annualIncome = parseFiniteNumber(body.annualIncome);
  if (annualIncome === null || annualIncome < 0) {
    return NextResponse.json(
      { error: "annualIncome must be a finite, non-negative number." },
      { status: 400 },
    );
  }
  const requestedAmount = parseFiniteNumber(body.requestedAmount);
  if (requestedAmount === null || requestedAmount <= 0) {
    return NextResponse.json(
      { error: "requestedAmount must be a finite, positive number." },
      { status: 400 },
    );
  }

  const optionalNumeric = [
    "yearsEmployed",
    "additionalIncome",
    "housingPayment",
    "vehicleYear",
    "vehicleMileage",
  ] as const;
  const optional: Partial<Record<(typeof optionalNumeric)[number], number>> = {};
  for (const k of optionalNumeric) {
    if (isAbsent(body[k])) continue;
    const n = parseFiniteNumber(body[k]);
    if (n === null) {
      return NextResponse.json({ error: `${k} must be a finite number.` }, { status: 400 });
    }
    optional[k] = n;
  }

  const borrower: BorrowerInput = {
    firstName: String(body.firstName).trim(),
    lastName: String(body.lastName).trim(),
    email: String(body.email).trim(),
    street: String(body.street).trim(),
    city: String(body.city).trim(),
    state: String(body.state).trim(),
    zip: String(body.zip).trim(),
    annualIncome,
    loanType: body.loanType as LoanType,
    requestedAmount,
    employmentStatus: body.employmentStatus as BorrowerInput["employmentStatus"],
    employer: body.employer ? String(body.employer) : undefined,
    jobTitle: body.jobTitle ? String(body.jobTitle) : undefined,
    yearsEmployed: optional.yearsEmployed,
    additionalIncome: optional.additionalIncome,
    housingPayment: optional.housingPayment,
    vehicleYear: optional.vehicleYear,
    vehicleMake: body.vehicleMake ? String(body.vehicleMake) : undefined,
    vehicleModel: body.vehicleModel ? String(body.vehicleModel) : undefined,
    vehicleMileage: optional.vehicleMileage,
    vin: body.vin ? String(body.vin).toUpperCase() : undefined,
  };

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
