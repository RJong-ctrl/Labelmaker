# Labelmaker v2 — ontwerp

Datum: 26 oktober 2026
Status: ter goedkeuring (versie 3: alles in de browser, gedeelde basis via de site)

## Doel

Eén eenvoudig programma waarmee iedereen in het DSL-magazijn labels, bordjes en stroken maakt die er altijd hetzelfde uitzien, op elke pc dezelfde basisgegevens heeft en niets dubbel hoeft te typen. Het werkt ook buiten de DSL-locatie en voor ander werk dan DSL: DSL is het eerste *profiel*, niet ingebakken.

**Gebruikers:** Robin (beheer) en collega's, op meerdere pc's, in Chrome of Edge; daarnaast Robin zelf voor ander werk, ook thuis of onderweg.
**Succes:** een collega maakt zonder uitleg de juiste stroken of bordjes voor een reeks artikelen en print ze op de juiste printer; sjablonen, kleurcodes en artikelen zijn op elke pc gelijk na een publicatie.

**Vaste eisen (afgesproken):**
- gratis, geen abonnementen of licenties;
- alles in de browser; geen OneDrive, geen gekoppelde mappen, niets installeren;
- werkt zelfstandig, ook zonder internet (na het eerste bezoek);
- QR-codes en artikelgegevens uit Rentman (voor DSL); andere bronnen via elk Excel/csv-bestand;
- opmaak ligt vast; collega's vullen hooguit aan en printen;
- printknoppen rechtsboven, nooit midden op de pagina;
- huisstijl van de huidige versie 25 (kleurrand, Futura, gatmarkering, snijtekens, A7-bordjes, gitterbox-strook).

## 1. Bouwstenen en werkscherm

Drie begrippen:
- **Artikel** — uit een ingelezen export (Rentman of ander bestand), of een *los item*.
- **Sjabloon** — formaat, vaste printer (labelprinter of A4) en opmaak. QR-label, locatielabel, Backdrop, Pipe & Drape en gitterbox-strook zijn allemaal sjablonen; de magazijnbak volgt later.
- **Printvel** — één per printer.

Eén werkscherm, geen tabbladen:
- **Kop:** profielkeuze (*DSL ▾*), zoek- en scanveld (naam, code, QR, locatie), *Beheer*, en rechtsboven de printknoppen **Print n op Citizen** en **Print n op A4** (grijs als er niets klaarstaat).
- **Links:** artikelen met filter per categorie, *Laatst geprint* en *Los item*. Aanvinken, dan *Bordje of strook*, *QR-label* of *Locatielabel*. Het sjabloon volgt de categorie (instelling in beheer); per keer afwijken kan.
- **Midden:** printvel met tabjes per printer: aantallen aanpassen, verwijderen. Geen printknop hier.
- **Rechts:** voorbeeld van het gekozen printvel.
- Ontbreekt een verplichte aanvulling (bijv. doorsnede), dan vraagt het programma die bij het klaarzetten en bewaart hem.

Vervalt: drie tabbladen, tekstvak met puntkomma's, twee aparte bibliotheken.

## 2. Gegevens

### 2a. Alles in de browser, per profiel

- **Programma:** GitHub Pages, `https://rjong-ctrl.github.io/Labelmaker/`. Na het eerste bezoek opent het ook offline (service worker).
- **Opslag:** de browser van elke pc (IndexedDB), per profiel: instellingen, sjablonen, kleurcodes, huisstijl, artikelen, aanvullingen, losse items, printlog en het printvel van dat moment. Het programma vraagt de browser om deze opslag niet op te ruimen (blijvende opslag).
- **Profielen:** een profiel is een eigen werkruimte. Kiezen in de kop.
  - *DSL* — Rentman-voorinstelling, DSL-sjablonen en -huisstijl, gedeelde basis van de site.
  - *Nieuw profiel* — leeg of vanuit basissjablonen (QR-label, locatielabel, bordje staand/liggend, strook) met een neutrale huisstijl; eigen logo, voettekst en lettertype. Geen gedeelde basis, tenzij later ingesteld.
- **Back-up en overzetten:** *Exporteren* / *Importeren* van een heel profiel als één bestand.

### 2b. Gedeelde basis via de site

