# AGENTS.md — Upstart × DocuSign Loan POC

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- In-memory case store (globalThis Map — shared across routes in dev) — resets on server restart

## Commands
- `npm run dev` — start dev server on :3000
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (next/core-web-vitals)
- `npm run typecheck` — `tsc --noEmit`

## Always run before finishing work
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Layout
- `src/lib/types.ts` — domain types (BorrowerInput, UpstartDecision, Envelope, LoanCase, …)
- `src/lib/config/lender.ts` — lender credit policy, pricing caps, model/policy versions
- `src/lib/config/templates.ts` — DocuSign template catalog (personal vs auto); 2 actions per loan: 1 eSign doc + 1 clickwrap disclosure
- `src/lib/services/upstart.ts` — mock Upstart Credit Decision client
- `src/lib/services/docusign.ts` — mock DocuSign doc prep / workspace / envelopes
- `src/lib/services/orchestrator.ts` — ties the steps together
- `src/lib/store.ts` — in-memory case store (on globalThis so Next dev route bundles share it) + uid()
- `src/app/demo/page.tsx` — guided demo start: Docusign App Center mock (Upstart "Featured partner" tile → ADD)
- `src/app/demo/workflow/page.tsx` — guided demo: Workflow Builder canvas (add Credit Decision step → zoom out to full flow → launch portal)
- `src/app/page.tsx` — bank portal (member dashboard, accounts, pre-qualified offer, self-service CTAs)
- `src/app/apply/page.tsx` + `src/app/apply/wizard.tsx` — DocuSign Web Form–style application (green bank header, % progress bar, section per screen, Back/Next, Powered-by-DocuSign footer) + rate-check overlay
- `src/app/status/[caseId]/page.tsx` — borrower view: Upstart offer → DocuSign Workspaces UI (Tasks/Overview/Documents/Details tabs, welcome banner + progress, stat cards, activity rail, sign tasks + DocuSign Click–style click-to-agree modal). Polls every 2.5s while envelopes await signature
- `src/app/status/[caseId]/ops/page.tsx` — ops "behind the scenes" dashboard: Workflow Builder canvas (branch chips on the decision), decision internals, Workspaces ops section, agreements table, App Center tiles, Workflow Templates gallery
- `src/app/sign/[caseId]/[envelopeId]/page.tsx` — eSign ceremony (adopt signature, required-field footer, success interstitial); iPhone user agents get a DocuSign Focused View variant (minimal chrome, single nav button, bottom-sheet adopt)
- `src/app/api/apply/route.ts` — POST submit application
- `src/app/api/case/[caseId]/route.ts` — GET case; POST sign an envelope
- `src/app/api/case/[caseId]/accept/route.ts` — POST accept offer

## Replacing mocks with real APIs
- Upstart: implement `getCreditDecision` in `src/lib/services/upstart.ts` to POST to Upstart's secure endpoint with the lender's API key, credit-policy, and return-curve config.
- DocuSign: implement `prepareDocuments`, `createWorkspace`, `createEnvelopes` in `src/lib/services/docusign.ts` against the eSignature + Workflow Builder APIs.

## Notes
- No real credit pull, no real documents generated — POC only.
- Consumer personal & auto loans only (not mortgages), matching Upstart's documented product scope.
- UI motion/tokens live in `tailwind.config.ts` (keyframes: fade-up, scale-in, pop-check, pulse-ring, shimmer, spin-slow) and `globals.css` (`.skeleton`, `.btn-*`, `.input`, `.ds-field`, `.ds-pill`).
- Brand palettes: Upstart `up.*` (#0AAF60 family), DocuSign `ds.*` (#DC2C34 family) — keep surfaces single-brand: borrower form = Upstart, dashboard/ceremony = DocuSign.
