# Labelmaker v2 — fase 2 (beheer, profielen, publiceren, offline, overstap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De rest van de spec: beheer met sjablooneditor, kleuren en categorie-regels, huisstijl en printers; profielen met exporteren/importeren; publiceren naar `data/<profiel>.json` en die basis bij het opstarten laden met lokale wijzigingen erbovenop; los item en per keer een ander sjabloon kiezen; offline werken; gegevens uit versie 25 overnemen; v2 wordt de hoofdversie.

**Architecture:** Fase 1 blijft staan (`v2/`, ES-modules, geen bouwstap). Nieuw is een *model*-laag (`model.js`) die per profiel de effectieve gegevens samenstelt uit drie lagen: profielstandaard → gepubliceerde basis → lokale wijzigingen. Werkscherm en beheer lezen en schrijven alleen via het model. Pure logica (samenvoegen, publiceren, v25 omzetten) is DOM-vrij en wordt in Node getest.

**Tech Stack:** zoals fase 1: HTML/CSS/JS (ES2022 modules), IndexedDB, localStorage (alleen profielenlijst), Service Worker, `node --test`, Python unittest + Playwright + OpenCV.

**Spec:** `docs/superpowers/specs/2026-10-26-labelmaker-v2-design.md`
**Vorige fase:** `docs/superpowers/plans/2026-10-26-labelmaker-v2-fase1.md`

## Global Constraints

- Alle Global Constraints van fase 1 blijven gelden (geen externe bronnen, printknoppen rechtsboven, toegestane artikelvelden, QR = Rentman-waarde, huisstijlmaten, NL-teksten, commit-attributie).
- "alles in de browser; geen OneDrive, geen gekoppelde mappen, niets installeren"; "werkt zelfstandig, ook zonder internet (na het eerste bezoek)".
- Nooit in een publicatie of profielexport naar de site: prijzen, `Opmerking intern`, de pincode, een geüpload eigen lettertype (licentie).
- Publicatiebestand: `data/<profiel-id>.json`, naast `index.html` van de app; formaat `{ type: 'labelmaker-basis', versie: 1, profiel, datum (ISO), artikelen, losseItems, sjablonen, regels, huisstijl, printers, kolommen, aanvullingen }`.
- Melding na laden basis: `Basis van <d mmm> geladen` (bijv. `Basis van 26 okt geladen`).
- "Lokale wijzigingen … gaan vóór de basis"; beheer toont *Wijzigingen op deze pc* met *Weggooien* per regel.
- Pincode: "drempel, geen beveiliging"; per pc; standaard geen pincode.
- Vast, niet instelbaar: sterkte/breedte kleurvlak, kleurstreep, gat-maat, snijtekens, plaatsing op A4.
- Kleuren: vaste namen (geel, groen, blauw, rood, paars, wit, oranje, magenta, lichtblauw, grijs) of eigen kleur; alleen `#rrggbb` wordt geaccepteerd.
- Overstap: v2 wordt de hoofdversie op `/Labelmaker/`, versie 25 verhuist naar `/Labelmaker/v1/`; `/Labelmaker/v2/` blijft werken (doorverwijzing).

## Review Focus

1. **Basis en lokale wijziging botsen** (collega vult doorsnede in, daarna nieuwe basis met andere doorsnede) — lokale waarde wint tot *Weggooien*; nieuwe velden uit de basis komen wel binnen. Test in Task 2 (`lokaal_wint_per_veld`).
2. **Kapotte of vreemde bestanden** (profielexport van een ander programma, half publicatiebestand, v25-export zonder sjablonen) — duidelijke melding, niets overschreven. Test in Task 3 (`leesBasis_weigert_rommel`), Task 4 (`v25_lege_export`), Task 7 (`profiel_import_rommel`).
3. **Offline na eerste bezoek, en een nieuwe versie van de site** — opent zonder netwerk; na een update geen mix van oude en nieuwe bestanden. Test in Task 5 (`offline_openen`, `nieuwe_versie_vervangt_cache`).
4. **Sjabloon verwijderen dat nog op het printvel of in een regel staat** — regels op het printvel verdwijnen met melding; categorie-regel valt terug op standaard. Test in Task 8 (`sjabloon_weg_printvel_en_regel`).
5. **Eigen kleur of tekst met HTML in de editor** (`"><script>`, `red`) — alleen `#rrggbb` wordt bewaard; tekst blijft tekst. Test in Task 8 (`kleur_alleen_hex`, `editor_html_blijft_tekst`).

