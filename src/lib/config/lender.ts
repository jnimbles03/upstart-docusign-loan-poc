// Lender credit policy & pricing config — mirrors what Upstart's Credit Decision API
// enforces "programmatically" per the lender's policy, fees, and return targets.

export type LenderPolicy = {
  lenderName: string;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  originationFeePercent: number;
  // simple APR caps per loan type (POC only)
  aprCaps: Record<"personal" | "auto", number>;
  // min modeled income to consider approval (POC heuristic)
  minAnnualIncome: number;
  // max DTI proxy: requested / income ratio cutoff
  maxAmountToIncomeRatio: number;
};

export const LENDER_POLICY: LenderPolicy = {
  lenderName: "Springfield Community Bank (POC)",
  minLoanAmount: 1000,
  maxLoanAmount: 50000,
  minTermMonths: 12,
  maxTermMonths: 60,
  originationFeePercent: 0.05,
  aprCaps: {
    personal: 0.3599,
    auto: 0.2199,
  },
  minAnnualIncome: 12000,
  maxAmountToIncomeRatio: 0.5,
};

export function isPrincipalWithinPolicy(amount: unknown): amount is number {
  return (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount >= LENDER_POLICY.minLoanAmount &&
    amount <= LENDER_POLICY.maxLoanAmount
  );
}

export function isValidAnnualIncome(income: unknown): income is number {
  return typeof income === "number" && Number.isFinite(income) && income >= 0;
}

export const UPSTART_MODEL_VERSION = "upstart-cd-v2.4-poc";
export const LENDER_POLICY_VERSION = "policy-2026-q3-poc";
