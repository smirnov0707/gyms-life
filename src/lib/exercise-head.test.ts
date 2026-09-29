import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 175 exercise pages are everything this site publishes to a search engine, and
 * every one of them was titled with its URL slug: `ab-wheel — pratimo technika
 * ir video | GYMS.LIFE`. The name — `Ratukas presui` — was one column away in a
 * table the page already read, but it read it after hydration, and `head()` had
 * long since been written from the only string it is handed.
 *
 * What is pinned here is the pair: that the head asks for the name, and that a
 * name it could not get falls back to the slug loudly rather than quietly.
 */

type Answer = { data?: { name_lt: string | null; name_en: string | null } | null; error?: unknown };

let answer: Answer;
let throwOnRead: boolean;
let queriedSlugs: string[];
let reported: { code: unknown; slug: unknown }[];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const chain = {
        select: () => chain,
        eq: (_column: string, value: string) => {
          queriedSlugs.push(value);
          return chain;
        },
        maybeSingle: () => {
          if (throwOnRead) throw new Error("socket hang up");
          return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
        },
      };
      return chain;
    },
  },
}));

const { exerciseHeadMeta, readExerciseName } = await import("./exercise-head");
const { getExerciseMedia } = await import("./exercise-media");

const titleOf = (meta: ReturnType<typeof exerciseHeadMeta>) =>
  meta.find((entry) => "title" in entry)?.title ?? "";
const contentOf = (meta: ReturnType<typeof exerciseHeadMeta>, key: string) =>
  meta.find((entry) => entry.name === key || entry.property === key)?.content ?? "";

beforeEach(() => {
  answer = {};
  throwOnRead = false;
  queriedSlugs = [];
  reported = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const detail = args[1];
    if (detail && typeof detail === "object" && "code" in detail) {
      reported.push(detail as { code: unknown; slug: unknown });
    }
  });
});

describe("the name an exercise page titles itself with", () => {
  it("is the Lithuanian name, because the server renders Lithuanian for everybody", async () => {
    answer = { data: { name_lt: "Ratukas presui", name_en: "Ab Wheel Rollout" } };
    expect(await readExerciseName("ab-wheel")).toBe("Ratukas presui");
    expect(queriedSlugs).toEqual(["ab-wheel"]);
  });

  it("falls back to English only where there is no Lithuanian name", async () => {
    answer = { data: { name_lt: null, name_en: "Ab Wheel Rollout" } };
    expect(await readExerciseName("ab-wheel")).toBe("Ab Wheel Rollout");
  });

  it("is null for a slug nobody has, rather than the slug pretending to be a name", async () => {
    answer = { data: null };
    expect(await readExerciseName("no-such-exercise")).toBeNull();
    expect(reported).toEqual([]);
  });

  it("is null when the read failed, and says so with a code", async () => {
    // A read that failed is not a read that found nothing, and here the two
    // produce the same title. Only the log can tell them apart.
    answer = { error: { code: "57014" } };
    expect(await readExerciseName("ab-wheel")).toBeNull();
    expect(reported).toEqual([{ code: "EXERCISE_NAME_READ_FAILED", slug: "ab-wheel" }]);
  });

  it("never throws, because a rejected loader takes the whole route down", async () => {
    // The page's own read distinguishes "could not load" from "does not exist",
    // carefully, because it once did not. This read must not overrule it.
    throwOnRead = true;
    await expect(readExerciseName("ab-wheel")).resolves.toBeNull();
    expect(reported).toEqual([{ code: "EXERCISE_NAME_READ_THREW", slug: "ab-wheel" }]);
  });
});

