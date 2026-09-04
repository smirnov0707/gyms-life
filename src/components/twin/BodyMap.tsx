import { useId } from "react";
import type { TwinRegionRecoveryBand, TwinRegionState } from "@/lib/digital-twin.schema";
import {
  BODY_FRAME,
  BODY_VIEW_BOX,
  isAnatomicalRegion,
  segmentsFor,
  type BodyView,
} from "./body-map.geometry";

/**
 * Band colours as literal stops so the gradients read identically in light
 * and dark themes. Emerald / amber / rose are the same three tones the
 * textual band chips use, so the figure and the list can't disagree.
 */
const BAND_GRADIENT: Record<TwinRegionRecoveryBand, { top: string; bottom: string }> = {
  fresh: { top: "#6ee7b7", bottom: "#059669" },
  moderate: { top: "#fcd34d", bottom: "#d97706" },
  fatigued: { top: "#fb7185", bottom: "#be123c" },
  unknown: { top: "#94a3b8", bottom: "#64748b" },
};

const BAND_STROKE: Record<TwinRegionRecoveryBand, string> = {
  fresh: "stroke-emerald-200/70",
  moderate: "stroke-amber-200/70",
  fatigued: "stroke-rose-200/70",
  unknown: "stroke-muted-foreground/35",
};

/** Regions with no evidence stay deliberately quiet: present, not claiming. */
const BAND_OPACITY: Record<TwinRegionRecoveryBand, number> = {
  fresh: 0.85,
  moderate: 0.85,
  fatigued: 0.9,
  unknown: 0.4,
};

export type BodyMapProps = {
  regions: TwinRegionState[];
  view: BodyView;
  selectedRegion: string | null;
  onSelectRegion: (region: string) => void;
  regionLabel: (region: string) => string;
  /** The framing ticks and ground plane only earn their place at full size. */
  showFraming?: boolean;
};

export function BodyMap({
  regions,
  view,
  selectedRegion,
  onSelectRegion,
  regionLabel,
  showFraming = false,
}: BodyMapProps) {
  // Two body maps can share a page (Today card and Twin page), so every
  // gradient and filter id has to be scoped to this instance.
  const uid = useId().replaceAll(":", "");
  const drawable = regions.filter(
    (region) => isAnatomicalRegion(region.region) && segmentsFor(region.region, view).length > 0,
  );
  const { minX, minY, width, height } = BODY_VIEW_BOX;

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label={view === "front" ? "Body map, front view" : "Body map, back view"}
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity="0.1" />
          <stop offset="55%" stopColor="var(--color-foreground)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity="0.05" />
        </linearGradient>
        {/* Lit from above-left, so the body reads as a volume, not a cut-out. */}
        <radialGradient id={`${uid}-sheen`} cx="42%" cy="31%" r="52%">
          <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-ground`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={BODY_FRAME.silhouette} />
        </clipPath>
        {(Object.keys(BAND_GRADIENT) as TwinRegionRecoveryBand[]).map((band) => (
          <linearGradient key={band} id={`${uid}-${band}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor={BAND_GRADIENT[band].top} />
            <stop offset="100%" stopColor={BAND_GRADIENT[band].bottom} />
          </linearGradient>
        ))}
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {showFraming ? (
        <g aria-hidden="true" className="pointer-events-none">
          {/* Measurement framing: a plumb line and three level marks. */}
          <line
            x1={100}
            y1={minY + 6}
            x2={100}
            y2={minY + height - 6}
            className="stroke-primary/10"
            strokeWidth={0.5}
            strokeDasharray="3 7"
          />
          {BODY_FRAME.levels.map((y) => (
            <g key={y} className="stroke-primary/20" strokeWidth={0.6}>
              <line x1={minX + 6} y1={y} x2={minX + 22} y2={y} />
              <line x1={minX + width - 22} y1={y} x2={minX + width - 6} y2={y} />
            </g>
          ))}
          <ellipse
            cx={100}
            cy={BODY_FRAME.groundY + 6}
            rx={70}
            ry={11}
            fill={`url(#${uid}-ground)`}
          />
        </g>
      ) : null}

      <path
        d={BODY_FRAME.silhouette}
        fill={`url(#${uid}-body)`}
        className="stroke-foreground/30"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {/* Clipped so the highlight can only ever fall on the body itself. */}
      <rect
        x={minX}
        y={minY}
        width={width}
        height={height}
        fill={`url(#${uid}-sheen)`}
        clipPath={`url(#${uid}-clip)`}
        aria-hidden="true"
      />
      {/* Collarbones from the front, spinal groove from the back. */}
      <path
        d={BODY_FRAME.contours[view]}
        fill="none"
        className="stroke-foreground/20"
        strokeWidth={0.8}
        strokeLinecap="round"
        aria-hidden="true"
      />

      {drawable.map((region) => {
        const isSelected = selectedRegion === region.region;
        return (
          <g
            key={region.region}
            role="button"
            tabIndex={0}
            aria-label={regionLabel(region.region)}
            aria-pressed={isSelected}
            className="cursor-pointer outline-none"
            onClick={() => onSelectRegion(region.region)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectRegion(region.region);
              }
            }}
          >
            {segmentsFor(region.region, view).map((segment, index) => (
              <path
                key={`${region.region}-${index}`}
                d={segment.d}
                fill={`url(#${uid}-${region.recoveryBand})`}
                fillOpacity={isSelected ? 1 : BAND_OPACITY[region.recoveryBand]}
                strokeWidth={isSelected ? 1.2 : 0.7}
                strokeLinejoin="round"
                filter={isSelected ? `url(#${uid}-glow)` : undefined}
                className={`${
                  isSelected ? "stroke-foreground/80" : BAND_STROKE[region.recoveryBand]
                } transition-[fill-opacity,stroke-width] duration-300 motion-reduce:transition-none`}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
