import type { ReactNode } from "react";
import type { TwinSnapshot } from "@/lib/digital-twin.schema";
import type { BodyView } from "./body-map.geometry";
import { BodySceneStage } from "./BodySceneStage";
import { TWIN_LAYERS, mapTwinScene, type TwinLayer } from "./twin-scene.model";
import { twinLayerCopy, formatTwinValue } from "./twin-layer.copy";
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
          <div
            data-twin-layer-controls
            role="group"
            aria-label={copy.selector}
            // One column per layer, so a third option does not wrap on to a row of
            // its own and leave the selector twice as tall as it needs to be.
            className="mx-3 mb-2 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1"
          >
            {TWIN_LAYERS.map((option) => (
              <button
                key={option}
                type="button"
                style={{
                  minWidth: props.presentation === "cockpit" ? 30 : 44,
                  minHeight: props.presentation === "cockpit" ? 30 : 44,
                  flexShrink: 0,
                }}
                aria-pressed={layer === option}
                onClick={() => onLayerChange(option)}
                // Balanced across two lines rather than broken mid-word: at
                // 320px "Atsistatymas" and "Registruotas tūris" split into
                // "Atsistatym / as" and "Registruot / as tūris".
                className={`min-h-11 min-w-11 text-balance rounded-xl px-2 py-1 text-[11px] font-medium leading-tight text-neutral-200 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 sm:px-3 sm:text-xs ${layer === option ? "bg-white/10 text-white" : ""}`}
              >
                {copy.label[option]}
              </button>
            ))}
          </div>
        ) : null
      }
    />
  );
}
