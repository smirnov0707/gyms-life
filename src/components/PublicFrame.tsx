import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowLeft, FileText } from "lucide-react";
import { Logo, LangSwitch } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { baseLang, useI18n } from "@/lib/i18n";

type PublicPage = "pricing" | "privacy" | "terms" | "refund";

export function PublicFrame({
  children,
  page,
  signedIn = false,
}: {
  children: ReactNode;
  page: PublicPage;
  signedIn?: boolean;
}) {
  const { t, lang } = useI18n();
  const lt = baseLang(lang) === "lt";
  const links = [
    { page: "pricing", title: t("lg.nav.pricing") },
    { page: "privacy", title: t("lg.pricing.privacy") },
    { page: "terms", title: t("lg.pricing.terms") },
    { page: "refund", title: t("lg.pricing.refunds") },
  ] as const;
  return (
    <div className="fl-public">
      <a className="fl-public-skip" href="#public-content">
        {lt ? "Pereiti prie turinio" : "Skip to content"}
      </a>
      <header className="fl-public-header">
        <Logo href="/" />
        <div className="fl-public-preferences">
          <LangSwitch />
          <ThemeToggle />
        </div>
        <Link className="fl-public-entry" to={signedIn ? "/app" : "/auth"}>
          {signedIn ? t("lg.pricing.myApp") : t("lg.pricing.signIn")}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </header>
      <main id="public-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="fl-public-footer">
        <div>
          <strong>
            GYMS.LIFE <span>/</span> FUTURE LAB
          </strong>
          <p>{lt ? "Tavo ritmas. Tavo progresas." : "Your rhythm. Your progress."}</p>
        </div>
        <nav aria-label={lt ? "Informacija" : "Information"}>
          {links.map((item) => (
            <Link
              key={item.page}
              to={`/${item.page}`}
              aria-current={page === item.page ? "page" : undefined}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}

export function LegalFrame({
  page,
  title,
  updated,
  headings,
  children,
}: {
  page: Exclude<PublicPage, "pricing">;
  title: string;
  updated: string;
  headings: string[];
  children: ReactNode;
}) {
  const { t, lang } = useI18n();
  const lt = baseLang(lang) === "lt";
  return (
    <PublicFrame page={page}>
      <div className="fl-legal">
        <Link to="/pricing" className="fl-public-back">
          <ArrowLeft aria-hidden="true" />
          {t("lg.nav.pricing")}
        </Link>
        <header className="fl-public-heading">
          <span className="fl-public-eyebrow">
            <FileText aria-hidden="true" />
            {lt ? "GYMS.LIFE INFORMACIJA" : "GYMS.LIFE INFORMATION"}
          </span>
          <h1>{title}</h1>
          <p>{updated}</p>
        </header>
        <div className="fl-legal-layout">
          <nav className="fl-legal-contents" aria-label={lt ? "Šiame puslapyje" : "On this page"}>
            <h2>{lt ? "Šiame puslapyje" : "On this page"}</h2>
            {headings.map((heading, index) => (
              <a key={heading} href={`#section-${index + 1}`}>
                {heading}
              </a>
            ))}
          </nav>
          <article className="fl-legal-article" aria-label={title}>
            {children}
          </article>
        </div>
      </div>
    </PublicFrame>
  );
}
