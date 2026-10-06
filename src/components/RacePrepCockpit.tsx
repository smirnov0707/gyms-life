import type { ReactNode } from "react";
import { CalendarDays, Gauge, Route, Target } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import type { getActiveRacePrep } from "@/lib/endurance-race-prep.functions";

const km = (m: number) => (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1);
const paceText = (seconds: number | null) =>
  seconds === null
    ? "—"
    : Math.floor(seconds / 60) + ":" + String(Math.round(seconds % 60)).padStart(2, "0") + "/km";
const phaseLabel = (phase: string, en: boolean) =>
  ({
    base: en ? "Base" : "Bazė",
    build: en ? "Build" : "Auginimas",
    specific: en ? "Race specific" : "Specifinis pasiruošimas",
    taper: en ? "Taper" : "Krūvio mažinimas",
    race: en ? "Race week" : "Varžybų savaitė",
  })[phase] ?? phase;

type ActiveRacePrep = Exclude<Awaited<ReturnType<typeof getActiveRacePrep>>, { status: "none" }>;

export function RacePrepCockpit({ data }: { data: ActiveRacePrep }) {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const pct =
    data.progress.distanceCompletionRatio === null
      ? null
      : Math.round(data.progress.distanceCompletionRatio * 100);
  return (
    <section className="fl-premium-card relative overflow-hidden rounded-[2rem] border border-border bg-surface p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="fl-eyebrow">RACE PREP · {phaseLabel(data.currentWeek.phase, english)}</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {english ? "Your endurance campaign" : "Tavo ištvermės kampanija"}
            </h2>
          </div>
          <div className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
            {data.daysToRace} {english ? "days to race" : "d. iki starto"}
          </div>
        </header>
        {data.adaptation.action !== "hold" && data.adaptationStatus === "persisted" ? (
          <div className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="fl-eyebrow">{english ? "PLAN ADAPTATION" : "PLANO ADAPTACIJA"}</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">
                {data.adaptation.action === "recover"
                  ? english
                    ? "Recovery protected"
                    : "Saugomas atsistatymas"
                  : english
                    ? "Volume reduced"
                    : "Krūvis sumažintas"}
              </h3>
              <strong>{Math.round(data.adaptation.volumeModifier * 100)}%</strong>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {english ? "Deterministic reason: " : "Deterministinė priežastis: "}
              {data.adaptation.reason.replaceAll("_", " ")}.{" "}
              {english
                ? "This decision is stored in your adaptation history."
                : "Šis sprendimas išsaugotas adaptacijų istorijoje."}
            </p>
          </div>
        ) : null}
        <div className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="fl-eyebrow">{english ? "RACE READINESS" : "PASIRENGIMAS STARTUI"}</p>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
              {data.readiness.evidenceLevel === "high"
                ? english
                  ? "High evidence"
                  : "Daug duomenų"
                : data.readiness.evidenceLevel === "moderate"
                  ? english
                    ? "Moderate evidence"
                    : "Vidutiniškai duomenų"
                  : english
                    ? "Building evidence"
                    : "Kaupiami duomenys"}
            </span>
          </div>
          <h3 className="mt-2 text-xl font-semibold">
            {data.readiness.status === "on_track"
              ? english
                ? "On track"
                : "Pagal planą"
              : data.readiness.status === "strained"
                ? english
                  ? "Load needs attention"
                  : "Krūviui reikia dėmesio"
                : data.readiness.status === "building"
                  ? english
                    ? "Building"
                    : "Formuojasi"
                  : english
                    ? "Not enough evidence yet"
                    : "Dar nepakanka duomenų"}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {data.readiness.status === "insufficient_evidence"
              ? english
                ? "GYMS.LIFE will not invent a race probability from a few sessions."
                : "GYMS.LIFE nekurs varžybų tikimybės iš kelių treniruočių."
              : data.readiness.factors.join(" · ").replaceAll("_", " ")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric
            icon={<CalendarDays className="size-4" />}
            value={String(data.currentWeek.week)}
            label={english ? "Plan week" : "Plano savaitė"}
          />
          <Metric
            icon={<Route className="size-4" />}
            value={
              km(data.progress.completedDistanceMeters) +
              " / " +
              km(data.progress.plannedDistanceMeters) +
              " km"
            }
            label={english ? "This week" : "Šią savaitę"}
          />
          <Metric
            icon={<Target className="size-4" />}
            value={data.progress.completedSessions + " / " + data.progress.plannedSessions}
            label={english ? "Sessions" : "Sesijos"}
          />
          <Metric
            icon={<Gauge className="size-4" />}
            value={pct === null ? "—" : pct + "%"}
            label={english ? "Distance progress" : "Distancijos progresas"}
          />
        </div>
        {data.efficiencyTrend.status !== "insufficient_evidence" ? (
          <div className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-4">
            <p className="fl-eyebrow">{english ? "RUNNING EFFICIENCY" : "BĖGIMO EFEKTYVUMAS"}</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">
                {data.efficiencyTrend.status === "improving"
                  ? english
                    ? "Improving"
                    : "Gerėja"
                  : data.efficiencyTrend.status === "declining"
                    ? english
                      ? "Recent efficiency is lower"
                      : "Naujausias efektyvumas mažesnis"
                    : english
                      ? "Stable"
                      : "Stabilu"}
              </h3>
              <span className="text-xs font-semibold text-muted-foreground">
                {data.efficiencyTrend.sessions} {english ? "comparable runs" : "palyginami bėgimai"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {english
                ? "Derived from your speed relative to heart rate within repeated " +
                  data.efficiencyTrend.terrain +
                  " terrain. It is not VO₂max or a laboratory running-economy measurement."
                : "Išvesta iš tavo greičio santykio su pulsu kartojamame „" +
                  data.efficiencyTrend.terrain +
                  "“ reljefe. Tai nėra VO₂max ar laboratorinis bėgimo ekonomiškumo matavimas."}
            </p>
          </div>
        ) : null}
        {data.terrainResponse.status === "measured" ? (
          <div className="rounded-[1.5rem] border border-border bg-background/25 p-4">
            <p className="fl-eyebrow">{english ? "TERRAIN RESPONSE" : "REAKCIJA Į RELJEFĄ"}</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">
                {english ? "Observed hill response" : "Pamatuota reakcija į įkalnes"}
              </h3>
              <strong className="text-primary">
                {data.terrainResponse.observedPaceDifferenceFraction === null
                  ? "—"
                  : (data.terrainResponse.observedPaceDifferenceFraction * 100).toFixed(1) + "%"}
              </strong>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {english
                ? "Observed difference between your repeated flat and hilly runs. This is not a universal grade-adjusted pace formula."
                : "Pamatuotas skirtumas tarp tavo pasikartojančių lygių ir kalvotų bėgimų. Tai nėra universali grade-adjusted pace formulė."}
            </p>
          </div>
        ) : null}
        <div className="rounded-[1.5rem] border border-border bg-background/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="fl-eyebrow">{english ? "PACE INTELLIGENCE" : "TEMPO INTELLIGENCE"}</p>
            <span className="text-xs font-semibold text-muted-foreground">
              {data.paceProfile.evidenceRuns} {english ? "runs" : "bėg."} ·{" "}
              {data.paceProfile.evidenceLevel}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">
              {data.paceProfile.trend === "faster"
                ? english
                  ? "Getting faster"
                  : "Tempas greitėja"
                : data.paceProfile.trend === "slower"
                  ? english
                    ? "Recent pace is slower"
                    : "Naujausias tempas lėtesnis"
                  : data.paceProfile.trend === "stable"
                    ? english
                      ? "Stable pace"
                      : "Stabilus tempas"
                    : english
                      ? "Building evidence"
                      : "Kaupiami duomenys"}
            </h3>
            <strong className="text-primary">
              {paceText(data.paceProfile.recentMedianSecondsPerKm)}
            </strong>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {data.paceProfile.byIntent.easy ? (
              <span>Easy {paceText(data.paceProfile.byIntent.easy.medianSecondsPerKm)}</span>
            ) : null}
            {data.paceProfile.byIntent.tempo ? (
              <span>Tempo {paceText(data.paceProfile.byIntent.tempo.medianSecondsPerKm)}</span>
            ) : null}
            {data.paceProfile.byIntent.long ? (
              <span>Long {paceText(data.paceProfile.byIntent.long.medianSecondsPerKm)}</span>
            ) : null}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-background/25 p-4">
          <p className="fl-eyebrow">{english ? "LONG-RUN CAPACITY" : "ILGO BĖGIMO PAJĖGUMAS"}</p>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">
              {data.longRunProgress.status === "progressing"
                ? english
                  ? "Progressing"
                  : "Progresuoja"
                : data.longRunProgress.status === "stable"
                  ? english
                    ? "Stable"
                    : "Stabilu"
                  : data.longRunProgress.status === "regressing"
                    ? english
                      ? "Recent peak is lower"
                      : "Naujausias pikas mažesnis"
                    : english
                      ? "Building evidence"
                      : "Kaupiami duomenys"}
            </h3>
            <strong className="text-primary">
              {data.longRunProgress.recentLongestMeters
                ? km(data.longRunProgress.recentLongestMeters) + " km"
                : "—"}
            </strong>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.longRunCoverage === null
              ? english
                ? "More long-run history is needed before race-specific coverage can be interpreted."
                : "Reikia daugiau ilgų bėgimų istorijos, kad būtų galima vertinti pasirengimą konkrečiai distancijai."
              : english
                ? "Recent longest run covers " +
                  Math.round(data.longRunCoverage * 100) +
                  "% of race distance. This is context, not a universal readiness threshold."
                : "Naujausias ilgiausias bėgimas sudaro " +
                  Math.round(data.longRunCoverage * 100) +
                  "% varžybų distancijos. Tai kontekstas, o ne universali pasirengimo riba."}
          </p>
        </div>
        {data.nextSession ? (
          <div className="rounded-[1.5rem] border border-border bg-background/35 p-4">
            <p className="fl-eyebrow">{english ? "NEXT RUN" : "KITAS BĖGIMAS"}</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xl font-semibold capitalize">{data.nextSession.intent}</h3>
              <strong className="text-primary">
                {data.nextSession.plannedDistanceMeters
                  ? km(data.nextSession.plannedDistanceMeters) + " km"
                  : data.nextSession.plannedDurationMinutes + " min"}
              </strong>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{data.nextSession.intensityCue}</p>
          </div>
        ) : data.adaptation.action === "recover" && data.adaptationStatus === "persisted" ? (
          <div className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-4">
            <p className="fl-eyebrow">{english ? "RECOVERY WINDOW" : "ATSISTATYMO LANGAS"}</p>
            <h3 className="mt-2 text-xl font-semibold">
              {english ? "No run prescribed right now" : "Šiuo metu bėgimas neskiriamas"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {english
                ? "The persisted recovery decision temporarily pauses the next executable run. The base plan remains intact and will be re-evaluated when new evidence arrives."
                : "Išsaugotas atsistatymo sprendimas laikinai pristabdo kitą vykdomą bėgimą. Bazinis planas lieka nepakeistas ir bus pervertintas gavus naujų duomenų."}
            </p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {data.baseline === "measured"
            ? english
              ? "Plan baseline comes from your recent completed runs."
              : "Plano bazė apskaičiuota iš tavo realiai atliktų bėgimų."
            : english
              ? "Not enough recent running yet; the plan starts conservatively."
              : "Dar trūksta naujausių bėgimų istorijos, todėl planas pradeda konservatyviai."}
        </p>
      </div>
    </section>
  );
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-[1.25rem] border border-border bg-background/30 p-3">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="text-lg font-semibold text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
