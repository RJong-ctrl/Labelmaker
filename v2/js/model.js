// Model: de effectieve gegevens van één profiel en de enige weg naar de opslag
// voor werkscherm en beheer. Lokale wijzigingen gaan vóór de gepubliceerde basis.

import { PROFIEL_STANDAARD } from './standaard.js';
import { samen, wijzigingen as bepaalWijzigingen, INSTELLINGEN } from './samenvoegen.js';

const PC = ['werkscherm', 'pincode', 'eigenLettertype'];

export async function laadModel(opslag, profielId, standaardSoort) {
  const standaard = PROFIEL_STANDAARD[standaardSoort || (profielId === 'dsl' ? 'dsl' : 'basis')] || PROFIEL_STANDAARD.basis;
  const lijst = async (soort) => (await opslag.alle(soort)).map(x => x.waarde);
  const lokaal = {
    sjablonen: await lijst('sjablonen'),
    instellingen: {},
    artikelen: await lijst('artikelen'),
    losse: await lijst('losse'),
    aanvullingen: Object.fromEntries((await opslag.alle('aanvullingen')).map(x => [x.id, x.waarde])),
  };
  for (const k of [...INSTELLINGEN, 'artikelenDatum']) {
    const v = await opslag.lees('instellingen', k);
    if (v !== undefined) lokaal.instellingen[k] = v;
  }
  let basis = (await opslag.lees('basis', 'basis')) || null;
  let cache = null;
  const effectief = () => (cache ||= samen(standaard, basis, lokaal));
  const vernieuw = () => { cache = null; };
  const vervang = (lijst, item) => { const i = lijst.findIndex(x => x.id === item.id); if (i >= 0) lijst[i] = item; else lijst.push(item); };

  return {
    profielId,
    opslag,
    standaard,
    effectief,
    basis: () => basis,
    wijzigingen: () => bepaalWijzigingen(basis, lokaal),

    async zetSjabloon(s) { await opslag.schrijf('sjablonen', s.id, s); vervang(lokaal.sjablonen, s); vernieuw(); },
    async verwijderSjabloon(id) { const s = { id, verwijderd: true }; await opslag.schrijf('sjablonen', id, s); vervang(lokaal.sjablonen, s); vernieuw(); },
    async zetInstelling(sleutel, waarde) {
      if (!INSTELLINGEN.includes(sleutel)) throw new Error('Onbekende instelling: ' + sleutel);
      await opslag.schrijf('instellingen', sleutel, waarde); lokaal.instellingen[sleutel] = waarde; vernieuw();
    },
    async zetAanvulling(id, waarden) {
      const nieuw = { ...(lokaal.aanvullingen[id] || {}), ...waarden };
      await opslag.schrijf('aanvullingen', id, nieuw); lokaal.aanvullingen[id] = nieuw; vernieuw();
    },
    /** Aanvullingen van één artikel in zijn geheel vervangen (velden weglaten = terug naar export/naam). */
    async vervangAanvulling(id, waarden) {
      if (Object.keys(waarden).length) { await opslag.schrijf('aanvullingen', id, waarden); lokaal.aanvullingen[id] = { ...waarden }; }
      else { await opslag.wis('aanvullingen', id); delete lokaal.aanvullingen[id]; }
      vernieuw();
    },
    async zetArtikelen(artikelen) {
      const datum = new Date().toISOString();
      await opslag.vervangAlle('artikelen', artikelen.map(a => ({ id: a.code, waarde: a })));
      await opslag.schrijf('instellingen', 'artikelenDatum', datum);
      lokaal.artikelen = artikelen; lokaal.instellingen.artikelenDatum = datum; vernieuw();
    },
    async zetLosItem(item) { await opslag.schrijf('losse', item.id, item); vervang(lokaal.losse, item); vernieuw(); },
    /** Los item weg, met zijn aanvullingen; alleen een 'verwijderd'-markering als de basis het item heeft. */
    async verwijderLosItem(id) {
      if ((basis?.losseItems || []).some(x => x.id === id)) { const x = { id, verwijderd: true }; await opslag.schrijf('losse', id, x); vervang(lokaal.losse, x); }
      else { await opslag.wis('losse', id); lokaal.losse = lokaal.losse.filter(x => x.id !== id); }
      await opslag.wis('aanvullingen', id); delete lokaal.aanvullingen[id];
      vernieuw();
    },

    /** Bewaart de basis als die nieuwer is dan wat deze pc heeft. */
    async laadBasis(json) {
      if (!json?.datum || (basis?.datum && json.datum <= basis.datum)) return false;
      await opslag.schrijf('basis', 'basis', json); basis = json; vernieuw();
      return true;
    },

    async gooiWeg(w) {
      if (w.soort === 'sjabloon') { await opslag.wis('sjablonen', w.id); lokaal.sjablonen = lokaal.sjablonen.filter(s => s.id !== w.id); }
      else if (w.soort === 'instelling') { await opslag.wis('instellingen', w.id); delete lokaal.instellingen[w.id]; }
      else if (w.soort === 'aanvulling') {
        const rest = { ...(lokaal.aanvullingen[w.id] || {}) };
        delete rest[w.veld];
        if (Object.keys(rest).length) { await opslag.schrijf('aanvullingen', w.id, rest); lokaal.aanvullingen[w.id] = rest; }
        else { await opslag.wis('aanvullingen', w.id); delete lokaal.aanvullingen[w.id]; }
      } else if (w.soort === 'artikelen') {
        await opslag.wis('artikelen'); await opslag.wis('instellingen', 'artikelenDatum');
        lokaal.artikelen = []; delete lokaal.instellingen.artikelenDatum;
      } else if (w.soort === 'los') {
        await opslag.wis('losse', w.id); lokaal.losse = lokaal.losse.filter(x => x.id !== w.id);
        if (String(w.id).startsWith('los-')) { await opslag.wis('aanvullingen', w.id); delete lokaal.aanvullingen[w.id]; }
      }
      vernieuw();
    },

    // pc-gebonden instellingen: nooit in een publicatie
    async pcInstelling(sleutel) { if (!PC.includes(sleutel)) throw new Error('Onbekende pc-instelling: ' + sleutel); return opslag.lees('instellingen', 'pc:' + sleutel); },
    async zetPcInstelling(sleutel, waarde) {
      if (!PC.includes(sleutel)) throw new Error('Onbekende pc-instelling: ' + sleutel);
      if (waarde === undefined || waarde === null || waarde === '') return opslag.wis('instellingen', 'pc:' + sleutel);
      return opslag.schrijf('instellingen', 'pc:' + sleutel, waarde);
    },

    // printvel en printlog
    async printvel(printer) { return (await opslag.lees('printvel', printer)) || []; },
    async zetPrintvel(printer, items) { return opslag.schrijf('printvel', printer, items); },
    async logPrints(regels) {
      const stempel = new Date().toISOString();
      await opslag.schrijfVeel('printlog', regels.map((r, i) => ({ id: `${stempel}#${String(i).padStart(4, '0')}`, waarde: r })));
    },
    /** Regels vanaf tijdstip grens; oudere worden opgeruimd. */
    async printlog(grens) {
      const uit = [];
      for (const { id, waarde } of await opslag.alle('printlog')) {
        if ((waarde?.tijd || 0) < grens) await opslag.wis('printlog', id).catch(() => {});
        else uit.push(waarde);
      }
      return uit;
    },
  };
}
