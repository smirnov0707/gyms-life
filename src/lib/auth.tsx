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
  /**
   * Ends the session on this device.
   *
   * There was no way out. Nothing in the app called `supabase.auth.signOut`,
   * and this context never exposed it, so a signed-in athlete could only leave
   * by clearing site data — on a shared phone, a borrowed laptop or a gym
   * tablet, that is the difference between a session and a handover.
   *
   * Resolves to true when the session is gone. It fails closed in the sense
   * that matters here: a refused network call still clears the local session,
   * because the person asked to be signed out of this device.
   */
  signOut: () => Promise<boolean>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  refresh: async () => false,
  signOut: async () => false,
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

  const signOut = useCallback(async () => {
    try {
      // `local` scope: this device, not every device the person is signed in
      // on. Ending other sessions is a different request and should be asked
      // for separately.
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // A refused call must not leave somebody signed in on a device they
      // asked to be signed out of. The local session is cleared either way.
    }
    setSession(null);
    offlineIdentity.set(null);
    // The cache is keyed per owner; leaving it would show the next person who
    // signs in on this device the previous athlete's answers until each query
    // refetched.
    queryClient.clear();
    return true;
  }, [queryClient]);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, loading, refresh, signOut }),
    [session, loading, refresh, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
