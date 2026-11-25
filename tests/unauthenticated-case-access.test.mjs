/**
 * Spec: a case id in the URL is not authorization to read or change that case.
 *
 * These tests fail while GET/POST /api/case/:caseId and POST /api/case/:caseId/accept
 * return or mutate the stored application for any caller who knows the case id.
 * They pass once those handlers require a credential issued only to the applicant
 * who created the case, and that credential authorizes only that case.
 *
 * Credential the applicant receives from POST /api/apply (any one of these):
 *   - response header X-Case-Access-Token
 *   - JSON field accessToken (not stored on the case, not equal to caseId)
 *   - Set-Cookie case_access=<token>
 * The token is at least 32 URL-safe characters ([A-Za-z0-9_-]), is not the case
 * id, and is not the SHA-256 of the case id. Later requests send it as
 * Authorization: Bearer <token> or Cookie: case_access=<token>.
 * Missing, wrong, or another case's token → 401 or 403, no borrower fields,
 * and no change to offerAccepted or envelope status.
 *
 * Run:
 *   npm run build
 *   node --test tests/unauthenticated-case-access.test.mjs
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

let server;
let base;

function uniqueTag() {
  return randomBytes(6).toString("hex");
}

function borrower(tag) {
  return {
    firstName: `Ada${tag}`,
    lastName: `Lark${tag}`,
    email: `ada.${tag}@example.test`,
    street: `${tag} Secret Avenue`,
    city: "Springfield",
    state: "IL",
    zip: "62704",
    annualIncome: 86413,
    loanType: "auto",
    requestedAmount: 12000,
    employmentStatus: "employed",
    employer: `Employer${tag}`,
    jobTitle: "Analyst",
    yearsEmployed: 4,
    vehicleYear: 2021,
    vehicleMake: "Honda",
    vehicleModel: "Civic",
    vehicleMileage: 18000,
    vin: `WVW${tag}MARK`.toUpperCase(),
  };
}

function markers(person) {
  return [
    person.firstName,
    person.lastName,
    person.email,
    person.street,
    person.employer,
    person.vin.toUpperCase(),
    String(person.annualIncome),
  ];
}

function leaked(text, person) {
  return markers(person).filter((marker) => text.includes(marker));
}

function extractToken(response, body) {
  const header = response.headers.get("x-case-access-token");
  if (header && header.trim()) return header.trim();
  if (body && typeof body.accessToken === "string" && body.accessToken.trim()) {
    return body.accessToken.trim();
  }
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  for (const cookie of cookies) {
    const match = cookie.match(/(?:^|;\s*)case_access=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

function assertTokenShape(token, caseId) {
  assert.match(token, /^[A-Za-z0-9_-]{32,}$/);
  assert.notEqual(token, caseId);
  assert.equal(token.includes(caseId), false);
  const digest = createHash("sha256").update(caseId);
  assert.notEqual(token, digest.copy().digest("hex"));
  assert.notEqual(token, digest.copy().digest("base64url"));
}

function ownerHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    cookie: `case_access=${encodeURIComponent(token)}`,
  };
}

async function submit(person) {
  const response = await fetch(`${base}/api/apply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(person),
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  assert.equal(
    response.status,
    201,
    `apply failed: ${response.status} ${text.slice(0, 400)}`,
  );
  assert.equal(typeof body?.caseId, "string");
  return {
    person,
    response,
    body,
    caseId: body.caseId,
    token: extractToken(response, body),
  };
}

function requireToken(created) {
  assert.ok(
    created.token,
    "POST /api/apply must issue a per-case access token (X-Case-Access-Token, JSON accessToken, or Set-Cookie case_access). The case id is not that token.",
  );
  assertTokenShape(created.token, created.caseId);
  return created.token;
}

async function assertDenied(response, person) {
  const text = await response.text();
  assert.ok(
    response.status === 401 || response.status === 403,
    `expected 401 or 403, got ${response.status}: ${text.slice(0, 800)}`,
  );
  const hits = leaked(text, person);
  assert.deepEqual(hits, [], `unauthorized response contained ${hits.join(", ")}`);
  return text;
}

async function readOwned(caseId, token) {
  const response = await fetch(`${base}/api/case/${encodeURIComponent(caseId)}`, {
    headers: ownerHeaders(token),
  });
  const text = await response.text();
  assert.equal(response.status, 200, text.slice(0, 500));
  return JSON.parse(text);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production" },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  server.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });
  const deadline = Date.now() + 30_000;
  let lastError = "no response";
  while (Date.now() < deadline) {
    if (server.exitCode != null) {
      throw new Error(`next start exited ${server.exitCode}\n${logs}`);
    }
    try {
      const response = await fetch(`${base}/api/case/server-ready-probe`);
      if (response.status > 0) {
        await response.arrayBuffer();
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`timed out waiting for next start (${lastError})\n${logs}`);
});

after(() => {
  if (!server?.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
});

test("GET /api/case/:caseId without credentials does not return the application", async () => {
  const created = await submit(borrower(uniqueTag()));
  const response = await fetch(`${base}/api/case/${encodeURIComponent(created.caseId)}`);
  await assertDenied(response, created.person);
});

test("presenting the case id as a bearer token or cookie does not authorize a read", async () => {
  const created = await submit(borrower(uniqueTag()));
  const response = await fetch(`${base}/api/case/${encodeURIComponent(created.caseId)}`, {
    headers: {
      authorization: `Bearer ${created.caseId}`,
      cookie: `case_access=${created.caseId}`,
    },
  });
  await assertDenied(response, created.person);
});

test("an unrelated bearer token does not authorize a read", async () => {
  const created = await submit(borrower(uniqueTag()));
  const response = await fetch(`${base}/api/case/${encodeURIComponent(created.caseId)}`, {
    headers: {
      authorization: `Bearer ${randomBytes(32).toString("base64url")}`,
    },
  });
  await assertDenied(response, created.person);
});

test("POST /api/case/:caseId without credentials does not return the application", async () => {
  const created = await submit(borrower(uniqueTag()));
  const response = await fetch(
    `${base}/api/case/${encodeURIComponent(created.caseId)}?envelopeId=env_not_issued`,
    { method: "POST" },
  );
  await assertDenied(response, created.person);
});

test("POST /api/case/:caseId/accept without credentials does not accept or return the application", async () => {
  const created = await submit(borrower(uniqueTag()));
  const response = await fetch(`${base}/api/case/${encodeURIComponent(created.caseId)}/accept`, {
    method: "POST",
  });
  const text = await assertDenied(response, created.person);
  assert.equal(text.includes('"offerAccepted":true'), false);
});

test("the applicant's credential reads only that case", async () => {
  const alice = await submit(borrower(uniqueTag()));
  const bob = await submit(borrower(uniqueTag()));
  const aliceToken = requireToken(alice);
  const bobToken = requireToken(bob);

  const aliceView = await readOwned(alice.caseId, aliceToken);
  assert.equal(aliceView.borrower.email, alice.person.email);
  assert.equal(aliceView.caseId, alice.caseId);

  const crossed = await fetch(`${base}/api/case/${encodeURIComponent(bob.caseId)}`, {
    headers: ownerHeaders(aliceToken),
  });
  await assertDenied(crossed, bob.person);

  const bobView = await readOwned(bob.caseId, bobToken);
  assert.equal(bobView.borrower.email, bob.person.email);
  assert.equal(bobView.offerAccepted, null);
});

test("accept and sign act only on the case the credential was issued for", async () => {
  const owner = await submit(borrower(uniqueTag()));
  const other = await submit(borrower(uniqueTag()));
  const ownerToken = requireToken(owner);
  const otherToken = requireToken(other);

  const before = await readOwned(owner.caseId, ownerToken);
  assert.equal(before.decision?.status, "approved");
  assert.equal(before.offerAccepted, null);
  assert.deepEqual(before.envelopes, []);

  const anonymousAccept = await fetch(
    `${base}/api/case/${encodeURIComponent(owner.caseId)}/accept`,
    { method: "POST" },
  );
  await assertDenied(anonymousAccept, owner.person);

  const crossedAccept = await fetch(
    `${base}/api/case/${encodeURIComponent(owner.caseId)}/accept`,
    { method: "POST", headers: ownerHeaders(otherToken) },
  );
  await assertDenied(crossedAccept, owner.person);

  const afterDeniedAccept = await readOwned(owner.caseId, ownerToken);
  assert.equal(afterDeniedAccept.offerAccepted, null);
  assert.deepEqual(afterDeniedAccept.envelopes, []);

  const accepted = await fetch(`${base}/api/case/${encodeURIComponent(owner.caseId)}/accept`, {
    method: "POST",
    headers: ownerHeaders(ownerToken),
  });
  assert.equal(accepted.status, 200);
  const acceptedBody = await accepted.json();
  const clickwrap = acceptedBody.envelopes.find((envelope) => envelope.method === "clickwrap");
  assert.ok(clickwrap, "owner accept should create the clickwrap envelope");
  assert.equal(clickwrap.status, "sent");

  const anonymousSign = await fetch(
    `${base}/api/case/${encodeURIComponent(owner.caseId)}?envelopeId=${encodeURIComponent(clickwrap.envelopeId)}`,
    { method: "POST" },
  );
  await assertDenied(anonymousSign, owner.person);

  const crossedSign = await fetch(
    `${base}/api/case/${encodeURIComponent(owner.caseId)}?envelopeId=${encodeURIComponent(clickwrap.envelopeId)}`,
    { method: "POST", headers: ownerHeaders(otherToken) },
  );
  await assertDenied(crossedSign, owner.person);

  const afterDeniedSign = await readOwned(owner.caseId, ownerToken);
  const stillSent = afterDeniedSign.envelopes.find(
    (envelope) => envelope.envelopeId === clickwrap.envelopeId,
  );
  assert.equal(stillSent?.status, "sent");
  assert.equal(afterDeniedSign.offerAccepted, true);
});
