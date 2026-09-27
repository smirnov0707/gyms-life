import { createFileRoute } from "@tanstack/react-router";
import { LegalFrame } from "@/components/PublicFrame";
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
    <LegalFrame
      page="refund"
      title={t("lg.refund.title")}
      updated={t("lg.refund.updated")}
      headings={[t("lg.refund.h1"), t("lg.refund.h2"), t("lg.refund.h3")]}
    >
      <h2 id="section-1">{t("lg.refund.h1")}</h2>
      <p>{t("lg.refund.p1")}</p>

      <h2 id="section-2">{t("lg.refund.h2")}</h2>
      <p>
        {t("lg.refund.p2a")}{" "}
        <a
          className="text-primary underline"
          href="https://paddle.net"
          target="_blank"
          rel="noopener noreferrer"
        >
          paddle.net
        </a>{" "}
        {t("lg.refund.p2b")}
      </p>

      <h2 id="section-3">{t("lg.refund.h3")}</h2>
      <p>
        {t("lg.refund.p3a")}{" "}
        <a
          className="text-primary underline"
          href="https://www.paddle.com/legal/refund-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("lg.refund.p3link")}
        </a>
        .
      </p>
    </LegalFrame>
  );
}
