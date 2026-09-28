import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Dumbbell, Moon, Scale, ScanLine } from "lucide-react";
import { TwinLedgerState } from "@/components/twin/TwinLedgerState";
import { baseLang, formatLocale, useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { getTwinTrendHistory } from "@/lib/twin-trend.functions";
import {
  buildTwinMetricTrend,
  TWIN_TREND_MIN_POINTS,
  TWIN_TREND_MIN_SPAN_HOURS,
  type TwinTrendHistory,
  type TwinTrendMetricKey,
  type TwinTrendSeries,
} from "@/lib/twin-trend";
import "./FutureMeSummary.css";

const ranges = [30, 90, 180, 0] as const;
const metrics: {
  key: TwinTrendMetricKey;
  lt: string;
  en: string;
  unit: string;
  icon: typeof Activity;
}[] = [
  { key: "readiness", lt: "Pasiruošimas", en: "Readiness", unit: "/100", icon: Activity },
  { key: "totalVolumeLast28Days", lt: "28 d. krūvis", en: "28d load", unit: "kg", icon: Dumbbell },
  { key: "sleepHours", lt: "Miegas", en: "Sleep", unit: "h", icon: Moon },
  { key: "weightKg", lt: "Svoris", en: "Weight", unit: "kg", icon: Scale },
];
function scopedHistory(history: TwinTrendHistory, days: number): TwinTrendHistory {
  if (days === 0) return history;
  const cutoff = Date.now() - days * 86_400_000;
  return {
    ...history,
    points: history.points.filter((point) => Date.parse(point.computedAt) >= cutoff),
  };
}
function ObservedLine({ series }: { series: TwinTrendSeries }) {
  const firstSample = series.samples[0],
    lastSample = series.samples.at(-1);
  if (
    series.availability !== "available" ||
    !firstSample ||
    !lastSample ||
    series.minValue === null ||
    series.maxValue === null
  )
    return null;
  const first = Date.parse(firstSample.computedAt),
    duration = Date.parse(lastSample.computedAt) - first;
  if (duration <= 0) return null;
  const minimum = series.minValue,
    range = series.maxValue - minimum;
  const points = series.samples
    .map((sample) => {
      const x = 4 + ((Date.parse(sample.computedAt) - first) / duration) * 232;
      const y = range === 0 ? 32 : 58 - ((sample.value - minimum) / range) * 50;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 240 66" aria-hidden="true" className="fl-observed-line">
      <path d="M4 60H236" stroke="currentColor" strokeOpacity=".15" />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function FutureMeSummary() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const locale = formatLocale(lang);
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 });
  const date = (value: string) =>
    new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  const { user } = useAuth();
  const [range, setRange] = useState<(typeof ranges)[number]>(30);
  const query = useQuery({
    queryKey: ["future-me-trend", user?.id],
    queryFn: () => getTwinTrendHistory(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const history = useMemo(
    () => (query.data ? scopedHistory(query.data, range) : null),
    [query.data, range],
  );
  return (
    <section className="fl-observed-page">
      <header className="fl-ledger-heading">
        <span className="fl-ledger-eyebrow">
          <ScanLine aria-hidden="true" />
          {english ? "RECORDED CHANGE" : "UŽFIKSUOTI POKYČIAI"}
        </span>
        <h2>{english ? "Your observed evolution" : "Tavo stebimi pokyčiai"}</h2>
        <p>
          {english
            ? "Follow your recorded readiness, training load, sleep and weight over time."
            : "Stebėk, kaip keitėsi užregistruotas pasiruošimas, treniruočių krūvis, miegas ir svoris."}
        </p>
      </header>
      <div
        className="fl-observed-ranges"
        role="group"
        aria-label={english ? "Observation window" : "Stebėjimo laikotarpis"}
      >
        {ranges.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={range === days}
            onClick={() => setRange(days)}
          >
            {days === 0
              ? english
                ? "All loaded"
                : "Visi įkelti"
              : `${days} ${english ? "days" : "d."}`}
          </button>
        ))}
      </div>
      {query.isError ? (
        <TwinLedgerState
          state="error"
          title={
            english
              ? "Recorded changes are temporarily unavailable."
              : "Užfiksuoti pokyčiai laikinai nepasiekiami."
          }
          onRetry={() => {
            void query.refetch();
          }}
          retrying={query.isFetching}
        />
      ) : !history ? (
        <TwinLedgerState
          state="loading"
          title={english ? "Reading your stored observations…" : "Skaitomi išsaugoti stebėjimai…"}
        />
      ) : (
        <>
          <div className="fl-observed-metrics">
            {metrics.map((metric) => {
              const series = buildTwinMetricTrend(history, metric.key),
                Icon = metric.icon;
              const label = english ? metric.en : metric.lt;
              const first = series.samples[0],
                last = series.samples.at(-1);
              return (
                <article className="fl-observed-metric" key={metric.key} data-metric={metric.key}>
                  <h3>
                    <Icon aria-hidden="true" />
                    {label}
                  </h3>
                  <p className="fl-observed-value">
                    {series.latestValue === null ? "—" : number(series.latestValue)}
                    {series.latestValue !== null ? <small>{metric.unit}</small> : null}
                  </p>
                  {last ? (
                    <p className="fl-observed-date">
                      {english ? "Last recorded" : "Paskutinis įrašas"} · {date(last.computedAt)}
                    </p>
                  ) : null}
                  <ObservedLine series={series} />
                  <p className="fl-observed-change">
                    {series.availability === "available" && series.netChange !== null
                      ? `${series.netChange > 0 ? "+" : ""}${number(series.netChange)}${metric.unit && metric.unit !== "/100" ? ` ${metric.unit}` : ""} · ${english ? "across the observed period" : "per stebėtą laikotarpį"}`
                      : series.latestValue === null
                        ? english
                          ? "No compatible observations in this period."
                          : "Šiuo laikotarpiu nėra suderinamų stebėjimų."
                        : english
                          ? "More observations over time are needed to show a direction."
                          : "Krypčiai nustatyti reikia daugiau stebėjimų per ilgesnį laiką."}
                  </p>
                  {first && last ? (
                    <details className="fl-observed-values">
                      <summary>
                        {english ? "Recorded values" : "Įrašytos reikšmės"}
                        <span>{series.pointCount}</span>
                      </summary>
                      <div>
                        <table>
                          <caption>
                            {label} · {date(first.computedAt)} – {date(last.computedAt)}
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">{english ? "Date" : "Data"}</th>
                              <th scope="col">
                                {label} {metric.unit}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {series.samples.map((sample) => (
                              <tr key={sample.snapshotId}>
                                <td>
                                  <time dateTime={sample.computedAt}>
                                    {date(sample.computedAt)}
                                  </time>
                                </td>
                                <td>{number(sample.value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
          <p className="fl-observed-coverage">
            {english
              ? `Compatible observations in this period: ${history.points.length}.`
              : `Suderinami stebėjimai šiuo laikotarpiu: ${history.points.length}.`}{" "}
            {query.data?.hasMore
              ? english
                ? "Older records exist beyond the loaded history."
                : "Yra senesnių įrašų už įkeltos istorijos ribų."
              : ""}{" "}
            {(query.data?.omittedCount ?? 0) + (query.data?.incompatibleCount ?? 0) > 0
              ? english
                ? `Excluded records: ${(query.data?.omittedCount ?? 0) + (query.data?.incompatibleCount ?? 0)}. They cannot be compared with the current data.`
                : `Neįtraukti įrašai: ${(query.data?.omittedCount ?? 0) + (query.data?.incompatibleCount ?? 0)}. Jie nesuderinami su dabartiniais duomenimis.`
              : ""}
          </p>
        </>
      )}
      <aside className="fl-observed-context">
        <div>
          <h3>{english ? "What these changes mean" : "Ką rodo šie pokyčiai"}</h3>
          <p>
            {english
              ? `A direction requires at least ${TWIN_TREND_MIN_POINTS} compatible observations spanning ${TWIN_TREND_MIN_SPAN_HOURS} hours. Missing measurements stay unknown.`
              : `Krypčiai nustatyti reikia bent ${TWIN_TREND_MIN_POINTS} suderinamų stebėjimų, kuriuos skiria bent ${TWIN_TREND_MIN_SPAN_HOURS} valandos. Trūkstami matavimai lieka nežinomi.`}
          </p>
        </div>
        <div>
          <h3>{english ? "Body composition is not projected" : "Kūno sudėtis neprognozuojama"}</h3>
          <p>
            {english
              ? "Strength projections are shown separately when there are enough records. Future muscle mass, body fat and body shape are not calculated."
              : "Kai įrašų pakanka, jėgos prognozės rodomos atskirai. Būsima raumenų masė, kūno riebalai ir forma neskaičiuojami."}
          </p>
        </div>
      </aside>
    </section>
  );
}
