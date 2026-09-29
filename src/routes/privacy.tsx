import { createFileRoute } from "@tanstack/react-router";
import { LegalFrame } from "@/components/PublicFrame";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privatumo politika — GYMS.LIFE" },
      {
        name: "description",
        content: "GYMS.LIFE privatumo politika. Duomenų valdytojas: Aleksandr Smirnov.",
      },
      { property: "og:title", content: "Privatumo politika — GYMS.LIFE" },
      { property: "og:description", content: "Kaip GYMS.LIFE tvarko jūsų asmens duomenis." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useI18n();
  return (
    <LegalFrame
      page="privacy"
      title={t("lg.privacy.title")}
      updated={t("lg.privacy.updated")}
      headings={[
        t("lg.privacy.h1"),
        t("lg.privacy.h2"),
        t("lg.privacy.h3"),
        t("lg.privacy.h4"),
        t("lg.privacy.h5"),
        t("lg.privacy.h6"),
        t("lg.privacy.h7"),
        t("lg.privacy.h8"),
        t("lg.privacy.h9"),
      ]}
    >
      <h2 id="section-1">{t("lg.privacy.h1")}</h2>
      <p>{t("lg.privacy.p1")}</p>

      <h2 id="section-2">{t("lg.privacy.h2")}</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>{t("lg.privacy.li2a")}</li>
        <li>{t("lg.privacy.li2b")}</li>
        <li>{t("lg.privacy.li2c")}</li>
        <li>{t("lg.privacy.li2d")}</li>
        <li>{t("lg.privacy.li2e")}</li>
      </ul>

      <h2 id="section-3">{t("lg.privacy.h3")}</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>{t("lg.privacy.li3a")}</li>
        <li>{t("lg.privacy.li3b")}</li>
        <li>{t("lg.privacy.li3c")}</li>
        <li>{t("lg.privacy.li3d")}</li>
        <li>{t("lg.privacy.li3e")}</li>
      </ul>

      <h2 id="section-4">{t("lg.privacy.h4")}</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>{t("lg.privacy.li4a")}</li>
        <li>{t("lg.privacy.li4b")}</li>
        <li>{t("lg.privacy.li4c")}</li>
        <li>{t("lg.privacy.li4d")}</li>
        <li>{t("lg.privacy.li4e")}</li>
      </ul>

      <h2 id="section-5">{t("lg.privacy.h5")}</h2>
      <p>{t("lg.privacy.p5")}</p>

      <h2 id="section-6">{t("lg.privacy.h6")}</h2>
      <p>{t("lg.privacy.p6")}</p>

      <h2 id="section-7">{t("lg.privacy.h7")}</h2>
      <p>{t("lg.privacy.p7")}</p>

      <h2 id="section-8">{t("lg.privacy.h8")}</h2>
      <p>{t("lg.privacy.p8")}</p>

      <h2 id="section-9">{t("lg.privacy.h9")}</h2>
      <p>{t("lg.privacy.p9")}</p>
    </LegalFrame>
  );
}
