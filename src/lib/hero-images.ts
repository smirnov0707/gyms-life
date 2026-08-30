import hero1 from "@/assets/hero-gym.jpg";
import hero2 from "@/assets/hero-gym-2.jpg";
import hero3 from "@/assets/hero-gym-3.jpg";
import hero4 from "@/assets/hero-gym-4.jpg";

// The first four are dedicated hero photography. The additional locally hosted
// training visuals keep the landing page dynamic without introducing a remote
// image dependency or tracking pixel.
export const HERO_IMAGES = [
  hero1,
  hero2,
  hero3,
  hero4,
  "/assets/ai/ex-barbell-shoulders.jpg",
  "/assets/ai/ex-dumbbell-chest.jpg",
  "/assets/ai/ex-machine-back.jpg",
  "/assets/ai/ex-cardio.jpg",
] as const;

export const HERO_ALTS = [
  "Sportininkas kelia štangą tamsioje sporto salėje",
  "Sportininkas su štanga prabangioje naktinėje salėje",
  "Moteris atlieka girios mostą šviesos apšviestoje erdvėje",
  "Bėgikas ant bėgtakio auksinėje šviesoje",
  "Pečių treniruotė su štanga",
  "Krūtinės treniruotė su hanteliais",
  "Nugaros treniruotė treniruoklyje",
  "Intensyvi kardio treniruotė",
] as const;

export const HERO_ALTS_EN = [
  "Athlete lifting a barbell in a dark gym",
  "Athlete with a barbell in a premium night-lit gym",
  "Woman performing a kettlebell swing in a bright studio",
  "Runner on a treadmill in golden light",
  "Barbell shoulder training",
  "Dumbbell chest training",
  "Back training on a machine",
  "High-intensity cardio training",
] as const;

export function heroAlt(index: number, lang: string): string {
  const i = index % HERO_ALTS.length;
  return lang === "lt" ? HERO_ALTS[i]! : HERO_ALTS_EN[i]!;
}

export function nextHeroIndex(): number {
  if (typeof window === "undefined") return 0;
  try {
    const key = "gymslife:hero-i";
    const prev = Number(window.localStorage.getItem(key) ?? "-1");
    const next = (Number.isFinite(prev) ? prev + 1 : 0) % HERO_IMAGES.length;
    window.localStorage.setItem(key, String(next));
    return next;
  } catch {
    return Math.floor(Math.random() * HERO_IMAGES.length);
  }
}
