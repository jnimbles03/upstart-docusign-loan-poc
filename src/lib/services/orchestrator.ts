// Orchestrator: runs the full on-demand underwrite flow the POC demonstrates.
// Step 1: Upstart Credit Decision
// Step 2: (declined) issue adverse action notice; skip the rest
//         (approved) borrower accepts offer
// Step 3: DocuSign Document Prep — conditional form selection + generation
// Step 4: DocuSign Workspace creation
// Step 5: Multi-envelope eSign emission to close the loan

import { isPrincipalWithinPolicy } from "@/lib/config/lender";
import {
  completeEnvelope,
  createEnvelopes,
  createWorkspace,
  prepareDocuments,
} from "@/lib/services/docusign";
import { getCreditDecision } from "@/lib/services/upstart";
import { uid } from "@/lib/store";
import type {
  BorrowerInput,
  Envelope,
  LoanCase,
  WorkflowStep,
} from "@/lib/types";

function step(
  key: string,
  label: string,
  status: WorkflowStep["status"] = "pending",
): WorkflowStep {
  return { key, label, status };
}

function mark(
  steps: WorkflowStep[],
  key: string,
  status: WorkflowStep["status"],
  detail?: string,
): WorkflowStep[] {
  const now = new Date().toISOString();
  return steps.map((s) => {
    if (s.key !== key) return s;
    const next: WorkflowStep = { ...s, status, detail: detail ?? s.detail };
    if (status === "running" && !s.startedAt) next.startedAt = now;
    if ((status === "complete" || status === "failed") && !s.completedAt)
      next.completedAt = now;
    return next;
  });
}

export function newCase(borrower: BorrowerInput): LoanCase {
  const steps: WorkflowStep[] = [
    step("idv", "Verify Someone's Identity"),
    step("decision", "Upstart Credit Decision"),
    step("offer", "Borrower Offer Acceptance"),
    step("docprep", "DocuSign Document Prep"),
    step("workspace", "DocuSign Workspace"),
    step("esign", "Multi-Envelope eSign"),
  ];
  return {
    caseId: uid("case"),
    createdAt: new Date().toISOString(),
    borrower,
    decision: null,
    offerAccepted: null,
    workspace: null,
    envelopes: [],
    steps,
  };
}

// Run steps 1-5 up to the point requiring borrower action (offer acceptance).
export async function runDecision(c: LoanCase): Promise<LoanCase> {
  // DocuSign ID Verification happens before underwriting in the apply flow.
  c = {
    ...c,
    steps: mark(
      c.steps,
      "idv",
      "complete",
      "Passed — doc authenticity + liveness + face match.",
    ),
  };
  c = { ...c, steps: mark(c.steps, "decision", "running") };

  const decision = await getCreditDecision(c.borrower);
  c.decision = decision;

  if (decision.status === "approved") {
    c = {
      ...c,
      steps: mark(
        c.steps,
        "decision",
        "complete",
        `Approved — ${decision.apr ? (decision.apr * 100).toFixed(2) : "-"}% APR, ${decision.termMonths}mo`,
      ),
    };
    c = { ...c, steps: mark(c.steps, "offer", "pending", "Awaiting borrower decision.") };
  } else if (decision.status === "declined") {
    c = {
      ...c,
      steps: mark(
        c.steps,
        "decision",
        "complete",
        `Declined — adverse action notice issued.`,
      ),
    };
    c = { ...c, steps: mark(c.steps, "offer", "skipped", "Application declined.") };
    c = { ...c, steps: mark(c.steps, "docprep", "skipped") };
    c = { ...c, steps: mark(c.steps, "workspace", "skipped") };
    c = { ...c, steps: mark(c.steps, "esign", "skipped") };
  } else {
    // manual_review
    c = {
      ...c,
      steps: mark(
        c.steps,
        "decision",
        "complete",
        "Manual review required — outside auto-decision band.",
      ),
    };
    c = { ...c, steps: mark(c.steps, "offer", "skipped", "Routed to manual underwriting.") };
    c = { ...c, steps: mark(c.steps, "docprep", "skipped") };
    c = { ...c, steps: mark(c.steps, "workspace", "skipped") };
    c = { ...c, steps: mark(c.steps, "esign", "skipped") };
  }

  return c;
}

// After borrower accepts an approved offer, run docs → workspace → envelopes.
export async function runClose(c: LoanCase): Promise<LoanCase> {
  if (!c.decision || c.decision.status !== "approved") return c;
  const decision = c.decision;
  if (!isPrincipalWithinPolicy(decision.approvedAmount)) return c;
  c = { ...c, offerAccepted: true, steps: mark(c.steps, "offer", "complete", "Accepted.") };

  c = { ...c, steps: mark(c.steps, "docprep", "running") };
  const docs = await prepareDocuments(c.borrower, decision);
  c = {
    ...c,
    steps: mark(
      c.steps,
      "docprep",
      "complete",
      `${docs.length} document(s) generated from loan-type templates.`,
    ),
  };

  c = { ...c, steps: mark(c.steps, "workspace", "running") };
  const workspace = await createWorkspace(c.borrower, docs);
  c = {
    ...c,
    workspace,
    steps: mark(
      c.steps,
      "workspace",
      "complete",
      `Workspace ${workspace.workspaceId} created.`,
    ),
  };

  c = { ...c, steps: mark(c.steps, "esign", "running") };
  const envelopes = await createEnvelopes(c.borrower, workspace, decision);
  c = {
    ...c,
    envelopes,
    steps: mark(
      c.steps,
      "esign",
      "complete",
      `${envelopes.length} envelope(s) sent for eSignature.`,
    ),
  };

  return c;
}

export async function signOneEnvelope(
  c: LoanCase,
  envelopeId: string,
): Promise<LoanCase> {
  const envelopes: Envelope[] = [];
  for (const e of c.envelopes) {
    if (e.envelopeId === envelopeId && e.status === "sent") {
      envelopes.push(await completeEnvelope(e));
    } else {
      envelopes.push(e);
    }
  }
  const allDone = envelopes.length > 0 && envelopes.every((e) => e.status === "completed");
  return {
    ...c,
    envelopes,
    steps: mark(
      c.steps,
      "esign",
      allDone ? "complete" : "running",
      `${envelopes.filter((e) => e.status === "completed").length}/${envelopes.length} envelopes completed.`,
    ),
  };
}
