import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  CalendarClock,
  ChevronDown,
  Clock,
  Info,
  Loader2,
  Pill,
  Plus,
  RotateCcw,
  ScanLine,
  Trash2,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { buildSchedule, type Supplement } from "@/lib/supplements";
import {
  addSupplements,
  getSupplements,
  removeSupplement,
  setSupplementActive,
} from "@/lib/supplements.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tactileClick } from "@/lib/tactile";
import { MicronutrientDeficiencyScanner } from "@/components/MicronutrientDeficiencyScanner";
import { SupplementCycleAdvisor } from "@/components/SupplementCycleAdvisor";
import { SupplementPhotoScanner } from "@/components/SupplementPhotoScanner";
import { NutritionStudioNav } from "@/components/NutritionStudioNav";

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
      { name: "twitter:card", content: "summary" },
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
  const { t, lang } = useI18n();
  const english = baseLang(lang) === "en";
  const { user } = useAuth();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [withFood, setWithFood] = useState(false);
  const [prefTime, setPrefTime] = useState<string>("any");
  const [notes, setNotes] = useState("");

  const query = useQuery({
    queryKey: ["supplements", user?.id],
    queryFn: () => getSupplements(),
    enabled: !!user,
  });

  const supplements = query.data?.supplements ?? [];
  const nameInput = useRef<HTMLInputElement>(null);

  const add = useMutation({
    mutationFn: async () => {
      await addSupplements({
        data: {
          supplements: [
            {
              name: name.trim(),
              dose: dose.trim(),
              category,
              times_per_day: timesPerDay,
              with_food: withFood,
              preferred_time: prefTime,
              notes: notes.trim(),
            },
          ],
          skipExistingNames: false,
        },
      });
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
    onError: () => toast.error(t("common.error")),
  });

  const toggle = useMutation({
    mutationFn: async (s: Supplement) => {
      await setSupplementActive({ data: { id: s.id, isActive: !s.is_active } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplements", user?.id] }),
    onError: () => toast.error(t("common.error")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await removeSupplement({ data: { id } });
    },
    onSuccess: () => {
      toast.success(t("supp.deleted"));
      qc.invalidateQueries({ queryKey: ["supplements", user?.id] });
    },
    onError: () => toast.error(t("common.error")),
  });

  const schedule = buildSchedule(supplements);

  const ready = query.isSuccess;
  const busy = add.isPending || toggle.isPending || remove.isPending;
  const activeCount = supplements.filter((item) => item.is_active).length;
  const focusAdd = () => nameInput.current?.focus();

  return (
    <div className="fl-context-route fl-workspace fl-supplement-workspace fl-page-enter">
      <NutritionStudioNav />
      <header className="fl-workspace-hero fl-supplement-hero">
        <div>
          <p className="fl-workspace-eyebrow">
            {english ? "YOUR DAILY ROUTINE" : "TAVO DIENOS RITMAS"}
          </p>
          <h1 className="fl-workspace-title mt-3">
            {english ? "A little more organised." : "Daugiau tvarkos kasdien."}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {english
              ? "Your supplements, your notes, one clear daily view."
              : "Tavo papildai, tavo pastabos ir aiškus dienos vaizdas."}
          </p>
          <Button onClick={focusAdd} disabled={!ready || busy} className="mt-5">
            <Plus className="size-4" />
            {t("supp.add")}
            <ArrowDown className="size-4" />
          </Button>
        </div>
        <dl
          className="fl-supplement-metrics"
          aria-label={english ? "Saved routine" : "Išsaugota rutina"}
        >
          <div>
            <dt>{english ? "Active" : "Aktyvūs"}</dt>
            <dd>{ready ? activeCount : "—"}</dd>
          </div>
          <div>
            <dt>{english ? "Time slots" : "Dienos laikai"}</dt>
            <dd>{ready ? schedule.slots.length : "—"}</dd>
          </div>
          <div>
            <dt>{english ? "Paused" : "Pristabdyti"}</dt>
            <dd>{ready ? supplements.length - activeCount : "—"}</dd>
          </div>
        </dl>
      </header>

      <div className="fl-supplement-layout">
        <div className="grid content-start gap-[18px]">
          {query.isPending ? (
            <section className="fl-workspace-panel fl-supplement-state" role="status">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p>{t("common.loading")}</p>
            </section>
          ) : query.isError ? (
            <section className="fl-workspace-panel fl-supplement-state" role="alert">
              <Info className="size-6 text-primary" />
              <h2>{english ? "Your list is unavailable" : "Papildų sąrašas nepasiekiamas"}</h2>
              <p>
                {english
                  ? "We couldn't load your saved supplements. Retry to restore your schedule and make changes."
                  : "Nepavyko įkelti išsaugotų papildų. Bandyk dar kartą, kad matytum grafiką ir galėtum jį keisti."}
              </p>
              <Button
                variant="secondary"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                <RotateCcw className="size-4" />
                {english ? "Retry" : "Bandyti dar kartą"}
              </Button>
            </section>
          ) : (
            <>
              <section
                className="fl-workspace-panel fl-supplement-schedule"
                aria-labelledby="supplement-schedule-title"
              >
                <header className="fl-supplement-section-heading">
                  <span className="fl-supplement-icon">
                    <Clock className="size-5" />
                  </span>
                  <div>
                    <p className="fl-metric-label">
                      {english ? "DAILY OVERVIEW" : "DIENOS APŽVALGA"}
                    </p>
                    <h2 id="supplement-schedule-title">{t("supp.schedule")}</h2>
                  </div>
                </header>
                <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
                  {t("supp.scheduleSub")}
                </p>
                {schedule.slots.length === 0 ? (
                  <div className="fl-supplement-empty">
                    <Pill className="size-7 text-primary" />
                    <h3>
                      {supplements.length === 0
                        ? english
                          ? "Start with what you take."
                          : "Pradėk nuo to, ką vartoji."
                        : english
                          ? "Your routine is paused."
                          : "Tavo rutina pristabdyta."}
                    </h3>
                    <p>
                      {supplements.length === 0
                        ? t("supp.empty")
                        : english
                          ? "Resume an item in your list to add it back to the schedule."
                          : "Aktyvuok papildą sąraše, kad jis vėl atsirastų grafike."}
                    </p>
                    {supplements.length === 0 && (
                      <Button variant="secondary" onClick={focusAdd}>
                        {t("supp.add")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <ol className="fl-supplement-timeline">
                    {schedule.slots.map((slot) => (
                      <li key={slot.id}>
                        <div className="fl-supplement-slot">
                          <time>{slot.time}</time>
                          <span>{t(`supp.slot.${slot.id}` as TKey)}</span>
                        </div>
                        <ul className="fl-supplement-slot-items">
                          {slot.items.map((item, i) => (
                            <li key={`${item.supplement.id}-${i}`}>
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <h3>{item.supplement.name}</h3>
                                {item.supplement.dose && (
                                  <span className="text-xs font-semibold text-primary">
                                    {item.supplement.dose}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {t(item.reasonKey as TKey)}
                              </p>
                              {item.supplement.with_food && (
                                <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent">
                                  <Utensils className="size-3.5" />
                                  {t("supp.withFood")}
                                </span>
                              )}
                              {item.supplement.notes && (
                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                  {item.supplement.notes}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="fl-supplement-schedule-note">
                  <Info className="size-4 shrink-0" />
                  {english
                    ? "Times are examples, not reminders or a record of doses taken."
                    : "Laikai yra pavyzdiniai. Tai nėra priminimai ar suvartotų porcijų žurnalas."}
                </p>
                {schedule.warningKeys.length > 0 && (
                  <aside className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
                    <h3 className="text-sm font-semibold">{t("supp.warnings")}</h3>
                    <ul className="mt-2 grid gap-2 text-xs leading-relaxed text-muted-foreground">
                      {schedule.warningKeys.map((k) => (
                        <li key={k}>{t(k as TKey)}</li>
                      ))}
                    </ul>
                  </aside>
                )}
              </section>

              <section
                className="fl-workspace-panel fl-supplement-collection"
                aria-labelledby="supplement-list-title"
              >
                <header className="fl-supplement-section-heading">
                  <span className="fl-supplement-icon">
                    <Pill className="size-5" />
                  </span>
                  <div>
                    <p className="fl-metric-label">{english ? "SAVED BY YOU" : "TAVO IŠSAUGOTA"}</p>
                    <h2 id="supplement-list-title">{t("supp.list")}</h2>
                  </div>
                </header>
                {supplements.length === 0 ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("supp.empty")}</p>
                ) : (
                  <ul className="fl-supplement-list">
                    {supplements.map((s) => (
                      <li key={s.id}>
                        <div className="min-w-0">
                          <h3>{s.name}</h3>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {s.dose && <span className="text-primary">{s.dose} · </span>}
                            {t(`supp.cat.${s.category}` as TKey)} · {s.times_per_day}×{" "}
                            {t("supp.perDay")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            aria-pressed={s.is_active}
                            aria-label={`${s.is_active ? (english ? "Pause" : "Pristabdyti") : english ? "Resume" : "Aktyvuoti"}: ${s.name}`}
                            onClick={() => toggle.mutate(s)}
                            className="fl-supplement-toggle"
                          >
                            {s.is_active ? t("supp.active") : t("supp.paused")}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            onClick={() => remove.mutate(s.id)}
                            aria-label={`${english ? "Remove" : "Pašalinti"}: ${s.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
        <form
          id="supplement-add"
          className="fl-workspace-panel fl-supplement-add"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready && !busy && name.trim()) {
              tactileClick();
              add.mutate();
            }
          }}
        >
          <header className="fl-supplement-section-heading">
            <span className="fl-supplement-icon">
              <Plus className="size-5" />
            </span>
            <div>
              <p className="fl-metric-label">{english ? "MAKE IT YOURS" : "PRITAIKYK SAU"}</p>
              <h2>{t("supp.add")}</h2>
            </div>
          </header>
          <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
            {english
              ? "Enter your own product and label details. You can pause or remove it anytime."
              : "Įvesk savo produkto ir etiketės informaciją. Bet kada galėsi pristabdyti ar pašalinti."}
          </p>
          <fieldset disabled={!ready || busy} className="grid min-w-0 gap-4 disabled:opacity-50">
            <label className="fl-supplement-field">
              {t("supp.name")}
              <Input
                ref={nameInput}
                id="supplement-name"
                maxLength={160}
                required
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("supp.namePh")}
              />
            </label>

            <label className="fl-supplement-field">
              {t("supp.dose")}
              <Input
                maxLength={120}
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder={t("supp.dosePh")}
              />
            </label>

            <label className="fl-supplement-field">
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

            <div className="fl-supplement-frequency">
              <div className="fl-supplement-field">
                {t("supp.timesPerDay")}
                <div
                  role="group"
                  aria-label={t("supp.timesPerDay")}
                  className="flex items-center gap-1 rounded-xl border border-border bg-surface-2 p-1"
                >
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

              <label className="fl-supplement-field">
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

            <label className="fl-supplement-field">
              {t("supp.notes")}
              <Input maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <Button type="submit" disabled={!name.trim() || busy} className="w-full">
              {add.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {add.isPending ? t("common.loading") : t("supp.add")}
            </Button>
          </fieldset>
        </form>
      </div>

      <section className="fl-supplement-tools" aria-labelledby="supplement-tools-title">
        <header>
          <p className="fl-workspace-eyebrow">
            {english ? "WHEN YOU NEED MORE" : "KAI REIKIA DAUGIAU"}
          </p>
          <h2 id="supplement-tools-title">{english ? "A closer look." : "Pažvelk iš arčiau."}</h2>
          <p>
            {english
              ? "Optional tools for reading labels and reviewing your logged routine. Nutrient estimates cannot confirm a deficiency."
              : "Papildomi įrankiai etiketėms nuskaityti ir užregistruotai rutinai peržiūrėti. Apskaičiuoti mikroelementų kiekiai nepatvirtina jų trūkumo."}
          </p>
        </header>
        <div className="grid content-start gap-3">
          <SupplementTool
            icon={ScanLine}
            title={t("supp.scan.title")}
            description={
              english
                ? "Read a label, then review every detail before saving."
                : "Nuskaityk etiketę ir patikrink informaciją prieš išsaugodamas."
            }
          >
            {(open) => <SupplementPhotoScanner active={open} />}
          </SupplementTool>
          <SupplementTool
            icon={Utensils}
            title={t("sc.micro.title")}
            description={
              english
                ? "Explore signals in the food you have logged."
                : "Peržiūrėk signalus iš užregistruoto maisto."
            }
          >
            {() => <MicronutrientDeficiencyScanner />}
          </SupplementTool>
          <SupplementTool
            icon={CalendarClock}
            title={t("supp.cycle.title")}
            description={
              english
                ? "Review the context behind your current routine."
                : "Peržiūrėk dabartinės rutinos kontekstą."
            }
          >
            {() => <SupplementCycleAdvisor />}
          </SupplementTool>
        </div>
      </section>
    </div>
  );
}

/** Mount on first request, then preserve unsaved drafts across disclosure toggles. */
function SupplementTool({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: (open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  return (
    <details
      className="fl-workspace-panel fl-supplement-tool"
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        if (next) setVisited(true);
      }}
    >
      <summary>
        <span className="fl-supplement-icon">
          <Icon className="size-5" />
        </span>
        <span>
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </summary>
      {visited && <div className="fl-supplement-tool-content">{children(open)}</div>}
    </details>
  );
}
