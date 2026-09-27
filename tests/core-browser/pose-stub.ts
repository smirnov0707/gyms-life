// No network, camera imagery or model inference. Lifecycle boundary only.
declare global {
  interface Window {
    __pose: { creating: number; created: number; closed: number; hold: boolean; fail: boolean };
  }
}
window.__pose ??= { creating: 0, created: 0, closed: 0, hold: false, fail: false };
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const PoseLandmarker = {
  createFromOptions: async () => {
    window.__pose.creating++;
    while (window.__pose.hold) await new Promise((resolve) => setTimeout(resolve, 30));
    if (window.__pose.fail) throw new Error("Synthetic model unavailable");
    window.__pose.created++;
    return {
      detectForVideo: () => ({ landmarks: [] }),
      close: () => {
        window.__pose.closed++;
      },
    };
  },
};
