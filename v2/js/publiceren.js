// Publiceren: de gedeelde basis van een profiel als één bestand (data/<profiel>.json)
// maken, controleren en ophalen. De repository is openbaar, dus er gaat alleen in wat
// onschuldig is: geen prijzen, geen interne opmerkingen, geen pincode, geen eigen lettertype.

import { TOEGESTANE_VELDEN } from './import.js';

const TYPE = 'labelmaker-basis';
const VERSIE = 1;

// Artikelen en losse items: alleen deze sleutels gaan mee.
const ARTIKELSLEUTELS = new Set(['id', 'combinatie', 'sjabloon', ...TOEGESTANE_VELDEN]);
// Huisstijl: logo en certificaaticoon (afbeeldingen) mogen mee, een eigen lettertype niet.
const HUISSTIJLSLEUTELS = ['logo', 'voet', 'certIcoon', 'lettertype'];
// Sleutels die nergens in een publicatie horen, op welk niveau dan ook.
const GEHEIM = /^(pincode|eigenLettertype)$/i;
const INTERN = /^opmerking\s*intern$/i;

const LIJSTEN = ['artikelen', 'losseItems', 'sjablonen'];
const OBJECTEN = ['aanvullingen', 'regels', 'huisstijl', 'printers', 'kolommen'];

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const kopie = (x) => JSON.parse(JSON.stringify(x));

/** Kopie zonder geheime sleutels, ook diep in geneste gegevens. */
function zonderGeheimen(x) {
  if (Array.isArray(x)) return x.map(zonderGeheimen);
  if (!isObject(x)) return x;
  return Object.fromEntries(Object.entries(x).filter(([k]) => !GEHEIM.test(k)).map(([k, v]) => [k, zonderGeheimen(v)]));
}

function schoonArtikel(a) {
  const uit = {};
  for (const [k, v] of Object.entries(a)) if (ARTIKELSLEUTELS.has(k)) uit[k] = Array.isArray(v) ? [...v] : v;
  return uit;
}

const schoneLijst = (lijst) => (Array.isArray(lijst) ? lijst : []).filter(isObject).map(schoonArtikel);

function schoneHuisstijl(h) {
  if (!isObject(h)) return {};
  const uit = {};
  for (const k of HUISSTIJLSLEUTELS) if (k in h) uit[k] = Array.isArray(h[k]) ? [...h[k]] : h[k];
  return uit;
}

function schoneAanvullingen(aanvullingen) {
  const uit = {};
  for (const [id, velden] of Object.entries(isObject(aanvullingen) ? aanvullingen : {})) {
    if (!isObject(velden)) continue;
    const schoon = Object.fromEntries(Object.entries(velden).filter(([k]) => !INTERN.test(k) && !GEHEIM.test(k)).map(([k, w]) => [k, String(w)]));
    if (Object.keys(schoon).length) uit[id] = schoon;
  }
  return uit;
}

/**
 * Het publicatiebestand voor dit profiel, gemaakt van de effectieve gegevens.
 * Alles wordt opnieuw gefilterd, ook wat bij het inlezen al gefilterd is.
 * @param {object} effectief  uitkomst van samen()
 * @param {string} profielId
 * @param {Date|string|number} [datum]
 */
export function maakBasis(effectief, profielId, datum = new Date()) {
  const e = effectief || {};
  return {
    type: TYPE,
    versie: VERSIE,
    profiel: profielId,
    datum: new Date(datum).toISOString(),
    artikelen: schoneLijst(e.artikelen),
    losseItems: schoneLijst(e.losseItems),
    sjablonen: zonderGeheimen(kopie(e.sjablonen || [])),
    regels: zonderGeheimen(kopie(e.regels || {})),
    huisstijl: schoneHuisstijl(e.huisstijl),
    printers: zonderGeheimen(kopie(e.printers || {})),
    kolommen: Object.fromEntries(Object.entries(e.kolommen || {}).filter(([k]) => TOEGESTANE_VELDEN.includes(k))),
    aanvullingen: schoneAanvullingen(e.aanvullingen),
  };
}

/**
 * Controleert een publicatiebestand (tekst of al gelezen object).
 * @returns {{ basis: object } | { fout: string }}
 */
export function leesBasis(tekst) {
  let j = tekst;
  if (typeof tekst === 'string') {
    try { j = JSON.parse(tekst); } catch { return { fout: 'Dit bestand is geen geldig publicatiebestand: de inhoud is geen JSON.' }; }
  }
  if (!isObject(j) || j.type !== TYPE) return { fout: 'Dit is geen publicatiebestand van de Labelmaker.' };
  if (typeof j.versie !== 'number' || !Number.isFinite(j.versie)) return { fout: 'Dit publicatiebestand heeft geen geldige versie.' };
  if (j.versie > VERSIE) return { fout: `Dit publicatiebestand is gemaakt met een nieuwere versie van de Labelmaker (versie ${j.versie}). Ververs de pagina om de nieuwste versie te laden.` };
  if (j.versie !== VERSIE) return { fout: `Dit publicatiebestand heeft een onbekende versie (${j.versie}).` };
  if (typeof j.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(j.datum) || Number.isNaN(Date.parse(j.datum))) {
    return { fout: 'Dit publicatiebestand heeft geen geldige datum.' };
  }
  for (const k of LIJSTEN) if (k in j && !Array.isArray(j[k])) return { fout: `Het onderdeel "${k}" in dit publicatiebestand klopt niet: een lijst werd verwacht.` };
  for (const k of OBJECTEN) if (k in j && !isObject(j[k])) return { fout: `Het onderdeel "${k}" in dit publicatiebestand klopt niet: een object werd verwacht.` };
  return { basis: j };
}

export const bestandsnaam = (profielId) => `${profielId}.json`;

/**
 * Haalt data/<profiel>.json op, naast de pagina. Geen netwerk, geen bestand of een
 * onbruikbaar bestand geeft null; deze functie gooit nooit.
 */
export async function haalBasis(profielId, fetcher = fetch) {
  try {
    const antwoord = await fetcher(`data/${encodeURIComponent(profielId)}.json`, { cache: 'no-cache' });
    if (!antwoord || !antwoord.ok) return null;
    const inhoud = typeof antwoord.text === 'function' ? await antwoord.text() : await antwoord.json();
    return leesBasis(inhoud).basis || null;
  } catch {
    return null;
  }
}

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
let formaat;

/** '2026-10-26T20:00:00Z' → '26 okt' (datum in Nederland). Onleesbaar geeft ''. */
export function korteDatum(iso) {
  if (iso === undefined || iso === null || iso === '') return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let dag = d.getUTCDate();
  let maand = d.getUTCMonth();
  try {
    formaat ||= new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'numeric' });
    const delen = Object.fromEntries(formaat.formatToParts(d).map(p => [p.type, p.value]));
    dag = Number(delen.day);
    maand = Number(delen.month) - 1;
  } catch { /* zonder tijdzonegegevens telt de UTC-dag */ }
  return `${dag} ${MAANDEN[maand]}`;
}
