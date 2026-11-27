// Sjablonen: welke velden, waar ze op het bordje komen en welke kleur erbij hoort.
// vul() maakt van sjabloon + artikel + aanvullingen een Inhoud die opmaak.js tekent.

import { PATRONEN } from './afleiden.js';
import { sleutel, ONBEKEND, kleurBijNaam } from './kleuren.js';

const kolom = (naam, k, verplicht = false, extra = {}) => ({ naam, soort: 'tekst', herkomst: { type: 'kolom', kolom: k }, verplicht, ...extra });
const uitNaam = (naam, patroon, verplicht = false, extra = {}) => ({ naam, soort: 'tekst', herkomst: { type: 'naam', patroon }, verplicht, ...extra });
// Velden die vroeger anders heetten houden hun oude naam als 'oud': al ingevulde aanvullingen blijven werken (23 nov).
const artikelnummer = (verplicht = false) => kolom('Artikelnummer', 'code', verplicht, { oud: ['Code'] });
/** Keuze met of zonder QR-code op het bordje (leeg = met). */
const qrKeuze = (standaardZonder = false) => ({ naam: 'QR-code', soort: 'keuze', herkomst: { type: 'aanvulling' }, verplicht: false, qrSchakelaar: true,
  ...(standaardZonder ? { standaardZonder: true } : {}),
  keuzes: standaardZonder
    ? [{ waarde: '', tekst: 'Zonder QR-code' }, { waarde: 'ja', tekst: 'Met QR-code' }]
    : [{ waarde: '', tekst: 'Met QR-code' }, { waarde: 'nee', tekst: 'Zonder QR-code' }] });
/** Geen QR op het bordje volgens de QR-keuze (leeg = de standaard van het veld). */
const zonderQr = (sjabloon, w) => sjabloon.velden.some(v => v.qrSchakelaar && (w[v.naam] === 'nee' || (v.standaardZonder && w[v.naam] !== 'ja')));
const keuze = (naam, opties, alleenAls) => ({ naam, soort: 'keuze', opties, herkomst: { type: 'aanvulling' }, verplicht: true, ...(alleenAls ? { alleenAls } : {}) });
const v = (veld) => ({ veld });

const leeg = { titel: [], groot: [], label: [], eigenschappen: [], onder: [] };
const basis = { gat: false, voet: false, logoBoven: false, kleuren: {}, cert: '' };

const qrlabel = (id, naam, h) => ({
  ...basis, id, naam, printer: 'label', opmaak: 'qrlabel', formaat: { b: 76, h },
  velden: [kolom('Naam', 'naam', true), kolom('Locatie', 'locatie')],
  plekken: { ...leeg, titel: [v('Naam')], onder: [v('Locatie')] },
});
const locatie = (id, naam, h) => ({
  ...basis, id, naam, printer: 'label', opmaak: 'locatie', formaat: { b: 76, h },
  velden: [kolom('Locatie', 'locatie', true), kolom('Naam', 'naam')],
  plekken: { ...leeg, titel: [v('Locatie')], onder: [v('Naam')], qr: [v('Locatie')] },
});

/** Algemeen bordje (staand, liggend) of strook: naam, optioneel 'groot', omschrijving en vrije regels
 *  ('Kop: waarde', één per regel), code onderaan. */
export const vrijBordje = (id, naam, opmaak, b, h, extra = {}) => ({
  ...basis, id, naam, printer: 'a4', opmaak, formaat: { b, h }, gat: opmaak !== 'strook', voet: opmaak !== 'strook',
  velden: [kolom('Naam', 'naam', true), artikelnummer(),
    { naam: 'Groot', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false },
    { naam: 'Omschrijving', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false },
    { naam: 'Regels', soort: 'tekst', meerregelig: true, herkomst: { type: 'aanvulling' }, verplicht: false }],
  regelsVeld: 'Regels',
  plekken: { ...leeg, titel: [v('Naam')], groot: [v('Groot')], eigenschappen: [{ kop: 'Omschrijving', waarde: [v('Omschrijving')] }], onder: ['Artikelnummer ', v('Artikelnummer')] },
  kleuren: { rand: { sleutel: [v('Groot')], waarden: {} } },
  ...extra,
});

