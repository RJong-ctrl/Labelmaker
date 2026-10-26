# Labelmaker v2 — ontwerp

Datum: 26 oktober 2026
Status: ter goedkeuring (bijgewerkt na Rentman-export en met zelfstandige modus en profielen, 26 okt)

## Doel

Eén eenvoudig programma waarmee iedereen in het DSL-magazijn labels, bordjes en stroken maakt die er altijd hetzelfde uitzien, op elke pc dezelfde gegevens heeft en niets dubbel hoeft te typen. Het werkt ook buiten de DSL-locatie en voor ander werk dan DSL: DSL is het eerste *profiel*, niet ingebakken.

**Gebruikers:** Robin (beheer) en collega's, op meerdere pc's, in Chrome of Edge; daarnaast Robin zelf voor ander werk, ook thuis of onderweg.
**Succes:** een collega maakt zonder uitleg de juiste stroken of bordjes voor een reeks artikelen en print ze op de juiste printer; sjablonen, kleurcodes en aanvullingen zijn op elke pc gelijk.

**Vaste eisen (afgesproken):**
- gratis, geen abonnementen of licenties;
- QR-codes en artikelgegevens uit Rentman (voor DSL); andere bronnen via elk Excel/csv-bestand;
- werkt zelfstandig, zonder gekoppelde map en zonder internet;
- opmaak ligt vast; collega's vullen alleen in en printen;
- printknoppen rechtsboven, nooit midden op de pagina;
- huisstijl van de huidige versie 25 (kleurrand, Futura, gatmarkering, snijtekens, A7-bordjes, gitterbox-strook).

## 1. Bouwstenen en werkscherm

Drie begrippen:
- **Artikel** — uit de Rentman-export, of een *los item* dat niet in Rentman staat.
- **Sjabloon** — formaat, vaste printer (Citizen of A4) en opmaak. QR-label, locatielabel, Backdrop, Pipe & Drape en gitterbox-strook zijn allemaal sjablonen; de magazijnbak volgt later.
- **Printvel** — één per printer.

Eén werkscherm, geen tabbladen:
- **Kop:** zoek- en scanveld (naam, code, locatie), *Rentman-export inlezen*, *Beheer*, en rechtsboven de printknoppen **Print n op Citizen** en **Print n op A4** (grijs als er niets klaarstaat).
- **Links:** artikelen met filter per categorie, *Laatst geprint* en *Los item*. Aanvinken, dan *Bordje of strook*, *QR-label* of *Locatielabel*. Het sjabloon volgt de categorie (instelling in beheer); per keer afwijken kan.
- **Midden:** printvel met tabjes Citizen en A4: aantallen aanpassen, verwijderen. Geen printknop hier.
- **Rechts:** voorbeeld van het gekozen printvel.
- Ontbreekt een verplichte aanvulling (bijv. connector), dan vraagt het programma die direct bij het klaarzetten en slaat hem op.

Vervalt: drie tabbladen, tekstvak met puntkomma's, twee aparte bibliotheken.

## 1b. Zelfstandig of gedeeld, en profielen

**Twee manieren om gegevens te bewaren**, per profiel te kiezen en later te wisselen:
- **Op deze pc (zelfstandig):** alles in de browser (IndexedDB). Werkt overal, ook zonder internet. Back-up en overzetten met *Exporteren* / *Importeren* (één bestand).
- **In een gekoppelde map:** een OneDrive-map (gedeeld, zoals bij DSL) of een gewone map op de pc. Zelfde mapindeling als hieronder. *Naar map verplaatsen* zet alles wat je zelfstandig maakte in de map.

**Profielen:** een profiel is een eigen werkruimte met eigen sjablonen, kleurcodes, huisstijl (logo, voettekst, lettertype), artikelen, aanvullingen en printlog. Kiezen via een keuzelijst in de kop (bijv. *DSL ▾*).
- *DSL* — Rentman-kolommen, DSL-sjablonen en -huisstijl, gekoppeld aan de OneDrive-map.
- *Nieuw profiel* — leeg of op basis van de basissjablonen (QR-label, locatielabel, bordje staand/liggend, strook) met een neutrale huisstijl; eigen logo en voettekst instellen.
- Een gekoppelde map hoort bij één profiel; zo lopen DSL-gegevens en ander werk nooit door elkaar.

**Artikelen inlezen** (knop heet *Artikelen inlezen*): Rentman is een voorinstelling; elk ander Excel- of csv-bestand kan ook, met zelf gekozen kolommen. Losse items blijven altijd mogelijk.

**Printers per profiel:** labelprinter (standaard Citizen CL-E321, 76 × 56) en A4-printer; namen en labelformaat instelbaar, zodat de printknoppen bijv. *Print 4 op Citizen* tonen.

## 2. Gegevens

**Programma:** GitHub Pages, `https://rjong-ctrl.github.io/Labelmaker/`. Na het eerste bezoek opent het ook offline (service worker).

**Gedeelde gegevens (profiel DSL):** een gedeelde OneDrive-map `DSL Labelmaker`, op elke pc gesynchroniseerd ("Altijd op dit apparaat bewaren"). Elke pc koppelt de map één keer via de bestandstoegang van Chrome/Edge.

