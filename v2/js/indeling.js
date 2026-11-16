// Indeling van bordjes op A4 (puur rekenwerk, in mm).
// Marge 8 en tussenruimte 8 zoals versie 25 (ruimte voor snijtekens), verdeeld
// over het vel; een kwartslag gedraaid als er dan meer op een vel passen.

export const A4 = { b: 210, h: 297 };
export const MARGE = 8;
export const TUSSEN = 8;

function rooster(b, h) {
  const kol = Math.max(0, Math.floor((A4.b - 2 * MARGE + TUSSEN) / (b + TUSSEN)));
  const rij = Math.max(0, Math.floor((A4.h - 2 * MARGE + TUSSEN) / (h + TUSSEN)));
  const posities = [];
  for (let r = 0; r < rij; r++) {
    for (let k = 0; k < kol; k++) {
      const x = kol > 1 ? MARGE + k * (A4.b - 2 * MARGE - b) / (kol - 1) : (A4.b - b) / 2;
      const y = rij > 1 ? MARGE + r * (A4.h - 2 * MARGE - h) / (rij - 1) : (A4.h - h) / 2;
      posities.push([x, y]);
    }
  }
  return { b, h, posities };
}

/** Plaatsen op een A4; b/h zijn de maten op het vel (na eventueel draaien). */
export function a4Indeling(b, h) {
  const recht = rooster(b, h), gedraaid = rooster(h, b);
  return gedraaid.posities.length > recht.posities.length ? { ...gedraaid, gedraaid: true } : { ...recht, gedraaid: false };
}

/** Lijst opdelen in vellen van perVel stuks. */
export function verdeel(items, perVel) {
  const uit = [];
  for (let i = 0; i < items.length; i += perVel) uit.push(items.slice(i, i + perVel));
  return uit;
}

/**
 * Verschillende formaten samen op A4 (Robin, 16 nov). Eén formaat: het vertrouwde rooster, verdeeld over het vel.
 * Gemengd: in rijen (planken) van boven naar beneden, grootste eerst; elk formaat in de stand die a4Indeling ook
 * kiest, en in een gat van een bestaande rij mag een bordje ook gedraaid. Tussenruimte overal TUSSEN (snijtekens).
 * @param {{ b: number, h: number }[]} maten
 * @returns {{ i: number, x: number, y: number, b: number, h: number, gedraaid: boolean }[][]}  vellen; b/h op het vel
 */
export function pakA4(maten) {
  const W = A4.b - 2 * MARGE, H = A4.h - 2 * MARGE;
  const soorten = new Set(maten.map(m => m.b + 'x' + m.h));
  if (soorten.size <= 1) {
    if (!maten.length) return [];
    const ind = a4Indeling(maten[0].b, maten[0].h);
    if (!ind.posities.length) return [];
    return verdeel(maten.map((_, i) => i), ind.posities.length)
      .map(groep => groep.map((i, j) => ({ i, x: ind.posities[j][0], y: ind.posities[j][1], b: ind.b, h: ind.h, gedraaid: ind.gedraaid })));
  }
  const standen = (m) => [[m.b, m.h, false], [m.h, m.b, true]].filter(([b, h]) => b <= W && h <= H);
  const lijst = maten.map((m, i) => {
    const s = standen(m);
    if (!s.length) return null;
    const ind = a4Indeling(m.b, m.h);
    const voorkeur = s.find(x => x[2] === ind.gedraaid) || s[0];
    return { i, s, voorkeur };
  }).filter(Boolean)
    .sort((a, c) => c.voorkeur[1] - a.voorkeur[1] || c.voorkeur[0] - a.voorkeur[0] || a.i - c.i);

  const vellen = [];   // { planken: [{ y, h, x }], vrij, plekken: [] }
  for (const it of lijst) {
    // 1. in een bestaande rij, waar het minst ruimte verloren gaat
    let beste = null;
    for (const vel of vellen) for (const plank of vel.planken) for (const [b, h, gedraaid] of it.s) {
      if (h > plank.h || plank.x + b > W) continue;
      const verlies = plank.h - h;
      if (!beste || verlies < beste.verlies) beste = { vel, plank, b, h, gedraaid, verlies };
    }
    if (!beste) {
      // 2. een nieuwe rij onder op een vel, anders 3. een nieuw vel
      const [b, h, gedraaid] = it.voorkeur;
      let vel = vellen.find(v => v.vrij + h <= H);
      if (!vel) { vel = { planken: [], vrij: 0, plekken: [] }; vellen.push(vel); }
      const plank = { y: vel.vrij, h, x: 0 };
      vel.planken.push(plank);
      vel.vrij += h + TUSSEN;
      beste = { vel, plank, b, h, gedraaid };
    }
    const { vel, plank, b, h, gedraaid } = beste;
    vel.plekken.push({ i: it.i, x: MARGE + plank.x, y: MARGE + plank.y, b, h, gedraaid });
    plank.x += b + TUSSEN;
  }
  return vellen.map(v => v.plekken);
}