/** Leeg bordje: alles zelf invullen (titel, groot, vrije regels, onderregel, randkleur, QR). */
export const RANDKLEUREN = ['Geen', 'DSL blauw', 'Geel', 'Groen', 'Blauw', 'Lichtblauw', 'Rood', 'Paars', 'Oranje', 'Magenta', 'Wit'];
export const leegBordje = (id, naam, opmaak, b, h) => ({
  ...basis, id, naam, printer: 'a4', opmaak, formaat: { b, h }, gat: true, voet: true,
  velden: [kolom('Naam', 'naam', true),
    { naam: 'Groot', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false },
    { naam: 'Regels', soort: 'tekst', meerregelig: true, herkomst: { type: 'aanvulling' }, verplicht: false },
    { naam: 'Onderregel', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false },
    { naam: 'Randkleur', soort: 'keuze', opties: RANDKLEUREN, herkomst: { type: 'aanvulling' }, verplicht: false }],
  regelsVeld: 'Regels',
  plekken: { ...leeg, titel: [v('Naam')], groot: [v('Groot')], onder: [v('Onderregel')] },
  kleuren: { rand: { sleutel: [v('Randkleur')], waarden: {
    geel: '#ffff00', groen: '#00b050', blauw: '#0050ff', lichtblauw: '#00b0f0', rood: '#ff0000',
    paars: '#7030a0', oranje: '#ff8c00', magenta: '#c000c0', wit: '#ffffff', dslblauw: '#005abb' } } },
});

/** Wandbord A4 voor het magazijn: locatie heel groot, wat er ligt eronder, QR van de locatie.
 *  194 × 281 mm (A4 min de printermarge), één per vel. */
/** Uit de exemplaren-export: gegevens van deze kist (het exemplaar op het bordje); anders de kolom (of leeg). */
const uitKist = (naam, sleutel, kolomAnders = '', extra = {}) =>
  ({ naam, soort: 'tekst', herkomst: { type: 'exemplaar', sleutel, ...(kolomAnders ? { kolom: kolomAnders } : {}) }, verplicht: false, ...extra });
const aanvul = (naam, extra = {}) => ({ naam, soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false, ...extra });
export const wandbord = (id, naam, b, h) => ({
  ...basis, id, naam, printer: 'a4', opmaak: 'wand', formaat: { b, h }, gat: false, voet: true,
  velden: [kolom('Locatie', 'locatie', true), aanvul('Inhoud'), qrKeuze()],
  plekken: { ...leeg, titel: [v('Locatie')], onder: [v('Inhoud')], qr: [v('Locatie')] },
  kleuren: { rand: { sleutel: [], waarden: {}, anders: '#005abb' } },   // standaard DSL blauw, Randkleur te kiezen
});

/** Randkleur per zone: de waarden gelden voor alles wat met die letter begint (begin: true). In Beheer te wijzigen. */
const ZONES = { a: '#005abb', b: '#ffff00', c: '#ff8c00', d: '#7030a0', e: '#00b0f0', f: '#c000c0', g: '#ff0000', h: '#00b050', j: '#0050ff', k: '#ff8c00', v: '#ffffff', w: '#7030a0', x: '#7f7f7f', z: '#7f7f7f' };
const zoneKleuren = () => ({ rand: { sleutel: [v('Locatie')], begin: true, waarden: { ...ZONES }, anders: '#005abb' } });

/** Stellingbord voor de kopse kant: code van de rij heel groot, wat erin hoort, QR van de code. */
export const stellingbord = (id, naam, b, h) => ({
  ...basis, id, naam, printer: 'a4', opmaak: 'wand', formaat: { b, h }, gat: false, voet: true,
  // In Rentman heb je weinig aan de QR van een stellingbord: standaard zonder (Robin, 11 nov).
  velden: [aanvul('Locatie', { verplicht: true, oud: ['Code'] }), aanvul('Inhoud', { oud: ['Wat'] }), qrKeuze(true)],
  plekken: { ...leeg, titel: [v('Locatie')], onder: [v('Inhoud')], qr: [v('Locatie')] },
  kleuren: zoneKleuren(),
});

/** Bakbord voor magazijnbakken: 16 cm breed. Naam linksboven, artikelnummer eronder, QR van het artikel
 *  (QR-veld, met de waarde één keer klein eronder). Vijf per A4, geen voet. Randkleur naar keuze. */
