import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { safeAuthNext } from "./auth-redirect";

const FormSchema = z
  .object({
    mode: z.enum(["in", "up", "forgot"]),
    email: z.string().trim().email().max(254),
    password: z.string().max(1024),
    name: z.string().trim().max(120),
    origin: z.string().url(),
    next: z.unknown().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode !== "forgot" && v.password.length < 6)
      ctx.addIssue({ code: "custom", path: ["password"], message: "Password required" });
    if (v.mode === "up" && !v.name)
      ctx.addIssue({ code: "custom", path: ["name"], message: "Name required" });
  });
type AuthApi = Pick<
  SupabaseClient["auth"],
  "signInWithPassword" | "signUp" | "resetPasswordForEmail"
>;
export type AuthFormResult = "authenticated" | "confirm-email" | "reset-requested";
/** Provider calls finish before navigation; confirmation is not a logged-in session. */
export async function submitAuthForm(
  auth: AuthApi,
  input: z.input<typeof FormSchema>,
): Promise<AuthFormResult> {
  const data = FormSchema.parse(input),
    origin = new URL(data.origin).origin;
  if (data.mode === "forgot") {
    const result = await auth.resetPasswordForEmail(data.email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (result.error) throw result.error;
    return "reset-requested";
  }
  const result =
    data.mode === "in"
      ? await auth.signInWithPassword({ email: data.email, password: data.password })
      : await auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: origin + (safeAuthNext(data.next) ?? "/app"),
            data: { full_name: data.name },
          },
        });
  if (result.error) throw result.error;
  if (result.data.session) return "authenticated";
  if (data.mode === "up") return "confirm-email";
  throw new Error("AUTH_SESSION_UNAVAILABLE");
}
