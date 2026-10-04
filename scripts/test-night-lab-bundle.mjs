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
// Hoisted beside the other witnesses: `results.json` is written after the
// `finally`, so anything declared inside the try is out of scope there.
const ledgerCalls = [];
const LEDGER_ROW_ID = "00000000-0000-0000-0000-000000000000";
const old = process.env.GYMSLIFE_CRON_SECRET;
// `createSupabaseAdminClient` reads `process.env`, not `Netlify.env`, so the
// ledger's credentials have to be set here rather than in the settings stub
// below — the first attempt at this fix put them in the wrong one and the
// error still named both variables.
const oldSupabaseUrl = process.env.SUPABASE_URL;
const oldServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.GYMSLIFE_CRON_SECRET = "synthetic-bundle-guard-no-live-action";
process.env.SUPABASE_URL = "https://yywnpovsqifwujuxdxog.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-bundle-guard-no-live-action";
try {
  const response = await worker.default(new Request("https://example.invalid", { method: "POST" }));
  if (response.status !== 401) throw new Error("Unauthorized worker invocation not denied");
  // The dispatch became a ledgered job, so it now builds a Supabase admin
  // client and writes its claim row before it dispatches anything. This stub
  // predates that and offered no service-role key, so the built scheduler threw
  // "Missing Supabase environment variable(s)" before reaching the assertion
  // this file exists for — a red check in night-review.yml that said nothing
  // about the bundle. The dispatch's ledger and this synthetic environment are
  // one decision in two files, and neither was wrong on its own.
  //
  // The key is synthetic and no request leaves the process: `fetch` below
  // answers the ledger itself, so "no database" stays true.
  const settings = {
    SUPABASE_URL: "https://yywnpovsqifwujuxdxog.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-bundle-guard-no-live-action",
    GYMSLIFE_CRON_SECRET: process.env.GYMSLIFE_CRON_SECRET,
  };
  Object.defineProperty(globalThis, "Netlify", {
    configurable: true,
    value: { env: { get: (name) => settings[name] } },
  });
  // Worker dispatches are counted apart from the ledger's own traffic. The
  // assertions below have always been about "the scheduler called the worker
  // exactly once, at the exact deploy permalink"; counting every fetch only
  // worked while the ledger made none.
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.includes(".supabase.co")) {
      ledgerCalls.push({ url, method: options.method ?? "GET" });
      // Enough PostgREST for `runBackgroundJob` to claim and close a run: a
      // select finds no earlier run, an insert and an update return their id.
      const body = (options.method ?? "GET") === "GET" ? [] : [{ id: LEDGER_ROW_ID }];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    calls.push({ url, redirect: options.redirect });
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
  // The ledger stub has to have been used, or the three assertions above
  // passed for the wrong reason: a dispatch that never recorded itself would
  // look identical here, and recording itself before it tries anything is the
  // whole point of making the dispatch a ledgered job.
  if (ledgerCalls.length === 0)
    throw new Error("Scheduler dispatched without writing its ledger claim");
  workerEnvironmentGuard = true;
} finally {
  globalThis.fetch = oldFetch;
  if (globalDescriptor) Object.defineProperty(globalThis, "Netlify", globalDescriptor);
  else delete globalThis.Netlify;
  if (old === undefined) delete process.env.GYMSLIFE_CRON_SECRET;
  else process.env.GYMSLIFE_CRON_SECRET = old;
  if (oldSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = oldSupabaseUrl;
  if (oldServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = oldServiceRole;
}
await writeFile(
  path.join(out, "results.json"),
  JSON.stringify(
    {
      scope:
        "Built canonical modules and scheduler/worker guards tested with synthetic runtime context/transport and a stubbed ledger; no database or live job invocation",
      canonicalModulesBundled: true,
      backgroundMode: true,
      unauthorizedStatus: 401,
      runtimeOriginGuard,
      workerEnvironmentGuard,
      ledgerWritesObserved: ledgerCalls.length,
    },
    null,
    2,
  ),
);
console.log("PASS canonical bundle, runtime origin and worker DB guard; no live work executed");
