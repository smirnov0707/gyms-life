import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getExerciseMedia } from "./exercise-media";

/**
 * How big the catalogue is, and what is in it, told to somebody who has not
 * seen it yet.
 *
 * Eight locales sold the library as "175+ pratimų biblioteka su technikos
 * video" on the pricing page, beside a price. Both halves were wrong. The
 * catalogue holds exactly 175 exercises, so "175+" has no slack at all — one
 * removed row makes it false, and it was never true as "more than 175". And ten
 * of those 175 have a video; the rest are two still frames, which the pages
 * that render them have always labelled honestly.
 *
 * `supabase/seed-exercises.sql` is the catalogue as the repository holds it —
 * extracted verbatim from the two migrations that populate it — so the claim
 * and the thing claimed can be read together, which is the only way either one
 * is checkable.
 */

const SEED = path.resolve("supabase/seed-exercises.sql");
const COPY_DIRS = [path.resolve("src/lib"), path.resolve("src/lib/i18n-locales")];

/** Every slug the seed inserts, as the first column of each row literal. */
function seededSlugs(): string[] {
  return [...readFileSync(SEED, "utf8").matchAll(/\('([a-z0-9-]+)','/g)].map((m) => m[1] ?? "");
}

function copyFiles(): { file: string; text: string }[] {
  // Two shapes: `src/lib/i18n*.ts`, which holds the Lithuanian and English
  // copy, and `src/lib/i18n-locales/*.ts`, one file per supplemental locale and
  // named for the locale rather than for i18n. A filter written for the first
  // shape reads none of the second, which is where six of the eight claims
  // lived.
  return COPY_DIRS.flatMap((dir) =>
    readdirSync(dir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name),
      )
      .filter((entry) => dir.endsWith("i18n-locales") || /^i18n/.test(entry.name))
      .map((entry) => ({
        file: path.join(dir, entry.name),
        text: readFileSync(path.join(dir, entry.name), "utf8"),
      })),
  );
}

/** A word for "exercise" in each of the eight shipped locales. */
const EXERCISE_WORD = /pratim|exercise|übung|ubung|ejercicio|exercice|ćwicz|упражн|вправ/i;
/**
 * A word for "video" in each of the eight shipped locales.
 *
 * Written first as `/video|wideo|vídeo|відео/i`, which is six locales and reads
 * like eight: Russian spells it `видео` and slipped straight through, on the
 * very claim this test was written for. A guard that watches one spelling
 * guards one spelling — the rule applies to alphabets too.
 */
const VIDEO_WORD = /video|vídeo|vidéo|wideo|видео|відео/i;

/** Every copy string that puts a number next to the word for "exercise". */
function countClaims(): { file: string; text: string; claimed: number }[] {
  return copyFiles().flatMap(({ file, text }) =>
    [...text.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
      .map((match) => match[1] ?? "")
      .filter((value) => EXERCISE_WORD.test(value) && /\d{2,}/.test(value))
      .map((value) => ({
        file: path.relative(process.cwd(), file),
        text: value,
        claimed: Number(/(\d{2,})/.exec(value)?.[1] ?? 0),
      })),
  );
}

describe("what the app tells a visitor the exercise catalogue is", () => {
  it("is checkable at all, because the catalogue is in the repository", () => {
    // A scan that quietly stops matching passes forever. Both halves are read
    // here: the seed, and the copy that describes it.
    const slugs = seededSlugs();
    expect(slugs.length).toBe(175);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(countClaims().length).toBeGreaterThanOrEqual(14);
  });

  it("never claims more exercises than the catalogue holds", () => {
    const total = seededSlugs().length;
    const overclaims = countClaims()
      .filter((claim) => claim.claimed > total)
      .map((claim) => `${claim.file}: ${claim.text}`);
    expect(overclaims).toEqual([]);
  });

  it("leaves slack, so one removed exercise does not make the copy false", () => {
    // "175+" against exactly 175 was true only in the reading nobody uses.
    const total = seededSlugs().length;
    const tight = countClaims()
      .filter((claim) => claim.claimed > total - 5)
      .map((claim) => `${claim.file}: ${claim.text}`);
    expect(tight).toEqual([]);
  });

  it("does not sell the library as a library of videos", () => {
    // Ten of 175. The pricing page put this claim beside a price.
    const withVideo = countClaims()
      .filter((claim) => VIDEO_WORD.test(claim.text))
      .map((claim) => `${claim.file}: ${claim.text}`);
    expect(withVideo).toEqual([]);
  });

  it("keeps the landing page's exact count equal to the catalogue, not merely under it", () => {
    // The gap this closes: `copyFiles()` reads `src/lib/i18n*` and
    // `src/lib/i18n-locales/*`, so the four loudest claims on the site were
    // scanned by nothing. The hero says "175 exercises" rather than "170+",
    // and since the head and `public/share-card.png` are both built from that
    // same copy, one unchecked number was being repeated on the landing page,
    // in every shared link and in every search result.
    //
    // Checked apart from the rules above rather than folded into them, because
    // it is a different claim shape. A floor ("170+") has to leave slack; an
    // exact count has to be exactly right, which is a stricter promise and the
    // one the hero deliberately makes. Folding the two together would also
    // have caught the unrelated "21" claims in the same files, which are not
    // about how big the catalogue is.
    const landing = readFileSync(path.resolve("src/components/FutureLabLanding.tsx"), "utf8");
    const total = seededSlugs().length;
    const claims = [...landing.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
      .map((match) => match[1] ?? "")
      .filter((value) => EXERCISE_WORD.test(value) && /\d{2,}/.test(value));
    // Both copy branches state it twice; a scan that stops finding them passes
    // forever.
    expect(claims.length).toBeGreaterThanOrEqual(4);
    const wrong = claims
      .filter((value) => Number(/(\d{2,})/.exec(value)?.[1] ?? 0) !== total)
      .map((value) => value.slice(0, 80));
    expect(wrong).toEqual([]);
  });

  it("is a claim the seed can still be measured against", () => {
    // The number the copy may not exceed is not a constant in this file; it is
    // counted from the seed. This pins the count that the other tests use.
    const slugs = seededSlugs();
    const videos = slugs.filter((slug) => getExerciseMedia(slug).type === "video");
    const frames = slugs.filter((slug) => getExerciseMedia(slug).type === "frames");
    expect(videos).toHaveLength(10);
    expect(frames).toHaveLength(165);
    expect(videos.length + frames.length).toBe(slugs.length);
  });
});
