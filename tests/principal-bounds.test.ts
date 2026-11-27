/**
 * Principal bounds on loan applications and credit decisions.
 *
 * These tests are the spec for the missing minimum/maximum check. They fail
 * while a requested amount outside the published range (1000 through 50000),
 * or a non-finite amount, can be approved and turned into closing documents.
 *
 * Run from the repository root:
 *   npx --yes tsx tests/principal-bounds.test.ts
 */
import assert from "node:assert/strict";
import { POST as applyPost } from "../src/app/api/apply/route";
import { POST as acceptPost } from "../src/app/api/case/[caseId]/accept/route";
import { POST as signPost } from "../src/app/api/case/[caseId]/route";
import { LENDER_POLICY } from "../src/lib/config/lender";
import { listCases } from "../src/lib/store";
import { getCreditDecision } from "../src/lib/services/upstart";
import type { BorrowerInput, LoanCase, LoanType } from "../src/lib/types";

const MIN = 1000;
const MAX = 50000;

type Json = Record<string, unknown>;

const tests: { name: string; fn: () => Promise<void> }[] = [];

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn });
}

function borrower(overrides: Json = {}): Json {
  return {
    firstName: "Ada",
    lastName: "Borrower",
    email: "ada@example.com",
    street: "1 Main St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    annualIncome: 80000,
    loanType: "personal" satisfies LoanType,
    requestedAmount: 10000,
    ...overrides,
  };
}

function autoBorrower(requestedAmount: unknown, annualIncome = 80000): Json {
  return borrower({
    loanType: "auto",
    annualIncome,
    requestedAmount,
    vehicleYear: 2020,
    vehicleMake: "Honda",
    vehicleModel: "Civic",
    vehicleMileage: 25000,
    vin: "1HGCM82633A004352",
  });
}

