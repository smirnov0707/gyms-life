import { createFileRoute } from "@tanstack/react-router";
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
    <div className="fl-lab-route fl-world-page fl-page-enter mx-auto max-w-[1480px] space-y-3">
      <LabCommandDeck />
      <details className="fl-secondary-details fl-luxury-disclosure">
        <summary>Night Lab</summary>
        <div className="fl-disclosed-content">
          <NightLabPanel />
        </div>
      </details>
      <details className="fl-secondary-details fl-luxury-disclosure">
        <summary>
          {english ? "How the Lab works" : "Kaip veikia Lab"}
        </summary>
        <div className="fl-disclosed-content">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {english
              ? "Investigations, experiments and calibration now live in one Lab surface. Detail opens only when it changes a decision or helps you inspect the evidence."
              : "Tyrimai, eksperimentai ir kalibracija dabar gyvena viename Lab vaizde. Detalės išskleidžiamos tik tada, kai jos keičia sprendimą arba padeda patikrinti įrodymus."}
          </p>
        </div>
      </details>
    </div>
  );
}
