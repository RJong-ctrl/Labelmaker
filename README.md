# DSL Labelmaker

Labels en bordjes maken voor het magazijn van DSL Geluids- & Lichtverhuur, en voor eigen werk.

**Openen:** https://rjong-ctrl.github.io/Labelmaker/ (Chrome of Edge). Werkt na het eerste bezoek ook zonder internet.

- **QR-labels en locatielabels** voor de Citizen CL-E321 (76 × 56 mm, ook halve labels)
- **Bordjes** in A7 om te lamineren (Backdrop, Pipe & Drape, algemene bordjes), 4 per A4 met snijtekens
- **Gitterbox-stroken** (180 × 48 mm) met kleurcode per lengte en doorsnede
- **Los item** voor alles wat niet in Rentman staat; **Aanpassen** om teksten op een bordje te wijzigen of weg te halen

## Werken

1. *Artikelen inlezen*: de materiaalexport uit Rentman (.xlsx of .csv). Of niets doen: de gedeelde DSL-basis wordt bij het openen geladen.
2. Zoek of scan, vink aan, kies *Bordje of strook*, *QR-label*, *Locatielabel* of *Ander sjabloon…*.
3. Rechtsboven: *Print n op Citizen* of *Print n op A4*. Citizen: papier 76 × 56 mm, marges *Geen*.

## Beheer

Sjablonen, kleuren per maat of lengte, categorie → sjabloon, huisstijl, printers, kolommen, profielen, oude gegevens uit versie 25, pincode.
**Publiceren** maakt `dsl.json`; zet dat in de map [`v2/data`](https://github.com/RJong-ctrl/Labelmaker/upload/main/v2/data) en elke pc laadt het bij het openen.

## Gegevens en privacy

Alles staat in de browser van elke pc (per profiel). Prijzen en interne opmerkingen uit de Rentman-export worden nooit bewaard of gepubliceerd; de gepubliceerde basis bevat alleen namen, codes, QR-waarden, locaties en categorieën. Er staan geen Rentman-exports in deze repository.

## Versies

- Huidige versie: `v2/` (het hoofdadres stuurt daarheen door).
- Vorige versie (25): https://rjong-ctrl.github.io/Labelmaker/v1/

Lettertypes: Jost en Barlow Condensed (SIL Open Font License), zie `v2/fonts/`. QR-codes: QRCode for JavaScript (Kazuhiko Arase, MIT).
