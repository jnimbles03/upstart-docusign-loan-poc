// POST /api/case/[caseId]/accept — borrower accepts an approved offer,
// running DocuSign document prep → workspace → multi-envelope eSign.

import { isAuthorizedForCase, tryLockCase, unlockCase } from "@/lib/auth";
import { runClose } from "@/lib/services/orchestrator";
import { getCase, saveCase } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { caseId: string } },
) {
  const caseId = params.caseId;
  if (!tryLockCase(caseId)) {
    return NextResponse.json({ error: "Case is being updated." }, { status: 409 });
  }
  try {
    if (!isAuthorizedForCase(req, caseId)) {
      return NextResponse.json({ error: "Not authorized for this case." }, { status: 401 });
    }
    const existing = getCase(caseId);
    if (!existing || existing.caseId !== caseId) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
    if (!existing.decision || existing.decision.status !== "approved") {
      return NextResponse.json(
        { error: "Cannot accept an offer that was not approved." },
        { status: 409 },
      );
    }
    if (existing.offerAccepted) {
      return NextResponse.json({ error: "Offer already accepted." }, { status: 409 });
    }
    const updated = await runClose(existing);
    saveCase(updated);
    return NextResponse.json(updated);
  } finally {
    unlockCase(caseId);
  }
}
