/** Real patched dependency APIs, synthetic files only; never deploys or reads app secrets. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createIPX, ipxFSStorage } from "ipx";
import { zipFunctions } from "@netlify/zip-it-and-ship-it";

const resolve = createRequire(import.meta.url).resolve;
const run = promisify(execFile);
const scratch = () => mkdtemp(path.join(tmpdir(), "gyms-dependency-smoke-"));
const consumerImport = async (consumer, dependency) => {
  const file = createRequire(resolve(consumer)).resolve(dependency);
  return import(pathToFileURL(file).href);
};
const syntheticImage = (sharp) =>
  sharp({
    create: { width: 16, height: 8, channels: 4, background: { r: 70, g: 90, b: 120, alpha: 1 } },
  });
for (const consumer of ["ipx", "miniflare", "ndarray-pixels"]) {
  test(`${consumer} resolves the patched Sharp/libheif and processes AVIF`, async () => {
    const { default: sharp } = await consumerImport(consumer, "sharp");
    assert.equal(sharp.versions.sharp, "0.35.5");
    assert.equal(sharp.versions.heif, "1.23.5");
    console.log("PATCHED_NATIVE_LIBRARIES", consumer, JSON.stringify(sharp.versions));
    assert.equal(sharp.versions.rsvg, "2.63.2");
    const input = await syntheticImage(sharp).avif().toBuffer();
    const output = await sharp(input).resize(8, 4).png().toBuffer();
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, 8);
    assert.equal(metadata.height, 4);
    assert.equal(metadata.format, "png");
  });
}

test("existing IPX 3 API still resizes and converts with the patched native module", async () => {
  const directory = await scratch();
  try {
    const { default: sharp } = await consumerImport("ipx", "sharp");
    await syntheticImage(sharp).png().toFile(path.join(directory, "input.png"));
    const ipx = createIPX({ storage: ipxFSStorage({ dir: directory }) });
    const output = await ipx("input.png", { w: "8", f: "webp" }).process();
    assert.equal(output.format, "webp");
    const metadata = await sharp(Buffer.from(output.data)).metadata();
    assert.equal(metadata.width, 8);
    assert.equal(metadata.height, 4);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("Netlify's resolved TOML parser reads the project build configuration", async () => {
  const { default: toml } = await consumerImport("@netlify/zip-it-and-ship-it", "toml");
  const config = toml.parse(await readFile("netlify.toml", "utf8"));
  assert.equal(typeof config.build.command, "string");
  assert(config.build.command.includes("build"));
  assert.equal(typeof config.build.publish, "string");
});

test("updated Netlify bundler packages a synthetic function", { timeout: 30000 }, async () => {
  const directory = await scratch();
  try {
    const source = path.join(directory, "functions");
    const output = path.join(directory, "bundles");
    await mkdir(source);
    await writeFile(
      path.join(source, "security-smoke.mjs"),
      'export default async () => new Response("synthetic function");\n',
    );
    const results = await zipFunctions(source, output, {
      basePath: directory,
      repositoryRoot: directory,
      config: { "*": { nodeBundler: "esbuild" } },
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, "security-smoke");
    const bytes = await readFile(results[0].path);
    assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test(
  "the retained Wrangler compiles an isolated Worker without deploying",
  { timeout: 45000 },
  async () => {
    const directory = await scratch();
    try {
      await writeFile(
        path.join(directory, "worker.mjs"),
        'export default { fetch() { return new Response("synthetic worker"); } };\n',
      );
      const config = path.join(directory, "wrangler.json");
      await writeFile(
        config,
        JSON.stringify({
          name: "gyms-security-smoke",
          main: "worker.mjs",
          compatibility_date: "2026-08-01",
        }),
      );
      const { stdout } = await run(
        process.execPath,
        [
          resolve("wrangler"),
          "deploy",
          "--dry-run",
          "--config",
          config,
          "--outdir",
          path.join(directory, "out"),
        ],
        {
          cwd: directory,
          timeout: 35000,
          maxBuffer: 1024 * 1024,
          // Do not inherit app secrets, a real deployment config, or login state.
          env: {
            PATH: process.env.PATH ?? "",
            HOME: directory,
            TMPDIR: directory,
            CI: "true",
            WRANGLER_SEND_METRICS: "false",
            WRANGLER_LOG_PATH: path.join(directory, "wrangler.log"),
          },
        },
      );
      assert.match(stdout, /dry-run/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

for (const consumer of ["ipx", "miniflare", "ndarray-pixels"]) {
  test(`${consumer} renders a benign SVG with the patched librsvg`, async () => {
    const { default: sharp } = await consumerImport(consumer, "sharp");
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><rect width="24" height="12" fill="#4682b4"/></svg>',
    );
    const output = await sharp(svg).resize(12, 6).png().toBuffer();
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, 12);
    assert.equal(metadata.height, 6);
    assert.equal(metadata.format, "png");
  });
}
test(
  "Wrangler resolves the patched smol-toml and preserves configuration values",
  { timeout: 10000 },
  async () => {
    const { parse } = await consumerImport("wrangler", "smol-toml");
    const config = parse(await readFile("netlify.toml", "utf8"));
    assert.equal(typeof config.build.command, "string");
    assert.equal(typeof config.build.publish, "string");
    const document = Array.from({ length: 4096 }, (_, i) => `key${i} = ${i}`).join("\n");
    const parsed = parse(document);
    assert.equal(Object.keys(parsed).length, 4096);
    assert.equal(parsed.key0, 0);
    assert.equal(parsed.key4095, 4095);
  },
);

test(
  "Wrangler consumes patched TOML objects while packaging an isolated Worker",
  { timeout: 45000 },
  async () => {
    const directory = await scratch();
    try {
      await writeFile(
        path.join(directory, "worker.mjs"),
        "export default { fetch(request, env) { return new Response(env.SECURITY_CHECK); } };\n",
      );
      const config = path.join(directory, "wrangler.toml");
      await writeFile(
        config,
        [
          'name = "gyms-security-toml-smoke"',
          'main = "worker.mjs"',
          'compatibility_date = "2026-08-01"',
          "[vars]",
          'SECURITY_CHECK = "synthetic-config-only"',
        ].join("\n") + "\n",
      );
      const { parse } = await consumerImport("wrangler", "smol-toml");
      const parsed = parse(await readFile(config, "utf8"));
      assert.equal(Object.getPrototypeOf(parsed), null);
      assert.equal(parsed.vars.SECURITY_CHECK, "synthetic-config-only");
      const { stdout } = await run(
        process.execPath,
        [
          resolve("wrangler"),
          "deploy",
          "--dry-run",
          "--config",
          config,
          "--outdir",
          path.join(directory, "out"),
        ],
        {
          cwd: directory,
          timeout: 35000,
          maxBuffer: 1024 * 1024,
          env: {
            PATH: process.env.PATH ?? "",
            HOME: directory,
            TMPDIR: directory,
            CI: "true",
            WRANGLER_SEND_METRICS: "false",
            WRANGLER_LOG_PATH: path.join(directory, "wrangler.log"),
          },
        },
      );
      assert.match(stdout, /dry-run/i);
      assert.match(stdout, /SECURITY_CHECK/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
