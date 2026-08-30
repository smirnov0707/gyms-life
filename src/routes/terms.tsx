import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/AppShell";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Naudojimo sąlygos — GYMS.LIFE" },
      { name: "description", content: "GYMS.LIFE paslaugos naudojimo sąlygos. Pardavėjas: Aleksandr Smirnov." },
      { property: "og:title", content: "Naudojimo sąlygos — GYMS.LIFE" },
      { property: "og:description", content: "GYMS.LIFE paslaugos naudojimo sąlygos." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Logo />
          <Link to="/pricing" className="text-sm font-semibold text-primary">{t("lg.nav.pricing")}</Link>
        </div>
      </header>
      <main className="prose-sm mx-auto max-w-3xl px-4 py-12 text-sm leading-relaxed">
        <h1 className="text-display text-4xl">{t("lg.terms.title")}</h1>
        <p className="text-muted-foreground">{t("lg.terms.updated")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.terms.h1")}</h2>
        <p>{t("lg.terms.p1")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.terms.h2")}</h2>
        <p>{t("lg.terms.p2")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.terms.h3")}</h2>
        <p>{t("lg.terms.p3")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.terms.h4")}</h2>
        <p>
          {t("lg.terms.p4a")}{" "}
          <a className="text-primary underline" href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
            {t("lg.terms.p4link")}
          </a>
          . {t("lg.terms.p4b")}
        </p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.terms.h5")}</h2>
        <p>{t("lg.terms.p5")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.terms.h6")}</h2>
        <p>{t("lg.terms.p6")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.terms.h7")}</h2>
        <p>{t("lg.terms.p7")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.terms.h8")}</h2>
        <p>{t("lg.terms.p8")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.terms.h9")}</h2>
        <p>{t("lg.terms.p9")}</p>
      </main>
    </div>
  );
}
