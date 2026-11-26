// Spec for offer acceptance: a case that was already accepted, or that already
// has envelopes, must stay as it was. POST /api/case/:caseId/accept and
// runClose share that rule. These tests fail while acceptance rebuilds the
// workspace and replaces envelopes.
//
// Document-prep side effects are the setTimeout delays in
// prepareDocuments (700), createWorkspace (500), and createEnvelopes (800).
// A refusal that still schedules those has already started a new package.

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { POST as submitApplication } from "../src/app/api/apply/route";
import { POST as acceptOffer } from "../src/app/api/case/[caseId]/accept/route";
import { POST as signEnvelopeRoute } from "../src/app/api/case/[caseId]/route";
import { runClose } from "../src/lib/services/orchestrator";
import { getCase, saveCase } from "../src/lib/store";
import type { BorrowerInput, LoanCase } from "../src/lib/types";

const DOC_PREP_DELAYS = new Set([700, 500, 800]);

type PackageFingerprint = {
  offerAccepted: LoanCase["offerAccepted"];
  borrowerEmail: string;
  workspaceId: string | null;
  documentIds: string[];
  envelopes: Array<{
    envelopeId: string;
    documentId: string;
    method: string;
    status: string;
    completedAt: string | null;
  }>;
};

function resetStore(): void {
  const g = globalThis as typeof globalThis & {
    __upstCases?: Map<string, LoanCase>;
  };
  g.__upstCases?.clear();
}

function mustGet(caseId: string): LoanCase {
  const found = getCase(caseId);
  assert.ok(found, `case ${caseId} is missing from the store`);
  return found;
}

function fingerprint(c: LoanCase): PackageFingerprint {
  return {
    offerAccepted: c.offerAccepted,
    borrowerEmail: c.borrower.email,
    workspaceId: c.workspace?.workspaceId ?? null,
    documentIds: (c.workspace?.documents ?? []).map((d) => d.documentId),
    envelopes: c.envelopes.map((e) => ({
      envelopeId: e.envelopeId,
      documentId: e.documentId,
      method: e.method,
      status: e.status,
      completedAt: e.completedAt ?? null,
    })),
  };
}

function borrower(email: string, firstName: string): BorrowerInput {
  return {
    firstName,
    lastName: "Borrower",
    email,
    street: "1 Main St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    annualIncome: 120000,
    loanType: "personal",
    requestedAmount: 8000,
    employmentStatus: "employed",
  };
}

function installTimerSpy(): { delays: number[]; restore: () => void } {
  const delays: number[] = [];
  const original = global.setTimeout;
  global.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
    delays.push(ms ?? 0);
    return original(fn as never, ms, ...(args as never[]));
  }) as unknown as typeof global.setTimeout;
  return {
    delays,
    restore() {
      global.setTimeout = original;
    },
  };
}

function docPrepDelays(delays: number[]): number[] {
  return delays.filter((ms) => DOC_PREP_DELAYS.has(ms));
}

async function applyApproved(email: string, firstName: string): Promise<LoanCase> {
  const res = await submitApplication(
    new Request("http://127.0.0.1/api/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(borrower(email, firstName)),
    }),
  );
  const body = (await res.json()) as LoanCase & { error?: string };
  assert.equal(res.status, 201, JSON.stringify(body));
  assert.equal(body.decision?.status, "approved", JSON.stringify(body.decision));
  return mustGet(body.caseId);
}

async function postAccept(caseId: string): Promise<Response> {
  return acceptOffer(
    new Request(`http://127.0.0.1/api/case/${caseId}/accept`, { method: "POST" }),
    { params: { caseId } },
  );
}

async function signEnvelope(caseId: string, envelopeId: string): Promise<void> {
  const res = await signEnvelopeRoute(
    new Request(
      `http://127.0.0.1/api/case/${caseId}?envelopeId=${encodeURIComponent(envelopeId)}`,
      { method: "POST" },
    ),
    { params: { caseId } },
  );
  const body = (await res.json()) as { error?: string };
  assert.equal(res.status, 200, JSON.stringify(body));
}

async function signAll(caseId: string): Promise<LoanCase> {
  const clickwraps = mustGet(caseId).envelopes.filter((e) => e.method === "clickwrap");
  const esigns = mustGet(caseId).envelopes.filter((e) => e.method === "esign");
  assert.ok(clickwraps.length > 0, "loan should include a clickwrap envelope");
  assert.ok(esigns.length > 0, "loan should include an eSign envelope");
  for (const env of clickwraps) await signEnvelope(caseId, env.envelopeId);
  for (const env of esigns) await signEnvelope(caseId, env.envelopeId);
  const done = mustGet(caseId);
  assert.ok(
    done.envelopes.length > 0 && done.envelopes.every((e) => e.status === "completed"),
    "every envelope should be completed before the replay",
  );
  return done;
}

