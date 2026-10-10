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
} from "lucide-react";
import { PublicFrame } from "./PublicFrame";
import { baseLang, useI18n } from "@/lib/i18n";
import "./future-lab/signature-design.css";
const LandingTwin = lazy(() => import("./LandingTwin"));

/**
 * Exported so the route's `head()` can build the share card from the same
 * strings the page renders.
 *
 * AGENTS.md: what a surface promises before you reach it is checked nowhere.
 * The hero was rewritten to say 175 exercises, sets that survive a dead signal
 * and free-while-in-beta; the `og:title` and `og:description` kept saying "Your
 * personal Future Lab · Your training. Your Digital Twin. Your next step." —
 * the abstract line the page itself no longer makes. A shared link, a search
 * result and a chat preview all carried the old claim, and nothing in the build
 * compared the two.
 */
export const copy = {
  en: {
    eyebrow: "BUILT AROUND YOU",
    title: "Your next",
    accent: "level.",
    intro:
      "Training, your Digital Twin and a coach with context. 175 exercises. One connected experience. Free in beta.",
    start: "Build my routine",
    explore: "Explore the experience",
    note: "Free during beta · No subscription",
    twinTitle: "See the work.\nKnow your body.",
    twinText: "Your training has a shape. Explore it, muscle by muscle.",
    twinLink: "Try your Twin",
    movementLabel: "Exercises. Real technique.",
    preview: "EXPLORE YOUR DIGITAL TWIN",
    demo: "Interactive anatomy demo",
    loading: "Preparing your anatomy preview…",
    demoNote:
      "A shared body model, not a personal scan. Select a muscle group to explore. Personal measurements appear only when you add data.",
    worldsTag: "ONE CONNECTED EXPERIENCE",
    worldsTitle: "One system.\nYour whole rhythm.",
    worldsIntro:
      "Your day, your body, your insights and your coach — connected around the work you actually do.",
    worlds: [
      {
        title: "Today",
        kicker: "FIND YOUR FOCUS",
        text: "One clear next step. Your session is ready when you are.",
        detail: "Plan · Train · Reflect",
      },
      {
        title: "My Twin",
        kicker: "SEE YOUR PROGRESS",
        text: "See where you trained. Keep your measurements and progress together.",
        detail: "Body · Training load · Progress",
      },
      {
        title: "Lab",
        kicker: "SEE WHAT HELD UP",
        text: "Suggestions meet results. See what held up and what is still unknown.",
        detail: "Proposed · Outcome · Still unknown",
      },
      {
        title: "Coach",
        kicker: "ASK WITH CONTEXT",
        text: "A conversation with your goals and training history already in context.",
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
      "175 exercises by muscle group and equipment, each with step-by-step technique, the mistakes people actually make, and a motion demonstration — video for the main lifts, frame sequences for the rest.",
    libraryLink: "Open the exercise library",
    trustTitle: "Your progress deserves context.",
    trustText:
      "Missing data stays missing — no filled-in weight, height or age behind a number you read as your own. Estimates are labelled as estimates. Photos you submit for analysis go to an AI provider, and the screen says so before you press the button. Your Twin is a reading of your records, not a diagnosis.",
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
        a: "Payments are not switched on yet: every feature is available without a subscription while GYMS.LIFE is in beta. The pricing page shows the plans being prepared and says the same thing.",
      },
      {
        q: "Can I delete my account and everything in it?",
        a: "Yes, from your profile, and it is immediate rather than a request someone processes. It erases your sessions, sets, measurements, nutrition logs, check-ins, plans and photo sets. Payment records held by our reseller stay, because statute requires it, and technical event logs keep no identifier of yours.",
      },
      {
        q: "What does the app not know about me?",
        a: "Whatever you have not told it. There is no nightly model learning your body in the background yet — the Lab shows what was proposed and what happened, and says plainly where there is too little evidence to judge.",
      },
    ],
    pricing: "View pricing",
    finalTag: "YOUR NEXT CHAPTER",
    finalTitle: "The next move\nis yours.",
    finalText: "Start with today.",
  },
  lt: {
    eyebrow: "SUKURTA APLINK TAVE",
    title: "Tavo kitas",
    accent: "lygis.",
    intro:
      "Treniruotės, skaitmeninis dvynys ir treneris vienoje vietoje. 175 pratimai. Tavo ritmu. Beta etape nemokamai.",
    start: "Sukurti savo rutiną",
    explore: "Atrasti galimybes",
    note: "Beta etape nemokamai · Be prenumeratos",
    twinTitle: "Matyk savo darbą.\nPažink savo kūną.",
    twinText: "Tavo treniruotės turi formą. Atrask ją, raumuo po raumens.",
    twinLink: "Išbandyti dvynį",
    movementLabel: "Pratimai. Taisyklinga technika.",
    preview: "PAŽINK SAVO SKAITMENINĮ DVYNĮ",
    demo: "Interaktyvi anatomijos demonstracija",
    loading: "Ruošiama anatomijos peržiūra…",
    demoNote:
      "Bendrinis kūno modelis, ne tavo skenavimas. Pasirink raumenų grupę ir apžiūrėk. Asmeniniai rodikliai atsiranda tik įvedus duomenis.",
    worldsTag: "VIENA SUSIETA PATIRTIS",
    worldsTitle: "Viena sistema.\nVisas tavo ritmas.",
    worldsIntro: "Tavo diena, kūnas, įžvalgos ir treneris — susieti su tuo, ką iš tiesų darai.",
    worlds: [
      {
        title: "Šiandien",
        kicker: "ATRASK DIENOS KRYPTĮ",
        text: "Vienas aiškus kitas žingsnis. Treniruotė laukia tavęs.",
        detail: "Planuok · Treniruokis · Apmąstyk",
      },
      {
        title: "Mano dvynys",
        kicker: "MATYK SAVO PROGRESĄ",
        text: "Matyk, ką treniravai. Kūno rodikliai ir progresas vienoje vietoje.",
        detail: "Kūnas · Krūvis · Progresas",
      },
      {
        title: "Lab",
        kicker: "MATYK, KAS PASITVIRTINO",
        text: "Pasiūlymai susitinka su rezultatais. Matyk, kas pasitvirtino, o kas dar nežinoma.",
        detail: "Pasiūlyta · Rezultatas · Dar nežinoma",
      },
      {
        title: "Treneris",
        kicker: "KLAUSK SU KONTEKSTU",
        text: "Pokalbis, kuriame tavo tikslai ir treniruočių istorija jau turi vietą.",
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
      "175 pratimai pagal raumenų grupes ir įrangą, kiekvienas su technika žingsnis po žingsnio, dažniausiomis klaidomis ir judesio demonstracija — pagrindiniams pratimams vaizdo įrašas, likusiems judesio kadrai.",
    libraryLink: "Atverti pratimų biblioteką",
    trustTitle: "Tavo progresui reikia konteksto.",
    trustText:
      "Trūkstami duomenys lieka trūkstami — joks svoris, ūgis ar amžius nėra užpildomas už tave, kad paskui skaitytum tai kaip savo. Įverčiai pažymėti kaip įverčiai. Nuotraukos, kurias pateiki analizei, keliauja dirbtinio intelekto paslaugos teikėjui, ir ekranas tai pasako prieš paspaudimą. Dvynys yra tavo įrašų skaitymas, ne diagnozė.",
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
        a: "Mokėjimai dar neįjungti: beta etape visos funkcijos prieinamos be prenumeratos. Kainodaros puslapyje matomi ruošiami planai ir pasakyta tas pats.",
      },
      {
        q: "Ar galiu ištrinti paskyrą ir visus duomenis?",
        a: "Taip, savo profilyje, ir tai įvyksta iškart, o ne kaip prašymas, kurį kas nors tvarko. Ištrinamos treniruotės, serijos, matavimai, mitybos žurnalai, savijautos įvestys, planai ir nuotraukų rinkiniai. Lieka tik mokėjimų įrašai, kuriuos saugo mūsų pardavėjas, nes to reikalauja įstatymas, o techniniuose veiklos įrašuose tavo identifikatoriaus nebelieka.",
      },
      {
        q: "Ko programa apie mane nežino?",
        a: "Visko, ko jai nepasakei. Kol kas nėra nakties modelio, kuris fone mokytųsi tavo kūno — Lab parodo, kas buvo pasiūlyta ir kas nutiko, ir tiesiai pasako, kur duomenų per mažai, kad būtų galima spręsti.",
      },
    ],
    pricing: "Peržiūrėti kainodarą",
    finalTag: "TAVO NAUJA PRADŽIA",
    finalTitle: "Kitas žingsnis —\ntavo.",
    finalText: "Pradėk nuo šiandien.",
  },
};
const icons = [Activity, Fingerprint, FlaskConical, MessageCircle];

