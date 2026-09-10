import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const ENTRY_POINTS = new Set([
  "generateOrchestratedJson",
  "generateOrchestratedText",
  "transcribeOrchestratedVoice",
]);
export function collectAiCallsites(root = process.cwd()) {
  const rows = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\./.test(entry.name)) continue;
      const source = ts.createSourceFile(
        absolute,
        readFileSync(absolute, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node) {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ENTRY_POINTS.has(node.expression.text)
        ) {
          const kind = node.expression.text;
          const args = node.arguments[0];
          let task = kind === "transcribeOrchestratedVoice" ? "voice.transcription" : null;
          if (
            kind !== "transcribeOrchestratedVoice" &&
            args &&
            ts.isObjectLiteralExpression(args)
          ) {
            const property = args.properties.find(
              (p) => ts.isPropertyAssignment(p) && p.name.getText(source) === "task",
            );
            if (
              property &&
              ts.isPropertyAssignment(property) &&
              ts.isStringLiteral(property.initializer)
            )
              task = property.initializer.text;
          }
          if (!task) throw new Error(`Non-declared AI task at ${absolute}:${node.pos}`);
          rows.push({
            task,
            entryPoint: kind,
            file: path.relative(root, absolute),
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          });
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  walk(path.join(root, "src"));
  return rows.sort(
    (a, b) => a.task.localeCompare(b.task) || a.file.localeCompare(b.file) || a.line - b.line,
  );
}
export function aiInventory(root = process.cwd()) {
  const callsites = collectAiCallsites(root),
    tasks = [...new Set(callsites.map((row) => row.task))];
  return {
    scope: "Source inventory, not evidence of live provider execution or autonomous agents",
    llmTaskCount: tasks.filter((t) => t !== "voice.transcription").length,
    transcriptionAdapters: 1,
    callsiteCount: callsites.length,
    tasks: tasks.map((task) => ({ task, callsites: callsites.filter((row) => row.task === task) })),
    otherWorkers: [
      {
        name: "night_lab",
        kind: "scheduled deterministic snapshot worker",
        source: "src/lib/night-lab.server.ts",
        liveExecutionVerified: false,
      },
      {
        name: "AICoachWorker",
        kind: "provider-neutral contract extension; not a currently wired autonomous agent",
        source: "src/lib/ai-coach.worker.ts",
        liveExecutionVerified: false,
      },
    ],
    retiredUnusedTaskLabels: ["daily-readiness", "workout-structure"],
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = JSON.stringify(aiInventory(), null, 2) + "\n";
  if (process.argv[2]) writeFileSync(process.argv[2], content);
  else console.log(content);
}
