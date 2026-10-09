export type ConsentPreferenceState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "ready"; enabled: boolean }
  | { status: "saving"; enabled: boolean; requested: boolean }
  | { status: "unavailable"; reason: "read" | "save" };

export type ConsentPreferenceServices = {
  read: () => Promise<unknown>;
  write: (granted: boolean) => Promise<unknown>;
  report: (reason: "read" | "save") => void;
};

function confirmedEnabled(result: unknown): boolean {
  if (
    typeof result !== "object" ||
    result === null ||
    !("enabled" in result) ||
    typeof result.enabled !== "boolean"
  ) {
    throw new Error("Invalid consent confirmation");
  }
  return result.enabled;
}

/** Per mounted account, never a shared cache. An unknown choice is not false. */
export function createConsentPreferenceSession(
  services: ConsentPreferenceServices,
  authenticated = true,
) {
  const initial: ConsentPreferenceState = authenticated
    ? { status: "loading" }
    : { status: "signed_out" };
  let state: ConsentPreferenceState = initial;
  let active = false;
  let pending = false;
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (next: ConsentPreferenceState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const current = (ticket: number) => active && ticket === generation;

  const load = async () => {
    if (!authenticated || !active || pending) return;
    const ticket = ++generation;
    pending = true;
    publish({ status: "loading" });
    try {
      const enabled = confirmedEnabled(await services.read());
      if (current(ticket)) publish({ status: "ready", enabled });
    } catch {
      if (current(ticket)) {
        publish({ status: "unavailable", reason: "read" });
        services.report("read");
      }
    } finally {
      if (current(ticket)) pending = false;
    }
  };

  const toggle = async () => {
    if (!authenticated || !active || pending || state.status !== "ready") return;
    const previous = state.enabled;
    const requested = !previous;
    const ticket = ++generation;
    pending = true;
    publish({ status: "saving", enabled: previous, requested });
    try {
      const enabled = confirmedEnabled(await services.write(requested));
      if (enabled !== requested) throw new Error("Consent confirmation did not match");
      if (current(ticket)) publish({ status: "ready", enabled });
    } catch {
      if (current(ticket)) {
        // The server may have committed before its reply was lost. Never replay
        // an immutable consent write or claim the previous preference is current.
        publish({ status: "unavailable", reason: "save" });
        services.report("save");
      }
    } finally {
      if (current(ticket)) pending = false;
    }
  };

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start() {
      if (active) return;
      active = true;
      await load();
    },
    stop() {
      active = false;
      generation++;
      pending = false;
    },
    load,
    toggle,
  };
}