- **Publiceren** (beheer) maakt één bestand per profiel, bijv. `data/dsl.json`, met: artikelen (alleen toegestane velden), sjablonen, kleurcodes, categorie → sjabloon, huisstijl (incl. logo en certificaat-icoon), aanvullingen, en een publicatiedatum.
- Dat bestand komt in de repository: Robin uploadt het via GitHub (*Add file → Upload files* in de map `data/`) of stuurt het naar Claude. De site is binnen ongeveer een minuut bijgewerkt.
- **Bij het opstarten** haalt elke pc de basis op als er internet is. Is die nieuwer dan wat de pc heeft, dan wordt hij geladen met een korte melding (*"Basis van 26 okt geladen"*). Zonder internet werkt de pc met de laatst geladen basis.
- **Lokale wijzigingen** (bijv. een aanvulling die een collega invult) blijven op die pc en gaan vóór de basis. Beheer toont een lijst *Wijzigingen op deze pc*, zodat Robin ze kan overnemen en publiceren, of weggooien.
- **Wat er nooit in een publicatie komt:** prijzen (verhuur, inkoop, nieuwprijs, marge, boekwaarde), interne opmerkingen, en de pincode. De repository is openbaar en wordt door zoekmachines en kopieerprogramma's gelezen; zonder deze velden is de inhoud onschuldig (artikelnamen, codes, QR-waarden, locaties).
- `.gitignore` houdt Excel- en csv-bestanden (de ruwe exports) uit de repository.

### 2c. Rentman-export (Export_Materiaal, 26 okt: 4.160 regels, 75 kolommen)

Voorinstelling *Rentman*, aan te passen onder *Artikelen inlezen*:

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

Alle andere kolommen worden bij het inlezen genegeerd en nergens bewaard.

