import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Lock, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAccess, TRIAL_DAYS } from "@/lib/access";

type Labels = {
  trialLeft: string;
  trialLast: string;
  trialEnded: string;
  trialEndedBody: string;
  subscribe: string;
  reminderTitle: string;
  upgrade: string;
};

const L: Record<string, Labels> = {
  lt: {
    trialLeft: "Nemokamas bandymas: liko {n} d.",
    trialLast: "Paskutinė nemokamo bandymo diena",
    trialEnded: "Nemokamas 7 dienų laikotarpis baigėsi",
    trialEndedBody:
      "Kad toliau naudotum treniruočių planus, Treneris trenerį, mitybą ir skenerius, pasirink prenumeratą. Atšaukti gali bet kada.",
    subscribe: "Pasirinkti prenumeratą",
    reminderTitle: "Bandomasis laikotarpis baigiasi",
    upgrade: "Aktyvuoti",
  },
  en: {
    trialLeft: "Free trial: {n} days left",
    trialLast: "Last day of your free trial",
    trialEnded: "Your 7-day free trial has ended",
    trialEndedBody:
      "Subscribe to keep using training plans, the Coach coach, nutrition and the scanners. Cancel anytime.",
    subscribe: "Choose a plan",
    reminderTitle: "Your trial is ending",
    upgrade: "Upgrade",
  },
};

/** Gates the authenticated app behind the 7-day trial or an active subscription. */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const l = L[lang] ?? L["en"]!;
  const access = useAccess(user?.id);

  const daysLeft = access.trialEndsAt
    ? Math.max(0, Math.ceil((access.trialEndsAt.getTime() - Date.now()) / 86_400_000))
    : TRIAL_DAYS;

  // Reminder: once a day while the trial is running out.
  useEffect(() => {
    if (!access.inTrial || daysLeft > 3) return;
    const key = `vex_trial_reminder_${new Date().toISOString().slice(0, 10)}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    toast(l.reminderTitle, {
      description: daysLeft <= 1 ? l.trialLast : l.trialLeft.replace("{n}", String(daysLeft)),
    });
  }, [access.inTrial, daysLeft, l]);

  if (access.loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!access.hasAccess) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="panel rounded-3xl border border-border p-8">
          <Lock className="mx-auto size-8 text-primary" />
          <h1 className="mt-4 text-2xl font-black">{l.trialEnded}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{l.trialEndedBody}</p>
          <Link
            to="/pricing"
            className="press mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
          >
            <Sparkles className="size-4" /> {l.subscribe}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {access.inTrial && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-primary">
            <Clock className="size-4" />
            {daysLeft <= 1 ? l.trialLast : l.trialLeft.replace("{n}", String(daysLeft))}
          </span>
          <Link
            to="/pricing"
            className="press rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
          >
            {l.upgrade}
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
