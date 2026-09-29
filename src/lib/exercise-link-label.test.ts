import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exerciseLinkLabel } from "./exercise-link-label";
import { getExerciseMedia } from "./exercise-media";

/**
 * "Žiūrėti video" was the label on every exercise the Coach put in a generated
 * workout. Ten of the 175 exercises have a video. The other 165 open onto two
 * still frames, which the page itself labels `Kadras 1` / `Kadras 2` — so the
 * athlete finds out what they were promised only after tapping, and the label
 * is the whole of what they had to go on before.
 *
 * Real slugs and the real media map, because the defect was a label
 * disagreeing with what the page renders; a mock could only reproduce the
 * agreement being checked.
 */

const HAS_VIDEO = "squat";
const HAS_FRAMES = "barbell-shrug";
const NOT_IN_CATALOGUE = "something-the-coach-invented";

describe("the label on a link to an exercise page", () => {
  it("promises a video only where a video exists", () => {
    expect(getExerciseMedia(HAS_VIDEO).type).toBe("video");
    expect(exerciseLinkLabel("lt", HAS_VIDEO)).toBe("Žiūrėti video");
    expect(exerciseLinkLabel("en", HAS_VIDEO)).toBe("Watch video");
  });

  it("never promises a video for an exercise that is two still frames", () => {
    expect(getExerciseMedia(HAS_FRAMES).type).toBe("frames");
    for (const lang of ["lt", "en"] as const) {
      expect(exerciseLinkLabel(lang, HAS_FRAMES)).not.toMatch(/video/i);
    }
  });

  it("promises nothing for a slug the catalogue does not have", () => {
    // The Coach generates blocks; a block can name an exercise that was never
    // seeded, and `hasPage` is the only thing standing between that and a link.
    expect(getExerciseMedia(NOT_IN_CATALOGUE).type).toBe("fallback");
    expect(exerciseLinkLabel("lt", NOT_IN_CATALOGUE)).toBe("Apie pratimą");
    expect(exerciseLinkLabel("en", NOT_IN_CATALOGUE)).toBe("About this exercise");
  });

  it("answers differently for all three kinds, in both languages", () => {
    // `Record<MediaType, string>` makes the compiler demand three entries per
    // language. Three identical entries would satisfy it and be the defect.
    for (const lang of ["lt", "en"] as const) {
      const labels = [HAS_VIDEO, HAS_FRAMES, NOT_IN_CATALOGUE].map((slug) =>
        exerciseLinkLabel(lang, slug),
      );
      expect(new Set(labels).size).toBe(3);
    }
  });

  it("gives a locale with no copy of its own the English label, not Lithuanian", () => {
    // `baseLang`, not `lang === "en"`. Six of the eight shipped locales have no
    // branch here, and the wrong test once handed all six Lithuanian.
    for (const lang of ["de", "es", "fr", "pl", "ru", "uk"] as const) {
      expect(exerciseLinkLabel(lang, HAS_VIDEO)).toBe("Watch video");
    }
  });

  it("is the only thing the generated-workout list puts on that button", () => {
    // The label and the media map live in different files; a call site that
    // went back to a constant would pass every test above.
    const source = readFileSync(
      new URL("../components/WorkoutRequestBuilder.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/\{exerciseLinkLabel\(lang, b\.slug\)\}/);
    expect(source).not.toMatch(/Watch video|Žiūrėti video/);
  });
});
