import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Pinigų grąžinimo politika — GYMS.LIFE" },
      { name: "description", content: "GYMS.LIFE 30 dienų pinigų grąžinimo garantija." },
      { property: "og:title", content: "Pinigų grąžinimo politika — GYMS.LIFE" },
      { property: "og:description", content: "30 dienų pinigų grąžinimo garantija." },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
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
        <h1 className="text-display text-4xl">{t("lg.refund.title")}</h1>
        <p className="text-muted-foreground">{t("lg.refund.updated")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.refund.h1")}</h2>
        <p>{t("lg.refund.p1")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.refund.h2")}</h2>
        <p>
          {t("lg.refund.p2a")}{" "}
          <a className="text-primary underline" href="https://paddle.net" target="_blank" rel="noopener noreferrer">
            paddle.net
          </a>{" "}
          {t("lg.refund.p2b")}
        </p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.refund.h3")}</h2>
        <p>
          {t("lg.refund.p3a")}{" "}
          <a className="text-primary underline" href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer">
            {t("lg.refund.p3link")}
          </a>
          .
        </p>
      </main>
    </div>
  );
}
