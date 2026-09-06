import { useState } from "react";
import { BodySceneStage } from "./BodySceneStage";
import { isAnatomicalRegion, openingView, viewShowing, type BodyView } from "./body-map.geometry";
import { TWIN_DISPLAY_COLORS } from "./twin-scene.model";
import {
  SESSION_REPLAY_LAYERS,
  formatSessionReplayValue,
  getSessionReplayDisplay,
  mapSessionReplayScene,
  type SessionReplayLayer,
} from "./session-replay.model";
import { baseLang, useI18n, type Lang, type TKey } from "@/lib/i18n";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import {
  UNASSIGNED_SESSION_REGION,
  type SessionMuscleContribution,
} from "@/lib/session-muscle-breakdown";
const knownGroups = new Set<string>(KNOWN_MUSCLE_GROUPS);
const COPY = {
  en: {
    eyebrow: "SESSION REPLAY",
    title: "Your recorded session",
    note: "Completed set records and logged external weight × repetitions. Not measured muscle activation, growth or recovery.",
    layers: "Session display layer",
    session_sets: "Completed sets",
    session_volume: "Logged volume",
    setsUnit: "completed set records",
    volumeUnit: "kg × reps",
    unknown: "No complete value for this region. Missing inputs are not zero effort.",
    empty: "No assigned completed set records for this region.",
    select: "Choose a region to inspect its recorded quantities.",
    unassigned: "Unassigned sets",
    offBody: "Not on the body",
    unavailable:
      "The exercise catalogue is unavailable. Set records are retained below, but cannot be mapped onto the body.",
    noAssignment:
      "Some completed sets could not be assigned to a catalogue muscle group. They remain in Unassigned sets, not distributed onto the body.",
    legend:
      "Blue tones are relative thirds of the largest listed value in this layer. They are not comparable muscle effort or stimulus. Grey means no complete value; a logged zero is shown as 0.",
    all: "All session groups",
    none: "No completed set records in this response.",
    loadFailed:
      "Your workout is saved, but its session replay is temporarily unavailable. Missing replay data does not mean you performed no work.",
    retry: "Retry replay",
    retrying: "Loading replay…",
  },
  lt: {
    eyebrow: "TRENIRUOTĖS ATVAIZDAS",
    title: "Tavo registruota treniruotė",
    note: "Atliktų setų įrašai ir registruotas išorinis svoris × pakartojimai. Tai nėra išmatuota raumenų aktyvacija, augimas ar atsistatymas.",
    layers: "Treniruotės vaizdo sluoksnis",
    session_sets: "Atlikti setai",
    session_volume: "Registruotas tūris",
    setsUnit: "atliktų setų įrašai",
    volumeUnit: "kg × pakart.",
    unknown: "Šiam regionui nėra išsamios reikšmės. Trūkstami duomenys nereiškia nulinių pastangų.",
    empty: "Šiam regionui nepriskirta atliktų setų įrašų.",
    select: "Pasirink regioną ir peržiūrėk jo registruotus kiekius.",
    unassigned: "Nepriskirti setai",
    offBody: "Ne ant kūno",
    unavailable:
      "Pratimų katalogas nepasiekiamas. Setų įrašai išsaugoti sąraše, tačiau jų negalima priskirti kūno regionams.",
    noAssignment:
      "Kai kurių atliktų setų nepavyko priskirti katalogo raumenų grupei. Jie lieka prie nepriskirtų setų ir nėra paskirstomi kūnui.",
    legend:
      "Mėlyni atspalviai rodo santykinius trečdalius pagal didžiausią šio sluoksnio sąrašo reikšmę. Jie nelygina raumenų pastangų ar stimulo. Pilka reiškia neišsamią reikšmę; registruotas nulis rodomas kaip 0.",
    all: "Visos treniruotės grupės",
    none: "Šiame atsakyme nėra atliktų setų įrašų.",
    loadFailed:
      "Treniruotė išsaugota, tačiau jos atvaizdas laikinai nepasiekiamas. Trūkstami atvaizdo duomenys nereiškia, kad neatlikai treniruotės.",
    retry: "Įkelti atvaizdą iš naujo",
    retrying: "Kraunamas atvaizdas…",
  },
} as const;

