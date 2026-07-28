// Mock Upstart Credit Decision API client.
// Mirrors the documented contract: takes name/address/income (+ loan context),
// returns an AI decision with APR/term/amount/loss-rate or a decline + adverse
// action notice. Real implementation would POST to Upstart's secure endpoint
// with the lender's API key and credit-policy/return-curve config.

import {
  LENDER_POLICY,
  LENDER_POLICY_VERSION,
  UPSTART_MODEL_VERSION,
} from "@/lib/config/lender";
import type { BorrowerInput, UpstartDecision } from "@/lib/types";
import { uid } from "@/lib/store";

// Deterministic-ish pseudo "AI risk score" so the POC feels realistic but is
// bounded. 0 = lowest risk, 100 = highest.
function modelRiskScore(b: BorrowerInput): number {
  const incomeRatio = b.requestedAmount / Math.max(b.annualIncome, 1);
  let risk = 30;
  risk += incomeRatio * 60; // higher ask/income => riskier
  if (b.loanType === "auto") risk -= 6; // secured => lower
  if (b.annualIncome > 80000) risk -= 10;
  if (b.annualIncome < 25000) risk += 12;
  // jitter so repeated runs vary slightly (mimics model nondeterminism)
  risk += (Math.random() - 0.5) * 6;
  return Math.max(2, Math.min(98, Math.round(risk)));
}

function buildAdverseActionNotice(
  borrower: BorrowerInput,
  reasons: string[],
): string {
  const name = `${borrower.firstName} ${borrower.lastName}`;
  return [
    `ADVERSE ACTION NOTICE`,
    `------------------------`,
    `To: ${name}`,
    `Date: ${new Date().toLocaleDateString()}`,
    ``,
    `Thank you for applying with ${LENDER_POLICY.lenderName}.`,
    `After evaluating your application, we regret to inform you that we are`,
    `unable to approve your request for credit at this time.`,
    ``,
    `Our decision was based in part on a credit decisioning model provided by`,
    `Upstart Network, Inc., and on our credit policy (${LENDER_POLICY_VERSION}).`,
    ``,
    `Principal reason(s) for denial:`,
    ...reasons.map((r) => `  - ${r}`),
    ``,
    `You have the right to obtain a free copy of your credit report from the`,
    `consumer reporting agency. You have the right to dispute the accuracy and`,
    `completeness of any information contained in your credit report.`,
    ``,
    `If you have questions about this notice, contact ${LENDER_POLICY.lenderName}.`,
    `This notice is generated automatically by the Upstart Credit Decision API.`,
  ].join("\n");
}

function monthlyPayment(principal: number, apr: number, months: number): number {
  const r = apr / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export async function getCreditDecision(
  borrower: BorrowerInput,
): Promise<UpstartDecision> {
  // simulate API latency
  await new Promise((res) => setTimeout(res, 900));

  const applicationId = uid("upstart_app");
  const decisionedAt = new Date().toISOString();
  const risk = modelRiskScore(borrower);

  // Policy gate 1: income floor
  if (borrower.annualIncome < LENDER_POLICY.minAnnualIncome) {
    return {
      applicationId,
      status: "declined",
      modelVersion: UPSTART_MODEL_VERSION,
      policyVersion: LENDER_POLICY_VERSION,
      decisionedAt,
      riskScore: risk,
      reasons: [
        "Insufficient verifiable income to support the requested credit.",
      ],
      adverseActionNotice: buildAdverseActionNotice(borrower, [
        "Insufficient verifiable income to support the requested credit.",
      ]),
    };
  }

  // Policy gate 2: amount/income ratio
  const ratio = borrower.requestedAmount / borrower.annualIncome;
  if (ratio > LENDER_POLICY.maxAmountToIncomeRatio) {
    return {
      applicationId,
      status: "declined",
      modelVersion: UPSTART_MODEL_VERSION,
      policyVersion: LENDER_POLICY_VERSION,
      decisionedAt,
      riskScore: risk,
      reasons: [
        "Requested amount high relative to reported income.",
        "Debt-to-income exceeds lender policy threshold.",
      ],
      adverseActionNotice: buildAdverseActionNotice(borrower, [
        "Requested amount high relative to reported income.",
        "Debt-to-income exceeds lender policy threshold.",
      ]),
    };
  }

  // Manual review band: borderline risk
  if (risk >= 72 && risk < 82) {
    return {
      applicationId,
      status: "manual_review",
      riskScore: risk,
      modelVersion: UPSTART_MODEL_VERSION,
      policyVersion: LENDER_POLICY_VERSION,
      decisionedAt,
      reasons: ["Borderline risk score — routed to manual underwriting."],
    };
  }

  // Decline band: too risky
  if (risk >= 82) {
    return {
      applicationId,
      status: "declined",
      modelVersion: UPSTART_MODEL_VERSION,
      policyVersion: LENDER_POLICY_VERSION,
      decisionedAt,
      riskScore: risk,
      reasons: [
        "Modeled loss rate exceeds lender return curve.",
        "Insufficient credit history per model.",
      ],
      adverseActionNotice: buildAdverseActionNotice(borrower, [
        "Modeled loss rate exceeds lender return curve.",
        "Insufficient credit history per model.",
      ]),
    };
  }

  // Approved — price the loan off the risk score and policy caps.
  const cap = LENDER_POLICY.aprCaps[borrower.loanType];
  // base APR rises with risk, scaled to sit under the cap
  const base = 0.0599;
  const apr = Math.min(cap, base + (risk / 100) * (cap - base) + 0.02);
  const approvedAmount = Math.min(
    borrower.requestedAmount,
    LENDER_POLICY.maxLoanAmount,
  );
  const termMonths =
    approvedAmount > 25000 ? 60 : approvedAmount > 10000 ? 48 : 36;
  const lossRate = +(risk / 1000).toFixed(4); // 0.0xx
  const originationFee = +(approvedAmount * LENDER_POLICY.originationFeePercent).toFixed(2);
  const monthlyPaymentAmt = +monthlyPayment(approvedAmount, apr, termMonths).toFixed(2);

  return {
    applicationId,
    status: "approved",
    approvedAmount: +approvedAmount.toFixed(2),
    apr: +apr.toFixed(4),
    termMonths,
    monthlyPayment: monthlyPaymentAmt,
    lossRate,
    originationFee,
    riskScore: risk,
    modelVersion: UPSTART_MODEL_VERSION,
    policyVersion: LENDER_POLICY_VERSION,
    decisionedAt,
  };
}
