// POST /api/apply — submit borrower webform, run the Upstart decision step,
// return the new case (with decision or decline/manual_review outcome).

import { newAccessToken, setCaseAccessCookie } from "@/lib/caseAccess";
import { runDecision, newCase } from "@/lib/services/orchestrator";
import { insertCase } from "@/lib/store";
import type { BorrowerInput, LoanType } from "@/lib/types";
import { NextResponse } from "next/server";

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

  const borrower: BorrowerInput = {
    firstName: String(body.firstName).trim(),
    lastName: String(body.lastName).trim(),
    email: String(body.email).trim(),
    street: String(body.street).trim(),
    city: String(body.city).trim(),
    state: String(body.state).trim(),
    zip: String(body.zip).trim(),
    annualIncome: Number(body.annualIncome),
    loanType: body.loanType as LoanType,
    requestedAmount: Number(body.requestedAmount),
    employmentStatus: body.employmentStatus as BorrowerInput["employmentStatus"],
    employer: body.employer ? String(body.employer) : undefined,
    jobTitle: body.jobTitle ? String(body.jobTitle) : undefined,
    yearsEmployed: body.yearsEmployed ? Number(body.yearsEmployed) : undefined,
    additionalIncome: body.additionalIncome ? Number(body.additionalIncome) : undefined,
    housingPayment: body.housingPayment ? Number(body.housingPayment) : undefined,
    vehicleYear: body.vehicleYear ? Number(body.vehicleYear) : undefined,
    vehicleMake: body.vehicleMake ? String(body.vehicleMake) : undefined,
    vehicleModel: body.vehicleModel ? String(body.vehicleModel) : undefined,
    vehicleMileage: body.vehicleMileage ? Number(body.vehicleMileage) : undefined,
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
  const { token, hash } = newAccessToken();
  if (!insertCase(c, hash)) {
    return NextResponse.json({ error: "Could not create case." }, { status: 500 });
  }

  const res = NextResponse.json(c, {
    status: 201,
    headers: { "cache-control": "no-store" },
  });
  setCaseAccessCookie(res, req, c.caseId, token);
  return res;
}
