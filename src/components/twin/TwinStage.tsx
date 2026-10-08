import type { ReactNode } from "react";
import type { TwinSnapshot } from "@/lib/digital-twin.schema";
import type { BodyView } from "./body-map.geometry";
import { BodySceneStage } from "./BodySceneStage";
import { mapTwinScene, type TwinLayer } from "./twin-scene.model";
import { twinLayerCopy, formatTwinValue } from "./twin-layer.copy";
import { TwinLayerControls } from "./TwinLayerControls";
import type { TwinVisualAppearance } from "./twin-human.loader";
export type TwinStageProps = {
  snapshot: TwinSnapshot;
  layer: TwinLayer;
  onLayerChange: (layer: TwinLayer) => void;
  selectedRegion: string | null;
  onSelectRegion: (region: string) => void;
  view: BodyView;
  onViewChange: (view: BodyView) => void;
  regionLabel: (region: string) => string;
  language: "lt" | "en";
  /**
   * Today's session, grouped by region. Only the `todays_session` layer reads
   * it; null there means the programme could not be read, and the figure says
   * so rather than showing every region as untrained.
   */
  session?: { byRegion: Readonly<Record<string, readonly unknown[]>> } | null;
  /** Let the figure take the whole height its container offers. */
  fill?: boolean;
  presentation?: "full" | "cockpit" | "detail";
  sidePanel?: ReactNode;
  focusRegion?: string | null;
  showLayerControls?: boolean;
  compactMobileControls?: boolean;
  /** Visual treatment only; never changes Twin evidence or picking regions. */
  visualAppearance?: TwinVisualAppearance;
  /** Personalized visual Identity Shell, used only in realistic presentation. */
  identityModelUrl?: string | null;
  /** Optional mobile control rendered inside the shared view disclosure. */
  appearanceControls?: ReactNode;
  onIdentityShellFallback?: (reason: "load_failed" | "invalid_geometry" | "expired_url") => void;
};
/** Canonical Twin projection. Model provenance belongs to the shared renderer. */

export function TwinStage({
  snapshot,
  layer,
  onLayerChange,
  session = null,
  showLayerControls = true,
  ...props
}: TwinStageProps) {
  const copy = twinLayerCopy(props.language);
  return (
    <BodySceneStage
      {...props}
      bodyVariant={snapshot.bodyVariant}
      state={mapTwinScene(snapshot, layer, session)}
      unitLabel={copy.unit[layer]}
      formatValue={(value) => formatTwinValue(value, layer, props.language)}
      formatRegion={(region) =>
        layer === "recovery"
          ? copy.band[region.display.tone]
          : formatTwinValue(region.display.value, layer, props.language)
      }
      {...(layer === "logged_volume"
        ? { extraNote: copy.volumeNote }
        : layer === "todays_session"
          ? { extraNote: copy.sessionNote }
          : {})}
      layerControls={
        showLayerControls ? (
          <TwinLayerControls
            layer={layer}
            onLayerChange={onLayerChange}
            language={props.language}
            compact={props.presentation === "cockpit"}
          />
        ) : null
      }
    />
  );
}
