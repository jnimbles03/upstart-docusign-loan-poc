// Mock DocuSign client for: Document Prep (conditional form selection + doc
// generation), Workspaces, and multi-envelope eSign emission. In production
// these map to the DocuSign eSignature API + Workflow Builder API.

import { templateById, templatesForLoanType } from "@/lib/config/templates";
import { uid } from "@/lib/store";
import type {
  BorrowerInput,
  DocuSignWorkspace,
  Envelope,
  PreparedDocument,
  UpstartDecision,
} from "@/lib/types";

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// --- Document Prep: pick templates for the loan type, then "generate" docs ---
export async function prepareDocuments(
  borrower: BorrowerInput,
  decision: UpstartDecision,
): Promise<PreparedDocument[]> {
  await new Promise((res) => setTimeout(res, 700));

  if (decision.status !== "approved") return [];

  const templates = templatesForLoanType(borrower.loanType);
  const borrowerName = `${borrower.firstName} ${borrower.lastName}`;

  return templates.map((t) => {
    const preview = renderPreview(t.name, borrower, decision);
    return {
      documentId: uid("doc"),
      name: t.name,
      templateId: t.templateId,
      format: "pdf" as const,
      sizeBytes: Math.floor(40000 + Math.random() * 120000),
      generatedAt: new Date().toISOString(),
      preview,
    };
  });

  function renderPreview(
    name: string,
    b: BorrowerInput,
    d: UpstartDecision,
  ): string {
    const lines: string[] = [];
    lines.push(`# ${name}`);
    lines.push(`Lender: Springfield Community Bank (POC)`);
    lines.push(`Borrower: ${borrowerName}`);
    lines.push(`Address: ${b.street}, ${b.city}, ${b.state} ${b.zip}`);
    lines.push(`Loan Type: ${b.loanType.toUpperCase()}`);
    lines.push(`-----------------------------`);
    if (d.status === "approved" && d.apr !== undefined) {
      lines.push(`Principal: ${fmtMoney(d.approvedAmount ?? 0)}`);
      lines.push(`APR: ${(d.apr * 100).toFixed(2)}%`);
      lines.push(`Term: ${d.termMonths} months`);
      lines.push(`Monthly Payment: ${fmtMoney(d.monthlyPayment ?? 0)}`);
      lines.push(`Origination Fee: ${fmtMoney(d.originationFee ?? 0)}`);
      lines.push(`Modeled Loss Rate: ${((d.lossRate ?? 0) * 100).toFixed(2)}%`);
      lines.push(`Risk Score: ${d.riskScore}/100`);
    }
    if (b.loanType === "auto") {
      lines.push(`-----------------------------`);
      lines.push(`Vehicle: ${b.vehicleYear ?? ""} ${b.vehicleMake ?? ""} ${b.vehicleModel ?? ""}`);
      lines.push(`VIN: ${b.vin ?? "N/A"}`);
      lines.push(`Odometer: ${(b.vehicleMileage ?? 0).toLocaleString()} mi`);
    }
    lines.push(`-----------------------------`);
    lines.push(`Generated ${new Date().toISOString()} via DocuSign Document Prep (mock).`);
    return lines.join("\n");
  }
}

// --- Workspaces: create a workspace and attach the prepared docs ---
export async function createWorkspace(
  borrower: BorrowerInput,
  documents: PreparedDocument[],
): Promise<DocuSignWorkspace> {
  await new Promise((res) => setTimeout(res, 500));
  return {
    workspaceId: uid("ws"),
    name: `Loan — ${borrower.firstName} ${borrower.lastName}`,
    caseId: uid("case"),
    createdAt: new Date().toISOString(),
    documents,
  };
}

// --- eSign: emit one envelope per prepared document ---
export async function createEnvelopes(
  borrower: BorrowerInput,
  workspace: DocuSignWorkspace,
  decision: UpstartDecision,
): Promise<Envelope[]> {
  await new Promise((res) => setTimeout(res, 800));

  const borrowerSigner = {
    name: `${borrower.firstName} ${borrower.lastName}`,
    email: borrower.email,
    role: "Borrower",
  };
  const lenderSigner = {
    name: "Springfield Community Bank",
    email: "lending@springfieldbank.example",
    role: "Lender",
  };

  return workspace.documents.map((doc, idx) => {
    const method = templateById(doc.templateId)?.method ?? "esign";
    // click-to-agree disclosures only need the borrower's click; signature
    // documents route to borrower + lender countersignature
    const signers =
      method === "clickwrap" ? [borrowerSigner] : [borrowerSigner, lenderSigner];
    return {
      envelopeId: uid("env"),
      name: doc.name,
      documentId: doc.documentId,
      method,
      signers,
      status: "sent",
      sentAt: new Date().toISOString(),
      signingUrl: `/sign/${uid("sign")}?env=${idx}`,
    } satisfies Envelope;
  });
}

// --- eSign simulation: mark an envelope completed ---
export async function completeEnvelope(env: Envelope): Promise<Envelope> {
  await new Promise((res) => setTimeout(res, 400));
  return {
    ...env,
    status: "completed",
    completedAt: new Date().toISOString(),
  };
}
