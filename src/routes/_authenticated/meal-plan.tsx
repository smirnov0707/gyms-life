import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ChefHat,
  ClipboardList,
  Copy,
  FileDown,
  Loader2,
  Printer,
  Sparkles,
  Utensils,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { generateMealPlan } from "@/lib/meal.functions";
import { adaptMealPlan } from "@/lib/meal-adapt.functions";
import { downloadShoppingListPdf } from "@/lib/shopping-pdf";
import { printShoppingList } from "@/lib/shopping-print";
import { withCompleteShoppingList } from "@/lib/shopping-build";
import { useLocalizedMealPlan } from "@/lib/use-localized-meal-plan";
import { parseStoredMealPlan, type GeneratedMealPlan } from "@/lib/meal-plan.schema";
import { Button } from "@/components/ui/button";
import { DynamicTDEECalculator } from "@/components/DynamicTDEECalculator";
import { SmartFastingWindow } from "@/components/SmartFastingWindow";

export const Route = createFileRoute("/_authenticated/meal-plan")({
  head: () => ({
    meta: [
      { title: "7 dienų mitybos planas — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Savaitės valgiaraštis pagal tavo svorį, tikslą ir maisto pasirinkimus — su receptais ir parduotuvės sąrašu.",
      },
      { property: "og:title", content: "7 dienų mitybos planas — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Receptai, makro elementai ir vienas savaitės pirkinių sąrašas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MealPlanPage,
});

const DIETS: { value: string; key: TKey }[] = [
  { value: "any", key: "mp.diet.any" },
  { value: "vegetarian", key: "mp.diet.vegetarian" },
  { value: "vegan", key: "mp.diet.vegan" },
  { value: "pescatarian", key: "mp.diet.pescatarian" },
  { value: "low carb", key: "mp.diet.lowcarb" },
  { value: "gluten free", key: "mp.diet.glutenfree" },
  { value: "lactose free", key: "mp.diet.lactosefree" },
];

const BUDGETS: { value: string; key: TKey }[] = [
  { value: "low", key: "mp.budget.low" },
  { value: "medium", key: "mp.budget.mid" },
  { value: "high", key: "mp.budget.high" },
];

const COOKING: { value: string; key: TKey }[] = [
  { value: "beginner, max 20 min", key: "mp.cooking.easy" },
  { value: "intermediate", key: "mp.cooking.normal" },
  { value: "advanced", key: "mp.cooking.chef" },
];

function MealPlanPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const run = useServerFn(generateMealPlan);
  const adapt = useServerFn(adaptMealPlan);

  const [diet, setDiet] = useState("any");
  const [allergies, setAllergies] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState(4);
  const [kcalMode, setKcalMode] = useState<"auto" | "custom">("auto");
  const [kcalCustom, setKcalCustom] = useState(2200);
  const [budget, setBudget] = useState("medium");
  const [cookingLevel, setCookingLevel] = useState("intermediate");

  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [adaptBusy, setAdaptBusy] = useState(false);
  const [adaptFrom, setAdaptFrom] = useState(1);
  const [adaptNote, setAdaptNote] = useState("");
  const [openDay, setOpenDay] = useState(1);
  const [fresh, setFresh] = useState<GeneratedMealPlan | null>(null);

  const { data: saved, refetch } = useQuery({
    queryKey: ["meal-plan", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, data, lang, created_at")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Could not load meal plan: ${error.message}`);
      return data;
    },
    enabled: !!user,
  });

  const savedPlan = saved ? parseStoredMealPlan(saved.data) : null;
  const { plan: localizedSaved, translating } = useLocalizedMealPlan(
    saved?.id,
    savedPlan,
    saved?.lang ?? "lt",
  );

  const rawPlan = fresh ?? localizedSaved ?? null;
  const plan = useMemo(
    () => (rawPlan ? withCompleteShoppingList(rawPlan, lang) : null),
    [rawPlan, lang],
  );

  const generate = async () => {
    setBusy(true);
    try {
      const res = await run({
        data: {
          diet,
          allergies,
          dislikes,
          mealsPerDay,
          budget,
          cookingLevel,
          kcalTarget: kcalMode === "custom" ? kcalCustom : null,
          lang,
        },
      });

      setFresh(res.plan);
      setOpenDay(1);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const runAdapt = async () => {
    setAdaptBusy(true);
    try {
      const res = await adapt({ data: { fromDay: adaptFrom, notes: adaptNote, lang } });
      setFresh(res.plan);
      setOpenDay(adaptFrom);
      setAdaptNote("");
      refetch();
      toast.success(t("mp.adapted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setAdaptBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!plan) return;
    setPdfBusy(true);
    try {
      await downloadShoppingListPdf(plan, lang);
      toast.success(t("mp.pdfDone"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setPdfBusy(false);
    }
  };

  const printList = () => {
    if (!plan) return;
    try {
      printShoppingList(plan, lang);
    } catch {
      toast.error(t("common.error"));
    }
  };

  const copyList = async () => {
    if (!plan) return;
    const text = plan.shopping_list
      .map(
        (group) =>
          `${group.category}\n${group.items.map((i) => `- ${i.name} — ${i.amount}`).join("\n")}`,
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("mp.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const day = plan?.days.find((d) => d.day === openDay) ?? plan?.days[0];

  const avg = (() => {
    const days = plan?.days ?? [];
    if (!days.length) return null;
    const mean = (pick: (d: (typeof days)[number]) => number) =>
      days.reduce((s, d) => s + Number(pick(d) || 0), 0) / days.length;
    const kcals = days.map((d) => Number(d.total_kcal || 0));
    const kcal = mean((d) => d.total_kcal);
    return {
      kcal,
      protein: mean((d) => d.total_protein),
      carbs: mean((d) => d.total_carbs),
      fat: mean((d) => d.total_fat),
      min: Math.min(...kcals),
      max: Math.max(...kcals),
      diff: kcal - Number(plan?.kcal_target || 0),
    };
  })();

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary">GYMS.LIFE FUEL</p>
        <h1 className="text-5xl">{t("mp.title")}</h1>
        {translating && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
          </p>
        )}
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("mp.sub")}</p>
      </div>

      <DynamicTDEECalculator />
      <div className="mt-4">
        <SmartFastingWindow />
      </div>

      <div className="panel grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">{t("mp.diet")}</span>
          <select
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3"
          >
            {DIETS.map((d) => (
              <option key={d.value} value={d.value}>
                {t(d.key)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">{t("mp.meals")}</span>
          <select
            value={mealsPerDay}
            onChange={(e) => setMealsPerDay(Number(e.target.value))}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">{t("mp.budget")}</span>
          <select
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3"
          >
            {BUDGETS.map((b) => (
              <option key={b.value} value={b.value}>
                {t(b.key)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">{t("mp.allergies")}</span>
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder={t("mp.allergies.ph")}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">{t("mp.dislikes")}</span>
          <input
            value={dislikes}
            onChange={(e) => setDislikes(e.target.value)}
            placeholder={t("mp.dislikes.ph")}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">{t("mp.cooking")}</span>
          <select
            value={cookingLevel}
            onChange={(e) => setCookingLevel(e.target.value)}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3"
          >
            {COOKING.map((c) => (
              <option key={c.value} value={c.value}>
                {t(c.key)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">{t("mp.kcalMode")}</span>
          <select
            value={kcalMode}
            onChange={(e) => setKcalMode(e.target.value as "auto" | "custom")}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3"
          >
            <option value="auto">{t("mp.kcalAuto")}</option>
            <option value="custom">{t("mp.kcalCustom")}</option>
          </select>
        </label>
        {kcalMode === "custom" && (
          <label className="grid gap-1.5 text-sm md:col-span-2">
            <span className="font-semibold">{t("mp.kcalCustomLabel")}</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1200}
                max={4500}
                step={50}
                value={kcalCustom}
                onChange={(e) => setKcalCustom(Number(e.target.value))}
                className="h-10 flex-1 accent-[var(--primary)]"
              />
              <input
                type="number"
                min={1200}
                max={4500}
                step={50}
                value={kcalCustom}
                onChange={(e) => setKcalCustom(Number(e.target.value))}
                className="h-10 w-24 rounded-lg border border-border bg-surface-2 px-3 text-center font-bold"
              />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">kcal</span>
            </div>
            <span className="text-xs text-muted-foreground">{t("mp.kcalHint")}</span>
          </label>
        )}

        <div className="md:col-span-2 lg:col-span-3">
          <Button onClick={generate} disabled={busy} className="font-bold glow-ring">
            {busy ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 size-4" />
            )}
            {busy ? t("mp.generating") : plan ? t("mp.regenerate") : t("mp.generate")}
          </Button>
        </div>
      </div>

      {!plan ? (
        <div className="panel grid place-items-center gap-3 p-12 text-center text-sm text-muted-foreground">
          <Utensils className="size-7 text-primary" />
          {t("mp.none")}
        </div>
      ) : (
        <>
          <div className="panel grid gap-4 p-6 md:grid-cols-[2fr_3fr]">
            <div>
              <h2 className="text-3xl">{plan.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                <strong className="text-foreground">{t("mp.hydration")}:</strong> {plan.hydration}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  [t("mp.targets"), `${Math.round(plan.kcal_target)} kcal`],
                  [t("nut.protein"), `${Math.round(plan.protein_target)} g`],
                  [t("nut.carbs"), `${Math.round(plan.carbs_target)} g`],
                  [t("nut.fat"), `${Math.round(plan.fat_target)} g`],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-surface-2 p-4 text-center">
                  <div className="text-display text-2xl text-primary">{value}</div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {avg && (
            <div className="panel grid gap-4 p-6 md:grid-cols-[2fr_3fr] md:items-center">
              <div>
                <h3 className="text-2xl">{t("mp.avgTitle")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("mp.avgSub")}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("mp.range")}: {Math.round(avg.min)}–{Math.round(avg.max)} kcal ·{" "}
                  {t("mp.vsTarget")}:{" "}
                  <span className={Math.abs(avg.diff) <= 100 ? "text-primary" : "text-accent"}>
                    {avg.diff >= 0 ? "+" : "−"}
                    {Math.abs(Math.round(avg.diff))} kcal
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    [t("mp.avgKcal"), `${Math.round(avg.kcal)}`],
                    [t("nut.protein"), `${Math.round(avg.protein)} g`],
                    [t("nut.carbs"), `${Math.round(avg.carbs)} g`],
                    [t("nut.fat"), `${Math.round(avg.fat)} g`],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-surface-2 p-4 text-center">
                    <div className="text-display text-2xl">{value}</div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-2xl">
                  <Wand2 className="size-5 text-accent" /> {t("mp.adaptTitle")}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("mp.adaptSub")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">{t("mp.adaptFrom")}</span>
                  <select
                    value={adaptFrom}
                    onChange={(e) => setAdaptFrom(Number(e.target.value))}
                    className="h-10 rounded-lg border border-border bg-surface-2 px-3"
                  >
                    {plan.days.map((d) => (
                      <option key={d.day} value={d.day}>
                        {t("mp.day")} {d.day}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">{t("mp.adaptNote")}</span>
                  <input
                    value={adaptNote}
                    onChange={(e) => setAdaptNote(e.target.value)}
                    placeholder={t("mp.adaptNotePh")}
                    className="h-10 rounded-lg border border-border bg-surface-2 px-3"
                  />
                </label>
              </div>
            </div>
            <Button onClick={runAdapt} disabled={adaptBusy} className="font-bold glow-ring">
              {adaptBusy ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Wand2 className="mr-1 size-4" />
              )}
              {adaptBusy ? t("mp.adapting") : t("mp.adapt")}
            </Button>
          </div>

          {plan.adaptation_note && (
            <div className="panel border-l-2 border-accent p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                {t("mp.adaptNote.title")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.adaptation_note}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {plan.days.map((d) => (
              <button
                key={d.day}
                onClick={() => setOpenDay(d.day)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  (day?.day ?? 0) === d.day
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("mp.day")} {d.day}
              </button>
            ))}
          </div>

          {day && (
            <div className="grid gap-4">
              <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h3 className="text-2xl">{day.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(day.total_kcal)} kcal · {Math.round(day.total_protein)} g P ·{" "}
                    {Math.round(day.total_carbs)} g C · {Math.round(day.total_fat)} g F
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="mr-1 size-4" /> {t("mp.print")}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {day.meals.map((meal, i) => (
                  <div key={i} className="panel p-5">
                    <p className="text-xs uppercase tracking-widest text-primary">{meal.slot}</p>
                    <h4 className="text-xl">{meal.name}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Math.round(meal.kcal)} kcal · {Math.round(meal.protein)} g P ·{" "}
                      {Math.round(meal.carbs)} g C · {Math.round(meal.fat)} g F ·{" "}
                      {Math.round(meal.minutes)} min
                    </p>
                    <div className="mt-3 grid gap-3 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {t("mp.ingredients")}
                        </p>
                        <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                          {meal.ingredients.map((ing, k) => (
                            <li key={k}>• {ing}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {t("mp.steps")}
                        </p>
                        <ol className="mt-1 grid gap-0.5 text-muted-foreground">
                          {meal.steps.map((step, k) => (
                            <li key={k}>
                              {k + 1}. {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                      {meal.tip && (
                        <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-xs">
                          <ChefHat className="size-4 shrink-0 text-accent" />
                          {meal.tip}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-2xl">
                <ClipboardList className="size-5 text-primary" /> {t("mp.shopping")}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={exportPdf} disabled={pdfBusy} className="font-bold">
                  {pdfBusy ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-1 size-4" />
                  )}
                  {pdfBusy ? t("mp.pdfBusy") : t("mp.pdf")}
                </Button>
                <Button variant="outline" size="sm" onClick={copyList}>
                  <Copy className="mr-1 size-4" /> {t("mp.copy")}
                </Button>
                <Button variant="outline" size="sm" onClick={printList}>
                  <Printer className="mr-1 size-4" /> {t("mp.print")}
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plan.shopping_list.map((group) => (
                <div key={group.category}>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    {group.category}
                  </p>
                  <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                    {group.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-3 border-b border-border/50 py-1"
                      >
                        <span>{item.name}</span>
                        <span className="text-foreground">{item.amount}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {!!plan.prep_tips?.length && (
            <div className="panel p-6">
              <h3 className="text-2xl">{t("mp.tips")}</h3>
              <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                {plan.prep_tips.map((tip, i) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
