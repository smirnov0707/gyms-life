import type { TwinRegionRecoveryBand, TwinRegionState } from "@/lib/digital-twin.schema";
import {
  BODY_FRAME,
  BODY_VIEW_BOX,
  isAnatomicalRegion,
  segmentsFor,
  type BodyView,
} from "./body-map.geometry";

const BAND_FILL: Record<TwinRegionRecoveryBand, string> = {
  fresh: "fill-emerald-400/55",
  moderate: "fill-amber-400/55",
  fatigued: "fill-rose-500/55",
  unknown: "fill-muted-foreground/25",
};

const BAND_STROKE: Record<TwinRegionRecoveryBand, string> = {
  fresh: "stroke-emerald-300/50",
  moderate: "stroke-amber-300/50",
  fatigued: "stroke-rose-400/50",
  unknown: "stroke-muted-foreground/40",
};

export type BodyMapProps = {
  regions: TwinRegionState[];
  view: BodyView;
  selectedRegion: string | null;
  onSelectRegion: (region: string) => void;
  regionLabel: (region: string) => string;
};

export function BodyMap({
  regions,
  view,
  selectedRegion,
  onSelectRegion,
  regionLabel,
}: BodyMapProps) {
  const drawable = regions.filter(
    (region) => isAnatomicalRegion(region.region) && segmentsFor(region.region, view).length > 0,
  );

  return (
    <svg
      viewBox={`0 0 ${BODY_VIEW_BOX.width} ${BODY_VIEW_BOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={view === "front" ? "Body map, front view" : "Body map, back view"}
    >
      <circle
        cx={BODY_FRAME.head.cx}
        cy={BODY_FRAME.head.cy}
        r={BODY_FRAME.head.r}
        className="fill-muted-foreground/10 stroke-muted-foreground/20"
        strokeWidth={0.6}
      />
      <rect
        x={BODY_FRAME.neck.x}
        y={BODY_FRAME.neck.y}
        width={BODY_FRAME.neck.w}
        height={BODY_FRAME.neck.h}
        rx={BODY_FRAME.neck.rx}
        className="fill-muted-foreground/10 stroke-muted-foreground/20"
        strokeWidth={0.6}
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
              <rect
                key={`${region.region}-${index}`}
                x={segment.x}
                y={segment.y}
                width={segment.w}
                height={segment.h}
                rx={segment.rx}
                strokeWidth={isSelected ? 1.6 : 0.6}
                className={`${BAND_FILL[region.recoveryBand]} ${
                  isSelected ? "stroke-foreground" : BAND_STROKE[region.recoveryBand]
                } transition-[fill,stroke] duration-300 motion-reduce:transition-none`}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
