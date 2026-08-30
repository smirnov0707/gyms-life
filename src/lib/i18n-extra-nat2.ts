export const extra_nat2 = {
  "hw.recovery": { lt: "Atkūrimo balas", en: "Recovery score" },
  "hw.hrv": { lt: "HRV", en: "HRV" },
  "hw.rhr": { lt: "Ramybės pulsas", en: "Resting HR" },
  "hw.sleep": { lt: "Miegas", en: "Sleep" },
  "hw.steps": { lt: "Žingsniai", en: "Steps" },
  "hw.none": { lt: "—", en: "—" },
  "hw.noData": {
    lt: "Per mažai duomenų savaitės santraukai — sinchronizuok bent 3 dienas.",
    en: "Not enough data for a weekly summary — sync at least 3 days.",
  },

  "hw.effect.recovery.up": {
    lt: "Atkūrimas pakilo {pct} %, todėl krūvio koeficientas šią savaitę laikomas ties {mod} % — galima kelti svorius pagrindiniuose pratimuose.",
    en: "Recovery rose {pct}%, so the load factor sits at {mod}% — you can add weight on the main lifts.",
  },
  "hw.effect.recovery.down": {
    lt: "Atkūrimas nukrito {pct} %, todėl sistema automatiškai apkarpė dienos krūvį iki {mod} % ir ilgino poilsio pauzes.",
    en: "Recovery fell {pct}%, so the system trimmed daily load to {mod}% and extended rest periods.",
  },
  "hw.effect.recovery.flat": {
    lt: "Atkūrimas stabilus, krūvis laikomas ties {mod} % be staigių šuolių.",
    en: "Recovery is stable, load stays at {mod}% with no jumps.",
  },
  "hw.effect.hrv.up": {
    lt: "HRV vidurkis {pct} % aukštesnis — nervų sistema priima daugiau intensyvaus darbo, todėl leidžiamos sunkios serijos.",
    en: "Average HRV is {pct}% higher — your nervous system takes more intensity, so heavy sets are allowed.",
  },
  "hw.effect.hrv.down": {
    lt: "HRV vidurkis {pct} % žemesnis — sukauptas stresas, todėl intensyvumo dienos keičiamos į tūrio arba technikos darbą.",
    en: "Average HRV is {pct}% lower — accumulated stress, so intensity days switch to volume or technique work.",
  },
  "hw.effect.hrv.flat": {
    lt: "HRV nepakito — intensyvumo planas paliekamas toks pat.",
    en: "HRV unchanged — the intensity plan stays as is.",
  },
  "hw.effect.rhr.up": {
    lt: "Ramybės pulsas {pct} % aukštesnis — dažniausiai miego trūkumas ar dehidratacija; sistema pridėjo +30 s poilsio tarp serijų.",
    en: "Resting HR is {pct}% higher — usually short sleep or dehydration; the system added +30 s rest between sets.",
  },
  "hw.effect.rhr.down": {
    lt: "Ramybės pulsas {pct} % žemesnis — geresnis širdies atkūrimas, kardio intervalai gali būti intensyvesni.",
    en: "Resting HR is {pct}% lower — better cardiac recovery, conditioning intervals can go harder.",
  },
  "hw.effect.rhr.flat": {
    lt: "Ramybės pulsas stabilus — kardio planas nekeičiamas.",
    en: "Resting HR stable — conditioning plan unchanged.",
  },
  "hw.effect.sleep.down": {
    lt: "Miegojai {pct} % mažiau — nuo pagalbinių pratimų buvo nuimta po seriją, sprogūs judesiai atidėti.",
    en: "You slept {pct}% less — a set was removed from accessories and explosive work was postponed.",
  },
  "hw.effect.sleep.up": {
    lt: "Miego vidurkis {pct} % didesnis — planinis tūris grąžintas į 100 %.",
    en: "Average sleep is {pct}% higher — planned volume is back at 100%.",
  },
  "hw.effect.sleep.flat": {
    lt: "Miego trukmė stabili — tūris paliktas nepakitęs.",
    en: "Sleep duration stable — volume unchanged.",
  },
  "hw.effect.steps.up": {
    lt: "Foninis aktyvumas {pct} % didesnis — kojų tūris buvo mažinamas, kad nesusidėtų nuovargis.",
    en: "Background activity is {pct}% higher — leg volume was reduced to avoid stacking fatigue.",
  },
  "hw.effect.steps.down": {
    lt: "Foninis aktyvumas {pct} % mažesnis — liko daugiau energijos kojų dienai.",
    en: "Background activity is {pct}% lower — more energy left for leg day.",
  },
  "hw.effect.steps.flat": {
    lt: "Foninis aktyvumas stabilus.",
    en: "Background activity is stable.",
  },

  "hw.headline": {
    lt: "Savaitės atkūrimas {recovery}/100 (krūvis {mod} %{lastWeek}). Didžiausias pokytis: {top}.",
    en: "Weekly recovery {recovery}/100 (load {mod}%{lastWeek}). Biggest change: {top}.",
  },
  "hw.headline.lastWeek": {
    lt: ", praėjusią savaitę {pct} %",
    en: ", last week {pct}%",
  },

  "hw.action.sleep": {
    lt: "Pridėk 45 min miego – tai greičiausias būdas grąžinti krūvį į 100 %.",
    en: "Add 45 minutes of sleep — the fastest way to get load back to 100%.",
  },
  "hw.action.rhr": {
    lt: "Padidink vandens kiekį ir venk alkoholio – ramybės pulsas kyla būtent dėl to.",
    en: "Increase water intake and skip alcohol — that is what is driving resting HR up.",
  },
  "hw.action.hrv": {
    lt: "Įterpk vieną lengvą (deload) dieną – HRV kritimas rodo susikaupusį stresą.",
    en: "Insert one deload day — the HRV drop signals accumulated stress.",
  },
  "hw.action.default": {
    lt: "Rodikliai stabilūs – tęsk progresiją ir kelk svorį 2,5 % pagrindiniuose pratimuose.",
    en: "Metrics are stable — continue progression and add 2.5% on the main lifts.",
  },

  "hw.ins.hrv": { lt: "Širdies ritmo kintamumas (HRV)", en: "Heart rate variability (HRV)" },
  "hw.ins.rhr": { lt: "Ramybės pulsas", en: "Resting heart rate" },
  "hw.ins.sleep": { lt: "Miego trukmė", en: "Sleep duration" },
  "hw.ins.quality": { lt: "Miego kokybė", en: "Sleep quality" },
  "hw.ins.activity": { lt: "Dienos aktyvumas", en: "Daily activity" },
  "hw.ins.vsBase": { lt: "vs 30 d. vidurkis", en: "vs 30-day average" },
  "hw.ins.noBase": { lt: "dar nėra asmeninio vidurkio", en: "no personal baseline yet" },
  "hw.ins.h": { lt: "val.", en: "h" },

  "hw.ins.hrv.cause.good": {
    lt: "HRV yra tavo asmeninio lygio ar aukščiau — parasimpatinė (poilsio) nervų sistema dominuoja, organizmas jau susitvarkė su praėjusiu krūviu.",
    en: "HRV is at or above your personal level — the parasympathetic (rest) system is in charge and your body has absorbed the last training load.",
  },
  "hw.ins.hrv.cause.watch": {
    lt: "HRV nukritęs {delta}žemiau įprasto — nervų sistema vis dar apdoroja stresą (treniruotė, miego trūkumas, alkoholis ar liga).",
    en: "HRV is {delta}below your usual level — your nervous system is still processing stress (training, short sleep, alcohol or illness).",
  },
  "hw.ins.hrv.cause.bad": {
    lt: "HRV smarkiai žemiau įprasto — ryškus simpatinės sistemos dominavimas, klasikinis persitreniravimo ar ligos pradžios ženklas.",
    en: "HRV is far below your usual level — strong sympathetic dominance, the classic marker of overreaching or an incoming illness.",
  },
  "hw.ins.hrv.effect.good": {
    lt: "Todėl leidžiama pilna arba +5 % apkrova: gali kelti svorį pagrindiniame pratime.",
    en: "So full or +5% load is allowed: you can add weight on the main lift.",
  },
  "hw.ins.hrv.effect.watch": {
    lt: "Todėl siūlomas krūvis mažinamas ~10 %: tas pats svoris, viena serija mažiau.",
    en: "So the load drops ~10%: same weight, one set less.",
  },
  "hw.ins.hrv.effect.bad": {
    lt: "Todėl krūvis smunka iki 65-80 %: technikos darbas, RPE ne daugiau 7, jokių iki nesėkmės serijų.",
    en: "So the load drops to 65-80%: technique work, RPE 7 max, no sets to failure.",
  },

  "hw.ins.rhr.cause.good": {
    lt: "Ramybės pulsas įprastas arba žemesnis — širdis atsistačiusi, hidratacija ir temperatūra tvarkoje.",
    en: "Resting HR is normal or lower — your heart has recovered, hydration and temperature are fine.",
  },
  "hw.ins.rhr.cause.bad": {
    lt: "Ramybės pulsas pakilęs {delta}virš tavo normos — dažniausia priežastis: nepakankamas miegas, dehidratacija, karštis, alkoholis arba prasidedanti infekcija.",
    en: "Resting HR is {delta}above your norm — usual causes: short sleep, dehydration, heat, alcohol or an incoming infection.",
  },
  "hw.ins.rhr.effect.good": {
    lt: "Todėl kardio ir intensyvios serijos leidžiamos be apribojimų.",
    en: "So conditioning and heavy sets are allowed without limits.",
  },
  "hw.ins.rhr.effect.watch": {
    lt: "Todėl ilginamas poilsis tarp serijų (+30 s) ir mažinamas intensyvumo darbas.",
    en: "So rest between sets goes up (+30 s) and intensity work is trimmed.",
  },
  "hw.ins.rhr.effect.bad": {
    lt: "Todėl šiandien be HIIT ir be maksimalių svorių — tik lengvas judesys ir hidratacija.",
    en: "So no HIIT and no maximal loads today — easy movement and hydration instead.",
  },

  "hw.ins.sleep.targetCompare": { lt: "tikslas 7,5-9 val.", en: "target 7.5-9 h" },
  "hw.ins.sleep.cause.good": {
    lt: "Miegojai pakankamai — didžioji augimo hormono dalis išsiskiria giliojo miego metu, raumenų baltymų sintezė vyko normaliai.",
    en: "You slept enough — most growth hormone is released in deep sleep and muscle protein synthesis ran normally.",
  },
  "hw.ins.sleep.cause.watch": {
    lt: "Truputį per mažai miego — sumažėja glikogeno atstatymas ir susikaupimas, technika pradeda šlubuoti paskutinėse serijose.",
    en: "Slightly short sleep — glycogen resynthesis and focus drop, technique slips on the last sets.",
  },
  "hw.ins.sleep.cause.bad": {
    lt: "Ryškus miego trūkumas — testosterono/kortizolio santykis krenta, jėga sumažėja 3-8 %, o traumų rizika pakyla.",
    en: "Serious sleep debt — testosterone/cortisol ratio falls, strength drops 3-8% and injury risk rises.",
  },
  "hw.ins.sleep.effect.good": {
    lt: "Todėl planinis tūris paliekamas 100 %.",
    en: "So planned volume stays at 100%.",
  },
  "hw.ins.sleep.effect.watch": {
    lt: "Todėl nuimama po vieną seriją nuo pagalbinių pratimų.",
    en: "So one set is removed from each accessory exercise.",
  },
  "hw.ins.sleep.effect.bad": {
    lt: "Todėl planas trumpinamas iki pagrindinių judesių, svoris -10-20 %, be nesėkmės serijų.",
    en: "So the session shrinks to the main lifts, weight -10-20%, no failure sets.",
  },

  "hw.ins.quality.compare": { lt: "subjektyvus vertinimas", en: "subjective rating" },
  "hw.ins.quality.cause": {
    lt: "Nutrūkstantis miegas sumažina gilaus miego fazes, todėl centrinė nervų sistema atsistato lėčiau nei rodo bendros valandos.",
    en: "Fragmented sleep cuts deep-sleep phases, so the central nervous system recovers slower than the raw hours suggest.",
  },
  "hw.ins.quality.effect.good": {
    lt: "Todėl greitieji, sprogūs pratimai (šuoliai, sprintas) leidžiami.",
    en: "So explosive work (jumps, sprints) is allowed.",
  },
  "hw.ins.quality.effect.bad": {
    lt: "Todėl sprogūs ir techniškai sudėtingi judesiai keliami į kitą dieną.",
    en: "So explosive and technically demanding lifts move to another day.",
  },

  "hw.ins.activity.compare": { lt: "foninis krūvis", en: "background load" },
  "hw.ins.activity.stepsWord": { lt: "žingsnių", en: "steps" },
  "hw.ins.activity.cause.good": {
    lt: "Foninis paros aktyvumas nedidelis, todėl treniruotei lieka daugiau energijos.",
    en: "Background daily activity is moderate, so more energy is left for the session.",
  },
  "hw.ins.activity.cause.watch": {
    lt: "Labai didelis foninis aktyvumas — kojos jau gavo nemažą krūvį dar prieš treniruotę.",
    en: "Very high background activity — your legs already took a load before training.",
  },
  "hw.ins.activity.effect.good": {
    lt: "Todėl kojų diena gali vykti pilnai.",
    en: "So a full leg day is fine.",
  },
  "hw.ins.activity.effect.watch": {
    lt: "Todėl kojų tūris mažinamas, kardio pakeičiamas pasivaikščiojimu.",
    en: "So leg volume is reduced and cardio is swapped for a walk.",
  },

  "hw.ins.summary.withData": {
    lt: "Atsistatymas {score}/100 → šiandienos krūvis {mod} %. Labiausiai riboja: {limiter}.",
    en: "Recovery {score}/100 → today's load {mod}%. Main limiter: {limiter}.",
  },
  "hw.ins.summary.noData": {
    lt: "Trūksta duomenų įžvalgoms.",
    en: "Not enough data for insights.",
  },

  "hw.mot.head.lose_fat.1": { lt: "Deginam, ne dvejojam", en: "Burn it, don't debate it" },
  "hw.mot.head.lose_fat.2": { lt: "Kiekvienas judesys skaičiuoja", en: "Every move counts" },
  "hw.mot.head.lose_fat.3": { lt: "Lengviau nebus — bus stipriau", en: "It won't get easier — you'll get stronger" },
  "hw.mot.head.build_muscle.1": { lt: "Šiandien auga raumuo", en: "Muscle is built today" },
  "hw.mot.head.build_muscle.2": { lt: "Dar vienas kartojimas — dar vienas gramas", en: "One more rep, one more gram" },
  "hw.mot.head.build_muscle.3": { lt: "Statyk kūną, ne pasiteisinimus", en: "Build the body, not excuses" },
  "hw.mot.head.strength.1": { lt: "Štanga nemeluoja", en: "The bar never lies" },
  "hw.mot.head.strength.2": { lt: "Stipriau nei vakar", en: "Stronger than yesterday" },
  "hw.mot.head.strength.3": { lt: "Technika pirma, svoris antra", en: "Technique first, weight second" },
  "hw.mot.head.endurance.1": { lt: "Kvėpuok ir judėk", en: "Breathe and move" },
  "hw.mot.head.endurance.2": { lt: "Ištvermė gimsta diskomforte", en: "Endurance is born in discomfort" },
  "hw.mot.head.endurance.3": { lt: "Tempas — tavo ginklas", en: "Tempo is your weapon" },
  "hw.mot.head.default.1": { lt: "Pradėk — visa kita seks", en: "Start — the rest follows" },
  "hw.mot.head.default.2": { lt: "Disciplina > motyvacija", en: "Discipline > motivation" },
  "hw.mot.head.default.3": { lt: "Šiandien tavo diena", en: "Today is your day" },

  "hw.mot.body.high.1": {
    lt: "Organizmas atsistatęs — leisk sau sunkiausią seriją ir pridėk svorio ten, kur vakar buvo lengva.",
    en: "You're recovered — go for the heaviest set and add load where it felt easy last time.",
  },
  "hw.mot.body.high.2": {
    lt: "Žalia šviesa: šiandien gali eiti iki ribos. Paskutinis pakartojimas turi būti sunkus.",
    en: "Green light: push to the edge today. The last rep should be hard.",
  },
  "hw.mot.body.normal.1": {
    lt: "Laikykis plano ir švarios technikos — stabilus darbas duoda daugiausia rezultato per mėnesį.",
    en: "Stick to the plan and clean technique — steady work wins the month.",
  },
  "hw.mot.body.normal.2": {
    lt: "Įprastas krūvis. Nesivaikyk rekordų, vaikykis kokybės kiekvienoje serijoje.",
    en: "Normal load. Don't chase records, chase quality in every set.",
  },
  "hw.mot.body.low.1": {
    lt: "Atsistatymas žemas — sumažink svorį, palik 2–3 pakartojimus atsargoje ir baik jausdamasis geriau nei pradėjai.",
    en: "Recovery is low — drop the weight, leave 2–3 reps in reserve and finish better than you started.",
  },
  "hw.mot.body.low.2": {
    lt: "Šiandien laimi tas, kuris ateina ir padaro lengvą treniruotę, o ne tas, kuris praleidžia.",
    en: "Today the win is showing up and doing the easy session, not skipping it.",
  },

  "hw.mot.focus.high": { lt: "Intensyvumas ir progresas", en: "Intensity and progression" },
  "hw.mot.focus.normal": { lt: "Technika ir tūris", en: "Technique and volume" },
  "hw.mot.focus.low": { lt: "Atsistatymas ir judrumas", en: "Recovery and mobility" },
} as const;
