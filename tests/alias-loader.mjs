// Resolves the app's `@/` imports, and package specifiers such as `next/server`
// that Node's native ESM loader will not resolve without a file extension.
// Next 14.2.5 publishes `next/server.js` and does not set `package.json` "exports".
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));

function withExtension(base) {
  const exts = [".ts", ".tsx", ".js", ".mjs", ".json"];
  for (const ext of exts) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of exts) {
    const index = path.join(base, "index" + ext);
    if (existsSync(index)) return index;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolved = withExtension(path.join(root, "src", specifier.slice(2)));
    if (!resolved) {
      throw new Error(`Cannot resolve ${specifier}`);
    }
    return { url: pathToFileURL(resolved).href, shortCircuit: true };
  }
  if (
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith("node:") &&
    !specifier.startsWith("file:")
  ) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      const resolved = require.resolve(specifier);
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
