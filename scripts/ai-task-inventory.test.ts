import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { aiInventory, collectAiCallsites } from "./ai-task-inventory.mjs";
import { EXECUTABLE_AI_TASKS, isVisionTask } from "../src/lib/ai-orchestrator.server";
import { AI_TASK_CONTEXT_SCOPE } from "../src/lib/ai-task-context";
describe("the AI feature map must match executable source", () => {
  it("has neither a routed task with no caller nor a caller missing routing/privacy scope", () => {
    const tasks = [...new Set(collectAiCallsites().map((row) => row.task))]
      .filter((task) => task !== "voice.transcription")
      .sort();
    expect(tasks).toEqual([...EXECUTABLE_AI_TASKS].sort());
    expect(tasks).toEqual(Object.keys(AI_TASK_CONTEXT_SCOPE).sort());
    expect(EXECUTABLE_AI_TASKS).toHaveLength(24);
    expect(EXECUTABLE_AI_TASKS.filter(isVisionTask)).toHaveLength(5);
  });
  it("keeps the published inventory generated from the current sources", () => {
    expect(JSON.parse(readFileSync("docs/AI_FEATURE_INVENTORY_20260909.json", "utf8"))).toEqual(
      aiInventory(),
    );
  });
  it("contains only the one live text-chat route and the separate voice adapter", () => {
    const entries = collectAiCallsites();
    expect(
      entries.filter((e) => e.entryPoint === "generateOrchestratedText").map((e) => e.task),
    ).toEqual(["coach.ask"]);
    expect(entries.filter((e) => e.entryPoint === "transcribeOrchestratedVoice")).toHaveLength(1);
  });
});
