import type { TwinBodyProvenance } from "./twin-body.provenance";

export const TWIN_SCENE_LOAD_TIMEOUT_MS = 15_000;

type DisposableScene = { dispose: () => void };
type AttemptPhase = "loading" | "ready" | "failed" | "disposed";

/** Own the complete mount attempt, not just its dynamic import. */
export function createTwinSceneAttempt<Scene extends DisposableScene>(callbacks: {
  onReady: (provenance: TwinBodyProvenance | null) => void;
  onFailure: (reason: "timeout" | "error") => void;
  onRelease: (scene: Scene) => void;
}) {
  let phase: AttemptPhase = "loading";
  let owned: Scene | null = null;
  const active = () => phase === "loading" || phase === "ready";
  const release = () => {
    const handle = owned;
    owned = null;
    if (handle) {
      callbacks.onRelease(handle);
      handle.dispose();
    }
  };
  const failWith = (reason: "timeout" | "error") => {
    if (!active()) return;
    phase = "failed";
    clearTimeout(deadline);
    release();
    callbacks.onFailure(reason);
  };
  // A renderer with no body is still loading. Only body readiness clears this.
  const deadline = setTimeout(() => failWith("timeout"), TWIN_SCENE_LOAD_TIMEOUT_MS);
  return {
    active,
    attach(handle: Scene) {
      if (!active()) {
        handle.dispose();
        return false;
      }
      owned = handle;
      return true;
    },
    ready(provenance: TwinBodyProvenance | null) {
      if (!active()) return;
      phase = "ready";
      clearTimeout(deadline);
      // A verified body can replace an explicit fallback while still active.
      callbacks.onReady(provenance);
    },
    fail: () => failWith("error"),
    dispose() {
      if (phase === "disposed") return;
      phase = "disposed";
      clearTimeout(deadline);
      release();
    },
  };
}
