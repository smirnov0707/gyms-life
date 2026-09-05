import { useId } from "react";
import type { TwinRegionRecoveryBand } from "@/lib/digital-twin.schema";
import {
  BODY_ANATOMY,
  BODY_FRAME,
  BODY_VIEW_BOX,
  REGION_ANCHOR,
  isAnatomicalRegion,
  segmentsFor,
  type BodyView,
} from "./body-map.geometry";

/**
 * How loudly a region reads, as display tone rather than as a meaning.
 *
 * The figure draws bodies for more than one question — how recovered a group
 * is, and how much of a session landed on it — and those answer differently.
 * Each caller maps its own vocabulary onto this scale and labels its own
 * legend, so the colour always carries the meaning that screen defines.
 * `hot` is always "most worth your attention".
 */
export type BodyMapTone =
  "cool" | "warm" | "hot" | "muted" | "volume_low" | "volume_medium" | "volume_high";

export type BodyMapRegion = {
  region: string;
  tone: BodyMapTone;
  /** What the callout shows for this region, already formatted by the caller
   *  — a recovery percentage on the Twin, a session's volume on the replay. */
  value?: string | null;
};

/** Colours as literal stops so the gradients read the same in both themes. */
const TONE_GRADIENT: Record<BodyMapTone, { top: string; bottom: string }> = {
  cool: { top: "#6ee7b7", bottom: "#059669" },
  warm: { top: "#fcd34d", bottom: "#d97706" },
  hot: { top: "#fb7185", bottom: "#be123c" },
  muted: { top: "#94a3b8", bottom: "#64748b" },
  volume_low: { top: "#6585a0", bottom: "#49657c" },
  volume_medium: { top: "#88bfdf", bottom: "#659fc3" },
  volume_high: { top: "#c9e9f8", bottom: "#9bd4ee" },
};

/** Recovery's own vocabulary, mapped onto the display scale. */
export function toneForRecoveryBand(band: TwinRegionRecoveryBand): BodyMapTone {
  if (band === "fresh") return "cool";
  if (band === "moderate") return "warm";
  if (band === "fatigued") return "hot";
  return "muted";
}

const TONE_STROKE: Record<BodyMapTone, string> = {
  cool: "stroke-emerald-200/70",
  warm: "stroke-amber-200/70",
  hot: "stroke-rose-200/70",
  muted: "stroke-muted-foreground/35",
  volume_low: "stroke-sky-200/40",
  volume_medium: "stroke-sky-200/60",
  volume_high: "stroke-sky-100/80",
};

/** Regions with nothing behind them stay quiet: present, not claiming. */
const TONE_OPACITY: Record<BodyMapTone, number> = {
  cool: 0.92,
  warm: 0.92,
  hot: 0.94,
  muted: 0.3,
  volume_low: 0.85,
  volume_medium: 0.9,
  volume_high: 0.94,
};

