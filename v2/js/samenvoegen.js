// Lagen samenvoegen: profielstandaard → gepubliceerde basis → lokale wijzigingen.
// Puur rekenwerk, zonder opslag of DOM.

export const INSTELLINGEN = ['regels', 'huisstijl', 'printers', 'kolommen'];
const NAMEN = { regels: 'Categorie → sjabloon', huisstijl: 'Huisstijl', printers: 'Printers', kolommen: 'Kolommen bij inlezen' };

const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function perId(...lagen) {
  const uit = new Map();
  for (const laag of lagen) {
    for (const x of laag || []) {
      if (!x || !x.id) continue;
      if (x.verwijderd) uit.delete(x.id);
      else uit.set(x.id, x);
    }
  }
  return [...uit.values()];
}

/**
 * lokaal = { sjablonen, instellingen: {regels?, huisstijl?, printers?, kolommen?, artikelenDatum?},
 *            artikelen, losse, aanvullingen }
 */
export function samen(standaard, basis, lokaal) {
  const e = { basisDatum: basis?.datum || null };
  e.sjablonen = perId(standaard.sjablonen, basis?.sjablonen, lokaal.sjablonen);
  for (const k of INSTELLINGEN) e[k] = lokaal.instellingen[k] ?? basis?.[k] ?? standaard[k];
  const lokaleDatum = lokaal.instellingen.artikelenDatum || '';
  const basisWint = basis && basis.artikelen?.length && (!lokaleDatum || basis.datum > lokaleDatum);
  e.artikelen = basisWint ? basis.artikelen : lokaal.artikelen;
  e.losseItems = perId(basis?.losseItems, lokaal.losse);
  e.aanvullingen = {};
  for (const [id, w] of Object.entries(basis?.aanvullingen || {})) e.aanvullingen[id] = { ...w };
  for (const [id, w] of Object.entries(lokaal.aanvullingen || {})) e.aanvullingen[id] = { ...(e.aanvullingen[id] || {}), ...w };
  return e;
}

/** Wat op deze pc afwijkt van de basis (zonder basis: alles wat lokaal is). */
export function wijzigingen(basis, lokaal) {
  const uit = [];
  const basisSj = new Map((basis?.sjablonen || []).map(s => [s.id, s]));
  for (const s of lokaal.sjablonen || []) {
    if (gelijk(s, basisSj.get(s.id))) continue;
    const naam = s.naam || basisSj.get(s.id)?.naam || s.id;
    uit.push({ soort: 'sjabloon', id: s.id, omschrijving: s.verwijderd ? `Sjabloon "${naam}" verwijderd` : `Sjabloon "${naam}" gewijzigd` });
  }
  for (const k of INSTELLINGEN) {
    const v = lokaal.instellingen[k];
    if (v !== undefined && !gelijk(v, basis?.[k])) uit.push({ soort: 'instelling', id: k, omschrijving: `${NAMEN[k]} gewijzigd` });
  }
  for (const [id, velden] of Object.entries(lokaal.aanvullingen || {})) {
    for (const [veld, waarde] of Object.entries(velden || {})) {
      if (basis?.aanvullingen?.[id]?.[veld] === waarde) continue;
      uit.push({ soort: 'aanvulling', id, veld, omschrijving: `${veld}: ${waarde}` });
    }
  }
  const d = lokaal.instellingen.artikelenDatum;
  if (d && (!basis || !basis.datum || d > basis.datum)) {
    uit.push({ soort: 'artikelen', id: 'artikelen', omschrijving: `Artikellijst op deze pc ingelezen (${(lokaal.artikelen || []).length} artikelen)` });
  }
  const basisLos = new Map((basis?.losseItems || []).map(x => [x.id, x]));
  for (const x of lokaal.losse || []) {
    if (gelijk(x, basisLos.get(x.id))) continue;
    uit.push({ soort: 'los', id: x.id, omschrijving: x.verwijderd ? `Los item verwijderd` : `Los item "${x.naam}"` });
  }
  return uit;
}
