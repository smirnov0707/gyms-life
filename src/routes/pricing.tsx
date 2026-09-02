import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { useAccess } from "@/lib/access";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useServerFn } from "@tanstack/react-start";
import {
  getPortalUrl,
  changePlan,
  cancelSubscription,
  resumeSubscription,
} from "@/lib/payments.functions";
import { Logo, LangSwitch } from "@/components/AppShell";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TransformationCalculator } from "@/components/TransformationCalculator";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Kainos — GYMS.LIFE" },
      {
        name: "description",
        content:
          "GYMS.LIFE Premium: 7 dienų nemokamas bandymas. Savaitinis, mėnesinis arba metinis planas. Apple Pay, Google Pay, kortelė.",
      },
      { property: "og:title", content: "Kainos — GYMS.LIFE" },
      {
        property: "og:description",
        content:
          "GYMS.LIFE Premium: 7 dienų nemokamas bandymas. Rinkis savaitinį, mėnesinį ar metinį planą.",
      },
    ],
    links: [{ rel: "canonical", href: "https://gyms.life/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "GYMS.LIFE Premium",
          description:
            "Išmanūs treniruočių ir mitybos planai, pratimų biblioteka su technikos video, papildų sekimas ir asmeninis treneris.",
          brand: { "@type": "Brand", name: "GYMS.LIFE" },
          offers: [
            {
              "@type": "Offer",
              name: "Savaitinis planas",
              price: "3.00",
              priceCurrency: "EUR",
              url: "https://gyms.life/pricing",
              availability: "https://schema.org/InStock",
            },
            {
              "@type": "Offer",
              name: "Mėnesinis planas",
              price: "12.00",
              priceCurrency: "EUR",
              url: "https://gyms.life/pricing",
              availability: "https://schema.org/InStock",
            },
            {
              "@type": "Offer",
              name: "Metinis planas",
              price: "49.00",
              priceCurrency: "EUR",
              url: "https://gyms.life/pricing",
              availability: "https://schema.org/InStock",
            },
          ],
        }),
      },
    ],
  }),
  component: PricingPage,
});

const PLANS: {
  priceId: string;
  popular?: boolean;
  nameKey: TKey;
  price: string;
  perKey: TKey;
  taglineKey: TKey;
  badgeKey: TKey;
  strike?: string;
  saveKey?: TKey;
  perMonthKey?: TKey;
}[] = [
  {
    priceId: "vex_weekly",
    nameKey: "lg.pricing.plan.weekly.name",
    price: "€3",
    perKey: "lg.pricing.plan.weekly.per",
    taglineKey: "lg.pricing.plan.weekly.tagline",
    badgeKey: "l3.pr.weeklyTag",
  },
  {
    priceId: "vex_monthly",
    popular: true,
    nameKey: "lg.pricing.plan.monthly.name",
    price: "€12",
    perKey: "lg.pricing.plan.monthly.per",
    taglineKey: "lg.pricing.plan.monthly.tagline",
    badgeKey: "l3.pr.monthlyTag",
  },
  {
    priceId: "vex_yearly",
    nameKey: "lg.pricing.plan.yearly.name",
    price: "€49",
    perKey: "lg.pricing.plan.yearly.per",
    taglineKey: "lg.pricing.plan.yearly.tagline",
    badgeKey: "l3.pr.yearlyTag",
    strike: "€144",
    saveKey: "l3.pr.save",
    perMonthKey: "l3.pr.perMonth",
  },
];

function PricingPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const access = useAccess(user?.id);
  const { openCheckout, loading } = usePaddleCheckout();
  const navigate = useNavigate();
  const portal = useServerFn(getPortalUrl);
  const switchPlan = useServerFn(changePlan);
  const [switching, setSwitching] = useState(false);
  const cancelSub = useServerFn(cancelSubscription);
  const resumeSub = useServerFn(resumeSubscription);
  const [cancelling, setCancelling] = useState(false);

  const cancelLabels = {
    lt: {
      cancel: "Atšaukti prenumeratą",
      confirm: "Tikrai atšaukti prenumeratą? Prieiga liks iki apmokėto laikotarpio pabaigos.",
      done: "Prenumerata bus nutraukta laikotarpio pabaigoje.",
      scheduled: "Prenumerata nutraukiama {date}. Iki tol viskas veikia.",
      resume: "Tęsti prenumeratą",
      resumed: "Prenumerata atnaujinta.",
      error: "Nepavyko. Bandyk dar kartą.",
    },
    en: {
      cancel: "Cancel subscription",
      confirm: "Cancel your subscription? Access stays until the end of the paid period.",
      done: "Your subscription will end at the end of the period.",
      scheduled: "Subscription ends on {date}. Everything works until then.",
      resume: "Resume subscription",
      resumed: "Subscription resumed.",
      error: "Something went wrong. Try again.",
    },
  }[lang === "lt" ? "lt" : "en"]!;

  const doCancel = async () => {
    if (!window.confirm(cancelLabels.confirm)) return;
    setCancelling(true);
    try {
      await cancelSub();
      toast.success(cancelLabels.done);
    } catch {
      toast.error(cancelLabels.error);
    } finally {
      setCancelling(false);
    }
  };

  const doResume = async () => {
    setCancelling(true);
    try {
      await resumeSub();
      toast.success(cancelLabels.resumed);
    } catch {
      toast.error(cancelLabels.error);
    } finally {
      setCancelling(false);
    }
  };

  const featureKeys: TKey[] = [
    "lg.pricing.feature.plans",
    "lg.pricing.feature.library",
    "lg.pricing.feature.meals",
    "lg.pricing.feature.camera",
    "lg.pricing.feature.supplements",
    "l3.pr.feature.body",
    "lg.pricing.feature.coach",
  ];

  const buy = async (priceId: string) => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    // Already subscribed → switch plan; the new plan starts at the next renewal.
    if (access.subscribed) {
      setSwitching(true);
      try {
        await switchPlan({ data: { priceId } });
        toast.success(t("lg.pricing.planSwitched"));
      } catch {
        toast.error(t("lg.pricing.checkoutError"));
      } finally {
        setSwitching(false);
      }
      return;
    }
    try {
      await openCheckout({
        priceId,
        quantity: 1,
        ...(user.email ? { customerEmail: user.email } : {}),
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/app?checkout=success`,
      });
    } catch {
      toast.error(t("lg.pricing.checkoutError"));
    }
  };

  const openPortal = async () => {
    try {
      const { url } = await portal();
      window.open(url, "_blank");
    } catch {
      toast.error(t("lg.pricing.noSub"));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-3">
            <LangSwitch />
            <Link
              to={user ? "/app" : "/auth"}
              className="press rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              {user ? t("lg.pricing.myApp") : t("lg.pricing.signIn")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles className="size-3.5" />
            {t("lg.pricing.freeDays")}
          </span>
          <h1 className="text-display mt-4 text-5xl leading-none sm:text-6xl">
            {t("lg.pricing.heroTitle")}
          </h1>
          <p className="mt-4 text-muted-foreground">{t("lg.pricing.heroSubtitle")}</p>
        </div>

        <TransformationCalculator />

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => {
            return (
              <div
                key={p.priceId}
                className={cn(
                  "panel relative flex flex-col gap-4 rounded-2xl border p-6 transition-all",
                  p.popular
                    ? "border-primary shadow-[0_0_40px_-10px_var(--primary-dim)]"
                    : "border-border",
                )}
              >
                <span
                  className={cn(
                    "absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                    p.popular
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface text-muted-foreground",
                  )}
                >
                  {t(p.badgeKey)}
                </span>
                <div>
                  <h2 className="text-lg font-bold">{t(p.nameKey)}</h2>
                  <p className="text-sm text-muted-foreground">{t(p.taglineKey)}</p>
                </div>
                <div>
                  <p className="text-display text-5xl">
                    {p.price}
                    <span className="text-base text-muted-foreground"> {t(p.perKey)}</span>
                  </p>
                  {p.strike && (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through">{p.strike}</span>
                      {p.saveKey && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          {t(p.saveKey)}
                        </span>
                      )}
                    </p>
                  )}
                  {p.perMonthKey && (
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {t(p.perMonthKey)}
                    </p>
                  )}
                </div>
                <ul className="flex-1 space-y-2 text-sm">
                  {featureKeys.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{t(f)}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => buy(p.priceId)}
                  disabled={loading || switching}
                  className={cn(
                    "press flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors",
                    p.popular
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  {(loading || switching) && <Loader2 className="size-4 animate-spin" />}
                  {access.subscribed ? t("lg.pricing.switchPlan") : t("lg.pricing.startFree")}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-foreground">
          {t("l3.pr.allFeatures")}
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">{t("lg.pricing.payNote")}</p>

        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border bg-surface p-6 text-center">
          <h2 className="text-lg font-bold">{t("l3.pr.compare.t")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("l3.pr.compare.d")}
          </p>
        </div>

        {user && (access.subscribed || access.isOwner) && (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-surface p-5 text-center">
            {access.isOwner ? (
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
                <Crown className="size-4" />
                {t("lg.pricing.ownerAccount")}
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold">{t("lg.pricing.subActive")}</p>
                {access.cancelAtPeriodEnd && access.periodEnd && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {cancelLabels.scheduled.replace(
                      "{date}",
                      access.periodEnd.toLocaleDateString(),
                    )}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={openPortal}
                    className="press rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-2"
                  >
                    {t("lg.pricing.manageSub")}
                  </button>
                  <button
                    onClick={access.cancelAtPeriodEnd ? doResume : doCancel}
                    disabled={cancelling}
                    className="press rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-2 disabled:opacity-50"
                  >
                    {cancelling && <Loader2 className="mr-1 inline size-3 animate-spin" />}
                    {access.cancelAtPeriodEnd ? cancelLabels.resume : cancelLabels.cancel}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <footer className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border pt-8 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            GYMS.LIFE
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            {t("lg.pricing.terms")}
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            {t("lg.pricing.privacy")}
          </Link>
          <Link to="/refund" className="hover:text-foreground">
            {t("lg.pricing.refunds")}
          </Link>
        </footer>
      </main>
    </div>
  );
}
