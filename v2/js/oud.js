// Gegevens uit versie 25 omzetten naar v2: eigen sjablonen, kleurcodes van de drie
// standaardsjablonen, opgeslagen bordjes, labels en locaties. Puur rekenwerk (geen DOM);
// de bron is een exportbestand van versie 25 en/of de localStorage-sleutels `lm-*`.
//
// Wat versie 25 bewaart:
//   lm-tpls   [{ id, naam, titel, fmt: 'P'|'L', w, h, nofoot, nohole, logotop, fields, hero, regels,
//                xl, xt, cert, ckey, colors, badge, bkey, bcolors }]
//   lm-signs  [{ id, fmt, titel, hero, kleur, regels, extraLabel, extraText, qr, cert, tpl?, vals?, _badge? }]
//   lm-lib    [{ t1, t2, qr }]            lm-loc    regels 'code<TAB of ;>omschrijving<…>aantal'
//   lm-certicon  data-URL van het certificaaticoon

import { vrijBordje, geldigeKleur } from './sjablonen.js';
import { KLEURNAMEN, sleutel } from './kleuren.js';

// Standaardsjablonen van versie 25 -> het DSL-sjabloon in v2 waar alleen de kleurcodes naartoe gaan.
const STANDAARD_V25 = { 't-backdrop': 'backdrop', 't-pd': 'pipe-drape', 't-gbkabel': 'gitterbox' };
const EXPORT_TYPES = ['labelmaker-bordjes', 'labelmaker-bibliotheek'];
const GEEN_EXPORT = 'Dit is geen exportbestand van versie 25 van de Labelmaker.';
const ONBEKEND_GRIJS = '#7f7f7f';
const STANDAARD_RAND = '#ffff00'; // een vrij bordje zonder kleur is in versie 25 geel

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const tekst = (x) => (x === undefined || x === null ? '' : String(x));
const regelsVan = (x) => tekst(x).split(/\r?\n/).map(r => r.trim()).filter(Boolean);

// ---------- bronnen lezen ----------

function leesSleutel(opslag, k) {
  try { return opslag.get(k); } catch { return null; }
}

function lijstUit(inhoud) {
  if (Array.isArray(inhoud)) return inhoud;
  try {
    const x = JSON.parse(inhoud);
    return Array.isArray(x) ? x : [];
  } catch { return []; }
}

/** Eerst `basis`, dan `extra`; bij dezelfde sleutel wint de latere, op de plek van de eerste. Zonder sleutel blijft elk item apart. */
function voegSamen(basis, extra, sleutelVan) {
  const kaart = new Map();
  let n = 0;
  for (const x of [...basis, ...extra]) {
    if (!isObject(x)) continue;
    const k = sleutelVan(x);
    kaart.set(k === null ? `#${n++}` : k, x);
  }
  return [...kaart.values()];
}

function controleerExport(x) {
  const bekend = Array.isArray(x) || (isObject(x) && (x.type ? EXPORT_TYPES.includes(x.type) : ['bordjes', 'sjablonen', 'labels'].some(k => Array.isArray(x[k]))));
  if (!bekend) throw new Error(GEEN_EXPORT);
  if (!Array.isArray(x)) for (const k of ['bordjes', 'sjablonen', 'labels']) if (k in x && !Array.isArray(x[k])) throw new Error(GEEN_EXPORT);
  return Array.isArray(x) ? { bordjes: x } : x;
}

const iconen = (x) => (typeof x === 'string' && /^data:image\/[a-z0-9.+-]+[;,]/i.test(x) ? x : null);

const sleutelSjabloon = (t) => (tekst(t.id) ? 'id:' + t.id : null);
const sleutelBordje = (b) => (b.id === undefined || b.id === null ? null : 'id:' + b.id);
const sleutelLabel = (l) => (tekst(l.qr) ? 'qr:' + l.qr : null);

