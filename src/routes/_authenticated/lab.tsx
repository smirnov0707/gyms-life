import { createFileRoute } from "@tanstack/react-router";
import { HypothesisRetrospective } from "@/components/HypothesisRetrospective";
import { LabView } from "@/components/LabView";

export const Route = createFileRoute("/_authenticated/lab")({
  head: () => ({
    meta: [
      { title: "Laboratorija — GYMS.LIFE" },
      {
        name: "description",
        content: "Realios hipotezės, jų mokymosi istorija ir sprendimai su įrodymais.",
      },
      { property: "og:title", content: "Laboratorija — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Ką GYMS.LIFE tiria, kaip keičiasi hipotezės ir kokius sprendimus priima.",
      },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 md:px-6 md:py-8">
      <LabView />
      <HypothesisRetrospective />
    </div>
  );
}
