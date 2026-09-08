import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTwinSnapshot } from "@/lib/digital-twin.functions";
import { getLastSessionEffect } from "@/lib/last-session.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import { twinCopyFor } from "@/components/TwinView";
import { TwinStage } from "./TwinStage";
import { TwinTrendLens } from "./TwinTrendLens";
import { getTwinRegionDisplay, TWIN_DISPLAY_COLORS } from "./twin-scene.model";
import { formatTwinValue, twinLayerCopy } from "./twin-layer.copy";
import { viewShowing, isAnatomicalRegion, type BodyView } from "./body-map.geometry";

const COPY = {
  en: {
    back: "All muscles",
    status: "Status",
    history: "History",
    impact: "Impact",
    details: "View evidence",
    lastSession: "Latest completed session",
    absent: "No logged sets in this session are attributed to this region.",
    sets: "Completed sets",
    volume: "Logged volume",
    share: "Share of logged session volume",
  },
  lt: {
    back: "Visi raumenys",
    status: "Būsena",
    history: "Istorija",
    impact: "Poveikis",
    details: "Peržiūrėti duomenis",
    lastSession: "Paskutinė užbaigta treniruotė",
    absent: "Šioje treniruotėje šiam regionui nėra priskirtų registruotų setų.",
    sets: "Užbaigti setai",
    volume: "Registruotas krūvis",
    share: "Treniruotės registruoto krūvio dalis",
  },
} as const;
const TABS = ["status", "history", "impact"] as const;
const KNOWN_GROUPS = new Set<string>(KNOWN_MUSCLE_GROUPS);

