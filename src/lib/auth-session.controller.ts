import type { Session } from "@supabase/supabase-js";
/** Async session reads cannot resurrect an identity after sign-out or a newer read. */
export function createAuthSessionController(callbacks: {
  read: () => Promise<{ data: { session: Session | null }; error: unknown }>;
  apply: (session: Session | null) => void;
  failed: () => void;
}) {
  let revision = 0,
    disposed = false;
  return {
    event(session: Session | null) {
      if (disposed) return;
      revision++;
      callbacks.apply(session);
    },
    async refresh(): Promise<boolean> {
      if (disposed) return false;
      const own = ++revision;
      try {
        const result = await callbacks.read();
        if (disposed || own !== revision) return false;
        if (result.error) {
          callbacks.failed();
          return false;
        }
        callbacks.apply(result.data.session);
        return !!result.data.session;
      } catch {
        if (!disposed && own === revision) callbacks.failed();
        return false;
      }
    },
    dispose() {
      disposed = true;
      revision++;
    },
  };
}
