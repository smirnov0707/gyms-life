import { createFileRoute } from "@tanstack/react-router";
import { HypothesisRetrospective } from "@/components/HypothesisRetrospective";
import { LabView } from "@/components/LabView";
import { LabCommandDeck } from "@/components/future-lab/LabCommandDeck";

export const Route = createFileRoute("/_authenticated/lab")({
  head: () => ({
    meta: [
      { title: "Lab — GYMS.LIFE FUTURE LAB" },
      {
        name: "description",
        content: "Realios hipotezės, modelių kalibracija, sprendimai ir jų įrodymai.",
      },
      { property: "og:title", content: "Lab — GYMS.LIFE FUTURE LAB" },
      {
        property: "og:description",
        content: "Ką GYMS.LIFE tiria, kokių duomenų turi ir kaip tikrina savo prognozes.",
      },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  return (
    <div className="mx-auto max-w-[1480px] space-y-4">
      <LabCommandDeck />
      <LabView />
      <HypothesisRetrospective />
    </div>
  );
}
