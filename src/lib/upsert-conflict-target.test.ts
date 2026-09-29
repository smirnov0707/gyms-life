import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The most expensive bug this codebase has shipped.
 *
 * `personal_timeline_events` was created with a *partial* unique index:
 *
 *     create unique index personal_timeline_source_event_unique
 *       on public.personal_timeline_events(user_id, source_system, source_reference, event_type)
 *       where source_reference is not null;
 *
 * and the writer upserted with
 * `onConflict: "user_id,source_system,source_reference,event_type"`. PostgREST
 * turns that into a bare `on conflict (cols)`, and Postgres will not infer a
 * partial index from an inference clause that omits its predicate. Every write
 * answered 42P10. Production held 233 `PERSONAL_TIMELINE_WRITE_FAILED` events
 * and an empty table, for weeks, because the writer swallows its error on
 * purpose so a failed index write can never cost an athlete a finished workout.
 *
 * Nothing about that was visible in either file alone. The upsert was correct.
 * The index was correct. Only the pair was wrong, and no test read both.
 *
 * This reads both. For every `onConflict` in the application it requires a
 * unique constraint or index on exactly that set of columns, and requires it
 * not to be partial.
 */

const SRC = path.resolve("src");
const MIGRATIONS = path.resolve("supabase/migrations");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Postgres infers a conflict target by column *set*, so order must not matter. */
const columnKey = (columns: readonly string[]) =>
  [...columns]
    .map((column) => column.trim().toLowerCase())
    .sort()
    .join(",");

type UniqueTarget = { partial: boolean; name: string };

/**
 * Every unique constraint and index the migrations leave standing.
 *
 * Statements are read in file order and then in source order within a file,
 * because the fix for this very bug drops an index and recreates it in one
 * migration — read out of order, the drop would erase the repair.
 */
function uniqueTargets(sqlSources: readonly string[]): Map<string, Map<string, UniqueTarget>> {
  const tables = new Map<string, Map<string, UniqueTarget>>();
  const add = (table: string, columns: string[], partial: boolean, name: string) => {
    if (!tables.has(table)) tables.set(table, new Map());
    tables.get(table)!.set(columnKey(columns), { partial, name });
  };
  const dropByName = (name: string) => {
    for (const set of tables.values())
      for (const [key, value] of set) if (value.name === name) set.delete(key);
  };

  for (const source of sqlSources) {
    for (const statement of source.replace(/--[^\n]*/g, "").split(";")) {
      const trimmed = statement.trim();
      let match: RegExpExecArray | null;

      if (
        (match =
          /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*)\)\s*$/i.exec(
            trimmed,
          ))
      ) {
        const table = match[1] ?? "";
        const body = match[2] ?? "";
        for (const inline of body.matchAll(/\bunique\s*\(([^)]+)\)/gi)) {
          const columns = (inline[1] ?? "").split(",");
          add(table, columns, false, `inline:${columnKey(columns)}`);
        }
        for (const line of body.split("\n")) {
          const column = /^\s*(\w+)\s+[\w ().]*?\b(?:unique|primary key)\b/i.exec(line);
          if (column && !/^\s*(?:constraint|unique|primary)\b/i.test(line))
            add(table, [column[1] ?? ""], false, `column:${column[1]}`);
        }
        continue;
      }
      if (
        (match =
          /alter\s+table\s+(?:only\s+)?(?:public\.)?(\w+)[\s\S]*?add\s+constraint\s+(\w+)\s+unique\s*\(([^)]+)\)/i.exec(
            trimmed,
          ))
      ) {
        add(match[1] ?? "", (match[3] ?? "").split(","), false, match[2] ?? "");
        continue;
      }
      if (
        (match =
          /create\s+unique\s+index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(\w+)\s+on\s+(?:public\.)?(\w+)\s*\(([^)]+)\)([\s\S]*)$/i.exec(
            trimmed,
          ))
      ) {
        // The whole point: a `where` clause makes the index un-inferrable.
        add(
          match[2] ?? "",
          (match[3] ?? "").split(","),
          /\bwhere\b/i.test(match[4] ?? ""),
          match[1] ?? "",
        );
        continue;
      }
      if ((match = /drop\s+index\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)/i.exec(trimmed))) {
        dropByName(match[1] ?? "");
        continue;
      }
      if (
        (match =
          /alter\s+table\s+(?:public\.)?(\w+)[\s\S]*?drop\s+constraint\s+(?:if\s+exists\s+)?(\w+)/i.exec(
            trimmed,
          ))
      ) {
        dropByName(match[2] ?? "");
      }
    }
  }
  return tables;
}

