import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { extra_legal } from "./i18n-extra-legal";
import { extra_tools } from "./i18n-extra-tools";
import { extra_scan } from "./i18n-extra-scan";
import { extra_misc } from "./i18n-extra-misc";
import { extra_routes } from "./i18n-extra-routes";
import { extra_nat1 } from "./i18n-extra-nat1";
import { extra_nat2 } from "./i18n-extra-nat2";
import { extra_nat3 } from "./i18n-extra-nat3";
import { extra_nextgen } from "./i18n-extra-nextgen";
import { extra_live } from "./i18n-extra-live";
import { extra_health2 } from "./i18n-extra-health2";
import { extra_supp_ai } from "./i18n-extra-supp-ai";
import { extra_supp_scan } from "./i18n-extra-supp-scan";
import { extra_brief } from "./i18n-extra-brief";
import { extra_coachsession } from "./i18n-extra-coachsession";
import { extra_overview } from "./i18n-extra-overview";
import { extra_landing2 } from "./i18n-extra-landing2";
import { extra_landing3 } from "./i18n-extra-landing3";
import { extra_scan2 } from "./i18n-extra-scan2";
import { parseSupportedLanguage, type SupportedLanguage } from "./language.schema";

export type Lang = SupportedLanguage;

type Dict = Record<string, { lt: string; en: string }>;
type SupplementalLanguage = Exclude<Lang, "lt" | "en">;
type SupplementalLocale = Record<string, string>;
type SupplementalLocales = Partial<Record<SupplementalLanguage, SupplementalLocale>>;

const supplementalLocaleLoaders: Record<SupplementalLanguage, () => Promise<SupplementalLocale>> = {
  ru: () => import("./i18n-locales/ru").then(({ locale }) => locale),
  uk: () => import("./i18n-locales/uk").then(({ locale }) => locale),
  pl: () => import("./i18n-locales/pl").then(({ locale }) => locale),
  de: () => import("./i18n-locales/de").then(({ locale }) => locale),
  es: () => import("./i18n-locales/es").then(({ locale }) => locale),
  fr: () => import("./i18n-locales/fr").then(({ locale }) => locale),
};
let supplementalLocales: SupplementalLocales = {};
const supplementalLocalePromises = new Map<SupplementalLanguage, Promise<SupplementalLocale>>();

/** Loads only the visitor's selected non-base language pack. */
export function preloadSupplementalLocale(lang: SupplementalLanguage): Promise<SupplementalLocale> {
  const existing = supplementalLocalePromises.get(lang);
  if (existing) return existing;

  const loading = supplementalLocaleLoaders[lang]()
    .then((locale) => {
      supplementalLocales = { ...supplementalLocales, [lang]: locale };
      return locale;
    })
    .catch((error: unknown) => {
      supplementalLocalePromises.delete(lang);
      throw error;
    });
  supplementalLocalePromises.set(lang, loading);
  return loading;
}

