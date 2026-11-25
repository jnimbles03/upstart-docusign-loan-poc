// GET /api/case/[caseId] — fetch the latest case state for the dashboard.
// POST /api/case/[caseId]/sign?envelopeId=... — simulate eSignature completion.

import { isAuthorizedForCase, tryLockCase, unlockCase } from "@/lib/auth";
import { signOneEnvelope } from "@/lib/services/orchestrator";
import { getCase, saveCase } from "@/lib/store";
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
  const caseId = params.caseId;
  if (!tryLockCase(caseId)) {
    return NextResponse.json({ error: "Case is being updated." }, { status: 409 });
  }
  try {
    if (!isAuthorizedForCase(req, caseId)) {
      return NextResponse.json({ error: "Not authorized for this case." }, { status: 401 });
    }
    const c = getCase(caseId);
    if (!c || c.caseId !== caseId) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
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
    saveCase(updated);
    return NextResponse.json(updated);
  } finally {
    unlockCase(caseId);
  }
}
