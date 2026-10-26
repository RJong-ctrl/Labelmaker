// Sjablonen: welke velden, waar ze op het bordje komen en welke kleur erbij hoort.
// vul() maakt van sjabloon + artikel + aanvullingen een Inhoud die opmaak.js tekent.

import { PATRONEN } from './afleiden.js';
import { sleutel, ONBEKEND } from './kleuren.js';

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

export const DSL_SJABLONEN = [
  qrlabel('qrlabel', 'QR-label', 56),
  qrlabel('qrlabel-half', 'QR-label half', 28),
  locatie('locatie', 'Locatielabel', 56),
  locatie('locatie-half', 'Locatielabel half', 28),
  {
    ...basis, id: 'backdrop', naam: 'Backdrop', printer: 'a4', opmaak: 'staand', formaat: { b: 74, h: 105 },
    gat: true, voet: true,
    velden: [uitNaam('Naam', 'kaal', true), uitNaam('Maat', 'maat', true), uitNaam('Kwaliteit', 'kwaliteit'), keuze('Kleur', ['Zwart', 'Wit', 'Rood'])],
    plekken: { ...leeg, titel: [v('Naam')], groot: [v('Maat'), ' m'], eigenschappen: [{ kop: 'Kwaliteit', waarde: [v('Kwaliteit')] }, { kop: 'Kleur', waarde: [v('Kleur')] }] },
    kleuren: { rand: { veld: 'Maat', waarden: {} } },
    cert: 'Gecertificeerd volgens DIN 4102 B1',
  },
  {
    ...basis, id: 'pipe-drape', naam: 'Pipe & Drape', printer: 'a4', opmaak: 'liggend', formaat: { b: 105, h: 74 },
    gat: true, voet: true,
    velden: [uitNaam('Naam', 'kaal', true), uitNaam('Maat', 'maat', true)],
    plekken: { ...leeg, titel: ['Pipe & Drape'], groot: [v('Maat'), ' m'], eigenschappen: [{ kop: 'Inhoud', waarde: [v('Naam')] }] },
    kleuren: { rand: { veld: 'Maat', waarden: {} } },
  },
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
export function veldwaarde(veld, artikel, aanvullingen = {}) {
  const h = veld.herkomst;
  if (h.type === 'kolom') return String(artikel[h.kolom] ?? '').trim();
  if (h.type === 'naam') return (PATRONEN[h.patroon] || (() => ''))(artikel.naam || '');
  return String(aanvullingen[veld.naam] ?? '').trim();
}

// Een veld met alleenAls telt alleen mee als dat andere veld een waarde heeft
// (Doorsnede alleen bij kabels).
function waarden(sjabloon, artikel, aanvullingen) {
  const w = {};
  for (const veld of sjabloon.velden) w[veld.naam] = veldwaarde(veld, artikel, aanvullingen);
  for (const veld of sjabloon.velden) if (veld.alleenAls && !w[veld.alleenAls]) w[veld.naam] = '';
  return w;
}

/** Tokens invullen; zijn alle velden in de plek leeg, dan is de plek leeg. */
function plek(tokens = [], w) {
  const velden = tokens.filter(t => typeof t !== 'string');
  if (velden.length && velden.every(t => !w[t.veld])) return '';
  return tokens.map(t => (typeof t === 'string' ? t : w[t.veld] || '')).join('').replace(/\s+/g, ' ').trim();
}

function kleur(regel, w) {
  if (!regel) return ONBEKEND;
  return regel.waarden[sleutel(w[regel.veld])] || ONBEKEND;
}

export function vul(sjabloon, artikel, aanvullingen = {}, qr = '') {
  const w = waarden(sjabloon, artikel, aanvullingen);
  const p = sjabloon.plekken;
  const labelTekst = plek(p.label, w);
  return {
    sjabloon: sjabloon.id,
    opmaak: sjabloon.opmaak,
    formaat: { ...sjabloon.formaat },
    titel: plek(p.titel, w),
    groot: plek(p.groot, w),
    label: labelTekst ? { tekst: labelTekst, kleur: kleur(sjabloon.kleuren.label, w) } : null,
    eigenschappen: (p.eigenschappen || []).map(e => [e.kop, plek(e.waarde, w)]).filter(e => e[1]),
    onder: plek(p.onder, w),
    qr: p.qr ? plek(p.qr, w) : String(qr || ''),
    rand: kleur(sjabloon.kleuren.rand, w),
    cert: sjabloon.cert || '',
    gat: !!sjabloon.gat,
    voet: !!sjabloon.voet,
    logoBoven: !!sjabloon.logoBoven,
  };
}

/** Verplichte aanvulvelden die nog geen waarde hebben. */
export function ontbrekend(sjabloon, artikel, aanvullingen = {}) {
  const w = waarden(sjabloon, artikel, {});
  return sjabloon.velden.filter(v => v.herkomst.type === 'aanvulling' && v.verplicht
    && !(v.alleenAls && !w[v.alleenAls]) && !veldwaarde(v, artikel, aanvullingen));
}

/** Welke QR-codes: per exemplaar bij serie-artikelen, anders de artikel-QR. */
export function qrsVoor(artikel) {
  if (artikel.soort === 'serie' && artikel.exemplaren?.length) return [...artikel.exemplaren];
  return [artikel.qr || ''];
}

/** Sjabloon dat bij het artikel past (volgt de map in Rentman). */
export function standaardSjabloon(artikel, actie) {
  if (actie === 'qrlabel') return 'qrlabel';
  if (actie === 'locatie') return 'locatie';
  const pad = artikel.pad || '';
  if (/speakon/i.test(pad)) return 'gitterbox';
  if (/\/\s*backdrop/i.test(pad)) return 'backdrop';
  if (/pipe en drape/i.test(pad) && /doek/i.test(artikel.naam || '')) return 'pipe-drape';
  return 'qrlabel';
}
