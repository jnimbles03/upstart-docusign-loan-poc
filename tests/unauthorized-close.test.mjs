// Spec for the offer-accept and envelope-complete handlers.
//
// These tests fail while a caller who knows only a case id can accept that
// applicant's offer and mark the case's envelopes completed. They pass once
// both mutations require a credential bound to that case.
//
// Contract:
// - POST /api/apply issues a case-bound credential on the Response it returns:
//   JSON `accessToken` (string, at least 16 characters, not the case id)
//   and/or a Set-Cookie header whose value is not the case id.
// - GET /api/case/:caseId must not echo that credential.
// - POST /api/case/:caseId/accept and POST /api/case/:caseId?envelopeId=
//   must send `Authorization: Bearer <accessToken>` and/or that cookie.
// - The credential authorizes only the case it was issued for. A different
//   case id in the path, query, or body is not acted on.
// - The record read for the authorization decision is the record that is
//   updated. A later read of the same id must not replace it.
// - Clickwrap still has to be completed before an eSign envelope.
//
// Run:
//   node --experimental-strip-types --import ./tests/register-loader.mjs --test --test-concurrency=1 tests/unauthorized-close.test.mjs

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { POST as applyPost } from "../src/app/api/apply/route.ts";
import { GET as caseGet, POST as casePost } from "../src/app/api/case/[caseId]/route.ts";
import { POST as acceptPost } from "../src/app/api/case/[caseId]/accept/route.ts";
import { runClose } from "../src/lib/services/orchestrator.ts";
import { getCase } from "../src/lib/store.ts";

const MIN_TOKEN_LENGTH = 16;

function store() {
  const map = globalThis.__upstCases;
  if (!map) throw new Error("case store was not initialized");
  return map;
}

function resetStore() {
  store().clear();
}

function view(c) {
  if (!c) return null;
  const clone = structuredClone(c);
  if (Object.prototype.hasOwnProperty.call(clone, "accessToken")) {
    clone.accessToken = "[redacted]";
  }
  return clone;
}

function borrower(email, loanType = "personal") {
  const input = {
    firstName: "Casey",
    lastName: "Borrower",
    email,
    street: "1 Main St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    annualIncome: 120000,
    loanType,
    requestedAmount: 8000,
  };
  if (loanType === "auto") {
    input.vehicleYear = 2020;
    input.vehicleMake = "Honda";
    input.vehicleModel = "Civic";
    input.vehicleMileage = 32000;
    input.vin = "1HGBH41JXMN109186";
  }
  return input;
}

async function submitApplication(email, loanType = "personal") {
  const res = await applyPost(
    new Request("http://loan.local/api/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(borrower(email, loanType)),
    }),
  );
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.decision && body.decision.status, "approved");
  assert.equal(typeof body.caseId, "string");
  return { res, body, caseId: body.caseId, email };
}

function cookieHeaders(res) {
  const raw =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return raw.map((entry) => entry.split(";")[0]).filter((pair) => pair.includes("="));
}

function credentialFrom(applyRes, body) {
  const token = typeof body.accessToken === "string" ? body.accessToken : "";
  const cookies = cookieHeaders(applyRes);
  return { token, cookies };
}

function assertIssuedCredential(cred, caseId) {
  const cookieValues = cred.cookies.map((pair) => pair.slice(pair.indexOf("=") + 1));
  const hasToken = cred.token.length >= MIN_TOKEN_LENGTH && cred.token !== caseId;
  const hasCookie = cookieValues.some((value) => value.length >= MIN_TOKEN_LENGTH && value !== caseId);
  if (!hasToken && !hasCookie) {
    throw new Error(
      "POST /api/apply must issue a case-bound credential (JSON accessToken and/or Set-Cookie) that is not the case id",
    );
  }
  return cred;
}

function authHeaders(cred) {
  const headers = {};
  if (cred && cred.token) headers.authorization = `Bearer ${cred.token}`;
  if (cred && cred.cookies.length > 0) headers.cookie = cred.cookies.join("; ");
  return headers;
}

function acceptRequest(caseId, cred, extra = {}) {
  const url = new URL(`http://loan.local/api/case/${encodeURIComponent(caseId)}/accept`);
  if (extra.queryCaseId) url.searchParams.set("caseId", extra.queryCaseId);
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(cred),
    },
    body: JSON.stringify(extra.body ?? {}),
  });
}

