import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recoveryScore, healthLoadModifier } from "@/lib/health-metrics";
import {
  normalizeHealthPayload,
  normalizeDate,
  sampleDateWithinWindow,
  SAMPLE_BACKFILL_DAYS,
} from "@/lib/health-normalize";
import { DEFAULT_HEALTH_SAMPLE_SOURCE, HEALTH_SAMPLE_SOURCES } from "@/lib/health-sample-source";
import { dayInTimeZone } from "@/lib/local-day";

const Envelope = z.object({
  token: z.string().uuid(),
  // A sender that does not say what it is gets recorded as unknown, not as
  // a named vendor. What arrives without saying where it came from is a
  // reading whose origin we do not know.
  source: z.enum(HEALTH_SAMPLE_SOURCES).default(DEFAULT_HEALTH_SAMPLE_SOURCE),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

export const Route = createFileRoute("/api/public/health-ingest")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return json({ error: "Invalid payload" }, 400);
        }
        const raw = body as Record<string, unknown>;

        const parsed = Envelope.safeParse({
          token: typeof raw["token"] === "string" ? raw["token"].trim() : raw["token"],
          ...(raw["source"] ? { source: raw["source"] } : {}),
        });
        if (!parsed.success) return json({ error: "Invalid payload" }, 400);
        const p = { ...parsed.data, ...normalizeHealthPayload(raw) };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("id, time_zone")
          .eq("health_token", p.token)
          .maybeSingle();

        if (profileError) {
          console.error("Health ingest profile lookup failed", { code: profileError.code });
          return json({ error: "Health sync is temporarily unavailable" }, 503);
        }
        if (!profile) return json({ error: "Unauthorized" }, 401);

        const userId = profile.id;
        // The athlete's calendar day, not UTC's. Every athlete east of
        // Greenwich spends their small hours on the previous UTC date, and
        // both uses below turn on which day this sample belongs to.
        let athleteToday: string;
        try {
          athleteToday = dayInTimeZone(new Date(), profile.time_zone ?? "UTC");
        } catch {
          athleteToday = dayInTimeZone(new Date(), "UTC");
        }
        const requestedDay = raw["date"] ?? raw["sample_on"] ?? raw["day"];
        const sampleOn = normalizeDate(requestedDay) ?? athleteToday;

        // A date the sender supplied but we could not read, or one years away,
        // is a broken automation. Refusing it with a reason is the only way
        // its owner ever finds out; filing it under today would quietly put a
        // reading on a day it did not happen.
        if (requestedDay !== undefined && requestedDay !== null && requestedDay !== "") {
          if (normalizeDate(requestedDay) === null) {
            return json({ error: "Unreadable date" }, 400);
          }
          if (!sampleDateWithinWindow(sampleOn, athleteToday)) {
            return json(
              {
                error: "Date out of range",
                message: `A sample must be dated within the last ${SAMPLE_BACKFILL_DAYS} days and not in the future.`,
              },
              400,
            );
          }
        }

        const { data: history, error: historyError } = await supabaseAdmin
          .from("health_samples")
          .select("resting_hr, hrv_ms")
          .eq("user_id", userId)
          .order("sample_on", { ascending: false })
          .limit(30);

        if (historyError) {
          console.error("Health ingest history lookup failed", { code: historyError.code });
          return json({ error: "Health sync is temporarily unavailable" }, 503);
        }

        const avg = (nums: (number | null)[]) => {
          const list = nums.filter((n): n is number => typeof n === "number");
          return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
        };

        const readiness = recoveryScore(
          {
            restingHr: p.restingHr,
            hrvMs: p.hrvMs,
            sleepHours: p.sleepHours,
            sleepQuality: p.sleepQuality,
            steps: p.steps,
            activeKcal: p.activeKcal,
          },
          {
            restingHr: avg((history ?? []).map((h) => h.resting_hr as number | null)),
            hrvMs: avg((history ?? []).map((h) => h.hrv_ms as number | null)),
          },
        );
        // Null when too little was measured to say anything. Stored as null
        // rather than as a low number: an athlete whose watch sent only a step
        // count has not been measured as unrecovered.
        const score = readiness === null ? null : readiness.score;
        const modifier = healthLoadModifier(score);

        const { error: sampleError } = await supabaseAdmin.from("health_samples").upsert(
          {
            user_id: userId,
            sample_on: sampleOn,
            source: p.source,
            resting_hr: p.restingHr,
            hrv_ms: p.hrvMs,
            sleep_hours: p.sleepHours,
            sleep_quality: p.sleepQuality,
            steps: p.steps,
            active_kcal: p.activeKcal,
            vo2max: p.vo2max,
            recovery_score: score,
            // Null for a stage the source did not report, never zero: zero
            // would claim an unbroken night nobody measured.
            sleep_awake_minutes: p.sleepStages.awakeMinutes,
            sleep_rem_minutes: p.sleepStages.remMinutes,
            sleep_deep_minutes: p.sleepStages.deepMinutes,
            sleep_core_minutes: p.sleepStages.coreMinutes,
          },
          { onConflict: "user_id,sample_on,source" },
        );

        if (sampleError) {
          console.error("Health ingest sample write failed", { code: sampleError.code });
          return json({ error: "Health sync is temporarily unavailable" }, 503);
        }

        // A sample dated with the athlete's today used to be compared
        // against UTC's, so for several hours a day the reading was stored
        // but never became that day's check-in.
        if (sampleOn === athleteToday) {
          // Only the fields this payload actually carries. The check-in row is
          // shared with the manual morning check-in, and writing null over an
          // answer the athlete typed in themselves — their sleep, their
          // readiness — would destroy it on every watch sync that happened to
          // omit that field.
          const { error: checkinError } = await supabaseAdmin.from("daily_checkins").upsert(
            {
              user_id: userId,
              checkin_on: sampleOn,
              ...(p.sleepHours === null ? {} : { sleep_hours: p.sleepHours }),
              ...(p.sleepQuality === null ? {} : { sleep_quality: p.sleepQuality }),
              ...(score === null ? {} : { readiness_score: score, load_modifier: modifier }),
            },
            { onConflict: "user_id,checkin_on" },
          );

          if (checkinError) {
            console.error("Health ingest check-in write failed", { code: checkinError.code });
            return json({ error: "Health sync is temporarily unavailable" }, 503);
          }
        }

        return json({
          ok: true,
          sample_on: sampleOn,
          recovery_score: score,
          load_modifier: modifier,
          // What the score actually rests on, so an automation sending too
          // little can see why no readiness came back rather than guessing.
          readiness_coverage: readiness === null ? 0 : readiness.coverage,
          readiness_measured: readiness === null ? [] : readiness.measured,
          // echo back what was actually stored so automations can be verified
          stored: {
            resting_hr: p.restingHr,
            hrv_ms: p.hrvMs,
            sleep_hours: p.sleepHours,
            steps: p.steps,
            active_kcal: p.activeKcal,
            sleep_awake_minutes: p.sleepStages.awakeMinutes,
            sleep_rem_minutes: p.sleepStages.remMinutes,
            sleep_deep_minutes: p.sleepStages.deepMinutes,
            sleep_core_minutes: p.sleepStages.coreMinutes,
          },
          // The rest of the sample is kept when stages have to be dropped —
          // a wrong unit on one field is no reason to lose the heart rate
          // that arrived with it. Said out loud, because an automation with
          // the wrong unit has no other way of finding out.
          ...(p.sleepStagesRejected
            ? {
                dropped: "sleep_stages",
                message:
                  "The sleep stages added up to more than the sleep duration sent with them, so they were not stored. Check the units: stages are read as minutes unless the field name or value says otherwise.",
              }
            : {}),
        });
      },
    },
  },
});