describe("the head an exercise page writes", () => {
  it("names the exercise in the tab, the search snippet and the shared link", () => {
    const meta = exerciseHeadMeta("ab-wheel", "Ratukas presui");
    expect(titleOf(meta)).toContain("Ratukas presui");
    expect(contentOf(meta, "description")).toContain("Ratukas presui");
    expect(contentOf(meta, "og:title")).toContain("Ratukas presui");
    expect(contentOf(meta, "og:description")).toContain("Ratukas presui");
    for (const entry of meta)
      expect(String(entry.title ?? entry.content)).not.toContain("ab-wheel");
  });

  it("gives every page a description of its own, not one shared by 175 pages", () => {
    // The old description was a constant. 175 identical snippets are 175 pages
    // a search engine has no reason to tell apart.
    const first = contentOf(exerciseHeadMeta("ab-wheel", "Ratukas presui"), "description");
    const second = contentOf(exerciseHeadMeta("arnold-press", "Arnoldo spaudimas"), "description");
    expect(first).not.toBe(second);
  });

  it("still titles the page when the name is missing, with the slug it had before", () => {
    const meta = exerciseHeadMeta("ab-wheel", null);
    expect(titleOf(meta)).toMatch(/^ab-wheel — /);
  });
});

describe("the demonstration an exercise page promises before you arrive", () => {
  // Real slugs, read through the real media map, because the defect was the
  // head disagreeing with what the page then rendered. A mock here could only
  // reproduce the agreement it is supposed to be checking.
  const HAS_VIDEO = "squat";
  const HAS_FRAMES = "ab-wheel";

  it("says video only where a video exists", () => {
    expect(getExerciseMedia(HAS_VIDEO).type).toBe("video");
    const meta = exerciseHeadMeta(HAS_VIDEO, "Pritūpimai");
    expect(titleOf(meta)).toContain("vaizdo demonstracija");
    expect(contentOf(meta, "og:description")).toContain("vaizdo demonstracija");
  });

  it("never says video for the 165 exercises that are two still frames", () => {
    // The defect. `ab-wheel` renders an <img> with `Kadras 1` / `Kadras 2`
    // controls — the page was always honest once you were on it. The tab, the
    // search snippet and the shared link were not.
    expect(getExerciseMedia(HAS_FRAMES).type).toBe("frames");
    for (const entry of exerciseHeadMeta(HAS_FRAMES, "Ratukas presui")) {
      expect(String(entry.title ?? entry.content)).not.toMatch(/video|vaizdo/i);
    }
  });

  it("promises no demonstration at all where there is none", () => {
    for (const entry of exerciseHeadMeta("slug-with-no-media-at-all", "Nežinomas")) {
      expect(String(entry.title ?? entry.content)).not.toMatch(/video|vaizdo|kadr/i);
    }
  });

  it("answers differently for all three kinds, not just exhaustively", () => {
    // `Record<MediaType, …>` makes the compiler demand three entries. It cannot
    // demand that they differ, and three identical entries would be the same
    // defect with the types satisfied.
    const titles = [HAS_VIDEO, HAS_FRAMES, "slug-with-no-media-at-all"].map((slug) =>
      titleOf(exerciseHeadMeta(slug, "X")),
    );
    expect(new Set(titles).size).toBe(3);
  });

  it("is a claim the library index does not make on their behalf either", () => {
    // The index said "175+ pratimų su technikos video" — wrong about the video
    // for 165 of them, and with no slack at all above 175.
    const source = readFileSync(new URL("../routes/exercises.index.tsx", import.meta.url), "utf8");
    const head = /head:\s*\(\)\s*=>\s*\(\{([\s\S]*?)\n {2}\}\),/.exec(source)?.[1] ?? "";
    expect(head).not.toBe("");
    const claims = [...head.matchAll(/(?:title|content):\s*\n?\s*"([^"]+)"/g)].map(
      (m) => m[1] ?? "",
    );
    expect(claims.length).toBeGreaterThanOrEqual(4);
    for (const claim of claims) expect(claim).not.toMatch(/\bvideo\b/i);
  });
});

describe("the route that asks for all this", () => {
  it("loads the name before the head is written, and reads it from the loader", async () => {
    // The two halves live in different files and neither is wrong alone: a
    // `head()` that reads `loaderData` with no loader silently gets the slug
    // back, which is exactly the defect, and passes every other test here.
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(new URL("../routes/exercises.$slug.tsx", import.meta.url), "utf8"),
    );
    expect(source).toMatch(/loader:\s*async\s*\(\{\s*params\s*\}\)\s*=>/);
    expect(source).toMatch(/readExerciseName\(params\.slug\)/);
    expect(source).toMatch(/exerciseHeadMeta\(params\.slug,\s*loaderData\?\.name\s*\?\?\s*null\)/);
  });
});
