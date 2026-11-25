// Borrower credential for a case. POST /api/apply issues a random token as an
// HttpOnly cookie scoped to /api/case/<caseId>; only its SHA-256 digest is kept,
// outside the LoanCase record, so GET /api/case/:caseId never returns it.
// Mutating routes hold a per-case lock from the authorization check until the
// updated case is saved, so the authorized record is the one that is written.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const globalAuth = globalThis as typeof globalThis & {
  __upstCaseCredentials?: Map<string, Buffer>;
  __upstCaseLocks?: Set<string>;
};
if (!globalAuth.__upstCaseCredentials) {
  globalAuth.__upstCaseCredentials = new Map<string, Buffer>();
}
if (!globalAuth.__upstCaseLocks) {
  globalAuth.__upstCaseLocks = new Set<string>();
}
const credentials = globalAuth.__upstCaseCredentials;
const locks = globalAuth.__upstCaseLocks;

function digest(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

function cookieName(caseId: string): string {
  return `upst_case_${caseId}`;
}

export function issueCaseCredential(caseId: string): string {
  const token = randomBytes(32).toString("base64url");
  credentials.set(caseId, digest(token));
  return token;
}

export function credentialCookie(caseId: string, token: string): string {
  const attrs = [
    `${cookieName(caseId)}=${token}`,
    `Path=/api/case/${encodeURIComponent(caseId)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=86400",
  ];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return attrs.join("; ");
}

function presentedToken(req: Request, caseId: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const name = cookieName(caseId);
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return part.slice(eq + 1).trim();
    }
  }
  return null;
}

export function isAuthorizedForCase(req: Request, caseId: string): boolean {
  const expected = credentials.get(caseId);
  const token = presentedToken(req, caseId);
  if (!expected || !token) return false;
  return timingSafeEqual(digest(token), expected);
}

export function tryLockCase(caseId: string): boolean {
  if (locks.has(caseId)) return false;
  locks.add(caseId);
  return true;
}

export function unlockCase(caseId: string): void {
  locks.delete(caseId);
}
