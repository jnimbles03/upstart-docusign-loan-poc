// GET /api/case/[caseId] — fetch the latest case state for the dashboard.
// POST /api/case/[caseId]/sign?envelopeId=... — simulate eSignature completion.

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
  const c = getCase(params.caseId);
  if (!c) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  const url = new URL(req.url);
  const envelopeId = url.searchParams.get("envelopeId");
  if (!envelopeId) {
    return NextResponse.json({ error: "envelopeId query param required." }, { status: 400 });
  }
  const updated = await signOneEnvelope(c, envelopeId);
  saveCase(updated);
  return NextResponse.json(updated);
}