---

## Bestandsoverzicht

```
v2/js/profielen.js     profielenlijst (localStorage), huidig profiel, aanmaken/verwijderen, export/import
v2/js/standaard.js     profielstandaarden: DSL en Basis (sjablonen, regels, huisstijl, printers, kolommen)
v2/js/samenvoegen.js   pure functies: lagen samenvoegen, wijzigingen bepalen
v2/js/model.js         effectieve gegevens per profiel; enige toegang tot opslag voor schermen
v2/js/publiceren.js    maakBasis / leesBasis / haalBasis
v2/js/oud.js           versie-25 gegevens omzetten (localStorage of exportbestand)
v2/js/beheer.js        beheerscherm (pincode, alle onderdelen)
v2/js/editor.js        sjablooneditor (onderdeel van beheer)
v2/css/beheer.css
v2/sw.js               offline (service worker)
v2/data/               gepubliceerde basisbestanden (dsl.json)
```
Aangepast: `opslag.js` (versie 2: stores `sjablonen`, `basis`, `losse`), `sjablonen.js` (kleursleutel als tokens, regels, vrije regels, kleurcontrole), `opmaak.js` (huisstijl: logo, voet, lettertype), `printen.js` (labelformaat uit instelling), `werkscherm.js`, `app.js`, `index.html`.

---

### Task 1: Opslag versie 2, sjablonen uitbreiden, profielstandaarden

**Files:**
- Modify: `v2/js/opslag.js`, `v2/js/sjablonen.js`
- Create: `v2/js/standaard.js`, `tests/unit/standaard.test.mjs`
- Test: `tests/unit/sjablonen.test.mjs`, `tests/unit/opslag.test.mjs`, `tests/browser/test_opslag.py`

**Interfaces:**
- Produces (`opslag.js`): `SOORTEN` uitgebreid met `'sjablonen'`, `'basis'`, `'losse'`; `VERSIE = 2`, upgrade maakt ontbrekende stores aan (bestaande gegevens blijven).
- Produces (`sjablonen.js`):
  - `kleuren.rand` / `kleuren.label` = `{ sleutel: Token[], waarden: Record<sleutel, hex> }`; oud formaat `{ veld, waarden }` blijft werken (= `sleutel: [{veld}]`).
  - `Sjabloon.regelsVeld?: string` — dat veld bevat regels `Kop: waarde` (één per regel) die als eigenschappen verschijnen (voor vrije bordjes uit v25).
  - `geldigeKleur(hex) -> string|null` (`/^#[0-9a-f]{6}$/i`, kleine letters terug; anders `null`).
  - `standaardSjabloon(artikel, actie, regels = DSL_REGELS) -> string`; `Regels = { bordje: {pad?: string, naam?: string, sjabloon: string}[], standaard: { bordje: string, qrlabel: string, locatie: string } }` (`pad`/`naam` = hoofdletterongevoelig "bevat"); losse items (`artikel.sjabloon`) gebruiken altijd hun eigen sjabloon.
  - `DSL_REGELS` = huidige vaste regels (speakon→gitterbox, `/ backdrop`→backdrop, `pipe en drape`+naam `doek`→pipe-drape; standaard qrlabel/qrlabel/locatie).
