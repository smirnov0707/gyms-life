import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Deleting an account has to delete what the account owns, and that is the
 * database's decision rather than a list kept in a server function.
 *
 * 33 tables carry `user_id references auth.users(id) on delete cascade`, so
 * removing the auth user removes their rows. `hydration_logs` was the
 * exception — a `user_id` with no foreign key at all — and deleting the account
 * would have left its rows behind, keyed to somebody who no longer exists. That
 * is the one thing an erasure request must not do, and it was invisible because
 * nothing compared the columns against the constraints.
 *
 * This reads the migrations, not the live database: a table added in a pull
 * request has to arrive wired, not be found later by a query somebody
 * remembered to run.
 *
 * Checked against production on 2026-10-03. The direction that matters holds —
 * every one of the 33 tables the database cascades is seen here, `profiles`
 * (which owns by `id`) and `ai_usage_daily` (wired by a quoted `alter table` in
 * the schema dump) included, and both were missed by a first version of this
 * parser. It also reports `ai_interactions`, which the database no longer has;
 * a table that exists only in the migrations cannot hide a real one, and if it
 * ever came back without a cascade the later `create table` would strand it
 * here.
 */

const MIGRATIONS = path.resolve("supabase/migrations");

/** Statements as written, in file order, so a later migration can correct an earlier one. */
function statements(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) => readFileSync(path.join(MIGRATIONS, file), "utf8").split(";"))
    .map((statement) =>
      statement
        .replace(/--[^\n]*/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Tables the migrations give a user-owning column, and whether it cascades.
 *
 * Two details this got wrong first, both of them in the data rather than the
 * idea. The reference is written `references auth.users on delete cascade` as
 * often as `references auth.users(id) ...`, so requiring the column list
 * reported `nutrition_logs`, `coach_messages` and `user_memory` as stranded
 * when the live database cascades all three. And tables are dropped and
 * recreated — `ai_interactions`, `user_insights`, `user_memory` all are — so
 * statements have to be processed in order and a drop has to remove the table,
 * exactly as `upsert-conflict-target.test.ts` learned about partial indexes.
 */
function ownership(): Map<string, boolean> {
  const owned = new Map<string, boolean>();
  // Ownership is "this table references auth.users", not "this table has a
  // column called user_id". `profiles` owns by `id`, and a guard written for
  // one spelling guards one spelling — the same mistake as the Supabase
  // `.error` scan that looked past fifteen reads through a renamed client.
  const OWNER_COLUMN = /\b(user_id|owner_id)\b|references auth\.users/i;
  const CASCADES = /references auth\.users\s*(?:\(\s*id\s*\))?[^,;]*on delete cascade/i;
  for (const statement of statements()) {
    const dropped = /drop table (?:if exists )?"?(?:public"?\."?)?"?([a-z0-9_]+)"?/i.exec(
      statement,
    );
    if (dropped?.[1]) {
      owned.delete(dropped[1]);
      continue;
    }
    const created =
      /create table (?:if not exists )?(?:"?public"?\s*\.\s*)?"?([a-z0-9_]+)"?\s*\(([\s\S]*)\)/i.exec(
        statement,
      );
    if (created) {
      const [, table, body] = created;
      // `public` is a schema, not a table: a quoted `create table "public"."x"`
      // used to be captured as a table named `public`, which then sat in the
      // cascading set looking like coverage.
      if (table === "public") continue;
      if (table && body && OWNER_COLUMN.test(body)) owned.set(table, CASCADES.test(body));
      continue;
    }
    // A constraint added later is how `hydration_logs` was repaired — and how
    // `ai_usage_daily` was wired all along, in `remote_schema.sql`, whose dump
    // style quotes the schema: `alter table "public"."x"`. A pattern written
    // for the unquoted form read neither.
    const altered =
      /alter table (?:only )?(?:"?public"?\s*\.\s*)?"?([a-z0-9_]+)"?[\s\S]*?foreign key\s*\(\s*(?:user_id|owner_id)\s*\)\s*references auth\.users\s*(?:\(\s*id\s*\))?[^;]*on delete cascade/i.exec(
        statement,
      );
    if (altered?.[1]) owned.set(altered[1], true);
    const addedColumn =
      /alter table (?:only )?(?:"?public"?\s*\.\s*)?"?([a-z0-9_]+)"?[\s\S]*?add column (?:if not exists )?(user_id|owner_id)\b([\s\S]*)/i.exec(
        statement,
      );
    if (addedColumn?.[1] && !owned.has(addedColumn[1])) {
      owned.set(addedColumn[1], CASCADES.test(addedColumn[3] ?? ""));
    }
  }
  return owned;
}

/**
 * Tables whose owning column deliberately does not cascade, each with the
 * reason it does not. An entry here is a decision, not an oversight.
 */
const DELIBERATE_EXCEPTIONS: Record<string, string> = {
  app_observability_events:
    "on delete set null — operational events outlive the account without naming the person",
};

describe("erasing an account", () => {
  it("is reading the migrations it claims to read", () => {
    // A scan that quietly stops matching passes forever, and this one has been
    // wrong in three different ways: a reference written without `(id)`, a
    // table that owns by `id` rather than `user_id`, and a dump that quotes the
    // schema. Each name below is one of those.
    const owned = ownership();
    expect(owned.size).toBeGreaterThanOrEqual(30);
    for (const table of [
      "set_logs",
      "hydration_logs",
      "profiles",
      "ai_usage_daily",
      "nutrition_logs",
      "user_memory",
    ]) {
      expect(owned.get(table)).toBe(true);
    }
  });

  it("reaches every table that carries a user's rows", () => {
    const stranded = [...ownership()]
      .filter(([table, cascades]) => !cascades && !(table in DELIBERATE_EXCEPTIONS))
      .map(([table]) => table);
    expect(stranded).toEqual([]);
  });

  it("names a reason for each table that is left out on purpose", () => {
    for (const [table, reason] of Object.entries(DELIBERATE_EXCEPTIONS)) {
      expect(ownership().has(table)).toBe(true);
      expect(reason.length).toBeGreaterThan(20);
    }
  });

  it("deletes through the auth user rather than a list of tables", () => {
    // A hand-written list of 33 deletes is one forgotten table away from an
    // erasure that is not one. The cascade is the only version of this that
    // stays correct when somebody adds a table.
    const source = readFileSync(path.resolve("src/lib/delete-account.functions.ts"), "utf8");
    expect(source).toMatch(/auth\.admin\.deleteUser\(userId\)/);
    expect(source).not.toMatch(/\.from\("[a-z_]+"\)[\s\S]{0,40}\.delete\(/);
  });

  it("writes the erasure down before the row that would name it is gone", () => {
    // `app_observability_events.user_id` is set to null by the cascade, so the
    // event has to be recorded first or it cannot be attributed at all.
    const source = readFileSync(path.resolve("src/lib/delete-account.functions.ts"), "utf8");
    const record = source.indexOf("recordObservabilityEvent");
    const destroy = source.indexOf("auth.admin.deleteUser");
    expect(record).toBeGreaterThan(0);
    expect(record).toBeLessThan(destroy);
  });
});