export const bakbord = (id, naam) => ({
  ...basis, id, naam, printer: 'a4', opmaak: 'wand', formaat: { b: 160, h: 48 }, gat: false, voet: false,
  velden: [kolom('Naam', 'naam', true), artikelnummer()],
  plekken: { ...leeg, titel: [v('Naam')], onder: [v('Artikelnummer')] },
  // Standaard DSL blauw, zoals de wandbordjes voorin het magazijn; Randkleur kiezen kan nog steeds.
  kleuren: { rand: { sleutel: [], waarden: {}, anders: '#005abb' } },
});

/** Materiaalbordje voor op de kist (gelamineerd in een A5-hoes), opgebouwd als het oude bordje: logo, vak voor
 *  naam en gewicht (vroeger klant en productie), QR; inhoud met kistnummer en het vak voor de projectsticker; zwarte voet.
 *  Inhoud: één regel per onderdeel ('aantal naam'). Twee per A4. */
export const kistbordje = (id, naam, opmaak = 'kist') => ({
  // 200 × 140: zo groot als past in een A5-sleeve met 2 per A4 (Robin, 26 nov; was 194 × 136).
  ...basis, id, naam, printer: 'a4', opmaak, formaat: { b: 200, h: 140 }, gat: false, voet: true,
  // A5-lamineerhoes (Robin: 154 × 216): in het voorbeeld donkergrijs achter het bordje.
  hoes: { b: 216, h: 154, naam: 'A5-lamineerhoes' },
  velden: [kolom('Naam', 'naam', true), uitKist('Kistnummer', 'nr', 'code', { oud: ['Code'] }),
    uitKist('Gewicht', 'gewicht', '', { eenheid: 'kg' }),
    // Eén veld (Robin, 26 nov): komt uit Rentman, en wat je aanpast wordt per artikel onthouden.
    // Vroeger ingevulde 'Extra inhoud' komt er nog onder (erbij), tot je de inhoud zelf aanpast.
    uitKist('Inhoud', 'inhoud', '', { meerregelig: true, onthouden: true, erbij: ['Extra inhoud'], plaatshouder: 'Aantal en naam, één per regel (30 DMX 3p 1,25m)' })],
  lijstVeld: ['Inhoud'],
  plekken: { ...leeg, titel: [v('Naam')], groot: [v('Kistnummer')], onder: [v('Kistnummer')] },
  // Vaste kleur: altijd DSL blauw (een gekozen randkleur telt hier niet).
  kleuren: { rand: { sleutel: [], waarden: {}, anders: '#005abb', vast: true } },
});

/** Zwart-wit (Robin, 24 nov): het moderne materiaalbordje en de B&W-bordjes hebben een zwarte band, altijd.
 *  De B&W-bordjes hebben ook de voettekst (24 nov). */
const zwartWit = (sj) => ({ ...sj, kleuren: { rand: { sleutel: [], waarden: {}, anders: '#000000', vast: true } } });

/** Materiaalbordje modern voor het deksel van de B&W outdoor.case type 1000 (Robin, 16 nov). Uitsparing 160 × 97 mm
 *  met ronde hoeken: papier 150 × 87 (hoek r 6), met een lamineerrand van ± 3 mm wordt het 156 × 93 en past met speling. */
export const kistBw1000 = () => zwartWit({
  ...kistbordje('kist-bw1000', 'Materiaalbordje B&W type 1000', 'kist-modern'),
  formaat: { b: 150, h: 87, r: 6 }, voet: true, hoes: null,
});

/** Idem voor de B&W type 6040 (Robin, 23 nov): uitsparing max. 255 × 127 mm. Papier 245 × 117 (hoek r 6),
 *  gelamineerd ± 251 × 123: past met speling. Op A4 gaat hij een kwartslag gedraaid, één per vel. */
export const kistBw6040 = () => zwartWit({
  ...kistbordje('kist-bw6040', 'Materiaalbordje B&W type 6040', 'kist-modern'),
  formaat: { b: 245, h: 117, r: 6 }, voet: true, hoes: null,
});

/** Kaartje aan een speakertas (Robin, 16 nov): liggend 105 × 74 zoals Pipe & Drape, in de stijl van het moderne
 *  materiaalbordje: naam, inhoud, exemplaar, gewicht en QR van het exemplaar; gat om op te hangen, geen projectsticker. */
