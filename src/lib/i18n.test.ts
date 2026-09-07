import { describe, expect, it } from "vitest";
import { dict, preloadSupplementalLocale, tr, type TKey } from "./i18n";

describe("supplemental locale loading", () => {
  it("keeps base translations synchronous and upgrades only the selected optional language", async () => {
    expect(tr("lt", "nav.dashboard")).toBe("Apžvalga");
    expect(tr("en", "nav.dashboard")).toBe("Dashboard");

    // The English value is a safe, non-blocking fallback before the optional pack arrives.
    expect(tr("ru", "nav.dashboard")).toBe("Dashboard");

    await preloadSupplementalLocale("ru");

    expect(tr("ru", "nav.dashboard")).toBe("Панель");
    expect(tr("fr", "nav.dashboard")).toBe("Dashboard");
  });

  it("retains every supplemental language pack behind its own loader", async () => {
    await Promise.all([
      preloadSupplementalLocale("uk"),
      preloadSupplementalLocale("pl"),
      preloadSupplementalLocale("de"),
      preloadSupplementalLocale("es"),
      preloadSupplementalLocale("fr"),
    ]);

    expect(tr("uk", "nav.dashboard")).toBe("Дашборд");
    expect(tr("pl", "nav.dashboard")).toBe("Panel");
    expect(tr("de", "nav.dashboard")).toBe("Dashboard");
    expect(tr("es", "nav.dashboard")).toBe("Panel");
    expect(tr("fr", "nav.dashboard")).toBe("Tableau de bord");
  });
});

describe("component copy fallback", () => {
  // `translate` above falls back to English for the six supplemental
  // locales. The per-component `copyFor` helpers used to test
  // `lang === "en"` and return the Lithuanian branch for everything else,
  // so a German athlete read German `t()` strings next to Lithuanian
  // component copy. These assert the two agree on their fallback.
  const SUPPLEMENTAL = ["ru", "uk", "pl", "de", "es", "fr"] as const;

  it("gives supplemental locales the English branch, not the Lithuanian one", async () => {
    const [{ labCopyFor }, { twinCopyFor }, { twinTodayCopyFor }] = await Promise.all([
      import("@/components/LabView"),
      import("@/components/TwinView"),
      import("@/components/twin/TwinTodayCard"),
    ]);

    for (const copyFor of [labCopyFor, twinCopyFor, twinTodayCopyFor]) {
      const english = JSON.stringify(copyFor("en"));
      const lithuanian = JSON.stringify(copyFor("lt"));
      expect(english).not.toBe(lithuanian);
      for (const lang of SUPPLEMENTAL) {
        expect(JSON.stringify(copyFor(lang))).toBe(english);
      }
    }
  });
});

describe("formatLocale", () => {
  it("formats each locale in its own language and pins English to en-GB", async () => {
    const { formatLocale } = await import("./i18n");
    const at = new Date("2026-03-09T14:05:00.000Z");
    const opts = { day: "2-digit", month: "2-digit", year: "numeric" } as const;

    expect(formatLocale("en")).toBe("en-GB");
    // en-GB, not en-US: day first, and the 24-hour clock the app assumes.
    expect(at.toLocaleDateString(formatLocale("en"), opts)).toBe("09/03/2026");
    // A supplemental locale formats as itself rather than falling back.
    expect(formatLocale("de")).toBe("de");
    expect(at.toLocaleDateString(formatLocale("de"), opts)).toBe("09.03.2026");
    expect(at.toLocaleDateString(formatLocale("lt"), opts)).toBe("2026-03-09");
  });
});

describe("copy fallback guard", () => {
  // The flat half of the rule in AGENTS.md. `lang === "lt" ? … : …` is the
  // safe shape — a locale with no copy branch of its own lands on English,
  // which is where `translate()` sends it too. `lang === "en"` is the shape
  // that sent German, Spanish, French, Polish, Russian and Ukrainian
  // speakers to the Lithuanian branch across sixteen files.
  it('tests the language with baseLang rather than lang === "en"', async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const path = await import("node:path");

    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
      });

    const offenders = [path.resolve("src/components"), path.resolve("src/routes")]
      .flatMap(walk)
      .filter((file) => /(?<!baseLang\()\blang === "en"/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});

describe("translations written beside the key", () => {
  /**
   * The `i18n-extra-*` files carry all eight languages inline. Until the
   * lookup below existed, nothing read the six optional ones: every screen
   * those files cover rendered in English for a Russian, Ukrainian, Polish,
   * German, Spanish or French athlete, with the translation sitting in the
   * repo two lines above the English it was losing to.
   */
  const SUPPLEMENTAL = ["ru", "uk", "pl", "de", "es", "fr"] as const;

  it("renders the inline language wherever no locale pack covers the key", async () => {
    const packs = new Map(
      await Promise.all(
        SUPPLEMENTAL.map(async (lang) => [lang, await preloadSupplementalLocale(lang)] as const),
      ),
    );

    let checked = 0;
    for (const [key, entry] of Object.entries(dict)) {
      const inline: Record<string, string | undefined> = entry;
      for (const lang of SUPPLEMENTAL) {
        const written = inline[lang];
        if (written === undefined) continue;
        checked += 1;
        expect(tr(lang, key as TKey)).toBe(packs.get(lang)?.[key] ?? written);
      }
    }

    // Guards against the loop passing because it found nothing to check.
    expect(checked).toBeGreaterThan(300);
  });

  it("still falls back to English for a key no optional language was written for", () => {
    const entry: Record<string, string | undefined> = dict["nav.training"];
    expect(entry["de"]).toBeUndefined();
    expect(tr("de", "nav.training")).toBe(dict["nav.training"].en);
  });
});
