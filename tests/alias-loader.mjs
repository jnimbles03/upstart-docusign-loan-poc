import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const srcRoot = fileURLToPath(new URL("../src/", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(srcRoot, specifier.slice(2));
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      path.join(base, "index.ts"),
    ];
    const hit = candidates.find((candidate) => existsSync(candidate));
    if (!hit) {
      throw new Error(`Cannot resolve ${specifier}`);
    }
    return nextResolve(pathToFileURL(hit).href, context);
  }
  if (
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith("node:") &&
    !specifier.startsWith("file:")
  ) {
    try {
      const resolved = require.resolve(specifier);
      return {
        url: pathToFileURL(resolved).href,
        shortCircuit: true,
        format: "commonjs",
      };
    } catch {
      // Let Node report the original specifier.
    }
  }
  return nextResolve(specifier, context);
}
