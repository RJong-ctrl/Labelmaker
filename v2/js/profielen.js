// Profielen: elk profiel is een eigen werkruimte met een eigen IndexedDB-database.
// De lijst en het gekozen profiel staan in localStorage (valt terug op geheugen).

import { SOORTEN } from './opslag.js';

const LIJST = 'labelmaker-profielen';
const HUIDIG = 'labelmaker-profiel';
const DSL = { id: 'dsl', naam: 'DSL', standaard: 'dsl' };

const geheugen = new Map();
const ls = {
  get(k) { try { return globalThis.localStorage ? globalThis.localStorage.getItem(k) : (geheugen.get(k) ?? null); } catch { return geheugen.get(k) ?? null; } },
  set(k, v) { try { if (globalThis.localStorage) globalThis.localStorage.setItem(k, v); else geheugen.set(k, v); } catch { geheugen.set(k, v); } },
  del(k) { try { if (globalThis.localStorage) globalThis.localStorage.removeItem(k); else geheugen.delete(k); } catch { geheugen.delete(k); } },
};

/** Alleen voor tests: alles vergeten. */
export function _wisVoorTest() { ls.del(LIJST); ls.del(HUIDIG); geheugen.clear(); }

function eigen() {
  try { const l = JSON.parse(ls.get(LIJST) || '[]'); return Array.isArray(l) ? l.filter(p => p && p.id && p.id !== 'dsl') : []; } catch { return []; }
}
const bewaar = (lijst) => ls.set(LIJST, JSON.stringify(lijst));

export function profielen() { return [DSL, ...eigen()]; }

export function huidigProfiel() {
  const id = ls.get(HUIDIG);
  return profielen().some(p => p.id === id) ? id : 'dsl';
}

export function kiesProfiel(id) { ls.set(HUIDIG, id); }

function slug(naam) {
  const basis = String(naam || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profiel';
  const bezet = new Set(profielen().map(p => p.id));
  if (!bezet.has(basis)) return basis;
  let n = 2;
  while (bezet.has(`${basis}-${n}`)) n++;
  return `${basis}-${n}`;
}

/** Nieuw profiel; vanuit 'basis' (neutrale sjablonen) of 'dsl' (kopie van de DSL-standaard). */
export async function maakProfiel(naam, vanuit = 'basis') {
  const id = slug(naam);
  bewaar([...eigen(), { id, naam: String(naam).trim() || id, standaard: vanuit === 'dsl' ? 'dsl' : 'basis' }]);
  return id;
}

export function hernoemProfiel(id, naam) {
  if (id === 'dsl') throw new Error('Het DSL-profiel kan niet worden hernoemd.');
  bewaar(eigen().map(p => (p.id === id ? { ...p, naam: String(naam).trim() || p.naam } : p)));
}

export async function verwijderProfiel(id) {
  if (id === 'dsl') throw new Error('Het DSL-profiel kan niet worden verwijderd.');
  bewaar(eigen().filter(p => p.id !== id));
  if (ls.get(HUIDIG) === id) ls.del(HUIDIG);
  try { globalThis.indexedDB?.deleteDatabase('labelmaker-' + id); } catch { /* niet erg */ }
}

/** Heel profiel als één bestand; pc-instellingen (pincode, eigen lettertype) gaan niet mee. */
export async function exporteerProfiel(opslag, id) {
  const profiel = profielen().find(p => p.id === id) || { id, naam: id, standaard: 'basis' };
  const gegevens = {};
  for (const soort of SOORTEN) {
    let rijen = await opslag.alle(soort);
    if (soort === 'instellingen') rijen = rijen.filter(r => !String(r.id).startsWith('pc:'));
    gegevens[soort] = rijen;
  }
  return { type: 'labelmaker-profiel', versie: 1, datum: new Date().toISOString(), profiel, gegevens };
}

/** Profielbestand inlezen als nieuw profiel; openOpslag(id) geeft de opslag van dat profiel. */
export async function importeerProfiel(json, openOpslag) {
  if (!json || json.type !== 'labelmaker-profiel' || json.versie !== 1 || !json.gegevens || typeof json.gegevens !== 'object') {
    throw new Error('Dit is geen profielbestand van de Labelmaker.');
  }
  const naam = String(json.profiel?.naam || 'Profiel');
  const bezet = new Set(profielen().map(p => p.naam));
  let nieuweNaam = naam, n = 2;
  while (bezet.has(nieuweNaam)) nieuweNaam = `${naam} (${n++})`;
  const id = slug(json.profiel?.id || naam);
  bewaar([...eigen(), { id, naam: nieuweNaam, standaard: json.profiel?.standaard === 'dsl' ? 'dsl' : 'basis' }]);
  const opslag = await openOpslag(id);
  for (const soort of SOORTEN) {
    const rijen = Array.isArray(json.gegevens[soort]) ? json.gegevens[soort].filter(r => r && r.id !== undefined && !String(r.id).startsWith('pc:')) : [];
    await opslag.vervangAlle(soort, rijen);
  }
  return id;
}
