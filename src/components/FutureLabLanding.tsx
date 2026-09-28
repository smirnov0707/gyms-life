import { lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Activity,
  Fingerprint,
  FlaskConical,
  MessageCircle,
  ChevronDown,
  ShieldCheck,
  MoveUpRight,
  Dumbbell,
} from "lucide-react";
import { PublicFrame } from "./PublicFrame";
import { baseLang, useI18n } from "@/lib/i18n";
const LandingTwin = lazy(() => import("./LandingTwin"));

const copy = {
  en: {
    eyebrow: "HUMAN POTENTIAL, REIMAGINED",
    title: "A stronger you.",
    accent: "One day at a time.",
    intro:
      "Meet your personal Future Lab. A place to train with purpose, understand your body and make your next move count.",
    start: "Build my routine",
    explore: "Explore the experience",
    note: "Your goals. Your pace. Your next chapter.",
    preview: "EXPLORE YOUR DIGITAL TWIN",
    demo: "Interactive anatomy demo",
    loading: "Preparing your anatomy preview…",
    demoNote:
      "A shared body model, not a personal scan. Select a muscle group to explore. Personal measurements appear only when you add data.",
    worldsTag: "ONE CONNECTED EXPERIENCE",
    worldsTitle: "Less scattered. More you.",
    worldsIntro:
      "Your day, your body, your insights and your coach — connected around the work you actually do.",
    worlds: [
      {
        title: "Today",
        kicker: "FIND YOUR FOCUS",
        text: "Your next session, daily check-in and training context. A clear place to begin.",
        detail: "Plan · Train · Reflect",
      },
      {
        title: "My Twin",
        kicker: "SEE YOUR PROGRESS",
        text: "Explore muscle groups and the training you log. Keep your body measurements and progress together.",
        detail: "Body · Training load · Progress",
      },
      {
        title: "Lab",
        kicker: "ASK BETTER QUESTIONS",
        text: "Review observations and experiments. See what the evidence supports and what still needs more data.",
        detail: "Observations · Experiments · Evidence",
      },
      {
        title: "Coach",
        kicker: "MAKE YOUR NEXT MOVE",
        text: "Bring your goals and training history into the conversation. Get help turning a question into a next step.",
        detail: "Context · Conversation · Action",
      },
    ],
    routineTag: "BUILT AROUND REAL LIFE",
    routineTitle: "A small step today.\nA rhythm that lasts.",
    routineIntro:
      "Start where you are. Your routine becomes more useful as you record what happens.",
    steps: [
      {
        title: "Make it yours",
        text: "Choose your goal, experience, equipment and the time you have.",
      },
      {
        title: "Show up for your session",
        text: "Follow your plan, watch exercise technique and record your sets.",
      },
      {
        title: "Look back. Move forward.",
        text: "Review your history with your Twin and coach. Adjust your next step with context.",
      },
    ],
    libraryTag: "MOVE WITH INTENTION",
    libraryTitle: "Good technique.\nA better starting point.",
    libraryText:
      "Explore exercises by muscle group and equipment. Keep movement guidance close when you train.",
    libraryLink: "Open the exercise library",
    trustTitle: "Your progress deserves context.",
    trustText:
      "Missing data stays missing. Training estimates are labelled, and your Digital Twin is a guide to your records — not a diagnosis.",
    faqTag: "A LITTLE MORE CLARITY",
    faqTitle: "Before you begin.",
    faqs: [
      {
        q: "Is the Digital Twin a scan of my body?",
        a: "The preview uses a shared anatomical model. It does not measure your body. Inside the app, training records and measurements you add provide the context for your Twin.",
      },
      {
        q: "Can I explore before creating an account?",
        a: "Yes. Try the interactive anatomy preview and browse the exercise library. Create an account to build and save your own routine.",
      },
      {
        q: "Do I need a full gym?",
        a: "Set your available equipment during onboarding so your plan can reflect where you train.",
      },
      {
        q: "Where can I check access and pricing?",
        a: "The pricing page shows available access options and billing status. You can review it before creating an account.",
      },
    ],
    pricing: "View pricing",
    finalTag: "YOUR NEXT CHAPTER",
    finalTitle: "Make room for\na stronger tomorrow.",
    finalText: "Bring your intention. Start with one step.",
  },
  lt: {
    eyebrow: "NAUJAS ŽVILGSNIS Į TAVO GALIMYBES",
    title: "Stipresnis tu.",
    accent: "Diena po dienos.",
    intro:
      "Tavo asmeninė Future Lab erdvė. Treniruokis kryptingai, geriau pažink savo kūną ir atrask kitą prasmingą žingsnį.",
    start: "Sukurti savo rutiną",
    explore: "Atrasti galimybes",
    note: "Tavo tikslai. Tavo tempas. Tavo nauja pradžia.",
    preview: "PAŽINK SAVO SKAITMENINĮ DVYNĮ",
    demo: "Interaktyvi anatomijos demonstracija",
    loading: "Ruošiama anatomijos peržiūra…",
    demoNote:
      "Bendrinis kūno modelis, ne tavo skenavimas. Pasirink raumenų grupę ir apžiūrėk. Asmeniniai rodikliai atsiranda tik įvedus duomenis.",
    worldsTag: "VIENA SUSIETA PATIRTIS",
    worldsTitle: "Daugiau aiškumo. Daugiau tavęs.",
    worldsIntro: "Tavo diena, kūnas, įžvalgos ir treneris — susieti su tuo, ką iš tiesų darai.",
    worlds: [
      {
        title: "Šiandien",
        kicker: "ATRASK DIENOS KRYPTĮ",
        text: "Artimiausia treniruotė, dienos savijauta ir treniruočių kontekstas. Aiški vieta pradėti.",
        detail: "Planuok · Treniruokis · Apmąstyk",
      },
      {
        title: "Mano dvynys",
        kicker: "MATYK SAVO PROGRESĄ",
        text: "Apžiūrėk raumenų grupes ir registruotas treniruotes. Kūno rodikliai ir progresas vienoje vietoje.",
        detail: "Kūnas · Krūvis · Progresas",
      },
      {
        title: "Lab",
        kicker: "KELK TIKSLINGUS KLAUSIMUS",
        text: "Peržiūrėk pastebėjimus ir eksperimentus. Matyk, ką pagrindžia duomenys ir kam jų dar trūksta.",
        detail: "Pastebėjimai · Eksperimentai · Duomenys",
      },
      {
        title: "Treneris",
        kicker: "PASIRINK KITĄ ŽINGSNĮ",
        text: "Kalbėkis atsižvelgdamas į savo tikslus ir treniruočių istoriją. Paversk klausimą konkrečiu kitu žingsniu.",
        detail: "Kontekstas · Pokalbis · Veiksmas",
      },
    ],
    routineTag: "PRITAIKYTA TIKRAM GYVENIMUI",
    routineTitle: "Mažas žingsnis šiandien.\nIlgam išliekantis ritmas.",
    routineIntro:
      "Pradėk ten, kur esi. Registruojant treniruotes, tavo rutina įgauna daugiau konteksto.",
    steps: [
      {
        title: "Pradėk nuo savęs",
        text: "Pasirink tikslą, patirtį, turimą įrangą ir laiką, kurį gali skirti.",
      },
      {
        title: "Ateik į savo treniruotę",
        text: "Sek planą, peržiūrėk pratimų techniką ir registruok serijas.",
      },
      {
        title: "Įvertink. Judėk toliau.",
        text: "Peržiūrėk istoriją su dvyniu ir treneriu. Koreguok kitą žingsnį atsižvelgdamas į kontekstą.",
      },
    ],
    libraryTag: "JUDĖK KRYPTINGAI",
    libraryTitle: "Taisyklinga technika.\nTvirtesnė pradžia.",
    libraryText:
      "Atrask pratimus pagal raumenų grupes ir įrangą. Judesio instrukcijos visada šalia tavo treniruotės.",
    libraryLink: "Atverti pratimų biblioteką",
    trustTitle: "Tavo progresui reikia konteksto.",
    trustText:
      "Trūkstami duomenys lieka trūkstami. Treniruočių įverčiai pažymėti, o skaitmeninis dvynys padeda suprasti tavo įrašus — tai nėra diagnozė.",
    faqTag: "DAUGIAU AIŠKUMO",
    faqTitle: "Prieš pradedant.",
    faqs: [
      {
        q: "Ar skaitmeninis dvynys yra mano kūno skenavimas?",
        a: "Peržiūroje naudojamas bendrinis anatominis modelis. Jis nematuoja tavo kūno. Programoje dvynio kontekstą suteikia registruotos treniruotės ir tavo įvesti rodikliai.",
      },
      {
        q: "Ar galiu išbandyti prieš kurdamas paskyrą?",
        a: "Taip. Išbandyk interaktyvią anatomijos peržiūrą ir peržiūrėk pratimų biblioteką. Susikurk paskyrą, kad galėtum kurti ir išsaugoti savo rutiną.",
      },
      {
        q: "Ar būtina sporto salė?",
        a: "Pradėdamas nurodyk turimą įrangą, kad planas galėtų atitikti vietą, kurioje treniruojiesi.",
      },
      {
        q: "Kur patikrinti prieigą ir kainas?",
        a: "Kainodaros puslapyje pateikiamos prieigos galimybės ir mokėjimų būsena. Jį gali peržiūrėti dar prieš kurdamas paskyrą.",
      },
    ],
    pricing: "Peržiūrėti kainodarą",
    finalTag: "TAVO NAUJA PRADŽIA",
    finalTitle: "Atrask vietos\nstipresniam rytojui.",
    finalText: "Atsinešk norą. Pradėk nuo vieno žingsnio.",
  },
};
const icons = [Activity, Fingerprint, FlaskConical, MessageCircle];