- Produces (`standaard.js`): `PROFIEL_STANDAARD: Record<'dsl'|'basis', { sjablonen, regels, huisstijl, printers, kolommen }>`; `printers = { label: { naam: 'Citizen CL-E321', b: 76, h: 56 }, a4: { naam: 'A4-printer' } }`; `huisstijl = { logo: string|null, voet: string[], certIcoon: string|null, lettertype: 'futura'|'barlow'|'arial' }`; DSL: huisstijl uit `HUISSTIJL_DSL`, kolommen `RENTMAN`; basis: vijf sjablonen `qrlabel`, `locatie`, `bordje-staand`, `bordje-liggend`, `strook` met velden Naam (kolom naam), Code (kolom code), Groot (aanvulling tekst, optioneel), Omschrijving (aanvulling tekst, optioneel); logo `null`, voet `[]`, lettertype `futura`; kolommen `{ naam: 'Naam', code: 'Code', qr: 'QR', exemplaren: 'Exemplaren', locatie: 'Locatie', map: 'Categorie' }`.

- [ ] **Step 1: Failing tests** — `opslag_upgrade_v1_naar_v2` (browser: maak DB versie 1 met een artikel, open met `openOpslag` → artikel nog aanwezig, `alle('sjablonen')` werkt); `kleursleutel_tokens` (`vul` met `rand: {sleutel:[{veld:'Breedte'},' × ',{veld:'Hoogte'}], waarden:{'6×3,5':'#c000c0'}}` → `rand '#c000c0'`); `oud_kleurformaat_werkt` (gitterbox ongewijzigd → `#ffff00`); `regelsveld` (veld `Regels` = `"Breedte: 6 m\nKleur: Zwart\nlos"` → eigenschappen `[['Breedte','6 m'],['Kleur','Zwart'],['','los']]`); `geldige_kleur` (`'#FFAA00'→'#ffaa00'`, `'red'→null`, `'"><b>'→null`); `regels_instelbaar` (regel `{pad:'Portofoon', sjabloon:'qrlabel-half'}` → CO1120 `bordje` → `qrlabel-half`); `los_item_eigen_sjabloon`; `standaard_profielen` (DSL heeft 7 sjablonen, basis 5; elk sjabloon tekent zonder fout via `vul`).
- [ ] **Step 2: Run** `npm run test:unit` en de browsertest → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` → PASS (fase-1-tests blijven groen).
- [ ] **Step 5: Commit** — "v2: opslag v2, regels en profielstandaarden".

### Task 2: Model — lagen samenvoegen en wijzigingen

**Files:**
- Create: `v2/js/samenvoegen.js`, `v2/js/model.js`, `tests/unit/samenvoegen.test.mjs`, `tests/unit/model.test.mjs`

**Interfaces:**
- Consumes: `Opslag` (fase 1 + Task 1), `PROFIEL_STANDAARD`.
- Produces (`samenvoegen.js`, puur):
  - `samen(standaard, basis|null, lokaal) -> Effectief` met `Effectief = { sjablonen: Sjabloon[], regels, huisstijl, printers, kolommen, artikelen: Artikel[], losseItems: Artikel[], aanvullingen: Record<id, Record<veld, string>>, basisDatum: string|null }`. Regels: sjablonen per `id` (lokaal > basis > standaard; lokaal `{id, verwijderd:true}` haalt weg); `regels/huisstijl/printers/kolommen` per sleutel lokaal > basis > standaard; artikelen = lijst met de nieuwste datum (`lokaal.artikelenDatum` vs `basis.datum`); losse items en aanvullingen per id, aanvullingen per veld (lokaal > basis).
  - `wijzigingen(basis|null, lokaal) -> Wijziging[]`, `Wijziging = { soort: 'sjabloon'|'instelling'|'aanvulling'|'artikelen'|'los', id: string, veld?: string, omschrijving: string }` — alleen waar lokaal afwijkt van basis (bij geen basis: alles wat lokaal is).
- Produces (`model.js`): `async laadModel(opslag, profielId) -> Model`; `Model` met `effectief(): Effectief`, `async zetSjabloon(s)`, `async verwijderSjabloon(id)`, `async zetInstelling(sleutel: 'regels'|'huisstijl'|'printers'|'kolommen', waarde)`, `async zetAanvulling(id, waarden)`, `async zetArtikelen(artikelen)` (vervangAlle + `artikelenDatum = nu`), `async zetLosItem(item)`, `async verwijderLosItem(id)`, `async laadBasis(json) -> boolean` (alleen als `json.datum` nieuwer dan bewaarde basis), `wijzigingen()`, `async gooiWeg(w: Wijziging)`, `async instelling(sleutel)` / `async zetPcInstelling(sleutel, waarde)` voor pc-gebonden zaken (`werkscherm`, `pincode`, `eigenLettertype`) die nooit gepubliceerd worden. Lokale lagen staan in de stores `sjablonen`, `instellingen` (sleutels `regels`, `huisstijl`, `printers`, `kolommen`, `artikelenDatum`), `aanvullingen`, `losse`, `artikelen`; de basis in `basis` (id `'basis'`).

- [ ] **Step 1: Failing tests** — `alleen_standaard` (geen basis/lokaal → DSL-sjablonen); `basis_over_standaard`; `lokaal_wint_per_veld` (basis aanvulling `{Doorsnede:'2,5 mm²', Kleur:'Wit'}`, lokaal `{Doorsnede:'4 mm²'}` → `{Doorsnede:'4 mm²', Kleur:'Wit'}`); `sjabloon_lokaal_verwijderd`; `nieuwste_artikellijst_wint` (basis 27 okt vs lokaal 26 okt → basis; omgekeerd lokaal); `wijzigingen_lijst` (één aanvulling-, één sjabloon-, één instelling-wijziging, omschrijvingen in het Nederlands); `gooiWeg_herstelt_basis`; `laadBasis_alleen_nieuwer` (zelfde datum → `false`); model met `GeheugenOpslag` overleeft opnieuw laden (`laadModel` op dezelfde opslag geeft dezelfde `effectief()`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "v2: model met basis en lokale wijzigingen".

### Task 3: Publiceren en basis ophalen

**Files:**
- Create: `v2/js/publiceren.js`, `tests/unit/publiceren.test.mjs`

**Interfaces:**
- Consumes: `Effectief` (Task 2), `TOEGESTANE_VELDEN`.
- Produces: `maakBasis(effectief, profielId, datum = new Date()) -> object` (formaat uit Global Constraints; artikelen en losse items opnieuw gefilterd op `id`, `combinatie`, `sjabloon` en `TOEGESTANE_VELDEN`; huisstijl zonder eigen lettertype); `leesBasis(tekst: string) -> { basis } | { fout: string }` (controleert `type`, `versie`, datum, arrays; Nederlandse foutmelding); `async haalBasis(profielId, fetcher = fetch) -> object|null` (`fetch('data/<id>.json', {cache:'no-cache'})`, netwerkfout of 404 → `null`); `bestandsnaam(profielId) -> '<id>.json'`; `korteDatum(iso) -> '26 okt'`.

- [ ] **Step 1: Failing tests** — `basis_zonder_verboden_velden` (effectief met artikel dat extra velden `prijs`, `Opmerking intern` heeft en instelling `pincode` → JSON bevat ze niet); `basis_rondreis` (`leesBasis(JSON.stringify(maakBasis(e)))` → zelfde sjablonen/aanvullingen); `leesBasis_weigert_rommel` (`'{}'`, `'[]'`, `'nee'`, `{type:'labelmaker-basis', versie: 9}` → `fout` met tekst); `haalBasis_offline` (fetcher gooit → `null`); `korte_datum` (`'2026-10-26T20:00:00Z'` → `'26 okt'`).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** — "v2: publiceren en basis ophalen".

### Task 4: Gegevens uit versie 25 omzetten

**Files:**
- Create: `v2/js/oud.js`, `tests/unit/oud.test.mjs`, `tests/fixtures/v25-voorbeeld.json`

**Interfaces:**
- Consumes: Sjabloonformaat (Task 1), `PROFIEL_STANDAARD.dsl`.
- Produces: `leesV25({ export?: object, opslag?: { get(k): string|null } }) -> { sjablonen: Sjabloon[], kleurenDsl: Record<'backdrop'|'pipe-drape'|'gitterbox', Record<sleutel,hex>>, losseItems: Artikel[], aanvullingen: Record<id, Record<veld,string>>, telling: { sjablonen, bordjes, labels, locaties } }`.
  - Bronnen: v25-export (`{type:'labelmaker-bordjes', bordjes, sjablonen, certicoon}`) en/of localStorage-sleutels `lm-tpls`, `lm-signs`, `lm-lib` (`[{t1,t2,qr}]`), `lm-loc` (regels `code<TAB of ;>omschrijving<…>aantal`), `lm-certicon`.
  - v25-standaardsjablonen `t-backdrop`, `t-pd`, `t-gbkabel`: niet als nieuw sjabloon, alleen hun `colors` naar `kleurenDsl` (sleutels via `sleutel()`).
  - Andere v25-sjablonen → Sjabloon met id `v25-<id>`: `fields` (`key | Label | tekst/getal/keuze | eenheid of opties | optioneel`) → velden met herkomst aanvulling; `titel`/`hero`/`regels`/`xl`+`xt`/`badge` → plekken titel/groot/`regelsVeld`/label; `fmt` P/L → `staand`/`liggend` 74×105/105×74 (of `w`×`h`; `h` ≤ 60 en `w/h` ≥ 2,6 → `strook`); `nohole`/`nofoot`/`logotop`; `ckey`+`colors` → `kleuren.rand.sleutel`; `bkey`+`bcolors` → `kleuren.label`.
  - Opgeslagen bordjes → losse items (`id 'v25-<id>'`, `naam` = titel, `sjabloon` = `v25-<tpl>` of `vrij-staand`/`vrij-liggend`, `qr`/`exemplaren` uit de QR-regels, aanvullingen = `vals` of `{Titel, Groot, Regels}`); vrije sjablonen `vrij-staand`, `vrij-liggend` worden meegegeven als ze nodig zijn.
  - `lm-lib` → losse items met sjabloon `qrlabel` (`naam` t1, `locatie` t2, `qr`); `lm-loc` → losse items met sjabloon `locatie`.

- [ ] **Step 1: Failing tests** (fixture = echte v25-structuren uit root `index.html`: `TPL_DEF` + 2 bordjes (één uit sjabloon, één vrij) + 2 labels + 2 locaties) — `v25_kleuren_naar_dsl` (`kleurenDsl.backdrop['6×3,5'] === '#b000b0'`, `gitterbox['25'] === '#ff8c00'`); `v25_eigen_sjabloon` (id `v25-…`, velden en plekken kloppen, `vul` tekent zonder lege titel); `v25_bordjes_naar_losse_items` (QR's per regel → `exemplaren`); `v25_labels_en_locaties`; `v25_lege_export` (`{type:'labelmaker-bordjes', bordjes:[]}` → alles leeg, geen fout); `v25_kapotte_opslag` (`lm-tpls` = `'{kapot'` → genegeerd, rest werkt).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** — "v2: gegevens uit versie 25 omzetten".

### Task 5: Offline (service worker)

**Files:**
- Create: `v2/sw.js`, `tests/browser/test_offline.py`
- Modify: `v2/js/app.js`

**Interfaces:**
- Produces: `sw.js` met `const VERSIE = '<datum-tijd>'`; installeert cache `labelmaker-<VERSIE>` met alle app-bestanden (lijst `BESTANDEN` in sw.js: index.html, css, js, fonts, assets); app-bestanden: cache eerst; `data/*.json`: netwerk eerst, val terug op cache; bij activeren oude caches weg; `self.skipWaiting()` + `clients.claim()`. `app.js` registreert `sw.js` alleen op `http(s)` en meldt na een update *"Nieuwe versie geladen"* bij de volgende start.
- Test (`tests/unit/sw_bestanden.test.mjs`): elk bestand in `v2/` (behalve `data/`) staat in `BESTANDEN` en omgekeerd — anders vergeet een update een bestand.

- [ ] **Step 1: Failing tests** — `offline_openen` (pagina laden, wachten op `navigator.serviceWorker.ready`, `context.set_offline(True)`, herladen → `#printLabel` zichtbaar, geen console-fouten, lettertype DSL Futura geladen); `nieuwe_versie_vervangt_cache` (sw.js met andere VERSIE serveren via `route` → na activeren bestaat alleen de nieuwe cache); `sw_bestanden_compleet` (unit).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** — "v2: offline werken".

### Task 6: Huisstijl en printerformaat uit het profiel

**Files:**
- Modify: `v2/js/opmaak.js`, `v2/js/printen.js`, `v2/css/opmaak.css`
- Test: `tests/browser/test_opmaak.py`, `tests/browser/test_printen.py`

**Interfaces:**
- Consumes: `huisstijl`, `printers` (Task 1).
- Produces: `teken(inhoud, huisstijl)` gebruikt `huisstijl.logo` (geen logo → kleurvlak zonder logo, label zonder logo), `huisstijl.voet` (leeg → geen voettekst, ook als sjabloon `voet: true`), `huisstijl.certIcoon` (icoon vóór de certificaatregel), `huisstijl.lettertype` (`futura` → `"DSL Futura"`, `barlow` → `"DSL Label"`, `arial` → Arial; `eigen` → `"DSL Eigen"`); `context.printers.label` bepaalt het labelformaat (`@page`, pagina-afmeting, halve labels = `h/2`); `PRINTERS[printer].tekst` wordt `Kies printer: <naam>` / `Kies je A4-printer`.
- [ ] **Step 1: Failing tests** — `zonder_logo_en_voet`; `cert_icoon_getoond`; `lettertype_keuze` (bordje met `arial` → computed font-family begint met `Arial`); `ander_labelformaat` (printers.label 100×50 → PDF-pagina 100 × 50 mm, melding met printernaam).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** — "v2: huisstijl en printerformaat per profiel".

### Task 7: Werkscherm — profielen, los item, sjabloon kiezen, basis laden, kolommen koppelen

**Files:**
- Create: `v2/js/profielen.js`, `tests/unit/profielen.test.mjs`
- Modify: `v2/js/werkscherm.js`, `v2/js/app.js`, `v2/index.html`, `v2/css/app.css`
- Test: `tests/browser/test_werkscherm.py`, `tests/browser/test_profielen.py`

**Interfaces:**
- Consumes: `Model` (Task 2), `haalBasis`/`korteDatum` (Task 3).
- Produces (`profielen.js`): `profielen() -> {id, naam}[]` (altijd minstens `{id:'dsl', naam:'DSL'}`), `huidigProfiel() -> id`, `kiesProfiel(id)`, `async maakProfiel(naam, vanuit: 'leeg'|'basis') -> id` (id = slug van naam, uniek), `async verwijderProfiel(id)` (niet `dsl`), `async exporteerProfiel(opslag, id) -> object` (`{type:'labelmaker-profiel', versie:1, profiel:{id,naam}, gegevens: {soort: [{id,waarde}]}}` zonder `pincode` en `eigenLettertype`), `async importeerProfiel(json) -> id` (fout bij ander type → `Error` met Nederlandse tekst; bestaand id → naam + ' (2)').
- Werkscherm (start-signatuur wordt `start(root, model, { waarschuwing, profielId })`):
  - Kop: `<select id="profiel">` links van het zoekveld met profielen + `Nieuw profiel…`; wisselen herlaadt de pagina met dat profiel.
  - Bij start: `haalBasis(profielId)` → `model.laadBasis(json)` → melding `Basis van 26 okt geladen`.
  - Lijst: chip *Losse items* (alleen als er zijn); knop `#losItem` *Los item* opent dialoog: sjabloon kiezen, velden van dat sjabloon (kolomvelden naam/code/qr/locatie als invoer, aanvullingen als invoer/keuze), opslaan → los item verschijnt aangevinkt.
  - Acties: `<select id="sjabloonKeuze">` *Automatisch* + alle sjablonen; gekozen sjabloon geldt voor deze actie (daarna terug op Automatisch).
  - Inlezen: ontbreken `naam` of `code`, dan dialoog *Kolommen koppelen* met per veld een keuzelijst uit de kolomkoppen; bewaren via `model.zetInstelling('kolommen', …)` en daarna inlezen.
  - Alle lezen/schrijven via het model (geen directe opslag meer).
- [ ] **Step 1: Failing tests** — unit `profiel_maken_en_slug` (`'Thuis werk'` → `'thuis-werk'`, tweede keer `'thuis-werk-2'`); `profiel_export_zonder_pincode`; `profiel_import_rommel` (`{type:'iets'}` → Error `Dit is geen profielbestand van de Labelmaker.`); browser `basis_wordt_geladen` (route `**/data/dsl.json` → basis met datum 26 okt en een aanvulling → melding `Basis van 26 okt geladen`, strook GE9402 vraagt geen doorsnede meer); `nieuw_profiel_is_leeg_en_los` (nieuw profiel 'Thuis' vanuit basis → geen artikelen, DSL-artikelen niet zichtbaar, sjabloonkeuze toont 5 sjablonen); `los_item_maken` (Los item, sjabloon QR-label, naam 'Testkist', QR 'tk-1' → staat op printvel na QR-label, voorbeeld leest QR `tk-1`); `sjabloon_per_keer` (GE9402 met keuze `qrlabel-half` → Citizen (1), daarna keuze weer Automatisch); `kolommen_koppelen` (csv met koppen `Omschrijving;Nummer` → dialoog, kies → `1 artikel ingelezen`, tweede keer geen dialoog).
- [ ] **Step 2–4:** FAIL → implement → PASS (alle fase-1-tests blijven groen; testhelpers aanpassen waar `start` een model krijgt).
- [ ] **Step 5: Commit** — "v2: profielen, los item, sjabloon kiezen, basis laden".

### Task 8: Beheer

**Files:**
- Create: `v2/js/beheer.js`, `v2/js/editor.js`, `v2/css/beheer.css`, `tests/browser/test_beheer.py`
- Modify: `v2/index.html` (`<section id="beheerScherm" hidden>`), `v2/js/werkscherm.js` (knop Beheer → `#beheer`), `v2/js/app.js` (hash `#beheer` toont beheer)

