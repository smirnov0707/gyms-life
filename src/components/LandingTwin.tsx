import { useState } from "react";
import { BodySceneStage } from "./twin/BodySceneStage";
import { TWIN_BODY_REGIONS, type TwinSceneState } from "./twin/twin-scene.model";
import type { BodyView } from "./twin/body-map.geometry";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";

// An anatomy demonstration: no fabricated session, recovery score or personal measurement.
const anatomy: TwinSceneState = {
  layer: "recovery",
  dataAvailable: false,
  regions: TWIN_BODY_REGIONS.map((id) => ({
    id,
    band: "unknown",
    recoveryPct: null,
    emphasis: 0,
    display: { value: null, tone: "unknown" },
  })),
};

export default function LandingTwin() {
  const { lang, t } = useI18n();
  const language = baseLang(lang);
  const [selected, setSelected] = useState<string>("chest");
  const [view, setView] = useState<BodyView>("front");
  const label = (region: string) => t(`mg.${region}` as TKey);
  return (
    <div className="fl-landing-twin">
      <BodySceneStage
        state={anatomy}
        selectedRegion={selected}
        onSelectRegion={setSelected}
        view={view}
        onViewChange={setView}
        regionLabel={label}
        language={language}
        layerControls={null}
        unitLabel={language === "lt" ? "Anatomijos peržiūra" : "Anatomy preview"}
        formatValue={() => "—"}
        formatRegion={() => "—"}
        visualAppearance="analysis"
        presentation="detail"
        compactMobileControls
      />
      <p className="fl-landing-region" aria-live="polite">
        <strong>{label(selected)}</strong>
        <span>
          {language === "lt"
            ? "Pasirinktas regionas · asmeninių duomenų nėra"
            : "Selected region · no personal data"}
        </span>
      </p>
    </div>
  );
}
