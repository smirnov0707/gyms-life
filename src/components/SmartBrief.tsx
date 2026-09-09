import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Activity,
  Apple,
  ArrowRight,
  Camera,
  Dumbbell,
  Flame,
  HeartPulse,
  Loader2,
  MessageCircle,
  Pill,
  RefreshCw,
  Salad,
  ScanLine,
  Sparkles,
  Trophy,
  TriangleAlert,
  User,
} from "lucide-react";
import { getDailyBrief } from "@/lib/brief.functions";
import { DailyBriefSchema, type BriefRoute } from "@/lib/brief.schema";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/GlowCard";
import { cn } from "@/lib/utils";
import { aiErrorMessage } from "@/lib/ai-error";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";

const ROUTE_ICON: Record<BriefRoute, typeof Sparkles> = {
  "/app": Activity,
  "/onboarding": User,
  "/exercises": Dumbbell,
  "/ar": ScanLine,
  "/meal-plan": Salad,
  "/nutrition": Apple,
  "/supplements": Pill,
  "/progress": Camera,
  "/readiness": HeartPulse,
  "/coach": MessageCircle,
  "/achievements": Trophy,
  "/reminders": Flame,
};

/**
 * An evidence-led interpretation layer. Training entry stays in TodayDecision
 * so an AI-produced action card can never skip a deterministic safety check.
 */
export function SmartBrief({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n();
  const timeZone = browserTimeZone();
  const fetchBrief = useServerFn(getDailyBrief);
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["daily-brief", user?.id, lang, timeZone, dayInTimeZone(new Date(), timeZone)],
    enabled: !!user,
    retry: false,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!user) throw new Error("Authentication required");
      return DailyBriefSchema.parse(
        await fetchBrief({ data: { ownerId: user.id, lang, timeZone } }),
      );
    },
  });
  const brief = query.data ?? null,
    busy = query.isFetching,
    failed = query.isError ? aiErrorMessage(query.error, t) : null;
  const load = async (_force: boolean) => {
    if (user && !query.isFetching) await query.refetch({ cancelRefetch: false });
  };
  if (!user) return null;

  if (compact) {
    return (
      <section className="fl-surface fl-smart-brief">
        <header>
          <h2 className="fl-eyebrow">{t("brief.title")}</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load(true)}
            aria-label={t("brief.refresh")}
            className="fl-brief-refresh"
          >
            <RefreshCw className={cn("size-3", busy && "animate-spin")} />
          </button>
        </header>
        {busy && !brief ? <p>{t("brief.loading")}</p> : null}
        {failed && !brief ? <p role="status">{failed}</p> : null}
        {brief ? (
          <>
            <h3>{brief.headline}</h3>
            <p className="fl-brief-preview">{brief.summary}</p>
            {brief.watchouts.map((warning, index) => (
              <p key={index} className="fl-brief-warning">
                {t("brief.watch")}: {warning}
              </p>
            ))}
            <details className="fl-disclosure">
              <summary>{t("brief.why")}</summary>
              <p>{brief.summary}</p>
              <p>
                {t("brief.focus")}: {brief.focus}
              </p>
              {brief.signals?.map((signal, index) => (
                <p key={index}>
                  {signal.label}: {signal.value}
                  {signal.note ? ` · ${signal.note}` : ""}
                </p>
              ))}
              {brief.actions.map((action, index) => (
                <Link key={index} to={action.route} className="fl-brief-action">
                  <strong>{action.title}</strong>
                  <span>{action.reason}</span>
                  {action.evidence ? <span>{action.evidence}</span> : null}
                  <span className="fl-text-link">{action.cta} →</span>
                </Link>
              ))}
            </details>
          </>
        ) : null}
      </section>
    );
  }

  return (
    <GlowCard className="panel relative overflow-hidden p-6 md:p-7">
      <div className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h3 className="text-2xl leading-none">{t("brief.title")}</h3>
              <p className="mt-1 max-w-xl text-xs text-muted-foreground">{t("brief.sub")}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={busy}
            onClick={() => void load(true)}
            aria-label={t("brief.refresh")}
          >
            <RefreshCw className={cn("size-3.5", busy && "animate-spin")} /> {t("brief.refresh")}
          </Button>
        </div>

        {busy && !brief && (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> {t("brief.loading")}
          </div>
        )}

        {failed && !brief && <p className="mt-6 text-sm text-muted-foreground">{failed}</p>}

        {brief && (
          <div className="mt-6 grid gap-5">
            <div>
              <h4 className="text-3xl leading-tight md:text-4xl">{brief.headline}</h4>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {brief.summary}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                  {t("brief.focus")}: {brief.focus}
                </span>
                {brief.streakDays > 0 && (
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-muted-foreground">
                    🔥 {brief.streakDays}
                  </span>
                )}
                {brief.readiness != null && (
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-muted-foreground">
                    ⚡ {brief.readiness}
                  </span>
                )}
              </div>
            </div>

            {(brief.signals ?? []).length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("brief.signals")}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(brief.signals ?? []).map((sig, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-2xl border bg-surface-2 px-4 py-3",
                        sig.tone === "risk"
                          ? "border-amber-500/40"
                          : sig.tone === "good"
                            ? "border-primary/40"
                            : "border-border",
                      )}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {sig.label}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-lg font-bold leading-none",
                          sig.tone === "risk"
                            ? "text-amber-500"
                            : sig.tone === "good"
                              ? "text-primary"
                              : "text-foreground",
                        )}
                      >
                        {sig.value}
                      </p>
                      {sig.note && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {sig.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {brief.watchouts.length > 0 && (
              <div className="grid gap-2">
                {brief.watchouts.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs leading-relaxed text-foreground"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <span>
                      <span className="font-bold">{t("brief.watch")}: </span>
                      {w}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {brief.actions.map((a, i) => {
                const Icon = ROUTE_ICON[a.route] ?? Sparkles;
                const cls = cn(
                  "lift press group flex items-start gap-3 rounded-2xl border p-4 transition-colors",
                  a.priority === "high"
                    ? "border-primary/50 bg-primary/5 hover:border-primary"
                    : "border-border bg-surface-2 hover:border-primary/40",
                );
                const inner = (
                  <>
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {t(`brief.prio.${a.priority}` as "brief.prio.high")}
                      </span>
                      <span className="mt-0.5 block text-sm font-bold leading-snug">{a.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {a.reason}
                      </span>
                      {a.evidence && (
                        <span className="mt-1.5 block rounded-lg bg-background/60 px-2 py-1 text-[11px] leading-snug text-muted-foreground">
                          <span className="font-bold uppercase tracking-wide">
                            {t("brief.why")}:{" "}
                          </span>
                          {a.evidence}
                        </span>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                        {a.cta}
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </>
                );
                return (
                  <Link key={i} to={a.route} className={cls}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </GlowCard>
  );
}
