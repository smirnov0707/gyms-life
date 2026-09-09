import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { ProgramActivationActions } from "./ProgramActivationActions";

/** Recover a generated programme after reload or failed activation, without paying for another generation. */
export function SavedTrainingPrograms() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const en = baseLang(lang) === "en";
  const saved = useQuery({
    queryKey: ["training-programmes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id,title,weeks,days_per_week,created_at")
        .eq("user_id", user!.id)
        .eq("is_active", false)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error || !data) throw new Error("Saved programmes unavailable");
      return data;
    },
  });
  if (saved.isPending)
    return (
      <p role="status">{en ? "Loading saved programmes…" : "Įkeliamos išsaugotos programos…"}</p>
    );
  if (saved.isError)
    return (
      <section role="alert" className="panel mt-4 p-5">
        <p>
          {en
            ? "Could not load saved programmes. They have not been deleted."
            : "Nepavyko įkelti išsaugotų programų. Jos nėra ištrintos."}
        </p>
        <Button variant="outline" onClick={() => void saved.refetch()}>
          {en ? "Retry" : "Bandyti dar kartą"}
        </Button>
      </section>
    );
  if (!saved.data.length) return null;
  return (
    <details className="panel mt-4 p-5">
      <summary className="cursor-pointer font-semibold">
        {en ? "Saved programmes" : "Išsaugotos programos"} ({saved.data.length})
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">
        {en
          ? "Your 12 most recent inactive programmes. Activating one replaces the current programme, not its history."
          : "12 naujausių neaktyvių programų. Aktyvavimas pakeičia dabartinę programą, bet neištrina istorijos."}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {saved.data.map((programme) => (
          <article key={programme.id} className="min-w-0 rounded-xl border border-border p-4">
            <h2 className="break-words text-lg font-semibold">{programme.title}</h2>
            <p className="my-3 text-sm text-muted-foreground">
              {programme.weeks} {en ? "weeks" : "savaitės"} · {programme.days_per_week}{" "}
              {en ? "days per week" : "dienos per savaitę"}
            </p>
            <ProgramActivationActions planId={programme.id} lang={lang} />
          </article>
        ))}
      </div>
    </details>
  );
}
