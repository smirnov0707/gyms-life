export const extra_nat1 = {
  "ar.calib.stand.title": { lt: "1. Stovėk ramiai", en: "1. Stand still" },
  "ar.calib.stand.instruction": {
    lt: "Atsistok visu ūgiu kadre (nuo galvos iki pėdų), rankos prie šonų, nejudėk 5 sekundes.",
    en: "Stand with your whole body in frame (head to feet), arms at your sides, hold still for 5 seconds.",
  },
  "ar.calib.scale.title": { lt: "2. Rankos į šonus (T)", en: "2. Arms out (T-pose)" },
  "ar.calib.scale.instruction": {
    lt: "Ištiesk rankas į šonus tiesia linija — taip patikrinamas mastelis centimetrais pagal tavo ūgį.",
    en: "Stretch your arms out sideways in a straight line — this verifies the centimetre scale against your height.",
  },
  "ar.calib.move.title": { lt: "3. Du lėti pusiau pritūpimai", en: "3. Two slow half squats" },
  "ar.calib.move.instruction": {
    lt: "Atlik du lėtus pusiau pritūpimus — tikrinama, ar sekimas nedingsta judant.",
    en: "Perform two slow half squats — this checks that tracking survives movement.",
  },
  "ar.metric.vis": { lt: "Taškų matomumas", en: "Landmark visibility" },
  "ar.metric.steady": { lt: "Stabilumas", en: "Stability" },
  "ar.metric.frame": { lt: "Kūnas kadre", en: "Body in frame" },
  "ar.metric.scale": { lt: "Mastelis (rankų mostas / ūgis)", en: "Scale (wingspan / height)" },
  "ar.metric.track": { lt: "Sekimas judant", en: "Tracking during movement" },
  "ar.metric.depth": { lt: "Užfiksuotas judesio diapazonas", en: "Captured range of motion" },
  "ar.reliability.high": { lt: "Aukštas patikimumas", en: "High reliability" },
  "ar.reliability.medium": { lt: "Vidutinis patikimumas", en: "Medium reliability" },
  "ar.reliability.low": { lt: "Žemas patikimumas", en: "Low reliability" },
  "ar.noData": { lt: "nėra duomenų", en: "no data" },
  "ar.tip.stand": {
    lt: "Atitrauk telefoną toliau, kad tilptum visu ūgiu, ir pastatyk jį ant stabilaus paviršiaus per juosmens aukštį.",
    en: "Move the phone further away so your whole body fits, and place it on a stable surface at waist height.",
  },
  "ar.tip.scale": {
    lt: "Patikrink įvestą ūgį ir stovėk statmenai kamerai — įstrižas kampas iškreipia centimetrų mastelį.",
    en: "Check the height you entered and stand square to the camera — an angled view distorts the centimetre scale.",
  },
  "ar.tip.move": {
    lt: "Pagerink apšvietimą iš priekio ir dėvėk kontrastingus drabužius — sekimas dingsta prie prasto kontrasto.",
    en: "Add light from the front and wear contrasting clothing — tracking drops out in low contrast.",
  },
  "ar.tip.ok": {
    lt: "Matavimas patikimas — kampai ir gylis centimetrais rodomi be papildomos paklaidos.",
    en: "Measurement is reliable — angles and depth in centimetres are shown without extra error margin.",
  },
  "ar.note.high": {
    lt: "Galima pradėti pratimus: kampų paklaida apie ±3°, gylio – apie ±2 cm.",
    en: "Ready to train: angle error is about ±3°, depth error about ±2 cm.",
  },
  "ar.note.medium": {
    lt: "Galima treniruotis, bet kampų paklaida apie ±7°. Ištaisyk žemiau nurodytus dalykus tikslesniam rezultatui.",
    en: "You can train, but angle error is about ±7°. Fix the points below for sharper feedback.",
  },
  "ar.note.low": {
    lt: "Nerekomenduojama pradėti: sekimas per silpnas, korekcijos rodyklės gali klaidinti. Perkalibruok.",
    en: "Not recommended yet: tracking is too weak and correction arrows may mislead. Recalibrate.",
  },
} as const;
