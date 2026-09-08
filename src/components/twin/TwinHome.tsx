import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, Flame, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTwinSnapshot } from "@/lib/digital-twin.functions";
import { getTodaysTargets } from "@/lib/todays-targets.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import { targetsRegion, type TodaysTargets } from "@/lib/todays-targets.engine";
import {
  TWIN_DISPLAY_COLORS,
  mapTwinScene,
  type TwinDisplayTone,
  type TwinLayer,
} from "@/components/twin/twin-scene.model";
import { formatTwinValue, twinLayerCopy } from "@/components/twin/twin-layer.copy";
import { TwinStage } from "@/components/twin/TwinStage";
import { TrainingLoadPanel } from "@/components/TrainingLoadPanel";
import { RecentWorkoutEffect } from "@/components/RecentWorkoutEffect";
import { twinCopyFor } from "@/components/TwinView";
import {
  isAnatomicalRegion,
  viewShowing,
  type BodyView,
} from "@/components/twin/body-map.geometry";
import type { TwinRegionState, TwinSnapshot } from "@/lib/digital-twin.schema";
import "./TwinHome.css";

/**
 * The Twin as the screen, not as a card on it.
 *
 * The body answers two questions at once, and they come from different
 * evidence: what it has not finished recovering from, which is calculated
 * from logged sets, and what today's programme is about to ask of it, which
 * is simply read off the plan. Both are on the figure's own terms — tap a
 * region and it says which of the two it is talking about, and on what.
 *
 * Colour on the body stays one meaning: recovery. Today's session is marked
 * beside it rather than mixed into it, because a region can be fresh and on
 * today's list, or fatigued and not, and a single colour cannot say that.
 */

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

