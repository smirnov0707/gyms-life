import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The first page anybody sees, against what the system can actually do.
 *
 * The Lab card offered "observations and experiments". `personal_experiments`
 * holds no rows and never will as things stand: `createPersonalExperiment` has
 * no caller, so there is no way to create one. The page was selling a feature
 * that cannot be reached — and the rest of the copy was abstract enough that it
 * never said what the app does instead, which is a lot and is checkable.
 *
 * This guards the specific claims against the specific facts. It is not a style
 * test: every assertion below is a thing the code either does or does not do.
 */

const LANDING = path.resolve("src/components/FutureLabLanding.tsx");
const EXPERIMENTS = path.resolve("src/lib/personal-experiment.functions.ts");
const landing = () => readFileSync(LANDING, "utf8");

/** The `lt` and `en` copy blocks, so each is checked rather than whichever matched. */
function branches(): { lang: string; copy: string }[] {
  const source = landing();
  return ["en", "lt"].map((lang) => {
    const start = source.indexOf(`  ${lang}: {`);
    const next = ["en", "lt"]
      .map((other) => source.indexOf(`  ${other}: {`))
      .filter((at) => at > start);
    const end = next.length ? Math.min(...next) : source.indexOf("\n} as const", start);
    return { lang, copy: source.slice(start, end > start ? end : undefined) };
  });
}

describe("what the landing page promises", () => {
  it("is reading both copy branches, not whichever one matched first", () => {
    for (const { lang, copy } of branches()) {
      expect(copy.length, lang).toBeGreaterThan(1500);
      expect(copy, lang).toMatch(/faqs: \[/);
    }
  });

  it("does not offer experiments, because none can be created", () => {
    // The pair. `createPersonalExperiment` exists and nothing calls it, which
    // is why `personal_experiments` has no rows and will not get any. If a
    // creation flow ever appears — a caller outside the tests — this test is
    // what says the landing page may start advertising it again.
    expect(readFileSync(EXPERIMENTS, "utf8")).toMatch(/createPersonalExperiment/);
    const callers = ["src/routes", "src/components"].flatMap((dir) => {
      const walk = (at: string): string[] =>
        readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
          const full = path.join(at, entry.name);
          if (entry.isDirectory()) return walk(full);
          return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
        });
      return walk(path.resolve(dir));
    });
    const reachable = callers.filter((file) =>
      readFileSync(file, "utf8").includes("createPersonalExperiment"),
    );
    expect(reachable).toEqual([]);
    for (const { lang, copy } of branches()) {
      expect(copy, lang).not.toMatch(/Experiments ·|· Eksperimentai|eksperimentus|experiments\./i);
    }
  });

  it("says outright that nothing is learning in the background yet", () => {
    // `background_job_runs` has one row and it failed; `night_lab_reviews` and
    // `personal_model_predictions` are empty. Nothing has learned anything.
    //
    // Written as an assertion about the honest sentence rather than a blacklist
    // of words. A first version of this test searched for "nightly model
    // learning your body" and failed on the copy that *denies* it — a pattern
    // that cannot tell a claim from its negation does not belong in a test
    // about claims.
    for (const { lang, copy } of branches()) {
      expect(copy, lang).toMatch(
        /no nightly model learning your body|nėra nakties modelio, kuris fone mokytųsi/,
      );
    }
  });

  it("says the catalogue is 175 and does not call all of it video", () => {
    for (const { lang, copy } of branches()) {
      expect(copy, lang).toMatch(/175/);
      // Ten of the 175 have a video; the rest are frame sequences. The page
      // names both rather than the flattering one.
      expect(copy, lang).toMatch(/frame sequences|judesio kadrai/);
    }
  });

  it("tells a visitor it is free during the beta, which is the fact they need", () => {
    for (const { lang, copy } of branches()) {
      expect(copy, lang).toMatch(/beta/i);
      expect(copy, lang).toMatch(/without a subscription|be prenumeratos|be mokėjimo/);
    }
  });

  it("offers erasure only because the app can now perform it", () => {
    const controls = readFileSync(path.resolve("src/components/AccountControls.tsx"), "utf8");
    expect(controls).toMatch(/deleteMyAccount/);
    for (const { lang, copy } of branches()) {
      expect(copy, lang).toMatch(/delete my account|ištrinti paskyrą/i);
    }
  });

  it("keeps saying that a missing measurement stays missing", () => {
    // The oldest rule in AGENTS.md, and the one a landing page is most tempted
    // to drop.
    for (const { lang, copy } of branches()) {
      expect(copy, lang).toMatch(/Missing data stays missing|Trūkstami duomenys lieka trūkstami/);
      expect(copy, lang).toMatch(/not a diagnosis|ne diagnozė/);
    }
  });

  it("warns that submitted photos leave the device, on the page as well as the screen", () => {
    for (const { lang, copy } of branches()) {
      expect(copy, lang).toMatch(/AI provider|dirbtinio intelekto paslaugos teikėjui/);
    }
  });
});
