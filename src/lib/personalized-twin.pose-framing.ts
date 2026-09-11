import type { TwinFramingObservation } from "./personalized-twin.framing";

export type TwinPoseLandmark = {
  x: number;
  y: number;
  visibility?: number;
};

const REQUIRED_FULL_BODY_POINTS = [0, 11, 12, 23, 24, 27, 28] as const;

function visible(point: TwinPoseLandmark | undefined): point is TwinPoseLandmark {
  return Boolean(
    point && Number.isFinite(point.x) && Number.isFinite(point.y) && (point.visibility ?? 1) >= 0.5,
  );
}

export function observationFromPoseLandmarks(
  landmarks: readonly TwinPoseLandmark[] | undefined,
): TwinFramingObservation | null {
  if (!landmarks?.length) return null;
  const fullBodyVisible = REQUIRED_FULL_BODY_POINTS.every((index) => visible(landmarks[index]));
  const points = landmarks.filter(visible);
  if (points.length < 7) return null;

  const minX = Math.max(0, Math.min(...points.map((point) => point.x)));
  const maxX = Math.min(1, Math.max(...points.map((point) => point.x)));
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)));
  const maxY = Math.min(1, Math.max(...points.map((point) => point.y)));
  const bodyWidth = Math.max(0.001, maxX - minX);
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const shoulderSpanRatio =
    visible(leftShoulder) && visible(rightShoulder)
      ? Math.abs(leftShoulder.x - rightShoulder.x) / bodyWidth
      : null;
  return {
    bodyHeightRatio: Math.max(0, maxY - minY),
    topMarginRatio: minY,
    bottomMarginRatio: Math.max(0, 1 - maxY),
    fullBodyVisible,
    shoulderSpanRatio,
  };
}
