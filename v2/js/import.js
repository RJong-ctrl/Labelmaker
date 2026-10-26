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
  return { artikelen, ontbrekend };
}
