import { z } from "zod";

export const TwinFramingStatusSchema = z.enum([
  "unknown",
  "too_close",
  "too_far",
  "cropped",
  "ready",
]);
export type TwinFramingStatus = z.infer<typeof TwinFramingStatusSchema>;

export type TwinFramingObservation = {
  bodyHeightRatio: number;
  topMarginRatio: number;
  bottomMarginRatio: number;
  fullBodyVisible: boolean;
  shoulderSpanRatio?: number | null;
};

export type TwinFramingAssessment = {
  status: TwinFramingStatus;
  automatic: boolean;
  bodyHeightRatio: number | null;
};
export function assessTwinFraming(
  observation: TwinFramingObservation | null,
): TwinFramingAssessment {
  if (!observation) {
    return { status: "unknown", automatic: false, bodyHeightRatio: null };
  }

  const { bodyHeightRatio, topMarginRatio, bottomMarginRatio, fullBodyVisible } = observation;
  if (![bodyHeightRatio, topMarginRatio, bottomMarginRatio].every(Number.isFinite)) {
    return { status: "unknown", automatic: false, bodyHeightRatio: null };
  }
  if (!fullBodyVisible || topMarginRatio < 0.02 || bottomMarginRatio < 0.02) {
    return { status: "cropped", automatic: true, bodyHeightRatio };
  }
  if (bodyHeightRatio > 0.9) {
    return { status: "too_close", automatic: true, bodyHeightRatio };
  }
  if (bodyHeightRatio < 0.55) {
    return { status: "too_far", automatic: true, bodyHeightRatio };
  }
  return { status: "ready", automatic: true, bodyHeightRatio };
}
