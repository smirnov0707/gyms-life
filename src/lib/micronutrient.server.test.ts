import { describe, expect, it } from "vitest";
import { supplementsLine, trainingLine, type MicroSnapshot } from "./micronutrient.server";

const snapshot: MicroSnapshot = {
  days: 14,
  foodEntries: [],
  avgKcal: 2400,
  avgProtein: 160,
  supplements: [{ name: "Creatine", dose: "5 g", times_per_day: 1 }],
  profile: {
    weight: 78.6,
    height: 181,
    gender: "male",
    goal: "muscle",
    diet: "any",
    birthYear: 1990,
  },
  training: { sessions14d: 6, avgSleep: 7.1, avgReadiness: 72 },
  unreadable: [],
};

describe("micronutrient prompt lines", () => {
  it("lists what the athlete actually takes", () => {
    expect(supplementsLine(snapshot)).toBe("Creatine 5 g x1");
  });

  it("says none only when the list was read and was empty", () => {
    expect(supplementsLine({ ...snapshot, supplements: [] })).toBe("none");
  });

  it("never reports an unreadable supplement list as none", () => {
    // The prompt asks the model to weigh double-dosing risk. Told "none", it
    // recommends what the athlete is already taking — an unreadable list would
    // turn that safety check into its opposite.
    const line = supplementsLine({ ...snapshot, supplements: [], unreadable: ["supplements"] });
    expect(line).not.toBe("none");
    expect(line).toContain("COULD NOT BE READ");
    expect(line).toMatch(/do not conclude the athlete takes none/);
  });

  it("reports training only when both of its sources were read", () => {
    expect(trainingLine(snapshot)).toBe("6 sessions in 14 days, avg sleep 7.1 h, avg readiness 72");
    for (const missing of ["training sessions", "daily check-ins"]) {
      const line = trainingLine({ ...snapshot, unreadable: [missing] });
      expect(line).toBe("SOURCE COULD NOT BE READ");
      expect(line).not.toContain("0");
    }
  });
});
