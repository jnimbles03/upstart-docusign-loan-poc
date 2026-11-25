// Simple in-memory case store. The POC is single-process, so process-global state
// persists across requests during a dev session. Swap for Redis/KV/DB in prod.
// NOTE: stored on globalThis because Next.js dev mode compiles each route with its
// own module graph — a plain module-level Map would not be shared across routes.

import { randomBytes } from "node:crypto";
import type { LoanCase } from "@/lib/types";

interface StoredCase {
  loanCase: LoanCase;
  // SHA-256 of the applicant's access token. Kept outside LoanCase so it is
  // never serialized into an API response.
  accessTokenHash: Buffer;
}

const globalStore = globalThis as typeof globalThis & {
  __upstCases?: Map<string, StoredCase>;
};
if (!globalStore.__upstCases) {
  globalStore.__upstCases = new Map<string, StoredCase>();
}
const cases = globalStore.__upstCases;

export function insertCase(c: LoanCase, accessTokenHash: Buffer): boolean {
  if (cases.has(c.caseId)) return false;
  cases.set(c.caseId, { loanCase: c, accessTokenHash });
  return true;
}

export function getStoredCase(
  caseId: string,
): Readonly<StoredCase> | undefined {
  return cases.get(caseId);
}

// Compare-and-swap: only replaces the case if it is still the exact object the
// caller was authorized for, so a concurrent write is never silently clobbered.
export function replaceCase(expected: LoanCase, updated: LoanCase): boolean {
  const entry = cases.get(expected.caseId);
  if (!entry || entry.loanCase !== expected || updated.caseId !== expected.caseId) {
    return false;
  }
  entry.loanCase = updated;
  return true;
}

export function uid(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("base64url")}`;
}
