/**
 * Spec for the unauthenticated POST /api/apply case store.
 *
 * These tests fail while every application is copied into the process-global
 * map with no body cap, field cap, rate limit, or eviction. They pass once
 * case creation enforces the limits below.
 *
 * Contract:
 * - Text fields are rejected when their trimmed length is greater than 200.
 *   The same cap applies to optional strings (employer, jobTitle, vehicle
 *   make/model, vin) and to values that are not JSON strings but coerce to
 *   a longer string.
 * - annualIncome must be a finite number from 1 through 100_000_000.
 * - requestedAmount must be a finite number from 1_000 through 1_000_000.
 * - Optional numeric fields, when present, must be finite and inside:
 *   yearsEmployed 0–80, additionalIncome 0–100_000_000,
 *   housingPayment 0–1_000_000, vehicleYear 1900–2100,
 *   vehicleMileage 0–2_000_000.
 * - The handler must not read more than 64 KiB of the request body. Larger
 *   bodies are rejected with 413 and no case is stored, including when the
 *   extra bytes sit in a property the borrower record does not keep.
 * - A rejected request must not leave a case in the store.
 * - At most 10 cases per client address are created per minute. Further
 *   creates from that address return 429 and are not stored. Requests with
 *   no x-forwarded-for and no x-real-ip share one address bucket. The
 *   address is the first hop in x-forwarded-for, otherwise x-real-ip.
 * - The in-memory map retains at most 50 cases. The cap is enforced inside
 *   saveCase, so concurrent apply calls and direct saveCase callers cannot
 *   leave more than 50 entries.
 *
 * Run:
 *   node --experimental-strip-types --import ./tests/register.mjs --test --test-concurrency=1 tests/unbounded-case-creation.test.ts
 *
 * POST /api/case/[caseId]/accept and POST /api/case/[caseId] (sign) call
 * saveCase for an existing id and do not take borrower fields from the
 * body. They are covered by the saveCase retention cap, not as separate
 * creation inputs.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "@/app/api/apply/route";
import { newCase } from "@/lib/services/orchestrator";
import { listCases, saveCase } from "@/lib/store";
import type { BorrowerInput } from "@/lib/types";

const MAX_FIELD_CHARS = 200;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_CREATES_PER_IP_PER_MINUTE = 10;
const MAX_RETAINED_CASES = 50;
const MAX_ANNUAL_INCOME = 100_000_000;
const MAX_REQUESTED_AMOUNT = 1_000_000;

const APPLY_URL = "http://127.0.0.1/api/apply";

let tail: Promise<void> = Promise.resolve();

function serial(name: string, fn: () => Promise<void>): void {
  test(name, { timeout: 60_000 }, () => {
    const run = tail.then(fn);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  });
}

function resetStore(): void {
  const bag = globalThis as typeof globalThis & {
    __upstCases?: Map<string, unknown>;
  };
  if (!bag.__upstCases) {
    throw new Error("expected the case map on globalThis.__upstCases");
  }
  bag.__upstCases.clear();
  assert.equal(listCases().length, 0);
}

function validBorrower(tag: string, loanType: "personal" | "auto" = "personal"): BorrowerInput {
  const borrower: BorrowerInput = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: `${tag}@example.com`,
    street: "1 Main Street",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    annualIncome: 80000,
    loanType,
    requestedAmount: 10000,
  };
  if (loanType === "auto") {
    borrower.vehicleYear = 2020;
    borrower.vehicleMake = "Honda";
    borrower.vehicleModel = "Civic";
    borrower.vin = "1HGBH41JXMN109186";
  }
  return borrower;
}

function postJson(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return POST(
    new Request(APPLY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

function client(ip: string): Record<string, string> {
  return {
    "x-forwarded-for": ip,
    "x-real-ip": ip,
  };
}

function storedFragment(fragment: string): boolean {
  return listCases().some((entry) => JSON.stringify(entry).includes(fragment));
}

async function assertRejected(
  response: Response,
  statuses: number[],
  fragment: string,
): Promise<void> {
  assert.ok(
    statuses.includes(response.status),
    `expected status ${statuses.join(" or ")}, got ${response.status}`,
  );
  const text = await response.text();
  assert.equal(text.includes(fragment), false);
  assert.equal(storedFragment(fragment), false);
}

serial("a normal unauthenticated application is stored", async () => {
  resetStore();
  const tag = `ok-${Date.now().toString(36)}`;
  const response = await postJson(validBorrower(tag), client("203.0.113.10"));
  assert.equal(response.status, 201);
  await response.text();
  const found = listCases().filter((entry) => entry.borrower.email === `${tag}@example.com`);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.borrower.firstName, "Ada");
});

serial("a 200 character field is accepted and a 201 character field is not stored", async () => {
  resetStore();
  const okTag = `len200-${Date.now().toString(36)}`;
  const okName = "N".repeat(MAX_FIELD_CHARS);
  const ok = await postJson(
    { ...validBorrower(okTag), firstName: okName },
    client("203.0.113.11"),
  );
  assert.equal(ok.status, 201);
  await ok.text();
  assert.equal(
    listCases().some((entry) => entry.borrower.email === `${okTag}@example.com`),
    true,
  );

  resetStore();
  const longName = "M".repeat(MAX_FIELD_CHARS + 1);
  const rejected = await postJson(
    { ...validBorrower(`len201-${Date.now().toString(36)}`), firstName: longName },
    client("203.0.113.12"),
  );
  await assertRejected(rejected, [400, 413], longName);
});

serial("trimmed whitespace does not hide an overlong field", async () => {
  resetStore();
  const longName = `${" ".repeat(40)}${"Q".repeat(MAX_FIELD_CHARS + 1)}${" ".repeat(40)}`;
  const response = await postJson(
    { ...validBorrower(`trim-${Date.now().toString(36)}`), firstName: longName },
    client("203.0.113.13"),
  );
  await assertRejected(response, [400, 413], "Q".repeat(MAX_FIELD_CHARS + 1));
});

serial("a non-string value that stringifies past the cap is not stored", async () => {
  resetStore();
  const longName = "R".repeat(10_000);
  const response = await postJson(
    { ...validBorrower(`arr-${Date.now().toString(36)}`), firstName: [longName] },
    client("203.0.113.14"),
  );
  await assertRejected(response, [400, 413], longName);
});

serial("every borrower text field over the cap is rejected and not stored", async () => {
  resetStore();
  const personalFields = [
    "lastName",
    "email",
    "street",
    "city",
    "state",
    "zip",
    "employer",
    "jobTitle",
  ] as const;
  const attackFields = ["street", "employer"] as const;

  const jobs: Promise<void>[] = [];
  for (const field of personalFields) {
    const size = attackFields.includes(field as (typeof attackFields)[number])
      ? 1_500_000
      : MAX_FIELD_CHARS + 1;
    const value = field === "email" ? `${"e".repeat(size - 12)}@example.com` : "S".repeat(size);
    const fragment = value.slice(0, 80);
    jobs.push(
      (async () => {
        const response = await postJson(
          { ...validBorrower(`fld-${field}-${size}`), [field]: value },
          client(`203.0.113.${20 + personalFields.indexOf(field)}`),
        );
        await assertRejected(response, [400, 413], fragment);
      })(),
    );
  }

  const autoFields = ["vehicleMake", "vehicleModel", "vin"] as const;
  for (const field of autoFields) {
    const size = field === "vin" ? 1_500_000 : MAX_FIELD_CHARS + 1;
    const value = "T".repeat(size);
    jobs.push(
      (async () => {
        const response = await postJson(
          { ...validBorrower(`auto-${field}`, "auto"), [field]: value },
          client(`198.51.100.${autoFields.indexOf(field) + 1}`),
        );
        await assertRejected(response, [400, 413], value.slice(0, 80));
      })(),
    );
  }

  const firstName = "U".repeat(1_500_000);
  jobs.push(
    (async () => {
      const response = await postJson(
        { ...validBorrower("mega-first"), firstName },
        client("198.51.100.20"),
      );
      await assertRejected(response, [400, 413], firstName.slice(0, 80));
    })(),
  );

  await Promise.all(jobs);
  assert.equal(listCases().length, 0);
});

serial("numeric fields that are not finite or in range are not stored", async () => {
  resetStore();
  const samples: Array<Record<string, unknown>> = [
    { annualIncome: -1 },
    { annualIncome: 0 },
    { annualIncome: "NaN" },
    { annualIncome: "Infinity" },
    { annualIncome: MAX_ANNUAL_INCOME + 1 },
    { requestedAmount: 999 },
    { requestedAmount: -10 },
    { requestedAmount: "NaN" },
    { requestedAmount: "Infinity" },
    { requestedAmount: MAX_REQUESTED_AMOUNT + 1 },
    { yearsEmployed: -1 },
    { yearsEmployed: 81 },
    { additionalIncome: -5 },
    { housingPayment: -1 },
    { vehicleYear: 1800 },
    { vehicleMileage: -1 },
  ];

  for (const [index, patch] of samples.entries()) {
    const tag = `num-${index}-${Date.now().toString(36)}`;
    const auto = "vehicleYear" in patch || "vehicleMileage" in patch;
    const response = await postJson(
      { ...validBorrower(tag, auto ? "auto" : "personal"), ...patch },
      client(`203.0.113.${100 + index}`),
    );
    assert.notEqual(response.status, 201, `stored invalid ${JSON.stringify(patch)}`);
    assert.ok(
      response.status === 400 || response.status === 413,
      `expected 400 or 413 for ${JSON.stringify(patch)}, got ${response.status}`,
    );
    await response.text();
    assert.equal(
      listCases().some((entry) => entry.borrower.email === `${tag}@example.com`),
      false,
      `case stored for ${JSON.stringify(patch)}`,
    );
  }
});

serial("numeric strings inside range are still accepted", async () => {
  resetStore();
  const tag = `coerce-${Date.now().toString(36)}`;
  const response = await postJson(
    {
      ...validBorrower(tag),
      annualIncome: "80000",
      requestedAmount: "10000",
    },
    client("203.0.113.90"),
  );
  assert.equal(response.status, 201);
  await response.text();
  assert.equal(
    listCases().some((entry) => entry.borrower.email === `${tag}@example.com`),
    true,
  );
});

serial("an oversized body is refused before it is fully read and is not stored", async () => {
  resetStore();
  const tag = `bulk-${Date.now().toString(36)}`;
  const padding = "B".repeat(MAX_BODY_BYTES * 3);
  const payload = JSON.stringify({ ...validBorrower(tag), padding });
  assert.ok(payload.length > MAX_BODY_BYTES);

  let pulled = 0;
  const chunkSize = 8 * 1024;
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= payload.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, payload.length);
      const chunk = new TextEncoder().encode(payload.slice(offset, end));
      offset = end;
      pulled += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });

  const response = await POST(
    new Request(APPLY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(payload.length),
        ...client("203.0.113.91"),
      },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
  );

  assert.equal(response.status, 413);
  await response.text();
  assert.ok(
    pulled <= MAX_BODY_BYTES + chunkSize,
    `handler read ${pulled} bytes; limit is ${MAX_BODY_BYTES}`,
  );
  assert.equal(
    listCases().some((entry) => entry.borrower.email === `${tag}@example.com`),
    false,
  );
  assert.equal(storedFragment(padding.slice(0, 80)), false);
});

serial("a short content-length does not allow the rest of the body to be buffered", async () => {
  resetStore();
  const tag = `lie-${Date.now().toString(36)}`;
  const padding = "D".repeat(MAX_BODY_BYTES * 3);
  const payload = JSON.stringify({ ...validBorrower(tag), padding });
  let pulled = 0;
  const chunkSize = 8 * 1024;
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= payload.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, payload.length);
      const chunk = new TextEncoder().encode(payload.slice(offset, end));
      offset = end;
      pulled += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });

  const response = await POST(
    new Request(APPLY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "1024",
        ...client("203.0.113.93"),
      },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
  );

  assert.ok(
    response.status === 413 || response.status === 400,
    `expected 413 or 400, got ${response.status}`,
  );
  await response.text();
  assert.ok(
    pulled <= MAX_BODY_BYTES + chunkSize,
    `handler read ${pulled} bytes; limit is ${MAX_BODY_BYTES}`,
  );
  assert.equal(
    listCases().some((entry) => entry.borrower.email === `${tag}@example.com`),
    false,
  );
});

serial("a chunked body with no content-length is not fully buffered", async () => {
  resetStore();
  const tag = `chunk-${Date.now().toString(36)}`;
  const padding = "C".repeat(MAX_BODY_BYTES * 3);
  const payload = JSON.stringify({ ...validBorrower(tag), padding });
  let pulled = 0;
  const chunkSize = 8 * 1024;
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= payload.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, payload.length);
      const chunk = new TextEncoder().encode(payload.slice(offset, end));
      offset = end;
      pulled += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });

  const response = await POST(
    new Request(APPLY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...client("203.0.113.92"),
      },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
  );

  assert.ok(
    response.status === 413 || response.status === 400,
    `expected 413 or 400, got ${response.status}`,
  );
  await response.text();
  assert.ok(
    pulled <= MAX_BODY_BYTES + chunkSize,
    `handler read ${pulled} bytes; limit is ${MAX_BODY_BYTES}`,
  );
  assert.equal(
    listCases().some((entry) => entry.borrower.email === `${tag}@example.com`),
    false,
  );
});

serial("one address cannot create more than 10 cases in a burst", async () => {
  resetStore();
  const ip = "203.0.113.150";
  const responses = await Promise.all(
    Array.from({ length: MAX_CREATES_PER_IP_PER_MINUTE + 15 }, (_, index) =>
      postJson(validBorrower(`rate-${index}`), client(ip)),
    ),
  );
  const statuses = responses.map((response) => response.status);
  await Promise.all(responses.map((response) => response.text()));
  const created = statuses.filter((status) => status === 201).length;
  const limited = statuses.filter((status) => status === 429).length;
  assert.ok(created <= MAX_CREATES_PER_IP_PER_MINUTE);
  assert.ok(limited >= 1);
  assert.equal(created + limited, statuses.length);
  assert.ok(listCases().length <= MAX_CREATES_PER_IP_PER_MINUTE);
});

serial("requests with no client address share one rate-limit bucket", async () => {
  resetStore();
  const responses = await Promise.all(
    Array.from({ length: MAX_CREATES_PER_IP_PER_MINUTE + 15 }, (_, index) =>
      postJson(validBorrower(`anon-${index}`)),
    ),
  );
  const statuses = responses.map((response) => response.status);
  await Promise.all(responses.map((response) => response.text()));
  const created = statuses.filter((status) => status === 201).length;
  const limited = statuses.filter((status) => status === 429).length;
  assert.ok(created <= MAX_CREATES_PER_IP_PER_MINUTE);
  assert.ok(limited >= 1);
  assert.equal(created + limited, statuses.length);
  assert.ok(listCases().length <= MAX_CREATES_PER_IP_PER_MINUTE);
});

serial("distinct addresses are limited separately until the store cap", async () => {
  resetStore();
  const perIp = MAX_CREATES_PER_IP_PER_MINUTE;
  const ips = ["192.0.2.1", "192.0.2.2"];
  const responses = await Promise.all(
    ips.flatMap((ip) =>
      Array.from({ length: perIp }, (_, index) =>
        postJson(validBorrower(`sep-${ip}-${index}`), client(ip)),
      ),
    ),
  );
  const statuses = responses.map((response) => response.status);
  await Promise.all(responses.map((response) => response.text()));
  assert.ok(statuses.every((status) => status === 201));
  assert.equal(listCases().length, ips.length * perIp);
});

serial("concurrent creates from many addresses cannot retain more than 50 cases", async () => {
  resetStore();
  const ips = Array.from({ length: 6 }, (_, index) => `192.0.2.${10 + index}`);
  const perIp = MAX_CREATES_PER_IP_PER_MINUTE + 2;
  const responses = await Promise.all(
    ips.flatMap((ip, ipIndex) =>
      Array.from({ length: perIp }, (_, index) =>
        postJson(validBorrower(`cap-${ipIndex}-${index}`), client(ip)),
      ),
    ),
  );
  await Promise.all(responses.map((response) => response.text()));
  assert.ok(listCases().length <= MAX_RETAINED_CASES);
  for (const [ipIndex, ip] of ips.entries()) {
    const mine = listCases().filter((entry) =>
      entry.borrower.email.startsWith(`cap-${ipIndex}-`),
    );
    assert.ok(
      mine.length <= MAX_CREATES_PER_IP_PER_MINUTE,
      `${ip} retained ${mine.length} cases`,
    );
  }
});

serial("saveCase itself never retains more than 50 cases", async () => {
  resetStore();
  for (let index = 0; index < MAX_RETAINED_CASES + 30; index += 1) {
    saveCase(newCase(validBorrower(`direct-${index}`)));
  }
  assert.ok(listCases().length <= MAX_RETAINED_CASES);
  assert.ok(listCases().length > 0);
});