const baseDict = {
  "nav.dashboard": { lt: "Apžvalga", en: "Dashboard" },
  "nav.today": { lt: "Šiandien", en: "Today" },
  "nav.training": { lt: "Treniruotės", en: "Training" },
  "nav.twin": { lt: "Dvynys", en: "Twin" },
  "nav.lab": { lt: "Laboratorija", en: "Lab" },
  "nav.moreDescription": {
    lt: "Papildomi įrankiai tavo treniruotėms, mitybai, atsistatymui ir pažangai.",
    en: "More tools for your training, nutrition, recovery and progress.",
  },
  "nav.athlete": { lt: "Sportininko modelis", en: "Athlete model" },
  "nav.athleteDescription": {
    lt: "Skaidri tavo validuotų duomenų suvestinė",
    en: "A transparent summary of your validated data",
  },
  "nav.exercises": { lt: "Pratimai", en: "Exercises" },
  "nav.progress": { lt: "Progresas", en: "Progress" },
  "nav.coach": { lt: "Treneris", en: "Coach" },

  "landing.tag": { lt: "Asmeninė treniruočių sistema", en: "Your personal training system" },
  "landing.sub": {
    lt: "Atsakyk į kelis klausimus apie savo tikslą — sistema sugeneruos individualų savaičių planą salei arba namams, su vaizdo įrašais, serijų sekimu ir automatiniu progresu.",
    en: "Answer a few questions about your goal — the system builds a personal multi-week plan for the gym or home, with exercise videos, set tracking and automatic progression.",
  },
  "landing.cta": { lt: "Sukurti planą", en: "Build my plan" },
  "landing.login": { lt: "Prisijungti", en: "Sign in" },
  "theme.label": { lt: "Tema", en: "Theme" },
  "theme.light": { lt: "Šviesi", en: "Light" },
  "theme.dark": { lt: "Tamsi", en: "Dark" },
  "theme.system": { lt: "Kaip sistemoje", en: "Match system" },

  "qo.quick": { lt: "Greitas · 2 min", en: "Quick · 2 min" },
  "qo.full": { lt: "Pilnas · 5 min", en: "Full · 5 min" },
  "qo.left": { lt: "liko", en: "left" },
  "qo.q1": { lt: "Koks tavo tikslas?", en: "What is your goal?" },
  "qo.q2": { lt: "Kur ir kiek kartų treniruojiesi?", en: "Where and how often do you train?" },
  "qo.q3": { lt: "Kūnas ir apribojimai", en: "Body and limitations" },
  "qo.ready": { lt: "Tavo pradinis planas paruoštas", en: "Your starter plan is ready" },
  "qo.open": { lt: "Atidaryti planą", en: "Open plan" },
  "qo.again": { lt: "Generuoti iš naujo", en: "Generate again" },

  "ar.formOk": { lt: "Technika gera", en: "Form looks good" },
  "ar.idleTitle": { lt: "Įjunk kamerą", en: "Start camera" },
  "ar.noPose": {
    lt: "Nematau tavęs — atsitrauk nuo kameros",
    en: "I can\u2019t see you — step back from the camera",
  },
  "landing.h1a": { lt: "Tavo AI treneris.", en: "Your AI coach." },
  "landing.h1b": { lt: "Tavo planas.", en: "Your plan." },
  "landing.h1c": { lt: "Tavo progresas.", en: "Your progress." },
  "landing.sub2": {
    lt: "GYMS.LIFE sukuria ir kiekvieną treniruotę pritaiko pagal tavo tikslą, kūną, laiką, patirtį ir turimą įrangą.",
    en: "GYMS.LIFE builds your plan and adapts every session to your goal, body, time, experience and available equipment.",
  },
  "landing.ticker": {
    lt: "DISCIPLINA > MOTYVACIJA ·",
    en: "DISCIPLINE > MOTIVATION ·",
  },
  "landing.s1v": { lt: "175+", en: "175+" },
  "landing.s1l": { lt: "pratimų su technikos video", en: "exercises with technique video" },
  "landing.s2v": { lt: "60 s", en: "60 s" },
  "landing.s2l": { lt: "iki pirmo plano", en: "to your first plan" },
  "landing.s3v": { lt: "24/7", en: "24/7" },
  "landing.s3l": { lt: "treneris tavo kišenėje", en: "coach in your pocket" },
  "landing.s4v": { lt: "12 sav.", en: "12 wks" },
  "landing.s4l": { lt: "progreso sistema", en: "progression system" },
  "landing.bandSub": {
    lt: "Pirmas planas sugeneruojamas per 60 sekundžių — tereikia atsakyti į kelis klausimus.",
    en: "Your first plan is generated in 60 seconds — just answer a few questions.",
  },
  "landing.ctaNow": { lt: "Sukurti mano planą nemokamai", en: "Build my plan free" },
  "landing.trialNote": {
    lt: "7 dienos nemokamai · kortelės nereikia · atšaukti bet kada",
    en: "7 days free · no card required · cancel anytime",
  },
  "landing.demo": { lt: "Žiūrėti pratimus", en: "See the exercises" },
  "landing.myPlan": { lt: "Apžvalga", en: "Dashboard" },
  "landing.hasPlanTitle": { lt: "Jau turi aktyvų planą", en: "You already have an active plan" },
  "landing.hasPlanDesc": {
    lt: "Tavo treniruočių planas jau sugeneruotas. Nori pereiti prie jo ar sugeneruoti visiškai naują?",
    en: "Your workout plan is already generated. Do you want to go to it or generate a brand new one?",
  },
  "landing.goToPlan": { lt: "Eiti į mano planą", en: "Go to my plan" },
  "landing.newPlan": { lt: "Generuoti naują", en: "Generate new" },
  "landing.cmd.bodyMetrics": { lt: "Kūno rodikliai", en: "Body metrics" },

  "bm.weight": { lt: "Svoris", en: "Weight" },
  "bm.bodyFat": { lt: "Kūno riebalai", en: "Body fat" },

  "landing.f1.t": { lt: "Tikslo anketa", en: "Goal intake" },
  "landing.f1.d": {
    lt: "Patirtis, įranga, laikas, traumos — planas kuriamas tik pagal tavo realybę.",
    en: "Experience, equipment, time, injuries — the plan is built around your reality.",
  },
  "landing.f2.t": { lt: "Vaizdo technika", en: "Video technique" },
  "landing.f2.d": {
    lt: "Kiekvienas pratimas su demonstracija, technikos žingsniais ir dažniausiomis klaidomis.",
    en: "Every exercise with a demo clip, step-by-step cues and the most common mistakes.",
  },
  "landing.f3.t": { lt: "Protingas progresas", en: "Smart progression" },
  "landing.f3.d": {
    lt: "Sistema seka tūrį, asmeninius rekordus ir siūlo kitos treniruotės svorius.",
    en: "Tracks volume and personal records, then suggests next session's weights.",
  },
  "landing.f4.t": { lt: "Treniruotės režimas", en: "Live workout mode" },
  "landing.f4.d": {
    lt: "Serijų žymėjimas, poilsio laikmatis ir tūrio skaičiavimas realiu laiku.",
    en: "Set logging, rest timer and live volume counting.",
  },

  "auth.title": { lt: "Sveikas sugrįžęs", en: "Welcome back" },
  "auth.email": { lt: "El. paštas", en: "Email" },
  "auth.password": { lt: "Slaptažodis", en: "Password" },
  "auth.name": { lt: "Vardas", en: "Name" },
  "auth.signin": { lt: "Prisijungti", en: "Sign in" },
  "auth.signup": { lt: "Registruotis", en: "Sign up" },
  "auth.google": { lt: "Tęsti su Google", en: "Continue with Google" },
  "auth.toSignup": { lt: "Neturi paskyros? Registruokis", en: "No account? Sign up" },
  "auth.toSignin": { lt: "Jau turi paskyrą? Prisijunk", en: "Already have an account? Sign in" },
  "auth.or": { lt: "arba", en: "or" },

  "ob.title": { lt: "Tikslo anketa", en: "Goal intake" },
  "ob.sub": {
    lt: "Kuo tiksliau atsakysi, tuo tikslesnis bus tavo planas.",
    en: "The more precise your answers, the sharper your plan.",
  },
  "ob.step": { lt: "Žingsnis", en: "Step" },
  "ob.of": { lt: "iš", en: "of" },
  "ob.next": { lt: "Toliau", en: "Next" },
  "ob.back": { lt: "Atgal", en: "Back" },
  "ob.generate": { lt: "Generuoti planą", en: "Generate plan" },
  "ob.generating": { lt: "Kuriamas tavo planas...", en: "Building your plan..." },

  "ob.goal.lose": { lt: "Numesti riebalų", en: "Lose fat" },
  "ob.goal.muscle": { lt: "Auginti raumenis", en: "Build muscle" },
  "ob.goal.strength": { lt: "Didinti jėgą", en: "Get stronger" },
  "ob.goal.endurance": { lt: "Ištvermė ir sveikata", en: "Endurance & health" },

  "ob.q.experience": { lt: "Kokia tavo patirtis?", en: "What is your experience?" },
  "ob.exp.beginner": { lt: "Pradedantysis (<6 mėn.)", en: "Beginner (<6 months)" },
  "ob.exp.intermediate": { lt: "Vidutinis (6 mėn.–2 m.)", en: "Intermediate (6 mo–2 yr)" },
  "ob.exp.advanced": { lt: "Pažengęs (2+ m.)", en: "Advanced (2+ yrs)" },

  "ob.q.location": { lt: "Kur treniruosies?", en: "Where will you train?" },
  "ob.loc.gym": { lt: "Sporto salėje", en: "At the gym" },
  "ob.loc.home": { lt: "Namuose", en: "At home" },
  "ob.loc.both": { lt: "Ir ten, ir ten", en: "Both" },

  "ob.q.equipment": { lt: "Kokią įrangą turi?", en: "What equipment do you have?" },
  "eq.bodyweight": { lt: "Tik kūno svoris", en: "Bodyweight only" },
  "eq.dumbbell": { lt: "Hanteliai", en: "Dumbbells" },
  "eq.barbell": { lt: "Štanga", en: "Barbell" },
  "eq.kettlebell": { lt: "Svarsčiai", en: "Kettlebells" },
  "eq.machine": { lt: "Treniruokliai", en: "Machines" },
  "eq.cable": { lt: "Blokai", en: "Cables" },
  "eq.bands": { lt: "Gumos", en: "Resistance bands" },
  "eq.pullup": { lt: "Skersinis", en: "Pull-up bar" },

  "ob.q.days": { lt: "Kiek dienų per savaitę?", en: "How many days per week?" },
  "ob.q.minutes": { lt: "Kiek minučių viena treniruotė?", en: "How long is one session?" },
  "ob.q.body": { lt: "Šiek tiek apie tave", en: "A little about you" },
  "ob.f.age": { lt: "Amžius", en: "Age" },
  "ob.f.gender": { lt: "Lytis", en: "Gender" },
  "ob.g.male": { lt: "Vyras", en: "Male" },
  "ob.g.female": { lt: "Moteris", en: "Female" },
  "ob.g.other": { lt: "Kita", en: "Other" },
  "ob.f.height": { lt: "Ūgis (cm)", en: "Height (cm)" },
  "ob.f.weight": { lt: "Svoris (kg)", en: "Weight (kg)" },
  "ob.f.target": { lt: "Tikslinis svoris (kg)", en: "Target weight (kg)" },
  "ob.q.limits": { lt: "Traumos ar ribojimai?", en: "Injuries or limitations?" },
  "ob.limits.ph": {
    lt: "Pvz.: skauda juosmenį, operuotas kelis, nėra...",
    en: "E.g. lower back pain, knee surgery, none...",
  },

  "dash.morning": { lt: "Labas rytas", en: "Good morning" },
  "dash.afternoon": { lt: "Laba diena", en: "Good afternoon" },
  "dash.evening": { lt: "Labas vakaras", en: "Good evening" },
  "dash.welcomeBack": { lt: "Malonu matyti", en: "Good to see you" },
  "dash.streak": { lt: "Serija", en: "Streak" },
  "dash.regenerate": { lt: "Generuoti naują planą", en: "Generate a new plan" },

  "plan.day": { lt: "Diena", en: "Day" },
  "plan.min": { lt: "min", en: "min" },

  "w.watch": { lt: "Žiūrėti techniką", en: "Watch technique" },

  "ex.title": { lt: "Pratimų biblioteka", en: "Exercise library" },
  "ex.all": { lt: "Visi", en: "All" },
  "ex.level.beginner": { lt: "Pradedantiesiems", en: "Beginner" },
  "ex.level.intermediate": { lt: "Vidutinis", en: "Intermediate" },
  "ex.level.advanced": { lt: "Pažengusiems", en: "Advanced" },
  "ex.count": { lt: "pratimų", en: "exercises" },

  "ex.technique": { lt: "Technika", en: "Technique" },
  "ex.mistakes": { lt: "Dažnos klaidos", en: "Common mistakes" },
  "ex.muscle": { lt: "Raumenų grupė", en: "Muscle group" },
  "ex.equipment": { lt: "Įranga", en: "Equipment" },
  "ex.level": { lt: "Lygis", en: "Level" },

  "mg.legs": { lt: "Kojos", en: "Legs" },
  "mg.chest": { lt: "Krūtinė", en: "Chest" },
  "mg.back": { lt: "Nugara", en: "Back" },
  "mg.shoulders": { lt: "Pečiai", en: "Shoulders" },
  "mg.arms": { lt: "Rankos", en: "Arms" },
  "mg.abs": { lt: "Presas", en: "Abs" },
  "mg.core": { lt: "Liemuo", en: "Core" },
  "mg.glutes": { lt: "Sėdmenys", en: "Glutes" },
  "mg.cardio": { lt: "Kardio", en: "Cardio" },
  "mg.fullbody": { lt: "Visas kūnas", en: "Full body" },

  "pr.title": { lt: "Progresas", en: "Progress" },
  "pr.volume": { lt: "Savaitės tūris (kg)", en: "Weekly volume (kg)" },
  "pr.records": { lt: "Asmeniniai rekordai", en: "Personal records" },
  "pr.addWeight": { lt: "Įrašyti svorį", en: "Log weight" },
  "pr.save": { lt: "Išsaugoti", en: "Save" },
  "pr.empty": {
    lt: "Duomenų dar nėra — atlik pirmą treniruotę.",
    en: "No data yet — complete your first workout.",
  },
  "pr.history": { lt: "Treniruočių istorija", en: "Workout history" },

  "coach.title": { lt: "Tavo treneris", en: "Your coach" },
  "coach.sub": {
    lt: "Klausk apie techniką, mitybą, plano keitimą — treneris mato tavo planą ir progresą.",
    en: "Ask about technique, nutrition or plan tweaks — the coach sees your plan and progress.",
  },
  "coach.ph": { lt: "Parašyk klausimą...", en: "Ask a question..." },
  "coach.send": { lt: "Siųsti", en: "Send" },
  "coach.open": { lt: "Atidaryti pokalbį", en: "Open chat" },
  "coach.notesTab": { lt: "Trenerio pastabos", en: "Coach notes" },
  "coach.chatTab": { lt: "Klausk trenerio", en: "Ask coach" },
  "coach.nutriTab": { lt: "Mityba", en: "Nutrition" },
  "coach.q1": { lt: "Kaip pagerinti techniką?", en: "How do I improve my form?" },
  "coach.q2": { lt: "Ką valgyti prieš treniruotę?", en: "What should I eat before training?" },
  "coach.q3": { lt: "Kaip pridėti svorio pratimuose?", en: "How do I add weight to my lifts?" },
  "coach.q4": { lt: "Jaučiuosi pavargęs — ką daryti?", en: "I feel tired — what should I do?" },
  "coach.history": { lt: "Pokalbių istorija", en: "Conversation history" },
  "coach.historySub": {
    lt: "Visi tavo klausimai ir trenerio atsakymai išsaugomi automatiškai.",
    en: "Every question and coach answer is saved automatically.",
  },
  "coach.historyEmpty": {
    lt: "Kol kas nėra išsaugotų pokalbių.",
    en: "No saved conversations yet.",
  },
  "coach.clear": { lt: "Išvalyti istoriją", en: "Clear history" },
  "coach.cleared": { lt: "Istorija išvalyta", en: "History cleared" },

  "rd.title": { lt: "Paros pasiruošimas", en: "Daily readiness" },
  "rd.sub": {
    lt: "30 sekundžių patikra — sistema perskaičiuoja šiandienos krūvį pagal tavo miegą, raumenų skausmą ir stresą.",
    en: "A 30-second check-in — the system recalculates today's load from your sleep, soreness and stress.",
  },
  "rd.sleepHours": { lt: "Miego valandos", en: "Hours of sleep" },
  "rd.sleepQuality": { lt: "Miego kokybė", en: "Sleep quality" },
  "rd.soreness": { lt: "Raumenų skausmas", en: "Muscle soreness" },
  "rd.stress": { lt: "Stresas", en: "Stress" },
  "rd.energy": { lt: "Energija", en: "Energy" },
  "rd.mood": { lt: "Nuotaika", en: "Mood" },
  "rd.submit": { lt: "Apskaičiuoti krūvį", en: "Calculate my load" },
  "rd.score": { lt: "Pasiruošimas", en: "Readiness" },
  "rd.load": { lt: "Šiandienos krūvis", en: "Today's load" },
  "rd.again": { lt: "Perskaičiuoti", en: "Recalculate" },

  "fc.title": { lt: "Technikos skeneris", en: "Technique scanner" },
  "fc.sub": {
    lt: "Įjunk kamerą ir atlik vieną pakartojimą — gausi tikslų technikos įvertinimą 100 balų skalėje ir aiškų patarimą, ką pataisyti.",
    en: "Turn on the camera and do one rep — you get a precise technique score out of 100 and a clear tip on what to fix.",
  },
  "fc.enable": { lt: "Įjungti kamerą", en: "Enable camera" },
  "fc.record": { lt: "Filmuoti pakartojimą (5 s)", en: "Record a rep (5 s)" },
  "fc.analyzing": { lt: "Analizuojama technika...", en: "Analysing technique..." },
  "fc.score": { lt: "Technikos balas", en: "Technique score" },
  "fc.good": { lt: "Kas gerai", en: "What's good" },
  "fc.fixes": { lt: "Ką taisyti", en: "What to fix" },
  "fc.drills": { lt: "Pratybos technikai", en: "Technique drills" },
  "fc.denied": { lt: "Kameros leidimas nesuteiktas.", en: "Camera permission denied." },
  "fc.history": { lt: "Ankstesnės analizės", en: "Previous scans" },

  "cmd.ph": { lt: "Ieškok arba šok į skiltį...", en: "Search or jump to..." },
  "cmd.empty": { lt: "Nieko nerasta.", en: "No results." },
  "cmd.nav": { lt: "Navigacija", en: "Navigation" },

  "nav.nutrition": { lt: "Mityba", en: "Nutrition" },
  "nut.title": { lt: "Mitybos dienoraštis", en: "Nutrition log" },
  "nut.sub": {
    lt: "Parašyk paprastai, ką suvalgei — kalorijos ir makro elementai suskaičiuojami už tave, o dienos tikslai atsinaujina patys.",
    en: "Describe what you ate in plain words — calories and macros are counted for you, and your daily targets update on their own.",
  },
  "nut.ph": {
    lt: "Pvz.: 2 kiaušiniai, avižinė košė su bananu ir kava su pienu",
    en: "E.g. 2 eggs, oatmeal with banana and a latte",
  },
  "nut.add": { lt: "Įrašyti", en: "Log it" },
  "nut.analyzing": { lt: "Skaičiuojama...", en: "Calculating..." },
  "nut.today": { lt: "Šiandien", en: "Today" },
  "nut.kcal": { lt: "kcal", en: "kcal" },
  "nut.protein": { lt: "Baltymai", en: "Protein" },
  "nut.carbs": { lt: "Angliavandeniai", en: "Carbs" },
  "nut.fat": { lt: "Riebalai", en: "Fat" },
  "nut.empty": { lt: "Šiandien dar nieko neįrašyta.", en: "Nothing logged today yet." },
  "nut.delete": { lt: "Trinti", en: "Delete" },

  "ach.title": { lt: "Pasiekimai", en: "Achievements" },
  "ach.sub": {
    lt: "Kiekviena serija duoda XP. Kelk lygį, rink ženkliukus ir nenutrauk savo grandinės.",
    en: "Every set earns XP. Level up, collect badges and keep your chain alive.",
  },
  "ach.level": { lt: "Lygis", en: "Level" },
  "ach.xp": { lt: "XP", en: "XP" },
  "ach.next": { lt: "iki kito lygio", en: "to next level" },
  "ach.badges": { lt: "Ženkliukai", en: "Badges" },
  "ach.locked": { lt: "Užrakinta", en: "Locked" },
  "ach.heat": { lt: "Aktyvumo žemėlapis", en: "Activity map" },
  "ach.b1": { lt: "Pirmas žingsnis", en: "First step" },
  "ach.b1d": { lt: "Užbaigta pirma treniruotė", en: "Completed your first workout" },
  "ach.b2": { lt: "Įsibėgėjo", en: "Rolling" },
  "ach.b2d": { lt: "10 treniruočių", en: "10 workouts done" },
  "ach.b3": { lt: "Mašina", en: "Machine" },
  "ach.b3d": { lt: "50 treniruočių", en: "50 workouts done" },
  "ach.b4": { lt: "Tonos", en: "Tonnage" },
  "ach.b4d": { lt: "50 000 kg bendro tūrio", en: "50,000 kg total volume" },
  "ach.b5": { lt: "Savaitės serija", en: "Week streak" },
  "ach.b6": { lt: "7 dienos iš eilės", en: "7 days in a row" },
  "ach.b7": { lt: "Technikos meistras", en: "Technique master" },
  "ach.b7d": { lt: "Formos skenerio balas 90+", en: "Form scanner score 90+" },
  "ach.b8": { lt: "Discipliniuotas", en: "Disciplined" },
  "ach.b8d": { lt: "7 paros pasiruošimo patikros", en: "7 readiness check-ins" },

  "common.loading": { lt: "Kraunama...", en: "Loading..." },

  /* ---------- 7-day meal plan ---------- */
  "nav.meal": { lt: "Mitybos planas", en: "Meal plan" },
  "mp.title": { lt: "7 dienų mitybos planas", en: "7-day meal plan" },
  "mp.sub": {
    lt: "Pagal tavo svorį, tikslą ir mėgstamą maistą sudėliosime savaitės valgiaraštį su receptais ir vienu parduotuvės sąrašu.",
    en: "Based on your weight, goal and favourite foods, we build a week of meals with recipes and one shopping list.",
  },
  "mp.diet": { lt: "Mitybos tipas", en: "Diet type" },
  "mp.diet.any": { lt: "Viskas tinka", en: "No restrictions" },
  "mp.diet.vegetarian": { lt: "Vegetariška", en: "Vegetarian" },
  "mp.diet.vegan": { lt: "Veganiška", en: "Vegan" },
  "mp.diet.pescatarian": { lt: "Žuvis + augalinė", en: "Pescatarian" },
  "mp.diet.lowcarb": { lt: "Mažai angliavandenių", en: "Low carb" },
  "mp.diet.glutenfree": { lt: "Be gliuteno", en: "Gluten free" },
  "mp.diet.lactosefree": { lt: "Be laktozės", en: "Lactose free" },
  "mp.allergies": { lt: "Alergijos", en: "Allergies" },
  "mp.allergies.ph": { lt: "Pvz.: riešutai, jūros gėrybės...", en: "E.g. nuts, shellfish..." },
  "mp.dislikes": { lt: "Ko nevalgai", en: "Foods you dislike" },
  "mp.dislikes.ph": { lt: "Pvz.: brokoliai, varškė...", en: "E.g. broccoli, cottage cheese..." },
  "mp.meals": { lt: "Valgymų per dieną", en: "Meals per day" },
  "mp.budget": { lt: "Biudžetas", en: "Budget" },
  "mp.budget.low": { lt: "Taupus", en: "Budget" },
  "mp.budget.mid": { lt: "Vidutinis", en: "Standard" },
  "mp.budget.high": { lt: "Nesvarbu", en: "Premium" },
  "mp.cooking": { lt: "Gaminimo įgūdžiai", en: "Cooking skill" },
  "mp.cooking.easy": { lt: "Kuo paprasčiau", en: "Keep it simple" },
  "mp.cooking.normal": { lt: "Vidutiniškai", en: "Normal" },
  "mp.cooking.chef": { lt: "Mėgstu gaminti", en: "I love cooking" },
  "mp.generate": { lt: "Generuoti mitybos planą", en: "Generate meal plan" },
  "mp.generating": { lt: "Kuriamas valgiaraštis...", en: "Building your menu..." },
  "mp.regenerate": { lt: "Naujas planas", en: "New plan" },
  "mp.day": { lt: "Diena", en: "Day" },
  "mp.shopping": { lt: "Parduotuvės sąrašas", en: "Shopping list" },
  "mp.copy": { lt: "Kopijuoti sąrašą", en: "Copy list" },
  "mp.copied": { lt: "Nukopijuota", en: "Copied" },
  "mp.print": { lt: "Spausdinti", en: "Print" },
  "mp.ingredients": { lt: "Produktai", en: "Ingredients" },
  "mp.steps": { lt: "Gaminimas", en: "Method" },
  "mp.targets": { lt: "Dienos tikslai", en: "Daily targets" },
  "mp.kcalMode": { lt: "Kalorijų kiekis", en: "Calorie amount" },
  "mp.kcalAuto": { lt: "Apskaičiuoti pagal mane", en: "Calculate for me" },
  "mp.kcalCustom": { lt: "Nurodysiu pats", en: "I'll set it myself" },
  "mp.kcalCustomLabel": { lt: "Norimos kalorijos per dieną", en: "Target calories per day" },
  "mp.kcalHint": {
    lt: "Sistema laikysis šio kiekio ±5 % ir subalansuos baltymus, angliavandenius bei riebalus.",
    en: "The menu will stay within ±5% of this amount and balance protein, carbs and fat.",
  },
  "mp.avgTitle": { lt: "Savaitės vidurkis per dieną", en: "Weekly average per day" },
  "mp.avgSub": {
    lt: "Vidutiniškai tiek suvartosi kasdien pagal šį planą.",
    en: "This is what you'll actually eat on an average day with this plan.",
  },
  "mp.avgKcal": { lt: "Vid. kalorijos", en: "Avg. calories" },
  "mp.range": { lt: "Dienų svyravimas", en: "Daily range" },
  "mp.vsTarget": { lt: "Nuo tikslo", en: "Vs. target" },

  "mp.hydration": { lt: "Skysčiai", en: "Hydration" },
  "mp.tips": { lt: "Paruošimo patarimai", en: "Prep tips" },
  "mp.none": { lt: "Dar neturi mitybos plano.", en: "You don't have a meal plan yet." },

  /* ---------- health sync ---------- */

  /* ---------- AR mode ---------- */
  "nav.ar": { lt: "AR režimas", en: "AR mode" },
  "ar.title": { lt: "AR treniruočių režimas", en: "AR training mode" },
  "ar.sub": {
    lt: "Kamera realiu laiku seka tavo skeletą, ant vaizdo piešia tikslinius sąnarių kampus ir korekcijos rodykles bei skaičiuoja pakartojimus.",
    en: "The camera tracks your skeleton in real time, draws target joint angles and correction arrows over the video and counts your reps.",
  },
  "ar.start": { lt: "Įjungti AR", en: "Start AR" },
  "ar.loading": { lt: "Kraunamas modelis...", en: "Loading model..." },
  "ar.failed": { lt: "Nepavyko paleisti AR režimo.", en: "Could not start AR mode." },
  "ar.reps": { lt: "Pakartojimai", en: "Reps" },
  "ar.voice": { lt: "Balso korekcijos", en: "Voice cues" },

  "ar.targets": { lt: "Tiksliniai kampai", en: "Target angles" },
  "ar.range": { lt: "Norma", en: "Target" },
  "ar.privacy": {
    lt: "Vaizdas apdorojamas tik tavo įrenginyje — niekas nesiunčiama į serverį.",
    en: "Video is processed on your device only — nothing is uploaded.",
  },

  "mp.pdf": { lt: "Atsisiųsti PDF", en: "Download PDF" },
  "mp.pdfBusy": { lt: "Ruošiamas PDF...", en: "Building PDF..." },
  "mp.pdfDone": { lt: "PDF atsisiųstas", en: "PDF downloaded" },
  "mp.adapt": { lt: "Priderinti planą", en: "Adapt plan" },
  "mp.adapting": { lt: "Priderinama...", en: "Adapting..." },
  "mp.adaptTitle": { lt: "Priderinti likusias dienas", en: "Adapt the remaining days" },
  "mp.adaptSub": {
    lt: "Peržiūrime, ką realiai suvalgei, tavo svorio tendenciją ir pasirinkimus, tada perrašome likusių dienų receptus bei makro tikslus.",
    en: "We review what you actually ate, your weight trend and preferences, then rewrite the remaining days' recipes and macro targets.",
  },
  "mp.adaptFrom": { lt: "Nuo dienos", en: "From day" },
  "mp.adaptNote": { lt: "Papildomas pageidavimas", en: "Extra request" },
  "mp.adaptNotePh": {
    lt: "Pvz.: daugiau baltymų, mažiau gaminimo, savaitgalį valgysiu lauke...",
    en: "E.g. more protein, less cooking, eating out at the weekend...",
  },
  "mp.adapted": { lt: "Planas priderintas", en: "Plan adapted" },
  "mp.adaptNote.title": { lt: "Kodėl pakeista", en: "Why it changed" },

  "ar.height": { lt: "Ūgis (cm)", en: "Height (cm)" },
  "ar.heightNeeded": {
    lt: "Įrašyk ūgį — pagal jį kamera verčia pikselius į centimetrus. Be jo matmenys rodomi pikseliais.",
    en: "Enter your height — the camera converts pixels to centimetres by it. Without it, measurements stay in pixels.",
  },
  "ar.depth": { lt: "Judesio gylis", en: "Movement depth" },
  "ar.voiceSelect": { lt: "Balsas", en: "Voice" },
  "ar.voiceDefault": { lt: "Sistemos balsas", en: "System voice" },
  "ar.rate": { lt: "Kalbos greitis", en: "Speech rate" },

  "nav.reminders": { lt: "Priminimai", en: "Reminders" },
  "nav.more": { lt: "Daugiau", en: "More" },
  "rem.title": { lt: "Priminimai", en: "Reminders" },
  "rem.sub": {
    lt: "Vanduo, valgymai ir treniruotė — priminimai veikia tiesiai programoje, pasirinktu laiku.",
    en: "Water, meals and training — reminders run right inside the app at the times you pick.",
  },
  "rem.enable": { lt: "Priminimai įjungti", en: "Reminders enabled" },
  "rem.push": { lt: "Sistemos pranešimai", en: "System notifications" },
  "rem.pushHint": {
    lt: "Leisk naršyklės pranešimus, kad matytum priminimą net kai kortelė fone.",
    en: "Allow browser notifications to see reminders even when the tab is in the background.",
  },
  "rem.sound": { lt: "Garsinis signalas", en: "Sound cue" },
  "rem.next": { lt: "Kitas priminimas", en: "Next reminder" },
  "rem.removeMealTime": { lt: "Pašalinti valgio laiką", en: "Remove meal time" },
  "rem.none": { lt: "Nėra suplanuotų priminimų", en: "No reminders scheduled" },
  "rem.water": { lt: "Gėrimo priminimai", en: "Water reminders" },
  "rem.meal": { lt: "Mitybos dienos priminimai", en: "Meal day reminders" },
  "rem.workout": { lt: "Treniruotės priminimas", en: "Workout reminder" },
  "rem.from": { lt: "Nuo", en: "From" },
  "rem.to": { lt: "Iki", en: "Until" },
  "rem.every": { lt: "Kas (min.)", en: "Every (min)" },
  "rem.addWater": { lt: "Išgėriau", en: "I drank" },
  "rem.resetWater": { lt: "Nulinti dieną", en: "Reset day" },
  "rem.todayWater": { lt: "Šiandien išgerta", en: "Today's intake" },
  "rem.times": { lt: "Valgymo laikai", en: "Meal times" },
  "rem.addTime": { lt: "Pridėti laiką", en: "Add time" },
  "rem.time": { lt: "Laikas", en: "Time" },
  "rem.days": { lt: "Dienos", en: "Days" },
  "rem.saved": { lt: "Išsaugota", en: "Saved" },
  "rem.preview": { lt: "Išbandyti priminimą", en: "Test reminder" },
  "rem.schedule": { lt: "Šios dienos tvarkaraštis", en: "Today's schedule" },
  "rem.pushDenied": { lt: "Pranešimai neleisti naršyklėje", en: "Notifications were blocked" },

  "common.error": { lt: "Įvyko klaida", en: "Something went wrong" },
  "common.kg": { lt: "kg", en: "kg" },

  "nav.supplements": { lt: "Papildai", en: "Supplements" },
  "supp.title": { lt: "Papildų planas", en: "Supplement planner" },
  "supp.sub": {
    lt: "Pridėk vartojamus papildus — sistema juos paskirstys dienos metu pagal įsisavinimą, sąveiką ir treniruotės laiką.",
    en: "Add the supplements you take — the system spreads them across the day by absorption, interactions and training time.",
  },
  "supp.add": { lt: "Pridėti papildą", en: "Add supplement" },
  "supp.name": { lt: "Pavadinimas", en: "Name" },
  "supp.namePh": { lt: "pvz., Kreatinas", en: "e.g. Creatine" },
  "supp.dose": { lt: "Porcija", en: "Dose" },
  "supp.dosePh": { lt: "pvz., 5 g arba 1 kapsulė", en: "e.g. 5 g or 1 capsule" },
  "supp.category": { lt: "Tipas", en: "Category" },
  "supp.timesPerDay": { lt: "Kartų per dieną", en: "Times per day" },
  "supp.withFood": { lt: "Vartoti su maistu", en: "Take with food" },
  "supp.prefTime": { lt: "Pageidaujamas laikas", en: "Preferred time" },
  "supp.pref.any": { lt: "Bet kada", en: "Any time" },
  "supp.pref.morning": { lt: "Rytas", en: "Morning" },
  "supp.pref.pre_workout": { lt: "Prieš treniruotę", en: "Before workout" },
  "supp.pref.post_workout": { lt: "Po treniruotės", en: "After workout" },
  "supp.pref.evening": { lt: "Vakaras", en: "Evening" },
  "supp.pref.bedtime": { lt: "Prieš miegą", en: "Before bed" },
  "supp.notes": { lt: "Pastabos (nebūtina)", en: "Notes (optional)" },
  "supp.cat.protein": { lt: "Baltymai", en: "Protein" },
  "supp.cat.creatine": { lt: "Kreatinas", en: "Creatine" },
  "supp.cat.vitamin": { lt: "Vitaminai", en: "Vitamins" },
  "supp.cat.mineral": { lt: "Mineralai (magnis, cinkas)", en: "Minerals (magnesium, zinc)" },
  "supp.cat.iron": { lt: "Geležis", en: "Iron" },
  "supp.cat.calcium": { lt: "Kalcis", en: "Calcium" },
  "supp.cat.omega": { lt: "Omega-3", en: "Omega-3" },
  "supp.cat.preworkout": { lt: "Prieštreniruotinis", en: "Pre-workout" },
  "supp.cat.electrolyte": { lt: "Elektrolitai", en: "Electrolytes" },
  "supp.cat.probiotic": { lt: "Probiotikai", en: "Probiotics" },
  "supp.cat.general": { lt: "Kita", en: "Other" },
  "supp.list": { lt: "Mano papildai", en: "My supplements" },
  "supp.empty": {
    lt: "Dar nėra papildų — pridėk pirmąjį ir gausi asmeninį dienos grafiką.",
    en: "No supplements yet — add your first one to get a personal daily schedule.",
  },
  "supp.schedule": { lt: "Tavo dienos grafikas", en: "Your daily schedule" },
  "supp.scheduleSub": {
    lt: "Laikai pritaikyti pagal įsisavinimą ir sąveiką — gali juos derinti pagal savo dienotvarkę.",
    en: "Times are tuned for absorption and interactions — adjust them to fit your routine.",
  },
  "supp.warnings": { lt: "Svarbu žinoti", en: "Good to know" },
  "supp.slot.wake": { lt: "Pabudus", en: "On waking" },
  "supp.slot.breakfast": { lt: "Pusryčiai", en: "Breakfast" },
  "supp.slot.lunch": { lt: "Pietūs", en: "Lunch" },
  "supp.slot.pre_workout": { lt: "Prieš treniruotę", en: "Pre-workout" },
  "supp.slot.post_workout": { lt: "Po treniruotės", en: "Post-workout" },
  "supp.slot.dinner": { lt: "Vakarienė", en: "Dinner" },
  "supp.slot.bedtime": { lt: "Prieš miegą", en: "Before bed" },
  "supp.why.preworkout": {
    lt: "Energijai ir fokusui — 30 min prieš treniruotę",
    en: "For energy and focus — 30 min before training",
  },
  "supp.why.creatine": {
    lt: "Po treniruotės įsisavinamas geriausiai",
    en: "Best absorbed after training",
  },
  "supp.why.protein": { lt: "Padeda raumenims atsistatyti", en: "Helps muscles recover" },
  "supp.why.omega": { lt: "Su maistu įsisavinama geriau", en: "Absorbs better with food" },
  "supp.why.vitamin": {
    lt: "Ryte su maistu — geriausias įsisavinimas",
    en: "Morning with food — best absorption",
  },
  "supp.why.mineral": {
    lt: "Vakare padeda atsipalaiduoti ir miegoti",
    en: "In the evening it aids relaxation and sleep",
  },
  "supp.why.iron": {
    lt: "Tuščiu skrandžiu įsisavinama daugiausia",
    en: "Best absorbed on an empty stomach",
  },
  "supp.why.calcium": { lt: "Vakare, atskirai nuo geležies", en: "In the evening, away from iron" },
  "supp.why.electrolyte": {
    lt: "Palaiko vandens balansą treniruotės metu",
    en: "Supports hydration around training",
  },
  "supp.why.probiotic": {
    lt: "Prieš valgį — geriausias poveikis žarnynui",
    en: "Before a meal — best for gut health",
  },
  "supp.why.general": {
    lt: "Pastovus laikas kasdien — geriausias įprotis",
    en: "A consistent daily time builds the habit",
  },
  "supp.why.separated": {
    lt: "Perkelta čia, kad netrukdytų kitų papildų įsisavinimui",
    en: "Moved here so it doesn't block absorption of others",
  },
  "supp.warn.ironCalcium": {
    lt: "Geležis ir kalcis trukdo vienas kito įsisavinimui — juos išskirstėme skirtingu metu.",
    en: "Iron and calcium compete for absorption — we've separated them.",
  },
  "supp.warn.ironZinc": {
    lt: "Geležis ir cinkas geriau vartojami skirtingu metu — juos atskyrėme.",
    en: "Iron and zinc work better apart — we've separated them.",
  },
  "supp.warn.calciumZinc": {
    lt: "Kalcis ir cinkas varžosi dėl įsisavinimo — juos atskyrėme.",
    en: "Calcium and zinc compete for absorption — we've separated them.",
  },
  "supp.warn.caffeineLate": {
    lt: "Prieštreniruotinis su kofeinu vėlai vakare gali gadinti miegą — rinkis rytines treniruotes arba versiją be kofeino.",
    en: "A caffeinated pre-workout late in the day can hurt sleep — train earlier or use a stim-free version.",
  },
  "supp.warn.tooMany": {
    lt: "Vienu metu susikaupė daug papildų — apsvarstyk, ar visų tikrai reikia kasdien.",
    en: "Many supplements land at the same time — consider whether you need all of them daily.",
  },
  "supp.saved": { lt: "Papildas pridėtas", en: "Supplement added" },
  "supp.deleted": { lt: "Papildas pašalintas", en: "Supplement removed" },
  "supp.paused": { lt: "Pristabdytas", en: "Paused" },
  "supp.active": { lt: "Aktyvus", en: "Active" },
  "supp.perDay": { lt: "per dieną", en: "per day" },

  "footer.privacy": { lt: "Privatumo politika", en: "Privacy Policy" },
  "footer.terms": { lt: "Naudojimo sąlygos", en: "Terms of Service" },
  "footer.refund": { lt: "Grąžinimo politika", en: "Refund Policy" },
  "footer.pricing": { lt: "Kainodara", en: "Pricing" },
  "footer.copyright": {
    lt: "© {year} GYMS.LIFE. Visos teisės saugomos. Pardavėjas: Aleksandr Smirnov.",
    en: "© {year} GYMS.LIFE. All rights reserved. Seller: Aleksandr Smirnov.",
  },
  "auth.forgot": { lt: "Pamiršai slaptažodį?", en: "Forgot your password?" },
  "auth.resetTitle": { lt: "Atkurk slaptažodį", en: "Reset your password" },
  "auth.resetHint": {
    lt: "Įrašyk savo el. paštą — atsiųsime nuorodą naujam slaptažodžiui susikurti.",
    en: "Enter your email — we will send you a link to create a new password.",
  },
  "auth.resetSend": { lt: "Siųsti nuorodą", en: "Send link" },
  "auth.resetSent": {
    lt: "Nuoroda išsiųsta. Patikrink savo el. paštą.",
    en: "Link sent. Check your inbox.",
  },
  "auth.backToSignin": { lt: "Grįžti prie prisijungimo", en: "Back to sign in" },
  "auth.newPassword": { lt: "Naujas slaptažodis", en: "New password" },
  "auth.newPassword2": { lt: "Pakartok slaptažodį", en: "Repeat password" },
  "auth.updatePassword": { lt: "Išsaugoti slaptažodį", en: "Save password" },
  "auth.updated": { lt: "Slaptažodis atnaujintas.", en: "Password updated." },
  "auth.mismatch": { lt: "Slaptažodžiai nesutampa.", en: "Passwords do not match." },
} satisfies Dict;

