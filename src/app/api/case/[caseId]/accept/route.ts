// POST /api/case/[caseId]/accept — borrower accepts an approved offer,
// running DocuSign document prep → workspace → multi-envelope eSign.
// Requires the case's access token (see src/lib/caseAccess.ts).

import { authorizeCase, unauthorized } from "@/lib/caseAccess";
import { runClose } from "@/lib/services/orchestrator";
import { replaceCase } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { caseId: string } },
) {
  const existing = authorizeCase(req, params.caseId);
  if (!existing) return unauthorized();
  if (!existing.decision || existing.decision.status !== "approved") {
    return NextResponse.json(
      { error: "Cannot accept an offer that was not approved." },
      { status: 409 },
    );
  }
  const updated = await runClose(existing);
  if (!replaceCase(existing, updated)) {
    return NextResponse.json(
      { error: "Case changed while accepting; reload and try again." },
      { status: 409 },
    );
  }
  return NextResponse.json(updated, { headers: { "cache-control": "no-store" } });
}
