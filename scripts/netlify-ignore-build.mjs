import { execFileSync } from "node:child_process";

const context = process.env.CONTEXT ?? "";

// Keep previews and branch deploys available for review. Only production is gated.
if (context !== "production") {
  process.exit(1);
}

// Explicit local/manual release path. This must be supplied per command invocation.
if (process.env.GYMSLIFE_RELEASE === "1") {
  process.exit(1);
}

const ref = process.env.COMMIT_REF || "HEAD";
let message = "";

try {
  message = execFileSync("git", ["show", "-s", "--format=%B", ref], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch {
  // Fail closed: an unreadable production ref must not trigger a paid deploy.
  process.exit(0);
}

// A production Git deploy is allowed only when the release marker is explicit.
process.exit(message.includes("[release production]") ? 1 : 0);