export const dict = {
  ...baseDict,
  ...extra_legal,
  ...extra_tools,
  ...extra_scan,
  ...extra_misc,
  ...extra_routes,
  ...extra_nat1,
  ...extra_nat2,
  ...extra_nat3,
  ...extra_nextgen,
  ...extra_live,
  ...extra_health2,
  ...extra_supp_ai,
  ...extra_supp_scan,
  ...extra_brief,
  ...extra_coachsession,
  ...extra_overview,
  ...extra_landing2,
  ...extra_landing3,
  ...extra_scan2,
} satisfies Dict;

export type TKey = keyof typeof dict;

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "lt", label: "Lietuvių", flag: "🇱🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
}>({ lang: "lt", setLang: () => {}, t: (k) => dict[k].lt });

function translate(
  lang: Lang,
  key: TKey,
  loadedSupplementalLocales: SupplementalLocales = supplementalLocales,
): string {
  if (lang === "lt" || lang === "en") return dict[key][lang];
  return loadedSupplementalLocales[lang]?.[key] ?? dict[key].en;
}

function detectLang(): Lang {
  if (typeof navigator === "undefined") return "lt";
  for (const raw of navigator.languages ?? [navigator.language]) {
    const language = parseSupportedLanguage((raw ?? "").slice(0, 2).toLowerCase());
    if (language) return language;
  }
  return "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("lt");
  const [loadedSupplementalLocales, setLoadedSupplementalLocales] =
    useState<SupplementalLocales>(supplementalLocales);

  useEffect(() => {
    const stored = parseSupportedLanguage(window.localStorage.getItem("forma_lang"));
    if (stored) {
      setLangState(stored);
    } else {
      setLangState(detectLang());
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("forma_lang", l);
  }, []);

  useEffect(() => {
    if (lang === "lt" || lang === "en" || loadedSupplementalLocales[lang]) return;

    let active = true;
    void preloadSupplementalLocale(lang)
      .then((locale) => {
        if (active) {
          setLoadedSupplementalLocales((current) => ({ ...current, [lang]: locale }));
        }
      })
      .catch(() => {
        // English remains the safe fallback if optional translations cannot load.
      });

    return () => {
      active = false;
    };
  }, [lang, loadedSupplementalLocales]);

  const t = useCallback(
    (k: TKey) => translate(lang, k, loadedSupplementalLocales),
    [lang, loadedSupplementalLocales],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  return useContext(LangContext);
}

export type BaseLang = "lt" | "en";
export const baseLang = (l: Lang): BaseLang => (l === "lt" ? "lt" : "en");

/**
 * The locale tag to format dates, times and numbers with.
 *
 * `baseLang` collapses the eight shipped locales into two copy branches
 * because we only write copy in two languages. Formatting has no such
 * limit — Intl knows every one of them — so a German athlete reads German
 * dates instead of the Lithuanian ones this app used to hand everybody.
 * English is pinned to en-GB for the 24-hour clock and day-first dates the
 * rest of the app assumes.
 */
export const formatLocale = (l: Lang): string => (l === "en" ? "en-GB" : l);

/** Standalone translator for non-React code (server helpers, PDF/print builders). */
export function tr(lang: Lang, k: TKey): string {
  return translate(lang, k);
}
