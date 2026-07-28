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

export function saveCase(c: LoanCase): void {
  cases.set(c.caseId, c);
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
