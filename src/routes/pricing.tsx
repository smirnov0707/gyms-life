import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Crown, Loader2, Sparkles, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { useAccess } from "@/lib/access";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  getPortalUrl,
  changePlan,
  cancelSubscription,
  resumeSubscription,
} from "@/lib/payments.functions";
import { PublicFrame } from "@/components/PublicFrame";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { toast } from "sonner";
import { TransformationCalculator } from "@/components/TransformationCalculator";
import { isBillingEnabled } from "@/lib/billing";

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
  const actionLock = useRef(false);
  const [pending, setPending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const cancelSub = useServerFn(cancelSubscription);
  const resumeSub = useServerFn(resumeSubscription);
  const queryClient = useQueryClient();
  const billingEnabled = isBillingEnabled();
  const betaCopy =
    baseLang(lang) === "lt"
      ? {
          title: "Mokėjimai dar nejungiami",
          body: "Visi GYMS.LIFE funkcionalumai šiuo beta etapu prieinami be prenumeratos.",
          button: "Netrukus",
        }
      : {
          title: "Payments are not enabled yet",
          body: "Every GYMS.LIFE feature is available without a subscription during this beta phase.",
          button: "Coming soon",
        };

  const cancelLabels = {
    lt: {
      cancel: "Atšaukti prenumeratą",
      confirm: "Tikrai atšaukti prenumeratą? Prieiga liks iki apmokėto laikotarpio pabaigos.",
      done: "Prenumerata bus nutraukta laikotarpio pabaigoje.",
      scheduled: "Prenumerata nutraukiama {date}. Iki tol viskas veikia.",
      resume: "Tęsti prenumeratą",
      resumed: "Prenumerata atnaujinta.",
      error: "Nepavyko. Bandyk dar kartą.",
      lagging: "Užregistruota mokėjimų tiekėjo pusėje. Šis puslapis gali atsilikti kelias minutes.",
    },
    en: {
      cancel: "Cancel subscription",
      confirm: "Cancel your subscription? Access stays until the end of the paid period.",
      done: "Your subscription will end at the end of the period.",
      scheduled: "Subscription ends on {date}. Everything works until then.",
      resume: "Resume subscription",
      resumed: "Subscription resumed.",
      error: "Something went wrong. Try again.",
      lagging:
        "Registered with the payment provider. This page may take a few minutes to catch up.",
    },
  }[baseLang(lang) === "lt" ? "lt" : "en"]!;

  /**
   * Both actions change a subscription at Paddle and then mirror it locally.
   * The button state comes from that local row, so it has to be re-read —
   * otherwise the page keeps offering "Cancel" to somebody who just
   * cancelled. When the mirror write failed, `synced` is false: the change is
   * real, the page is behind, and saying so beats a success message that the
   * screen then contradicts.
   */
  const afterBillingChange = async (result: { synced: boolean }, done: string) => {
    await queryClient.invalidateQueries({ queryKey: ["access", user?.id] });
    if (result.synced) toast.success(done);
    else toast.success(done, { description: cancelLabels.lagging });
  };

  const accountUncertain = !!user && (access.loading || access.readFailed || retrying);
  const busy = pending || loading;
  const blocked = !billingEnabled || accountUncertain || access.isOwner || busy;
  const lt = baseLang(lang) === "lt";

  // One lock covers all payment actions, including two clicks in the same render.
  const performBilling = async (operation: () => Promise<void>) => {
    if (blocked || !user || actionLock.current) return;
    actionLock.current = true;
    setPending(true);
    try {
      await operation();
    } finally {
      actionLock.current = false;
      setPending(false);
    }
  };

  const doCancel = async () => {
    if (blocked || actionLock.current || !window.confirm(cancelLabels.confirm)) return;
    await performBilling(async () => {
      try {
        await afterBillingChange(await cancelSub(), cancelLabels.done);
      } catch {
        toast.error(cancelLabels.error);
      }
    });
  };

  const doResume = async () => {
    await performBilling(async () => {
      try {
        await afterBillingChange(await resumeSub(), cancelLabels.resumed);
      } catch {
        toast.error(cancelLabels.error);
      }
    });
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
    if (blocked || actionLock.current) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    await performBilling(async () => {
      try {
        if (access.subscribed) {
          await switchPlan({ data: { priceId } });
          toast.success(t("lg.pricing.planSwitched"));
          await queryClient.invalidateQueries({ queryKey: ["access", user.id] });
        } else {
          await openCheckout({
            priceId,
            quantity: 1,
            ...(user.email ? { customerEmail: user.email } : {}),
            customData: { userId: user.id },
            successUrl: `${window.location.origin}/app?checkout=success`,
          });
        }
      } catch {
        toast.error(t("lg.pricing.checkoutError"));
      }
    });
  };

  const openPortal = async () => {
    await performBilling(async () => {
      try {
        const { url } = await portal();
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        toast.error(t("lg.pricing.noSub"));
      }
    });
  };

  const retryAccess = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["access", user?.id] });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <PublicFrame page="pricing" signedIn={!!user}>
      <PaymentTestModeBanner />
      <div className="fl-pricing">
        <header className="fl-public-heading fl-pricing-heading">
          <span className="fl-public-eyebrow">
            <Sparkles aria-hidden="true" />
            {billingEnabled ? t("lg.pricing.freeDays") : "FUTURE LAB · BETA"}
          </span>
          <h1>{t("lg.pricing.heroTitle")}</h1>
          <p>{billingEnabled ? t("lg.pricing.heroSubtitle") : betaCopy.body}</p>
        </header>

        {!billingEnabled && (
          <div className="fl-public-notice">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h2>{betaCopy.title}</h2>
              <p>
                {lt
                  ? "Žemiau – būsimi planai. Kol kas pradėk be mokėjimo."
                  : "Explore the upcoming plans below. For now, get started without payment."}
              </p>
            </div>
            <a href={user ? "/app" : "/auth"}>
              {user ? t("lg.pricing.myApp") : t("lg.pricing.startFree")}
              <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        )}

        {billingEnabled && accountUncertain && (
          <div className="fl-public-notice" role={access.readFailed ? "alert" : "status"}>
            <ShieldCheck aria-hidden="true" />
            <div>
              <h2>
                {access.readFailed
                  ? lt
                    ? "Prenumeratos būsena nepasiekiama"
                    : "Subscription status unavailable"
                  : lt
                    ? "Tikrinama prenumerata"
                    : "Checking your subscription"}
              </h2>
              <p>
                {lt
                  ? "Mokėjimų veiksmai bus prieinami patikrinus tavo paskyrą."
                  : "Payment actions will be available after your account is checked."}
              </p>
            </div>
            {access.readFailed && (
              <button type="button" onClick={retryAccess} disabled={retrying}>
                {lt ? "Tikrinti dar kartą" : "Check again"}
              </button>
            )}
          </div>
        )}

        <div className="fl-pricing-plans">
          {PLANS.map((p, index) => (
            <section
              key={p.priceId}
              className={`fl-price-card${p.popular ? " fl-price-featured" : ""}`}
              aria-labelledby={`plan-${index}`}
            >
              <div className="fl-price-card-top">
                <span>0{index + 1}</span>
                <span className="fl-price-badge">{t(p.badgeKey)}</span>
              </div>
              <h2 id={`plan-${index}`}>{t(p.nameKey)}</h2>
              <p className="fl-price-tagline">{t(p.taglineKey)}</p>
              <div className="fl-price-amount">
                <p>
                  <strong>{p.price}</strong>
                  <span>{t(p.perKey)}</span>
                </p>
                {p.strike && (
                  <div className="fl-price-saving">
                    <s>{p.strike}</s>
                    {p.saveKey && <span>{t(p.saveKey)}</span>}
                  </div>
                )}
                {p.perMonthKey && <small>{t(p.perMonthKey)}</small>}
              </div>
              <button
                type="button"
                onClick={() => buy(p.priceId)}
                disabled={blocked}
                data-plan={p.priceId}
                className="fl-public-action"
              >
                {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                {!billingEnabled
                  ? betaCopy.button
                  : access.isOwner
                    ? t("lg.pricing.ownerAccount")
                    : access.subscribed
                      ? t("lg.pricing.switchPlan")
                      : t("lg.pricing.startFree")}
                {!busy && <ArrowUpRight aria-hidden="true" />}
              </button>
            </section>
          ))}
        </div>

        <section className="fl-pricing-features" aria-labelledby="features-title">
          <div>
            <span className="fl-public-eyebrow">GYMS.LIFE PREMIUM</span>
            <h2 id="features-title">{t("l3.pr.allFeatures")}</h2>
          </div>
          <ul>
            {featureKeys.map((key) => (
              <li key={key}>
                <Check aria-hidden="true" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </section>
        <p className="fl-pricing-payment-note">
          <ShieldCheck aria-hidden="true" />
          {t("lg.pricing.payNote")}
        </p>

        {billingEnabled && user && !accountUncertain && (access.subscribed || access.isOwner) && (
          <section
            className="fl-pricing-account"
            aria-label={lt ? "Tavo prenumerata" : "Your subscription"}
          >
            {access.isOwner ? (
              <h2>
                <Crown aria-hidden="true" />
                {t("lg.pricing.ownerAccount")}
              </h2>
            ) : (
              <>
                <div>
                  <h2>{t("lg.pricing.subActive")}</h2>
                  {access.cancelAtPeriodEnd && access.periodEnd && (
                    <p>
                      {cancelLabels.scheduled.replace(
                        "{date}",
                        access.periodEnd.toLocaleDateString(lang),
                      )}
                    </p>
                  )}
                </div>
                <div className="fl-pricing-account-actions">
                  <button type="button" disabled={busy} onClick={openPortal}>
                    {t("lg.pricing.manageSub")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={access.cancelAtPeriodEnd ? doResume : doCancel}
                  >
                    {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                    {access.cancelAtPeriodEnd ? cancelLabels.resume : cancelLabels.cancel}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        <TransformationCalculator />
        <div className="fl-pricing-context">
          <h2>{t("l3.pr.compare.t")}</h2>
          <p>{t("l3.pr.compare.d")}</p>
        </div>
      </div>
    </PublicFrame>
  );
}