export function FutureLabLanding() {
  const { lang } = useI18n();
  const c = copy[baseLang(lang)];
  return (
    <PublicFrame page="home">
      <div className="fl-landing">
        <section className="fl-landing-hero" aria-labelledby="landing-title">
          <div className="fl-landing-intro">
            <p className="fl-public-eyebrow">
              <span className="fl-landing-star" aria-hidden="true">
                ✳
              </span>
              {c.eyebrow}
            </p>
            <h1 id="landing-title">
              {c.title}
              <br />
              <span>{c.accent}</span>
            </h1>
            <p className="fl-landing-lead">{c.intro}</p>
            <div className="fl-landing-actions">
              <Link to="/auth" search={{ mode: "up" }} className="fl-landing-primary">
                {c.start}
                <ArrowUpRight aria-hidden="true" />
              </Link>
              <a href="#experience" className="fl-landing-secondary">
                {c.explore}
                <ArrowDown aria-hidden="true" />
              </a>
            </div>
            <p className="fl-landing-note">{c.note}</p>
          </div>
          <div className="fl-landing-preview" aria-label={c.demo}>
            <div className="fl-landing-preview-head">
              <Fingerprint aria-hidden="true" />
              <span>{c.preview}</span>
              <span aria-hidden="true">01 / 04</span>
            </div>
            <Suspense
              fallback={
                <p className="fl-landing-loading" role="status">
                  {c.loading}
                </p>
              }
            >
              <LandingTwin />
            </Suspense>
            <div className="fl-landing-demo">
              <strong>{c.demo}</strong>
              <p>{c.demoNote}</p>
            </div>
          </div>
        </section>
        <section id="experience" className="fl-landing-section" aria-labelledby="experience-title">
          <header className="fl-landing-section-head">
            <div>
              <p className="fl-public-eyebrow">{c.worldsTag}</p>
              <h2 id="experience-title">{c.worldsTitle}</h2>
            </div>
            <p>{c.worldsIntro}</p>
          </header>
          <div className="fl-landing-worlds">
            {c.worlds.map((world, index) => {
              const Icon = icons[index]!;
              return (
                <article key={world.title} className="fl-landing-world">
                  <div className="fl-landing-world-top">
                    <Icon aria-hidden="true" />
                    <span>0{index + 1}</span>
                  </div>
                  <p className="fl-landing-kicker">{world.kicker}</p>
                  <h3>{world.title}</h3>
                  <p>{world.text}</p>
                  <small>{world.detail}</small>
                </article>
              );
            })}
          </div>
        </section>
        <section className="fl-landing-routine fl-landing-section" aria-labelledby="routine-title">
          <div>
            <p className="fl-public-eyebrow">{c.routineTag}</p>
            <h2 id="routine-title">{c.routineTitle}</h2>
            <p>{c.routineIntro}</p>
            <Link to="/auth" search={{ mode: "up" }} className="fl-landing-secondary">
              {c.start}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <ol>
            {c.steps.map((step, index) => (
              <li key={step.title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="fl-landing-library" aria-labelledby="library-title">
          <div className="fl-landing-library-art" aria-hidden="true">
            <div>
              <Dumbbell />
              <span>GYMS.LIFE / MOVEMENT</span>
            </div>
            <span className="fl-landing-orbit" />
            <span className="fl-landing-orbit fl-landing-orbit-two" />
          </div>
          <div>
            <p className="fl-public-eyebrow">{c.libraryTag}</p>
            <h2 id="library-title">{c.libraryTitle}</h2>
            <p>{c.libraryText}</p>
            <Link to="/exercises" className="fl-landing-secondary">
              {c.libraryLink}
              <MoveUpRight aria-hidden="true" />
            </Link>
          </div>
        </section>
        <aside className="fl-landing-trust">
          <ShieldCheck aria-hidden="true" />
          <div>
            <h2>{c.trustTitle}</h2>
            <p>{c.trustText}</p>
          </div>
        </aside>
        <section className="fl-landing-faq fl-landing-section" aria-labelledby="faq-title">
          <div>
            <p className="fl-public-eyebrow">{c.faqTag}</p>
            <h2 id="faq-title">{c.faqTitle}</h2>
            <Link to="/pricing" className="fl-landing-secondary">
              {c.pricing}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <div>
            {c.faqs.map((faq) => (
              <details key={faq.q}>
                <summary>
                  {faq.q}
                  <ChevronDown aria-hidden="true" />
                </summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="fl-landing-final" aria-labelledby="final-title">
          <span className="fl-landing-star" aria-hidden="true">
            ✳
          </span>
          <p className="fl-public-eyebrow">{c.finalTag}</p>
          <h2 id="final-title">{c.finalTitle}</h2>
          <p>{c.finalText}</p>
          <Link to="/auth" search={{ mode: "up" }} className="fl-landing-primary">
            {c.start}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </section>
      </div>
    </PublicFrame>
  );
}