type UpsertSite = { file: string; line: number; table: string | null; columns: string[] };

/** The table is the nearest `.from("x")` before the `onConflict`. */
function upsertSites(): UpsertSite[] {
  return walk(SRC).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const relative = path.relative(SRC, file).split(path.sep).join("/");
    return [...source.matchAll(/onConflict:\s*"([^"]+)"/g)].map((match) => {
      const before = source.slice(0, match.index);
      const froms = [...before.matchAll(/\.from\(\s*"([^"]+)"\s*\)/g)];
      return {
        file: relative,
        line: before.split("\n").length,
        table: froms.at(-1)?.[1] ?? null,
        columns: (match[1] ?? "").split(","),
      };
    });
  });
}

const migrationSql = () =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS, name), "utf8"));

describe("every upsert's conflict target", () => {
  it("is backed by a unique constraint Postgres can actually infer", () => {
    const tables = uniqueTargets(migrationSql());
    const broken = upsertSites().flatMap((site) => {
      const found = site.table ? tables.get(site.table)?.get(columnKey(site.columns)) : undefined;
      const where = `${site.file}:${site.line} ${site.table ?? "unknown table"} (${site.columns.join(",")})`;
      if (!found) return [`${where} — no unique constraint on these columns`];
      // 42P10. The write fails every time, and an upsert's error is usually the
      // one a caller is most willing to forgive.
      if (found.partial) return [`${where} — matched only a partial index: ${found.name}`];
      return [];
    });
    expect(broken).toEqual([]);
  });

  it("is checked for every upsert in the application, not a sample", () => {
    const sites = upsertSites();
    // A scan that quietly matches nothing passes forever.
    expect(sites.length).toBeGreaterThanOrEqual(15);
    expect(sites.filter((site) => site.table === null)).toEqual([]);
  });
});

describe("the reader behind that check", () => {
  it("would have caught the timeline defect as it was originally written", () => {
    // The exact index that cost production 233 failed writes.
    const tables = uniqueTargets([
      `create table public.personal_timeline_events (
         id uuid primary key default gen_random_uuid(),
         user_id uuid not null,
         source_system text not null,
         source_reference text,
         event_type text not null
       );
       create unique index personal_timeline_source_event_unique
         on public.personal_timeline_events(user_id, source_system, source_reference, event_type)
         where source_reference is not null;`,
    ]);
    const found = tables
      .get("personal_timeline_events")
      ?.get(columnKey(["user_id", "source_system", "source_reference", "event_type"]));
    expect(found?.partial).toBe(true);
  });

  it("reads a drop and a recreate in the order Postgres would", () => {
    // The repair drops the partial index and recreates it plainly in one file.
    // Read out of order, the drop erases the fix and the guard cries wolf.
    const tables = uniqueTargets([
      `create unique index u on public.t (a, b) where a is not null;`,
      `drop index if exists public.u;
       create unique index u on public.t (a, b);`,
    ]);
    expect(tables.get("t")?.get("a,b")).toEqual({ partial: false, name: "u" });
  });

  it("matches a conflict target by column set, not by the order it was written", () => {
    // `on_conflict` is a set for Postgres, so the check must not depend on the
    // order somebody happened to type.
    const tables = uniqueTargets(["create unique index u on public.t (b, a);"]);
    expect(tables.get("t")?.get(columnKey(["a", "b"]))).toBeDefined();
  });

  it("forgets a constraint that was dropped and never replaced", () => {
    const tables = uniqueTargets([
      `alter table public.t add constraint t_ab unique (a, b);`,
      `alter table public.t drop constraint t_ab;`,
    ]);
    expect(tables.get("t")?.get("a,b")).toBeUndefined();
  });
});
