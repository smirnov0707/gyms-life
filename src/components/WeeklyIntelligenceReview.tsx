import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Brain,
  Dumbbell,
  HeartPulse,
  Sparkles,
  Database,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TwinLedgerState } from "@/components/twin/TwinLedgerState";
import "./WeeklyIntelligenceReview.css";
import { baseLang, formatLocale, useI18n, type Lang } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { displayedMemoryContent, memoryEvidenceSummary } from "@/lib/user-memory.presentation";
import { getWeeklyIntelligenceReview } from "@/lib/weekly-intelligence.functions";
import type {
  WeeklyIntelligenceAction,
  WeeklyIntelligenceReview,
} from "@/lib/weekly-intelligence.schema";

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  unavailable: string;
  learning: string;
  patternsUnreadable: string;
  discoveries: string;
  thisWeek: string;
  workouts: string;
  checkins: string;
  readiness: string;
  next: string;
  stillLearning: string;
  noGaps: string;
  sourcesUnreadable: string;
  partial: string;
  learningLabel: string;
  ready: string;
  action: Record<WeeklyIntelligenceAction, { title: string; cta: string }>;
  gap: Record<WeeklyIntelligenceReview["stillLearning"][number], string>;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    return {
      eyebrow: "WEEKLY INTELLIGENCE",
      title: "Your week, in perspective",
      description: "Your recorded activity, observed patterns and one useful next step.",
      loading: "Reviewing your verified data…",
      unavailable: "This weekly review is temporarily unavailable.",
      learning:
        "There are not enough available records to show a pattern yet. Keep recording your activity.",
      patternsUnreadable:
        "Your observed patterns could not be loaded. Available activity totals are still shown.",
      discoveries: "Observed patterns",
      thisWeek: "Last 7 days",
      workouts: "completed workouts",
      checkins: "readiness check-ins",
      readiness: "average readiness",
      next: "One useful next step",
      stillLearning: "Review coverage",
      noGaps: "No activity-source gaps were reported.",
      sourcesUnreadable:
        "Some activity sources are temporarily unavailable. Missing totals stay unknown until they can be loaded.",
      partial: "Partial review",
      learningLabel: "Building your picture",
      ready: "From your records",
      action: {
        start_training: { title: "Record a completed workout", cta: "Open training" },
        check_readiness: { title: "Add a readiness check-in", cta: "Check readiness" },
        log_nutrition: { title: "Log nutrition", cta: "Open nutrition" },
        log_body_metrics: { title: "Add a body measurement", cta: "Open My Twin" },
        set_training_rhythm: { title: "Set your usual training days", cta: "Set rhythm" },
        open_today: { title: "Follow today's decision", cta: "Open Today" },
      },
      gap: {
        training_data_unavailable: "Training data is temporarily unavailable.",
        training_response_data_unavailable: "Workout-feeling data is temporarily unavailable.",
        decision_feedback_data_unavailable: "Decision feedback is temporarily unavailable.",
        no_completed_workouts_28d: "There are no completed workouts in the last 28 days.",
        recovery_data_unavailable: "Recovery data is temporarily unavailable.",
        no_recovery_checkins_7d: "There are no readiness check-ins in the last 7 days.",
        body_measurements_unavailable: "Body data is temporarily unavailable.",
        no_body_measurements_30d: "There are no body measurements in the last 30 days.",
        nutrition_data_unavailable: "Nutrition data is temporarily unavailable.",
        no_nutrition_logs_14d: "There are no nutrition logs in the last 14 days.",
        muscle_load_data_unavailable: "Muscle load data is temporarily unavailable.",
        current_context_unavailable: "Current-life context is temporarily unavailable.",
        training_rhythm_data_unavailable: "Training-rhythm data is temporarily unavailable.",
        personalization_consent_required: "Personalized AI context is not enabled.",
        personalization_consent_unavailable: "Personalization consent is temporarily unavailable.",
      },
    };
  }

  return {
    eyebrow: "SAVAITĖS APŽVALGA",
    title: "Tavo savaitė aiškiau",
    description:
      "Užregistruotas aktyvumas, pastebėti dėsningumai ir vienas naudingas kitas žingsnis.",
    loading: "Tikrinami patvirtinti tavo duomenys…",
    unavailable: "Savaitinė apžvalga šiuo metu nepasiekiama.",
    learning: "Turimų įrašų dar nepakanka dėsningumui parodyti. Toliau registruok savo aktyvumą.",
    patternsUnreadable:
      "Nepavyko įkelti pastebėtų dėsningumų. Pasiekiami aktyvumo rodikliai teberodomi.",
    discoveries: "Pastebėti dėsningumai",
    thisWeek: "Pastarosios 7 dienos",
    workouts: "baigtos treniruotės",
    checkins: "pasiruošimo patikros",
    readiness: "vid. pasiruošimas",
    next: "Vienas naudingas kitas žingsnis",
    stillLearning: "Apžvalgos duomenys",
    noGaps: "Aktyvumo šaltinių spragų nepranešta.",
    sourcesUnreadable:
      "Kai kurie aktyvumo šaltiniai laikinai nepasiekiami. Trūkstami rodikliai bus parodyti, kai duomenis pavyks įkelti.",
    partial: "Dalinė apžvalga",
    learningLabel: "Kaupiami duomenys",
    ready: "Iš tavo įrašų",
    action: {
      start_training: { title: "Užregistruok baigtą treniruotę", cta: "Atidaryti treniruotes" },
      check_readiness: { title: "Įvertink šiandienos pasiruošimą", cta: "Įvertinti pasiruošimą" },
      log_nutrition: { title: "Užregistruok mitybą", cta: "Atidaryti mitybą" },
      log_body_metrics: { title: "Pridėk kūno matavimą", cta: "Atidaryti My Twin" },
      set_training_rhythm: {
        title: "Nustatyk įprastas treniruočių dienas",
        cta: "Nustatyti ritmą",
      },
      open_today: { title: "Sek šiandienos sprendimą", cta: "Atidaryti šiandieną" },
    },
    gap: {
      training_data_unavailable: "Treniruočių duomenys laikinai nepasiekiami.",
      training_response_data_unavailable:
        "Savijautos po treniruočių duomenys laikinai nepasiekiami.",
      decision_feedback_data_unavailable: "Atsiliepimai apie sprendimus laikinai nepasiekiami.",
      no_completed_workouts_28d: "Per pastarąsias 28 dienas nėra baigtų treniruočių.",
      recovery_data_unavailable: "Atsistatymo duomenys laikinai nepasiekiami.",
      no_recovery_checkins_7d: "Per pastarąsias 7 dienas nėra pasiruošimo patikrų.",
      body_measurements_unavailable: "Kūno duomenys laikinai nepasiekiami.",
      no_body_measurements_30d: "Per pastarąsias 30 dienų nėra kūno matavimų.",
      nutrition_data_unavailable: "Mitybos duomenys laikinai nepasiekiami.",
      no_nutrition_logs_14d: "Per pastarąsias 14 dienų nėra mitybos įrašų.",
      muscle_load_data_unavailable: "Raumenų apkrovos duomenys laikinai nepasiekiami.",
      current_context_unavailable: "Dabartinis gyvenimo kontekstas laikinai nepasiekiamas.",
      training_rhythm_data_unavailable: "Treniruočių ritmo duomenys laikinai nepasiekiami.",
      personalization_consent_required: "Asmeninis AI kontekstas neįjungtas.",
      personalization_consent_unavailable: "Asmeninio konteksto sutikimas laikinai nepasiekiamas.",
    },
  };
}

