import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, ListChecks, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ExerciseVideo } from "@/components/ExerciseVideo";
import { MuscleTargetVisualizer } from "@/components/MuscleTargetVisualizer";
import { exerciseVideo, exerciseVideoPoster } from "@/lib/exercise-media";

export const Route = createFileRoute("/exercises/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — pratimo technika ir video | GYMS.LIFE` },
      {
        name: "description",
        content:
          "Pratimo technika žingsnis po žingsnio, dažniausios klaidos ir vaizdo demonstracija.",
      },
      { property: "og:title", content: `${params.slug} — pratimo technika | GYMS.LIFE` },
      {
        property: "og:description",
        content: "Kaip taisyklingai atlikti šį pratimą — video ir patarimai.",
      },
    ],
  }),
  component: ExerciseDetail,
});

function ExerciseDetail() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();

  const { data: ex, isLoading } = useQuery({
    queryKey: ["exercise", slug],
    queryFn: async () => {
      const { data } = await supabase.from("exercises").select("*").eq("slug", slug).maybeSingle();
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
        <div className="panel p-12 text-center text-sm text-muted-foreground">
          {isLoading ? t("common.loading") : t("rt.ex.notFound")}
        </div>
      </AppShell>
    );
  }

  const name = (lang === "lt" ? ex.name_lt : ex.name_en) || ex.name_en || ex.name_lt || ex.slug;
  const instructions =
    (lang === "lt" ? ex.instructions_lt : ex.instructions_en) ||
    ex.instructions_en ||
    ex.instructions_lt ||
    "";
  const mistakes =
    (lang === "lt" ? ex.mistakes_lt : ex.mistakes_en) || ex.mistakes_en || ex.mistakes_lt || "";

  const steps = instructions
    .split(/\n+|(?<=\.)\s+(?=[A-ZĄČĘĖĮŠŲŪŽ0-9])/)
    .map((s2) => s2.trim())
    .filter((s2) => s2.length > 3)
    .slice(0, 12);

  return (
    <AppShell>
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

      <div className="mt-4 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div>
          <ExerciseVideo slug={ex.slug} title={name} />
        </div>
        <div>
          <h1 className="text-4xl sm:text-5xl font-black">{name}</h1>
          <div className="mt-4 grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">{t("ex.muscle")}: </span>
              <span className="font-semibold text-primary">
                {t(`mg.${ex.muscle_group}` as TKey)}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("ex.equipment")}: </span>
              <span className="font-semibold">{ex.equipment}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("ex.level")}: </span>
              <span className="font-semibold">{ex.difficulty}</span>
            </p>
          </div>

          {instructions && (
            <div className="panel mt-6 p-5">
              <h2 className="flex items-center gap-2 text-2xl">
                <ListChecks className="size-5 text-primary" /> {t("ex.technique")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{instructions}</p>
            </div>
          )}

          <div className="mt-4">
            <MuscleTargetVisualizer muscleGroup={ex.muscle_group} />
          </div>

          {mistakes && (
            <div className="panel mt-4 p-5">
              <h2 className="flex items-center gap-2 text-2xl">
                <AlertTriangle className="size-5 text-accent" /> {t("ex.mistakes")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mistakes}</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