Wat de export ons leert:
- **De QR-code is níet het artikelnummer.** Rentman scant de waarde uit `QR-codes / RFID` (bijv. `nl4-2.50m`) of een exemplaar-QR. De labels gebruiken die waarde; het artikelnummer staat er alleen als tekst op.
- **Geserialiseerde artikelen** (1.367, samen 8.240 exemplaar-QR's) krijgen per exemplaar een eigen label of bordje met de eigen QR-code. Bulkartikelen krijgen de artikel-QR.
- **Lengte en maat staan in de naam**, niet in de kolom `Lengte` (die is 0 bij kabels): "Verlengkabel 12,5m" → 12,5; "Backdrop 6 x 3m" → 6 × 3; "Speakon 4p" → NL4.
- **Mappen met Z98/Z99 zijn gewoon in gebruik** (bijv. de Pipe & Drape-doeken) en worden niet weggefilterd.
- **Doorsnede (2,5 / 4 mm²) en materiaalkleur** staan niet in Rentman en worden aanvullingen.

## 3. Sjablonen en beheer

Beheer is een eigen pagina: links een lijst (sjablonen en instellingen), midden het formulier, rechts een live voorbeeld met een zelf gekozen echt artikel. Toegang achter een pincode per pc (drempel, geen beveiliging).

Een sjabloon bestaat uit:
1. **Basis** — printer (labelprinter/A4), opmaak (*Bordje staand*, *Bordje liggend*, *Strook*, *QR-label*, *Locatielabel*), formaat in mm, gatmarkering aan/uit, voettekst aan/uit.
2. **Velden** — tabel: naam, soort (tekst / getal + eenheid / keuzelijst), herkomst, verplicht ja/nee. Herkomst is een van:
   - *Kolom uit de export* (naam, code, QR, locatie …);
   - *Uit de naam*: vaste patronen om uit te kiezen (lengte in m, maat b × h, aantal polen 2p/4p/8p → NL2/NL4/NL8, kwaliteit A/B);
   - *Aanvulling*: één keer per artikel invullen; gedeeld via Publiceren.
3. **Wat waar komt** — per plek van de opmaak (titel, groot, label, eigenschappen, onderregel) velden als blokjes plus vaste tekst. Plekken met alleen lege optionele velden verdwijnen.
4. **Kleuren** — kleurrand volgt veld X met per waarde een kleur; label volgt veld Y met per waarde een kleur. Kleuren uit vaste namen (geel, groen, blauw, rood, paars, wit, oranje, magenta, lichtblauw, grijs) of een eigen kleur.

Overige instellingen (per profiel): *Categorie → sjabloon*, *Huisstijl* (voettekst, logo, certificaat-icoon, lettertype), *Artikelen inlezen* (bestand, kolommen, Rentman als voorinstelling), *Printers* (naam en formaat labelprinter, A4-printer), *Publiceren* en *Wijzigingen op deze pc*, *Pincode*.

Vast in de huisstijlregels en niet instelbaar: sterkte en breedte van het kleurvlak, kleurstreep, gat-maat, snijtekens, plaatsing op A4.

**Standaardsjablonen DSL (meegenomen uit versie 25):**
- *QR-label* 76 × 56 en *QR-label half* 76 × 28 (Citizen);
- *Locatielabel* 76 × 56 en half (Citizen);
- *Backdrop* A7 staand: maat en kwaliteit A/B (uit de naam), kleur zwart/wit/rood (aanvulling), certificaatregel; één bordje per exemplaar met eigen QR; rand volgt maat;
- *Pipe & Drape* A7 liggend: maat (uit de naam);
- *Gitterbox-strook* 180 × 48: omschrijving (export), lengte en connector (uit de naam), doorsnede (aanvulling); rand volgt lengte (2,5 geel, 5 groen, 7,5 blauw, 10 rood, 15 paars, 20 wit, 25 oranje; 12,5 nog te bepalen); label volgt doorsnede (2,5 mm² rood, 4 mm² groen).

## 4. Printen

- Elke printknop print alleen zijn eigen printvel, met het juiste papierformaat (labelformaat of A4) en zonder marges.
- Vóór het printvenster een korte melding: *"Kies printer: Citizen CL-E321"* of *"Kies je A4-printer"*.
- Pijltje naast elke printknop: *Alleen eerste label/vel* (testprint).
- Na printen: printlog op deze pc en *Laatst geprint* bijgewerkt; printvel leegmaken met één klik.
- Later mogelijk, buiten deze versie: direct printen zonder printvenster via een hulpprogramma op de pc.

## 5. Overstap en testen

**Overstap**
- Versie 25 blijft tijdens de bouw op de site staan. v2 komt eerst op `…/Labelmaker/v2/` om te testen; pas na goedkeuring wordt v2 de hoofdversie en verhuist versie 25 naar `…/Labelmaker/v1/`.
- Eenmalige import van de huidige gegevens: in versie 25 *Exporteren*, in v2 *Oude gegevens importeren* (sjablonen, kleurcodes, opgeslagen bordjes).
- Eerste DSL-basis: Robin leest de Rentman-export in, vult doorsnedes en backdropkleuren aan en publiceert.

**Testen**
- *Automatisch* bij elke wijziging (headless Chromium): elk sjabloon renderen met voorbeeldartikelen (nagemaakte testgegevens in de vorm van de echte export, zonder prijzen); alle QR-codes uitlezen; printuitvoer controleren (papierformaat, aantal per vel, niets afgekapt); inlezen van een export inclusief weglaten van prijskolommen; publiceren en weer laden van de basis, met lokale wijzigingen erbovenop; offline openen; profielen exporteren en importeren.
- *Handmatig door Robin:* testprint Citizen en A4, scan met de Rentman-app, één collega die zonder uitleg een reeks stroken maakt, en een eigen profiel buiten DSL.

## Opbouw van de code

Statische site zonder bouwstap, opgesplitst in kleine onderdelen met elk één taak:
- `index.html`, `css/`, `sw.js` (offline)
- `js/model` — artikelen, sjablonen, printvellen
- `js/opslag` — IndexedDB per profiel; basis ophalen en samenvoegen met lokale wijzigingen
- `js/profielen` — profielen kiezen, aanmaken, exporteren/importeren
- `js/import` — Excel/csv inlezen, kolommen koppelen, Rentman-voorinstelling, toegestane velden
- `js/publiceren` — basisbestand maken zonder verboden velden
- `js/afleiden` — waarden uit de naam halen (lengte, maat, polen, kwaliteit)
- `js/opmaak` — de vaste opmaken en het tekenen van labels en bordjes
- `js/printen` — printvellen, papierformaat, printlog
- `js/qr` — QR-codes (meegeleverd, geen internet nodig)
- `js/beheer`, `js/werkscherm` — de schermen
- `data/` — gepubliceerde basisbestanden
- `tests/` — automatische tests

## Buiten deze versie

Magazijnbak-sjabloon (maat volgt), direct printen zonder printvenster, publiceren rechtstreeks vanuit het programma naar GitHub, koppeling met de Rentman-API, extra velden in Rentman zelf.
