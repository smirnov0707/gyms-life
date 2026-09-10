import { offlineIdentity } from "./offline-identity";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { createAuthSessionController } from "./auth-session.controller";
import { identityChanged } from "./auth-cache";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Re-reads the stored session; resolves to true when a session exists. */
  refresh: () => Promise<boolean>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  refresh: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const knownUserId = useRef<string | null | undefined>(undefined);
  const controller = useRef<ReturnType<typeof createAuthSessionController> | null>(null);

  useEffect(() => {
    const current = createAuthSessionController({
      read: () => supabase.auth.getSession(),
      apply: (next) => {
        const nextId = next?.user.id ?? null;
        offlineIdentity.set(nextId);
        // Clear identity-scoped cached views before publishing the new identity.
        if (identityChanged(knownUserId.current, nextId)) queryClient.clear();
        knownUserId.current = nextId;
        setSession(next);
        setLoading(false);
      },
      // A temporary network/storage error must not invent a sign-out.
      failed: () => setLoading(false),
    });
    controller.current = current;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => current.event(next));
    void current.refresh();
    const sync = () => {
      if (document.visibilityState !== "hidden") void current.refresh();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      current.dispose();
      offlineIdentity.set(null);
      sub.subscription.unsubscribe();
      if (controller.current === current) controller.current = null;
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [queryClient]);
  const refresh = useCallback(() => controller.current?.refresh() ?? Promise.resolve(false), []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, loading, refresh }),
    [session, loading, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
