import { createFileRoute } from "@tanstack/react-router";
import { LegalFrame } from "@/components/PublicFrame";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Naudojimo sąlygos — GYMS.LIFE" },
      {
        name: "description",
        content: "GYMS.LIFE paslaugos naudojimo sąlygos. Pardavėjas: Aleksandr Smirnov.",
      },
      { property: "og:title", content: "Naudojimo sąlygos — GYMS.LIFE" },
      { property: "og:description", content: "GYMS.LIFE paslaugos naudojimo sąlygos." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useI18n();
  return (
    <LegalFrame
      page="terms"
      title={t("lg.terms.title")}
      updated={t("lg.terms.updated")}
      headings={[
        t("lg.terms.h1"),
        t("lg.terms.h2"),
        t("lg.terms.h3"),
        t("lg.terms.h4"),
        t("lg.terms.h5"),
        t("lg.terms.h6"),
        t("lg.terms.h7"),
        t("lg.terms.h8"),
        t("lg.terms.h9"),
      ]}
    >
      <h2 id="section-1">{t("lg.terms.h1")}</h2>
      <p>{t("lg.terms.p1")}</p>

      <h2 id="section-2">{t("lg.terms.h2")}</h2>
      <p>{t("lg.terms.p2")}</p>

      <h2 id="section-3">{t("lg.terms.h3")}</h2>
      <p>{t("lg.terms.p3")}</p>

      <h2 id="section-4">{t("lg.terms.h4")}</h2>
      <p>
        {t("lg.terms.p4a")}{" "}
        <a
          className="text-primary underline"
          href="https://www.paddle.com/legal/checkout-buyer-terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("lg.terms.p4link")}
        </a>
        . {t("lg.terms.p4b")}
      </p>

      <h2 id="section-5">{t("lg.terms.h5")}</h2>
      <p>{t("lg.terms.p5")}</p>

      <h2 id="section-6">{t("lg.terms.h6")}</h2>
      <p>{t("lg.terms.p6")}</p>

      <h2 id="section-7">{t("lg.terms.h7")}</h2>
      <p>{t("lg.terms.p7")}</p>

      <h2 id="section-8">{t("lg.terms.h8")}</h2>
      <p>{t("lg.terms.p8")}</p>

      <h2 id="section-9">{t("lg.terms.h9")}</h2>
      <p>{t("lg.terms.p9")}</p>
    </LegalFrame>
  );
}
