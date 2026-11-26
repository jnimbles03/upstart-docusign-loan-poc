// GET /api/case/[caseId] — fetch the latest case state for the dashboard.
// POST /api/case/[caseId]/sign?envelopeId=... — simulate eSignature completion.

import { signOneEnvelope } from "@/lib/services/orchestrator";
import { getCase, replaceCase } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { caseId: string } },
) {
  const c = getCase(params.caseId);
  if (!c) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  return NextResponse.json(c);
}

export async function POST(
  req: Request,
  { params }: { params: { caseId: string } },
) {
  const c = getCase(params.caseId);
  if (!c) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  const url = new URL(req.url);
  const envelopeId = url.searchParams.get("envelopeId");
  if (!envelopeId) {
    return NextResponse.json({ error: "envelopeId query param required." }, { status: 400 });
  }
  const target = c.envelopes.find((e) => e.envelopeId === envelopeId);
  if (!target) {
    return NextResponse.json({ error: "Envelope not found." }, { status: 404 });
  }
  // Order enforcement: the click-to-agree disclosure must be accepted first.
  const clickwrapPending = c.envelopes.some(
    (e) => e.method === "clickwrap" && e.status === "sent",
  );
  if (target.method !== "clickwrap" && clickwrapPending) {
    return NextResponse.json(
      { error: "Accept the Electronic Disclosures & E-Consent Agreement first." },
      { status: 409 },
    );
  }
  const updated = await signOneEnvelope(c, envelopeId);
  if (!replaceCase(params.caseId, c, updated)) {
    return NextResponse.json(
      { error: "Case changed while signing. Reload and retry." },
      { status: 409 },
    );
  }
  return NextResponse.json(updated);
}
