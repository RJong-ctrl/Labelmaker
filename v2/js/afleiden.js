// Waarden afleiden uit de artikelnaam: lengte, maat, polen, kwaliteit en de
// kale naam. Getallen komen terug in Nederlandse notatie ('2,5', '3 × 1,2').

const G = '\\d+(?:[.,]\\d+)?';
// Tweede getal: gevolgd door 'm' (geen letter erna) of door iets anders dan letter/cijfer/komma.
const MAAT = new RegExp(`(?<![\\d.,])(${G})\\s*[x×]\\s*(${G})(?:\\s*m(?![a-z²\\d])|(?![a-z\\d.,²]))`, 'i');
// Optioneel een bereik ervoor: '0,9-1,2m'.
const LENGTE = new RegExp(`(?<![\\d.,])(?:(${G})\\s*-\\s*)?(${G})\\s*(?:meter|mtr|m)(?![a-z²\\d])`, 'i');
const KWALITEIT = /(?:^|[\s(])([AB])\s*-?\s*kwaliteit\b/i;
const KWALITEIT_WEG = /\(?\s*\b[AB]\s*-?\s*kwaliteit\b\s*\)?/i;

const nl = (getal) => String(Number(getal.replace(',', '.'))).replace('.', ',');

export function maat(naam) {
  const m = MAAT.exec(naam || '');
  return m ? `${nl(m[1])} × ${nl(m[2])}` : '';
}

export function lengte(naam) {
  if (maat(naam)) return '';
  const m = LENGTE.exec(naam || '');
  if (!m) return '';
  return m[1] ? `${nl(m[1])}-${nl(m[2])}` : nl(m[2]);
}

export function polen(naam) {
  const s = naam || '';
  if (!/speakon|\bnl[248]\b/i.test(s)) return '';
  const m = /\b([248])p\b|\bnl([248])\b/i.exec(s);
  return m ? 'NL' + (m[1] || m[2]) : '';
}

export function kwaliteit(naam) {
  const m = KWALITEIT.exec(naam || '');
  return m ? m[1].toUpperCase() : '';
}

export function kaal(naam) {
  let s = naam || '';
  if (MAAT.test(s)) s = s.replace(MAAT, ' ');
  else s = s.replace(LENGTE, ' ');
  s = s.replace(KWALITEIT_WEG, ' ').replace(/\(\s*\)/g, ' ');
  return s.replace(/\s+/g, ' ').replace(/\s*[-|]\s*$/, '').trim();
}

/** 'ja' als het een kabel is: een lengte in de naam, of 'kabel'/'snake' erin. */
export function kabel(naam) {
  return lengte(naam) || /kabel|snake/i.test(naam || '') ? 'ja' : '';
}

export const PATRONEN = { lengte, maat, polen, kwaliteit, kaal, kabel };
