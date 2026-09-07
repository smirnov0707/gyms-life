import { describe, expect, it } from "vitest";
import {
  bodyProvenanceNote,
  nutritionProvenanceNote,
  statsToPrompt,
  type ReportStats,
} from "./medical-report.server";

describe("nutritionProvenanceNote", () => {
  it("says nothing was logged when nothing was", () => {
    expect(nutritionProvenanceNote({ photo: 0, text: 0, unrecorded: 0 })).toBe("no meals logged");
  });

  it("counts each capture method it actually saw", () => {
    const note = nutritionProvenanceNote({ photo: 12, text: 5, unrecorded: 0 });
    expect(note).toContain("17 entries");
    expect(note).toContain("12 from photographs");
    expect(note).toContain("5 from typed descriptions");
    expect(note).not.toContain("not recorded");
  });

  it("omits a method with no entries instead of writing a zero", () => {
    expect(nutritionProvenanceNote({ photo: 0, text: 3, unrecorded: 0 })).not.toContain(
      "photographs",
    );
  });

  it("names rows whose capture method was never recorded", () => {
    expect(nutritionProvenanceNote({ photo: 0, text: 0, unrecorded: 4 })).toContain(
      "4 with the capture method not recorded",
    );
  });

  it("never presents an estimate as weighed", () => {
    expect(nutritionProvenanceNote({ photo: 1, text: 1, unrecorded: 1 })).toContain("none weighed");
  });
});

describe("statsToPrompt", () => {
  const base: ReportStats = {
    from: "2026-08-08",
    to: "2026-09-07",
    unreadable: [],
    sessions: 12,
    totalVolumeKg: 62500,
    trainingMinutes: 640,
    avgSessionMinutes: 53,
    sessionsPerWeek: 2.8,
    checkins: 9,
    avgReadiness: 71,
    avgSleepHours: 6.9,
    avgSoreness: 3,
    avgStress: 4,
    avgEnergy: 6,
    nutritionDaysLogged: 5,
    nutritionSources: { photo: 3, text: 2, unrecorded: 0 },
    bodySources: { measured: 2, photo: 1, unrecorded: 0 },
    avgKcal: 2400,
    avgProtein: 160,
    avgCarbs: 250,
    avgFat: 80,
    weightStartKg: 79,
    weightEndKg: 78.6,
    weightDeltaKg: -0.4,
    bodyFatStart: 15,
    bodyFatEnd: 14.7,
    topLifts: [{ exercise: "Bench press", bestWeight: 100, reps: 5 }],
    supplements: [{ name: "Creatine", dose: "5 g", timesPerDay: 1 }],
    profile: null,
  };

  it("says every source was read when every source was", () => {
    expect(statsToPrompt(base)).toContain("SOURCES: all seven read successfully");
  });

  it("never lets a failed read reach the page as a figure", () => {
    // The model is told to use only the numbers in this block. A failed read
    // left as sessions=0 becomes "the athlete trained zero times" in a
    // document handed to a physician.
    const prompt = statsToPrompt({ ...base, unreadable: ["training sessions", "nutrition log"] });
    expect(prompt).toContain("SOURCES UNAVAILABLE: training sessions, nutrition log");
    expect(prompt).toContain(
      "TRAINING: SOURCE COULD NOT BE READ — no figures available for this section",
    );
    expect(prompt).not.toContain("sessions=12");
    expect(prompt).not.toContain("2400 kcal");
    // The sources that did come back are untouched: one broken read must not
    // cost the athlete the other six.
    expect(prompt).toContain("check-ins=9");
    expect(prompt).toContain("Bench press 100kg×5");
  });

  it("marks an unreadable nutrition log rather than reporting no meals", () => {
    const prompt = statsToPrompt({
      ...base,
      unreadable: ["nutrition log"],
      nutritionSources: { photo: 0, text: 0, unrecorded: 0 },
      bodySources: { measured: 0, photo: 0, unrecorded: 0 },
    });
    expect(prompt).not.toContain("no meals logged");
    expect(prompt).toContain("NUTRITION: SOURCE COULD NOT BE READ");
  });
});

describe("bodyProvenanceNote", () => {
  it("never lets a photograph pass for a measurement", () => {
    const note = bodyProvenanceNote({ measured: 2, photo: 3, unrecorded: 1 });
    expect(note).toContain("2 entered by the athlete");
    expect(note).toMatch(/3 estimated by a model from a photograph, not measured/);
    expect(note).toContain("1 with the method not recorded");
  });

  it("says there is nothing rather than describing an empty set", () => {
    expect(bodyProvenanceNote({ measured: 0, photo: 0, unrecorded: 0 })).toBe(
      "no measurements recorded",
    );
  });

  it("mentions only the kinds that actually occur", () => {
    const note = bodyProvenanceNote({ measured: 4, photo: 0, unrecorded: 0 });
    expect(note).toBe("4 entries: 4 entered by the athlete");
    expect(note).not.toContain("photograph");
  });
});