function verzamel(uitvoer, opslag) {
  let tpls = [], bordjes = [], labels = [], loc = '', icoon = null;
  if (opslag) {
    tpls = lijstUit(leesSleutel(opslag, 'lm-tpls'));
    bordjes = lijstUit(leesSleutel(opslag, 'lm-signs'));
    labels = lijstUit(leesSleutel(opslag, 'lm-lib'));
    loc = tekst(leesSleutel(opslag, 'lm-loc'));
    icoon = iconen(leesSleutel(opslag, 'lm-certicon'));
  }
  const j = uitvoer === undefined || uitvoer === null ? {} : controleerExport(uitvoer);
  return {
    tpls: voegSamen(tpls, j.sjablonen || [], sleutelSjabloon).filter(t => tekst(t.id)),
    bordjes: voegSamen(bordjes, j.bordjes || [], sleutelBordje),
    labels: voegSamen(labels, j.labels || [], sleutelLabel).filter(l => tekst(l.qr)),
    loc,
    icoon: iconen(j.certicoon) || icoon,
  };
}

// ---------- sjablonen van versie 25 lezen ----------

/** `key | Label | tekst/getal/keuze | eenheid of opties | optioneel` per regel (zoals parseFields in versie 25). */
function leesVelden(fields) {
  return tekst(fields).split(/\r?\n/).map(l => l.split('|').map(x => x.trim())).filter(p => p[0]).map(p => {
    const keuze = /keuze/i.test(p[2] || '');
    const vrij = /tekst/i.test(p[2] || '');
    const optioneel = /^optioneel$/i.test(p[3] || '');
    return {
      key: p[0].replace(/\W/g, ''),
      label: p[1] || p[0],
      opt: p.slice(2).some(x => /^optioneel$/i.test(x)),
      soort: keuze ? 'keuze' : (vrij ? 'tekst' : 'getal'),
      eenheid: keuze || vrij || optioneel ? '' : (p[3] || ''),
      opties: keuze ? (p[3] || '').split((p[3] || '').includes(';') ? ';' : ',').map(x => x.trim()).filter(Boolean) : [],
    };
  }).filter(f => f.key);
}

