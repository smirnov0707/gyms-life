import { createFileRoute } from "@tanstack/react-router";
import { ActivePlanLoader } from "@/components/ActivePlanLoader";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({
    meta: [
      { title: "Treniruotės — GYMS.LIFE" },
      { name: "description", content: "Tavo aktyvi GYMS.LIFE treniruočių programa." },
    ],
  }),
  component: TrainingPage,
});

function TrainingPage() {
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6"><ActivePlanLoader /></main>;
}
