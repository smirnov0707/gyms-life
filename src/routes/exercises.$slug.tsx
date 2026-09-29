import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, baseLang, type TKey } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ExerciseVideo } from "@/components/ExerciseVideo";
import { MuscleTargetVisualizer } from "@/components/MuscleTargetVisualizer";
import { exerciseVideo, exerciseVideoPoster } from "@/lib/exercise-media";
import { exerciseHeadMeta, readExerciseName } from "@/lib/exercise-head";

export const Route = createFileRoute("/exercises/$slug")({
  // The head needs the exercise's name, and `head()` is handed params only.
  // This is the one read that has to happen before the document is written;
  // the component keeps its own, because that one has error states this does
  // not need and must not inherit.
  loader: async ({ params }) => ({ name: await readExerciseName(params.slug) }),
  head: ({ params, loaderData }) => ({
    meta: exerciseHeadMeta(params.slug, loaderData?.name ?? null),
  }),
  component: ExerciseDetail,
});

function ExerciseDetail() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();

  // A failed read used to arrive as `null`, which this page renders exactly
  // like an exercise that does not exist. "We could not load it" and "there
  // is no such exercise" are different answers.
  const {
    data: ex,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["exercise", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  if (isLoading || !ex) {
    return (
      <AppShell>
        <Link
          to="/exercises"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-4" /> {t("ex.title")}
        </Link>
        {/* The throw above turned a failed read into an error state; this is
            the other half of that fix. Until now the error state fell through
            to "not found", so an outage told the athlete the exercise does
            not exist — the very answer the read was changed to avoid. */}
        <div role={isError ? "alert" : "status"} className="fl-workspace-panel fl-library-state">
          {isLoading ? (
            t("common.loading")
          ) : isError ? (
            <>
              <p>{t("rt.ex.loadFailed")}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                {t("rt.ex.retry")}
              </button>
            </>
          ) : (
            t("rt.ex.notFound")
          )}
        </div>
      </AppShell>
    );
  }

  const name =
    (baseLang(lang) === "lt" ? ex.name_lt : ex.name_en) || ex.name_en || ex.name_lt || ex.slug;
  const instructions =
    (baseLang(lang) === "lt" ? ex.instructions_lt : ex.instructions_en) ||
    ex.instructions_en ||
    ex.instructions_lt ||
    "";
  const mistakes =
    (baseLang(lang) === "lt" ? ex.mistakes_lt : ex.mistakes_en) ||
    ex.mistakes_en ||
    ex.mistakes_lt ||
    "";

  const steps = instructions
    .split(/\n+|(?<=\.)\s+(?=[A-ZĄČĘĖĮŠŲŪŽ0-9])/)
    .map((s2) => s2.trim())
    .filter(Boolean);

  return (
    <AppShell>
      <div className="fl-context-route fl-workspace fl-movement-workspace">
        {/* Schema.org structured data: ExercisePlan + VideoObject + HowTo */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "ExercisePlan",
                  name,
                  exerciseType: ex.muscle_group,
                  description: instructions,
                },
                {
                  "@type": "VideoObject",
                  name: `${name} — technika`,
                  description: instructions || `${name} technikos demonstracija.`,
                  thumbnailUrl: exerciseVideoPoster(ex.slug)
                    ? `https://gyms.life${exerciseVideoPoster(ex.slug)}`
                    : undefined,
                  contentUrl: exerciseVideo(ex.slug)
                    ? `https://gyms.life${exerciseVideo(ex.slug)}`
                    : undefined,
                  uploadDate: ex.created_at ?? undefined,
                },
                ...(steps.length
                  ? [
                      {
                        "@type": "HowTo",
                        name: `Kaip atlikti: ${name}`,
                        description: instructions,
                        tool: ex.equipment
                          ? [{ "@type": "HowToTool", name: ex.equipment }]
                          : undefined,
                        step: steps.map((s, i) => ({
                          "@type": "HowToStep",
                          position: i + 1,
                          text: s,
                        })),
                      },
                    ]
                  : []),
              ],
            }),
          }}
        />
        <Link
          to="/exercises"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {t("ex.title")}
        </Link>

        <header className="fl-workspace-hero">
          <p className="fl-workspace-eyebrow">GYMS.LIFE / {t("ex.technique")}</p>
          <h1 className="fl-workspace-title mt-3">{name}</h1>
          <dl className="fl-movement-metadata">
            <div>
              <dt>{t("ex.muscle")}</dt>
              <dd>{t(`mg.${ex.muscle_group}` as TKey)}</dd>
            </div>
            <div>
              <dt>{t("ex.equipment")}</dt>
              <dd>{t(`eq.${ex.equipment}` as TKey)}</dd>
            </div>
            <div>
              <dt>{t("ex.level")}</dt>
              <dd>{t(`ex.level.${ex.difficulty}` as TKey)}</dd>
            </div>
          </dl>
        </header>
        <div className="fl-movement-layout">
          <div className="fl-movement-demonstration">
            <ExerciseVideo slug={ex.slug} title={name} />
            <MuscleTargetVisualizer slug={ex.slug} muscleGroup={ex.muscle_group} />
          </div>
          <div className="fl-movement-guidance">
            {instructions && (
              <div className="fl-workspace-panel p-6">
                <h2 className="flex items-center gap-2 text-2xl">
                  <ListChecks className="size-5 text-primary" /> {t("ex.technique")}
                </h2>
                <ol className="fl-movement-steps">
                  {steps.map((text, index) => (
                    <li key={index}>
                      <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <p>{text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {mistakes && (
              <div className="fl-workspace-panel p-6">
                <h2 className="flex items-center gap-2 text-2xl">
                  <AlertTriangle className="size-5 text-accent" /> {t("ex.mistakes")}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mistakes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