async function postApply(body: Json): Promise<{ status: number; body: Json }> {
  const res = await applyPost(
    new Request("http://localhost/api/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as Json };
}

function decisionOf(body: Json): Json | null {
  const decision = body.decision;
  if (!decision || typeof decision !== "object") return null;
  return decision as Json;
}

function assertNoPricedTerms(decision: Json | null, label: string) {
  if (!decision) return;
  assert.equal(decision.status, "declined", `${label}: decision status`);
  assert.equal(decision.approvedAmount ?? null, null, `${label}: approvedAmount must not be set`);
  assert.equal(decision.originationFee ?? null, null, `${label}: originationFee must not be set`);
  assert.equal(decision.monthlyPayment ?? null, null, `${label}: monthlyPayment must not be set`);
  assert.ok(
    Array.isArray(decision.reasons) && decision.reasons.length > 0,
    `${label}: decline must include reasons`,
  );
}

async function closeAndSign(caseId: string): Promise<LoanCase> {
  const accepted = await acceptPost(
    new Request(`http://localhost/api/case/${caseId}/accept`, { method: "POST" }),
    { params: { caseId } },
  );
  let current = (await accepted.json()) as LoanCase;
  assert.equal(accepted.status, 200, `accept failed: ${JSON.stringify(current)}`);
  const ordered = [...current.envelopes].sort((a, b) => {
    if (a.method === b.method) return 0;
    return a.method === "clickwrap" ? -1 : 1;
  });
  for (const envelope of ordered) {
    const signed = await signPost(
      new Request(
        `http://localhost/api/case/${caseId}?envelopeId=${encodeURIComponent(envelope.envelopeId)}`,
        { method: "POST" },
      ),
      { params: { caseId } },
    );
    current = (await signed.json()) as LoanCase;
    assert.equal(signed.status, 200, `sign failed: ${JSON.stringify(current)}`);
  }
  return current;
}

function principalLines(loanCase: LoanCase): string[] {
  return (loanCase.workspace?.documents ?? []).map(
    (doc) => `${doc.name}: ${doc.preview.split("\n").find((line) => line.startsWith("Principal:")) ?? "(no principal)"}`,
  );
}

/**
 * Drive the public apply route. Out-of-policy amounts must be rejected with
 * HTTP 400, or stored only as a decline with no priced terms. An approval is
 * followed through offer acceptance and envelope completion so the assertion
 * sees the closing documents the attack produces.
 */
async function assertApplyRejectsOutOfPolicy(label: string, body: Json, followThrough: boolean) {
  const before = new Set(listCases().map((c) => c.caseId));
  const res = await postApply(body);
  const created = listCases().filter((c) => !before.has(c.caseId));
  const decision = decisionOf(res.body);
  const caseId = typeof res.body.caseId === "string" ? res.body.caseId : created[0]?.caseId;

  if (decision?.status === "approved" && caseId && followThrough) {
    const closed = await closeAndSign(caseId);
    const completed = closed.envelopes.filter((e) => e.status === "completed");
    assert.fail(
      [
        `${label}: application was approved and closing documents were completed`,
        `http ${res.status}`,
        `approvedAmount=${decision.approvedAmount}`,
        `originationFee=${decision.originationFee}`,
        `monthlyPayment=${decision.monthlyPayment}`,
        `apr=${decision.apr}`,
        `termMonths=${decision.termMonths}`,
        `riskScore=${decision.riskScore}`,
        `documents: ${principalLines(closed).join(" | ")}`,
        `envelopes completed ${completed.length}/${closed.envelopes.length}`,
      ].join("\n"),
    );
  }

  if (decision?.status === "approved") {
    assert.fail(
      `${label}: approved approvedAmount=${decision.approvedAmount} originationFee=${decision.originationFee} monthlyPayment=${decision.monthlyPayment} riskScore=${decision.riskScore}`,
    );
  }

  const storedApproved = created.filter((c) => c.decision?.status === "approved");
  assert.equal(storedApproved.length, 0, `${label}: stored an approved case`);

  if (res.status === 400) {
    for (const c of created) {
      assert.notEqual(c.decision?.status, "approved", `${label}: saved an approval before refusing`);
      assert.equal(c.envelopes.length, 0, `${label}: envelopes created before refusal`);
      assert.equal(c.workspace, null, `${label}: workspace created before refusal`);
    }
    assert.equal(res.body.decision ?? null, null, `${label}: 400 body must not carry a decision`);
    return;
  }

  assert.equal(res.status, 201, `${label}: expected HTTP 400 or a declined decision, got ${res.status}`);
  assertNoPricedTerms(decision, label);
  for (const c of created) {
    assert.equal(c.envelopes.length, 0, `${label}: envelopes on a rejected application`);
    assert.equal(c.workspace, null, `${label}: workspace on a rejected application`);
    if (c.decision) assertNoPricedTerms(c.decision as unknown as Json, `${label} stored`);
  }
}

async function assertDecisionDeclines(label: string, input: BorrowerInput) {
  const decision = await getCreditDecision(input);
  assert.equal(
    decision.status,
    "declined",
    `${label}: approvedAmount=${decision.approvedAmount} originationFee=${decision.originationFee} monthlyPayment=${decision.monthlyPayment} riskScore=${decision.riskScore}`,
  );
  assert.equal(decision.approvedAmount, undefined, label);
  assert.equal(decision.originationFee, undefined, label);
  assert.equal(decision.monthlyPayment, undefined, label);
  assert.ok(decision.reasons && decision.reasons.length > 0, `${label}: missing decline reasons`);
}

function asBorrower(body: Json): BorrowerInput {
  return body as unknown as BorrowerInput;
}

test("published lender bounds stay 1000 through 50000", async () => {
  assert.equal(LENDER_POLICY.minLoanAmount, MIN);
  assert.equal(LENDER_POLICY.maxLoanAmount, MAX);
  assert.equal(LENDER_POLICY.minAnnualIncome, 12000);
  assert.equal(LENDER_POLICY.maxAmountToIncomeRatio, 0.5);
  assert.equal(LENDER_POLICY.originationFeePercent, 0.05);
});

test("in-range personal amount 10000 is approved", async () => {
  const res = await postApply(borrower({ requestedAmount: 10000, annualIncome: 80000 }));
  const decision = decisionOf(res.body);
  assert.equal(res.status, 201);
  assert.equal(decision?.status, "approved");
  assert.equal(decision?.approvedAmount, 10000);
  assert.ok(Number(decision?.originationFee) > 0);
  assert.ok(Number(decision?.monthlyPayment) > 0);
});

test("published minimum 1000 is approved", async () => {
  const decision = await getCreditDecision(
    asBorrower(borrower({ requestedAmount: MIN, annualIncome: 80000 })),
  );
  assert.equal(decision.status, "approved", `riskScore=${decision.riskScore}`);
  assert.equal(decision.approvedAmount, MIN);
});

test("published maximum 50000 is approved when income supports it", async () => {
  const decision = await getCreditDecision(
    asBorrower(borrower({ requestedAmount: MAX, annualIncome: 100000 })),
  );
  assert.equal(decision.status, "approved", `riskScore=${decision.riskScore}`);
  assert.equal(decision.approvedAmount, MAX);
  assert.ok((decision.originationFee ?? 0) > 0);
  assert.ok((decision.monthlyPayment ?? 0) > 0);
});

test("negative requested amount is not originated", async () => {
  await assertApplyRejectsOutOfPolicy(
    "POST /api/apply requestedAmount -100000",
    borrower({ requestedAmount: -100000, annualIncome: 80000 }),
    true,
  );
});

test("amount below the published minimum is not originated", async () => {
  await assertApplyRejectsOutOfPolicy(
    "POST /api/apply requestedAmount 500",
    borrower({ requestedAmount: 500, annualIncome: 80000 }),
    true,
  );
});

test("zero requested amount is not approved", async () => {
  await assertApplyRejectsOutOfPolicy(
    "POST /api/apply requestedAmount 0",
    borrower({ requestedAmount: 0, annualIncome: 80000 }),
    false,
  );
});

test("just under the minimum is not approved", async () => {
  await assertApplyRejectsOutOfPolicy(
    "POST /api/apply requestedAmount 999.99",
    borrower({ requestedAmount: 999.99, annualIncome: 80000 }),
    false,
  );
});

test("numeric string below the minimum is not approved", async () => {
  await assertApplyRejectsOutOfPolicy(
    "POST /api/apply requestedAmount string -100000",
    borrower({ requestedAmount: "-100000", annualIncome: 80000 }),
    false,
  );
});

test("non-numeric requested amount is not approved", async () => {
  await assertApplyRejectsOutOfPolicy(
    "POST /api/apply requestedAmount foo",
    borrower({ requestedAmount: "foo", annualIncome: 80000 }),
    false,
  );
});

test("requested amount above the published maximum is not approved", async () => {
  await assertApplyRejectsOutOfPolicy(
    "POST /api/apply requestedAmount 60000",
    borrower({ requestedAmount: 60000, annualIncome: 200000 }),
    false,
  );
});

test("negative auto loan amount is not originated", async () => {
  await assertApplyRejectsOutOfPolicy(
    "POST /api/apply auto requestedAmount -100000",
    autoBorrower(-100000, 80000),
    true,
  );
});

test("credit decision declines a negative principal", async () => {
  await assertDecisionDeclines(
    "getCreditDecision -100000",
    asBorrower(borrower({ requestedAmount: -100000, annualIncome: 80000 })),
  );
});

test("credit decision declines a principal below the minimum", async () => {
  await assertDecisionDeclines(
    "getCreditDecision 500",
    asBorrower(borrower({ requestedAmount: 500, annualIncome: 80000 })),
  );
});

test("credit decision declines a zero principal", async () => {
  await assertDecisionDeclines(
    "getCreditDecision 0",
    asBorrower(borrower({ requestedAmount: 0, annualIncome: 80000 })),
  );
});

test("credit decision declines a non-finite principal", async () => {
  await assertDecisionDeclines(
    "getCreditDecision NaN",
    asBorrower(borrower({ requestedAmount: Number.NaN, annualIncome: 80000 })),
  );
  await assertDecisionDeclines(
    "getCreditDecision -Infinity",
    asBorrower(borrower({ requestedAmount: Number.NEGATIVE_INFINITY, annualIncome: 80000 })),
  );
});

test("credit decision declines a principal above the maximum", async () => {
  await assertDecisionDeclines(
    "getCreditDecision 60000",
    asBorrower(borrower({ requestedAmount: 60000, annualIncome: 200000 })),
  );
});

test("credit decision declines a negative auto principal", async () => {
  await assertDecisionDeclines(
    "getCreditDecision auto -100000",
    asBorrower(autoBorrower(-100000, 80000)),
  );
});

async function main() {
  let failed = 0;
  for (const entry of tests) {
    try {
      await entry.fn();
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${entry.name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  console.error(`${tests.length - failed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
