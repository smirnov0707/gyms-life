import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The only path into this database that does not carry a signed-in session.
 *
 * Everything else in the app answers as the person who asked; this answers to
 * whoever holds a uuid, from any origin. So the properties worth pinning are
 * not about copy: a malformed token must cost no database work at all, an
 * unknown token must be refused rather than filed under somebody, a failed
 * read must not be reported as success, and a sample dated outside the
 * accepted window must be refused with a reason rather than quietly filed
 * under today.
 */

type Answer = { data?: unknown; error?: unknown };

/** What each table answers, in call order. Missing means "never touched". */
let script: Record<string, Answer[]>;
let touched: string[];
/** Every row handed to `upsert`, so a test can assert what was written. */
let written: Record<string, Record<string, unknown>[]>;

function builder(table: string) {
  const answer = () => {
    touched.push(table);
    const next = script[table]?.shift();
    if (!next) throw new Error(`unscripted read of ${table}`);
    return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
  };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "not", "gte", "lt"]) {
    chain[method] = () => chain;
  }
  chain["maybeSingle"] = answer;
  chain["limit"] = answer;
  chain["upsert"] = (row: Record<string, unknown>) => {
    (written[table] ??= []).push(row);
    return answer();
  };
  return chain;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => builder(table) },
}));

const TOKEN = "11111111-2222-4333-8444-555555555555";

