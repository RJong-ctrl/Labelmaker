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
