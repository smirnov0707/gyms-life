import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Info, Pill, Plus, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { buildSchedule, type Supplement } from "@/lib/supplements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/Reveal";
import { tactileClick } from "@/lib/tactile";
import { MicronutrientDeficiencyScanner } from "@/components/MicronutrientDeficiencyScanner";
import { SupplementCycleAdvisor } from "@/components/SupplementCycleAdvisor";
import { SupplementPhotoScanner } from "@/components/SupplementPhotoScanner";

export const Route = createFileRoute("/_authenticated/supplements")({
  head: () => ({
    meta: [
      { title: "Papildų planas — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Suvesk vartojamus papildus ir gauk asmeninį dienos grafiką — kada ką gerti, kad įsisavintum daugiausia ir išvengtum sąveikų.",
      },
      { property: "og:title", content: "Papildų planas — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Išmanus papildų paskirstymas per dieną pagal įsisavinimą ir treniruotės laiką.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupplementsPage,
});

const CATEGORIES = [
  "protein",
  "creatine",
  "vitamin",
  "mineral",
  "iron",
  "calcium",
  "omega",
  "preworkout",
  "electrolyte",
  "probiotic",
  "general",
] as const;

const PREF_TIMES = ["any", "morning", "pre_workout", "post_workout", "evening", "bedtime"] as const;

function SupplementsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [withFood, setWithFood] = useState(false);
  const [prefTime, setPrefTime] = useState<string>("any");
  const [notes, setNotes] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["supplements", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplements")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Supplement[];
    },
    enabled: !!user,
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supplements").insert({
        user_id: user!.id,
        name: name.trim(),
        dose: dose.trim() || null,
        category,
        times_per_day: timesPerDay,
        with_food: withFood,
        preferred_time: prefTime,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setDose("");
      setNotes("");
      setTimesPerDay(1);
      setWithFood(false);
      setPrefTime("any");
      setCategory("general");
      toast.success(t("supp.saved"));
      qc.invalidateQueries({ queryKey: ["supplements", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (s: Supplement) => {
      const { error } = await supabase
        .from("supplements")
        .update({ is_active: !s.is_active })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplements", user?.id] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("supp.deleted"));
      qc.invalidateQueries({ queryKey: ["supplements", user?.id] });
    },
  });

  const schedule = buildSchedule(rows ?? []);

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-display text-4xl leading-none tracking-wide sm:text-5xl">
          {t("supp.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t("supp.sub")}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Add form */}
        <div className="grid gap-6">
        <Reveal>
          <SupplementPhotoScanner />
        </Reveal>
        <Reveal delay={60}>
          <section className="panel grid gap-4 p-5">
            <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Plus className="size-4 text-primary" />
              {t("supp.add")}
            </h2>

            <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              {t("supp.name")}
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("supp.namePh")}
              />
            </label>

            <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              {t("supp.dose")}
              <Input
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder={t("supp.dosePh")}
              />
            </label>

            <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              {t("supp.category")}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`supp.cat.${c}` as TKey)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                {t("supp.timesPerDay")}
                <div className="flex h-10 items-center gap-1 rounded-lg border border-border bg-surface p-1">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={timesPerDay === n}
                      onClick={() => {
                        tactileClick();
                        setTimesPerDay(n);
                      }}
                      className={`flex-1 rounded-md text-sm font-bold transition-colors ${
                        timesPerDay === n
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-surface-2"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                {t("supp.prefTime")}
                <select
                  value={prefTime}
                  onChange={(e) => setPrefTime(e.target.value)}
                  className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
                >
                  {PREF_TIMES.map((p) => (
                    <option key={p} value={p}>
                      {t(`supp.pref.${p}` as TKey)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={withFood}
                onChange={(e) => setWithFood(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              <Utensils className="size-4 text-primary" />
              {t("supp.withFood")}
            </label>

            <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              {t("supp.notes")}
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <Button
              onClick={() => {
                tactileClick();
                add.mutate();
              }}
              disabled={!name.trim() || add.isPending}
              className="press"
            >
              <Plus className="size-4" />
              {t("supp.add")}
            </Button>
          </section>
        </Reveal>
        </div>

        {/* Schedule */}
        <div className="grid gap-6">
          <div className="mb-6"><MicronutrientDeficiencyScanner /></div>

          <Reveal delay={40}>
            <SupplementCycleAdvisor />
          </Reveal>

          <Reveal delay={80}>
            <section className="grid gap-4">
              <div>
                <h2 className="text-display text-2xl tracking-wide">{t("supp.schedule")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("supp.scheduleSub")}</p>
              </div>

              {schedule.slots.length === 0 ? (
                <p className="panel p-6 text-sm text-muted-foreground">{t("supp.empty")}</p>
              ) : (
                <ol className="grid gap-3">
                  {schedule.slots.map((slot) => (
                    <li key={slot.id} className="panel p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-primary">
                          <Clock className="size-4" />
                        </span>
                        <div>
                          <div className="text-sm font-bold uppercase tracking-widest">
                            {t(`supp.slot.${slot.id}` as TKey)}
                          </div>
                          <div className="text-xs text-muted-foreground">{slot.time}</div>
                        </div>
                      </div>
                      <ul className="mt-3 grid gap-2 border-t border-border pt-3">
                        {slot.items.map((item, i) => (
                          <li key={`${item.supplement.id}-${i}`} className="flex items-start gap-3">
                            <Pill className="mt-0.5 size-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">
                                {item.supplement.name}
                                {item.supplement.dose ? (
                                  <span className="ml-2 text-xs font-normal text-primary">
                                    {item.supplement.dose}
                                  </span>
                                ) : null}
                                {item.supplement.with_food ? (
                                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                                    <Utensils className="size-3" />
                                    {t("supp.withFood")}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t(item.reasonKey as TKey)}
                              </div>
                              {item.supplement.notes ? (
                                <div className="text-xs italic text-muted-foreground">
                                  {item.supplement.notes}
                                </div>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}

              {schedule.warningKeys.length > 0 && (
                <div className="panel grid gap-2 p-4">
                  <h3 className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    <Info className="size-4 text-primary" />
                    {t("supp.warnings")}
                  </h3>
                  <ul className="grid gap-1.5">
                    {schedule.warningKeys.map((k) => (
                      <li key={k} className="text-sm text-muted-foreground">
                        · {t(k as TKey)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </Reveal>

          {/* My supplements */}
          <Reveal delay={140}>
            <section className="grid gap-3">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("supp.list")}
              </h2>
              {(rows ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("supp.empty")}</p>
              ) : (
                <ul className="grid gap-2">
                  {(rows ?? []).map((s) => (
                    <li
                      key={s.id}
                      className="panel flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {s.name}
                          {s.dose ? (
                            <span className="ml-2 text-xs font-normal text-primary">{s.dose}</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t(`supp.cat.${s.category}` as TKey)} · {s.times_per_day}× {t("supp.perDay")}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => toggle.mutate(s)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            s.is_active
                              ? "bg-primary/15 text-primary"
                              : "bg-surface-2 text-muted-foreground"
                          }`}
                        >
                          {s.is_active ? t("supp.active") : t("supp.paused")}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove.mutate(s.id)}
                          aria-label={t("supp.deleted")}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
