import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Apple, Flame, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { logMeal } from "@/lib/nutrition.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartFridgeScanner } from "@/components/SmartFridgeScanner";
import { VisionMealScanner } from "@/components/VisionMealScanner";
import { DineOutMenuScanner } from "@/components/DineOutMenuScanner";

export const Route = createFileRoute("/_authenticated/nutrition")({
  head: () => ({
    meta: [
      { title: "Mitybos dienoraštis — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Aprašyk patiekalą paprastais žodžiais — suskaičiuosime kalorijas, baltymus, angliavandenius ir riebalus bei suderins su treniruočių tikslu.",
      },
      { property: "og:title", content: "Mitybos dienoraštis — GYMS.LIFE" },
      { property: "og:description", content: "Kalorijos ir makro elementai iš vieno sakinio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NutritionPage,
});

type Row = {
  id: string;
  logged_on: string;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  note: string | null;
};

function Ring({
  value,
  target,
  label,
  unit,
}: {
  value: number;
  target: number;
  label: string;
  unit: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <div className="panel flex flex-col items-center gap-2 p-5">
      <div
        className="grid size-24 place-items-center rounded-full"
        style={{
          background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--surface-2) 0deg)`,
        }}
      >
        <div className="grid size-[76px] place-items-center rounded-full bg-surface">
          <span className="text-display text-2xl leading-none">{Math.round(value)}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {unit}
          </span>
        </div>
      </div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xs text-primary">
        {pct}% / {Math.round(target)}
        {unit}
      </div>
    </div>
  );
}

function NutritionPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const call = useServerFn(logMeal);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, display_name, locale, birth_year, gender, height_cm, weight_kg, target_weight_kg, experience, goal, location, days_per_week, session_minutes, equipment, limitations, onboarded, created_at, updated_at, diet, allergies, dislikes, meals_per_day",
        )
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: logs } = useQuery({
    queryKey: ["nutrition", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("nutrition_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(80);
      return (data ?? []) as Row[];
    },
    enabled: !!user,
  });

  const add = useMutation({
    mutationFn: async () => call({ data: { description: text, lang } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["nutrition", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("nutrition_logs").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition", user?.id] }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const todays = (logs ?? []).filter((l) => l.logged_on === today);
  const sum = (k: keyof Row) => todays.reduce((s, l) => s + Number(l[k] ?? 0), 0);

  const weight = Number(profile?.weight_kg ?? 75);
  const goal = String(profile?.goal ?? "muscle");
  const kcalTarget = Math.round(weight * (goal === "lose" ? 28 : goal === "muscle" ? 38 : 34));
  const proteinTarget = Math.round(weight * 2);
  const fatTarget = Math.round(weight * 0.9);
  const carbTarget = Math.max(50, Math.round((kcalTarget - proteinTarget * 4 - fatTarget * 9) / 4));

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary">GYMS.LIFE</p>
        <h1 className="mt-1 text-5xl">{t("nut.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("nut.sub")}</p>
      </header>

      <div className="panel relative overflow-hidden p-5">
        <div className="grain-hero pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative flex flex-col gap-3 sm:flex-row">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("nut.ph")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim().length > 1) add.mutate();
            }}
            className="h-12 flex-1 bg-surface-2"
          />
          <Button
            size="lg"
            className="h-12 rounded-full px-7 font-bold glow-ring"
            disabled={add.isPending || text.trim().length < 2}
            onClick={() => add.mutate()}
          >
            {add.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> {t("nut.analyzing")}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" /> {t("nut.add")}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Ring value={sum("calories")} target={kcalTarget} label={t("nut.kcal")} unit="" />
        <Ring value={sum("protein")} target={proteinTarget} label={t("nut.protein")} unit="g" />
        <Ring value={sum("carbs")} target={carbTarget} label={t("nut.carbs")} unit="g" />
        <Ring value={sum("fat")} target={fatTarget} label={t("nut.fat")} unit="g" />
      </div>

      <section>
        <h2 className="flex items-center gap-2 text-3xl">
          <Apple className="size-5 text-accent" /> {t("nut.today")}
        </h2>
        {todays.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("nut.empty")}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {todays.map((l) => (
              <li key={l.id} className="panel flex items-start gap-4 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
                  <Flame className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{l.food_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.calories} kcal · {l.protein}g {t("nut.protein")} · {l.carbs}g{" "}
                    {t("nut.carbs")} · {l.fat}g {t("nut.fat")}
                  </div>
                  {l.note && <p className="mt-1 text-xs text-primary/80">{l.note}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(l.id)}
                  title={t("nut.delete")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <SmartFridgeScanner />
        <div className="mt-6">
          <VisionMealScanner />
        </div>
        <div className="mt-6">
          <DineOutMenuScanner />
        </div>
      </section>
    </div>
  );
}
