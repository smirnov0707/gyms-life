import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, Play, Timer, X, Flame, Info, Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExerciseVideo } from "@/components/ExerciseVideo";
import type { PlanData } from "@/lib/plan-types";
import { useLocalizedPlan } from "@/lib/use-localized-plan";
import { SmartExerciseSwap } from "@/components/SmartExerciseSwap";
import { DynamicWarmupGenerator } from "@/components/DynamicWarmupGenerator";
import { InjuryRiskRadar } from "@/components/InjuryRiskRadar";
import { adaptSets, adaptWeight, getAppliedAdaptation } from "@/lib/readiness-adapt";
import { getSetAdvice, getSessionDebrief } from "@/lib/coach-session.functions";

export const Route = createFileRoute("/_authenticated/workout/$day")({
  head: () => ({
    meta: [
      { title: "Treniruotė — GYMS.LIFE" },
      { name: "description", content: "Treniruotės režimas: serijų žymėjimas, poilsio laikmatis ir tūris." },
      { property: "og:title", content: "Treniruotė — GYMS.LIFE" },
      { property: "og:description", content: "Žymėk serijas, sek poilsį ir tūrį realiu laiku." },
    ],
  }),
  component: WorkoutPage,
});

type SetState = { reps: string; weight: string; rpe: number | null; done: boolean };
type Advice = {
  weight: number | null;
  reps: number | null;
  targetRir: number;
  cue: string;
  why: string;
  evidence: string;
};
type Debrief = {
  headline: string;
  wins: string[];
  fixes: string[];
  nextSession: string;
  evidence: string[];
};
const RPE_OPTIONS = [6, 7, 8, 9, 10];

