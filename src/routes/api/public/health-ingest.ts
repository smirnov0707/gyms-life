import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recoveryScore, healthLoadModifier } from "@/lib/health-metrics";
import { normalizeHealthPayload, normalizeDate } from "@/lib/health-normalize";

const Envelope = z.object({
  token: z.string().uuid(),
  source: z.enum(["apple_health", "google_fit", "manual", "import"]).default("apple_health"),
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

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("health_token", p.token)
          .maybeSingle();

        if (!profile) return json({ error: "Unauthorized" }, 401);

        const userId = profile.id as string;
        const sampleOn =
          normalizeDate(raw["date"] ?? raw["sample_on"] ?? raw["day"]) ??
          new Date().toISOString().slice(0, 10);

        const { data: history } = await supabaseAdmin
          .from("health_samples")
          .select("resting_hr, hrv_ms")
          .eq("user_id", userId)
          .order("sample_on", { ascending: false })
          .limit(30);

        const avg = (nums: (number | null)[]) => {
          const list = nums.filter((n): n is number => typeof n === "number");
          return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
        };

        const score = recoveryScore(
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
        const modifier = healthLoadModifier(score);

        await supabaseAdmin.from("health_samples").upsert(
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
          },
          { onConflict: "user_id,sample_on,source" },
        );

        if (sampleOn === new Date().toISOString().slice(0, 10)) {
          await supabaseAdmin.from("daily_checkins").upsert(
            {
              user_id: userId,
              checkin_on: sampleOn,
              sleep_hours: p.sleepHours,
              sleep_quality: p.sleepQuality,
              readiness_score: score,
              load_modifier: modifier,
            },
            { onConflict: "user_id,checkin_on" },
          );
        }

        return json({
          ok: true,
          sample_on: sampleOn,
          recovery_score: score,
          load_modifier: modifier,
          // echo back what was actually stored so automations can be verified
          stored: {
            resting_hr: p.restingHr,
            hrv_ms: p.hrvMs,
            sleep_hours: p.sleepHours,
            steps: p.steps,
            active_kcal: p.activeKcal,
          },
        });
      },
    },
  },
});
