export type TwinCaptureQualityStatus =
  "unknown" | "stabilizing" | "too_dark" | "too_bright" | "moving_too_fast" | "ready";

export type TwinCaptureQuality = {
  status: TwinCaptureQualityStatus;
  canAdvanceRotation: boolean;
};

export function assessTwinCaptureQuality(input: {
  framingReady: boolean;
  stableReadyMs: number;
  luminance: number | null;
  motionDelta: number | null;
}): TwinCaptureQuality {
  if (!input.framingReady || input.luminance === null)
    return { status: "unknown", canAdvanceRotation: false };
  if (input.luminance < 0.16) return { status: "too_dark", canAdvanceRotation: false };
  if (input.luminance > 0.9) return { status: "too_bright", canAdvanceRotation: false };
  if ((input.motionDelta ?? 0) > 0.12)
    return { status: "moving_too_fast", canAdvanceRotation: false };
  if (input.stableReadyMs < 800) return { status: "stabilizing", canAdvanceRotation: false };
  return { status: "ready", canAdvanceRotation: true };
}

export function averageFrameLuminance(data: Uint8ClampedArray): number | null {
  if (data.length < 4) return null;
  let total = 0;
  let pixels = 0;
  for (let index = 0; index + 3 < data.length; index += 4) {
    total += (0.2126 * data[index]! + 0.7152 * data[index + 1]! + 0.0722 * data[index + 2]!) / 255;
    pixels += 1;
  }
  return pixels > 0 ? total / pixels : null;
}
