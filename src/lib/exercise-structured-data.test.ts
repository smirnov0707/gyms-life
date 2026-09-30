import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exerciseStructuredData } from "./exercise-structured-data";
import { getExerciseMedia } from "./exercise-media";

/**
 * The machine-readable half of the claim the last few commits removed from the
 * human-readable half.
 *
 * Real slugs and the real media map: the defect was markup disagreeing with
 * what the page can actually play, and a mock would only reproduce the
 * agreement being checked.
 */

const HAS_VIDEO = "squat";
const HAS_FRAMES = "ab-wheel";

const exercise = (slug: string) => ({
  slug,
  muscle_group: "legs",
  equipment: "barbell",
  created_at: "2026-08-01T00:00:00.000Z",
});

const graph = (slug: string, steps: string[] = ["Step one.", "Step two."]) =>
  exerciseStructuredData(exercise(slug), "Pritūpimai", "Nusileisk kontroliuodamas.", steps);

const typesIn = (slug: string, steps?: string[]) =>
  graph(slug, steps)["@graph"].map((node) => node["@type"]);

describe("the structured data an exercise page publishes", () => {
  it("describes a video only where there is one to play", () => {
    expect(getExerciseMedia(HAS_VIDEO).type).toBe("video");
    expect(typesIn(HAS_VIDEO)).toContain("VideoObject");
    const video = graph(HAS_VIDEO)["@graph"].find((node) => node["@type"] === "VideoObject");
    expect(video?.["contentUrl"]).toBe("https://gyms.life/assets/videos/exercise-squat.mp4");
  });

  it("publishes no VideoObject for the 165 exercises that are two still frames", () => {
    // The defect. `contentUrl: undefined` was dropped by JSON.stringify, so a
    // crawler received a video entity with a name, a description, a thumbnail
    // and nothing to play — which schema.org does not accept as a video, and a
    // person clicking through would not either.
    expect(getExerciseMedia(HAS_FRAMES).type).toBe("frames");
    expect(typesIn(HAS_FRAMES)).not.toContain("VideoObject");
  });

  it("never emits a VideoObject without the one field that makes it a video", () => {
    for (const slug of [HAS_VIDEO, HAS_FRAMES, "not-in-the-catalogue"]) {
      for (const node of graph(slug)["@graph"]) {
        if (node["@type"] !== "VideoObject") continue;
        expect(typeof node["contentUrl"]).toBe("string");
        expect(String(node["contentUrl"])).toMatch(/^https:\/\/gyms\.life\/assets\//);
      }
    }
  });

  it("omits fields it has no value for rather than emitting them empty", () => {
    // `undefined` survives in an object and disappears in JSON, which is how
    // the original defect hid: the code read as if it had handled the case.
    const bare = exerciseStructuredData(
      { slug: HAS_FRAMES, muscle_group: null, equipment: null, created_at: null },
      "Ratukas presui",
      "",
      ["Vienas žingsnis."],
    );
    const howTo = bare["@graph"].find((node) => node["@type"] === "HowTo");
    expect(howTo && "tool" in howTo).toBe(false);
    expect(JSON.stringify(bare)).not.toContain("undefined");
  });

  it("still describes the exercise itself, and its steps when there are any", () => {
    expect(typesIn(HAS_FRAMES)).toEqual(["ExercisePlan", "HowTo"]);
    expect(typesIn(HAS_FRAMES, [])).toEqual(["ExercisePlan"]);
    expect(typesIn(HAS_VIDEO)).toEqual(["ExercisePlan", "VideoObject", "HowTo"]);
  });

  it("is what the route publishes, not a second copy of it", () => {
    // The builder and the page are one decision; a route that went back to
    // building the graph inline would pass every test above.
    const route = readFileSync(new URL("../routes/exercises.$slug.tsx", import.meta.url), "utf8");
    expect(route).toMatch(
      /JSON\.stringify\(exerciseStructuredData\(ex, name, instructions, steps\)\)/,
    );
    expect(route).not.toMatch(/"@type":\s*"VideoObject"/);
  });
});
