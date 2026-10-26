// Kleuren: namen, lichte tint voor het kleurvlak, leesbare inktkleur, sleutels.

export const KLEURNAMEN = {
  geel: '#ffff00', groen: '#00b050', blauw: '#0050ff', lichtblauw: '#00b0f0', rood: '#ff0000',
  paars: '#7030a0', wit: '#ffffff', oranje: '#ff8c00', magenta: '#c000c0', grijs: '#7f7f7f',
};
export const ONBEKEND = '#7f7f7f';

const rgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};

/** Lichte versie van een kleur (sterkte 0..1; 0,25 = kleurvlak huisstijl). */
export function tint(hex, sterkte = 0.25) {
  const c = rgb(hex);
  if (!c) return hex;
  return 'rgb(' + c.map(v => Math.round(255 - (255 - v) * sterkte)).join(',') + ')';
}

/** Zwarte of witte tekst, wat het best leest op deze achtergrond. */
export function inkt(hex) {
  const c = rgb(hex);
  if (!c) return '#000';
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 > 0.55 ? '#000' : '#fff';
}

/** Heel lichte kleur (wit, lichtgeel)? Dan krijgt de streep een omlijning. */
export function isLicht(hex) {
  const c = rgb(hex);
  return !!c && Math.min(...c) > 235;
}

/** Sleutel om waarden te vergelijken: '2.5' = '2,5', '6 x 3' = '6×3', '2,5 mm²' = '2,5mm²'. */
export function sleutel(tekst) {
  return String(tekst ?? '').toLowerCase().replace(/\s+/g, '').replace(/\./g, ',').replace(/x/g, '×');
}