function regionLabelFor(region: string, t: (key: TKey) => string): string {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

/** A region chip: its recovery colour, its name, and what it owes today. */
function RegionChip({
  region,
  label,
  detail,
  selected,
  onSelect,
}: {
  region: TwinRegionState;
  label: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-left text-xs transition-colors ${
        selected
          ? "border-primary/50 bg-primary/[0.08] text-foreground"
          : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
      }`}
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: TWIN_DISPLAY_COLORS[region.recoveryBand] }}
      />
      <span className="font-semibold text-foreground">{label}</span>
      <span className="tabular-nums">{detail}</span>
    </button>
  );
}

function TodayPanel({
  targets,
  snapshot,
  selected,
  onSelect,
  label,
}: {
  targets: TodaysTargets | undefined;
  snapshot: TwinSnapshot;
  selected: string | null;
  onSelect: (region: string) => void;
  label: (region: string) => string;
}) {
  const { t } = useI18n();

  if (!targets || targets.status === "unreadable") {
    return (
      <p className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-xs leading-relaxed text-amber-600 light:text-amber-700 dark:text-amber-300">
        {t("th.unreadable")}
      </p>
    );
  }
  if (targets.status === "rest") {
    return <p className="text-xs leading-relaxed text-muted-foreground">{t("th.rest")}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {targets.regions.map((id) => {
          const region = snapshot.regions.find((entry) => entry.region === id);
          const work = targets.byRegion[id] ?? [];
          const detail = `${work.length}×`;
          return region ? (
            <RegionChip
              key={id}
              region={region}
              label={label(id)}
              detail={detail}
              selected={selected === id}
              onSelect={() => onSelect(id)}
            />
          ) : (
            // On today's list, but the Twin has no entry for it — named
            // anyway, because the athlete is going to train it.
            <span
              key={id}
              className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface-2 px-3 text-xs text-muted-foreground"
            >
              <span className="font-semibold text-foreground">{label(id)}</span> {detail}
            </span>
          );
        })}
      </div>
      {targets.unplaceable.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("th.unplaceable").replace(
            "{list}",
            targets.unplaceable.map((exercise) => exercise.name).join(", "),
          )}
        </p>
      ) : null}
    </div>
  );
}

const LEGEND_TONES: Record<TwinLayer, readonly TwinDisplayTone[]> = {
  recovery: ["fresh", "moderate", "fatigued", "unknown"],
  logged_volume: ["volume_high", "volume_medium", "volume_low", "unknown"],
  todays_session: ["in_session", "not_in_session", "unknown"],
};

function CockpitLegend({ layer, language }: { layer: TwinLayer; language: "lt" | "en" }) {
  const copy = twinLayerCopy(language);
  return (
    <section className="twin-cockpit-legend" aria-label={copy.label[layer]}>
      <h2>{language === "lt" ? "Kūno žemėlapis" : "Body map"}</h2>
      <p className="twin-cockpit-legend-title">{copy.label[layer]}</p>
      <ul>
        {LEGEND_TONES[layer].map((tone) => (
          <li key={tone}>
            <span
              aria-hidden="true"
              className={tone === "unknown" || tone === "not_in_session" ? "is-unlit" : ""}
              style={{ backgroundColor: TWIN_DISPLAY_COLORS[tone] }}
            />
            {copy.band[tone]}
          </li>
        ))}
      </ul>
      <p className="twin-cockpit-source">{copy.unit[layer]}</p>
    </section>
  );
}

export function TwinHome({ presentation = "full" }: { presentation?: "full" | "cockpit" }) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();
  const copy = twinCopyFor(lang);
  const language = baseLang(lang);
  const label = (region: string) => regionLabelFor(region, t);

  const snapshotQuery = useQuery({
    queryKey: ["twin-snapshot", user?.id, timeZone],
    enabled: Boolean(user),
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });
  const targetsQuery = useQuery({
    queryKey: ["todays-targets", user?.id, timeZone],
    enabled: Boolean(user),
    queryFn: () => getTodaysTargets({ data: timeZone }),
    staleTime: 60_000,
  });

  // Opens on today's session where there is one: the first question this
  // screen answers is "what am I training", and recovery is one tap away.
  // Falls back to recovery on a rest day or an unread programme, because a
  // session layer with no session to show is an empty answer.
  const [layer, setLayer] = useState<TwinLayer | null>(null);
  const [view, setView] = useState<BodyView>("front");
  const [selected, setSelected] = useState<string | null>(null);

  const snapshot = snapshotQuery.data;
  const targets: TodaysTargets | undefined = targetsQuery.isError
    ? { status: "unreadable" }
    : targetsQuery.data;

  const hasSession = targets?.status === "session";
  const shownLayer: TwinLayer =
    layer ?? (presentation === "full" && hasSession ? "todays_session" : "recovery");

  const selectRegion = (region: string) => {
    setSelected(region);
    if (isAnatomicalRegion(region)) setView((current) => viewShowing(region, current));
  };

  if (snapshotQuery.isLoading) {
    return (
      <section
        className={`grid place-items-center ${presentation === "cockpit" ? "twin-cockpit-loading" : "min-h-[60svh]"}`}
      >
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" /> {copy.loading}
        </p>
      </section>
    );
  }
  if (snapshotQuery.isError || !snapshot) {
    return <p className="text-sm text-muted-foreground">{copy.unavailable}</p>;
  }

  // Fatigue the body is still carrying, most fatigued first. Only regions with
  // a calculated estimate: one without evidence is not a recovered one.
  const recovering = snapshot.regions
    .filter((region) => region.recoveryPct !== null && region.recoveryBand !== "fresh")
    .sort((left, right) => (left.recoveryPct ?? 100) - (right.recoveryPct ?? 100));

  const region = selected
    ? (snapshot.regions.find((entry) => entry.region === selected) ?? null)
    : null;

  if (presentation === "cockpit") {
    const layerCopy = twinLayerCopy(language);
    const reading = mapTwinScene(
      snapshot,
      shownLayer,
      targets?.status === "session" ? targets : null,
    ).regions.find((entry) => entry.id === selected);
    const readingValue = reading
      ? shownLayer === "todays_session" && reading.display.value !== null
        ? `${reading.display.value} ${language === "lt" ? "pratimai" : "exercises"}`
        : formatTwinValue(reading.display.value, shownLayer, language)
      : null;

    return (
      <section aria-label={copy.title} data-twin-home className="twin-home--cockpit">
        <header className="twin-cockpit-header">
          <p>{language === "lt" ? "Skaitmeninis kūnas" : "Digital human"}</p>
          <h2>{copy.title}</h2>
          <span>{language === "lt" ? "Tempk ir tyrinėk 360°" : "Drag to explore 360°"}</span>
        </header>
        <TwinStage
          presentation="cockpit"
          snapshot={snapshot}
          layer={shownLayer}
          onLayerChange={setLayer}
          session={targets?.status === "session" ? targets : null}
          selectedRegion={selected}
          onSelectRegion={selectRegion}
          view={view}
          onViewChange={setView}
          regionLabel={label}
          language={language}
          sidePanel={
            <aside className="twin-cockpit-side">
              <CockpitLegend layer={shownLayer} language={language} />
              <div className="twin-cockpit-load">
                <TrainingLoadPanel />
              </div>
              {reading ? (
                <div className="twin-cockpit-reading" role="status">
                  <p>{label(reading.id)}</p>
                  <strong>{readingValue}</strong>
                  <span>{layerCopy.band[reading.display.tone]}</span>
                </div>
              ) : null}
            </aside>
          }
        />
      </section>
    );
  }

  return (
    <section
      aria-label={copy.title}
      data-twin-home
      className="relative -mx-4 overflow-hidden rounded-none border-y border-white/[0.07] bg-[#040a14] text-white sm:mx-0 sm:rounded-[1.75rem] sm:border"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 42%, rgba(29,95,180,.22), transparent 68%)",
        }}
      />

      <div className="relative grid min-h-[100svh] grid-rows-[auto_minmax(0,1fr)_auto] sm:min-h-[88svh]">
        <header className="px-4 pt-5 sm:px-6">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">
            <Flame aria-hidden="true" className="size-3.5" /> {t("th.eyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {targets?.status === "session" ? targets.title : copy.title}
          </h1>
          <p className="mt-1 text-xs text-neutral-400">{t("th.tapHint")}</p>
        </header>

        {/* Stretched, not centred: the stage fills the row so the figure is as
            large as the screen allows rather than sitting in the middle of it. */}
        <div className="grid min-h-0 min-w-0 px-1 sm:px-3">
          <TwinStage
            fill
            snapshot={snapshot}
            layer={shownLayer}
            onLayerChange={setLayer}
            // Null when the programme could not be read, so the session layer
            // shows every region as unknown rather than as untrained.
            session={targets?.status === "session" ? targets : null}
            selectedRegion={selected}
            onSelectRegion={selectRegion}
            view={view}
            onViewChange={setView}
            regionLabel={label}
            language={language}
          />
        </div>

        <div className="grid gap-4 px-4 pb-5 sm:px-6 lg:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
              <Dumbbell aria-hidden="true" className="size-3.5" /> {t("th.targets")}
            </h2>
            <div className="mt-2">
              <TodayPanel
                targets={targets}
                snapshot={snapshot}
                selected={selected}
                onSelect={selectRegion}
                label={label}
              />
            </div>
            {targets?.status === "session" ? (
              <Link
                to="/training"
                className="mt-3 inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
              >
                {t("th.open")}
              </Link>
            ) : null}
          </div>

          <div className="min-w-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
              {t("th.recovering")}
            </h2>
            {recovering.length === 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                {t("th.recoveringNone")}
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recovering.slice(0, 6).map((entry) => (
                  <RegionChip
                    key={entry.region}
                    region={entry}
                    label={label(entry.region)}
                    detail={`${entry.recoveryPct}%`}
                    selected={selected === entry.region}
                    onSelect={() => selectRegion(entry.region)}
                  />
                ))}
              </div>
            )}
            {region ? (
              <p className="mt-3 text-xs leading-relaxed text-neutral-300">
                <span className="font-semibold text-white">{label(region.region)}</span>{" "}
                {targets && targetsRegion(targets, region.region)
                  ? t("th.inToday")
                  : t("th.notInToday")}
                {region.lastTrainedHoursAgo === null
                  ? ""
                  : ` · ${copy.hoursAgo(Math.round(region.lastTrainedHoursAgo))}`}
              </p>
            ) : null}
          </div>

          <TrainingLoadPanel />
          <RecentWorkoutEffect />
        </div>
      </div>
    </section>
  );
}
