// Sjablonen: welke velden, waar ze op het bordje komen en welke kleur erbij hoort.
// vul() maakt van sjabloon + artikel + aanvullingen een Inhoud die opmaak.js tekent.

import { PATRONEN } from './afleiden.js';
import { sleutel, ONBEKEND, kleurBijNaam } from './kleuren.js';

const kolom = (naam, k, verplicht = false) => ({ naam, soort: 'tekst', herkomst: { type: 'kolom', kolom: k }, verplicht });
const uitNaam = (naam, patroon, verplicht = false) => ({ naam, soort: 'tekst', herkomst: { type: 'naam', patroon }, verplicht });
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
  velden: [kolom('Naam', 'naam', true), kolom('Code', 'code'),
    { naam: 'Groot', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false },
    { naam: 'Omschrijving', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false },
    { naam: 'Regels', soort: 'tekst', meerregelig: true, herkomst: { type: 'aanvulling' }, verplicht: false }],
  regelsVeld: 'Regels',
  plekken: { ...leeg, titel: [v('Naam')], groot: [v('Groot')], eigenschappen: [{ kop: 'Omschrijving', waarde: [v('Omschrijving')] }], onder: ['Artikelnummer ', v('Code')] },
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
  velden: [kolom('Locatie', 'locatie', true), aanvul('Inhoud')],
  plekken: { ...leeg, titel: [v('Locatie')], onder: [v('Inhoud')], qr: [v('Locatie')] },
});

/** Materiaalbordje voor op de kist (gelamineerd in een A5-hoes), opgebouwd als het oude bordje: logo, vak voor
 *  de projectsticker (vroeger klant en productie), QR; locatie en gewicht; inhoud met kistnummer; zwarte voet.
 *  Inhoud: één regel per onderdeel ('aantal naam'). Twee per A4. */
export const kistbordje = (id, naam, opmaak = 'kist') => ({
  ...basis, id, naam, printer: 'a4', opmaak, formaat: { b: 194, h: 136 }, gat: false, voet: true,
  velden: [kolom('Naam', 'naam', true), uitKist('Code', 'nr', 'code'), kolom('Locatie', 'locatie'),
    uitKist('Gewicht', 'gewicht', '', { eenheid: 'kg' }), uitKist('Inhoud', 'inhoud', '', { meerregelig: true, plaatshouder: 'Aantal en naam, één per regel (30 DMX 3p 1,25m)' })],
  lijstVeld: 'Inhoud',
  plekken: { ...leeg, titel: [v('Naam')], groot: [v('Code')], onder: [v('Code')] },
  // Vaste kleur: altijd DSL blauw (een gekozen randkleur telt hier niet).
  kleuren: { rand: { sleutel: [], waarden: {}, anders: '#005abb', vast: true } },
});

