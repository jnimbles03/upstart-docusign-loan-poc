// Mock DocuSign template catalog used by the "Document Prep" step.
// In production these map to real DocuSign template IDs; here we simulate
// the conditional form selection (personal vs auto) the orchestrator performs.
// Each loan closes with exactly 2 borrower actions: one eSign document and
// one DocuSign Click–style click-to-agree disclosure.

import type { DocuSignTemplate, LoanType } from "@/lib/types";

export const TEMPLATES: DocuSignTemplate[] = [
  // Personal loan set
  {
    templateId: "tmpl_personal_note",
    name: "Personal Loan Promissory Note",
    loanType: "personal",
    method: "esign",
    description: "Unsecured promissory note with repayment schedule.",
    signers: ["Borrower", "Lender"],
  },
  {
    templateId: "tmpl_personal_econsent",
    name: "Electronic Disclosures & E-Consent Agreement",
    loanType: "personal",
    method: "clickwrap",
    description: "Click-to-agree electronic record and signature disclosure.",
    signers: ["Borrower"],
  },
  // Auto loan set
  {
    templateId: "tmpl_auto_ric",
    name: "Retail Installment Contract",
    loanType: "auto",
    method: "esign",
    description: "Motor vehicle retail installment sales contract.",
    signers: ["Borrower", "Lender"],
  },
  {
    templateId: "tmpl_auto_econsent",
    name: "Electronic Disclosures & E-Consent Agreement",
    loanType: "auto",
    method: "clickwrap",
    description: "Click-to-agree electronic record and signature disclosure.",
    signers: ["Borrower"],
  },
];

export function templatesForLoanType(loanType: LoanType): DocuSignTemplate[] {
  return TEMPLATES.filter((t) => t.loanType === loanType);
}

export function templateById(templateId: string): DocuSignTemplate | undefined {
  return TEMPLATES.find((t) => t.templateId === templateId);
}
