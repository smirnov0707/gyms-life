import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The document has to say which language it is actually in.
 *
 * `__root.tsx` serves `<html lang="lt">`, and that is right for what the server
 * renders: `LangProvider` starts at `"lt"`, so the first paint is Lithuanian
 * for everybody and the attribute matches the words. The language is chosen
 * after hydration, from a stored preference or `navigator.languages` — and
 * nothing updated the attribute to match.
 *
 * So a German, Spanish, French, Polish, Russian or Ukrainian athlete read their
 * own language inside a document still declaring Lithuanian. A screen reader
 * takes `lang` at its word and pronounces the whole page with the wrong
 * language's rules; so do translation tools and hyphenation. `theme.tsx` solves
 * the same shape of problem for dark mode before first paint, which is why the
 * omission here is easy to miss — half the pair was already wired.
 *
 * This checks the pair, because neither file is wrong on its own.
 */

const ROOT = path.resolve("src/routes/__root.tsx");
const PROVIDER = path.resolve("src/lib/i18n.tsx");

describe("the language the document declares", () => {
  it("is a fixed value on the server, matching the language the server renders", () => {
    // Not a defect to fix by templating: the SSR copy really is Lithuanian, and
    // an attribute that disagreed with the words would be worse than one that
    // is merely stale.
    expect(readFileSync(ROOT, "utf8")).toMatch(/<html lang="lt"/);
    expect(readFileSync(PROVIDER, "utf8")).toMatch(/useState<Lang>\("lt"\)/);
  });

  it("is corrected once the client knows which language it is showing", () => {
    const provider = readFileSync(PROVIDER, "utf8");
    expect(provider).toMatch(/document\.documentElement\.lang\s*=\s*lang/);
  });

  it("is corrected whenever the language changes, not only once", () => {
    // Keyed on `lang`, so switching with the header's LT/EN control updates the
    // attribute too. An effect with an empty dependency list would set it once
    // and then lie for the rest of the session.
    const provider = readFileSync(PROVIDER, "utf8");
    const effect =
      /useEffect\(\(\) => \{\s*document\.documentElement\.lang = lang;\s*\}, \[lang\]\);/;
    expect(provider).toMatch(effect);
  });
});