export function FutureLabLanding() {
  const { lang } = useI18n();
  const c = copy[baseLang(lang)];
  return (
    <PublicFrame page="home">
      <div className="fl-landing fl-landing--signature">
        <section className="fl-landing-hero" aria-labelledby="landing-title">
          <img
            className="fl-landing-hero-art"
            src="/images/athletic-motion-v1.webp"
            alt=""
            aria-hidden="true"
            width={1536}
            height={1024}
            fetchPriority="high"
          />
          <div className="fl-landing-intro">
            <p className="fl-public-eyebrow">
              <span className="fl-signature-line" aria-hidden="true" />
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
          <a className="fl-landing-twin-link" href="#digital-twin">
            <Fingerprint aria-hidden="true" />
            {c.twinLink}
            <ArrowUpRight aria-hidden="true" />
          </a>
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
                  <h3>{world.title}</h3>
                  <p>{world.text}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section
          id="digital-twin"
          className="fl-landing-twin-feature fl-landing-section"
          aria-labelledby="twin-feature-title"
        >
          <div className="fl-landing-twin-copy">
            <p className="fl-public-eyebrow">DIGITAL TWIN</p>
            <h2 id="twin-feature-title">{c.twinTitle}</h2>
            <p>{c.twinText}</p>
            <span className="fl-twin-feature-index" aria-hidden="true">
              02
            </span>
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
              <strong>175</strong>
              <span>{c.movementLabel}</span>
            </div>
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