```
DSL Labelmaker/
├─ instellingen.json            sjablonen, kleurcodes, categorie → sjabloon, huisstijl, Rentman-kolommen, pincode (gehasht)
├─ rentman/artikelen.json       ingelezen Rentman-export, alleen de kolommen die nodig zijn
├─ artikelen/<code>.json        aanvullingen per artikel (lengte, connector, doorsnede, kleur …)
├─ losse-items/<id>.json        items buiten Rentman
└─ geprint/<datum>-<pc>.json    printlog per pc per dag
```

- **Waarom veel kleine bestanden:** OneDrive maakt bij gelijktijdige wijziging van hetzelfde bestand een conflictkopie. Per artikel en per pc een eigen bestand maakt dat zeldzaam. Het programma herkent conflictkopieën (`naam-PCNAAM.json`) en voegt ze samen: per veld wint de nieuwste wijziging.
- **Per pc (browser):** het printvel van dat moment, een kopie van de gedeelde gegevens voor als de map even niet bereikbaar is, de koppeling met de map, en alle gegevens van profielen die *op deze pc* werken.
- **Zonder map-verbinding:** werken met de laatste kopie; printen kan, beheer en aanvullingen opslaan niet (duidelijke melding).
- **Back-up:** versiegeschiedenis van OneDrive.
- **Niet in GitHub:** artikelgegevens, Rentman-exports of andere bedrijfsgegevens. De repository is openbaar; `.gitignore` weert xlsx/csv/json-gegevens.
- **Geen prijzen bewaren:** de Rentman-export bevat ook prijzen, boekwaarde en inkoop. Bij inlezen bewaart het programma alleen naam, code, QR-codes, exemplaar-QR's, pad, map, locatie, voorraadmethode en aantal. De rest wordt niet opgeslagen, ook niet in OneDrive.

## 2b. Rentman-export (Export_Materiaal, 26 okt: 4.160 regels, 75 kolommen)

Vaste koppeling, aan te passen onder *Rentman-kolommen*:

| Programma | Rentman-kolom | Opmerking |
|---|---|---|
| Naam | `Naam (in database)` | |
| Artikelnummer | `Code` | bijv. GE9402 |
| QR-code artikel | `QR-codes / RFID` | bijv. `nl4-2.50m`; bij meerdere waarden de eerste |
| QR-codes exemplaren | `QR-codes / RFID exemplaren` | kommalijst, bijv. `bd6x3b-01,bd6x3b-02` |
| Categorie | `Pad` (en `Map (Map)`) | bijv. `Materialen / Geluid / Bekabeling / Speakon / Speakon 4 polig` |
| Locatie | `Locatie in magazijn per voorraadlocatie [Standaard voorraadlocatie]` | bijv. `V-1-2`, `A1`; bij ca. 450 artikelen ingevuld |
| Soort | `Methode voorraadberekening`, `Type materiaal` | Bulk / Geserialiseerd; combinaties standaard verborgen |
| Aantal | `Huidig aantal` | |

