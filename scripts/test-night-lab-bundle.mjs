import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
const root = process.cwd(),
  out = path.join(root, "test-results/night-worker-bundle");
await mkdir(out, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: [
    "netlify/functions/night-lab.mts",
    "netlify/functions/night-lab-worker-background.mts",
  ],
  outdir: out,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  metafile: true,
  tsconfig: "tsconfig.json",
  logLevel: "warning",
});
const paths = Object.keys(result.metafile.inputs);
if (
  !paths.some((p) => p.endsWith("src/lib/night-lab.server.ts")) ||
  !paths.some((p) => p.endsWith("src/lib/night-review.server.ts"))
)
  throw new Error("Canonical Night Lab code missing from background bundle");
const worker = await import(pathToFileURL(path.join(out, "night-lab-worker-background.mjs")).href);
if (worker.config.background !== true) throw new Error("Missing background mode");
const old = process.env.GYMSLIFE_CRON_SECRET;
process.env.GYMSLIFE_CRON_SECRET = "synthetic-bundle-guard-no-live-action";
try {
  const response = await worker.default(new Request("https://example.invalid", { method: "POST" }));
  if (response.status !== 401) throw new Error("Unauthorized worker invocation not denied");
} finally {
  if (old === undefined) delete process.env.GYMSLIFE_CRON_SECRET;
  else process.env.GYMSLIFE_CRON_SECRET = old;
}
await writeFile(
  path.join(out, "results.json"),
  JSON.stringify(
    {
      scope:
        "Bundle imports canonical modules and unauthorized invocation is denied; no database or live job invocation",
      canonicalModulesBundled: true,
      backgroundMode: true,
      unauthorizedStatus: 401,
    },
    null,
    2,
  ),
);
console.log("PASS canonical background bundle and no-auth guard; no live work executed");
