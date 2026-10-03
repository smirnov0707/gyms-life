import "./brand.css";
import React, { useId } from "react";
import { Link } from "@tanstack/react-router";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";

export const Logo: React.FC<{ className?: string; href?: string }> = ({
  className = "",
  href = "/app",
}) => {
  const gradientId = useId();
  return (
    <Link to={href} className={`fl-brand ${className}`} aria-label="GYMS.LIFE Future Lab">
      <svg className="fl-brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <defs>
          <linearGradient
            id={gradientId}
            x1="5"
            y1="4"
            x2="34"
            y2="36"
            gradientUnits="userSpaceOnUse"
          >
            {/* Volt into ice: the action colour running into the measured one,
                which is the product in two stops. The values are custom
                properties rather than literals because the mark also has to
                read on paper — `brand.css` gives the light theme a darker pair,
                and a literal volt on white is the accent-that-only-reads-on-
                onyx mistake in the one place every page renders. */}
            <stop stopColor="var(--fl-brand-a)" />
            <stop offset=".56" stopColor="var(--fl-brand-b)" />
            <stop offset="1" stopColor="var(--fl-brand-c)" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="9" className="fl-brand-mark-frame" />
        <path
          d="M27 10H15L9 16V28L14 32H27L32 27V19H22V23H27V26L25 28H16L13 25V18L17 14H25L28 17L31 14L27 10Z"
          fill={`url(#${gradientId})`}
        />
        <path d="M19 19H16V24H19V19Z" fill="var(--fl-brand-d)" fillOpacity=".85" />
      </svg>
      <span className="fl-brand-wordmark">
        <span>GYMS.LIFE</span>
        <small>FUTURE LAB</small>
      </span>
    </Link>
  );
};

export const LangSwitch: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { lang, setLang } = useI18n();
  const languages = [
    { code: "lt", label: "LT" },
    { code: "en", label: "EN" },
  ] satisfies ReadonlyArray<{ code: Lang; label: string }>;
  return (
    <div
      className={`fl-language-switch ${className}`}
      role="group"
      aria-label={baseLang(lang) === "en" ? "Language" : "Kalba"}
    >
      {languages.map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => setLang(item.code)}
          aria-pressed={lang === item.code}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
