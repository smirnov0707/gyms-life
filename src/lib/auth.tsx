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

  // One place, rather than a user id appended to twenty query keys — because
  // the key that gets forgotten is the one that leaks. Every cached answer is
  // dropped the moment the signed-in person changes, so the next screen is
  // painted from a read taken as whoever is signed in now.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (loading) return;
    if (identityChanged(knownUserId.current, userId)) queryClient.clear();
    knownUserId.current = userId;
  }, [loading, userId, queryClient]);

  useEffect(() => {
    let sawEvent = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      sawEvent = true;
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      // Never let a stale getSession result overwrite a live auth event.
      if (!sawEvent) setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sessions written by another tab/window (or the OAuth popup) never fire an
  // auth event here — pick them up when the tab becomes visible again.
  useEffect(() => {
    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      setSession((prev) =>
        prev?.access_token === data.session?.access_token ? prev : data.session,
      );
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setLoading(false);
    return Boolean(data.session);
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, loading, refresh }),
    [session, loading, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
