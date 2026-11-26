// Verschillen tussen de vorige en de nieuwe Rentman-export (Robin, 16 nov): nieuw, weg, en per artikel
// wat er veranderde (naam, locatie, QR, aantal, en per kist het gewicht en de inhoud). Nooit prijzen:
// die worden bij het inlezen al niet overgenomen.

const VELDEN = [['naam', 'Naam'], ['locatie', 'Locatie'], ['qr', 'QR-code'], ['aantal', 'Aantal']];
const tekst = (x) => String(x ?? '').trim();
const kg = (x) => (tekst(x) ? tekst(x) + ' kg' : '');

/**
 * @param {object[]} oud  artikelen van de vorige keer
 * @param {object[]} nieuw  zojuist ingelezen artikelen
 * @param {{ ontbrekend?: string[], eigenInhoud?: Set<string> }} opties  ontbrekend: velden die niet in de nieuwe export staan, worden
 *   niet vergeleken; eigenInhoud: codes van artikelen met een zelf aangepaste inhoud (wordt gemeld)
 */
export function verschillen(oud, nieuw, { ontbrekend = [], eigenInhoud = new Set() } = {}) {
  if (!oud?.length) return { nieuw: [], weg: [], gewijzigd: [], eerste: true };
  const oudPer = new Map(oud.map(a => [a.code, a]));
  const nieuwPer = new Map(nieuw.map(a => [a.code, a]));
  const velden = VELDEN.filter(([k]) => !ontbrekend.includes(k));
  // Kisten alleen vergelijken als de nieuwe export kistgegevens heeft (exemplarenexport).
  const metKisten = nieuw.some(a => a.kisten && Object.keys(a.kisten).length);
  const gewijzigd = [];
  for (const a of nieuw) {
    const o = oudPer.get(a.code);
    if (!o) continue;
    const wat = [];
    for (const [k, naam] of velden) if (tekst(o[k]) !== tekst(a[k])) wat.push({ veld: naam, van: tekst(o[k]), naar: tekst(a[k]) });
    if (metKisten && o.kisten && a.kisten) {
      for (const [qr, k] of Object.entries(a.kisten)) {
        const vk = o.kisten[qr];
        if (!vk) continue;
        if (tekst(vk.gewicht) !== tekst(k.gewicht)) wat.push({ veld: `Gewicht ${k.nr}`, van: kg(vk.gewicht), naar: kg(k.gewicht) });
        // Eigen (aangepaste) inhoud op het bordje: melden, want die volgt Rentman niet vanzelf (Robin, 26 nov).
        if (tekst(vk.inhoud) !== tekst(k.inhoud)) wat.push({ veld: `Inhoud ${k.nr}`, van: tekst(vk.inhoud), naar: tekst(k.inhoud), ...(eigenInhoud.has(a.code) ? { eigen: true } : {}) });
      }
    }
    if (wat.length) gewijzigd.push({ code: a.code, naam: a.naam, wat });
  }
  return {
    nieuw: nieuw.filter(a => !oudPer.has(a.code)).map(({ code, naam }) => ({ code, naam })),
    weg: oud.filter(a => !nieuwPer.has(a.code)).map(({ code, naam }) => ({ code, naam })),
    gewijzigd,
  };
}