export type BodyMapProps = {
  regions: BodyMapRegion[];
  view: BodyView;
  selectedRegion: string | null;
  onSelectRegion: (region: string) => void;
  regionLabel: (region: string) => string;
  /** The stage, framing ticks and leader line only earn their place at size. */
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
  const drawable = regions
    .filter(
      (region) => isAnatomicalRegion(region.region) && segmentsFor(region.region, view).length > 0,
    )
    // One `d` per region: overlapping bellies then union under a single fill
    // instead of stacking opacity, and the stroke traces every seam.
    .map((region) => ({
      ...region,
      d: segmentsFor(region.region, view)
        .map((segment) => segment.d)
        .join(" "),
    }));

  const { minX, minY, width, height } = BODY_VIEW_BOX;
  const muscleOutlines = [...drawable.map((region) => region.d), ...BODY_ANATOMY[view]].join(" ");
  const anchor = selectedRegion ? REGION_ANCHOR[selectedRegion]?.[view] : undefined;
  const selected = drawable.find((region) => region.region === selectedRegion);
  const calloutX = minX + width - 4;
  const calloutY = anchor ? anchor.y - 16 : 0;

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
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
          <stop offset="55%" stopColor="var(--color-primary)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-halo`} cx="50%" cy="42%" r="52%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={BODY_FRAME.silhouette} />
        </clipPath>
        <clipPath id={`${uid}-muscles`}>
          <path d={muscleOutlines} />
        </clipPath>
        {(Object.keys(TONE_GRADIENT) as BodyMapTone[]).map((band) => (
          <linearGradient key={band} id={`${uid}-${band}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor={TONE_GRADIENT[band].top} />
            <stop offset="100%" stopColor={TONE_GRADIENT[band].bottom} />
          </linearGradient>
        ))}
        {/* Real relief, not a painted approximation of it: blurring a shape's
            own alpha gives a height map, and lighting that map rounds the
            form the way its own outline says it should be rounded. One light
            direction for the whole figure, so the body reads as lit rather
            than as a set of separately shaded stickers. */}
        {[
          { id: "relief", blur: 3.2, scale: 2.1, specular: 0.16 },
          { id: "relief-body", blur: 6, scale: 2.6, specular: 0.1 },
        ].map((preset) => (
          <filter
            key={preset.id}
            id={`${uid}-${preset.id}`}
            x="-15%"
            y="-15%"
            width="130%"
            height="130%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation={preset.blur} result="bump" />
            <feDiffuseLighting
              in="bump"
              surfaceScale={preset.scale}
              diffuseConstant={1.12}
              lightingColor="#ffffff"
              result="diffuse"
            >
              <feDistantLight azimuth={230} elevation={52} />
            </feDiffuseLighting>
            <feComposite in="diffuse" in2="SourceAlpha" operator="in" result="shade" />
            <feBlend in="SourceGraphic" in2="shade" mode="multiply" result="lit" />
            <feSpecularLighting
              in="bump"
              surfaceScale={preset.scale}
              specularConstant={preset.specular}
              specularExponent={9}
              lightingColor="#ffffff"
              result="spec"
            >
              <feDistantLight azimuth={230} elevation={58} />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="sheen" />
            <feComposite in="sheen" in2="lit" operator="arithmetic" k1={0} k2={1} k3={1} k4={0} />
          </filter>
        ))}
        <filter id={`${uid}-soft`} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
        <filter id={`${uid}-bloom`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {showFraming ? (
        <g aria-hidden="true" className="pointer-events-none">
          <ellipse cx={100} cy={200} rx={112} ry={200} fill={`url(#${uid}-halo)`} />
          {/* Measurement framing: a plumb line and three level marks. */}
          <line
            x1={100}
            y1={minY + 6}
            x2={100}
            y2={BODY_FRAME.groundY}
            className="stroke-primary/10"
            strokeWidth={0.5}
            strokeDasharray="3 7"
          />
          {BODY_FRAME.levels.map((y) => (
            <g key={y} className="stroke-primary/20" strokeWidth={0.6}>
              <line x1={minX + 4} y1={y} x2={minX + 20} y2={y} />
              <line x1={minX + width - 20} y1={y} x2={minX + width - 4} y2={y} />
            </g>
          ))}
          {/* The stage the figure stands on. */}
          <ellipse
            cx={100}
            cy={BODY_FRAME.groundY + 4}
            rx={76}
            ry={13}
            fill={`url(#${uid}-ground)`}
          />
          {[74, 56, 38].map((rx, index) => (
            <ellipse
              key={rx}
              cx={100}
              cy={BODY_FRAME.groundY + 4}
              rx={rx}
              ry={rx / 5.8}
              fill="none"
              className="stroke-primary"
              strokeOpacity={0.14 + index * 0.07}
              strokeWidth={0.7}
            />
          ))}
        </g>
      ) : null}

      <path
        d={BODY_FRAME.silhouette}
        fill={`url(#${uid}-body)`}
        className="stroke-foreground/30"
        strokeWidth={1.1}
        strokeLinejoin="round"
        filter={`url(#${uid}-relief-body)`}
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

      {/* Nothing drawn on the body may leave it: a muscle that spilled past
          the outline would be claiming load somewhere there is no body. */}
      <g clipPath={`url(#${uid}-clip)`}>
        {/* Structure that belongs to no training group: anatomy, not a signal. */}
        {BODY_ANATOMY[view].map((d) => (
          <path
            key={d}
            d={d}
            className="fill-foreground/[0.07] stroke-foreground/15"
            strokeWidth={0.6}
            strokeLinejoin="round"
            aria-hidden="true"
          />
        ))}

        {drawable.map((region) => {
          const isSelected = selectedRegion === region.region;
          const hasEvidence = region.tone !== "muted";
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
              {/* A group carrying evidence blooms; structure never does. */}
              {hasEvidence ? (
                <path
                  d={region.d}
                  fill={TONE_GRADIENT[region.tone].top}
                  fillOpacity={isSelected ? 0.3 : 0.14}
                  filter={`url(#${uid}-bloom)`}
                  aria-hidden="true"
                />
              ) : null}
              {/* Opacity rides the group, so the relief filter still sees an
                  opaque shape to derive its height map from. */}
              <g
                opacity={isSelected ? 1 : TONE_OPACITY[region.tone]}
                className="transition-opacity duration-300 motion-reduce:transition-none"
              >
                <path
                  d={region.d}
                  fill={`url(#${uid}-${region.tone})`}
                  strokeWidth={isSelected ? 1.2 : 0.7}
                  strokeLinejoin="round"
                  filter={`url(#${uid}-relief)`}
                  className={isSelected ? "stroke-foreground/55" : TONE_STROKE[region.tone]}
                />
              </g>
            </g>
          );
        })}
      </g>

      {/* Then the body as a whole, over everything it is made of. */}
      <g clipPath={`url(#${uid}-clip)`} aria-hidden="true" className="pointer-events-none">
        <path
          d={BODY_FRAME.silhouette}
          fill="none"
          stroke="#000"
          strokeOpacity={0.42}
          strokeWidth={9}
          filter={`url(#${uid}-soft)`}
        />
        {/* Light from above-left: the same stroke, nudged out of the way. */}
        <path
          d={BODY_FRAME.silhouette}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.16}
          strokeWidth={3.2}
          filter={`url(#${uid}-soft)`}
          transform="translate(2.6 2.6)"
        />
      </g>

      {/* Jawline, clavicles, serratus, patella… anatomy that claims nothing. */}
      <path
        d={BODY_FRAME.contours[view]}
        fill="none"
        className="stroke-foreground/25"
        strokeWidth={0.7}
        strokeLinecap="round"
        aria-hidden="true"
      />

      {/* A callout naming the selection on the figure itself, so the picture
          is readable without reading the panel beside it. */}
      {showFraming && anchor && selected ? (
        <g aria-hidden="true" className="pointer-events-none">
          <circle cx={anchor.x} cy={anchor.y} r={2.2} className="fill-foreground/85" />
          <circle
            cx={anchor.x}
            cy={anchor.y}
            r={5.5}
            fill="none"
            className="stroke-foreground/40"
            strokeWidth={0.7}
          />
          <path
            d={`M${anchor.x + 5.5} ${anchor.y}L${calloutX - 44} ${calloutY + 3}H${calloutX}`}
            fill="none"
            className="stroke-foreground/40"
            strokeWidth={0.7}
          />
          <text
            x={calloutX}
            y={calloutY}
            textAnchor="end"
            className="fill-foreground"
            fontSize={7.5}
            fontWeight={700}
          >
            {regionLabel(selected.region).toUpperCase()}
          </text>
          {selected.value ? (
            <text
              x={calloutX}
              y={calloutY + 10.5}
              textAnchor="end"
              fill={TONE_GRADIENT[selected.tone].top}
              fontSize={7}
              fontWeight={700}
            >
              {selected.value}
            </text>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
}
