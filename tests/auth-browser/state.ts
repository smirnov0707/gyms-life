import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
export const params = new URLSearchParams(location.search);
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "synthetic@example.invalid",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-09-01T00:00:00Z",
};
const signed: Session = {
  access_token: "synthetic-only",
  refresh_token: "synthetic-only",
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>();
export const state: {
  session: Session | null;
  counts: Record<string, number>;
  last: Record<string, unknown>;
  navigations: string[];
} = {
  session: params.get("session") === "yes" ? signed : null,
  counts: {},
  last: {},
  navigations: [],
};
const count = (name: string) => (state.counts[name] = (state.counts[name] ?? 0) + 1);
const wait = () => new Promise((r) => setTimeout(r, 200));
const publish = (event: AuthChangeEvent, session: Session | null) => {
  state.session = session;
  listeners.forEach((listener) => listener(event, session));
};
export const supabase = {
  auth: {
    onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
      listeners.add(callback);
      queueMicrotask(() => {
        if (listeners.has(callback)) callback("INITIAL_SESSION", state.session);
      });
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    getSession: async () => ({ data: { session: state.session }, error: null }),
    signInWithPassword: async (data: unknown) => {
      count("signIn");
      state.last["signIn"] = data;
      await wait();
      if (params.get("fail") === "signIn")
        return { data: { session: null, user: null }, error: new Error("Synthetic refusal") };
      publish("SIGNED_IN", signed);
      return { data: { session: signed, user }, error: null };
    },
    signUp: async (data: unknown) => {
      count("signUp");
      state.last["signUp"] = data;
      await wait();
      if (params.get("confirm") === "no") {
        publish("SIGNED_IN", signed);
        return { data: { session: signed, user }, error: null };
      }
      return { data: { session: null, user }, error: null };
    },
    signInWithOAuth: async (data: unknown) => {
      count("google");
      state.last["google"] = data;
      await wait();
      return {
        data: { url: "https://synthetic.invalid/no-network" },
        error: params.get("fail") === "google" ? new Error("Synthetic refusal") : null,
      };
    },
    resetPasswordForEmail: async (email: string, data: unknown) => {
      count("resetRequest");
      state.last["resetRequest"] = { email, ...(data as object) };
      await wait();
      return {
        data: {},
        error: params.get("fail") === "reset" ? new Error("Synthetic refusal") : null,
      };
    },
    updateUser: async (data: unknown) => {
      count("updatePassword");
      state.last["updatePassword"] = data;
      await wait();
      return {
        data: { user: state.session?.user ?? null },
        error: params.get("fail") === "update" ? new Error("Synthetic refusal") : null,
      };
    },
  },
};
Object.assign(window, { __authTest: state });
