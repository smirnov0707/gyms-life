import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = resolve(root, "node_modules");

const modulesStat = await lstat(modules);
if (modulesStat.isSymbolicLink())
  throw new Error("node_modules must be local to the release worktree");

for (const specifier of ["h3-v2", "@tanstack/react-start"]) {
  const entry = import.meta.resolve(specifier, new URL("../package.json", import.meta.url));
  const resolved = await realpath(fileURLToPath(entry));
  const outside = relative(root, resolved);
  if (outside.startsWith("..") || isAbsolute(outside)) {
    throw new Error(`${specifier} resolves outside the release worktree`);
  }
}

console.log("release runtime dependencies are local");
