import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { verifyCommandCenter } from "./test-core-command-center.mjs";

const engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown command test engine");
const artifacts = "test-results/command-center";
await mkdir(artifacts, { recursive: true });
const server = spawn(process.execPath, ["scripts/test-core-browser.mjs", "--serve-only"], {
  stdio: ["ignore", "pipe", "pipe"],
});
const results = [],
  errors = [];
let browser,
  failure = null;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Command fixture start timed out")), 60000);
    let output = "";
    server.stdout.on("data", (chunk) => {
      output += String(chunk);
      if (output.includes("Core synthetic fixture:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));
    server.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Command fixture exited ${code}`));
    });
  });
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  await verifyCommandCenter({
    artifacts,
    record: (name) => {
      results.push({ name, status: "passed" });
      console.log("PASS", engine, name);
    },
    open: async (query, viewport) => {
      const context = await browser.newContext({
        viewport,
        locale: "en-GB",
        timezoneId: "Europe/Vilnius",
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(
        `http://127.0.0.1:${process.env.CORE_BROWSER_PORT ?? "4184"}/index.html?${query}`,
      );
      await expect(page.getByTestId("synthetic-watermark")).toBeVisible({ timeout: 30000 });
      return { page, context };
    },
  });
  if (results.length !== 5 || errors.length)
    throw new Error(`Command checks incomplete: ${JSON.stringify({ results, errors })}`);
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile(
    `${artifacts}/results.json`,
    JSON.stringify(
      {
        engine,
        results,
        errors,
        failure,
        scope:
          "Real shell with synthetic services; not real-account or physical-device acceptance.",
      },
      null,
      2,
    ),
  );
}