/** Tekst met {sleutel} invullen zoals fillT in versie 25: een regel met alleen lege optionele velden valt weg. */
function vulTekst(sjabloonTekst, vals, velden) {
  const optioneel = new Set(velden.filter(f => f.opt).map(f => f.key));
  const heeft = (k) => vals[k] !== undefined && vals[k] !== null && vals[k] !== '';
  return tekst(sjabloonTekst).split(/\r?\n/).map(regel => {
    const sleutels = [...regel.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    if (sleutels.length && sleutels.every(k => !heeft(k) && optioneel.has(k))) return null;
    return regel.replace(/\{(\w+)\}/g, (m, k) => (heeft(k) ? String(vals[k]) : (optioneel.has(k) ? '' : '…'))).replace(/\s{2,}/g, ' ');
  }).filter(r => r !== null).join('\n');
}

const hexVan = (v) => {
  const naam = tekst(v).trim().toLowerCase();
  return geldigeKleur(v) || (Object.hasOwn(KLEURNAMEN, naam) ? KLEURNAMEN[naam] : null);
};
const kleurNaam = (hex) => Object.keys(KLEURNAMEN).find(n => KLEURNAMEN[n] === hex) || hex;

/** `{ '6 x 3.5': '#B000B0' }` -> `{ '6×3,5': '#b000b0' }`; alles wat geen kleur is valt weg. */
function kleurenTabel(kleuren) {
  const uit = {};
  for (const [k, v] of Object.entries(isObject(kleuren) ? kleuren : {})) {
    const hex = hexVan(v);
    if (hex && sleutel(k)) uit[sleutel(k)] = hex;
  }
  return uit;
}

/** Tekst met {sleutel}-plaatsen -> tokens: tekststukken en { veld }. Onbekende plaatsen worden '…' zoals in versie 25. */
function tokens(invoer, naamVan) {
  const uit = [];
  const voeg = (x) => {
    if (x === '') return;
    if (typeof x === 'string' && typeof uit[uit.length - 1] === 'string') uit[uit.length - 1] += x;
    else uit.push(x);
  };
  const t = tekst(invoer).replace(/\s*\r?\n\s*/g, ' ');
  let vanaf = 0;
  for (const m of t.matchAll(/\{(\w+)\}/g)) {
    voeg(t.slice(vanaf, m.index).replace(/[ \t]+/g, ' '));
    voeg(naamVan.has(m[1]) ? { veld: naamVan.get(m[1]) } : '…');
    vanaf = m.index + m[0].length;
  }
  voeg(t.slice(vanaf).replace(/[ \t]+/g, ' '));
  return uit;
}

/** Elke regel 'Kop: waarde {x}' van een v25-sjabloon wordt een eigenschap. */
function eigenschappen(regels, naamVan) {
  return regelsVan(regels).map(r => {
    const i = r.indexOf(':');
    const kop = i > 0 ? r.slice(0, i).trim() : '';
    return i > 0 && !kop.includes('{')
      ? { kop, waarde: tokens(r.slice(i + 1).trim(), naamVan) }
      : { kop: '', waarde: tokens(r, naamVan) };
  });
}

function opmaakEnFormaat(t) {
  const liggend = t.fmt === 'L';
  const b = Number(t.w) || (liggend ? 105 : 74);
  const h = Number(t.h) || (liggend ? 74 : 105);
  const opmaak = h <= 60 && b / h >= 2.6 ? 'strook' : (liggend ? 'liggend' : 'staand');
  return { opmaak, formaat: { b, h } };
}

/** Een eigen v25-sjabloon als v2-sjabloon, plus de koppeling veldsleutel -> veldnaam voor de waarden van bordjes. */
function zetSjabloonOm(t) {
  const naamVan = new Map(); // v25-sleutel -> veldnaam in v2
  const gebruikt = new Set();
  const velden = [];
  for (const f of leesVelden(t.fields)) {
    if (naamVan.has(f.key)) continue;
    let naam = f.label;
    if (gebruikt.has(naam)) naam = `${f.label} (${f.key})`;
    while (gebruikt.has(naam)) naam += '+';
    gebruikt.add(naam);
    naamVan.set(f.key, naam);
    velden.push({
      naam,
      soort: f.soort,
      ...(f.soort === 'getal' && f.eenheid ? { eenheid: f.eenheid } : {}),
      ...(f.soort === 'keuze' ? { opties: f.opties } : {}),
      herkomst: { type: 'aanvulling' },
      verplicht: !f.opt,
    });
  }

  const rijen = eigenschappen(t.regels, naamVan);
  const extra = tekst(t.xt).trim();
  if (extra) rijen.push({ kop: tekst(t.xl).trim().replace(/:\s*$/, ''), waarde: tokens(extra, naamVan) });

  const kleuren = {};
  if (tekst(t.ckey).trim()) kleuren.rand = { sleutel: tokens(t.ckey, naamVan), waarden: kleurenTabel(t.colors) };
  if (tekst(t.badge).trim() && tekst(t.bkey).trim()) kleuren.label = { sleutel: tokens(t.bkey, naamVan), waarden: kleurenTabel(t.bcolors) };

  const sjabloon = {
    id: 'v25-' + tekst(t.id),
    naam: tekst(t.naam) || tekst(t.id),
    printer: 'a4',
    ...opmaakEnFormaat(t),
    gat: !t.nohole,
    voet: !t.nofoot,
    logoBoven: !!t.logotop,
    cert: tekst(t.cert),
    velden,
    plekken: {
      titel: tokens(tekst(t.titel).trim() || t.naam, naamVan),
      groot: tokens(t.hero, naamVan),
      label: tekst(t.badge).trim() ? tokens(t.badge, naamVan) : [],
      eigenschappen: rijen,
      onder: [],
    },
    kleuren,
  };
  return { sjabloon, naamVan };
}

// ---------- vrije bordjes ----------

/** De twee sjablonen voor opgeslagen bordjes zonder (bruikbaar) sjabloon: tekst staat vast in de aanvullingen. */
function vrijSjabloon(id, naam, opmaak, b, h, extraKleuren) {
  const basis = vrijBordje(id, naam, opmaak, b, h);
  return {
    ...basis,
    velden: [
      ...basis.velden,
      { naam: 'Regels', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false },
      { naam: 'Randkleur', soort: 'keuze', opties: [...Object.keys(KLEURNAMEN), ...extraKleuren], herkomst: { type: 'aanvulling' }, verplicht: false },
    ],
    regelsVeld: 'Regels',
    kleuren: { rand: { sleutel: [{ veld: 'Randkleur' }], waarden: { ...KLEURNAMEN, ...Object.fromEntries(extraKleuren.map(k => [k, k])) } } },
  };
}

/** Alle regels van een bordje als één tekst: eigenschappen, extra regel, label en certificaat. */
function regelsTekst(r) {
  const regels = regelsVan(r.regels);
  const label = tekst(r.extraLabel).trim().replace(/:\s*$/, '').trim();
  const extra = regelsVan(r.extraText);
  if (extra.length) {
    extra[0] = label ? `${label}: ${extra[0]}` : extra[0];
    regels.push(...extra);
  }
  for (const rest of [r.badge, r.cert]) if (tekst(rest).trim()) regels.push(tekst(rest).trim());
  return regels.join('\n');
}

// ---------- bordjes, labels en locaties als losse items ----------

const losItem = (id, naam, sjabloon, extra = {}) => ({
  id, naam, code: '', qr: '', exemplaren: [], pad: '', map: 'Losse items', locatie: '',
  soort: 'bulk', type: 'Los item', combinatie: false, aantal: 0, sjabloon, ...extra,
});

/** Eén code is de artikel-QR; meer codes (elk op een eigen regel) zijn exemplaren met elk een eigen bordje. */
function codesVan(qr) {
  const codes = [...new Set(tekst(qr).split(/[\r\n,;\t]+/).map(x => x.trim()).filter(Boolean))];
  return { qr: codes[0] || '', exemplaren: codes.length > 1 ? codes : [], soort: codes.length > 1 ? 'serie' : 'bulk' };
}

/** Wat versie 25 op dit bordje zou tonen: opnieuw uit het sjabloon als dat er is, anders de bewaarde tekst. */
function oplossen(sg, t) {
  if (!t) {
    return { fmt: sg.fmt, titel: tekst(sg.titel), hero: tekst(sg.hero), kleur: sg.kleur || STANDAARD_RAND, regels: sg.regels,
      extraLabel: sg.extraLabel, extraText: sg.extraText, cert: sg.cert, badge: sg._badge };
  }
  const vals = isObject(sg.vals) ? sg.vals : {};
  const velden = leesVelden(t.fields);
  const vul = (s) => vulTekst(s, vals, velden);
  const kleur = kleurenTabel(t.colors)[sleutel(vul(t.ckey))];
  return { fmt: t.fmt, titel: vul(tekst(t.titel) || t.naam), hero: vul(t.hero), kleur: kleur || sg.kleur || ONBEKEND_GRIJS, regels: vul(t.regels),
    extraLabel: tekst(t.xl), extraText: vul(t.xt), cert: tekst(t.cert), badge: t.badge ? vul(t.badge) : '' };
}

/**
 * Zet versie-25-gegevens om voor v2.
 * @param {{ export?: object|object[], opslag?: { get(k: string): string|null } }} [bronnen]
 *   export: een versie-25-exportbestand (bordjes of bibliotheek); opslag: de localStorage van versie 25.
 *   Staan beide erin, dan gaat de export voor. Een vreemd exportbestand geeft een Error; kapotte
 *   localStorage-waarden worden overgeslagen.
 * @returns {{ sjablonen: object[], kleurenDsl: Record<string, Record<string,string>>, losseItems: object[],
 *   aanvullingen: Record<string, Record<string,string>>, certIcoon: string|null,
 *   telling: { sjablonen: number, bordjes: number, labels: number, locaties: number } }}
 */
export function leesV25({ export: uitvoer, opslag } = {}) {
  const bron = verzamel(uitvoer, opslag);
  const kleurenDsl = { backdrop: {}, 'pipe-drape': {}, gitterbox: {} };
  const eigen = new Map();   // v25-id -> { sjabloon, naamVan }
  const perId = new Map(bron.tpls.map(t => [tekst(t.id), t]));
  for (const t of bron.tpls) {
    const doel = Object.hasOwn(STANDAARD_V25, t.id) ? STANDAARD_V25[t.id] : null;
    if (doel) kleurenDsl[doel] = kleurenTabel(t.colors);
    else eigen.set(tekst(t.id), zetSjabloonOm(t));
  }

  const losseItems = [];
  const aanvullingen = {};
  const gebruikt = new Set();
  const uniek = (id) => {
    let kandidaat = id;
    for (let n = 2; gebruikt.has(kandidaat); n++) kandidaat = `${id}-${n}`;
    gebruikt.add(kandidaat);
    return kandidaat;
  };
  const randWaarden = []; // kleuren die een vrij bordje in de keuzelijst nodig heeft
  const vrijGebruikt = { staand: false, liggend: false };

  // bordjes
  let bordjes = 0;
  bron.bordjes.forEach((sg, n) => {
    if (!(sg.titel || sg.tpl)) return;
    const id = uniek('v25-' + (sg.id === undefined || sg.id === null ? `bordje-${n + 1}` : sg.id));
    const t = sg.tpl ? perId.get(tekst(sg.tpl)) : null;
    const gekozen = t ? eigen.get(tekst(t.id)) : null;
    bordjes++;
    if (gekozen) {
      // bordje van een eigen sjabloon: de ingevulde waarden worden aanvullingen
      const vals = isObject(sg.vals) ? sg.vals : {};
      const aanv = {};
      for (const [key, naam] of gekozen.naamVan) {
        const w = tekst(vals[key]).trim();
        if (w) aanv[naam] = w;
      }
      // een kleur die alleen op dit bordje bewaard is (niet onder 'onthouden voor deze maat') gaat bij de maat in het sjabloon
      const rand = gekozen.sjabloon.kleuren.rand;
      const kleur = hexVan(sg.kleur);
      if (rand && kleur && kleur !== ONBEKEND_GRIJS) {
        const sl = sleutel(vulTekst(t.ckey, vals, leesVelden(t.fields)));
        if (sl && !sl.includes('…') && !(sl in rand.waarden)) rand.waarden[sl] = kleur;
      }
      const titel = vulTekst(tekst(t.titel) || t.naam, vals, leesVelden(t.fields)).replace(/\s*\n\s*/g, ' ').trim();
      losseItems.push(losItem(id, titel || tekst(t.naam), gekozen.sjabloon.id, codesVan(sg.qr)));
      if (Object.keys(aanv).length) aanvullingen[id] = aanv;
      return;
    }
    // vrij bordje, of een bordje van een standaardsjabloon of een sjabloon dat er niet meer is
    const r = oplossen(sg, t);
    const richting = r.fmt === 'L' ? 'liggend' : 'staand';
    vrijGebruikt[richting] = true;
    const rand = hexVan(r.kleur);
    const randNaam = rand ? kleurNaam(rand) : '';
    if (randNaam.startsWith('#')) randWaarden.push(randNaam);
    const aanv = {};
    if (tekst(r.hero).trim()) aanv.Groot = tekst(r.hero).trim();
    const regels = regelsTekst(r);
    if (regels) aanv.Regels = regels;
    if (randNaam) aanv.Randkleur = randNaam;
    losseItems.push(losItem(id, r.titel.replace(/\s*\n\s*/g, ' ').trim() || 'Bordje', 'vrij-' + richting, codesVan(sg.qr)));
    if (Object.keys(aanv).length) aanvullingen[id] = aanv;
  });

  // productlabels uit de bibliotheek
  let labels = 0;
  for (const l of bron.labels) {
    const qr = tekst(l.qr).trim();
    labels++;
    losseItems.push(losItem(uniek('v25-lib-' + qr), tekst(l.t1).trim() || qr, 'qrlabel', { qr, locatie: tekst(l.t2).trim() }));
  }

  // locatielijst: 'code<TAB of ;>omschrijving<…>aantal' (het aantal is een printaantal en telt hier niet mee)
  let locaties = 0;
  for (const regel of bron.loc.split(/\r?\n/)) {
    if (!regel.trim()) continue;
    const scheiding = regel.includes('\t') ? '\t' : (regel.includes(';') ? ';' : null);
    const delen = scheiding ? regel.split(scheiding).map(x => x.trim()) : [regel.trim()];
    if (!delen[0]) continue;
    locaties++;
    losseItems.push(losItem(uniek('v25-loc-' + delen[0]), delen[1] || '', 'locatie', { locatie: delen[0] }));
  }

  const extraKleuren = [...new Set(randWaarden)];
  const sjablonen = [...eigen.values()].map(e => e.sjabloon);
  if (vrijGebruikt.staand) sjablonen.push(vrijSjabloon('vrij-staand', 'Vrij bordje staand', 'staand', 74, 105, extraKleuren));
  if (vrijGebruikt.liggend) sjablonen.push(vrijSjabloon('vrij-liggend', 'Vrij bordje liggend', 'liggend', 105, 74, extraKleuren));

  return {
    sjablonen,
    kleurenDsl,
    losseItems,
    aanvullingen,
    certIcoon: bron.icoon,
    telling: { sjablonen: eigen.size, bordjes, labels, locaties },
  };
}
