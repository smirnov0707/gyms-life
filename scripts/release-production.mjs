import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseArgs } from "node:util";
import { PRODUCTION_SITE, runProductionRelease } from "./production-release.mjs";

const exec = promisify(execFile);
try {
  const { values } = parseArgs({
    options: { deploy: { type: "boolean", default: false }, "expected-sha": { type: "string" } },
    strict: true,
    allowPositionals: false,
  });
  if (values.deploy && process.env.DEPLOY_TARGET && process.env.DEPLOY_TARGET !== "netlify")
    throw new Error("Unexpected deployment target");
  const report = await runProductionRelease(
    { deploy: values.deploy, expectedSha: values["expected-sha"] },
    {
      command: async (file, args, { production }) => {
        const { stdout } = await exec(file, args, {
          shell: false,
          timeout: production || file === "npm" ? 900000 : 90000,
          maxBuffer: 32 * 1024 * 1024,
          env: {
            ...process.env,
            CI: "true",
            NETLIFY_SITE_ID: PRODUCTION_SITE,
            ...(production ? { CONTEXT: "production", GYMSLIFE_RELEASE: "1" } : {}),
          },
        });
        return stdout;
      },
    },
  );
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
} catch {
  console.error("RELEASE_ARGUMENTS_OR_ENVIRONMENT_INVALID");
  process.exitCode = 1;
}
