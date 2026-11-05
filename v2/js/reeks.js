// Reeks: een lijst codes (bijv. de magazijnindeling, geplakt uit Excel) in één keer als bordjes.
// Per regel: code, wat er ligt, en eventueel waar (tab of ; als scheiding). Kopregel 'Code' wordt overgeslagen.

/** Randkleur per zone (eerste letter van de code). Onbekende zone: automatisch (leeg). */
export const ZONEKLEUREN = {
  A: 'DSL blauw', // geluid
  B: 'Geel',      // licht
  C: 'Oranje',    // effecten
  D: 'Paars',     // backline
  E: 'Lichtblauw', // doeken
  F: 'Magenta',   // decor, schermen
  G: 'Rood',      // truss, rigging, podium
  H: 'Groen',     // kabels
  J: 'Blauw',     // microfoons
  K: 'Oranje',    // vloeistoffen (bij effecten)
  V: 'Wit',       // verkoop
  Z: 'Geen',      // tijdelijk: retour, reparatie, keuring
};

export function zoneKleur(code) {
  const zone = String(code ?? '').trim().charAt(0).toUpperCase();
  return ZONEKLEUREN[zone] || '';
}

/** @returns {{ code: string, wat: string, waar: string }[]} */
export function leesReeks(tekst) {
  const gezien = new Set();
  const uit = [];
  for (const regel of String(tekst ?? '').split(/\r?\n/)) {
    if (!regel.trim()) continue;
    const delen = (regel.includes('\t') ? regel.split('\t') : regel.split(';')).map(x => x.trim());
    const [code = '', wat = '', waar = ''] = delen;
    if (!code || /^code$/i.test(code) || gezien.has(code.toLowerCase())) continue;
    gezien.add(code.toLowerCase());
    uit.push({ code, wat, waar });
  }
  return uit;
}
