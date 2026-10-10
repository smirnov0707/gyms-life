import { useState, type ComponentProps, type ReactNode } from "react";
import { Activity, Orbit, FlaskConical, MessageCircle, Eye, EyeOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Logo, LangSwitch } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "./ui/input";
import { baseLang, useI18n } from "@/lib/i18n";

export function AuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { lang, t } = useI18n();
  const lt = baseLang(lang) === "lt";
  const worlds = [
    {
      icon: Activity,
      title: lt ? "Šiandien" : "Today",
    },
    {
      icon: Orbit,
      title: lt ? "Mano dvynys" : "My Twin",
    },
    {
      icon: FlaskConical,
      title: "Lab",
    },
    {
      icon: MessageCircle,
      title: lt ? "Treneris" : "Coach",
    },
  ];
  return (
    <div className="fl-auth fl-auth-signature">
      <header className="fl-auth-header">
        <Logo href="/" />
        <div className="fl-auth-preferences">
          <LangSwitch />
          <ThemeToggle />
        </div>
      </header>
      <main className="fl-auth-layout" id="auth-content">
        <section className="fl-auth-story" aria-label={lt ? "Tavo Future Lab" : "Your Future Lab"}>
          <div className="fl-auth-eyebrow">
            <span /> {lt ? "TAVO ASMENINĖ FUTURE LAB" : "YOUR PERSONAL FUTURE LAB"}
          </div>
          <p className="fl-auth-statement">
            {lt ? "Tavo kitas" : "Your next"}
            <br />
            <span>{lt ? "lygis." : "level."}</span>
          </p>
          <p className="fl-auth-story-copy">
            {lt
              ? "Treniruokis. Pažink savo kūną. Judėk pirmyn."
              : "Train. Understand your body. Move forward."}
          </p>
          <div className="fl-auth-art" aria-hidden="true">
            <img src="/images/athletic-motion-v1.webp" alt="" width="1536" height="1024" />
          </div>
          <div className="fl-auth-worlds">
            {worlds.map(({ icon: Icon, title: world }) => (
              <div key={world}>
                <Icon aria-hidden="true" />
                <span>
                  <strong>{world}</strong>
                </span>
              </div>
            ))}
          </div>
          <p className="fl-auth-story-footer">
            {lt ? "Tavo ritmas. Tavo progresas." : "Your rhythm. Your progress."}
          </p>
        </section>
        <section className="fl-auth-card" aria-labelledby="auth-title">
          <div className="fl-auth-card-heading">
            <span className="fl-auth-eyebrow">{lt ? "PRADĖK NUO SAVĘS" : "START WITH YOU"}</span>
            <h1 id="auth-title">{title}</h1>
            <p>{description}</p>
          </div>
          {children}
          <Link to="/" className="fl-auth-home">
            {t("rt.backToHome")}
          </Link>
        </section>
      </main>
      <footer className="fl-auth-footer">
        <span>
          GYMS.LIFE <span> / </span> FUTURE LAB
        </span>
        <span>{lt ? "Erdvė tavo progresui." : "Space for your progress."}</span>
      </footer>
    </div>
  );
}

export function PasswordInput(props: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  const { lang } = useI18n();
  const label =
    baseLang(lang) === "lt"
      ? visible
        ? "Slėpti slaptažodį"
        : "Rodyti slaptažodį"
      : visible
        ? "Hide password"
        : "Show password";
  return (
    <div className="fl-auth-password">
      <Input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        aria-label={label}
        aria-controls={props.id}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  );
}