export const kistModern = () => zwartWit(kistbordje('kist-modern', 'Materiaalbordje kist modern (A5)', 'kist-modern'));

export const speakertas = () => ({
  ...kistbordje('speakertas', 'Speakertas-kaartje', 'kist-modern'),
  formaat: { b: 105, h: 74 }, gat: true, voet: false, sticker: false, hoes: null,
});

/** Scanlijst (Robin, 27 nov): A4 in de moderne stijl, zwart-wit, met 10 artikelen die zelf geen QR-code hebben
 *  (HDMI-kabels): per artikel de QR uit Rentman, de naam en het artikelnummer, zodat je ze toch kunt scannen.
 *  Tien losse regels (Robin, 27 nov: één tekstvak zocht al bij 2 letters honderden artikelen); per regel kies je een
 *  artikel uit de lijst of typ je het artikelnummer of de QR-waarde. */
export const SCAN_MAX = 10;
export const SCAN_VELDEN = Array.from({ length: SCAN_MAX }, (_, n) => `Artikel ${n + 1}`);
export const scanlijst = () => zwartWit({
  ...basis, id: 'scanlijst', naam: 'Scanlijst A4', printer: 'a4', opmaak: 'scanlijst', formaat: { b: 194, h: 281 }, voet: true,
  velden: [{ naam: 'Titel', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false, plaatshouder: 'Bijv. HDMI kabels' },
    ...SCAN_VELDEN.map(naam => ({ naam, soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false, kiesArtikel: true,
      plaatshouder: 'Naam of artikelnummer' }))],
  zonderQrRegel: true,
  plekken: { ...leeg, titel: [v('Titel')] },
});

/** Waar de scanlijst de artikelen zoekt: de ingelezen Rentman-lijst (het werkscherm zet die bij het starten). */
let artikelBron = () => [];
export function zetArtikelBron(bron) { artikelBron = typeof bron === 'function' ? bron : () => []; }
/** Regels van de scanlijst → artikelen, in de volgorde van de regels. Alleen een precieze treffer: artikelnummer,
 *  QR-waarde of de volledige naam (hoofdletters maken niet uit). Lege regels tellen niet mee. */
export function zoekScanArtikelen(regels, lijst = artikelBron()) {
  const klein = (x) => String(x ?? '').trim().toLowerCase();
  const items = [], nietGevonden = [];
  for (const regel of [].concat(regels || []).map(r => String(r ?? '').trim()).filter(Boolean)) {
    const z = klein(regel);
    const a = (lijst || []).find(x => klein(x.code) === z) || (lijst || []).find(x => x.qr && klein(x.qr) === z)
      || (lijst || []).find(x => klein(x.naam) === z);
    if (a) items.push(a); else nietGevonden.push(regel);
  }
  return { items, nietGevonden, zonderQr: items.filter(a => !String(a.qr || '').trim()), max: SCAN_MAX };
}

/** De ingevulde regels van een scanlijst (ook van een oude scanlijst met één tekstvak 'Artikelen'). */
export function scanRegels(w, aanvullingen = {}) {
  const regels = SCAN_VELDEN.map(n => w[n] ?? aanvullingen[n] ?? '');
  return regels.some(r => String(r).trim()) ? regels : String(aanvullingen.Artikelen || w.Artikelen || '').split(/\r?\n/);
}

