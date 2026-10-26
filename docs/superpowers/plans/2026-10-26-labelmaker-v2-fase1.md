# Labelmaker v2 — fase 1 (kern en werkscherm) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een werkende v2 op `/Labelmaker/v2/`: Rentman-export inlezen, artikelen zoeken/scannen, bordjes/stroken/labels uit de vaste DSL-sjablonen klaarzetten (met aanvullingen), per printer printen, alles bewaard in de browser.

**Architecture:** Statische site zonder bouwstap in de map `v2/` van de repository, ES-modules. Pure logica (inlezen, afleiden, sjablonen vullen, kleuren, A4-indeling) zit in DOM-vrije modules die in Node getest worden; tekenen, opslag (IndexedDB) en het werkscherm worden in headless Chromium getest. De huisstijl en opmaak worden overgenomen uit versie 25 (`index.html` in de root, functies `buildSignB`, `buildLabel`, `signLayoutWH`, `fitSign`).

**Tech Stack:** HTML/CSS/JS (ES2022 modules), IndexedDB, `node --test` (Node 22) voor unit-tests, Python 3 + pytest + Playwright (Chromium uit `/opt/pw-browsers`) + OpenCV (QR uitlezen) + openpyxl (testbestanden maken) voor browsertests.

**Spec:** `docs/superpowers/specs/2026-10-26-labelmaker-v2-design.md`

**Fase 2 (apart plan, later):** beheer met sjablooneditor, profielen-UI, Publiceren en basis laden, service worker/offline, overzetten van versie 25, losse items.

## Global Constraints

