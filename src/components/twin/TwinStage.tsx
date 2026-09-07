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
  /**
   * Today's session, grouped by region. Only the `todays_session` layer reads
   * it; null there means the programme could not be read, and the figure says
   * so rather than showing every region as untrained.
   */
  session?: { byRegion: Readonly<Record<string, readonly unknown[]>> } | null;
};
/** Canonical Twin projection. Session replay never needs to manufacture a TwinSnapshot. */
/**
 * The credit the figure's licence requires, verbatim.
 *
 * The anatomy is BodyParts3D under CC BY-SA, which asks for this exact
 * sentence wherever the data is used — so it is not translated, and it is on
 * the screen rather than only in the manifest beside the file, which is where
 * the previous figure's credit sat unseen.
 */
const ANATOMY_CREDIT =
  "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan";

export function TwinStage({
  snapshot,
  layer,
  onLayerChange,
  session = null,
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
        <div
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
              style={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
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
      }
      credit={ANATOMY_CREDIT}
    />
  );
}
