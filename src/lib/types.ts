// Central domain types for the Upstart x DocuSign loan origination POC.

export type LoanType = "personal" | "auto";

export type BorrowerInput = {
  firstName: string;
  lastName: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  annualIncome: number;
  loanType: LoanType;
  requestedAmount: number;
  // auto-only
  vehicleYear?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleMileage?: number;
  vin?: string;
};

export type UpstartDecisionStatus = "approved" | "declined" | "manual_review";

export type UpstartDecision = {
  applicationId: string;
  status: UpstartDecisionStatus;
  // approved terms
  approvedAmount?: number;
  apr?: number;
  termMonths?: number;
  monthlyPayment?: number;
  lossRate?: number; // modeled default/loss rate
  originationFee?: number;
  // decision metadata
  riskScore?: number; // 0-100, higher = riskier
  modelVersion: string;
  policyVersion: string;
  decisionedAt: string; // ISO
  reasons?: string[]; // adverse-action reasons (declined)
  adverseActionNotice?: string; // rendered notice text (declined)
};

export type EnvelopeMethod = "esign" | "clickwrap";

export type DocuSignTemplate = {
  templateId: string;
  name: string;
  loanType: LoanType;
  method: EnvelopeMethod;
  description: string;
  signers: string[];
};

export type PreparedDocument = {
  documentId: string;
  name: string;
  templateId: string;
  format: "pdf";
  sizeBytes: number;
  generatedAt: string;
  // mock rendered preview (plain text representation of generated doc)
  preview: string;
};

export type DocuSignWorkspace = {
  workspaceId: string;
  name: string;
  caseId: string;
  createdAt: string;
  documents: PreparedDocument[];
};

export type EnvelopeSigner = {
  name: string;
  email: string;
  role: string;
};

export type EnvelopeStatus = "sent" | "delivered" | "completed" | "declined";

export type Envelope = {
  envelopeId: string;
  name: string;
  documentId: string;
  method: EnvelopeMethod; // esign = signing ceremony; clickwrap = click-to-agree
  signers: EnvelopeSigner[];
  status: EnvelopeStatus;
  sentAt: string;
  completedAt?: string;
  signingUrl: string; // mock eSign URL
};

export type WorkflowStepStatus = "pending" | "running" | "complete" | "failed" | "skipped";

export type WorkflowStep = {
  key: string;
  label: string;
  status: WorkflowStepStatus;
  startedAt?: string;
  completedAt?: string;
  detail?: string;
};

// The full case that flows through the orchestrator and is shown on the dashboard.
export type LoanCase = {
  caseId: string;
  createdAt: string;
  borrower: BorrowerInput;
  decision: UpstartDecision | null;
  offerAccepted: boolean | null;
  workspace: DocuSignWorkspace | null;
  envelopes: Envelope[];
  steps: WorkflowStep[];
};