export const DSL_SJABLONEN = [
  qrlabel('qrlabel', 'QR-label', 56),
  qrlabel('qrlabel-half', 'QR-label half', 28),
  locatie('locatie', 'Locatielabel', 56),
  locatie('locatie-half', 'Locatielabel half', 28),
  {
    ...basis, id: 'backdrop', naam: 'Backdrop', printer: 'a4', opmaak: 'staand', formaat: { b: 74, h: 105 },
    gat: true, voet: true,
    velden: [uitNaam('Naam', 'kaal', true), uitNaam('Breedte', 'breedte', true), uitNaam('Hoogte', 'hoogte', true), uitNaam('Kwaliteit', 'kwaliteit'), keuze('Kleur', ['Zwart', 'Wit', 'Rood'])],
    plekken: { ...leeg, titel: [v('Naam')], groot: [v('Breedte'), ' × ', v('Hoogte'), 'm'], eigenschappen: [{ kop: 'Kwaliteit', waarde: [v('Kwaliteit')] }, { kop: 'Kleur', waarde: [v('Kleur')] }] },
    kleuren: { rand: { sleutel: [v('Breedte'), ' × ', v('Hoogte')], waarden: {} } },
    cert: 'Gecertificeerd volgens DIN 4102 B1',
  },
  {
    ...basis, id: 'pipe-drape', naam: 'Pipe & Drape', printer: 'a4', opmaak: 'liggend', formaat: { b: 105, h: 74 },
    gat: true, voet: true,
    velden: [uitNaam('Naam', 'kaal', true), uitNaam('Lengte', 'breedte', true), uitNaam('Hoogte', 'hoogte', true)],
    plekken: { ...leeg, titel: ['Pipe & Drape'], groot: [v('Lengte'), ' × ', v('Hoogte'), 'm'], eigenschappen: [{ kop: 'Inhoud', waarde: [v('Naam')] }] },
    kleuren: { rand: { sleutel: [v('Lengte'), ' × ', v('Hoogte')], waarden: {} } },
  },
  leegBordje('leeg-staand', 'Leeg bordje staand', 'staand', 74, 105),
  leegBordje('leeg-liggend', 'Leeg bordje liggend', 'liggend', 105, 74),
  vrijBordje('bordje-staand', 'Bordje staand', 'staand', 74, 105),
  vrijBordje('bordje-liggend', 'Bordje liggend', 'liggend', 105, 74),
  wandbord('wandbord-staand', 'Wandbord A4 staand', 194, 281),
  wandbord('wandbord-liggend', 'Wandbord A4 liggend', 281, 194),
  wandbord('wandbord-a5-staand', 'Wandbord A5 staand', 136, 194),
  wandbord('wandbord-a5-liggend', 'Wandbord A5 liggend', 194, 136),
  kistbordje('kist', 'Materiaalbordje kist (A5)'),
  kistbordje('kist-modern', 'Materiaalbordje kist modern (A5)', 'kist-modern'),
  {
    ...basis, id: 'gitterbox', naam: 'Gitterbox-strook', printer: 'a4', opmaak: 'strook', formaat: { b: 180, h: 48 },
    logoBoven: true,
    velden: [uitNaam('Omschrijving', 'kaal', true), uitNaam('Lengte', 'lengte'), uitNaam('Connector', 'polen'), uitNaam('Kabel', 'kabel'),
      keuze('Doorsnede', ['2,5 mm²', '4 mm²'], 'Kabel'), kolom('Artikelnummer', 'code', true)],
    plekken: { ...leeg, titel: [v('Omschrijving')], groot: [v('Lengte'), ' m'], label: [v('Connector'), ' ', v('Doorsnede')], onder: ['Artikelnummer ', v('Artikelnummer')] },
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
  return natuurlijkeWaarde(veld, artikel, qr);
}

/** Waarde zonder aanvulling: uit de export of uit de naam. */
export function natuurlijkeWaarde(veld, artikel, qr = '') {
  const h = veld.herkomst;
  if (h.type === 'exemplaar') {
    const kist = artikel.kisten?.[qr];
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
  return geldigeKleur(regel.waarden?.[sleutel(plek(tokens, w))]) || geldigeKleur(regel.anders) || ONBEKEND;
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

/** Inhoudslijst: 'aantal naam' per regel ('30 kabel', '40× kabel', '2 x kabel'); zonder getal: ['', regel]. */
function lijstUit(tekst) {
  return String(tekst || '').split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(r => {
    const m = /^(\d+(?:[.,]\d+)?)\s*(?:[x×]\s+|×\s*)?(.+)$/i.exec(r);
    return m ? [m[1], m[2].trim()] : ['', r];
  });
}

export function vul(sjabloon, artikel, aanvullingen = {}, qr = '') {
  const w = waarden(sjabloon, artikel, aanvullingen, qr);
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
    qr: p.qr ? plek(p.qr, w) : String(qr || ''),
    rand: (!sjabloon.kleuren.rand?.vast && eigenRand(aanvullingen)) || kleur(sjabloon.kleuren.rand, w),
    cert: sjabloon.cert || '',
    gat: !!sjabloon.gat,
    voet: !!sjabloon.voet,
    logoBoven: !!sjabloon.logoBoven,
    waarden: w,
    lijst: sjabloon.lijstVeld ? lijstUit(w[sjabloon.lijstVeld]) : [],
  };
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
  standaard: { bordje: 'bordje-staand', qrlabel: 'qrlabel', locatie: 'locatie' },
};

const bevat = (tekst, deel) => !deel || String(tekst || '').toLowerCase().includes(String(deel).toLowerCase());

/** Sjabloon dat bij het artikel past. Een los item gebruikt bij 'bordje' zijn eigen sjabloon. */
export function standaardSjabloon(artikel, actie, regels = DSL_REGELS) {
  if (actie !== 'bordje') return regels.standaard[actie] || DSL_REGELS.standaard[actie];
  if (artikel.sjabloon) return artikel.sjabloon;
  const regel = (regels.bordje || []).find(r => (r.pad || r.naam) && bevat(artikel.pad, r.pad) && bevat(artikel.naam, r.naam));
  return regel ? regel.sjabloon : regels.standaard.bordje;
}