/** Region detail uses the same snapshot, geometry and logged session as the overview. */
export function TwinMuscleDetail({
  regionId,
  onRegionChange,
  onBack,
  backLabel,
}: {
  regionId: string;
  onRegionChange: (region: string) => void;
  onBack: () => void;
  backLabel?: string;
}) {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const language = baseLang(lang);
  const copy = COPY[language];
  const twin = twinCopyFor(lang);
  const layerCopy = twinLayerCopy(language);
  const [tab, setTab] = useState<(typeof TABS)[number]>("status");
  const [view, setView] = useState<BodyView>(
    isAnatomicalRegion(regionId) ? viewShowing(regionId, "front") : "front",
  );
  const timeZone = browserTimeZone();
  const snapshot = useQuery({
    queryKey: ["twin-snapshot", user?.id, timeZone],
    enabled: Boolean(user),
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });
  const session = useQuery({
    queryKey: ["last-session-effect", user?.id, timeZone],
    enabled: Boolean(user) && tab === "impact",
    queryFn: () => getLastSessionEffect({ data: timeZone }),
    staleTime: 60_000,
  });
  const label = (region: string) =>
    KNOWN_GROUPS.has(region)
      ? t(`mg.${region}` as TKey)
      : region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
  const number = (value: number) =>
    new Intl.NumberFormat(formatLocale(lang), { maximumFractionDigits: 0 }).format(value);
  const source = snapshot.data?.regions.find((region) => region.region === regionId);
  const reading = snapshot.data ? getTwinRegionDisplay(snapshot.data, regionId, "recovery") : null;
  const volume = snapshot.data
    ? getTwinRegionDisplay(snapshot.data, regionId, "logged_volume")
    : null;
  const effect = session.data?.status === "session" ? session.data : null;
  const row = effect?.breakdown.find((item) => item.muscleGroup === regionId);
  const shareUsable = effect?.breakdown.every((item) => item.shareOfSession !== null);

  return (
    <section className="twin-muscle-detail" data-twin-muscle-detail={regionId}>
      <header>
        <button type="button" onClick={onBack} className="twin-detail-back">
          <ArrowLeft aria-hidden="true" size={17} /> {backLabel ?? copy.back}
        </button>
        <h2>{label(regionId)}</h2>
      </header>
      <div role="group" aria-label={label(regionId)} className="twin-detail-tabs">
        {TABS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={tab === option}
            onClick={() => setTab(option)}
          >
            {copy[option]}
          </button>
        ))}
      </div>
      {tab === "status" ? (
        snapshot.isError ? (
          <p className="twin-detail-message">{twin.unavailable}</p>
        ) : !snapshot.data ? (
          <p className="twin-detail-message" role="status">
            <Loader2 className="animate-spin" size={16} /> {twin.loading}
          </p>
        ) : (
          <>
            <div className="twin-detail-stage">
              <TwinStage
                presentation="detail"
                showLayerControls={false}
                focusRegion={regionId}
                snapshot={snapshot.data}
                layer="recovery"
                onLayerChange={() => {}}
                selectedRegion={regionId}
                onSelectRegion={onRegionChange}
                view={view}
                onViewChange={setView}
                regionLabel={label}
                language={language}
              />
            </div>
            <div className="twin-detail-readout">
              <div className="twin-detail-score">
                <div>
                  <span>{twin.recovery}</span>
                  <p>{layerCopy.band[reading?.tone ?? "unknown"]}</p>
                </div>
                <strong>{formatTwinValue(reading?.value ?? null, "recovery", language)}</strong>
              </div>
              {reading?.value !== null && reading?.value !== undefined ? (
                <div
                  className="twin-detail-meter"
                  role="meter"
                  aria-label={twin.recovery}
                  aria-valuenow={reading.value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    style={{
                      width: `${reading.value}%`,
                      backgroundColor: TWIN_DISPLAY_COLORS[reading.tone],
                    }}
                  />
                </div>
              ) : (
                <p className="twin-detail-note">{twin.noEvidence}</p>
              )}
              <dl>
                <div>
                  <dt>{twin.metaLastTrained}</dt>
                  <dd>
                    {source?.lastTrainedHoursAgo != null
                      ? twin.hoursAgo(Math.round(source.lastTrainedHoursAgo))
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{twin.volume}</dt>
                  <dd>{formatTwinValue(volume?.value ?? null, "logged_volume", language)}</dd>
                </div>
              </dl>
              <details>
                <summary>{copy.details}</summary>
                <p>
                  {twin.estimateNote} {twin.sourceNote}
                </p>
                <p>{twin.evidenceWindow(snapshot.data.evidenceWindowDays)}</p>
              </details>
            </div>
          </>
        )
      ) : tab === "history" ? (
        <TwinTrendLens key={regionId} initialRegion={regionId} initiallyExpanded />
      ) : (
        <div className="twin-detail-impact">
          <h3>{copy.lastSession}</h3>
          {session.isError || session.data?.status === "unreadable" ? (
            <p>{t("ls2.unreadable")}</p>
          ) : !session.data ? (
            <p role="status">
              <Loader2 className="animate-spin" size={16} /> {twin.loading}
            </p>
          ) : session.data.status === "none" ? (
            <p>{t("ls2.none")}</p>
          ) : effect ? (
            <>
              <p className="twin-detail-session-title">
                {effect.title ?? copy.lastSession} ·{" "}
                {new Date(effect.finishedAt).toLocaleDateString(formatLocale(lang), {
                  day: "numeric",
                  month: "short",
                })}
              </p>
              {!effect.breakdownAvailable ? (
                <p>{t("ls2.breakdownUnavailable")}</p>
              ) : !row ? (
                <p>{copy.absent}</p>
              ) : (
                <dl>
                  <div>
                    <dt>{copy.sets}</dt>
                    <dd>{number(row.sets)}</dd>
                  </div>
                  <div>
                    <dt>{copy.volume}</dt>
                    <dd>
                      {row.volumeKg === null
                        ? "—"
                        : `${number(row.volumeKg)} kg × ${language === "lt" ? "kart." : "reps"}`}
                    </dd>
                  </div>
                  {shareUsable && row.shareOfSession !== null ? (
                    <div>
                      <dt>{copy.share}</dt>
                      <dd>{number(row.shareOfSession * 100)}%</dd>
                    </div>
                  ) : null}
                </dl>
              )}
              <p className="twin-detail-note">
                {shareUsable ? t("ls2.shareNote") : t("ls2.noShare")}
              </p>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