**Interfaces:**
- Consumes: `Model` (Task 2), `maakBasis`/`leesBasis`/`bestandsnaam` (Task 3), `leesV25` (Task 4), `profielen.js` (Task 7), `teken`/`pasAan`.
- Produces: `async startBeheer(root, model, { profielId })`. Indeling: links lijst `#beheerMenu` (Sjablonen met elk sjabloon + *Nieuw sjabloon*, Categorie → sjabloon, Huisstijl, Printers, Artikelen inlezen, Publiceren, Wijzigingen op deze pc, Profielen, Oude gegevens (versie 25), Pincode), midden formulier `#beheerForm`, rechts `#beheerVoorbeeld` met artikelkeuze (`<input list>` op naam/code) en live voorbeeld. Knop *Terug naar werkscherm*. Pincode: staat er een pincode, dan eerst `#pincode`-invoer; fout → `Onjuiste pincode`.
- Editor (`editor.js`): `tekenEditor(doel, sjabloon, { opWijziging })` met vier blokken: **Basis** (naam, printer, opmaak, breedte/hoogte mm, gat, voettekst, logo boven), **Velden** (tabel: naam, soort tekst/getal/keuze, eenheid of opties (`;`-gescheiden), herkomst kolom/uit de naam/aanvulling met tweede keuzelijst, verplicht, *alleen als* veld; rij toevoegen/verwijderen), **Wat waar komt** (per plek titel/groot/label/onder een tekstveld met `{Veld}`-blokjes die je aanklikt om in te voegen; eigenschappen als rijen kop + waarde), **Kleuren** (rand: sleutel-tekstveld + tabel waarde → kleur met naamkeuze of eigen kleur; label idem). Wijzigingen worden na 300 ms bewaard via `model.zetSjabloon` en het voorbeeld ververst. Knoppen *Dupliceren*, *Verwijderen* (DSL-standaardsjablonen kunnen niet weg, wel terugzetten = lokale wijziging weggooien).
- Overige onderdelen: **Categorie → sjabloon** (regels-tabel pad bevat / naam bevat / sjabloon; standaard per actie); **Huisstijl** (voettekstregels, logo- en certificaaticoon-upload als data-URL ≤ 300 kB, lettertype futura/barlow/arial/eigen; eigen lettertype-upload `.ttf/.otf/.woff/.woff2` als pc-instelling met uitleg *wordt niet gepubliceerd*); **Printers** (naam + b × h labelprinter, naam A4-printer); **Artikelen inlezen** (Rentman-voorinstelling of eigen kolomnamen per veld); **Publiceren** (knop *Publicatiebestand maken* → download `dsl.json` + uitleg: upload in GitHub naar `data/` of stuur naar Claude; laatste basisdatum tonen); **Wijzigingen op deze pc** (lijst uit `model.wijzigingen()` met *Weggooien*); **Profielen** (nieuw, hernoemen, exporteren als bestand, importeren, verwijderen); **Oude gegevens** (knop *Uit deze browser overnemen* = `leesV25({opslag: localStorage})` en *Exportbestand kiezen*; toont telling; overnemen zet sjablonen, losse items, aanvullingen en DSL-kleuren als lokale wijzigingen); **Pincode** (instellen/wissen, pc-instelling).
- [ ] **Step 1: Failing tests** — `pincode_drempel`; `sjabloon_bewerken_live` (gitterbox, kleur voor `12,5` op oranje → voorbeeld met GE9412 toont rand `rgb(255, 140, 0)`; werkscherm daarna ook); `nieuw_sjabloon_en_veld` (nieuw sjabloon *Kist* staand, veld `Inhoud` aanvulling verplicht, plek titel `{Naam}` → in werkscherm sjabloonkeuze, vraagt Inhoud); `sjabloon_weg_printvel_en_regel` (eigen sjabloon op printvel en in categorie-regel, verwijderen → printvelregel weg met melding, regel valt terug); `kleur_alleen_hex` (eigen kleur `red` → niet bewaard, melding); `editor_html_blijft_tekst` (titel `"><img onerror=…>` → in voorbeeld als tekst); `publiceren_download` (download-event, bestand `dsl.json` leesbaar met `leesBasis`, zonder pincode/prijzen); `wijzigingen_weggooien` (aanvulling lokaal, basis geladen → lijst toont 1 → Weggooien → basiswaarde); `v25_overnemen` (localStorage gevuld met fixture → *Uit deze browser overnemen* → melding met telling, backdrop-kleur 6×3,5 actief, losse items zichtbaar in werkscherm); `huisstijl_logo_upload`; `profiel_export_import` (exporteren → nieuw profiel importeren → zelfde sjablonen); alle knoppen bruikbaar met toetsenbord (focus zichtbaar).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** — "v2: beheer".