async function accept(caseId, cred, extra) {
  const res = await acceptPost(acceptRequest(caseId, cred, extra), {
    params: { caseId },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function signRequest(caseId, envelopeId, cred) {
  const url = new URL(`http://loan.local/api/case/${encodeURIComponent(caseId)}`);
  url.searchParams.set("envelopeId", envelopeId);
  return new Request(url, { method: "POST", headers: authHeaders(cred) });
}

async function sign(caseId, envelopeId, cred) {
  const res = await casePost(signRequest(caseId, envelopeId, cred), {
    params: { caseId },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function assertRejected(status) {
  assert.ok(
    status === 401 || status === 403,
    `expected 401 or 403, got ${status}`,
  );
}

function closed(c) {
  return (
    !!c &&
    c.offerAccepted === true &&
    c.envelopes.length > 0 &&
    c.envelopes.every((e) => e.status === "completed")
  );
}

// First read of caseId returns the stored record. Every later read returns
// `decoy`, so a handler that authorizes one object and then loads the case
// again will mutate the decoy.
function armSecondLookup(caseId, decoy) {
  const map = store();
  const orig = map.get;
  let seen = false;
  map.get = function (key) {
    if (key === caseId) {
      if (!seen) {
        seen = true;
        return orig.call(map, key);
      }
      return decoy;
    }
    return orig.call(map, key);
  };
  return () => {
    map.get = orig;
  };
}

describe("unauthenticated loan close", { concurrency: 1 }, () => {
  beforeEach(() => {
    resetStore();
  });

  test("knowing the case id does not accept an approved offer", async () => {
    const { caseId } = await submitApplication("victim@example.com");
    const before = view(getCase(caseId));
    assert.equal(before.offerAccepted, null);
    assert.deepEqual(before.envelopes, []);

    const res = await accept(caseId, null);
    assertRejected(res.status);
    assert.deepEqual(view(getCase(caseId)), before);
    assert.equal(closed(getCase(caseId)), false);
  });

  test("case id, email, and application id are not accept credentials", async () => {
    const { caseId, body } = await submitApplication("victim@example.com");
    const guesses = [caseId, body.borrower.email, body.decision.applicationId];
    for (const guess of guesses) {
      resetStore();
      const again = await submitApplication("victim@example.com");
      const before = view(getCase(again.caseId));
      const res = await accept(again.caseId, { token: guess, cookies: [] });
      assertRejected(res.status);
      assert.deepEqual(view(getCase(again.caseId)), before);
    }
  });

  test("an unauthenticated caller cannot complete clickwrap or esign envelopes", async () => {
    const { caseId } = await submitApplication("victim@example.com", "auto");
    const prepared = await runClose(getCase(caseId));
    store().set(caseId, prepared);
    const before = view(getCase(caseId));
    const clickwrap = prepared.envelopes.find((e) => e.method === "clickwrap");
    const esign = prepared.envelopes.find((e) => e.method === "esign");
    assert.ok(clickwrap);
    assert.ok(esign);

    const click = await sign(caseId, clickwrap.envelopeId, null);
    assertRejected(click.status);
    assert.equal(getCase(caseId).envelopes.find((e) => e.envelopeId === clickwrap.envelopeId).status, "sent");

    const signed = await sign(caseId, esign.envelopeId, null);
    assertRejected(signed.status);
    assert.deepEqual(view(getCase(caseId)), before);
    assert.equal(
      getCase(caseId).envelopes.every((e) => e.status === "completed"),
      false,
    );
  });

  test("envelope id and signer email are not sign credentials", async () => {
    const { caseId, body } = await submitApplication("victim@example.com");
    const prepared = await runClose(getCase(caseId));
    store().set(caseId, prepared);
    const clickwrap = prepared.envelopes.find((e) => e.method === "clickwrap");
    const before = view(getCase(caseId));
    const guesses = [clickwrap.envelopeId, body.borrower.email, caseId];
    for (const guess of guesses) {
      const res = await sign(caseId, clickwrap.envelopeId, { token: guess, cookies: [] });
      assertRejected(res.status);
      assert.deepEqual(view(getCase(caseId)), before);
    }
  });

  test("a credential for one applicant does not accept or sign another applicant", async () => {
    const a = await submitApplication("a@example.com");
    const b = await submitApplication("b@example.com");
    const credA = credentialFrom(a.res, a.body);
    const presented =
      credA.token || credA.cookies.length > 0
        ? credA
        : { token: "placeholder-not-a-credential", cookies: [] };
    const preparedB = await runClose(getCase(b.caseId));
    store().set(b.caseId, preparedB);
    const beforeA = view(getCase(a.caseId));
    const beforeB = view(getCase(b.caseId));
    const clickwrap = preparedB.envelopes.find((e) => e.method === "clickwrap");

    const accepted = await accept(b.caseId, presented);
    assertRejected(accepted.status);
    assert.deepEqual(view(getCase(b.caseId)), beforeB);
    assert.deepEqual(view(getCase(a.caseId)), beforeA);

    const signed = await sign(b.caseId, clickwrap.envelopeId, presented);
    assertRejected(signed.status);
    assert.deepEqual(view(getCase(b.caseId)), beforeB);
    assert.equal(getCase(b.caseId).envelopes.every((e) => e.status === "sent"), true);
  });

  test("query and body case ids cannot move an accept onto a different case", async () => {
    const a = await submitApplication("a@example.com");
    const b = await submitApplication("b@example.com");
    const credA = credentialFrom(a.res, a.body);
    const presented =
      credA.token || credA.cookies.length > 0
        ? credA
        : { token: "placeholder-not-a-credential", cookies: [] };
    const beforeA = view(getCase(a.caseId));
    const beforeB = view(getCase(b.caseId));

    const byQuery = await accept(b.caseId, presented, { queryCaseId: a.caseId });
    assertRejected(byQuery.status);
    assert.deepEqual(view(getCase(a.caseId)), beforeA);
    assert.deepEqual(view(getCase(b.caseId)), beforeB);

    const byBody = await accept(b.caseId, presented, { body: { caseId: a.caseId } });
    assertRejected(byBody.status);
    assert.deepEqual(view(getCase(a.caseId)), beforeA);
    assert.deepEqual(view(getCase(b.caseId)), beforeB);
  });

  test("signing one case does not complete another case's envelope", async () => {
    const a = await submitApplication("a@example.com");
    const b = await submitApplication("b@example.com");
    for (const id of [a.caseId, b.caseId]) {
      store().set(id, await runClose(getCase(id)));
    }
    const credA = credentialFrom(a.res, a.body);
    const presented =
      credA.token || credA.cookies.length > 0
        ? credA
        : { token: "placeholder-not-a-credential", cookies: [] };
    const envB = getCase(b.caseId).envelopes.find((e) => e.method === "clickwrap");
    const beforeB = view(getCase(b.caseId));

    const res = await sign(a.caseId, envB.envelopeId, presented);
    assert.equal(getCase(b.caseId).envelopes.find((e) => e.envelopeId === envB.envelopeId).status, "sent");
    assert.deepEqual(view(getCase(b.caseId)), beforeB);
    if (!credA.token && credA.cookies.length === 0) {
      assertRejected(res.status);
      assert.equal(getCase(a.caseId).envelopes.every((e) => e.status === "sent"), true);
    }
  });

  test("eSign stays uncompleted while the clickwrap envelope is still sent", async () => {
    const { caseId } = await submitApplication("victim@example.com");
    store().set(caseId, await runClose(getCase(caseId)));
    const esign = getCase(caseId).envelopes.find((e) => e.method === "esign");
    const before = view(getCase(caseId));
    const res = await sign(caseId, esign.envelopeId, null);
    assert.ok(res.status === 401 || res.status === 403 || res.status === 409);
    assert.equal(getCase(caseId).envelopes.find((e) => e.envelopeId === esign.envelopeId).status, "sent");
    assert.deepEqual(view(getCase(caseId)), before);
  });

  test("the applicant who holds the issued credential can close only that loan", async () => {
    const owner = await submitApplication("owner@example.com");
    const other = await submitApplication("other@example.com");
    const cred = assertIssuedCredential(credentialFrom(owner.res, owner.body), owner.caseId);

    const fetched = await caseGet(new Request(`http://loan.local/api/case/${owner.caseId}`), {
      params: { caseId: owner.caseId },
    });
    const fetchedBody = await fetched.json();
    const raw = JSON.stringify(fetchedBody);
    if (cred.token && raw.includes(cred.token)) {
      throw new Error("GET /api/case/:caseId returned the accept credential");
    }
    for (const pair of cred.cookies) {
      const value = pair.slice(pair.indexOf("=") + 1);
      if (value && raw.includes(value)) {
        throw new Error("GET /api/case/:caseId returned the accept credential");
      }
    }

    const otherBefore = view(getCase(other.caseId));
    const accepted = await accept(owner.caseId, cred, { body: { caseId: other.caseId } });
    assert.equal(accepted.status, 200);
    assert.equal(getCase(owner.caseId).offerAccepted, true);
    assert.equal(getCase(owner.caseId).envelopes.length, 2);
    assert.ok(getCase(owner.caseId).envelopes.every((e) => e.status === "sent"));
    assert.deepEqual(view(getCase(other.caseId)), otherBefore);

    const clickwrap = getCase(owner.caseId).envelopes.find((e) => e.method === "clickwrap");
    const esign = getCase(owner.caseId).envelopes.find((e) => e.method === "esign");
    const early = await sign(owner.caseId, esign.envelopeId, cred);
    assert.equal(early.status, 409);
    assert.equal(getCase(owner.caseId).envelopes.find((e) => e.envelopeId === esign.envelopeId).status, "sent");

    const agreed = await sign(owner.caseId, clickwrap.envelopeId, cred);
    assert.equal(agreed.status, 200);
    assert.equal(
      getCase(owner.caseId).envelopes.find((e) => e.envelopeId === clickwrap.envelopeId).status,
      "completed",
    );
    assert.equal(getCase(owner.caseId).envelopes.find((e) => e.envelopeId === esign.envelopeId).status, "sent");

    const signed = await sign(owner.caseId, esign.envelopeId, cred);
    assert.equal(signed.status, 200);
    assert.equal(closed(getCase(owner.caseId)), true);
    assert.deepEqual(view(getCase(other.caseId)), otherBefore);

    const stolen = await accept(other.caseId, cred);
    assertRejected(stolen.status);
    assert.deepEqual(view(getCase(other.caseId)), otherBefore);
  });

  test("accept updates the case that was authorized, not a case loaded later", async () => {
    const owner = await submitApplication("owner@example.com");
    const cred = assertIssuedCredential(credentialFrom(owner.res, owner.body), owner.caseId);
    const decoy = structuredClone(getCase(owner.caseId));
    decoy.borrower = {
      ...decoy.borrower,
      email: "decoy@example.com",
      firstName: "Decoy",
    };
    decoy.offerAccepted = null;
    decoy.envelopes = [];
    const restore = armSecondLookup(owner.caseId, decoy);
    let status = 0;
    try {
      status = (await accept(owner.caseId, cred)).status;
    } finally {
      restore();
    }
    assert.equal(status, 200);
    const saved = getCase(owner.caseId);
    assert.equal(saved.borrower.email, "owner@example.com");
    assert.notEqual(saved.borrower.email, "decoy@example.com");
    assert.equal(saved.offerAccepted, true);
    assert.ok(saved.envelopes.every((e) => e.status === "sent"));
  });

  test("sign updates the authorized envelope, not an envelope loaded later", async () => {
    const owner = await submitApplication("owner@example.com");
    const cred = assertIssuedCredential(credentialFrom(owner.res, owner.body), owner.caseId);
    store().set(owner.caseId, await runClose(getCase(owner.caseId)));
    const real = getCase(owner.caseId);
    const clickwrap = real.envelopes.find((e) => e.method === "clickwrap");
    const decoy = structuredClone(real);
    decoy.borrower = { ...decoy.borrower, email: "decoy@example.com" };
    decoy.envelopes = decoy.envelopes.map((e) => ({
      ...e,
      envelopeId: `decoy-${e.envelopeId}`,
      status: "sent",
    }));
    const restore = armSecondLookup(owner.caseId, decoy);
    let status = 0;
    try {
      status = (await sign(owner.caseId, clickwrap.envelopeId, cred)).status;
    } finally {
      restore();
    }
    assert.equal(status, 200);
    const saved = getCase(owner.caseId);
    assert.equal(saved.borrower.email, "owner@example.com");
    assert.equal(saved.envelopes.find((e) => e.envelopeId === clickwrap.envelopeId).status, "completed");
    assert.equal(saved.envelopes.some((e) => e.envelopeId.startsWith("decoy-")), false);
    const esign = saved.envelopes.find((e) => e.method === "esign");
    assert.equal(esign.status, "sent");
  });
});