async function assertRefused(
  caseId: string,
  before: PackageFingerprint,
): Promise<void> {
  const spy = installTimerSpy();
  try {
    const res = await postAccept(caseId);
    const body = (await res.json()) as { error?: string };
    assert.equal(res.status, 409, JSON.stringify(body));
    assert.equal(typeof body.error, "string");
    assert.ok(body.error && body.error.length > 0);
    assert.deepEqual(docPrepDelays(spy.delays), []);
    assert.deepEqual(fingerprint(mustGet(caseId)), before);
  } finally {
    spy.restore();
  }
}

describe("offer accept cannot reset a loan", { concurrency: 1 }, () => {
  beforeEach(() => {
    resetStore();
  });

  test("first accept of an approved offer still prepares unsigned envelopes", async () => {
    const created = await applyApproved("ada.first@example.com", "Ada");
    const res = await postAccept(created.caseId);
    const body = (await res.json()) as LoanCase & { error?: string };
    assert.equal(res.status, 200, JSON.stringify(body));
    const stored = mustGet(created.caseId);
    assert.equal(stored.offerAccepted, true);
    assert.ok(stored.workspace);
    assert.ok(stored.envelopes.length >= 2);
    assert.ok(stored.envelopes.every((e) => e.status === "sent"));
    assert.deepEqual(fingerprint(stored), fingerprint(body));
  });

  test("re-accept after every envelope is completed keeps the signed package", async () => {
    const created = await applyApproved("ada.closed@example.com", "Ada");
    const first = await postAccept(created.caseId);
    assert.equal(first.status, 200);
    await signAll(created.caseId);
    const before = fingerprint(mustGet(created.caseId));
    assert.equal(before.offerAccepted, true);
    assert.ok(before.envelopes.every((e) => e.status === "completed" && e.completedAt));

    await assertRefused(created.caseId, before);
  });

  test("re-accept during signing keeps the original envelopes signable", async () => {
    const created = await applyApproved("ada.partial@example.com", "Ada");
    assert.equal((await postAccept(created.caseId)).status, 200);
    const clickwrap = mustGet(created.caseId).envelopes.find((e) => e.method === "clickwrap");
    const esign = mustGet(created.caseId).envelopes.find((e) => e.method === "esign");
    assert.ok(clickwrap);
    assert.ok(esign);
    await signEnvelope(created.caseId, clickwrap.envelopeId);
    const before = fingerprint(mustGet(created.caseId));
    assert.equal(
      before.envelopes.find((e) => e.envelopeId === clickwrap.envelopeId)?.status,
      "completed",
    );
    assert.equal(
      before.envelopes.find((e) => e.envelopeId === esign.envelopeId)?.status,
      "sent",
    );

    await assertRefused(created.caseId, before);

    await signEnvelope(created.caseId, esign.envelopeId);
    const after = mustGet(created.caseId);
    const signed = after.envelopes.find((e) => e.envelopeId === esign.envelopeId);
    assert.equal(signed?.status, "completed");
    assert.equal(signed?.documentId, esign.documentId);
    assert.equal(
      after.envelopes.find((e) => e.envelopeId === clickwrap.envelopeId)?.status,
      "completed",
    );
  });

  test("accept is refused when envelopes exist even if offerAccepted was cleared", async () => {
    const created = await applyApproved("ada.envelopes@example.com", "Ada");
    assert.equal((await postAccept(created.caseId)).status, 200);
    const snapshot = mustGet(created.caseId);
    saveCase({ ...snapshot, offerAccepted: null });
    const before = fingerprint(mustGet(created.caseId));
    assert.equal(before.offerAccepted, null);
    assert.ok(before.envelopes.length > 0);

    await assertRefused(created.caseId, before);
  });

  test("accept is refused when the offer was already accepted and no envelopes are stored", async () => {
    const created = await applyApproved("ada.flag@example.com", "Ada");
    saveCase({ ...mustGet(created.caseId), offerAccepted: true });
    const before = fingerprint(mustGet(created.caseId));
    assert.equal(before.offerAccepted, true);
    assert.deepEqual(before.envelopes, []);

    await assertRefused(created.caseId, before);
  });

  test("runClose does not rebuild documents for a case that already has envelopes", async () => {
    const created = await applyApproved("ada.runclose@example.com", "Ada");
    assert.equal((await postAccept(created.caseId)).status, 200);
    await signAll(created.caseId);
    const stored = mustGet(created.caseId);
    const before = fingerprint(stored);
    const spy = installTimerSpy();
    try {
      const result = await runClose(stored);
      assert.deepEqual(fingerprint(result), before);
      assert.deepEqual(fingerprint(mustGet(created.caseId)), before);
      assert.deepEqual(docPrepDelays(spy.delays), []);
    } finally {
      spy.restore();
    }
  });

  test("runClose does not build documents when the offer was already accepted", async () => {
    const created = await applyApproved("ada.runclose-flag@example.com", "Ada");
    const accepted = { ...mustGet(created.caseId), offerAccepted: true as const };
    saveCase(accepted);
    const before = fingerprint(mustGet(created.caseId));
    const spy = installTimerSpy();
    try {
      const result = await runClose(mustGet(created.caseId));
      assert.deepEqual(fingerprint(result), before);
      assert.deepEqual(fingerprint(mustGet(created.caseId)), before);
      assert.deepEqual(docPrepDelays(spy.delays), []);
    } finally {
      spy.restore();
    }
  });

  test("in-flight accept does not save over a loan that was fully signed before save", async () => {
    const created = await applyApproved("ada.race@example.com", "Ada");
    const open = structuredClone(mustGet(created.caseId));
    assert.equal((await postAccept(created.caseId)).status, 200);
    await signAll(created.caseId);
    const signed = structuredClone(mustGet(created.caseId));
    const signedPrint = fingerprint(signed);
    assert.ok(signedPrint.envelopes.every((e) => e.status === "completed"));

    // Rewind to the approved, not-yet-accepted case, then start acceptance.
    // The handler reads that case and suspends inside document prep. Replacing
    // the store before it resumes is a second close that finished and was
    // signed during that wait. The in-flight call must not save over it.
    saveCase(open);
    let settled = false;
    const pending = postAccept(created.caseId).finally(() => {
      settled = true;
    });
    assert.equal(settled, false);
    saveCase(signed);

    const res = await pending;
    const body = (await res.json()) as { error?: string };
    assert.equal(res.status, 409, JSON.stringify(body));
    assert.deepEqual(fingerprint(mustGet(created.caseId)), signedPrint);
  });

  test("accept does not document a different case loaded after the approval check", async () => {
    const ada = await applyApproved("ada.lookup@example.com", "Ada");
    const bob = await applyApproved("bob.lookup@example.com", "Bob");
    assert.equal((await postAccept(bob.caseId)).status, 200);
    await signAll(bob.caseId);
    const intruder: LoanCase = structuredClone(mustGet(bob.caseId));
    intruder.caseId = ada.caseId;
    const intruderPrint = fingerprint(intruder);
    assert.equal(intruderPrint.borrowerEmail, "bob.lookup@example.com");
    assert.ok(intruderPrint.envelopes.every((e) => e.status === "completed"));

    const authorized = mustGet(ada.caseId);
    assert.equal(authorized.offerAccepted, null);
    assert.equal(authorized.envelopes.length, 0);
    let swapped = false;
    const proxy = new Proxy(authorized, {
      get(target, prop, receiver) {
        // The approval check reads `decision`. A later lookup of this case id
        // must observe the signed loan, not the object that was just approved.
        if (prop === "decision" && !swapped) {
          swapped = true;
          saveCase(intruder);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    saveCase(proxy as LoanCase);

    const spy = installTimerSpy();
    try {
      const res = await postAccept(ada.caseId);
      const body = (await res.json()) as { error?: string };
      assert.equal(swapped, true, "the approval check should have read decision");
      assert.equal(res.status, 409, JSON.stringify(body));
      assert.deepEqual(docPrepDelays(spy.delays), []);
      assert.deepEqual(fingerprint(mustGet(ada.caseId)), intruderPrint);
    } finally {
      spy.restore();
    }
  });

  test("accept does not close a different case reloaded between the check and document creation", async () => {
    const ada = await applyApproved("ada.reload@example.com", "Ada");
    const bob = await applyApproved("bob.reload@example.com", "Bob");
    const intruder: LoanCase = structuredClone(mustGet(bob.caseId));
    intruder.caseId = ada.caseId;
    const intruderPrint = fingerprint(intruder);
    assert.equal(intruderPrint.offerAccepted, null);
    assert.deepEqual(intruderPrint.envelopes, []);
    assert.notEqual(intruderPrint.borrowerEmail, ada.borrower.email);

    const authorized = mustGet(ada.caseId);
    let swapped = false;
    const proxy = new Proxy(authorized, {
      get(target, prop, receiver) {
        if (prop === "decision" && !swapped) {
          swapped = true;
          saveCase(intruder);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    saveCase(proxy as LoanCase);

    const spy = installTimerSpy();
    try {
      const res = await postAccept(ada.caseId);
      const body = (await res.json()) as { error?: string };
      assert.equal(swapped, true, "the approval check should have read decision");
      assert.equal(res.status, 409, JSON.stringify(body));
      assert.deepEqual(docPrepDelays(spy.delays), []);
      assert.deepEqual(fingerprint(mustGet(ada.caseId)), intruderPrint);
    } finally {
      spy.restore();
    }
  });
});