/** Soorten in de sjabloonkeuze, elk een eigen rij. */
export const GROEPEN = [
  { sleutel: 'bordjes', titel: 'Bordjes' },
  { sleutel: 'magazijn', titel: 'Magazijn' },
  { sleutel: 'kisten', titel: 'Kisten' },
  { sleutel: 'labels', titel: 'Labels' },
];
// Stroken (gitterbox) horen bij het magazijn, net als het bakbord (Robin, 11 nov).
export function groepVan(sj) {
  const sleutel = sj.printer === 'label' ? 'labels'
    : sj.opmaak === 'wand' || sj.opmaak === 'strook' || sj.opmaak === 'scanlijst' ? 'magazijn'
      : String(sj.opmaak || '').startsWith('kist') ? 'kisten' : 'bordjes';
  return GROEPEN.find(g => g.sleutel === sleutel);
}
/** Kleine rijtjes binnen een groep, met een titeltje, naast elkaar in het venster (Robin, 23 nov). */
export const SUBGROEPEN = [
  { sleutel: 'algemeen', groep: 'bordjes', titel: 'Algemeen' },
  { sleutel: 'doeken', groep: 'bordjes', titel: 'Doeken' },
  { sleutel: 'stellingen', groep: 'magazijn', titel: 'Stellingen' },
  { sleutel: 'bakken', groep: 'magazijn', titel: 'Bakken & gitterboxen' },
  { sleutel: 'wanden', groep: 'magazijn', titel: 'Wanden' },
  { sleutel: 'scan', groep: 'magazijn', titel: 'Scanlijsten' },
  { sleutel: 'materiaal', groep: 'kisten', titel: 'Materiaalbordjes' },
  { sleutel: 'bw', groep: 'kisten', titel: 'B&W cases' },
  { sleutel: 'qr', groep: 'labels', titel: 'QR-labels' },
  { sleutel: 'locatie', groep: 'labels', titel: 'Locatielabels' },
];
export function subgroepVan(sj) {
  const groep = groepVan(sj).sleutel;
  const naam = String(sj.naam || ''), id = String(sj.id || '');
  const sleutel = {
    labels: () => (sj.opmaak === 'locatie' ? 'locatie' : 'qr'),
    bordjes: () => (/backdrop|pipe|drape|doek/i.test(naam + ' ' + id) ? 'doeken' : 'algemeen'),
    magazijn: () => (sj.opmaak === 'scanlijst' ? 'scan' : sj.opmaak === 'strook' || (sj.opmaak === 'wand' && sj.formaat?.b / sj.formaat?.h > 2.5) ? 'bakken'
      : /^stellingbord|stelling/i.test(id + ' ' + naam) ? 'stellingen' : 'wanden'),
    // Ronde hoeken = bordje voor in een case-deksel (B&W).
    kisten: () => (sj.formaat?.r > 0 || /b&w|bw\d/i.test(naam + ' ' + id) ? 'bw' : 'materiaal'),
  }[groep]();
  return SUBGROEPEN.find(x => x.groep === groep && x.sleutel === sleutel);
}