- Geen externe bronnen tijdens gebruik: geen CDN, geen Google Fonts; alles in de repository.
- Chrome en Edge (actueel); geen bouwstap; ES-modules met relatieve paden.
- Printknoppen staan in de kop rechtsboven (`header .print`), nooit in het midden van de pagina.
- Toegestane artikelvelden (en niets anders wordt bewaard): `naam, code, qr, exemplaren, pad, map, locatie, soort, type, aantal`. Nooit prijzen (verhuur, inkoop, nieuwprijs, marge, boekwaarde) of `Opmerking intern`.
- QR-inhoud is altijd de Rentman-waarde (`QR-codes / RFID`, eerste waarde) of een exemplaar-QR, nooit het artikelnummer.
- UI-teksten in het Nederlands.
- Formaten: Citizen-label 76 × 56 mm, half 76 × 28 mm; A7 staand 74 × 105 mm, liggend 105 × 74 mm; strook 180 × 48 mm; A4 210 × 297 mm.
- Huisstijl (uit v25, vast): lettertype `"DSL Futura"` (Futura Bk/Md/Hv BT, terugval Century Gothic); kleurvlak tint 25 %; volle kleurstreep 1 mm aan de binnenkant; breedte kleurvlak staand `W × 0,19`, liggend/strook `min(W × 0,15, H × 0,3)`; gatmarkering Ø 8 mm bovenin het kleurvlak; logo onderin het kleurvlak, bij strook bovenin; snijtekens 3 mm lang, 1 mm van de hoek; op A4 minimaal 8 mm tussenruimte en 5 mm marge; voettekst gecentreerd, `|` als dun grijs streepje.
- Kleurrand gitterbox (lengte → kleur): `2,5 #ffff00`, `5 #00b050`, `7,5 #0050ff`, `10 #ff0000`, `15 #7030a0`, `20 #ffffff`, `25 #ff8c00`; onbekend → `#7f7f7f`. Label doorsnede: `2,5 mm² #c00000`, `4 mm² #00a050`.
- Voettekst DSL: `DSL Geluids- & Lichtverhuur, De Fok 23, 1742 PC Schagen` / `Tel. 0224-218130 | info@dslverhuur.nl | www.dslverhuur.nl`.
- De repository is openbaar: nooit `.xlsx`/`.csv` committen; testbestanden worden tijdens de test gemaakt (map `tests/fixtures/out/`, staat in `.gitignore`).
- Elke commit eindigt met:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VBJsbdwiHe6bvqGk9T7QBb
  ```

## Review Focus

1. **Export met andere kolomvolgorde, extra kolommen, of csv met `;`, BOM en aanhalingstekens** — inlezen gaat op kolomnaam, niet op positie. Test in Task 3 (`csv_met_bom_en_puntkomma`) en Task 4 (`kolomvolgorde_maakt_niet_uit`).
2. **Rommelige QR-velden** (`"1004421,PD5143"`, `"bd6x3b-01, ,bd6x3b-02,"`) — eerste waarde, getrimd, lege weg. Test in Task 4 (`qr_eerste_waarde_en_exemplaren_opgeschoond`).
3. **Namen die op een maat lijken maar het niet zijn** (`"LK19 > 3 x NL4 Break out"`, `"4 x Speakon 2p 10m snake"`) — geen valse maat; lengte wel. Test in Task 5 (`geen_valse_maat`).
4. **Grote selectie** (200 exemplaren tegelijk) — printvel verdeelt over genoeg A4-vellen, lijst blijft bruikbaar. Test in Task 9 (`tweehonderd_stroken_paginering`) en Task 10 (`lijst_toont_maximaal_200_rijen`).
5. **Artikel zonder QR of geserialiseerd zonder exemplaren** — bordje wordt gemaakt zonder QR met zichtbare melding `Geen QR-code`; geserialiseerd zonder exemplaren valt terug op artikel-QR. Test in Task 6 (`qrs_terugval`) en Task 8 (`geen_qr_melding`).

---

## Bestandsoverzicht

```
v2/index.html              schermopbouw (kop, drie kolommen, dialoog aanvulling)
v2/css/app.css             werkscherm (tokens, licht/donker)
v2/css/opmaak.css          labels en bordjes (huisstijl, uit v25)
v2/js/qr.js                QR-codes maken (ES-module, uit v25 meegeleverde bibliotheek)
v2/js/bestanden.js         xlsx en csv lezen → string[][]
v2/js/import.js            kolommen koppelen, Rentman-voorinstelling, toegestane velden
v2/js/afleiden.js          lengte, maat, polen, kwaliteit, kale naam uit de naam
v2/js/kleuren.js           kleurnamen, tint, inkt, sleutel normaliseren
v2/js/sjablonen.js         DSL-standaardsjablonen + sjabloon vullen
v2/js/indeling.js          A4- en labelindeling (pure functies)
v2/js/opslag.js            GeheugenOpslag + IndexedDB-opslag (zelfde interface)
v2/js/opmaak.js            Inhoud → HTML-element tekenen, tekst passend maken
v2/js/printen.js           printvellen tekenen, papierformaat, printen
v2/js/werkscherm.js        lijst, zoeken/scannen, acties, printvel, voorbeeld
v2/js/app.js               opstarten
v2/assets/dsl-logo.svg     zwart DSL-logo (uit v25 DSL_LOGO)
package.json               testscripts
tests/unit/*.test.mjs      Node-tests
tests/browser/conftest.py  http-server + page-fixture
tests/browser/test_*.py    browsertests
tests/fixtures/maak_voorbeeld.py   maakt tests/fixtures/out/voorbeeld.xlsx en .csv
```

---

### Task 1: Opzet en testraamwerk

**Files:**
- Create: `v2/index.html`, `v2/css/app.css`, `v2/js/app.js`, `package.json`, `tests/browser/conftest.py`, `tests/browser/test_opzet.py`, `tests/fixtures/maak_voorbeeld.py`
- Modify: `.gitignore` (regel `tests/fixtures/out/` toevoegen)

**Interfaces:**
- Produces: `package.json` scripts `test:unit` (`python3 tests/fixtures/maak_voorbeeld.py && node --test tests/unit/`), `test:browser` (`python3 -m pytest tests/browser -q`), `test` (beide). Fixture `pagina` in conftest: opent `http://127.0.0.1:<poort>/v2/` (server = `python3 -m http.server` op de repo-root, poort vrij gekozen), geeft een Playwright-`Page` (viewport 1400 × 900).
- Produces: `maak_voorbeeld.py` schrijft `tests/fixtures/out/voorbeeld.xlsx` en `voorbeeld.csv` (`;`-gescheiden, UTF-8 met BOM) met alle 75 Rentman-kolomnamen in de echte volgorde en deze rijen (prijskolommen gevuld met nepbedragen, `Opmerking intern` = `"GEHEIM"`):

| Naam (in database) | Code | QR-codes / RFID | QR-codes / RFID exemplaren | Pad | Map (Map) | Locatie in magazijn… | Methode | Type materiaal | Huidig aantal |
|---|---|---|---|---|---|---|---|---|---|
| Speakon 4p Verlengkabel 2,5m | GE9402 | nl4-2.50m | | Materialen / Geluid / Bekabeling / Speakon / Speakon 4 polig | Speakon 4 polig | V-1-2 | Bulk | Fysiek item | 13 |
| Speakon 4p Verlengkabel 12,5m | GE9412 | nl4-12.50m | | (zelfde pad) | Speakon 4 polig | | Bulk | Fysiek item | 33 |
| Speakon 8p Koppelbus | GE9391 | nl8-koppel | | Materialen / Geluid / Bekabeling / Speakon / Speakon 8 polig | Speakon 8 polig | | Bulk | Fysiek item | 33 |
| Backdrop 6 x 3m B kwaliteit | LI8163-B | bd6x3B | `bd6x3b-01, ,bd6x3b-02,` | Materialen / Doeken / Backdrop / Backdrop B - Kwaliteit | Backdrop B - Kwaliteit | | Geserialiseerd | Fysiek item | 2 |
| Pipe & drape doek 4x3m zw satijn geplooid | PD5143 | 1004421,PD5143 | | Materialen / Z98 Doeken / Pipe en drape | Pipe en drape | | Bulk | Fysiek item | 12 |
| LK19 > 3 x NL4 Break out t.b.v. W8LM | GE9509 | LK19>3xnl4 | 1001540,1001541 | Materialen / Geluid / Bekabeling / Multikabels / LK19 Speakerkabel | LK19 Speakerkabel | | Geserialiseerd | Fysiek item | 2 |
| Kenwood TK-3201 Portofoon | CO1120 | kenporto-00 | | Materialen / Geluid / Communicatie / Portofoon | Portofoon | A1 | Geserialiseerd | Fysiek item | 12 |
| Pipe & drape set 21x3m in Flightcase [Case] | *PD1011 | 1013226 | | Materialen / Doeken / Pipe en drape / Cases | Cases | | Geserialiseerd | Virtuele combinatie | 1 |
| Speakon 4p Verlengkabel 7,5m | GE9407 | | | (pad Speakon 4 polig) | Speakon 4 polig | | Bulk | Fysiek item | 16 |

- [ ] **Step 1: Write the failing test** — `tests/browser/test_opzet.py::test_v2_laadt_met_printknoppen_rechtsboven`: `pagina.title() == "Labelmaker"`; `header .print button` telt 2 met teksten `"Print 0 op Citizen"` en `"Print 0 op A4"`, beide `disabled`; de rechterrand van de laatste knop ligt binnen 40 px van de rechterrand van de viewport; geen console-fouten.
- [ ] **Step 2: Run** `python3 -m pytest tests/browser/test_opzet.py -q` → FAIL (404 / geen elementen). Eerst `pip install pytest --break-system-packages` als pytest ontbreekt.
- [ ] **Step 3: Implement** `v2/index.html` met `<title>Labelmaker</title>`, kop (`h1`, zoekveld `#zoek`, knop `#inlezen` met verborgen `<input type=file accept=".xlsx,.csv" id="bestand">`, knop `#beheer` disabled met titel "Volgt in fase 2", `div.print` met `#printLabel` en `#printA4`), `main` met `#artikelen`, `#printvel`, `#voorbeeld`, en `<dialog id="aanvulling">`; `app.css` met kleurtokens (licht en donker zoals v25) ; `app.js` importeert niets anders nog en zet de knopteksten.
- [ ] **Step 4: Run** test → PASS. Run `python3 tests/fixtures/maak_voorbeeld.py` → bestanden bestaan.
- [ ] **Step 5: Commit** `git add v2 package.json tests .gitignore && git commit` — "v2: opzet en testraamwerk".

### Task 2: QR-codes

**Files:**
- Create: `v2/js/qr.js`, `tests/unit/qr.test.mjs`, `tests/browser/test_qr.py`

**Interfaces:**
- Produces: `qrMatrix(tekst: string, niveau: 'L'|'M'|'Q'|'H' = 'M') -> boolean[][]` (vierkant, zonder stille zone; UTF-8); `qrSvg(tekst: string, niveau = 'M') -> { svg: string, modules: number }` (svg met stille zone van 2 modules, `shape-rendering="crispEdges"`, witte achtergrond). Bron: de meegeleverde Arase-bibliotheek uit v25 (`<script>` met `QRCode for JavaScript`), omgezet naar één ES-module.

- [ ] **Step 1: Failing tests** — unit `matrix_is_vierkant`: `qrMatrix('nl4-2.50m').length === 21` en elke rij lengte 21; `utf8`: `qrMatrix('é – Wit').length >= 21` zonder fout; `te_lang_geeft_fout`: `qrMatrix('x'.repeat(3000))` gooit een `Error`. Browser `test_qr_leesbaar`: render `qrSvg(t).svg` voor `['nl4-2.50m','bd6x3b-01','1004421','é – Wit']` op 300 % schaal; OpenCV `QRCodeDetector().detectAndDecode` geeft precies `t`.
- [ ] **Step 2: Run** `node --test tests/unit/qr.test.mjs` en `python3 -m pytest tests/browser/test_qr.py -q` → FAIL.
- [ ] **Step 3: Implement** `qr.js` (bibliotheek + twee exportfuncties).
- [ ] **Step 4: Run** beide → PASS.
- [ ] **Step 5: Commit** — "v2: QR-module".

### Task 3: Excel en csv lezen

**Files:**
- Create: `v2/js/bestanden.js`, `tests/unit/bestanden.test.mjs`

**Interfaces:**
- Produces: `async leesXlsx(buffer: ArrayBuffer) -> string[][]` (eerste werkblad, cellen als tekst, gedeelde strings opgelost, lege cellen `''`, getallen als tekst zonder `.0`), `leesCsv(tekst: string) -> string[][]` (BOM weg; scheidingsteken `;`, `,` of tab bepaald op de eerste regel; aanhalingstekens en `""`), `async leesBestand(file: File) -> string[][]` (kiest op extensie). Werkt in browser én Node 22: zip uitpakken met `DecompressionStream('deflate-raw')`, XML met reguliere expressies, geen `DOMParser`.

- [ ] **Step 1: Failing tests** — `xlsx_voorbeeld`: `leesXlsx(voorbeeld.xlsx)` → 10 rijen, `rijen[0].length === 75`, `rijen[0][2] === 'Naam (in database)'`, rij met `GE9402` bevat `'nl4-2.50m'`; `csv_met_bom_en_puntkomma`: `leesCsv(voorbeeld.csv)` → zelfde kop en zelfde aantal rijen; `csv_aanhalingstekens`: `leesCsv('a;b\n"x;y";"z ""q"""')` → `[['a','b'],['x;y','z "q"']]`.
- [ ] **Step 2: Run** `npm run test:unit` → FAIL.
- [ ] **Step 3: Implement** `bestanden.js`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "v2: xlsx en csv lezen".

### Task 4: Artikelen inlezen (Rentman-voorinstelling)

**Files:**
- Create: `v2/js/import.js`, `tests/unit/import.test.mjs`

**Interfaces:**
- Consumes: `string[][]` uit Task 3.
- Produces:
  - `RENTMAN: Record<Veld, string>` = `{ naam:'Naam (in database)', code:'Code', qr:'QR-codes / RFID', exemplaren:'QR-codes / RFID exemplaren', pad:'Pad', map:'Map (Map)', locatie:'Locatie in magazijn per voorraadlocatie [Standaard voorraadlocatie]', soort:'Methode voorraadberekening', type:'Type materiaal', aantal:'Huidig aantal' }`
  - `TOEGESTANE_VELDEN = ['naam','code','qr','exemplaren','pad','map','locatie','soort','type','aantal']`
  - `type Artikel = { id: string /* = code */, naam: string, code: string, qr: string, exemplaren: string[], pad: string, map: string, locatie: string, soort: 'bulk'|'serie', type: string, combinatie: boolean, aantal: number }`
  - `importeer(rijen: string[][], kolommen = RENTMAN) -> { artikelen: Artikel[], ontbrekend: string[] }` — kolommen gezocht op naam (hoofdletterongevoelig, spaties getrimd); `ontbrekend` = velden waarvan de kolom niet bestaat (`naam` en `code` verplicht: ontbreken die, dan `artikelen = []`); rijen zonder code overgeslagen; `combinatie = /combinatie/i.test(type)`; `soort = /serial/i.test(...) ? 'serie' : 'bulk'`.

- [ ] **Step 1: Failing tests** — `kolomvolgorde_maakt_niet_uit` (kolommen geschud → zelfde uitkomst); `alleen_toegestane_velden`: voor elk artikel `Object.keys(a)` ⊆ `['id',...TOEGESTANE_VELDEN,'combinatie']` en `JSON.stringify(artikelen)` bevat niet `'GEHEIM'` en geen enkel nepbedrag; `qr_eerste_waarde_en_exemplaren_opgeschoond`: PD5143 → `qr === '1004421'`; LI8163-B → `exemplaren` `['bd6x3b-01','bd6x3b-02']`; `combinatie_herkend`: `*PD1011` → `combinatie === true`; `ontbrekende_kolom`: zonder kolom `Pad` → `ontbrekend` bevat `'pad'`, artikelen wel gevuld met `pad === ''`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `import.js`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "v2: artikelen inlezen zonder prijzen".

### Task 5: Waarden uit de naam afleiden

**Files:**
- Create: `v2/js/afleiden.js`, `tests/unit/afleiden.test.mjs`

**Interfaces:**
- Produces: `lengte(naam) -> string` (Nederlands getal, komma: `'2,5'`, `''` als geen), `maat(naam) -> string` (`'6 × 3'`, `'3,5 × 4'`, `''`), `polen(naam) -> string` (`'NL2'|'NL4'|'NL8'|''`, eerste voorkomen van `\b([248])p\b` na "Speakon"/"NL"), `kwaliteit(naam) -> 'A'|'B'|''`, `kaal(naam) -> string` (naam zonder lengte, zonder maat, zonder kwaliteitsaanduiding, dubbele spaties weg), `PATRONEN = { lengte, maat, polen, kwaliteit, kaal }`.

- [ ] **Step 1: Failing tests** (tabel-gedreven):
  - `lengte`: `'Speakon 4p Verlengkabel 12,5m'→'12,5'`, `'Speakon 2p 1 meter kabel'→'1'`, `'Speakon 2p 75m Verlengkabel zwart op haspel'→'75'`, `'Speakon 8p Verlengkabel 1.5 m'→'1,5'`, `'Speakon 8p Koppelbus'→''`, `'Backdrop 6 x 3m B kwaliteit'→''`.
  - `maat`: `'Backdrop 6 x 3m B kwaliteit'→'6 × 3'`, `'Backdrop 3.5 x 4m'→'3,5 × 4'`, `'Pipe & drape doek 4x3m zw satijn geplooid'→'4 × 3'`, `'Backdrop 1,5 x 3m'→'1,5 × 3'`.
  - `geen_valse_maat`: `'LK19 > 3 x NL4 Break out t.b.v. W8LM'→''`, `'4 x Speakon 2p 10m snake grijs Verlengkabel'→''` (en `lengte` daarvan `'10'`).
  - `polen`: `'Speakon 4p Verlengkabel 2,5m'→'NL4'`, `'Speakon 8p Koppelbus'→'NL8'`, `'Speakon 2p 1 meter kabel'→'NL2'`, `'Kenwood TK-3201 Portofoon'→''`.
  - `kwaliteit`: `'Backdrop 6 x 3m B kwaliteit'→'B'`, `'... (B-kwaliteit)'→'B'`, `'Backdrop 6 x 6m A kwaliteit'→'A'`, `'Backdrop 1 x 6m'→''`.
  - `kaal`: `'Speakon 4p Verlengkabel 12,5m'→'Speakon 4p Verlengkabel'`, `'Backdrop 6 x 3m B kwaliteit'→'Backdrop'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `afleiden.js`. Maat vereist getallen aan beide kanten van `x`/`×` en een `m` of einde-woord direct na het tweede getal, niet gevolgd door letters (zo valt `3 x NL4` af); de `4 x Speakon` valt af omdat na `x` geen getal komt.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "v2: waarden uit de naam afleiden".

