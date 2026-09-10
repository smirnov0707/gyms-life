import { createFileRoute } from "@tanstack/react-router";
import { HypothesisRetrospective } from "@/components/HypothesisRetrospective";
import { LabView } from "@/components/LabView";
import { LabCommandDeck } from "@/components/future-lab/LabCommandDeck";
import { NightLabPanel } from "@/components/future-lab/NightLabPanel";
import { baseLang, useI18n } from "@/lib/i18n";

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
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  return (
    <div className="fl-lab-route mx-auto max-w-[1480px] space-y-3">
      <LabCommandDeck />
      <details className="fl-secondary-details">
        <summary>Night Lab</summary>
        <div className="fl-disclosed-content">
          <NightLabPanel />
        </div>
      </details>
      <details className="fl-secondary-details">
        <summary>
          {english
            ? "Evidence, decisions & learning history"
            : "Įrodymai, sprendimai ir mokymosi istorija"}
        </summary>
        <div className="fl-disclosed-content space-y-3">
          <LabView />
          <HypothesisRetrospective />
        </div>
      </details>
    </div>
  );
}
