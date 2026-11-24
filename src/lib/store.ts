// Simple in-memory case store. The POC is single-process, so process-global state
// persists across requests during a dev session. Swap for Redis/KV/DB in prod.
// NOTE: stored on globalThis because Next.js dev mode compiles each route with its
// own module graph — a plain module-level Map would not be shared across routes.

import type { LoanCase } from "@/lib/types";

const globalStore = globalThis as typeof globalThis & {
  __upstCases?: Map<string, LoanCase>;
};
if (!globalStore.__upstCases) {
  globalStore.__upstCases = new Map<string, LoanCase>();
}
const cases = globalStore.__upstCases;

// Hard cap on retained cases so unauthenticated case creation cannot grow the
// heap without bound. Map iteration order is insertion order, so re-inserting
// on save keeps the least recently saved case first in line for eviction.
export const MAX_RETAINED_CASES = 50;

export function saveCase(c: LoanCase): void {
  cases.delete(c.caseId);
  cases.set(c.caseId, c);
  while (cases.size > MAX_RETAINED_CASES) {
    const oldest = cases.keys().next().value;
    if (oldest === undefined) break;
    cases.delete(oldest);
  }
}

export function getCase(caseId: string): LoanCase | undefined {
  return cases.get(caseId);
}

export function listCases(): LoanCase[] {
  return Array.from(cases.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}