### Task 6: Kleuren en DSL-sjablonen vullen

**Files:**
- Create: `v2/js/kleuren.js`, `v2/js/sjablonen.js`, `tests/unit/sjablonen.test.mjs`

**Interfaces:**
- Consumes: `Artikel` (Task 4), `PATRONEN` (Task 5).
- Produces (`kleuren.js`): `KLEURNAMEN` (geel `#ffff00`, groen `#00b050`, blauw `#0050ff`, lichtblauw `#00b0f0`, rood `#ff0000`, paars `#7030a0`, wit `#ffffff`, oranje `#ff8c00`, magenta `#c000c0`, grijs `#7f7f7f`), `tint(hex, sterkte=0.25) -> 'rgb(r,g,b)'`, `inkt(hex) -> '#000'|'#fff'`, `sleutel(tekst) -> string` (kleine letters, spaties weg, `.`→`,`, `x`→`×`).
- Produces (`sjablonen.js`):
  - Sjabloonformaat (ook voor de fase-2-editor): `{ id, naam, printer: 'label'|'a4', opmaak: 'strook'|'staand'|'liggend'|'qrlabel'|'locatie', formaat: {b, h}, gat: boolean, voet: boolean, logoBoven: boolean, velden: Veld[], plekken: { titel: Token[], groot: Token[], label: Token[], eigenschappen: {kop: string, waarde: Token[]}[], onder: Token[] }, kleuren: { rand?: {veld, waarden: Record<sleutel, hex>}, label?: {veld, waarden} }, cert: string }`; `Veld = { naam, soort: 'tekst'|'getal'|'keuze', eenheid?: string, opties?: string[], herkomst: {type:'kolom', kolom: keyof Artikel} | {type:'naam', patroon: keyof PATRONEN} | {type:'aanvulling'}, verplicht: boolean }`; `Token = string | {veld: string}`.
  - `DSL_SJABLONEN: Sjabloon[]` met ids `qrlabel`, `qrlabel-half` (76 × 28), `locatie`, `locatie-half` (76 × 28), `backdrop` (staand A7; velden Naam=kaal, Maat=maat, Kwaliteit=kwaliteit, Kleur=aanvulling keuze Zwart/Wit/Rood verplicht; groot `{Maat} m`; eigenschappen Kwaliteit, Kleur; cert `Gecertificeerd volgens DIN 4102 B1`; rand volgt Maat zonder vaste waarden), `pipe-drape` (liggend A7; Naam=kaal, Maat=maat; groot `{Maat} m`; eigenschap Inhoud = `{Naam}`), `gitterbox` (strook 180 × 48, logoBoven, geen gat, geen voet; Omschrijving=kaal, Lengte=lengte optioneel, Connector=polen, Doorsnede=aanvulling keuze `2,5 mm²`/`4 mm²` verplicht, Artikelnummer=kolom code; titel `{Omschrijving}`, groot `{Lengte} m`, label `{Connector} {Doorsnede}`, onder `Artikelnummer {Artikelnummer}`; kleuren uit Global Constraints).
  - `type Inhoud = { sjabloon: string, opmaak, formaat, titel: string, groot: string, label: {tekst: string, kleur: string} | null, eigenschappen: [string, string][], onder: string, qr: string, rand: string, cert: string, gat: boolean, voet: boolean, logoBoven: boolean }`
  - `vul(sjabloon, artikel, aanvullingen: Record<string,string>, qr: string) -> Inhoud` — tokens invullen; een plek waarvan alle velden leeg én optioneel zijn wordt `''`; onbekende kleur → `#7f7f7f`.
  - `ontbrekend(sjabloon, artikel, aanvullingen) -> Veld[]` — verplichte aanvulvelden zonder waarde.
  - `qrsVoor(artikel) -> string[]` — `soort==='serie' && exemplaren.length` → exemplaren; anders `[qr]` als `qr`; anders `['']`.
  - `standaardSjabloon(artikel, actie: 'bordje'|'qrlabel'|'locatie') -> string` — bordje: pad bevat `Speakon` → `gitterbox`; pad bevat `/ Backdrop` → `backdrop`; pad bevat `Pipe en drape` en naam bevat `doek` → `pipe-drape`; anders `qrlabel`.

