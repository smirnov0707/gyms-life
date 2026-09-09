import { currentApplicationBuild } from "../../lib/application-build";
import {
  checkBrowserEnvironment,
  projectOriginMatches,
  publicKeyMatches,
} from "../../lib/application-environment";
// Generated client adapter, with reviewed project-specific environment guards.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function assertClientEnvironment(databaseUrl: string, publicKey: string) {
  const build = currentApplicationBuild();
  if (!publicKeyMatches(publicKey, build?.provider === "netlify" ? build.projectRef : undefined))
    throw new Error("APPLICATION_CLIENT_KEY_UNSAFE");
  if (build?.provider === "netlify" && !projectOriginMatches(databaseUrl, build.projectRef))
    throw new Error("APPLICATION_ENVIRONMENT_UNSAFE");
  if (
    typeof window !== "undefined" &&
    !checkBrowserEnvironment(build, window.location.href, databaseUrl).allowed
  )
    throw new Error("APPLICATION_ENVIRONMENT_UNSAFE");
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string, databaseUrl: string): typeof fetch {
  return (input, init) => {
    assertClientEnvironment(databaseUrl, supabaseKey);
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient() {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Configure Supabase environment variables.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  assertClientEnvironment(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL),
    },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
