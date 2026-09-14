# GYMS.LIFE pratimų medijos registras — 2026-09-14

## Apimtis ir įrodymų ribos

Audituota repo `smirnov0707/gyms-life` kopija, commit `afce99fe56cdad51ca0bb1fbcd7840d8fdde9e13`.
Katalogo šaltinis — tik skaitymui vykdytos `public.exercises` užklausos. Tai bendras pratimų katalogas, ne vartotojų duomenys.
Nenaudoti nauji išoriniai video šaltiniai, neimportuota nauja medija, nekeistas programos veikimas, duomenų bazė ar produkcinis diegimas.

**175 registro įrašai nereiškia 175 patvirtintų profesionalių video.** Šis registras atskiria numatytą pratimą, esamą failą, išmatuotus techninius duomenis, dalinę turinio peržiūrą ir naudojimo teisių įrodymus.

| Patikra | Rezultatas |
| --- | ---: |
| Katalogo pratimai / unikalūs identifikatoriai | 175 / 175 |
| Tiesioginiai MP4 susiejimai su katalogu | 10 |
| Tik JPG kadrų porą pasirenkantys įrašai | 165 |
| Rasti ir `ffprobe` perskaityti JPG failai | 350 |
| MP4 failai repo kopijoje | 11 |
| Tiesiogiai priskirti Full HD MP4 | 0 |
| MP4 su katalogui neatitinkančiu resolverio raktu | 1 |
| Šiuo auditu patvirtinti pakeitimui failai | 0 |

Visi 10 tiesiogiai priskirtų klipų: 1344 × 768, H.264, 24 k./s, apie 5,17 s.
Papildomas `kettlebell-turkish-get-up-squat-style.mp4`: 360 × 360, H.264, 10 k./s, 9,5 s; atrinktuose kadruose matoma anatominė animacija, ne tikras filmavimas. Jo resolverio raktas nėra katalogo `kb-turkish-get-up`; automatinis perpriskyrimas neatliktas.

## Tikri turinio radiniai

`lunge`: kataloge nurodyta `bodyweight`, bet esamo MP4 kadruose matomas išpuolis su hanteliais. Įrangos neatitiktis užfiksuota iš pačios medijos. Klipas nepriskirtas kitam pratimui automatiškai; ėjimo pirmyn variantas dar nepatvirtintas.

`burpee`: 2 k./s atrinktuose kadruose matoma atrama rankomis ir kojų judesiai, bet ne atsistojimo / šuolio fazė. Pilnas ciklas nepatvirtintas. Tai nėra kiekvieno originalaus kadro peržiūra.

Keliuose kituose klipuose dalis kūno arba įrangos nepatenka į kadrą. Atskiros pastabos ir SHA-256 yra duomenų faile. Profesionalios technikos, originalaus filmavimo ar autorių teisių negalima patvirtinti vien iš failo pavadinimo arba fotorealistinės išvaizdos.

## Failai

`exercise-media-audit-20260914.json` — kompaktiškas visų 175 pratimų katalogas, 350 JPG išmatuotos raiškos, 11 MP4 matavimai ir kontrolinės sumos, peržiūros pastabos bei nepatvirtintų teisių būsenos.

`build-registry.mjs` — be papildomų paketų ir be tinklo išplečia šiuos duomenis į 175 išsamius įrašus. Kiekvienas įrašas turi konkrečius failų kelius, tikėtiną pratimą iš katalogo, raišką, turinio / kilmės / licencijų būsenas. Nežinomas tikslus judesys ir pirminis autorius lieka `null`, leidimai — `unverified`; niekas nepatvirtinama automatiškai.

`build-registry.test.mjs` — 12 atskirų registro tikrinimo testų. Jie nepakeičia visos aplikacijos testų, realaus video atkūrimo ar licencijų patikros.

## Atkurti registrą

Reikia Node.js 22 arba naujesnio. Iš šio katalogo:

```sh
node --test build-registry.test.mjs
node build-registry.mjs exercise-media-audit-20260914.json /tmp/exercise-media-registry-20260914.json
```

Išvesties failas kuriamas tik jei jo dar nėra; pakartotinis vykdymas neperrašo peržiūrėto darbo. Generatorius neatsisiunčia medijos, nerašo į Supabase ir nėra prijungtas prie aplikacijos medijos parinkimo.

## Patikros metodai

Katalogo pavadinimai, įranga ir identifikatoriai sutikrinti pagal duomenų bazės grąžintą MD5: `f03f98429063e56963b90561671a66c0`.
Visų 175 JPG katalogų identifikatorių rinkinys sutikrintas atskiru SHA-256: `7a8fd4c91a4254737e977cd6afbe881f5fb9ee07a3a3c4ae172a2c89d99c8015`.
Visi 350 kodo deklaruojamų kanoninių JPG kelių rasti izoliuotoje repo kopijoje; matmenys perskaityti `ffprobe`. Išmatuotos bendros raiškos kompaktiškas saugojimas nėra spėjimas apie trūkstamus duomenis.

Visiems 11 MP4 apskaičiuotos SHA-256 kontrolinės sumos. Turiniui peržiūrėti iš esamų failų sukurti kadrų lapai: dešimčiai trumpų klipų naudota `fps=2`, animacijai `fps=1`. Šie kadrų lapai nepublikuojami repo ir nepridedami kaip nauja aplikacijos medija.

Platesnė interaktyvi Python analizė buvo sustabdyta įrankio saugos patikros ir nebaigta. Todėl neteigiama, kad atlikta išsami viso repo tekstų / licencijų dokumentų peržiūra. Atskirų medijos failų techninės patikros ir kadrų lapų peržiūros atliktos.

## Dar nepatvirtinta

Visų 175 JPG porų judesio atitiktis dar neperžiūrėta. Pirminė autorių / filmavimo kilmė, komercinio naudojimo ir self-hostingo leidimų įrodymai šiame audite nepatvirtinti. **Įrodymų nebuvimas registre nėra išvada, kad savininkas neturi teisių.**

Šiame etape atlikta tik medijos ir registro patikra. Visos aplikacijos `build`, `lint`, naršyklių testai ir dabartinio produkcinio diegimo turinys nebuvo tikrinami; pakeitimai skirti atskirai peržiūrai, ne automatiniam leidimui į production.