export const DSL_SJABLONEN = [
  qrlabel('qrlabel', 'QR-label', 56),
  qrlabel('qrlabel-half', 'QR-label half', 28),
  locatie('locatie', 'Locatielabel', 56),
  locatie('locatie-half', 'Locatielabel half', 28),
  {
    ...basis, id: 'backdrop', naam: 'Backdrop', printer: 'a4', opmaak: 'staand', formaat: { b: 74, h: 105 },
    gat: true, voet: true,
    velden: [uitNaam('Naam', 'kaal', true), uitNaam('Breedte', 'breedte', true, { eenheid: 'm' }), uitNaam('Hoogte', 'hoogte', true, { eenheid: 'm' }), uitNaam('Kwaliteit', 'kwaliteit'), keuze('Kleur', ['Zwart', 'Wit', 'Rood'])],
    plekken: { ...leeg, titel: [v('Naam')], groot: [v('Breedte'), ' × ', v('Hoogte'), 'm'], eigenschappen: [{ kop: 'Kwaliteit', waarde: [v('Kwaliteit')] }, { kop: 'Kleur', waarde: [v('Kleur')] }] },
    kleuren: { rand: { sleutel: [v('Breedte'), ' × ', v('Hoogte')], waarden: {} } },
    cert: 'Gecertificeerd volgens DIN 4102 B1',
  },
  {
    ...basis, id: 'pipe-drape', naam: 'Pipe & Drape', printer: 'a4', opmaak: 'liggend', formaat: { b: 105, h: 74 },
    gat: true, voet: true,
    velden: [uitNaam('Naam', 'kaal', true), uitNaam('Lengte', 'breedte', true, { eenheid: 'm' }), uitNaam('Hoogte', 'hoogte', true, { eenheid: 'm' })],
    plekken: { ...leeg, titel: ['Pipe & Drape'], groot: [v('Lengte'), ' × ', v('Hoogte'), 'm'], eigenschappen: [{ kop: 'Inhoud', waarde: [v('Naam')] }] },
    kleuren: { rand: { sleutel: [v('Lengte'), ' × ', v('Hoogte')], waarden: {} } },
  },
  speakertas(),
  leegBordje('leeg-staand', 'Leeg bordje staand', 'staand', 74, 105),
  leegBordje('leeg-liggend', 'Leeg bordje liggend', 'liggend', 105, 74),
  vrijBordje('bordje-staand', 'Bordje staand', 'staand', 74, 105),
  vrijBordje('bordje-liggend', 'Bordje liggend', 'liggend', 105, 74),
  stellingbord('stellingbord', 'Stellingbord A4', 194, 281),
  stellingbord('stellingbord-a5', 'Stellingbord A5', 136, 194),
  bakbord('bakbord', 'Bakbord (16 cm)'),
  wandbord('wandbord-staand', 'Wandbord A4 staand', 194, 281),
  wandbord('wandbord-liggend', 'Wandbord A4 liggend', 281, 194),
  wandbord('wandbord-a5-staand', 'Wandbord A5 staand', 136, 194),
  wandbord('wandbord-a5-liggend', 'Wandbord A5 liggend', 194, 136),
  kistbordje('kist', 'Materiaalbordje kist (A5)'),
  kistModern(),
  kistBw1000(),
  kistBw6040(),
  scanlijst(),
  {
    ...basis, id: 'gitterbox', naam: 'Gitterbox-strook', printer: 'a4', opmaak: 'strook', formaat: { b: 180, h: 48 },
    logoBoven: true,
    velden: [uitNaam('Naam', 'kaal', true, { oud: ['Omschrijving'] }), uitNaam('Lengte', 'lengte', false, { eenheid: 'm' }), uitNaam('Connector', 'polen'), uitNaam('Kabel', 'kabel'),
      keuze('Doorsnede', ['2,5 mm²', '4 mm²'], 'Kabel'), artikelnummer(true)],
    plekken: { ...leeg, titel: [v('Naam')], groot: [v('Lengte'), ' m'], label: [v('Connector'), ' ', v('Doorsnede')], onder: ['Artikelnummer ', v('Artikelnummer')] },
    kleuren: {
      rand: { veld: 'Lengte', waarden: { '2,5': '#ffff00', '5': '#00b050', '7,5': '#0050ff', '10': '#ff0000', '15': '#7030a0', '20': '#ffffff', '25': '#ff8c00' } },
      label: { veld: 'Doorsnede', waarden: { '2,5mm²': '#c00000', '4mm²': '#00a050' } },
    },
  },
];

/** Waarde van één veld voor dit artikel. */
export function veldwaarde(veld, artikel, aanvullingen = {}, qr = '') {
  // Een aanvulling met de naam van het veld gaat altijd voor, ook leeg (= niet op het bordje).
  if (aanvullingen && Object.hasOwn(aanvullingen, veld.naam)) return String(aanvullingen[veld.naam] ?? '').trim();
  for (const oud of veld.oud || []) if (aanvullingen && Object.hasOwn(aanvullingen, oud)) return String(aanvullingen[oud] ?? '').trim();
  const erbij = (veld.erbij || []).map(k => String(aanvullingen?.[k] ?? '').trim()).filter(Boolean);
  return [natuurlijkeWaarde(veld, artikel, qr), ...erbij].filter(Boolean).join('\n');
}

/** Waarde zonder aanvulling: uit de export of uit de naam. */
export function natuurlijkeWaarde(veld, artikel, qr = '') {
  const h = veld.herkomst;
  if (h.type === 'exemplaar') {
    // QR van een kist (exemplaar); de eigen QR van het artikel of geen QR: de eerste kist.
    const kisten = artikel.kisten || {};
    const kist = kisten[qr] || (!qr || qr === artikel.qr ? Object.values(kisten)[0] : undefined);
    const w = String(kist?.[h.sleutel] ?? '').trim();
    return w || (h.kolom ? String(artikel[h.kolom] ?? '').trim() : '');
  }
  if (h.type === 'kolom') return String(artikel[h.kolom] ?? '').trim();
  if (h.type === 'naam') return (PATRONEN[h.patroon] || (() => ''))(artikel.naam || '');
  return '';
}

