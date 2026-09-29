import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sitemap is the only place this site tells a crawler how big it is.
 *
 * Seven paths are hard-coded; the other 175 are read from `exercises`, and
 * those exercise pages are the whole indexable surface — `/`, `/pricing` and
 * five legal pages are the shell around them. The read was fail-open and
 * fail-silent at once: `if (error || !data) break;` answered 200 with the shell
 * and nothing anywhere recorded that the catalogue had gone missing. A sitemap
 * that has lost 96% of its URLs looks exactly like a small site.
 *
 * So what is pinned here is not the XML. It is that every way the catalogue can
 * fail to arrive still serves the crawler something, and still leaves a reason
 * behind with a code somebody can search for.
 */

type Answer = { data?: { slug: string }[] | null; error?: unknown };

/** What successive `range()` calls answer, in order. */
let pages: Answer[];
/** Every `(from, to)` a read asked for, so pagination is visible to a test. */
let ranges: [number, number][];
let createClientCalls: number;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    createClientCalls += 1;
    const chain = {
      select: () => chain,
      order: () => chain,
      range: (from: number, to: number) => {
        ranges.push([from, to]);
        const next = pages.shift();
        if (!next) throw new Error("unscripted exercise read");
        return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
      },
    };
    return { from: () => chain };
  },
}));

async function get(): Promise<{ status: number; xml: string; locs: string[] }> {
  const { Route } = await import("./sitemap[.]xml");
  const handlers = (
    Route as unknown as {
      options: { server: { handlers: { GET: () => Promise<Response> } } };
    }
  ).options.server.handlers;
  const response = await handlers.GET();
  const xml = await response.text();
  return {
    status: response.status,
    xml,
    locs: [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? ""),
  };
}

const STATIC_PATHS = ["/", "/pricing", "/exercises", "/auth", "/terms", "/privacy", "/refund"];

function slugs(count: number, prefix = "e"): { slug: string }[] {
  return Array.from({ length: count }, (_, index) => ({ slug: `${prefix}${index}` }));
}

let reported: { code: unknown; collected: unknown }[];

beforeEach(() => {
  pages = [];
  ranges = [];
  createClientCalls = 0;
  reported = [];
  process.env["SUPABASE_URL"] = "https://project.supabase.co";
  process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_test";
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const detail = args[1];
    if (detail && typeof detail === "object" && "code" in detail) {
      reported.push(detail as { code: unknown; collected: unknown });
    }
  });
});

describe("the sitemap this site serves", () => {
  it("lists the catalogue when the catalogue can be read", async () => {
    pages = [{ data: slugs(175) }];
    const { status, locs } = await get();
    expect(status).toBe(200);
    expect(locs).toHaveLength(STATIC_PATHS.length + 175);
    expect(locs).toContain("https://gyms.life/exercises/e0");
    expect(reported).toEqual([]);
  });

  it("escapes a slug rather than emitting it raw into the XML", async () => {
    pages = [{ data: [{ slug: "bench press & row" }] }];
    const { locs } = await get();
    expect(locs).toContain("https://gyms.life/exercises/bench%20press%20%26%20row");
  });

  it("still answers a crawler when the read fails, instead of a 500", async () => {
    pages = [{ error: { code: "57014" } }];
    const { status, locs } = await get();
    expect(status).toBe(200);
    expect(locs).toEqual(STATIC_PATHS.map((path) => `https://gyms.life${path}`));
  });

  it("writes down that the read failed, with a code and what it had", async () => {
    // The defect. A shortened sitemap is a survivable answer; a shortened
    // sitemap nobody can tell from a small site is not.
    pages = [{ error: { code: "57014" } }];
    await get();
    expect(reported).toEqual([{ code: "SITEMAP_EXERCISE_READ_FAILED", collected: 0 }]);
  });

  it("says how much it had when a later page is the one that fails", async () => {
    // A partial sitemap is the worse shape: it looks complete. The count is
    // what separates "lost everything" from "lost the tail".
    pages = [{ data: slugs(1000) }, { error: { code: "57014" } }];
    const { locs } = await get();
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(locs).toHaveLength(STATIC_PATHS.length + 1000);
    expect(reported).toEqual([{ code: "SITEMAP_EXERCISE_READ_FAILED", collected: 1000 }]);
  });

  it("names a missing database configuration as its own reason", async () => {
    // Not a database fault, and it does not heal: a deploy without these two
    // variables serves seven URLs for as long as the deploy lasts.
    delete process.env["SUPABASE_URL"];
    delete process.env["VITE_SUPABASE_URL"];
    const { status, locs } = await get();
    expect(status).toBe(200);
    expect(locs).toHaveLength(STATIC_PATHS.length);
    expect(createClientCalls).toBe(0);
    expect(reported).toEqual([{ code: "SITEMAP_DATABASE_UNCONFIGURED", collected: 0 }]);
  });

  it("writes down a read that threw rather than answered", async () => {
    pages = [];
    const { status } = await get();
    expect(status).toBe(200);
    expect(reported).toEqual([{ code: "SITEMAP_EXERCISE_READ_THREW", collected: 0 }]);
  });
});

describe("the sitemap robots.txt points a crawler at", () => {
  it("is named once, at the address this route actually answers on", async () => {
    // Two identical `Sitemap:` lines were shipped, which costs nothing with a
    // crawler that dedupes and is a coin-flip with one that does not. The
    // address is the part worth pinning: the file and the route are one
    // decision living in two places, and neither is wrong on its own.
    const robots = readFileSync(path.resolve("public/robots.txt"), "utf8");
    const declared = [...robots.matchAll(/^Sitemap:\s*(\S+)$/gm)].map((match) => match[1] ?? "");
    expect(declared).toEqual(["https://gyms.life/sitemap.xml"]);

    pages = [{ data: slugs(1) }];
    const { locs } = await get();
    const origin = new URL(declared[0] ?? "").origin;
    expect(locs.every((loc) => loc.startsWith(origin))).toBe(true);
  });
});
