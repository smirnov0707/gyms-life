import { TwinRewind } from "@/components/twin/TwinRewind";
import { TwinTrendLens } from "@/components/twin/TwinTrendLens";
import { TwinMemory } from "@/components/twin/TwinMemory";
import { InjuryRiskRadar } from "@/components/InjuryRiskRadar";
import { TwinFuture } from "@/components/twin/TwinFuture";
import { FutureMeSummary } from "@/components/future-lab/FutureMeSummary";
import { WeeklyIntelligenceReview } from "@/components/WeeklyIntelligenceReview";
import { PerformanceProgressPanel } from "@/components/PerformanceProgressPanel";
import "./offline-fixture";
import { TwinMilestones } from "@/components/twin/TwinMilestones";
import { WorkoutHistoryPage } from "@/components/twin/TwinWorkoutHistory";
import { Route as CameraRoute } from "@/routes/_authenticated/ar";
import { Route as SupplementsRoute } from "@/routes/_authenticated/supplements";
import { Route as ExercisesRoute } from "@/routes/exercises.index";
import { Route as MovementRoute } from "@/routes/exercises.$slug";
import { DynamicWarmupGenerator } from "@/components/DynamicWarmupGenerator";
import { Route as ReadinessRoute } from "@/routes/_authenticated/readiness";
import { Route as WorkoutRoute } from "@/routes/_authenticated/workout/$day";
import { Route as TrainingRoute } from "@/routes/_authenticated/training";
/* eslint-disable react-refresh/only-export-components -- isolated executable fixture */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { LangProvider } from "@/lib/i18n";
import { DEFAULT_REMINDERS, daySchedule, ReminderProvider } from "@/lib/reminders";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";
import { ThemeProvider } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";
import { Route as ProfileRoute } from "@/routes/_authenticated/me";
import { ActivePlanLoader } from "@/components/ActivePlanLoader";
import { ProgramActivationActions } from "@/components/ProgramActivationActions";
import { Route as MealRoute } from "@/routes/_authenticated/meal-plan";
import { Route as NutritionRoute } from "@/routes/_authenticated/nutrition";
import { Route as OnboardingRoute } from "@/routes/_authenticated/onboarding";
import { ids } from "./state";
import "@/styles.css";
const query = new URLSearchParams(location.search);
localStorage.setItem("forma_lang", query.get("lang") ?? "en");
localStorage.setItem("forma_theme", query.get("theme") ?? "dark");
// This route fixture tests hydration entry, not wall-clock reminder delivery.
// Mark the initial scheduler tick as handled too, before persisted preferences load.
localStorage.setItem(
  "forma_reminders_v1",
  JSON.stringify({ ...DEFAULT_REMINDERS, enabled: false, sound: false }),
);
localStorage.setItem(
  "forma_reminders_fired",
  JSON.stringify({
    date: dayInTimeZone(new Date(), browserTimeZone()),
    keys: Object.fromEntries(
      daySchedule(DEFAULT_REMINDERS, new Date().getDay()).map((slot) => [
        `${slot.kind}-${slot.minutes}`,
        true,
      ]),
    ),
  }),
);
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
});
Object.assign(window, { __coreQueries: client });
function Panel() {
  const selected = query.get("screen") ?? "meals";
  if (selected === "future" || selected === "observed")
    return (
      <div className="fl-world-page mx-auto w-full max-w-6xl">
        {selected === "future" ? <TwinFuture /> : <FutureMeSummary />}
      </div>
    );
  if (selected === "rewind")
    return (
      <div className="fl-world-page mx-auto w-full max-w-6xl">
        <TwinRewind />
      </div>
    );
  if (selected === "trend")
    return (
      <div className="fl-world-page mx-auto w-full max-w-6xl">
        <TwinTrendLens
          initialRegion={query.get("region")}
          initiallyExpanded={query.get("collapsed") !== "1"}
        />
      </div>
    );
  if (selected === "memory")
    return (
      <div className="fl-world-page mx-auto w-full max-w-6xl">
        <TwinMemory />
      </div>
    );
  if (selected === "risk")
    return (
      <div className="fl-world-page mx-auto w-full max-w-6xl">
        <InjuryRiskRadar />
      </div>
    );
  if (selected === "weekly")
    return (
      <div className="fl-world-page mx-auto w-full max-w-6xl">
        <WeeklyIntelligenceReview />
      </div>
    );
  if (selected === "performance")
    return (
      <div className="fl-world-page mx-auto w-full max-w-6xl">
        <PerformanceProgressPanel />
      </div>
    );
  if (selected === "milestones")
    return (
      <div className="fl-world-page mx-auto w-full max-w-6xl">
        <TwinMilestones />
      </div>
    );
  if (selected === "history")
    return (
      <div className="fl-world-page mx-auto w-full max-w-6xl">
        <WorkoutHistoryPage />
      </div>
    );
  const routes = {
    camera: CameraRoute.options.component,
    supplements: SupplementsRoute.options.component,
    exercises: ExercisesRoute.options.component,
    movement: MovementRoute.options.component,
    readiness: ReadinessRoute.options.component,
    profile: ProfileRoute.options.component,
    meals: MealRoute.options.component,
    nutrition: NutritionRoute.options.component,
    onboarding: OnboardingRoute.options.component,
    training: TrainingRoute.options.component,
    workout: WorkoutRoute.options.component,
  };
  const Component = routes[selected as keyof typeof routes];
  if (Component) return <Component />;
  if (selected === "ai-warmup")
    return <DynamicWarmupGenerator focus="Synthetic squat" exercises={["bodyweight-squats"]} />;
  if (selected === "activation")
    return (
      <>
        <ProgramActivationActions planId={ids.TRAINING_ID} lang="en" />
        <ActivePlanLoader />
      </>
    );
  if (selected === "training") return <ActivePlanLoader />;
  return <h1>Outside the controlled core fixture</h1>;
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <LangProvider>
        <ThemeProvider>
          <ReminderProvider>
            <aside data-testid="synthetic-watermark" style={{ padding: 12, fontSize: 12 }}>
              SYNTHETIC TEST FIXTURE — NOT USER DATA
            </aside>
            {["exercises", "movement"].includes(query.get("screen") ?? "") ? (
              <Panel />
            ) : query.get("shell") === "1" ? (
              <AppShell>
                <Panel />
              </AppShell>
            ) : (
              <main style={{ padding: 16, maxWidth: 1180, margin: "auto" }}>
                <Panel />
              </main>
            )}
            <Toaster position="top-center" />
          </ReminderProvider>
        </ThemeProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
