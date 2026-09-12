import { observationFromPoseLandmarks } from "./personalized-twin.pose-framing";
import type { TwinFramingObservation } from "./personalized-twin.framing";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export type LocalTwinPoseDetector = {
  detect(video: HTMLVideoElement, timestampMs: number): TwinFramingObservation | null;
  close(): void;
};

export async function createLocalTwinPoseDetector(): Promise<LocalTwinPoseDetector> {
  const vision = await import("@mediapipe/tasks-vision");
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);

  const create = (delegate: "GPU" | "CPU") =>
    vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    });

  let landmarker;
  try {
    landmarker = await create("GPU");
  } catch {
    landmarker = await create("CPU");
  }
  return {
    detect(video, timestampMs) {
      const result = landmarker.detectForVideo(video, timestampMs);
      return observationFromPoseLandmarks(result.landmarks?.[0]);
    },
    close() {
      landmarker.close();
    },
  };
}