// Een veld met alleenAls telt alleen mee als dat andere veld een waarde heeft
// (Doorsnede alleen bij kabels).
function waarden(sjabloon, artikel, aanvullingen, qr = '') {
  const w = {};
  for (const veld of sjabloon.velden) w[veld.naam] = veldwaarde(veld, artikel, aanvullingen, qr);
  for (const veld of sjabloon.velden) if (veld.alleenAls && !w[veld.alleenAls]) w[veld.naam] = '';
  return w;
}

/** Tokens invullen; zijn alle velden in de plek leeg, dan is de plek leeg. */
function plek(tokens = [], w) {
  const velden = tokens.filter(t => typeof t !== 'string');
  if (velden.length && velden.every(t => !w[t.veld])) return '';
  return tokens.map(t => (typeof t === 'string' ? t : w[t.veld] || '')).join('').replace(/\s+/g, ' ').trim();
}

/** Alleen #rrggbb is een geldige kleur (komt in een style-attribuut terecht). */
export function geldigeKleur(hex) {
  return /^#[0-9a-f]{6}$/i.test(String(hex ?? '').trim()) ? String(hex).trim().toLowerCase() : null;
}

// Kleurregel: { sleutel: Token[], waarden } of het oudere { veld, waarden }.
function kleur(regel, w) {
  if (!regel) return ONBEKEND;
  const tokens = regel.sleutel || [{ veld: regel.veld }];
  const s = sleutel(plek(tokens, w));
  // begin: een waarde geldt voor alles wat ermee begint (zone A → A1, A4-2-1); de langste wint.
  const k = regel.begin && s ? Object.keys(regel.waarden || {}).filter(x => x && s.startsWith(x)).sort((a, b) => b.length - a.length)[0] : s;
  return geldigeKleur(regel.waarden?.[k]) || geldigeKleur(regel.anders) || ONBEKEND;
}

// Vrije regels 'Kop: waarde' (één per regel) als eigenschappen.
function regelsUit(tekst) {
  return String(tekst || '').split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(r => {
    const i = r.indexOf(':');
    return i > 0 ? [r.slice(0, i).trim(), r.slice(i + 1).trim()] : ['', r];
  });
}

/** Zelf gekozen randkleur (aanvulling 'Randkleur'): gaat voor op elk bordje. Leeg = wat het sjabloon zegt. */
function eigenRand(aanvullingen) {
  const k = String(aanvullingen?.Randkleur ?? '').trim();
  if (!k) return null;
  if (sleutel(k) === 'geen') return ONBEKEND;
  return kleurBijNaam(k) || geldigeKleur(k);
}

/** Inhoudslijst: 'aantal naam' per regel ('30 kabel', '40× kabel', '2 x kabel'); zonder getal: ['', regel].
 *  Inhoud van inhoud (Robin, 26 nov): een regel zonder aantal in HOOFDLETTERS of eindigend op ':' is een kopje
 *  (['', tekst, 'kop']); een regel die begint met ↳, > of - is een notitie bij het vorige artikel (['', tekst, 'noot']).
 *  Een getal is alleen een aantal met een spatie of x/× erna; ' vooraan maakt er altijd gewone tekst van. */
function lijstUit(tekst) {
  return String(tekst || '').split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(r => {
    const noot = /^(?:↳|>|-)\s*(.+)$/.exec(r);
    if (noot) return ['', noot[1].trim(), 'noot'];
    // ' vooraan: nooit een aantal (zoals in Excel), bv. '19 inch rack
    if (r.startsWith("'")) return ['', r.slice(1).trim()];
    // Aantal alleen met een spatie of x/× na het getal: '230V verloop' en '4HE kabelbak' blijven tekst (Robin, 26 nov).
    const m = /^(\d+(?:[.,]\d+)?)(?:\s*[x×]\s+|×|\s+)(.+)$/i.exec(r);
    if (m) return [m[1], m[2].trim()];
    if (/:$/.test(r)) return ['', r.replace(/:+$/, '').trim(), 'kop'];
    if (/^\p{L}/u.test(r) && r === r.toUpperCase()) return ['', r, 'kop'];
    return ['', r];
  });
}

/** QR-waarde voor 'bewust zonder QR-code' (vinkje in Maken): niets tonen, ook geen melding. */
export const GEEN_QR = '∅';