/** Pure view, also exercised with explicitly synthetic browser fixtures. */
export function BodyReplayView({
  contributions,
  lang,
  regionLabel,
  unavailable = false,
  onRetry,
  retrying = false,
}: {
  contributions: SessionMuscleContribution[];
  lang: Lang;
  regionLabel: (region: string) => string;
  unavailable?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const language = baseLang(lang);
  const copy = COPY[language];
  const [layer, setLayer] = useState<SessionReplayLayer>("session_sets");
  const initial =
    contributions.find((entry) => isAnatomicalRegion(entry.muscleGroup)) ?? contributions[0];
  const [selected, setSelected] = useState<string | null>(initial?.muscleGroup ?? null);
  const [view, setView] = useState<BodyView>(() =>
    openingView(contributions.map((entry) => entry.muscleGroup)),
  );
  const scene = mapSessionReplayScene(contributions, layer);
  const label = (region: string) =>
    region === UNASSIGNED_SESSION_REGION ? copy.unassigned : regionLabel(region);
  const selectRegion = (region: string) => {
    setSelected(region);
    if (isAnatomicalRegion(region)) setView((current) => viewShowing(region, current));
  };
  const reading = selected
    ? getSessionReplayDisplay(contributions, selected, layer)
    : { value: null, tone: "unknown" as const };
  const entry = contributions.find((item) => item.muscleGroup === selected);
  const format = (value: number | null) => {
    const result = formatSessionReplayValue(value, layer, language);
    return language === "lt" ? result.replace("kg × reps", "kg × pakart.") : result;
  };
  const unassigned = contributions.some((item) => item.mappingStatus === "unassigned");
  if (unavailable) {
    return (
      <section
        data-body-replay
        data-replay-source-unavailable
        role="status"
        className="mt-6 rounded-2xl border border-border bg-surface-2 p-4 text-left text-foreground"
      >
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.loadFailed}</p>
        {onRetry && (
          <button
            type="button"
            disabled={retrying}
            onClick={onRetry}
            style={{ minHeight: 44, minWidth: 44 }}
            className="mt-3 rounded-xl border border-border px-4 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
          >
            {retrying ? copy.retrying : copy.retry}
          </button>
        )}
      </section>
    );
  }
  return (
    <section
      data-body-replay
      className="mt-6 min-w-0 rounded-2xl border border-border bg-surface-2 p-3 text-left sm:p-5"
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</p>
      <h2 className="mt-2 text-xl text-foreground">{copy.title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
      {!scene.dataAvailable && (
        <p
          role="status"
          className="mt-3 rounded-xl border border-border p-3 text-sm text-foreground"
        >
          {copy.unavailable}
        </p>
      )}
      {unassigned && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{copy.noAssignment}</p>
      )}
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 rounded-2xl bg-[#080e0d] py-3 text-white">
          <BodySceneStage
            state={scene}
            language={language}
            selectedRegion={selected}
            onSelectRegion={selectRegion}
            view={view}
            onViewChange={setView}
            regionLabel={label}
            unitLabel={layer === "session_sets" ? copy.setsUnit : copy.volumeUnit}
            formatValue={format}
            formatRegion={(region) => format(region.display.value)}
            extraNote={copy.note}
            layerControls={
              <div
                role="group"
                aria-label={copy.layers}
                className="mx-3 mb-2 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1"
              >
                {SESSION_REPLAY_LAYERS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={layer === option}
                    onClick={() => setLayer(option)}
                    style={{ minWidth: 44, minHeight: 44 }}
                    className={`rounded-xl px-2 py-2 text-xs font-medium text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${layer === option ? "bg-white/10 text-white" : ""}`}
                  >
                    {copy[option]}
                  </button>
                ))}
              </div>
            }
          />
        </div>
        <aside
          data-replay-reading={layer}
          className="min-w-0 rounded-2xl border border-border bg-surface p-4 text-foreground"
        >
          <p className="text-xs text-muted-foreground">{copy[layer]}</p>
          {selected ? (
            <>
              <h3 className="mt-1 break-words text-xl font-semibold">{label(selected)}</h3>
              <p
                data-replay-value
                aria-live="polite"
                aria-atomic="true"
                className="mt-3 break-words font-mono text-2xl"
              >
                {format(reading.value)}
              </p>
              {!entry && <p className="mt-2 text-xs text-muted-foreground">{copy.empty}</p>}
              {entry && reading.value === null && (
                <p className="mt-2 text-xs text-muted-foreground">{copy.unknown}</p>
              )}
              {!isAnatomicalRegion(selected) && (
                <p className="mt-2 text-xs text-muted-foreground">{copy.offBody}</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{copy.select}</p>
          )}
        </aside>
      </div>
      <p data-replay-legend className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {copy.legend}
      </p>
      <h3 className="mt-4 text-sm font-medium text-foreground">{copy.all}</h3>
      {contributions.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">{copy.none}</p>
      )}
      <ul className="mt-2 space-y-1">
        {contributions.map((item) => {
          const display = getSessionReplayDisplay(contributions, item.muscleGroup, layer);
          return (
            <li key={item.muscleGroup}>
              <button
                type="button"
                data-replay-region={item.muscleGroup}
                aria-pressed={selected === item.muscleGroup}
                onClick={() => selectRegion(item.muscleGroup)}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TWIN_DISPLAY_COLORS[display.tone] }}
                  />
                  <span className="break-words text-sm">{label(item.muscleGroup)}</span>
                </span>
                <span className="break-all font-mono text-xs text-muted-foreground">
                  {format(display.value)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
/** Existing completion-screen API remains unchanged. */
export function BodyReplay({
  contributions,
  unavailable = false,
  onRetry,
  retrying = false,
}: {
  contributions: SessionMuscleContribution[];
  unavailable?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { lang, t } = useI18n();
  return (
    <BodyReplayView
      contributions={contributions}
      unavailable={unavailable}
      {...(onRetry ? { onRetry } : {})}
      retrying={retrying}
      lang={lang}
      regionLabel={(region) =>
        knownGroups.has(region)
          ? t(`mg.${region}` as TKey)
          : region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ")
      }
    />
  );
}
