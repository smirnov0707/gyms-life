import React, { useState } from "react";
import { Dumbbell, Loader2, Plus, Sparkles, Check, Target } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { aiErrorMessage } from "@/lib/ai-error";
import { errorMessage } from "@/lib/error-message";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  suggestExercisesForGoal,
  addExerciseToActivePlan,
  type ExerciseSuggestion,
} from "@/lib/exercise-suggest.functions";

const COPY = {
  lt: {
    title: "Pratimai pagal tavo tikslą",
    subtitle: "Treneris parenka pratimus, kurių trūksta tavo planui — pridėk vienu paspaudimu",
    generate: "Pasiūlyti pratimus",
    regenerate: "Pasiūlyti kitus",
    loading: "Treneris renka pratimus...",
    addTo: "Pridėti į dieną",
    added: "Pridėta",
    day: "Diena",
    noPlan: "Aktyvaus plano nėra — pirmiausia sukurk treniruočių planą.",
    empty: "Nepavyko rasti naujų pratimų. Pabandyk dar kartą.",
    priority: { high: "Aukštas prioritetas", medium: "Vidutinis", low: "Papildomas" },
    goals: {
      lose_fat: "Numesti riebalų",
      build_muscle: "Auginti raumenis",
      strength: "Jėga",
      endurance: "Ištvermė",
    } as Record<string, string>,
    dup: "Šis pratimas jau yra plane",
    fail: "Nepavyko pridėti",
  },
  en: {
    title: "Exercises for your goal",
    subtitle: "Coach picks what your plan is missing — add it in one tap",
    generate: "Suggest exercises",
    regenerate: "Suggest others",
    loading: "Coach is picking exercises...",
    addTo: "Add to day",
    added: "Added",
    day: "Day",
    noPlan: "No active plan yet — create a training plan first.",
    empty: "No new exercises found. Try again.",
    priority: { high: "High priority", medium: "Medium", low: "Optional" },
    goals: {
      lose_fat: "Lose fat",
      build_muscle: "Build muscle",
      strength: "Strength",
      endurance: "Endurance",
    } as Record<string, string>,
    dup: "This exercise is already in the plan",
    fail: "Could not add",
  },
} as const;

const GOALS = ["lose_fat", "build_muscle", "strength", "endurance"] as const;

type PlanSummary = {
  id: string;
  title: string;
  days: { day: number; title: string; exercises: number }[];
};

export const GoalExerciseSuggestions: React.FC = () => {
  const { lang, t } = useI18n();
  const c = COPY[lang === "lt" ? "lt" : "en"];
  const { user } = useAuth();
  const qc = useQueryClient();
  const suggest = useServerFn(suggestExercisesForGoal);
  const addToPlan = useServerFn(addExerciseToActivePlan);

  const { data: profile } = useQuery({
    queryKey: ["profile-goal", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("goal")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const [goal, setGoal] = useState<string | null>(null);
  const activeGoal = goal ?? profile?.goal ?? "build_muscle";

  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ExerciseSuggestion[] | null>(null);
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [day, setDay] = useState<number>(1);
  const [addedSlugs, setAddedSlugs] = useState<string[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const res = await suggest({ data: { goal: activeGoal, lang } });
      setItems(res.suggestions);
      setPlan(res.plan);
      if (res.plan?.days.length) setDay(res.plan.days[0]!.day);
      if (!res.suggestions.length) toast.info(c.empty);
    } catch (error) {
      toast.error(aiErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const add = async (s: ExerciseSuggestion) => {
    setAdding(s.slug);
    try {
      const res = await addToPlan({
        data: {
          day,
          exercise: {
            slug: s.slug,
            name: s.name,
            sets: s.sets,
            reps: s.reps,
            rest_seconds: s.rest_seconds,
            notes: s.reason,
          },
        },
      });
      if (res.ok) {
        setAddedSlugs((prev) => [...prev, s.slug]);
        toast.success(`${c.added}: ${s.name} → ${res.dayTitle}`);
        if (user) {
          qc.invalidateQueries({ queryKey: ["active-plan", user.id] });
          qc.invalidateQueries({ queryKey: ["plan", user.id] });
        }
      } else {
        toast.error(
          res.reason === "duplicate" ? c.dup : res.reason === "no_plan" ? c.noPlan : c.fail,
        );
      }
    } catch (error) {
      toast.error(errorMessage(error, c.fail));
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="p-6 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Dumbbell className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{c.title}</h3>
          <p className="text-xs text-muted-foreground">{c.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GOALS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGoal(g)}
            className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
              activeGoal === g
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Target className="h-3 w-3" /> {c.goals[g]}
          </button>
        ))}
      </div>

      <Button onClick={run} disabled={busy} className="w-full rounded-2xl py-6 font-bold">
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {busy ? c.loading : items ? c.regenerate : c.generate}
      </Button>

      {items && !plan && (
        <p className="rounded-2xl border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
          {c.noPlan}
        </p>
      )}

      {plan && plan.days.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-muted-foreground">{c.addTo}:</span>
          {plan.days.map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => setDay(d.day)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                day === d.day
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {c.day} {d.day} · {d.title}
            </button>
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="grid gap-2">
          {items.map((s) => {
            const done = addedSlugs.includes(s.slug);
            return (
              <div
                key={s.slug}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface-2 p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{s.name}</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                      {s.sets}×{s.reps}
                    </span>
                    <span className="text-[10px] uppercase text-muted-foreground">{s.muscle}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        s.priority === "high"
                          ? "bg-primary/15 text-primary"
                          : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {c.priority[s.priority]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.reason}</p>
                </div>
                <Button
                  size="sm"
                  variant={done ? "outline" : "default"}
                  disabled={done || adding === s.slug || !plan}
                  onClick={() => add(s)}
                  className="shrink-0 rounded-xl"
                >
                  {adding === s.slug ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