Wat de export ons leert:
- **De QR-code is níet het artikelnummer.** Rentman scant de waarde uit `QR-codes / RFID` (bijv. `nl4-2.50m`) of een exemplaar-QR. De labels gebruiken die waarde; het artikelnummer staat er alleen als tekst op.
- **Geserialiseerde artikelen** (1.367, samen 8.240 exemplaar-QR's) krijgen per exemplaar een eigen label of bordje met de eigen QR-code. Bulkartikelen krijgen de artikel-QR.
- **Lengte en maat staan in de naam**, niet in de kolom `Lengte` (die is 0 bij kabels). Het programma haalt ze uit de naam: "Verlengkabel 12,5m" → 12,5; "Backdrop 6 x 3m" → 6 × 3; "Speakon 4p" → NL4.
- **Mappen met Z98/Z99 zijn gewoon in gebruik** (bijv. de Pipe & Drape-doeken) en worden niet weggefilterd.
- **Doorsnede (2,5 / 4 mm²) en materiaalkleur** staan niet in Rentman en worden aanvullingen.

## 3. Sjablonen en beheer

Beheer is een eigen pagina met links een lijst (sjablonen en instellingen), midden het formulier en rechts een live voorbeeld met een zelf gekozen echt artikel. Toegang achter een pincode (drempel, geen beveiliging).

Een sjabloon bestaat uit:
1. **Basis** — printer (Citizen/A4), opmaak (*Bordje staand*, *Bordje liggend*, *Strook*, *QR-label*, *Locatielabel*), formaat in mm, gatmarkering aan/uit, voettekst aan/uit.
2. **Velden** — tabel: naam, soort (tekst / getal + eenheid / keuzelijst), herkomst, verplicht ja/nee. Herkomst is een van:
   - *Rentman-kolom* (naam, code, QR, locatie …);
   - *Uit de naam*: vaste patronen om uit te kiezen (lengte in m, maat b × h, aantal polen 2p/4p/8p → NL2/NL4/NL8, kwaliteit A/B);
   - *Aanvulling*: één keer per artikel invullen, opgeslagen in de OneDrive-map.
3. **Wat waar komt** — per plek van de opmaak (titel, groot, label, eigenschappen, onderregel) velden als blokjes plus vaste tekst. Plekken met alleen lege optionele velden verdwijnen.
4. **Kleuren** — kleurrand volgt veld X met per waarde een kleur; label volgt veld Y met per waarde een kleur. Kleuren kiezen uit vaste namen (geel, groen, blauw, rood, paars, wit, oranje, magenta, lichtblauw, grijs) of een eigen kleur.

Overige instellingen (per profiel): *Categorie → sjabloon*, *Huisstijl en voettekst* (voettekst, logo, certificaat-icoon, lettertype), *Artikelen inlezen* (bron en kolommen; Rentman als voorinstelling), *Printers*, *Opslag* (op deze pc of gekoppelde map), *Pincode*.

Vast in de huisstijl en niet meer instelbaar: lettertype, sterkte en breedte van het kleurvlak, kleurstreep, gat-maat, snijtekens, plaatsing op A4.

**Standaardsjablonen (meegenomen uit versie 25):**
- *QR-label* 76 × 56 en *QR-label half* 76 × 28 (Citizen);
- *Locatielabel* 76 × 56 en half (Citizen);
- *Backdrop* A7 staand: maat en kwaliteit A/B (uit de naam), kleur zwart/wit/rood (aanvulling), certificaatregel; één bordje per exemplaar met eigen QR; rand volgt maat;
- *Pipe & Drape* A7 liggend: breedte, hoogte;
- *Gitterbox-strook* 180 × 48: omschrijving (Rentman), lengte en connector (uit de naam), doorsnede (aanvulling); rand volgt lengte (2,5 geel, 5 groen, 7,5 blauw, 10 rood, 15 paars, 20 wit, 25 oranje; 12,5 nog te bepalen); label volgt doorsnede (2,5 mm² rood, 4 mm² groen).

## 4. Printen

- Elke printknop print alleen zijn eigen printvel, met het juiste papierformaat (76 × 56 mm of A4) en zonder marges.
- Vóór het printvenster een korte melding: *"Kies printer: Citizen CL-E321"* of *"Kies je A4-printer"*.
- Pijltje naast elke printknop: *Alleen eerste label/vel* (testprint).
- Na printen: regel in `geprint/` en *Laatst geprint* bijgewerkt; printvel leegmaken met één klik.
- Later mogelijk, buiten deze versie: direct printen zonder printvenster via een hulpprogramma op de pc.

## 5. Overstap en testen

**Overstap**
- Versie 25 blijft tijdens de bouw op de site staan. v2 komt eerst op `…/Labelmaker/v2/` om te testen; pas na goedkeuring wordt v2 de hoofdversie en verhuist versie 25 naar `…/Labelmaker/v1/`.
- Eenmalige import van de huidige gegevens: in versie 25 *Exporteren*, in v2 *Oude gegevens importeren* (sjablonen, kleurcodes, opgeslagen bordjes).

**Nodig van Robin vóór het bouwen**
- ~~Een echte Rentman-export~~ ontvangen 26 okt.
- Twee pc's met de gedeelde OneDrive-map voor de map-test.

**Testen**
- *Eerst:* kleine testpagina die op twee pc's controleert of lezen, schrijven, synchroniseren en conflictkopieën in de OneDrive-map werken. Valt die test tegen, dan is het alternatief een kleine intranetpagina; dat wordt dan eerst opnieuw besproken.
- *Automatisch* bij elke wijziging: elk sjabloon renderen met voorbeeldartikelen (nagemaakte testgegevens in de vorm van de echte export, zonder prijzen); alle QR-codes uitlezen; printuitvoer controleren (papierformaat, aantal per vel, niets afgekapt); gegevenslaag testen met een nagebootste map, inclusief conflictkopieën en offline.
- *Zelfstandig:* nieuw profiel zonder map, artikelen uit een eigen Excel, exporteren en op een andere pc importeren.
- *Handmatig door Robin:* testprint Citizen en A4, scan met de Rentman-app, één collega die zonder uitleg een reeks stroken maakt.

## Opbouw van de code

Statische site zonder bouwstap, opgesplitst in kleine onderdelen met elk één taak:
- `index.html`, `css/`
- `js/model` — artikelen, sjablonen, printvellen
- `js/opslag` — één interface met twee uitvoeringen: browser (IndexedDB) en map (bestandstoegang), plus kopie per pc
- `js/profielen` — profielen kiezen, aanmaken, exporteren/importeren
- `js/import` — Excel/csv inlezen en kolommen koppelen; Rentman als voorinstelling
- `js/opmaak` — de vaste opmaken en het tekenen van labels en bordjes
- `js/printen` — printvellen, papierformaat, printlog
- `js/qr` — QR-codes (meegeleverd, geen internet nodig)
- `js/beheer`, `js/werkscherm` — de schermen
- `tests/` — automatische tests

## Buiten deze versie

Magazijnbak-sjabloon (maat volgt), direct printen zonder printvenster, koppeling met de Rentman-API, extra velden in Rentman zelf.