const actionRoute: Record<
  WeeklyIntelligenceAction,
  "/app" | "/training" | "/readiness" | "/nutrition" | "/twin" | "/me"
> = {
  start_training: "/training",
  check_readiness: "/readiness",
  log_nutrition: "/nutrition",
  log_body_metrics: "/twin",
  set_training_rhythm: "/me",
  open_today: "/app",
};

export function WeeklyIntelligenceReview() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const timeZone = browserTimeZone();
  const copy = copyFor(lang);
  const locale = formatLocale(lang);
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["weekly-intelligence-review", user?.id, timeZone],
    queryFn: () => getWeeklyIntelligenceReview({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });
  const heading = (
    <header className="fl-ledger-heading">
      <span className="fl-ledger-eyebrow">
        <Sparkles aria-hidden="true" />
        {copy.eyebrow}
      </span>
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
    </header>
  );
  const retry = () => {
    void refetch();
  };
  if (isError || !data)
    return (
      <section className="fl-weekly-review">
        {heading}
        <TwinLedgerState
          state={isError ? "error" : "loading"}
          title={isError ? copy.unavailable : copy.loading}
          onRetry={isError ? retry : undefined}
          retrying={isFetching}
        />
      </section>
    );

  const trainingUnavailable = data.stillLearning.includes("training_data_unavailable");
  const recoveryUnavailable = data.stillLearning.includes("recovery_data_unavailable");
  const sourcesUnavailable = data.stillLearning.some((gap) => gap.endsWith("_unavailable"));
  const patternsUnavailable = data.status === "unreadable";
  const partial = sourcesUnavailable || patternsUnavailable;
  const action = copy.action[data.nextAction.action];
  const metrics = [
    {
      label: copy.workouts,
      value: trainingUnavailable ? null : data.thisWeek.completedWorkouts,
      icon: Dumbbell,
      suffix: "",
    },
    {
      label: copy.checkins,
      value: recoveryUnavailable ? null : data.thisWeek.readinessCheckins,
      icon: HeartPulse,
      suffix: "",
    },
    {
      label: copy.readiness,
      value: recoveryUnavailable ? null : data.thisWeek.averageReadiness,
      icon: Activity,
      suffix: "/100",
    },
  ];
  return (
    <section className="fl-weekly-review">
      {heading}
      <div className="fl-weekly-overview">
        <div className="fl-weekly-period">
          <h3>{copy.thisWeek}</h3>
          <span data-review-status={partial ? "partial" : data.status}>
            {partial ? copy.partial : data.status === "learning" ? copy.learningLabel : copy.ready}
          </span>
        </div>
        <dl className="fl-weekly-metrics">
          {metrics.map(({ label, value, icon: Icon, suffix }) => (
            <div key={label}>
              <dt>
                <Icon aria-hidden="true" />
                {label}
              </dt>
              <dd>
                {value === null ? "—" : value.toLocaleString(locale)}
                {value !== null && suffix ? <small>{suffix}</small> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <section className="fl-weekly-patterns">
        <h3>
          <Brain aria-hidden="true" />
          {copy.discoveries}
        </h3>
        {partial ? (
          <TwinLedgerState
            state="error"
            title={patternsUnavailable ? copy.patternsUnreadable : copy.sourcesUnreadable}
            onRetry={retry}
            retrying={isFetching}
          />
        ) : null}
        {!patternsUnavailable && data.discoveries.length ? (
          <div className="fl-weekly-discoveries">
            {data.discoveries.map((discovery, index) => (
              <article key={discovery.calculatedValue.kind}>
                <span className="fl-weekly-pattern-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p>{displayedMemoryContent(discovery, baseLang(lang))}</p>
                <footer>{memoryEvidenceSummary(discovery, baseLang(lang))}</footer>
              </article>
            ))}
          </div>
        ) : !partial ? (
          <TwinLedgerState state="empty" title={copy.learningLabel} description={copy.learning} />
        ) : null}
      </section>
      <section className="fl-weekly-next">
        <div>
          <span className="fl-ledger-eyebrow">{copy.next}</span>
          <h3>{action.title}</h3>
        </div>
        <Link to={actionRoute[data.nextAction.action]}>
          {action.cta}
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
      <section className="fl-weekly-coverage">
        <h3>
          <Database aria-hidden="true" />
          {copy.stillLearning}
        </h3>
        {data.stillLearning.length ? (
          <ul>
            {data.stillLearning.map((gap) => (
              <li key={gap} data-unavailable={gap.endsWith("_unavailable")}>
                {copy.gap[gap]}
              </li>
            ))}
          </ul>
        ) : (
          <p>{copy.noGaps}</p>
        )}
      </section>
    </section>
  );
}
