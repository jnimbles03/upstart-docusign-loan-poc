// POST /api/case/[caseId]/accept — borrower accepts an approved offer,
// running DocuSign document prep → workspace → multi-envelope eSign.

import { isPrincipalWithinPolicy } from "@/lib/config/lender";
import { runClose } from "@/lib/services/orchestrator";
import { getCase, saveCase } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: { caseId: string } },
) {
  const existing = getCase(params.caseId);
  if (!existing) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  if (!existing.decision || existing.decision.status !== "approved") {
    return NextResponse.json(
      { error: "Cannot accept an offer that was not approved." },
      { status: 409 },
    );
  }
  if (!isPrincipalWithinPolicy(existing.decision.approvedAmount)) {
    return NextResponse.json(
      { error: "Approved amount is outside lender policy." },
      { status: 409 },
    );
  }
  const updated = await runClose(existing);
  saveCase(updated);
  return NextResponse.json(updated);
}