### Task 9: Overstap — v2 wordt de hoofdversie

**Files:**
- Move: root `index.html` → `v1/index.html`; `v2/*` → root (`index.html`, `css/`, `js/`, `fonts/`, `assets/`, `sw.js`, `data/`)
- Create: `v2/index.html` (doorverwijzing naar `../` met behoud van `#beheer`), `data/dsl.json` (eerste DSL-basis)
- Modify: tests (pad `/` i.p.v. `/v2/`), `README.md`

**Interfaces:**
- `data/dsl.json` = `maakBasis` van: de echte Rentman-export (alleen toegestane velden), DSL-sjablonen, DSL-regels/huisstijl/printers/kolommen, geen aanvullingen; datum = moment van maken. Gemaakt met een script buiten de repository; de export zelf nooit committen.
- IndexedDB en localStorage zijn per origin, dus gegevens van `/v2/` blijven beschikbaar op `/`; versie 25 blijft zijn eigen `lm-*`-sleutels lezen op `/v1/`.
- [ ] **Step 1: Failing test** — `tests/browser/test_overstap.py`: `/` toont v2 (`#printLabel`), `/v1/` toont versie 25 (titel `DSL Labelmaker`), `/v2/` stuurt door naar `/`; `data/dsl.json` laadt met `leesBasis` zonder fout en bevat geen sleutel buiten de toegestane velden; het werkscherm toont na laden ≥ 4.000 artikelen en melding `Basis van …`.
- [ ] **Step 2–4:** FAIL → verplaatsen → PASS (`npm test` volledig).
- [ ] **Step 5: Commit en publiceren** — "Labelmaker v2 wordt de hoofdversie; versie 25 op /v1/".
