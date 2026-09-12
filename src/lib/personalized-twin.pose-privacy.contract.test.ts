import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { personalizedTwinPosePrivacyGate } from "./personalized-twin.pose-privacy";

const RUNTIME_SOURCE = readFileSync(
  new URL("./personalized-twin.pose-runtime.ts", import.meta.url),
  "utf8",
);

describe("Personalized Twin pose runtime privacy contract", () => {
  it("stays fail-closed while the runtime has external MediaPipe dependencies", () => {
    const hasExternalRuntime = /cdn\.jsdelivr\.net|storage\.googleapis\.com/.test(RUNTIME_SOURCE);
    const usesMediaPipeTasks = RUNTIME_SOURCE.includes("@mediapipe/tasks-vision");

    expect(hasExternalRuntime).toBe(true);
    expect(usesMediaPipeTasks).toBe(true);
    expect(personalizedTwinPosePrivacyGate().allowed).toBe(false);
  });
});