- [ ] **Step 1: Failing tests** — `gitterbox_2_5`: `vul(gitterbox, GE9402, {Doorsnede:'2,5 mm²'}, 'nl4-2.50m')` → `titel 'Speakon 4p Verlengkabel'`, `groot '2,5 m'`, `label {tekst:'NL4 2,5 mm²', kleur:'#c00000'}`, `rand '#ffff00'`, `onder 'Artikelnummer GE9402'`, `qr 'nl4-2.50m'`; `koppelbus_zonder_lengte`: GE9391 → `groot ''`, `rand '#7f7f7f'`; `twaalf_vijf_onbekend`: GE9412 → `rand '#7f7f7f'`; `ontbrekende_doorsnede`: `ontbrekend(gitterbox, GE9402, {})` → één veld `Doorsnede`; `backdrop_per_exemplaar`: `qrsVoor(LI8163-B)` → `['bd6x3b-01','bd6x3b-02']`, `vul(backdrop, …, {Kleur:'Zwart'}, 'bd6x3b-01')` → `titel 'Backdrop'`, `groot '6 × 3 m'`, eigenschappen `[['Kwaliteit','B'],['Kleur','Zwart']]`; `qrs_terugval`: CO1120 (serie zonder exemplaren) → `['kenporto-00']`, GE9407 (geen QR) → `['']`; `standaardsjabloon`: GE9402→`gitterbox`, LI8163-B→`backdrop`, PD5143→`pipe-drape`, CO1120→`qrlabel`; `kleuren`: `sleutel('2.5')==='2,5'`, `inkt('#ffff00')==='#000'`, `inkt('#0050ff')==='#fff'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `kleuren.js` en `sjablonen.js`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "v2: DSL-sjablonen en vullen".

### Task 7: Opslag in de browser

**Files:**
- Create: `v2/js/opslag.js`, `tests/unit/opslag.test.mjs`, `tests/browser/test_opslag.py`

**Interfaces:**
- Produces: interface `Opslag { lees(soort, id) -> Promise<any|undefined>, schrijf(soort, id, waarde) -> Promise<void>, alle(soort) -> Promise<Array<{id, waarde}>>, wis(soort, id?) -> Promise<void> }` met `soort ∈ 'artikelen'|'aanvullingen'|'printvel'|'printlog'|'instellingen'`; `class GeheugenOpslag implements Opslag`; `async openOpslag(profiel = 'dsl') -> Opslag` (IndexedDB-database `labelmaker-<profiel>`, één objectstore per soort); `async vraagBlijvend() -> boolean` (`navigator.storage.persist()`, fouten → `false`). `schrijfVeel(soort, items: {id, waarde}[])` in één transactie (nodig voor 4.000+ artikelen).

- [ ] **Step 1: Failing tests** — unit `geheugen_crud` (schrijf/lees/alle/wis); browser `test_indexeddb_blijft_na_herladen`: in de pagina `openOpslag('test')`, `schrijfVeel('artikelen', 4000 items)`, herladen, `alle('artikelen').length === 4000`, binnen 3 s.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `opslag.js`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "v2: opslag in de browser".

### Task 8: Tekenen (opmaak en huisstijl)

**Files:**
- Create: `v2/js/opmaak.js`, `v2/css/opmaak.css`, `v2/assets/dsl-logo.svg`, `tests/browser/test_opmaak.py`

**Interfaces:**
- Consumes: `Inhoud` (Task 6), `qrSvg` (Task 2), kleuren (Task 6).
- Produces: `HUISSTIJL_DSL = { logo: 'assets/dsl-logo.svg', voet: [regel1, regel2] /* uit Global Constraints */, lettertype: 'DSL Futura' }`; `teken(inhoud: Inhoud, huisstijl = HUISSTIJL_DSL) -> HTMLElement` (afmeting in mm; `opmaak` kiest staand/liggend/strook naar v25 `buildSignB`, `qrlabel`/`locatie` naar v25 `buildLabel` en `buildLoc`); `async pasAan(el: HTMLElement) -> void` (wacht op lettertypes; tekst passend; lengte op de schrijflijn van de titel, zoals v25 `fitSign`). Lege `qr` → op de plek van de QR de tekst `Geen QR-code` (klasse `geen-qr`).

- [ ] **Step 1: Failing tests** (testpagina laadt modules, tekent op 300 %): `elk_sjabloon_past` — voor elk DSL-sjabloon met een passend voorbeeldartikel: geen tekstvak met `scrollWidth > clientWidth + 1` of `scrollHeight > clientHeight + 1`; `qr_leesbaar` — screenshot per bordje, OpenCV leest exact de verwachte QR; `strook_schrijflijn` — bij GE9402 verschilt de onderkant van de cijfers van `groot` en de titel minder dan 0,5 px (meet via een `<i>` op de baseline zoals v25); `wit_heeft_rand` — rand `#ffffff` tekent een streep met zwarte omlijning; `geen_qr_melding` — GE9407 toont `.geen-qr` met tekst `Geen QR-code`; `logo_positie` — strook: logo bovenin, backdrop: onderin met gatmarkering erboven.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `opmaak.js` en `opmaak.css` door de v25-code (root `index.html`) over te nemen en op `Inhoud` aan te sluiten; logo als bestand `assets/dsl-logo.svg` (zwart pad uit v25 `DSL_LOGO`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "v2: labels en bordjes tekenen".

