import { SavedTrainingPrograms } from "@/components/SavedTrainingPrograms";
import { createFileRoute } from "@tanstack/react-router";
import { ActivePlanLoader } from "@/components/ActivePlanLoader";
import { RacePrepStarter } from "@/components/RacePrepStarter";
import { RacePrepCockpit } from "@/components/RacePrepCockpit";
import { PostRunIntelligence } from "@/components/PostRunIntelligence";

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
  return (
    <main className="fl-context-route fl-workspace fl-training-workspace fl-page-enter">
      <ActivePlanLoader />
      <PostRunIntelligence />
      <RacePrepCockpit />
      <RacePrepStarter />
      <SavedTrainingPrograms />
    </main>
  );
}
