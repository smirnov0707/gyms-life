/** Motivational lines shown on the landing page — a fresh one every visit. */
export const LANDING_QUOTES: { lt: string; en: string; by: { lt: string; en: string } }[] = [
  {
    lt: "Disciplina yra tiltas tarp tikslo ir rezultato.",
    en: "Discipline is the bridge between a goal and a result.",
    by: { lt: "Kasdienė taisyklė", en: "Daily rule" },
  },
  {
    lt: "Tu nepralaimi, kol nesustoji.",
    en: "You never lose until you stop.",
    by: { lt: "Treniruočių mąstysena", en: "Training mindset" },
  },
  {
    lt: "Kūnas pasiekia tai, kuo tiki protas.",
    en: "The body achieves what the mind believes.",
    by: { lt: "Pirmoji serija", en: "First set" },
  },
  {
    lt: "Vienas pakartojimas daugiau nei vakar — jau progresas.",
    en: "One rep more than yesterday is already progress.",
    by: { lt: "Progreso principas", en: "Progress principle" },
  },
  {
    lt: "Sunkiausias svoris — durų rankena į salę.",
    en: "The heaviest weight is the gym door handle.",
    by: { lt: "Pradžios taisyklė", en: "The starting rule" },
  },
  {
    lt: "Nuoseklumas nugali motyvaciją kiekvieną kartą.",
    en: "Consistency beats motivation every single time.",
    by: { lt: "Ilgo žaidimo taisyklė", en: "The long game" },
  },
  {
    lt: "Šiandienos prakaitas — rytojaus jėga.",
    en: "Today's sweat is tomorrow's strength.",
    by: { lt: "Treniruotės užrašas", en: "Training note" },
  },
  {
    lt: "Stiprus kūnas prasideda nuo tvirto sprendimo.",
    en: "A strong body starts with a firm decision.",
    by: { lt: "Pirmas žingsnis", en: "The first step" },
  },
  {
    lt: "Nesvarbu, kaip lėtai judi — vis tiek lenki tuos, kurie sėdi.",
    en: "No matter how slow you move, you still pass everyone sitting down.",
    by: { lt: "Kantrybės taisyklė", en: "Patience rule" },
  },
  {
    lt: "Kiekviena treniruotė — balsas už žmogų, kuriuo nori tapti.",
    en: "Every session is a vote for the person you want to become.",
    by: { lt: "Įpročio principas", en: "Habit principle" },
  },
  {
    lt: "Skausmas praeina. Gailėjimasis lieka.",
    en: "The burn fades. Regret stays.",
    by: { lt: "Paskutinis pakartojimas", en: "Last rep" },
  },
  {
    lt: "Dirbk tyliai — tegul rezultatai kalba garsiai.",
    en: "Work in silence, let the results speak loud.",
    by: { lt: "Salės kodeksas", en: "Gym code" },
  },
];

/** Picks a different quote than the previous visit. */
export function nextQuoteIndex(): number {
  if (typeof window === "undefined") return 0;
  const key = "forma.quote.i";
  const prev = Number(window.localStorage.getItem(key) ?? "-1");
  let next = Math.floor(Math.random() * LANDING_QUOTES.length);
  if (next === prev) next = (next + 1) % LANDING_QUOTES.length;
  window.localStorage.setItem(key, String(next));
  return next;
}
