import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A share card must not promise an image the page does not have.
 *
 * Six routes declared `twitter:card: summary_large_image`, and nothing anywhere
 * set `og:image` or `twitter:image` — there is no branded share card in
 * `public/` to point one at. `summary_large_image` is a promise about what the
 * page provides, and a large-image card with no image renders as a broken
 * preview: the claim cost a worse link than saying nothing would have.
 *
 * This is the same shape as the rest of this file's neighbours — a declaration
 * and the thing it describes living in different files, each defensible alone.
 */

const ROUTES = path.resolve("src/routes");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const routeSources = () =>
  walk(ROUTES).map((file) => ({
    file: path.relative(ROUTES, file).split(path.sep).join("/"),
    text: readFileSync(file, "utf8"),
  }));

const declares = (text: string, value: string) =>
  new RegExp(`"twitter:card"[^}]*"${value}"`).test(text);

const providesAnImage = (text: string) => /"(?:og:image|twitter:image)"/.test(text);

describe("the share card a route declares", () => {
  it("only asks for a large image where an image is actually provided", () => {
    const promising = routeSources()
      .filter(({ text }) => declares(text, "summary_large_image") && !providesAnImage(text))
      .map(({ file }) => file);
    expect(promising).toEqual([]);
  });

  it("is still declared somewhere, so this is not passing on an empty scan", () => {
    const declaring = routeSources().filter(({ text }) => /"twitter:card"/.test(text));
    expect(declaring.length).toBeGreaterThanOrEqual(6);
  });

  it("recognises the shape it forbids and the shape that is fine", () => {
    const bare = '{ name: "twitter:card", content: "summary_large_image" },';
    const withImage = `${bare}\n{ property: "og:image", content: "/share.png" },`;
    expect(declares(bare, "summary_large_image") && !providesAnImage(bare)).toBe(true);
    expect(declares(withImage, "summary_large_image") && !providesAnImage(withImage)).toBe(false);
  });
});
