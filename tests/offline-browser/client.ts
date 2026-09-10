import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
export const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
export const SA = "33333333-3333-4333-8333-333333333333",
  SB = "66666666-6666-4666-8666-666666666666";
const KEY = "synthetic-offline-owner",
  listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>();
if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, A);
export const currentOwner = () => {
  const id = localStorage.getItem(KEY);
  return id === A || id === B ? id : null;
};
const session = (): Session | null => {
  const id = currentOwner();
  return id
    ? {
        access_token: "synthetic-only",
        refresh_token: "synthetic-only",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id,
          email: `${id}@example.invalid`,
          aud: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-09-09T00:00:00Z",
        },
      }
    : null;
};
const notify = () => {
  const next = session();
  listeners.forEach((callback) => callback(next ? "SIGNED_IN" : "SIGNED_OUT", next));
};
window.addEventListener("storage", (event) => {
  if (event.key === KEY) notify();
});
export function switchOwner(id: string | null) {
  if (id !== null && id !== A && id !== B) throw new Error("Unknown synthetic account");
  localStorage.setItem(KEY, id ?? "signed-out");
  notify();
}
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: session() }, error: null }),
    onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
      listeners.add(callback);
      queueMicrotask(() => {
        if (listeners.has(callback)) callback("INITIAL_SESSION", session());
      });
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
  },
};
export async function syntheticApi(action: string, data: unknown) {
  const testCase = new URLSearchParams(location.search).get("case") ?? "default";
  const response = await fetch(
    `/__offline_fixture/${action}?case=${encodeURIComponent(testCase)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-synthetic-owner": currentOwner() ?? "" },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) throw new Error("SYNTHETIC_OFFLINE_ENDPOINT_REFUSED");
  return response.json();
}
