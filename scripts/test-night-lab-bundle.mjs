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
const scheduled = await import(pathToFileURL(path.join(out, "night-lab.mjs")).href);
const globalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Netlify"),
  oldFetch = globalThis.fetch;
let runtimeOriginGuard = false,
  workerEnvironmentGuard = false;
const old = process.env.GYMSLIFE_CRON_SECRET;
process.env.GYMSLIFE_CRON_SECRET = "synthetic-bundle-guard-no-live-action";
try {
  const response = await worker.default(new Request("https://example.invalid", { method: "POST" }));
  if (response.status !== 401) throw new Error("Unauthorized worker invocation not denied");
  const settings = {
    SUPABASE_URL: "https://yywnpovsqifwujuxdxog.supabase.co",
    GYMSLIFE_CRON_SECRET: process.env.GYMSLIFE_CRON_SECRET,
  };
  Object.defineProperty(globalThis, "Netlify", {
    configurable: true,
    value: { env: { get: (name) => settings[name] } },
  });
  const calls = [];
  globalThis.fetch = async (input, options) => {
    calls.push({ url: String(input), redirect: options.redirect });
    return new Response(null, { status: 202 });
  };
  const context = {
    deploy: { id: "aaaaaaaaaaaaaaaaaaaaaaaa", context: "deploy-preview", published: false },
    site: { name: "synthetic-site", url: "https://gyms.life" },
  };
  const queued = await scheduled.default(new Request("https://untrusted.example"), context);
  if (
    queued.status !== 202 ||
    calls.length !== 1 ||
    calls[0].url !==
      "https://aaaaaaaaaaaaaaaaaaaaaaaa--synthetic-site.netlify.app/.netlify/functions/night-lab-worker-background" ||
    calls[0].redirect !== "error"
  )
    throw new Error("Built scheduler did not use exact runtime deployment");
  let denied = false;
  try {
    await scheduled.default(new Request("https://untrusted.example"), undefined);
  } catch (error) {
    denied = error.message === "NIGHT_LAB_DISPATCH_UNAVAILABLE";
  }
  if (!denied || calls.length !== 1)
    throw new Error("Missing runtime context fell back to an external URL");
  runtimeOriginGuard = true;
  settings.SUPABASE_URL = "https://tqwqbjkjqzusohxdzupr.supabase.co";
  denied = false;
  try {
    await worker.default(
      new Request("https://example.invalid", {
        method: "POST",
        headers: { authorization: `Bearer ${settings.GYMSLIFE_CRON_SECRET}` },
      }),
      context,
    );
  } catch (error) {
    denied = error.message === "NIGHT_LAB_ENVIRONMENT_UNSAFE";
  }
  if (!denied || calls.length !== 1)
    throw new Error("Built worker accepted a cross-environment database");
  workerEnvironmentGuard = true;
} finally {
  globalThis.fetch = oldFetch;
  if (globalDescriptor) Object.defineProperty(globalThis, "Netlify", globalDescriptor);
  else delete globalThis.Netlify;
  if (old === undefined) delete process.env.GYMSLIFE_CRON_SECRET;
  else process.env.GYMSLIFE_CRON_SECRET = old;
}
await writeFile(
  path.join(out, "results.json"),
  JSON.stringify(
    {
      scope:
        "Built canonical modules and scheduler/worker guards tested with synthetic runtime context/transport; no database or live job invocation",
      canonicalModulesBundled: true,
      backgroundMode: true,
      unauthorizedStatus: 401,
      runtimeOriginGuard,
      workerEnvironmentGuard,
    },
    null,
    2,
  ),
);
console.log("PASS canonical bundle, runtime origin and worker DB guard; no live work executed");
