// Request body helpers for route handlers. Next.js App Router applies no body
// size limit to req.json(), so handlers that accept public input read the
// stream themselves and stop at a byte cap.

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413; error: string };

export async function readJsonBody(req: Request, maxBytes: number): Promise<JsonBodyResult> {
  const tooLarge: JsonBodyResult = { ok: false, status: 413, error: "Request body too large." };

  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (!Number.isFinite(n) || n < 0) {
      await req.body?.cancel().catch(() => undefined);
      return { ok: false, status: 400, error: "Invalid Content-Length." };
    }
    if (n > maxBytes) {
      await req.body?.cancel().catch(() => undefined);
      return tooLarge;
    }
  }

  if (!req.body) return { ok: false, status: 400, error: "Invalid JSON body." };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return tooLarge;
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }
}
