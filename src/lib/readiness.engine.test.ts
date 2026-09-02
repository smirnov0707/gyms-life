import { describe, expect, it } from "vitest";
import { adaptSets, loadModifierFor, resolveReadinessModifier } from "./readiness.engine";

describe("readiness engine", () => {
  it("maps readiness to conservative training modifiers", () => {
    expect(loadModifierFor(90)).toBe(1.05);
    expect(loadModifierFor(62)).toBe(0.9);
    expect(loadModifierFor(35)).toBe(0.65);
  });

  it("uses an unmodified plan when stored readiness is missing or invalid", () => {
    expect(resolveReadinessModifier(null)).toBe(1);
    expect(resolveReadinessModifier({ readiness_score: 101, load_modifier: 1 })).toBe(1);
    expect(resolveReadinessModifier({ readiness_score: 48, load_modifier: null })).toBe(0.8);
  });

  it("reduces sets without ever removing an exercise", () => {
    expect(adaptSets(3, 0.8)).toBe(2);
    expect(adaptSets(1, 0.65)).toBe(1);
  });
});
