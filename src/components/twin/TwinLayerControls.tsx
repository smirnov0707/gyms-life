import { TWIN_LAYERS, type TwinLayer } from "./twin-scene.model";
import { twinLayerCopy } from "./twin-layer.copy";

const SHORT_LABELS: Record<"lt" | "en", Record<TwinLayer, string>> = {
  lt: { recovery: "Atsistatymas", logged_volume: "Tūris", todays_session: "Šiandien" },
  en: { recovery: "Recovery", logged_volume: "Volume", todays_session: "Today" },
};

/** Same layers and full accessible names; only the visible control labels are shorter. */
export function TwinLayerControls({
  layer,
  onLayerChange,
  language,
  compact = false,
}: {
  layer: TwinLayer;
  onLayerChange: (layer: TwinLayer) => void;
  language: "lt" | "en";
  compact?: boolean;
}) {
  const copy = twinLayerCopy(language);
  return (
    <div
      data-twin-layer-controls
      role="group"
      aria-label={copy.selector}
      className="mx-3 mb-2 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1"
      // Intrinsic widths protect the longest word. At enlarged text sizes the
      // controls wrap as whole controls, never as clipped fragments of a word.
      style={{ display: "flex", flexWrap: "wrap" }}
    >
      {TWIN_LAYERS.map((option) => (
        <button
          key={option}
          type="button"
          data-twin-layer-option={option}
          aria-label={copy.label[option]}
          title={copy.label[option]}
          aria-pressed={layer === option}
          onClick={() => onLayerChange(option)}
          style={{
            flex: "1 0 auto",
            minWidth: "max-content",
            minHeight: compact ? 30 : 44,
            whiteSpace: "nowrap",
            overflowWrap: "normal",
            wordBreak: "normal",
            hyphens: "none",
          }}
          className={`rounded-xl px-2 py-1 text-[11px] font-medium leading-tight text-neutral-200 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 sm:px-3 sm:text-xs ${layer === option ? "bg-white/10 text-white" : ""}`}
        >
          <span data-twin-layer-label>{SHORT_LABELS[language][option]}</span>
        </button>
      ))}
    </div>
  );
}
