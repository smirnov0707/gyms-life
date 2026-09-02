import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/AppShell";
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Logo />
          <Link to="/pricing" className="text-sm font-semibold text-primary">
            {t("lg.nav.pricing")}
          </Link>
        </div>
      </header>
      <main className="prose-sm mx-auto max-w-3xl px-4 py-12 text-sm leading-relaxed">
        <h1 className="text-display text-4xl">{t("lg.privacy.title")}</h1>
        <p className="text-muted-foreground">{t("lg.privacy.updated")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.privacy.h1")}</h2>
        <p>{t("lg.privacy.p1")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.privacy.h2")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("lg.privacy.li2a")}</li>
          <li>{t("lg.privacy.li2b")}</li>
          <li>{t("lg.privacy.li2c")}</li>
          <li>{t("lg.privacy.li2d")}</li>
        </ul>

        <h2 className="mt-8 text-lg font-bold">{t("lg.privacy.h3")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("lg.privacy.li3a")}</li>
          <li>{t("lg.privacy.li3b")}</li>
          <li>{t("lg.privacy.li3c")}</li>
          <li>{t("lg.privacy.li3d")}</li>
          <li>{t("lg.privacy.li3e")}</li>
        </ul>

        <h2 className="mt-8 text-lg font-bold">{t("lg.privacy.h4")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("lg.privacy.li4a")}</li>
          <li>{t("lg.privacy.li4b")}</li>
          <li>{t("lg.privacy.li4c")}</li>
          <li>{t("lg.privacy.li4d")}</li>
        </ul>

        <h2 className="mt-8 text-lg font-bold">{t("lg.privacy.h5")}</h2>
        <p>{t("lg.privacy.p5")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.privacy.h6")}</h2>
        <p>{t("lg.privacy.p6")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.privacy.h7")}</h2>
        <p>{t("lg.privacy.p7")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.privacy.h8")}</h2>
        <p>{t("lg.privacy.p8")}</p>

        <h2 className="mt-8 text-lg font-bold">{t("lg.privacy.h9")}</h2>
        <p>{t("lg.privacy.p9")}</p>
      </main>
    </div>
  );
}
