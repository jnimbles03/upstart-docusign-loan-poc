/**
 * Credit-policy spec for non-finite income and requested amount.
 *
 * These tests fail while the underwriting path can approve an application
 * whose annual income or requested amount is not a finite number. They pass
 * once intake rejects those values before storing a case, and once the credit
 * decision itself declines them.
 *
 * Optional numerics that never reach a policy comparison (yearsEmployed,
 * additionalIncome, housingPayment, vehicleYear, vehicleMileage) are not
 * covered. Finite amounts below the configured minimum are a separate gap
 * and are not covered either.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as applyPost } from "@/app/api/apply/route";
import { POST as acceptPost } from "@/app/api/case/[caseId]/accept/route";
import { POST as signPost } from "@/app/api/case/[caseId]/route";
import { getCreditDecision } from "@/lib/services/upstart";
import { newCase, runDecision } from "@/lib/services/orchestrator";
import { getCase, listCases } from "@/lib/store";
import type { BorrowerInput, Envelope, LoanCase } from "@/lib/types";

const MAX_AMOUNT = 50_000;

function borrower(overrides: Partial<BorrowerInput> = {}): BorrowerInput {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    street: "1 Market St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    annualIncome: 100_000,
    loanType: "personal",
    requestedAmount: 10_000,
    ...overrides,
  };
}

function applyRequest(overrides: Record<string, unknown>): Request {
  const body = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: overrides.email,
    street: "1 Market St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    loanType: "personal",
    annualIncome: 100_000,
    requestedAmount: 10_000,
    ...overrides,
  };
  return new Request("http://127.0.0.1/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function casesForEmail(email: string): LoanCase[] {
  return listCases().filter((c) => c.borrower.email === email);
}

function envelopeSummary(envelopes: Envelope[]): string {
  const done = envelopes.filter((e) => e.status === "completed").length;
  return `${done}/${envelopes.length} signed`;
}

function summarize(c: LoanCase): string {
  return [
    `case ${c.caseId}`,
    `decision=${c.decision?.status ?? "none"}`,
    `amount=${String(c.decision?.approvedAmount)}`,
    `risk=${String(c.decision?.riskScore)}`,
    `income=${String(c.borrower.annualIncome)}`,
    `requested=${String(c.borrower.requestedAmount)}`,
    envelopeSummary(c.envelopes),
    `offerAccepted=${String(c.offerAccepted)}`,
  ].join(" ");
}

async function closeApprovedCase(caseId: string): Promise<void> {
  const existing = getCase(caseId);
  if (!existing || existing.decision?.status !== "approved") return;

  const acceptRes = await acceptPost(
    new Request(`http://127.0.0.1/api/case/${caseId}/accept`, { method: "POST" }),
    { params: { caseId } },
  );
  assert.equal(
    acceptRes.status,
    200,
    `accept failed while reproducing close path: ${acceptRes.status}`,
  );

  let current = getCase(caseId);
  const envelopes = [...(current?.envelopes ?? [])].sort((a, b) => {
    if (a.method === b.method) return 0;
    return a.method === "clickwrap" ? -1 : 1;
  });
  for (const envelope of envelopes) {
    const signRes = await signPost(
      new Request(
        `http://127.0.0.1/api/case/${caseId}?envelopeId=${encodeURIComponent(envelope.envelopeId)}`,
        { method: "POST" },
      ),
      { params: { caseId } },
    );
    assert.equal(
      signRes.status,
      200,
      `sign ${envelope.method} ${envelope.envelopeId} failed: ${signRes.status} ${await signRes.text()}`,
    );
    current = getCase(caseId);
  }
}

async function submit(overrides: Record<string, unknown>): Promise<{
  status: number;
  body: Record<string, unknown>;
  cases: LoanCase[];
}> {
  const email = `policy-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await applyPost(applyRequest({ ...overrides, email }));
  const body = (await res.json()) as Record<string, unknown>;
  let stored = casesForEmail(email);
  for (const c of stored) {
    if (c.decision?.status === "approved") {
      await closeApprovedCase(c.caseId);
    }
  }
  stored = casesForEmail(email);
  return { status: res.status, body, cases: stored };
}

function observed(result: { status: number; body: Record<string, unknown>; cases: LoanCase[] }): string {
  const stored = result.cases.map(summarize).join(" || ");
  const decision = result.body.decision as { status?: string; approvedAmount?: unknown } | undefined;
  return `http ${result.status} responseDecision=${decision?.status ?? "none"} responseAmount=${String(decision?.approvedAmount)} stored=[${stored}]`;
}

async function assertIntakeRejects(label: string, overrides: Record<string, unknown>): Promise<void> {
  const result = await submit(overrides);
  const detail = `${label} must be rejected before a case is stored. ${observed(result)}`;
  assert.equal(result.status, 400, detail);
  assert.equal(result.cases.length, 0, detail);
  assert.equal(result.body.decision, undefined, detail);
}

test("finite income and amount are still approved and stored", async () => {
  const result = await submit({ annualIncome: 100_000, requestedAmount: 10_000 });
  assert.equal(result.status, 201, observed(result));
  assert.equal(result.cases.length, 1);
  assert.equal(result.cases[0]?.decision?.status, "approved");
  assert.equal(result.cases[0]?.decision?.approvedAmount, 10_000);
  assert.equal(result.cases[0]?.envelopes.length, 2);
  assert.equal(
    result.cases[0]?.envelopes.every((e) => e.status === "completed"),
    true,
  );
});

test("numeric strings that are finite are still approved", async () => {
  const result = await submit({ annualIncome: "100000", requestedAmount: "10000" });
  assert.equal(result.status, 201, observed(result));
  assert.equal(result.cases[0]?.decision?.status, "approved");
  assert.equal(result.cases[0]?.decision?.approvedAmount, 10_000);
});

test("finite income below the floor is declined and not closed", async () => {
  const result = await submit({ annualIncome: 10_000, requestedAmount: 5_000 });
  assert.equal(result.status, 201, observed(result));
  assert.equal(result.cases.length, 1);
  assert.equal(result.cases[0]?.decision?.status, "declined");
  assert.equal(result.cases[0]?.envelopes.length, 0);
  assert.notEqual(result.cases[0]?.offerAccepted, true);
});

test("missing annualIncome is rejected and not stored", async () => {
  const result = await submit({ annualIncome: "" });
  assert.equal(result.status, 400, observed(result));
  assert.equal(result.cases.length, 0);
});

const NON_FINITE_INCOMES: unknown[] = [
  "n/a",
  "NaN",
  "nan",
  "Infinity",
  "+Infinity",
  "-Infinity",
  "1e309",
  "-1e309",
  "50,000",
  "$95000",
  "  n/a  ",
  "0x1",
  {},
  ["n/a"],
];

for (const annualIncome of NON_FINITE_INCOMES) {
  test(`apply rejects non-finite annualIncome ${JSON.stringify(annualIncome)} without approving or closing ${MAX_AMOUNT}`, async () => {
    await assertIntakeRejects(`annualIncome ${JSON.stringify(annualIncome)}`, {
      annualIncome,
      requestedAmount: MAX_AMOUNT,
    });
  });
}

const NON_FINITE_AMOUNTS: unknown[] = ["n/a", "NaN", "-Infinity", "-1e309", "Infinity", "1e309", {}, ["n/a"]];

for (const requestedAmount of NON_FINITE_AMOUNTS) {
  test(`apply rejects non-finite requestedAmount ${JSON.stringify(requestedAmount)} with qualifying income`, async () => {
    await assertIntakeRejects(`requestedAmount ${JSON.stringify(requestedAmount)}`, {
      annualIncome: 100_000,
      requestedAmount,
    });
  });
}

test("auto apply rejects non-finite income and does not close the max amount", async () => {
  await assertIntakeRejects("auto annualIncome n/a", {
    loanType: "auto",
    annualIncome: "n/a",
    requestedAmount: MAX_AMOUNT,
    vehicleYear: 2020,
    vehicleMake: "Honda",
    vehicleModel: "Civic",
  });
});

test("getCreditDecision declines NaN income instead of approving the max amount", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: Number.NaN, requestedAmount: MAX_AMOUNT }),
  );
  assert.equal(decision.status, "declined");
  assert.notEqual(decision.approvedAmount, MAX_AMOUNT);
});

test("getCreditDecision declines Infinity income instead of approving the max amount", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: Number.POSITIVE_INFINITY, requestedAmount: MAX_AMOUNT }),
  );
  assert.equal(decision.status, "declined");
  assert.notEqual(decision.approvedAmount, MAX_AMOUNT);
});

test("getCreditDecision declines negative Infinity income", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: Number.NEGATIVE_INFINITY, requestedAmount: MAX_AMOUNT }),
  );
  assert.equal(decision.status, "declined");
  assert.notEqual(decision.approvedAmount, MAX_AMOUNT);
});

test("getCreditDecision declines NaN requested amount", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: 100_000, requestedAmount: Number.NaN }),
  );
  assert.equal(decision.status, "declined");
  assert.ok(!Number.isFinite(decision.approvedAmount));
});

test("getCreditDecision declines negative Infinity requested amount", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: 100_000, requestedAmount: Number.NEGATIVE_INFINITY }),
  );
  assert.equal(decision.status, "declined");
  assert.ok(!Number.isFinite(decision.approvedAmount));
});

test("getCreditDecision declines positive Infinity requested amount", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: 100_000, requestedAmount: Number.POSITIVE_INFINITY }),
  );
  assert.equal(decision.status, "declined");
});

test("getCreditDecision declines when both income and amount are Infinity", async () => {
  const decision = await getCreditDecision(
    borrower({
      annualIncome: Number.POSITIVE_INFINITY,
      requestedAmount: Number.POSITIVE_INFINITY,
    }),
  );
  assert.equal(decision.status, "declined");
  assert.notEqual(decision.approvedAmount, MAX_AMOUNT);
});

test("getCreditDecision declines when both income and amount are NaN", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: Number.NaN, requestedAmount: Number.NaN }),
  );
  assert.equal(decision.status, "declined");
});

test("getCreditDecision still approves a finite qualifying application", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: 100_000, requestedAmount: 10_000 }),
  );
  assert.equal(decision.status, "approved");
  assert.equal(decision.approvedAmount, 10_000);
  assert.equal(Number.isFinite(decision.apr), true);
});

test("getCreditDecision still declines finite income under the floor", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: 11_999, requestedAmount: 2_000 }),
  );
  assert.equal(decision.status, "declined");
});

test("getCreditDecision still declines a finite amount above the income ratio cap", async () => {
  const decision = await getCreditDecision(
    borrower({ annualIncome: 20_000, requestedAmount: MAX_AMOUNT }),
  );
  assert.equal(decision.status, "declined");
});

test("runDecision does not approve or prepare documents for NaN income", async () => {
  const created = newCase(borrower({ annualIncome: Number.NaN, requestedAmount: MAX_AMOUNT }));
  const decided = await runDecision(created);
  assert.equal(decided.decision?.status, "declined");
  assert.notEqual(decided.decision?.approvedAmount, MAX_AMOUNT);
  assert.equal(decided.offerAccepted, null);
  assert.equal(decided.envelopes.length, 0);
  const offer = decided.steps.find((s) => s.key === "offer");
  assert.notEqual(offer?.status, "pending");
});
