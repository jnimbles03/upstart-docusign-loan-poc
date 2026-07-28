# Upstart × DocuSign — On-Demand Loan Underwriting POC

A Next.js (App Router, TypeScript) proof of concept showing **Upstart's Credit
Decision API** running as an app called into a DocuSign workflow to on-demand
underwrite and close **consumer personal and auto loans** (not mortgages).

## Flow

1. **Self-service borrower webform** (`/`) — name, address, income, loan type,
   requested amount (+ vehicle details for auto loans).
2. **Upstart Credit Decision** (mocked) — instant AI decision with APR, term,
   amount, modeled loss rate; or a decline with an auto-generated adverse
   action notice; or manual review for borderline risk.
3. **Borrower offer acceptance** — if approved, the borrower accepts the offer.
4. **DocuSign Document Prep** (mocked) — conditional form selection and
   document generation based on loan type:
   - Personal: Promissory Note, Loan Agreement, TILA Disclosure.
   - Auto: Retail Installment Contract, Title Lien/Security Agreement, Odometer
     Disclosure.
5. **DocuSign Workspace** (mocked) — workspace created with the prepared docs.
6. **Multi-envelope eSign** (mocked) — one envelope per document sent for
   eSignature; the dashboard lets you simulate signing each, and the loan is
   "closed" when all envelopes are completed.

The dashboard at `/status/[caseId]` shows the full workflow stepper, the
decision/offer, the generated document previews, the workspace, and the
envelopes with sign-status.

## Everything is mocked

Both Upstart and DocuSign are behind clean service interfaces in
`src/lib/services/`. Swap the mock implementations for real API clients
(Upstart secure endpoint with your lender API key; DocuSign eSignature + Workflow
Builder APIs) without touching the UI or orchestrator.

See `AGENTS.md` for run/typecheck/lint commands.

## Why personal/auto only

Per the Upstart Credit Decision API announcement, the model decisioning covers
**auto, personal, and student loans** — not mortgages. This POC scopes to
personal and auto.

## Run

```bash
npm install
npm run dev
# open http://localhost:3000
```