function WorkoutPage() {
  const { day } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<Record<string, SetState[]>>({});
  const [swaps, setSwaps] = useState<Record<string, { name: string; slug: string }>>({});
  const [advice, setAdvice] = useState<Record<string, Advice>>({});
  const [adviceBusy, setAdviceBusy] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [debriefBusy, setDebriefBusy] = useState(false);
  const askAdvice = useServerFn(getSetAdvice);
  const askDebrief = useServerFn(getSessionDebrief);
  const [rest, setRest] = useState<number | null>(null);

  const [videoSlug, setVideoSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [startedAt] = useState(() => new Date());

  const { data: plan } = useQuery({
    queryKey: ["active-plan", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: history } = useQuery({
    queryKey: ["history", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("set_logs")
        .select("exercise_slug, weight_kg, reps, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { plan: planData } = useLocalizedPlan(
    plan?.id as string | undefined,
    plan?.data as PlanData | undefined,
    (plan?.lang as string | undefined) ?? "lt",
  );
  const dayPlan = planData?.days[Number(day)];

  const lastBySlug = useMemo(() => {
    const map: Record<string, { weight: number; reps: number }> = {};
    for (const row of history ?? []) {
      if (!map[row.exercise_slug] && row.weight_kg != null) {
        map[row.exercise_slug] = { weight: Number(row.weight_kg), reps: Number(row.reps ?? 0) };
      }
    }
    return map;
  }, [history]);

  const [adaptation, setAdaptation] = useState<number | null>(null);
  useEffect(() => {
    const read = () => setAdaptation(getAppliedAdaptation());
    read();
    window.addEventListener("gymslife:adaptation", read);
    return () => window.removeEventListener("gymslife:adaptation", read);
  }, []);

  useEffect(() => {
    if (!dayPlan || adaptation === undefined) return;
    setState((prev) => {
      if (Object.keys(prev).length) return prev;
      const modifier = adaptation ?? 1;
      const next: Record<string, SetState[]> = {};
      for (const ex of dayPlan.exercises) {
        const last = lastBySlug[ex.slug];
        const suggested = last ? Math.round((last.weight + 2.5) * 2) / 2 : null;
        next[ex.slug] = Array.from({ length: adaptSets(ex.sets, modifier) }, () => ({
          reps: (ex.reps.match(/\d+/)?.[0] ?? "10") as string,
          weight: suggested === null ? "" : String(adaptWeight(suggested, modifier)),
          rpe: null,
          done: false,
        }));
      }
      return next;
    });
  }, [dayPlan, lastBySlug, adaptation]);

  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      setRest(null);
      return;
    }
    const id = setTimeout(() => setRest((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [rest]);

  const volume = Object.values(state)
    .flat()
    .filter((s) => s.done)
    .reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);

  const totalSets = Object.values(state).flat().length;
  const doneSets = Object.values(state).flat().filter((s) => s.done).length;

  const toggleSet = (slug: string, idx: number, restSeconds: number) => {
    let justCompleted = false;
    setState((prev) => {
      const arr = [...(prev[slug] ?? [])];
      const cur = arr[idx];
      if (!cur) return prev;
      arr[idx] = { ...cur, done: !cur.done };
      if (!cur.done) {
        setRest(restSeconds || 90);
        justCompleted = true;
      }
      return { ...prev, [slug]: arr };
    });
    if (justCompleted) void requestAdvice(slug, idx + 1);
  };

  /** Coach call for the next set: load, reps, RIR target and the reason behind it. */
  const requestAdvice = async (slug: string, nextIndex: number) => {
    const ex = dayPlan?.exercises.find((e) => e.slug === slug);
    const sets = state[slug] ?? [];
    if (!ex || nextIndex >= sets.length) return;
    setAdviceBusy(slug);
    try {
      const res = (await askAdvice({
        data: {
          exerciseSlug: slug,
          exerciseName: swaps[slug]?.name ?? ex.name,
          targetReps: ex.reps,
          setNumber: nextIndex + 1,
          totalSets: sets.length,
          doneSets: sets
            .filter((s) => s.done)
            .map((s) => ({
              weight: s.weight ? Number(s.weight) : null,
              reps: s.reps ? Number(s.reps) : null,
              rpe: s.rpe,
            })),
          lang,
        },
      })) as Advice;
      setAdvice((prev) => ({ ...prev, [slug]: res }));
      setState((prev) => {
        const arr = [...(prev[slug] ?? [])];
        const target = arr[nextIndex];
        if (!target || target.done) return prev;
        arr[nextIndex] = {
          ...target,
          weight: res.weight != null ? String(res.weight) : target.weight,
          reps: res.reps != null ? String(res.reps) : target.reps,
        };
        return { ...prev, [slug]: arr };
      });
    } catch {
      /* advice is best-effort — the set logging must never break */
    } finally {
      setAdviceBusy(null);
    }
  };

  const setRpe = (slug: string, idx: number, value: number) =>
    setState((prev) => {
      const arr = [...(prev[slug] ?? [])];
      const cur = arr[idx];
      if (!cur) return prev;
      arr[idx] = { ...cur, rpe: cur.rpe === value ? null : value };
      return { ...prev, [slug]: arr };
    });

  const update = (slug: string, idx: number, field: "reps" | "weight", value: string) =>
    setState((prev) => {
      const arr = [...(prev[slug] ?? [])];
      const cur = arr[idx];
      if (!cur) return prev;
      arr[idx] = { ...cur, [field]: value };
      return { ...prev, [slug]: arr };
    });

  const finish = async () => {
    if (!user || !dayPlan || !plan) return;
    setSaving(true);
    try {
      const finishedAt = new Date();
      const { data: session, error } = await supabase
        .from("workout_sessions")
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          day_index: Number(day),
          title: dayPlan.title,
          started_at: startedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          duration_seconds: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
          total_volume: Math.round(volume),
        })
        .select("id")
        .single();
      if (error) throw error;

      const rows = dayPlan.exercises.flatMap((ex) =>
        (state[ex.slug] ?? [])
          .map((s, i) => ({
            user_id: user.id,
            session_id: session.id,
            exercise_slug: ex.slug,
            exercise_name: ex.name,
            set_number: i + 1,
            reps: Number(s.reps) || null,
            weight_kg: s.weight ? Number(s.weight) : null,
            rpe: s.rpe,
            done: s.done,
          }))
          .filter((r) => r.done),
      );
      if (rows.length) {
        const { error: setErr } = await supabase.from("set_logs").insert(rows);
        if (setErr) throw setErr;
      }
      toast.success(t("w.saved"));
      setDebriefBusy(true);
      try {
        const res = (await askDebrief({
          data: {
            title: dayPlan.title,
            durationSeconds: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
            volume: Math.round(volume),
            exercises: dayPlan.exercises.map((ex) => ({
              name: swaps[ex.slug]?.name ?? ex.name,
              sets: (state[ex.slug] ?? [])
                .filter((s) => s.done)
                .map((s) => ({
                  weight: s.weight ? Number(s.weight) : null,
                  reps: s.reps ? Number(s.reps) : null,
                  rpe: s.rpe,
                })),
            })),
            lang,
          },
        })) as Debrief;
        setDebrief(res);
      } catch {
        navigate({ to: "/app" });
      } finally {
        setDebriefBusy(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (!dayPlan) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="grid gap-6 pb-28">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary">
          {t("plan.day")} {dayPlan.day}
        </p>
        <h1 className="text-5xl">{dayPlan.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dayPlan.focus}</p>
      </div>

      {adaptation != null && adaptation !== 1 && (
        <div className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent">
          {t("ms.readiness.adjusted")} · {Math.round(adaptation * 100)}%
        </div>
      )}

      <div className="panel p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("plan.warmup")}</p>
        <p className="mt-1 text-sm">{dayPlan.warmup}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DynamicWarmupGenerator
          focus={dayPlan.focus}
          exercises={dayPlan.exercises.map((ex) => swaps[ex.slug]?.name ?? ex.name)}
        />
        <InjuryRiskRadar />
      </div>


      {dayPlan.exercises.map((ex) => (
        <div key={ex.slug} className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl">{swaps[ex.slug]?.name ?? ex.name}</h2>
              <p className="text-sm text-muted-foreground">
                {state[ex.slug]?.length ?? ex.sets} {t("plan.sets")} × {ex.reps} ·{" "}
                {t("plan.rest")} {ex.rest_seconds}s
              </p>
              {lastBySlug[ex.slug] && (
                <p className="mt-1 text-xs text-accent">
                  {t("w.last")}: {lastBySlug[ex.slug]!.weight} kg × {lastBySlug[ex.slug]!.reps}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <SmartExerciseSwap
                currentExercise={ex.slug}
                onSwap={(alt) => setSwaps((prev) => ({ ...prev, [ex.slug]: alt }))}
              />
              <Button variant="outline" size="sm" onClick={() => setVideoSlug(ex.slug)}>
                <Play className="mr-1 size-3" /> {t("w.watch")}
              </Button>
            </div>
          </div>


          {ex.notes && (
            <p className="mt-3 flex gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground">
              <Info className="size-4 shrink-0 text-primary" />
              {ex.notes}
            </p>
          )}

          {(advice[ex.slug] || adviceBusy === ex.slug) && (
            <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <Sparkles className="size-3.5" /> {t("w.coachNext")}
                {adviceBusy === ex.slug && <Loader2 className="size-3.5 animate-spin" />}
              </p>
              {advice[ex.slug] && (
                <>
                  <p className="mt-1 text-sm font-bold">
                    {advice[ex.slug]!.weight != null ? `${advice[ex.slug]!.weight} kg × ` : ""}
                    {advice[ex.slug]!.reps ?? ex.reps} · RIR {advice[ex.slug]!.targetRir}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{advice[ex.slug]!.cue}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    <span className="font-bold uppercase tracking-wide">{t("w.why")}: </span>
                    {advice[ex.slug]!.why}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-accent">{advice[ex.slug]!.evidence}</p>
                </>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {(state[ex.slug] ?? []).map((s, i) => (
              <div key={i} className="grid gap-1.5 rounded-2xl bg-surface-2/60 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-xs uppercase tracking-widest text-muted-foreground">
                    {t("w.set")} {i + 1}
                  </span>
                  <Input
                    inputMode="decimal"
                    value={s.weight}
                    placeholder="kg"
                    onChange={(e) => update(ex.slug, i, "weight", e.target.value)}
                    className="h-10 w-24"
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    inputMode="numeric"
                    value={s.reps}
                    onChange={(e) => update(ex.slug, i, "reps", e.target.value)}
                    className="h-10 w-20"
                  />
                  <Button
                    size="icon"
                    variant={s.done ? "default" : "outline"}
                    className="ml-auto"
                    onClick={() => toggleSet(ex.slug, i, ex.rest_seconds)}
                  >
                    <Check className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("w.rpe")}
                  </span>
                  {RPE_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-label={`RPE ${v}`}
                      onClick={() => setRpe(ex.slug, i, v)}
                      className={`h-7 w-8 rounded-lg border text-xs font-bold transition-colors ${
                        s.rpe === v
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border text-muted-foreground hover:border-accent/50"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                  <span className="text-[10px] text-muted-foreground">{t("w.rpeHint")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}


      <div className="panel p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("plan.cooldown")}</p>
        <p className="mt-1 text-sm">{dayPlan.cooldown}</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="text-sm">
            <div className="text-display text-2xl leading-none text-primary">
              {Math.round(volume).toLocaleString("lt-LT")} kg
            </div>
            <span className="text-xs text-muted-foreground">
              {t("w.volume")} · {doneSets}/{totalSets} {t("plan.sets")}
            </span>
          </div>
          {rest !== null && (
            <div className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-bold text-accent">
              <Timer className="size-4" />
              {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}
              <button onClick={() => setRest(null)} aria-label={t("w.skip")}>
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <Button
            onClick={finish}
            disabled={saving || doneSets === 0}
            className="ml-auto rounded-full px-6 font-bold glow-ring"
          >
            <Flame className="mr-1 size-4" /> {t("w.finish")}
          </Button>
        </div>
      </div>

      <Dialog open={!!videoSlug} onOpenChange={(o) => !o && setVideoSlug(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dayPlan.exercises.find((e) => e.slug === videoSlug)?.name ?? t("w.watch")}
            </DialogTitle>
          </DialogHeader>
          <ExerciseVideo slug={videoSlug} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!debrief || debriefBusy}
        onOpenChange={(o) => {
          if (!o) {
            setDebrief(null);
            navigate({ to: "/app" });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-accent" /> {t("w.debrief")}
            </DialogTitle>
          </DialogHeader>
          {debriefBusy && !debrief && (
            <div className="grid gap-2 py-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded-lg bg-surface-2" />
              ))}
            </div>
          )}
          {debrief && (
            <div className="grid gap-4">
              <p className="text-sm font-bold">{debrief.headline}</p>
              {debrief.wins.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    {t("w.wins")}
                  </p>
                  <ul className="mt-1 grid gap-1 text-sm text-muted-foreground">
                    {debrief.wins.map((w, i) => (
                      <li key={i}>· {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {debrief.fixes.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-accent">
                    {t("w.fixes")}
                  </p>
                  <ul className="mt-1 grid gap-1 text-sm text-muted-foreground">
                    {debrief.fixes.map((w, i) => (
                      <li key={i}>· {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {t("w.nextSession")}
                </p>
                <p className="mt-1 text-sm">{debrief.nextSession}</p>
              </div>
              {debrief.evidence.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {debrief.evidence.map((e, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}
              <Button
                className="rounded-full font-bold"
                onClick={() => {
                  setDebrief(null);
                  navigate({ to: "/app" });
                }}
              >
                {t("common.close")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
