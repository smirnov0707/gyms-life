import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The library page is the site's own path to its 175 exercise pages, and it
 * had none. It fetched the catalogue after hydration, so the server HTML
 * carried a spinner and not one `/exercises/<slug>` link. The sitemap claimed
 * all 175 existed; nothing on the site agreed with it.
 *
 * What is pinned here is the pair: a read that cannot take the route down, and
 * a page that actually renders what it returns.
 */

type Page = {
  data?: { slug: string; name_lt: string | null; name_en: string | null }[] | null;
  error?: unknown;
};

let pages: Page[];
let ranges: [number, number][];
let selected: string[];
let throwOnRead: boolean;
let reported: { code: unknown; collected: unknown }[];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const chain = {
        select: (columns: string) => {
          selected.push(columns);
          return chain;
        },
        order: () => chain,
        range: (from: number, to: number) => {
          ranges.push([from, to]);
          if (throwOnRead) throw new Error("socket hang up");
          const next = pages.shift();
          if (!next) throw new Error("unscripted catalogue read");
          return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
        },
      };
      return chain;
    },
  },
}));

const { catalogueEntryName, groupCatalogueByLetter, readExerciseCatalogueIndex } =
  await import("./exercise-catalogue-index");

const entry = (slug: string, lt: string | null, en: string | null = null) => ({
  slug,
  name_lt: lt,
  name_en: en,
});

beforeEach(() => {
  pages = [];
  ranges = [];
  selected = [];
  throwOnRead = false;
  reported = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const detail = args[1];
    if (detail && typeof detail === "object" && "code" in detail) {
      reported.push(detail as { code: unknown; collected: unknown });
    }
  });
});

describe("the catalogue read behind the library index", () => {
  it("asks for the three columns a name and a link need, and no more", () => {
    // The full catalogue is 148 kB of JSON. It is serialised into every
    // request to this page, so a column nobody renders is paid for by everyone.
    pages = [{ data: [entry("squat", "Pritūpimai")] }];
    return readExerciseCatalogueIndex().then(() => {
      expect(selected).toEqual(["slug, name_lt, name_en"]);
    });
  });

  it("returns what it read when a later page fails, and says so", async () => {
    pages = [
      { data: Array.from({ length: 1000 }, (_, i) => entry(`e${i}`, `E${i}`)) },
      { error: { code: "57014" } },
    ];
    const index = await readExerciseCatalogueIndex();
    expect(index).toHaveLength(1000);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(reported).toEqual([{ code: "EXERCISE_CATALOGUE_READ_FAILED", collected: 1000 }]);
  });

  it("never throws, because a rejected loader takes the whole route down", async () => {
    throwOnRead = true;
    await expect(readExerciseCatalogueIndex()).resolves.toEqual([]);
    expect(reported).toEqual([{ code: "EXERCISE_CATALOGUE_READ_THREW", collected: 0 }]);
  });

  it("says nothing when the read worked", async () => {
    pages = [{ data: [entry("squat", "Pritūpimai")] }];
    expect(await readExerciseCatalogueIndex()).toHaveLength(1);
    expect(reported).toEqual([]);
  });
});

describe("the names and the grouping", () => {
  it("shows Lithuanian first, English next, and the slug only as a last resort", () => {
    expect(catalogueEntryName(entry("squat", "Pritūpimai", "Squat"))).toBe("Pritūpimai");
    expect(catalogueEntryName(entry("squat", null, "Squat"))).toBe("Squat");
    expect(catalogueEntryName(entry("squat", null, null))).toBe("squat");
  });

  it("groups by first letter and sorts Lithuanian letters as Lithuanian", () => {
    const groups = groupCatalogueByLetter([
      entry("zercher", "Zercher pritūpimai"),
      entry("ab-wheel", "Ratukas presui"),
      entry("sauliо", "Šaulio atsispaudimas"),
      entry("arnold", "Arnoldo spaudimas"),
    ]);
    expect(groups.map((g) => g.letter)).toEqual(["A", "R", "Š", "Z"]);
    expect(groups.every((g) => g.entries.length === 1)).toBe(true);
  });

  it("keeps every exercise, so the index is the whole catalogue", () => {
    const entries = Array.from({ length: 175 }, (_, i) => entry(`e${i}`, `Pratimas ${i}`));
    const grouped = groupCatalogueByLetter(entries);
    expect(grouped.flatMap((g) => g.entries)).toHaveLength(175);
  });
});

describe("the page that renders it", () => {
  it("reads the loader and links every entry to its own page", () => {
    // The read and the render are one decision in two files; a loader whose
    // result nothing renders would pass every test above.
    const source = readFileSync(path.resolve("src/routes/exercises.index.tsx"), "utf8");
    expect(source).toMatch(
      /loader:\s*async\s*\(\)\s*=>\s*\(\{\s*index:\s*await readExerciseCatalogueIndex\(\)/,
    );
    expect(source).toMatch(/Route\.useLoaderData\(\)\.index/);
    expect(source).toMatch(/groupCatalogueByLetter\(catalogueIndex\)/);
    const section =
      /groupCatalogueByLetter\(catalogueIndex\)[\s\S]*?<\/section>/.exec(source)?.[0] ?? "";
    expect(section).not.toBe("");
    expect(section).toMatch(/to="\/exercises\/\$slug"/);
    expect(section).toMatch(/params=\{\{ slug: entry\.slug \}\}/);
    expect(section).toMatch(/catalogueEntryName\(entry\)/);
  });
});
