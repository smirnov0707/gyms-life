import { supabase } from "@/integrations/supabase/client";
import { withDeadline } from "@/lib/read-deadline";

/**
 * Every exercise the library holds, read before the page is rendered.
 *
 * The library page fetched its catalogue after hydration, so the server HTML
 * carried a spinner and — the part that matters — not one link to any of the
 * 175 exercise pages. The sitemap advertises them all at priority 0.6; nothing
 * on the site itself pointed at a single one of them, so the only crawlable
 * path to the whole indexable surface was the sitemap's word for it.
 *
 * Narrow on purpose. The full catalogue is 148 kB of JSON once the
 * instructions and mistakes are included, and inlining that into every request
 * would make this page eight times heavier. A name and a link need three
 * columns, and nothing here reads a fourth.
 */

export interface CatalogueEntry {
  slug: string;
  name_lt: string | null;
  name_en: string | null;
}

type CatalogueShortfall =
  | "EXERCISE_CATALOGUE_READ_FAILED"
  | "EXERCISE_CATALOGUE_READ_THREW"
  | "EXERCISE_CATALOGUE_READ_TIMED_OUT";

function reportShortfall(code: CatalogueShortfall, collected: number): void {
  // Same convention as the sitemap and the exercise head: this runs for a
  // visitor who may not be signed in, so there is no user id to attribute an
  // observability event to. A shorter list is survivable; a silently shorter
  // one is how the sitemap lost its whole catalogue without anybody noticing.
  console.error("Exercise catalogue index incomplete", { code, collected });
}

const PAGE = 1000;

/**
 * Reads the catalogue for the page's own index, and never throws.
 *
 * A loader that rejects takes the route to its error boundary, and the page's
 * own query already distinguishes a failed read from an empty catalogue —
 * "this app has no exercises" is never true, and that read was fixed so it
 * could not say so. This read exists to render links, so its failure mode is
 * the page that was there before: no links.
 */
export async function readExerciseCatalogueIndex(): Promise<CatalogueEntry[]> {
  const collected: CatalogueEntry[] = [];
  try {
    for (let offset = 0; ; offset += PAGE) {
      // The loader blocks the route, so a read that never answers is a page
      // that never appears. Before the catalogue moved into a loader this page
      // opened with its own loading state; it has to keep doing that.
      const page = await withDeadline(
        supabase
          .from("exercises")
          .select("slug, name_lt, name_en")
          .order("name_lt")
          .range(offset, offset + PAGE - 1),
      );
      if (page.status === "timed_out") {
        reportShortfall("EXERCISE_CATALOGUE_READ_TIMED_OUT", collected.length);
        return collected;
      }
      const { data, error } = page.value;
      if (error || !data) {
        reportShortfall("EXERCISE_CATALOGUE_READ_FAILED", collected.length);
        return collected;
      }
      collected.push(...data);
      if (data.length < PAGE) return collected;
    }
  } catch {
    reportShortfall("EXERCISE_CATALOGUE_READ_THREW", collected.length);
    return collected;
  }
}

/** The name to show, Lithuanian first, because the server renders Lithuanian. */
export function catalogueEntryName(entry: CatalogueEntry): string {
  return entry.name_lt ?? entry.name_en ?? entry.slug;
}

/** The entries grouped by first letter, for an A–Z index a person can use. */
export function groupCatalogueByLetter(
  entries: readonly CatalogueEntry[],
): { letter: string; entries: CatalogueEntry[] }[] {
  const groups = new Map<string, CatalogueEntry[]>();
  for (const entry of entries) {
    const letter = catalogueEntryName(entry).trim().charAt(0).toLocaleUpperCase("lt-LT") || "#";
    const bucket = groups.get(letter);
    if (bucket) bucket.push(entry);
    else groups.set(letter, [entry]);
  }
  return [...groups.entries()]
    .map(([letter, grouped]) => ({
      letter,
      entries: [...grouped].sort((a, b) =>
        catalogueEntryName(a).localeCompare(catalogueEntryName(b), "lt"),
      ),
    }))
    .sort((a, b) => a.letter.localeCompare(b.letter, "lt"));
}
