import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Logo, LangSwitch } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => {
    const next = safeNext(s["next"]);
    const mode = s["mode"] === "up" || s["mode"] === "forgot" ? s["mode"] : undefined;
    return { ...(next ? { next } : {}), ...(mode ? { mode } : {}) };
  },
  head: () => ({
    meta: [
      { title: "Prisijungimas — GYMS.LIFE treniruočių programėlė" },
      { name: "description", content: "Prisijunk arba sukurk GYMS.LIFE paskyrą ir gauk individualų treniruočių planą." },
      { property: "og:title", content: "Prisijungimas — GYMS.LIFE" },
      { property: "og:description", content: "Prisijunk prie GYMS.LIFE ir tęsk savo treniruočių planą." },
    ],
  }),
  component: AuthPage,
});

function GoogleIcon({ className }: { className?: string }) {
  return <svg className={className ?? "size-4"} viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>;
}

function AuthPage() {
  const { t } = useI18n();
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch() as { next?: string; mode?: "in" | "up" | "forgot" };
  const [mode, setMode] = useState<"in" | "up" | "forgot">(() => search.mode ?? "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const next = safeNext(search.next);

  const goNext = () => {
    if (next) { window.location.href = next; return; }
    navigate({ to: "/app", replace: true });
  };
  useEffect(() => { if (!loading && user) goNext(); }, [user, loading, next]);
  useEffect(() => { if (search.mode) setMode(search.mode); }, [search.mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
        if (error) throw error;
        toast.success("Paskyra sukurta. Patikrinkite el. paštą.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refresh(); goNext();
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const google = async () => {
    setGoogleBusy(true);
    try { const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth${next ? `?next=${encodeURIComponent(next)}` : ""}` } }); if (error) throw error; }
    catch (error) { toast.error(error instanceof Error ? error.message : t("common.error")); setGoogleBusy(false); }
  };

  if (loading) return <main className="mx-auto grid min-h-[70vh] place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></main>;
  return <main className="mx-auto max-w-md px-4 py-12"><div className="mb-8 flex items-center justify-between"><Link to="/"><Logo /></Link><LangSwitch /></div><div className="panel p-6 md:p-8"><h1 className="text-3xl font-bold">{mode === "up" ? "Sukurti paskyrą" : mode === "forgot" ? "Atkurti slaptažodį" : "Prisijungti"}</h1>{sent ? <p className="mt-4 text-sm text-muted-foreground">Patikrinkite el. paštą ir sekite nuorodą slaptažodžiui atkurti.</p> : <><form className="mt-6 grid gap-4" onSubmit={submit}>{mode === "up" && <div><Label>Vardas</Label><Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required /></div>}<div><Label>El. paštas</Label><Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>{mode !== "forgot" && <div><Label>Slaptažodis</Label><Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>}<Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}{mode === "up" ? "Sukurti paskyrą" : mode === "forgot" ? "Siųsti nuorodą" : "Prisijungti"}</Button></form>{mode !== "forgot" && <><div className="my-5 text-center text-xs text-muted-foreground">arba</div><Button variant="outline" className="w-full" onClick={google} disabled={googleBusy}>{googleBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <GoogleIcon className="mr-2 size-4" />}Tęsti su Google</Button></>}{mode === "in" && <div className="mt-5 text-center text-sm"><button type="button" className="text-primary underline" onClick={() => setMode("forgot")}>Pamiršote slaptažodį?</button></div>}<div className="mt-5 text-center text-sm text-muted-foreground">{mode === "up" ? "Jau turite paskyrą?" : "Neturite paskyros?"} <button type="button" className="text-primary underline" onClick={() => setMode(mode === "up" ? "in" : "up")}>{mode === "up" ? "Prisijungti" : "Registruotis"}</button></div></>}</div></main>;
}
