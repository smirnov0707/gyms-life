import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const SITE_URL = "https://gyms.life";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

/**
 * Why the exercise section of this sitemap is shorter than the catalogue.
 *
 * Fail-open is right here: a crawler handed the seven static pages is better
 * served than one handed a 500, and a sitemap is advice rather than a
 * contract. Fail-silent is a different thing. The catalogue is 175 exercise
 * pages and those are the entire indexable surface of this site — the seven
 * static entries are the shell around them. `if (error || !data) break;` ships
 * the shell, answers 200, and tells Google this is a seven-page site; nothing
 * anywhere would have said otherwise.
 *
 * `SITEMAP_DATABASE_UNCONFIGURED` is the one most likely to be true for a long
 * time without anybody noticing: it is a deploy-environment fact, not a
 * database fault, and it looks exactly like a site that has no exercises.
 */
type SitemapShortfall =
  "SITEMAP_DATABASE_UNCONFIGURED" | "SITEMAP_EXERCISE_READ_FAILED" | "SITEMAP_EXERCISE_READ_THREW";

/**
 * The house pattern for a public surface with no signed-in athlete to attribute
 * an event to — `recordObservabilityEvent` requires a user id, and a crawler
 * has none. `health-ingest.ts` and the payments webhook log the same way.
 */
function reportShortfall(code: SitemapShortfall, collected: number): void {
  console.error("Sitemap exercise list incomplete", { code, collected });
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const BASE_URL = SITE_URL;
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/pricing", changefreq: "monthly", priority: "0.9" },
          { path: "/exercises", changefreq: "weekly", priority: "0.9" },
          { path: "/auth", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/refund", changefreq: "yearly", priority: "0.3" },
        ];
        let exercisesCollected = 0;

        try {
          const { createClient } = await import("@supabase/supabase-js");
          const key =
            process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
          const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
          if (!key || !url) {
            reportShortfall("SITEMAP_DATABASE_UNCONFIGURED", 0);
          } else {
            const supabase = createClient(url, key, {
              auth: { persistSession: false, autoRefreshToken: false },
              global: {
                fetch: (input, init) => {
                  const headers = new Headers(init?.headers);
                  if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) {
                    headers.delete("Authorization");
                  }
                  headers.set("apikey", key);
                  return fetch(input, { ...init, headers });
                },
              },
            });
            const pageSize = 1000;
            for (let offset = 0; ; offset += pageSize) {
              const { data, error } = await supabase
                .from("exercises")
                .select("slug")
                .order("slug")
                .range(offset, offset + pageSize - 1);
              // A read that failed is not a read that found nothing, and the
              // difference is invisible in the answer: both end the loop with a
              // sitemap that is simply shorter than the catalogue.
              if (error || !data) {
                reportShortfall("SITEMAP_EXERCISE_READ_FAILED", exercisesCollected);
                break;
              }
              exercisesCollected += data.length;
              entries.push(
                ...data.map((row: { slug: string }) => ({
                  path: `/exercises/${encodeURIComponent(row.slug)}`,
                  changefreq: "monthly" as const,
                  priority: "0.6",
                })),
              );
              if (data.length < pageSize) break;
            }
          }
        } catch {
          // Still fall back to the static entries above — but say so, because a
          // 200 carrying seven URLs is otherwise indistinguishable from a site
          // that has seven pages.
          reportShortfall("SITEMAP_EXERCISE_READ_THREW", exercisesCollected);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
