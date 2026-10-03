import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { Search, Heart, Sparkles, ShieldCheck, Play, Filter, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  smartExerciseFilter,
  type ExerciseFilterSuggestion,
} from "@/lib/exercise-filter.functions";
import { useI18n, baseLang, type TKey } from "@/lib/i18n";

import { WorkoutRequestBuilder } from "@/components/WorkoutRequestBuilder";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { exerciseVideo, exerciseVideoPoster } from "@/lib/exercise-media";
import { ExerciseVideo } from "@/components/ExerciseVideo";
import {
  catalogueEntryName,
  groupCatalogueByLetter,
  readExerciseCatalogueIndex,
} from "@/lib/exercise-catalogue-index";

export const Route = createFileRoute("/exercises/")({
  // Read before the page is rendered, so the server HTML carries a link to
  // every exercise. It carried none, and the sitemap was the only thing that
  // claimed these 175 pages existed.
  loader: async () => ({ index: await readExerciseCatalogueIndex() }),
  head: () => ({
    meta: [
      // Ten of the 175 exercises have a video; the rest are frame sequences,
      // which the cards and the detail pages label as such. "175+ pratimų su
      // technikos video" was wrong twice over — the count has no slack above
      // 175, and the video belonged to 6% of them.
      { title: "Pratimų biblioteka: technika, klaidos ir demonstracijos — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Pratimų technika žingsnis po žingsnio su judesio kadrais, o pagrindiniams pratimams — vaizdo demonstracijomis. Filtruok pagal kūno dalį, sudėtingumą ir įrangą: štanga, hanteliai, guma, treniruokliai, skersinis, TRX ir kt.",
      },
      { property: "og:title", content: "Pratimų biblioteka — GYMS.LIFE" },
      {
        property: "og:description",
        content:
          "Technikos demonstracijos, klaidų analizė ir filtrai pagal įrangą bei sudėtingumą.",
      },
    ],
  }),
  component: ExercisesPage,
});

/** V6 media-first exercise card.
 * Poster is the instant visual; the exact technique clip plays on hover.
 * Mobile/touch devices keep the poster and use Quick Preview.
 */
