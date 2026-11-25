// Per-case access control. A case id is an identifier, not a secret: it appears
// in /status and /sign URLs. Only the applicant who submitted the case holds its
// access token, delivered at apply time as an HttpOnly cookie scoped to that
// case's API path, so the browser sends it automatically on same-origin calls.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getStoredCase } from "@/lib/store";
import type { LoanCase } from "@/lib/types";
import { NextResponse } from "next/server";

export const CASE_ACCESS_COOKIE = "case_access";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

export function newAccessToken(): { token: string; hash: Buffer } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

function presentedTokens(req: Request): string[] {
  const tokens: string[] = [];
  const auth = req.headers.get("authorization");
  const bearer = auth?.match(/^Bearer\s+(\S+)\s*$/i);
  if (bearer) tokens.push(bearer[1]);
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== CASE_ACCESS_COOKIE) continue;
    try {
      tokens.push(decodeURIComponent(part.slice(eq + 1).trim()));
    } catch {
      // malformed cookie value — ignore
    }
  }
  return tokens;
}

// Returns the stored case only if the request presents that case's token. The
// returned object is the one that was authorized; callers must act on it rather
// than looking the case up again.
export function authorizeCase(req: Request, caseId: string): LoanCase | null {
  const entry = getStoredCase(caseId);
  if (!entry) return null;
  for (const token of presentedTokens(req)) {
    if (timingSafeEqual(hashToken(token), entry.accessTokenHash)) {
      return entry.loanCase;
    }
  }
  return null;
}

// Same response whether the case is missing or the token is wrong, so the API
// does not reveal which case ids exist.
export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Not authorized for this case." },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}

export function setCaseAccessCookie(
  res: NextResponse,
  req: Request,
  caseId: string,
  token: string,
): void {
  const secure =
    new URL(req.url).protocol === "https:" ||
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
  res.cookies.set(CASE_ACCESS_COOKIE, token, {
    path: `/api/case/${encodeURIComponent(caseId)}`,
    httpOnly: true,
    sameSite: "strict",
    secure,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}
