// GET /api/case/[caseId] — fetch the latest case state for the dashboard.
// POST /api/case/[caseId]/sign?envelopeId=... — simulate eSignature completion.
// Both require the case's access token (see src/lib/caseAccess.ts).

import { authorizeCase, unauthorized } from "@/lib/caseAccess";
import { signOneEnvelope } from "@/lib/services/orchestrator";
import { replaceCase } from "@/lib/store";
import { NextResponse } from "next/server";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(
  req: Request,
  { params }: { params: { caseId: string } },
) {
  const c = authorizeCase(req, params.caseId);
  if (!c) return unauthorized();
  return NextResponse.json(c, { headers: NO_STORE });
}

export async function POST(
  req: Request,
  { params }: { params: { caseId: string } },
) {
  const c = authorizeCase(req, params.caseId);
  if (!c) return unauthorized();
  const url = new URL(req.url);
  const envelopeId = url.searchParams.get("envelopeId");
  if (!envelopeId) {
    return NextResponse.json({ error: "envelopeId query param required." }, { status: 400 });
  }
  // Order enforcement: the click-to-agree disclosure must be accepted first.
  const target = c.envelopes.find((e) => e.envelopeId === envelopeId);
  const clickwrapPending = c.envelopes.some(
    (e) => e.method === "clickwrap" && e.status === "sent",
  );
  if (target && target.method !== "clickwrap" && clickwrapPending) {
    return NextResponse.json(
      { error: "Accept the Electronic Disclosures & E-Consent Agreement first." },
      { status: 409 },
    );
  }
  const updated = await signOneEnvelope(c, envelopeId);
  if (!replaceCase(c, updated)) {
    return NextResponse.json(
      { error: "Case changed while signing; reload and try again." },
      { status: 409 },
    );
  }
  return NextResponse.json(updated, { headers: NO_STORE });
}
