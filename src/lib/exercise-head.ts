import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getExerciseMedia, type MediaType } from "@/lib/exercise-media";

/**
 * What a crawler, a chat preview and a browser tab are told an exercise page is.
 *
 * The sitemap advertises 175 of these pages and they are the entire indexable
 * surface of the site. Every one of them was titled with its URL slug —
 * `ab-wheel — pratimo technika ir video | GYMS.LIFE` — because `head()` is
 * handed the route params and nothing else, and the slug is the only string in
 * them. The exercise's actual name, `Ratukas presui`, sat one column away in a
 * table the page already reads, after hydration, too late for the head.
 *
 * A slug is a machine key. It is what the address bar needs and the last thing
 * a person searching for an exercise types.
 */

/** A name the page could not read is null, never the slug dressed up as one. */
export type ExerciseName = string | null;

type NameShortfall = "EXERCISE_NAME_READ_FAILED" | "EXERCISE_NAME_READ_THREW";

function reportShortfall(code: NameShortfall, slug: string): void {
  // Same convention as `sitemap[.]xml.ts` and `health-ingest.ts`: this runs for
  // a visitor who may not be signed in, and `recordObservabilityEvent` needs a
  // user id. Falling back to the slug is survivable; falling back silently is
  // how every page on the site could carry a machine key for three weeks.
  console.error("Exercise head name unavailable", { code, slug });
}

/**
 * Reads the display name for a slug, and never throws.
 *
 * A loader that rejects takes the whole route to its error boundary, and the
 * page's own read already distinguishes "could not load" from "does not
 * exist" — carefully, because it once did not. This read exists only to title
 * the document, so its failure mode is the title it had before.
 */
export type ExerciseRow = Tables<"exercises">;

/**
 * Reads the exercise before the document is written, and never throws.
 *
 * The head needs the name, and the page needs the row: the instructions, the
 * mistakes, the muscle group and the equipment that the structured data and the
 * visible body are both built from. Reading it in the loader is what puts any
 * of that into the server HTML — before this, the page fetched after hydration
 * and the server sent a spinner, so every crawler that does not execute
 * JavaScript saw 175 pages with no exercise on them.
 */
export async function readExerciseRow(slug: string): Promise<ExerciseRow | null> {
  try {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      reportShortfall("EXERCISE_NAME_READ_FAILED", slug);
      return null;
    }
    return data;
  } catch {
    reportShortfall("EXERCISE_NAME_READ_THREW", slug);
    return null;
  }
}

/** The display name for a row, or null — never the slug dressed up as one. */
export function exerciseName(row: ExerciseRow | null): ExerciseName {
  // The server renders Lithuanian for everybody — `__root.tsx` serves
  // `<html lang="lt">` and the language is chosen after hydration — so the
  // head is Lithuanian first and English only where there is no Lithuanian.
  return row?.name_lt ?? row?.name_en ?? null;
}

export async function readExerciseName(slug: string): Promise<ExerciseName> {
  return exerciseName(await readExerciseRow(slug));
}

export interface HeadMetaEntry {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
}

/**
 * What each kind of demonstration may be called before anybody has seen it.
 *
 * `getExerciseMedia` answers `video`, `frames` or `fallback`, and of the 175
 * exercises in the catalogue exactly 10 answer `video`. The other 165 are two
 * JPEGs the page cross-fades, labelled `Kadras 1` / `Kadras 2` — which the page
 * itself has always been honest about, in the caption, once you are on it. The
 * head was not: every one of those 165 pages promised `video` in the tab, the
 * search snippet and the shared link, and the library index promised "175+
 * pratimų su technikos video" on top.
 *
 * `Record<MediaType, …>` makes the compiler ask for all three. It cannot ask
 * that they differ, which is exactly what went wrong, so that is tested.
 */
const DEMONSTRATION: Record<MediaType, { title: string; description: string; share: string }> = {
  video: {
    title: "technika ir vaizdo demonstracija",
    description: "dažniausios klaidos ir vaizdo demonstracija",
    share: "vaizdo demonstracija ir patarimai",
  },
  frames: {
    title: "technika žingsnis po žingsnio",
    description: "dažniausios klaidos ir judesio kadrai",
    share: "judesio kadrai ir patarimai",
  },
  fallback: {
    title: "pratimo technika",
    description: "dažniausios klaidos ir technikos patarimai",
    share: "technikos patarimai ir dažniausios klaidos",
  },
};

/** The head for one exercise page, from its slug and whatever name was read. */
export function exerciseHeadMeta(slug: string, name: ExerciseName): HeadMetaEntry[] {
  // Falling back to the slug keeps the page titled with something rather than
  // nothing; it is the old behaviour, now reached only when the read failed.
  const label = name ?? slug;
  // The media lives in a static map keyed by slug, so this needs no read and
  // cannot disagree with what the page will actually render.
  const demo = DEMONSTRATION[getExerciseMedia(slug).type];
  return [
    { title: `${label} — ${demo.title} | GYMS.LIFE` },
    {
      name: "description",
      content: `${label}: technika žingsnis po žingsnio, ${demo.description}.`,
    },
    { property: "og:title", content: `${label} — pratimo technika | GYMS.LIFE` },
    {
      property: "og:description",
      content: `Kaip taisyklingai atlikti pratimą „${label}“ — ${demo.share}.`,
    },
  ];
}
