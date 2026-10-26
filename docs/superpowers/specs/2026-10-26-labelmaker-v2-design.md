# Labelmaker v2 — ontwerp

Datum: 26 oktober 2026
Status: ter goedkeuring

## Doel

Eén eenvoudig programma waarmee iedereen in het DSL-magazijn labels, bordjes en stroken maakt die er altijd hetzelfde uitzien, op elke pc dezelfde gegevens heeft en niets dubbel hoeft te typen.

**Gebruikers:** Robin (beheer) en collega's, op meerdere pc's, in Chrome of Edge.
**Succes:** een collega maakt zonder uitleg de juiste stroken of bordjes voor een reeks artikelen en print ze op de juiste printer; sjablonen, kleurcodes en aanvullingen zijn op elke pc gelijk.

**Vaste eisen (afgesproken):**
- gratis, geen abonnementen of licenties;
- QR-codes en artikelgegevens uit Rentman;
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

## 2. Gegevens

**Programma:** GitHub Pages, `https://rjong-ctrl.github.io/Labelmaker/`. Na het eerste bezoek opent het ook offline (service worker).

**Gedeelde gegevens:** een gedeelde OneDrive-map `DSL Labelmaker`, op elke pc gesynchroniseerd ("Altijd op dit apparaat bewaren"). Elke pc koppelt de map één keer via de bestandstoegang van Chrome/Edge.

```
DSL Labelmaker/
├─ instellingen.json            sjablonen, kleurcodes, categorie → sjabloon, huisstijl, Rentman-kolommen, pincode (gehasht)
├─ rentman/<export>.xlsx|csv    laatste Rentman-export
├─ artikelen/<code>.json        aanvullingen per artikel (lengte, connector, doorsnede, kleur …)
├─ losse-items/<id>.json        items buiten Rentman
└─ geprint/<datum>-<pc>.json    printlog per pc per dag
```

- **Waarom veel kleine bestanden:** OneDrive maakt bij gelijktijdige wijziging van hetzelfde bestand een conflictkopie. Per artikel en per pc een eigen bestand maakt dat zeldzaam. Het programma herkent conflictkopieën (`naam-PCNAAM.json`) en voegt ze samen: per veld wint de nieuwste wijziging.
- **Per pc (browser):** het printvel van dat moment, een kopie van de gedeelde gegevens voor als de map even niet bereikbaar is, en de koppeling met de map.
- **Zonder map-verbinding:** werken met de laatste kopie; printen kan, beheer en aanvullingen opslaan niet (duidelijke melding).
- **Back-up:** versiegeschiedenis van OneDrive.
- **Niet in GitHub:** artikelgegevens, Rentman-exports of andere bedrijfsgegevens. De repository is openbaar.

## 3. Sjablonen en beheer

Beheer is een eigen pagina met links een lijst (sjablonen en instellingen), midden het formulier en rechts een live voorbeeld met een zelf gekozen echt artikel. Toegang achter een pincode (drempel, geen beveiliging).

Een sjabloon bestaat uit:
1. **Basis** — printer (Citizen/A4), opmaak (*Bordje staand*, *Bordje liggend*, *Strook*, *QR-label*, *Locatielabel*), formaat in mm, gatmarkering aan/uit, voettekst aan/uit.
2. **Velden** — tabel: naam, soort (tekst / getal + eenheid / keuzelijst), herkomst (*Rentman-kolom* of *Aanvulling*), verplicht ja/nee.
3. **Wat waar komt** — per plek van de opmaak (titel, groot, label, eigenschappen, onderregel) velden als blokjes plus vaste tekst. Plekken met alleen lege optionele velden verdwijnen.
4. **Kleuren** — kleurrand volgt veld X met per waarde een kleur; label volgt veld Y met per waarde een kleur. Kleuren kiezen uit vaste namen (geel, groen, blauw, rood, paars, wit, oranje, magenta, lichtblauw, grijs) of een eigen kleur.

Overige instellingen: *Categorie → sjabloon*, *Huisstijl en voettekst* (voettekst, logo, certificaat-icoon), *Rentman-kolommen* (welke kolom naam, code, QR-inhoud, categorie, locatie is), *Pincode*.

Vast in de huisstijl en niet meer instelbaar: lettertype, sterkte en breedte van het kleurvlak, kleurstreep, gat-maat, snijtekens, plaatsing op A4.

**Standaardsjablonen (meegenomen uit versie 25):**
- *QR-label* 76 × 56 en *QR-label half* 76 × 28 (Citizen);
- *Locatielabel* 76 × 56 en half (Citizen);
- *Backdrop* A7 staand: breedte, hoogte, kleur (zwart/wit/rood), kwaliteit B1 + certificaatregel; rand volgt formaat;
- *Pipe & Drape* A7 liggend: breedte, hoogte;
- *Gitterbox-strook* 180 × 48: omschrijving, lengte (optioneel), connector, doorsnede; rand volgt lengte (2,5 geel, 5 groen, 7,5 blauw, 10 rood, 15 paars, 20 wit, 25 oranje; 12,5 nog te bepalen); label volgt doorsnede (2,5 mm² rood, 4 mm² groen).

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
- Een echte Rentman-export (mag ingekort) om de kolommen goed te zetten.
- Twee pc's met de gedeelde OneDrive-map voor de map-test.

**Testen**
- *Eerst:* kleine testpagina die op twee pc's controleert of lezen, schrijven, synchroniseren en conflictkopieën in de OneDrive-map werken. Valt die test tegen, dan is het alternatief een kleine intranetpagina; dat wordt dan eerst opnieuw besproken.
- *Automatisch* bij elke wijziging: elk sjabloon renderen met voorbeeldartikelen; alle QR-codes uitlezen; printuitvoer controleren (papierformaat, aantal per vel, niets afgekapt); gegevenslaag testen met een nagebootste map, inclusief conflictkopieën en offline.
- *Handmatig door Robin:* testprint Citizen en A4, scan met de Rentman-app, één collega die zonder uitleg een reeks stroken maakt.

## Opbouw van de code

Statische site zonder bouwstap, opgesplitst in kleine onderdelen met elk één taak:
- `index.html`, `css/`
- `js/model` — artikelen, sjablonen, printvellen
- `js/opslag` — gedeelde map (bestandstoegang) + kopie per pc
- `js/rentman` — export inlezen (xlsx/csv) en kolommen koppelen
- `js/opmaak` — de vaste opmaken en het tekenen van labels en bordjes
- `js/printen` — printvellen, papierformaat, printlog
- `js/qr` — QR-codes (meegeleverd, geen internet nodig)
- `js/beheer`, `js/werkscherm` — de schermen
- `tests/` — automatische tests

## Buiten deze versie

Magazijnbak-sjabloon (maat volgt), direct printen zonder printvenster, koppeling met de Rentman-API, extra velden in Rentman zelf.
