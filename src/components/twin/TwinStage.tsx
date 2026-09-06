import type { TwinSnapshot } from "@/lib/digital-twin.schema";
import type { BodyView } from "./body-map.geometry";
import { BodySceneStage } from "./BodySceneStage";
import { TWIN_LAYERS, mapTwinScene, type TwinLayer } from "./twin-scene.model";
import { twinLayerCopy, formatTwinValue } from "./twin-layer.copy";
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
};
/** Canonical Twin projection. Session replay never needs to manufacture a TwinSnapshot. */
export function TwinStage({ snapshot, layer, onLayerChange, ...props }: TwinStageProps) {
  const copy = twinLayerCopy(props.language);
  return (
    <BodySceneStage
      {...props}
      bodyVariant={snapshot.bodyVariant}
      state={mapTwinScene(snapshot, layer)}
      unitLabel={copy.unit[layer]}
      formatValue={(value) => formatTwinValue(value, layer, props.language)}
      formatRegion={(region) =>
        layer === "recovery"
          ? copy.band[region.display.tone]
          : formatTwinValue(region.display.value, layer, props.language)
      }
      {...(layer === "logged_volume" ? { extraNote: copy.volumeNote } : {})}
      layerControls={
        <div
          role="group"
          aria-label={copy.selector}
          className="mx-3 mb-2 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1"
        >
          {TWIN_LAYERS.map((option) => (
            <button
              key={option}
              type="button"
              style={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
              aria-pressed={layer === option}
              onClick={() => onLayerChange(option)}
              className={`min-h-11 min-w-11 rounded-xl px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 ${layer === option ? "bg-white/10 text-white" : ""}`}
            >
              {copy.label[option]}
            </button>
          ))}
        </div>
      }
    />
  );
}