function CardMedia({
  video,
  poster,
  name,
  label,
}: {
  video: string | null;
  poster: string | null;
  name: string;
  label: string;
}) {
  const [hover, setHover] = useState(false);

  const handleMouseEnter = () => {
    setHover(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHover(false)}
    >
      {poster ? (
        <img
          src={poster}
          alt={name}
          loading="lazy"
          className={`h-full w-full object-contain transition-transform duration-700 ${
            hover ? "scale-[1.04]" : "scale-100"
          }`}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-surface-2 p-4 text-center text-sm font-semibold text-muted-foreground">
          {name}
        </div>
      )}

      {video && hover && (
        <video
          src={video}
          poster={poster ?? undefined}
          autoPlay={hover}
          muted
          loop
          playsInline
          preload="none"
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
            hover ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

      <div className="pointer-events-none absolute left-0 top-0 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-xl">
            {label}
          </span>

          {video && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-xl">
              <Play className="size-3 fill-current" />
              Video
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const groups = [
  "all",
  "legs",
  "chest",
  "back",
  "shoulders",
  "arms",
  "abs",
  "core",
  "glutes",
  "cardio",
  "fullbody",
  "mobility",
] as const;

const equipmentList = [
  "all",
  "bodyweight",
  "barbell",
  "dumbbell",
  "kettlebell",
  "band",
  "machine",
  "cable",
  "pullup_bar",
  "trx",
  "ball",
  "cardio",
  "other",
] as const;

const safetyTags = [
  { id: "all", labelKey: "rt.ex.safety.all" },
  { id: "knee_safe", labelKey: "rt.ex.safety.knee" },
  { id: "back_safe", labelKey: "rt.ex.safety.back" },
  { id: "shoulder_safe", labelKey: "rt.ex.safety.shoulder" },
] as const;

const levels = ["all", "beginner", "intermediate", "advanced"] as const;

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  const { lang } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-mono text-foreground">
      {label}
      <button
        aria-label={`${baseLang(lang) === "lt" ? "Pašalinti filtrą" : "Remove filter"}: ${label}`}
        onClick={onClear}
        className="grid min-h-11 min-w-11 place-items-center text-muted-foreground hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function ExercisesPage() {
  const { t, lang } = useI18n();
  const aiLabels = (
    {
      lt: { title: "Treneris siūlo filtrus", apply: "Pasirinkti", dismiss: "Ne, ačiū" },
      en: { title: "Coach suggests filters", apply: "Apply", dismiss: "Dismiss" },
      ru: { title: "ИИ предлагает фильтры", apply: "Выбрать", dismiss: "Скрыть" },
      uk: { title: "ШІ пропонує фільтри", apply: "Обрати", dismiss: "Сховати" },
      pl: { title: "Trener proponuje filtry", apply: "Wybierz", dismiss: "Ukryj" },
      de: { title: "KI schlägt Filter vor", apply: "Übernehmen", dismiss: "Ausblenden" },
      es: { title: "La IA sugiere filtros", apply: "Aplicar", dismiss: "Descartar" },
      fr: { title: "L'IA suggère des filtres", apply: "Appliquer", dismiss: "Masquer" },
    } as Record<string, { title: string; apply: string; dismiss: string }>
  )[lang] ?? { title: "Coach suggests filters", apply: "Apply", dismiss: "Dismiss" };
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<(typeof groups)[number]>("all");
  const [equipment, setEquipment] = useState<(typeof equipmentList)[number]>("all");
  const [safety, setSafety] = useState<string>("all");
  const [level, setLevel] = useState<(typeof levels)[number]>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const [previewEx, setPreviewEx] = useState<{
    slug: string;
    name: string;
    group: string;
    equipment?: string | null;
    mistakes?: string | undefined;
    instructions?: string | undefined;
  } | null>(null);

  const activeCount =
    (group !== "all" ? 1 : 0) +
    (level !== "all" ? 1 : 0) +
    (equipment !== "all" ? 1 : 0) +
    (safety !== "all" ? 1 : 0);

  const resetFilters = () => {
    setGroup("all");
    setLevel("all");
    setEquipment("all");
    setSafety("all");
  };

  /** AI: turns the typed phrase into filters. */
  const [suggestion, setSuggestion] = useState<ExerciseFilterSuggestion | null>(null);
  const [dismissed, setDismissed] = useState("");
  const askAi = useServerFn(smartExerciseFilter);

  const applySuggestion = (r: ExerciseFilterSuggestion) => {
    setGroup(r.group);
    setLevel(r.level);
    setEquipment(r.equipment);
    setSafety(r.safety);
    setQ(r.query);
    setSuggestion(null);
    setDismissed(r.query.trim().toLowerCase());
  };

  const requestSuggestion = async (prompt: string) => {
    if (prompt.trim().length < 3) return;
    setAiBusy(true);
    try {
      const r = await askAi({ data: { prompt: prompt.trim(), lang } });
      const meaningful =
        r.group !== "all" || r.level !== "all" || r.equipment !== "all" || r.safety !== "all";
      setSuggestion(meaningful ? r : null);
    } catch {
      setSuggestion(null);
    } finally {
      setAiBusy(false);
    }
  };

  /** Auto-suggest filters shortly after the user stops typing. */
  useEffect(() => {
    const prompt = q.trim();
    if (prompt.length < 3 || prompt.toLowerCase() === dismissed) {
      setSuggestion(null);
      return;
    }
    const id = setTimeout(() => void requestSuggestion(prompt), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, lang, dismissed]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("forma_fav_exercises");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed))
          setFavorites(parsed.filter((value): value is string => typeof value === "string"));
      }
    } catch {
      // Browser storage is optional for exercise preferences.
    }
  }, []);

  const toggleFavorite = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = favorites.includes(slug)
      ? favorites.filter((s) => s !== slug)
      : [...favorites, slug];
    setFavorites(next);

    // If the last favorite is removed, automatically leave the Favorites filter.
    if (next.length === 0) {
      setOnlyFavorites(false);
    }

    try {
      localStorage.setItem("forma_fav_exercises", JSON.stringify(next));
    } catch {
      // Browser storage is optional for exercise preferences.
    }
  };

  // An empty catalogue means "this app has no exercises", which is never
  // true. A read that fails must not be able to say it.
  const fetchPage = async (from: number, to: number) => {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .order("muscle_group")
      .order("name_en")
      .range(from, to);
    if (error) throw new Error(error.message);
    return data ?? [];
  };

  const catalogueIndex = Route.useLoaderData().index;
  const lt = baseLang(lang) === "lt";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["exercises"],
    staleTime: 1000 * 60 * 60, // 1 valanda talpykloje
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const page = 1000;
      const all: NonNullable<Awaited<ReturnType<typeof fetchPage>>> = [];
      for (let i = 0; i < 10; i++) {
        const rows = await fetchPage(i * page, i * page + page - 1);
        all.push(...rows);
        if (rows.length < page) break;
      }
      return all;
    },
  });

  const list = (data ?? []).filter((e) => {
    const name =
      (baseLang(lang) === "lt" ? e.name_lt : e.name_en) || e.name_en || e.name_lt || e.slug || "";
    const slugStr = e.slug || "";
    const query = q.toLowerCase().trim();
    const mg = e.muscle_group ?? "";
    const eq = (e.equipment ?? "").toLowerCase();
    const lvl = e.difficulty ?? "";
    // Search also matches categories: muscle group, equipment and level — in the
    // raw keys and in their translated labels.
    const haystack = [
      name,
      slugStr,
      mg,
      eq,
      lvl,
      mg ? t(`mg.${mg}` as TKey) : "",
      eq ? t(`eq.${eq}` as TKey) : "",
      lvl ? t(`ex.level.${lvl}` as TKey) : "",
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || query.split(/\s+/).every((w) => haystack.includes(w));

    const matchesGroup = group === "all" || e.muscle_group === group;
    const matchesLevel = level === "all" || e.difficulty === level;
    const matchesEquip = equipment === "all" || (e.equipment?.toLowerCase() ?? "") === equipment;
    const matchesFav = !onlyFavorites || favorites.includes(e.slug);

    let matchesSafety = true;
    if (safety === "back_safe") {
      matchesSafety = !["deadlift", "squat", "barbell-row", "good-morning"].some((k) =>
        slugStr.includes(k),
      );
    } else if (safety === "knee_safe") {
      matchesSafety = !["jump", "lunge", "hack-squat", "sissy-squat"].some((k) =>
        slugStr.includes(k),
      );
    } else if (safety === "shoulder_safe") {
      matchesSafety = !["upright-row", "behind-neck", "dips"].some((k) => slugStr.includes(k));
    }

    return (
      matchesQuery && matchesGroup && matchesLevel && matchesEquip && matchesFav && matchesSafety
    );
  });

  return (
    <AppShell>
      <div className="fl-context-route fl-workspace fl-library-workspace">
        <header className="fl-workspace-hero fl-library-hero">
          <div>
            <p className="fl-workspace-eyebrow">{t("rt.ex.proLibrary")}</p>
            <h1 className="fl-workspace-title mt-3">{t("ex.title")}</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {baseLang(lang) === "lt"
                ? "Atrask judesį. Peržiūrėk techniką. Treniruokis sąmoningai."
                : "Find your movement. Explore the technique. Train with intention."}
            </p>
          </div>
          <Button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            aria-pressed={onlyFavorites}
            variant={onlyFavorites ? "default" : "outline"}
            className="fl-library-favorites"
          >
            <Heart className={`size-4 ${onlyFavorites ? "fill-current" : ""}`} />
            {t("rt.ex.myFavorites").replace("{n}", String(favorites.length))}
          </Button>
        </header>

        <details className="fl-workspace-panel fl-library-builder">
          <summary>
            <Sparkles className="size-4 text-primary" />
            {baseLang(lang) === "lt"
              ? "Sudaryk treniruotę su Treneriu"
              : "Build a workout with Coach"}
          </summary>
          <WorkoutRequestBuilder />
        </details>

        {/* Compact toolbar: search + AI + collapsible filters */}
        <div className="fl-workspace-panel fl-library-toolbar">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={t("rt.ex.searchPlaceholder")}
                type="search"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                placeholder={t("rt.ex.searchPlaceholder")}
                className="h-11 rounded-2xl border-border bg-surface pl-10 text-sm text-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                aria-label={aiLabels.title}
                disabled={aiBusy || q.trim().length < 3}
                onClick={() => void requestSuggestion(q)}
                className="h-11 gap-1.5 rounded-2xl px-4 text-xs font-bold"
              >
                {aiBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {aiLabels.title.split(" ")[0]}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={showFilters ? "default" : "outline"}
                aria-label={baseLang(lang) === "lt" ? "Filtrai" : "Filters"}
                aria-controls="exercise-filters"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((s) => !s)}
                className="h-11 gap-1.5 rounded-2xl px-4 text-xs font-bold"
              >
                <Filter className="size-4" />
                {baseLang(lang) === "lt" ? "Filtrai" : "Filters"}
                {activeCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {group !== "all" && (
                <FilterChip label={t(`mg.${group}` as TKey)} onClear={() => setGroup("all")} />
              )}
              {level !== "all" && (
                <FilterChip
                  label={t(`ex.level.${level}` as TKey)}
                  onClear={() => setLevel("all")}
                />
              )}
              {equipment !== "all" && (
                <FilterChip
                  label={t(`eq.${equipment}` as TKey)}
                  onClear={() => setEquipment("all")}
                />
              )}
              {safety !== "all" && (
                <FilterChip
                  label={t(
                    (safetyTags.find((s) => s.id === safety)?.labelKey ??
                      "rt.ex.safety.all") as TKey,
                  )}
                  onClear={() => setSafety("all")}
                />
              )}
              <button
                aria-label={baseLang(lang) === "lt" ? "Išvalyti filtrus" : "Clear all filters"}
                onClick={resetFilters}
                className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" /> {baseLang(lang) === "lt" ? "Išvalyti" : "Clear"}
              </button>
            </div>
          )}

          {/* AI filter suggestion */}
          {suggestion && (
            <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/10 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-primary">
                <Sparkles className="size-3.5" /> {aiLabels.title}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {suggestion.group !== "all" &&
                  groups.includes(suggestion.group as (typeof groups)[number]) && (
                    <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-mono font-bold text-foreground">
                      {t(`mg.${suggestion.group}` as TKey)}
                    </span>
                  )}
                {suggestion.level !== "all" &&
                  levels.includes(suggestion.level as (typeof levels)[number]) && (
                    <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-mono font-bold text-background">
                      {t(`ex.level.${suggestion.level}` as TKey)}
                    </span>
                  )}
                {suggestion.equipment !== "all" &&
                  equipmentList.includes(
                    suggestion.equipment as (typeof equipmentList)[number],
                  ) && (
                    <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-mono font-bold text-background">
                      {t(`eq.${suggestion.equipment}` as TKey)}
                    </span>
                  )}
                {suggestion.safety !== "all" &&
                  safetyTags.some((s) => s.id === suggestion.safety) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-mono font-bold text-background">
                      <ShieldCheck className="size-3" />
                      {t(
                        (safetyTags.find((s) => s.id === suggestion.safety)?.labelKey ??
                          "rt.ex.safety.all") as TKey,
                      )}
                    </span>
                  )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => applySuggestion(suggestion)}
                  className="h-9 rounded-xl px-4 text-xs font-bold"
                >
                  {aiLabels.apply}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSuggestion(null);
                    setDismissed(q.trim().toLowerCase());
                  }}
                  className="h-9 rounded-xl px-3 text-xs"
                >
                  {aiLabels.dismiss}
                </Button>
              </div>
            </div>
          )}

          {showFilters && (
            <div
              id="exercise-filters"
              className="fl-library-filters mt-4 space-y-4 border-t border-border pt-4"
            >
              {/* Muscle Groups */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {t("rt.ex.muscleGroup")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => (
                    <button
                      key={g}
                      aria-pressed={group === g}
                      onClick={() => setGroup(g)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-bold font-mono transition-all",
                        group === g
                          ? "bg-primary text-primary-foreground "
                          : "border border-border bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {g === "all" ? t("ex.all") : t(`mg.${g}` as TKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {t("ex.level")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {levels.map((lv) => (
                    <button
                      key={lv}
                      aria-pressed={level === lv}
                      onClick={() => setLevel(lv)}
                      className={cn(
                        "rounded-xl px-2.5 py-1 text-[11px] font-mono transition-all",
                        level === lv
                          ? "bg-primary text-background font-bold"
                          : "border border-border bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {lv === "all" ? t("ex.all") : t(`ex.level.${lv}` as TKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment & Joint Safety Filters */}
              <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {t("rt.ex.equipment")}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {equipmentList.map((eq) => (
                      <button
                        key={eq}
                        aria-pressed={equipment === eq}
                        onClick={() => setEquipment(eq)}
                        className={cn(
                          "rounded-xl px-2.5 py-1 text-[11px] font-mono transition-all",
                          equipment === eq
                            ? "bg-accent text-background font-bold"
                            : "border border-border bg-surface text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {eq === "all" ? t("rt.ex.all2") : t(`eq.${eq}` as TKey)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {t("rt.ex.jointSafety")}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {safetyTags.map((sf) => (
                      <button
                        key={sf.id}
                        aria-pressed={safety === sf.id}
                        onClick={() => setSafety(sf.id)}
                        className={cn(
                          "flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-mono transition-all",
                          safety === sf.id
                            ? "bg-accent text-background font-bold"
                            : "border border-border bg-surface text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {sf.id !== "all" && <ShieldCheck className="w-3 h-3" />}
                        {t(sf.labelKey as TKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {isError && (
          <section role="alert" className="fl-workspace-panel fl-library-state">
            <p>{t("rt.ex.loadFailed")}</p>
            <Button variant="outline" onClick={() => void refetch()}>
              {t("rt.ex.retry")}
            </Button>
          </section>
        )}
        {!isLoading && !isError && (
          <p className="fl-library-count" role="status">
            {list.length} {t("ex.count")}
          </p>
        )}
        {isLoading && (
          <div role="status" className="fl-workspace-panel fl-library-state">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span>{t("common.loading")}</span>
          </div>
        )}

        {list.length === 0 && !isLoading && !isError ? (
          <div className="fl-workspace-panel fl-library-state">{t("rt.ex.noResults")}</div>
        ) : null}

        {/* V6 Exercise Library — video-first premium cards */}
        <div className="fl-library-grid">
          {list.map((e) => {
            const video = exerciseVideo(e.slug);
            const poster = exerciseVideoPoster(e.slug);
            const isFav = favorites.includes(e.slug);
            const name =
              (baseLang(lang) === "lt" ? e.name_lt : e.name_en) ||
              e.name_en ||
              e.name_lt ||
              e.slug ||
              "";

            return (
              <article key={e.id} className="fl-library-card group">
                <div className="fl-library-media relative aspect-[4/3] overflow-hidden">
                  <CardMedia video={video} poster={poster} name={name} label={t("ex.technique")} />

                  <button
                    type="button"
                    aria-pressed={isFav}
                    aria-label={`${isFav ? (baseLang(lang) === "lt" ? "Pašalinti iš mėgstamų" : "Remove from favorites") : baseLang(lang) === "lt" ? "Įtraukti į mėgstamus" : "Add to favorites"}: ${name}`}
                    onClick={(ev) => toggleFavorite(e.slug, ev)}
                    className="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-black/40 p-2.5 text-white backdrop-blur-xl transition-all hover:scale-105 hover:bg-black/60 hover:text-rose-400"
                  >
                    <Heart className={`size-4 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                  </button>

                  <button
                    type="button"
                    onClickCapture={(event) => {
                      previewTrigger.current = event.currentTarget;
                    }}
                    onClick={() =>
                      setPreviewEx({
                        slug: e.slug,
                        name,
                        group: e.muscle_group,
                        equipment: e.equipment,
                        mistakes:
                          (baseLang(lang) === "lt" ? e.mistakes_lt : e.mistakes_en) ||
                          e.mistakes_en ||
                          e.mistakes_lt ||
                          undefined,
                        instructions:
                          (baseLang(lang) === "lt" ? e.instructions_lt : e.instructions_en) ||
                          e.instructions_en ||
                          e.instructions_lt ||
                          undefined,
                      })
                    }
                    className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-xl transition-all hover:bg-white/20"
                  >
                    <Play className="size-3 fill-current" />
                    {t("rt.ex.quickPreview")}
                  </button>
                </div>

                <div className="flex min-h-[142px] flex-col justify-between p-4">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                        {t(`mg.${e.muscle_group}` as TKey)}
                      </span>

                      <span className="rounded-full border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t(`eq.${e.equipment}` as TKey)}
                      </span>
                    </div>

                    <h2 className="line-clamp-2 text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                      {name}
                    </h2>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                    <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {e.difficulty
                        ? t(`ex.level.${e.difficulty}` as TKey)
                        : t("rt.ex.forEveryone")}
                    </span>

                    <Link
                      to="/exercises/$slug"
                      params={{ slug: e.slug }}
                      className="inline-flex min-h-11 items-center text-xs font-semibold text-primary transition-colors hover:text-foreground"
                    >
                      {t("rt.ex.fullAnatomy")}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Every exercise, as plain links. Server-rendered from the loader, so
            this is the page's own crawlable path to all 175 detail pages — and
            it works with the filters above switched off, with JavaScript off,
            and for somebody who knows the name and wants it in one tap. */}
        {catalogueIndex.length > 0 && (
          <section className="mt-12 border-t border-border/70 pt-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {lt ? "Visi pratimai" : "All exercises"}
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {groupCatalogueByLetter(catalogueIndex).map((group) => (
                <div key={group.letter}>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    {group.letter}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {group.entries.map((entry) => (
                      <li key={entry.slug}>
                        <Link
                          to="/exercises/$slug"
                          params={{ slug: entry.slug }}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {catalogueEntryName(entry)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick Preview & Technique Modal */}
        <Dialog open={!!previewEx} onOpenChange={(o) => !o && setPreviewEx(null)}>
          <DialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              previewTrigger.current?.focus();
            }}
            aria-describedby={undefined}
            className="fl-library-preview max-w-3xl bg-surface border-border text-foreground p-6 rounded-3xl"
          >
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> {previewEx?.name}
              </DialogTitle>
            </DialogHeader>
            {previewEx && <ExerciseVideo slug={previewEx.slug} title={previewEx.name} />}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