async function post(body: unknown) {
  const { Route } = await import("./health-ingest");
  // The file route exposes its handlers; there is no server to go through.
  const handlers = (
    Route as unknown as {
      options: {
        server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } };
      };
    }
  ).options.server.handlers;
  const request = new Request("https://gyms.life/api/public/health-ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const response = await handlers.POST({ request });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("public health ingest", () => {
  beforeEach(() => {
    script = {};
    touched = [];
    written = {};
  });

  it("refuses a body that is not JSON without reading anything", async () => {
    const { status } = await post("{not json");
    expect(status).toBe(400);
    expect(touched).toEqual([]);
  });

  it("refuses a token that is not a uuid before touching the database", async () => {
    // The cost of a wrong guess has to be zero: this endpoint is reachable by
    // anyone with the URL, and a read per attempt is an amplifier.
    for (const token of [undefined, "", "not-a-uuid", 12345]) {
      const { status } = await post({ token, resting_hr: 50 });
      expect(status).toBe(400);
    }
    expect(touched).toEqual([]);
  });

  it("refuses a token nobody holds, and files nothing", async () => {
    script = { profiles: [{ data: null }] };
    const { status } = await post({ token: TOKEN, resting_hr: 50 });
    expect(status).toBe(401);
    expect(touched).toEqual(["profiles"]);
  });

  it("reports a failed lookup as unavailable rather than as an unknown token", async () => {
    script = { profiles: [{ error: { code: "57014" } }] };
    const { status, body } = await post({ token: TOKEN, resting_hr: 50 });
    expect(status).toBe(503);
    expect(String(body["error"])).toMatch(/temporarily unavailable/i);
  });

  it("refuses a date it cannot read instead of filing the reading under today", async () => {
    script = { profiles: [{ data: { id: "u1", time_zone: "Europe/Vilnius" } }] };
    const { status, body } = await post({ token: TOKEN, date: "yesterday", resting_hr: 50 });
    expect(status).toBe(400);
    expect(body["error"]).toBe("Unreadable date");
    // The sample write must not have happened.
    expect(touched).toEqual(["profiles"]);
  });

  it("refuses a date outside the accepted window, and says what the window is", async () => {
    script = { profiles: [{ data: { id: "u1", time_zone: "UTC" } }] };
    const { status, body } = await post({ token: TOKEN, date: "1999-01-01", resting_hr: 50 });
    expect(status).toBe(400);
    expect(body["error"]).toBe("Date out of range");
    expect(String(body["message"])).toMatch(/\d+ days/);
    expect(touched).toEqual(["profiles"]);
  });

  it("does not report success when the sample write failed", async () => {
    script = {
      profiles: [{ data: { id: "u1", time_zone: "UTC" } }],
      health_samples: [{ data: [] }, { error: { code: "23505" } }],
    };
    const { status, body } = await post({ token: TOKEN, resting_hr: 50 });
    expect(status).toBe(503);
    expect(body["ok"]).toBeUndefined();
  });

  it("stores a valid sample and echoes back what was actually written", async () => {
    script = {
      profiles: [{ data: { id: "u1", time_zone: "UTC" } }],
      health_samples: [{ data: [] }, {}],
      daily_checkins: [{}],
    };
    const { status, body } = await post({ token: TOKEN, resting_hr: 52, steps: 8000 });
    expect(status).toBe(200);
    expect(body["ok"]).toBe(true);
    expect(body["stored"]).toMatchObject({ resting_hr: 52, steps: 8000 });
    // A sample dated today also becomes today's check-in.
    expect(touched).toEqual(["profiles", "health_samples", "health_samples", "daily_checkins"]);
  });

  it("stores sleep stages, and leaves the ones nobody reported null", async () => {
    script = {
      profiles: [{ data: { id: "u1", time_zone: "UTC" } }],
      health_samples: [{ data: [] }, {}],
      daily_checkins: [{}],
    };
    const { body } = await post({
      token: TOKEN,
      sleep_hours: 7.2,
      sleep_rem_minutes: 96,
      sleep_deep_minutes: 82,
      sleep_core_minutes: 256,
    });
    const row = written["health_samples"]?.[0];
    expect(row).toMatchObject({
      sleep_rem_minutes: 96,
      sleep_deep_minutes: 82,
      sleep_core_minutes: 256,
    });
    // Nobody reported time awake, so nothing is claimed about it.
    expect(row && row["sleep_awake_minutes"]).toBeNull();
    expect(body["dropped"]).toBeUndefined();
  });

  it("stores no readiness when too little was measured, and does not touch the plan", async () => {
    script = {
      profiles: [{ data: { id: "u1", time_zone: "UTC" } }],
      health_samples: [{ data: [] }, {}],
      daily_checkins: [{}],
    };
    // A step count alone. This used to produce a readiness score and cut the
    // day's prescribed load by a fifth.
    const { body } = await post({ token: TOKEN, steps: 8342 });
    expect(body["recovery_score"]).toBeNull();
    expect(body["load_modifier"]).toBe(1);
    expect(written["health_samples"]?.[0]?.["recovery_score"]).toBeNull();
  });

  it("never writes a null readiness over an answer the athlete typed in", async () => {
    script = {
      profiles: [{ data: { id: "u1", time_zone: "UTC" } }],
      health_samples: [{ data: [] }, {}],
      daily_checkins: [{}],
    };
    const { status } = await post({ token: TOKEN, steps: 8342 });
    expect(status).toBe(200);
    const checkin = written["daily_checkins"]?.[0];
    // The check-in row is shared with the manual morning check-in. A watch
    // sync that measured nothing must leave those fields alone rather than
    // overwrite them with null.
    expect(checkin).toBeDefined();
    expect(checkin && "readiness_score" in checkin).toBe(false);
    expect(checkin && "load_modifier" in checkin).toBe(false);
    expect(checkin && "sleep_hours" in checkin).toBe(false);
    expect(checkin).toMatchObject({ user_id: "u1" });
  });

  it("keeps the rest of a sample whose stages contradict its own duration, and says so", async () => {
    script = {
      profiles: [{ data: { id: "u1", time_zone: "UTC" } }],
      health_samples: [{ data: [] }, {}],
      daily_checkins: [{}],
    };
    const { status, body } = await post({
      token: TOKEN,
      resting_hr: 52,
      sleep_hours: 7.2,
      sleep_rem_minutes: 900,
      sleep_deep_minutes: 400,
    });
    expect(status).toBe(200);
    expect(body["dropped"]).toBe("sleep_stages");
    const row = written["health_samples"]?.[0];
    // The heart rate and the duration survive; only the impossible night goes.
    expect(row).toMatchObject({ resting_hr: 52, sleep_hours: 7.2 });
    expect(row && row["sleep_rem_minutes"]).toBeNull();
    expect(row && row["sleep_deep_minutes"]).toBeNull();
  });
});