export function vul(sjabloon, artikel, aanvullingen = {}, qr = '') {
  const bewustZonder = qr === GEEN_QR;
  if (bewustZonder) qr = '';
  const w = waarden(sjabloon, artikel, aanvullingen, qr);
  const geenQr = bewustZonder || zonderQr(sjabloon, w);
  const p = sjabloon.plekken;
  const labelTekst = plek(p.label, w);
  return {
    sjabloon: sjabloon.id,
    opmaak: sjabloon.opmaak,
    formaat: { ...sjabloon.formaat },
    titel: plek(p.titel, w),
    groot: plek(p.groot, w),
    label: labelTekst ? { tekst: labelTekst, kleur: kleur(sjabloon.kleuren.label, w) } : null,
    eigenschappen: [...(p.eigenschappen || []).map(e => [e.kop, plek(e.waarde, w)]), ...(sjabloon.regelsVeld ? regelsUit(w[sjabloon.regelsVeld]) : [])].filter(e => e[1]),
    onder: plek(p.onder, w),
    qr: geenQr ? '' : p.qr ? plek(p.qr, w) : String(qr || ''),
    geenQr,
    rand: (!sjabloon.kleuren.rand?.vast && eigenRand(aanvullingen)) || kleur(sjabloon.kleuren.rand, w),
    cert: sjabloon.cert || '',
    gat: !!sjabloon.gat,
    sticker: sjabloon.sticker !== false,
    voet: !!sjabloon.voet,
    logoBoven: !!sjabloon.logoBoven,
    waarden: w,
    lijst: [].concat(sjabloon.lijstVeld || []).flatMap(naam => lijstUit(w[naam])),
    ...(sjabloon.opmaak === 'scanlijst' ? scanInhoud(scanRegels(w, aanvullingen)) : {}),
  };
}

function scanInhoud(regels) {
  const r = zoekScanArtikelen(regels);
  return { scanlijst: r.items.map(a => ({ naam: String(a.naam || ''), code: String(a.code || ''), qr: String(a.qr || '') })), scanNietGevonden: r.nietGevonden };
}

/** Verplichte aanvulvelden die nog geen waarde hebben. */
export function ontbrekend(sjabloon, artikel, aanvullingen = {}) {
  const w = waarden(sjabloon, artikel, aanvullingen);
  return sjabloon.velden.filter(v => v.herkomst.type === 'aanvulling' && v.verplicht
    && !(v.alleenAls && !w[v.alleenAls]) && !veldwaarde(v, artikel, aanvullingen));
}

/** Welke QR-codes: per exemplaar bij serie-artikelen, anders de artikel-QR. */
export function qrsVoor(artikel) {
  if (artikel.soort === 'serie' && artikel.exemplaren?.length) return [...artikel.exemplaren];
  return [artikel.qr || ''];
}

/** Standaardregels DSL: welk sjabloon bij welke categorie (pad) en naam. */
export const DSL_REGELS = {
  bordje: [
    { pad: 'speakon', sjabloon: 'gitterbox' },
    { pad: '/ backdrop', sjabloon: 'backdrop' },
    { pad: 'pipe en drape', naam: 'doek', sjabloon: 'pipe-drape' },
  ],
  standaard: { bordje: 'bordje-staand', qrlabel: 'qrlabel', locatie: 'locatie', kist: 'kist' },
};

const bevat = (tekst, deel) => !deel || String(tekst || '').toLowerCase().includes(String(deel).toLowerCase());

/** Sjabloon dat bij het artikel past. Een los item gebruikt bij 'bordje' zijn eigen sjabloon. */
export function standaardSjabloon(artikel, actie, regels = DSL_REGELS) {
  if (actie !== 'bordje') return regels.standaard[actie] || DSL_REGELS.standaard[actie];
  if (artikel.sjabloon) return artikel.sjabloon;
  const regel = (regels.bordje || []).find(r => (r.pad || r.naam) && bevat(artikel.pad, r.pad) && bevat(artikel.naam, r.naam));
  if (regel) return regel.sjabloon;
  // Kist met bekende inhoud (uit de exemplaren-export): het materiaalbordje.
  const kist = regels.standaard?.kist ?? DSL_REGELS.standaard.kist;
  if (kist && Object.values(artikel.kisten || {}).some(k => k?.inhoud)) return kist;
  return regels.standaard.bordje;
}