### Task 9: Indeling en printen

**Files:**
- Create: `v2/js/indeling.js`, `v2/js/printen.js`, `tests/unit/indeling.test.mjs`, `tests/browser/test_printen.py`

**Interfaces:**
- Consumes: `teken`, `pasAan` (Task 8).
- Produces (`indeling.js`, puur): `a4Indeling(b: number, h: number) -> { b, h, posities: [x, y][], gedraaid: boolean }` (v25 `signLayoutWH` met marge 5, tussenruimte 8, verdeeld over het vel, kwartslag draaien als dat meer per vel oplevert); `verdeel<T>(items: T[], perVel: number) -> T[][]`.
- Produces (`printen.js`): `type PrintItem = { sjabloon: string, artikel: string, qr: string, aantal: number }`; `tekenVellen(printer: 'label'|'a4', items: PrintItem[], context) -> HTMLElement[]` (A4: items gegroepeerd per formaat, `.a4`-pagina's met snijtekens; label: één `.pagina` per label); `async print(printer, items, context, { alleenEerste = false })` — zet `@page { size: 76mm 56mm }` of `@page { size: 210mm 297mm }`, toont eerst een balk *"Kies printer: Citizen CL-E321"* / *"Kies je A4-printer"* met knop *Printen*, roept dan `window.print()` aan en geeft `true` terug.

- [ ] **Step 1: Failing tests** — unit `a7_vier_per_vel`: `a4Indeling(74,105).posities.length === 4`; `liggend_gedraaid`: `a4Indeling(105,74)` → 4 posities, `gedraaid === true`; `strook_vijf_per_vel`: `a4Indeling(180,48).posities.length === 5`; browser `tweehonderd_stroken_paginering`: 200 gitterbox-items → PDF (print-media, `prefer_css_page_size`) heeft 40 pagina's, formaat A4; `citizen_formaat`: 3 QR-labels → PDF met 3 pagina's van 76 × 56 mm (± 0,5 mm); `alleen_eerste`: met `alleenEerste` 1 pagina.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `indeling.js` en `printen.js`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "v2: indeling en printen".

### Task 10: Werkscherm

**Files:**
- Create: `v2/js/werkscherm.js`, `tests/browser/test_werkscherm.py`
- Modify: `v2/index.html`, `v2/css/app.css`, `v2/js/app.js`

**Interfaces:**
- Consumes: alles hierboven.
- Produces: `async start(root: Document, opslag: Opslag)` in `werkscherm.js`, aangeroepen vanuit `app.js` met `await openOpslag('dsl')`. Gedrag:
  - *Artikelen inlezen*: bestand kiezen → `leesBestand` → `importeer` → `schrijfVeel('artikelen')` → melding `"n artikelen ingelezen"` (en ontbrekende kolommen, als die er zijn). Combinaties standaard verborgen (vinkje *Combinaties tonen*).
  - Lijst links: categoriechips = de 12 meest voorkomende `map`-waarden + *Alle*; zoeken op naam, code, QR, exemplaar-QR, locatie (meerdere woorden = alle moeten passen, `x`/`×` en `,`/`.` gelijk); maximaal 200 rijen getoond met tekst `"200 van n getoond, zoek verder om te verfijnen"`. Rij: vinkje, naam, code · locatie, map-label.
  - Scannen: Enter in `#zoek` met exacte QR of exemplaar-QR → dat artikel aangevinkt, bij exemplaar alleen dat exemplaar.
  - Acties onder de lijst: *Bordje of strook*, *QR-label*, *Locatielabel* → per aangevinkt artikel `standaardSjabloon`, dan per QR uit `qrsVoor` (of het gescande exemplaar) een `PrintItem` (aantal 1). Ontbreken aanvullingen (`ontbrekend`), dan `#aanvulling`-dialoog per artikel met de keuzelijst; opslaan in `aanvullingen` (id = code).
  - Printvel midden: tabjes *Citizen (n)* en *A4 (n)*, rijen met kleurstip, naam, aantal-invoer, verwijderen; *Printvel leegmaken*. Opslaan in `printvel`.
  - Kop rechtsboven: `Print n op Citizen` / `Print n op A4` (`n` = som van aantallen; disabled bij 0); pijltje met *Alleen eerste*.
  - Rechts: voorbeeld van het gekozen tabje (vellen verkleind).
  - Na printen: per item een regel in `printlog` (id = tijdstip, waarde `{artikel, sjabloon, qr, aantal}`); chip *Laatst geprint* toont de artikelen van de laatste 30 dagen, nieuwste eerst.
- [ ] **Step 1: Failing tests** — `inlezen_en_zoeken`: bestand `voorbeeld.xlsx` kiezen → melding `"9 artikelen ingelezen"`, lijst toont 8 rijen (combinatie verborgen), zoeken `'nl4 12,5'` → 1 rij; `scannen_exemplaar`: `bd6x3b-02` + Enter → Backdrop aangevinkt, *Bordje of strook* → dialoog vraagt Kleur, kies `Zwart` → A4-tab telt 1 en voorbeeld toont QR `bd6x3b-02` (OpenCV); `strook_met_aanvulling`: GE9402 aanvinken → *Bordje of strook* → dialoog Doorsnede `2,5 mm²` → knop `Print 1 op A4` actief; daarna GE9402 opnieuw → géén dialoog (aanvulling bewaard); `blijft_na_herladen`: na herladen printvel en aanvulling nog aanwezig; `lijst_toont_maximaal_200_rijen`: met 1.000 nep-artikelen (via `schrijfVeel`) toont de lijst 200 rijen en de melding; `printknop_rechtsboven_na_vullen`: knoppen blijven in `header .print` rechtsboven; `laatst_geprint`: na printen (print-dialoog onderschept met `page.evaluate('window.print=()=>{}')`) toont chip *Laatst geprint* GE9402.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `werkscherm.js` en de aanpassingen in html/css/app.
- [ ] **Step 4: Run** `npm test` (alles) → PASS.
- [ ] **Step 5: Commit** — "v2: werkscherm".

### Task 11: Testversie op /v2/ zetten

**Files:** geen nieuwe; branch `v2` naar `main`.

- [ ] **Step 1:** `npm test` op `v2` → alles PASS; handmatige controle met screenshot van het werkscherm (licht en donker) en één PDF per printer.
- [ ] **Step 2:** Robin om akkoord vragen om `v2/` op de site te zetten (de root-`index.html`, versie 25, verandert niet).
- [ ] **Step 3:** Na akkoord: `git fetch origin main && git checkout main && git merge --no-ff v2 && git push origin main`; na ± 1 minuut `https://rjong-ctrl.github.io/Labelmaker/v2/` openen in headless Chromium en de opzet-test daartegen draaien.
- [ ] **Step 4:** Robin de link en een korte testlijst sturen: export inlezen, één strook, één backdrop per exemplaar, testprint Citizen en A4, scannen met de Rentman-app.
