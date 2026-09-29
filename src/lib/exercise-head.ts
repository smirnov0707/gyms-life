import { supabase } from "@/integrations/supabase/client";

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
export async function readExerciseName(slug: string): Promise<ExerciseName> {
  try {
    const { data, error } = await supabase
      .from("exercises")
      .select("name_lt, name_en")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      reportShortfall("EXERCISE_NAME_READ_FAILED", slug);
      return null;
    }
    // The server renders Lithuanian for everybody — `__root.tsx` serves
    // `<html lang="lt">` and the language is chosen after hydration — so the
    // head is Lithuanian first and English only where there is no Lithuanian.
    return data?.name_lt ?? data?.name_en ?? null;
  } catch {
    reportShortfall("EXERCISE_NAME_READ_THREW", slug);
    return null;
  }
}

export interface HeadMetaEntry {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
}

/** The head for one exercise page, from its slug and whatever name was read. */
export function exerciseHeadMeta(slug: string, name: ExerciseName): HeadMetaEntry[] {
  // Falling back to the slug keeps the page titled with something rather than
  // nothing; it is the old behaviour, now reached only when the read failed.
  const label = name ?? slug;
  return [
    { title: `${label} — pratimo technika ir video | GYMS.LIFE` },
    {
      name: "description",
      content: `${label}: technika žingsnis po žingsnio, dažniausios klaidos ir vaizdo demonstracija.`,
    },
    { property: "og:title", content: `${label} — pratimo technika | GYMS.LIFE` },
    {
      property: "og:description",
      content: `Kaip taisyklingai atlikti pratimą „${label}“ — video ir patarimai.`,
    },
  ];
}
