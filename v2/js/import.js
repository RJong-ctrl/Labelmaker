// Artikelen uit een ingelezen tabel halen. Alleen de toegestane velden worden
// overgenomen: prijzen, interne opmerkingen en alle andere kolommen vallen weg.

export const RENTMAN = {
  naam: 'Naam (in database)',
  code: 'Code',
  qr: 'QR-codes / RFID',
  exemplaren: 'QR-codes / RFID exemplaren',
  pad: 'Pad',
  map: 'Map (Map)',
  locatie: 'Locatie in magazijn per voorraadlocatie [Standaard voorraadlocatie]',
  soort: 'Methode voorraadberekening',
  type: 'Type materiaal',
  aantal: 'Huidig aantal',
};

export const TOEGESTANE_VELDEN = ['naam', 'code', 'qr', 'exemplaren', 'pad', 'map', 'locatie', 'soort', 'type', 'aantal'];

const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const lijst = (s) => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean);

/**
 * @param {string[][]} rijen  eerste rij = kolomnamen
 * @param {Record<string,string>} kolommen  veld → kolomnaam
 * @returns {{ artikelen: object[], ontbrekend: string[] }}
 */
export function importeer(rijen, kolommen = RENTMAN) {
  const kop = (rijen[0] || []).map(norm);
  const index = {};
  const ontbrekend = [];
  for (const veld of TOEGESTANE_VELDEN) {
    const i = kolommen[veld] ? kop.indexOf(norm(kolommen[veld])) : -1;
    if (i < 0) ontbrekend.push(veld);
    else index[veld] = i;
  }
  if (index.naam === undefined || index.code === undefined) return { artikelen: [], ontbrekend };

  const waarde = (rij, veld) => (index[veld] === undefined ? '' : String(rij[index[veld]] ?? '').trim());
  const gezien = new Set();
  const artikelen = [];
  for (const rij of rijen.slice(1)) {
    const code = waarde(rij, 'code');
    if (!code || gezien.has(code)) continue;
    gezien.add(code);
    const type = waarde(rij, 'type');
    const aantal = Number(waarde(rij, 'aantal').replace(',', '.'));
    artikelen.push({
      id: code,
      naam: waarde(rij, 'naam').replace(/\s+/g, ' '),
      code,
      qr: lijst(waarde(rij, 'qr'))[0] || '',
      exemplaren: lijst(waarde(rij, 'exemplaren')),
      pad: waarde(rij, 'pad'),
      map: waarde(rij, 'map'),
      locatie: waarde(rij, 'locatie'),
      soort: /serial/i.test(waarde(rij, 'soort')) ? 'serie' : 'bulk',
      type,
      combinatie: /combinatie/i.test(type),
      aantal: Number.isFinite(aantal) ? aantal : 0,
    });
  }
  const kisten = kistenUit(rijen, index);
  for (const a of artikelen) if (kisten.has(a.code)) a.kisten = kisten.get(a.code);
  return { artikelen, ontbrekend };
}

// Exemplaren-export van Rentman: per exemplaar staat in welke kist (combinatie-exemplaar) het zit.
// Daarmee is per kist de inhoud te tellen, en het gewicht van de kist zelf. Alleen namen, aantallen
// en gewicht: prijzen en waarden worden nooit gelezen.
export const EXEMPLAAR = {
  nr: 'Weergavenaam (Exemplaar)',
  qr: 'QR-codes / RFID (Exemplaar)',
  gewicht: 'Huidig totale gewicht (Exemplaar)',
  in: 'Actuele inhoud van (Exemplaar)',
  status: 'Status (Exemplaar)',
  materiaal: 'Materiaal (Exemplaar, Materiaal)',
};
const COMBINATIE_STATUS = /^(compleet|incompleet|extra)$/i;
const naamSleutel = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const gewichtNl = (s) => { const n = Number(String(s ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? String(n).replace('.', ',') : ''; };

/** Map code → { exemplaar-QR: { nr, inhoud, gewicht } }; leeg als het geen exemplaren-export is. */
function kistenUit(rijen, index) {
  const kop = (rijen[0] || []).map(norm);
  const k = Object.fromEntries(Object.entries(EXEMPLAAR).map(([veld, naam]) => [veld, kop.indexOf(norm(naam))]));
  const uit = new Map();
  if (k.nr < 0 || k.in < 0 || k.qr < 0) return uit;
  const cel = (rij, i) => (i < 0 ? '' : String(rij[i] ?? '').trim());
  const naamVan = (rij) => cel(rij, k.materiaal) || cel(rij, index.naam ?? -1);
  // inhoud per kist: kistsleutel → Map(onderdeel → aantal), in volgorde van de export
  const inhoud = new Map();
  for (const rij of rijen.slice(1)) {
    const ouder = naamSleutel(cel(rij, k.in));
    if (!ouder) continue;
    if (!inhoud.has(ouder)) inhoud.set(ouder, new Map());
    const naam = naamVan(rij).replace(/\s+/g, ' ');
    const tel = inhoud.get(ouder);
    tel.set(naam, (tel.get(naam) || 0) + 1);
  }
  for (const rij of rijen.slice(1)) {
    const nr = cel(rij, k.nr), qr = cel(rij, k.qr), code = cel(rij, index.code ?? -1);
    if (!nr || !qr || !code) continue;
    const tel = inhoud.get(naamSleutel(`${naamVan(rij)} (${nr})`));
    if (!tel && !COMBINATIE_STATUS.test(cel(rij, k.status))) continue;
    if (!uit.has(code)) uit.set(code, {});
    uit.get(code)[qr] = {
      nr,
      inhoud: tel ? [...tel].map(([naam, n]) => `${n} ${naam}`).join('\n') : '',
      gewicht: gewichtNl(cel(rij, k.gewicht)),
    };
  }
  return uit;
}
