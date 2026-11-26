// POST /api/case/[caseId]/accept — borrower accepts an approved offer,
// running DocuSign document prep → workspace → multi-envelope eSign.

import {
  closeRefusal,
  markOfferAccepted,
  runClose,
} from "@/lib/services/orchestrator";
import { getCase, replaceCase } from "@/lib/store";
import { NextResponse } from "next/server";

function conflict(error: string) {
  return NextResponse.json({ error }, { status: 409 });
}

export async function POST(
  _req: Request,
  { params }: { params: { caseId: string } },
) {
  const caseId = params.caseId;
  const authorized = getCase(caseId);
  if (!authorized) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  const refusal = closeRefusal(authorized);
  if (refusal === "not_approved") {
    return conflict("Cannot accept an offer that was not approved.");
  }
  if (refusal === "already_accepted") {
    return conflict("Offer already accepted.");
  }

  // Claim the exact case that passed the check before any document prep
  // starts; if the store no longer holds it, nothing is built or saved.
  const claim = markOfferAccepted(authorized);
  if (!replaceCase(caseId, authorized, claim)) {
    return conflict("Case changed while accepting the offer. Reload and retry.");
  }

  let closed;
  try {
    closed = await runClose(authorized);
  } catch (err) {
    replaceCase(caseId, claim, authorized);
    throw err;
  }
  if (!replaceCase(caseId, claim, closed)) {
    return conflict("Case changed while accepting the offer. Reload and retry.");
  }
  return NextResponse.json(closed);
}
