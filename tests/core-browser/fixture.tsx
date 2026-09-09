import "./offline-fixture";
import { DynamicWarmupGenerator } from "@/components/DynamicWarmupGenerator";
import { Route as WorkoutRoute } from "@/routes/_authenticated/workout/$day";
import { Route as TrainingRoute } from "@/routes/_authenticated/training";
/* eslint-disable react-refresh/only-export-components -- isolated executable fixture */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
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
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
});
Object.assign(window, { __coreQueries: client });
function Panel() {
  const selected = query.get("screen") ?? "meals";
  const routes = {
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
          <aside data-testid="synthetic-watermark" style={{ padding: 12, fontSize: 12 }}>
            SYNTHETIC TEST FIXTURE — NOT USER DATA
          </aside>
          <main style={{ padding: 16, maxWidth: 1180, margin: "auto" }}>
            <Panel />
          </main>
          <Toaster />
        </ThemeProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
