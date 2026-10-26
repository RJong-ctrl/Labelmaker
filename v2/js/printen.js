// Printvellen maken en printen: A4 met snijtekens, of één label per pagina
// voor de Citizen (twee halve labels op één label).

import { vul } from './sjablonen.js';
import { teken, pasAan } from './opmaak.js';
import { A4, a4Indeling, verdeel } from './indeling.js';

export const LABEL = { b: 76, h: 56 };
const SNIJ = 3, SNIJ_AFSTAND = 1;

export const PRINTERS = {
  label: { tekst: 'Kies printer: Citizen CL-E321', papier: `@page { size: ${LABEL.b}mm ${LABEL.h}mm; margin: 0; }` },
  a4: { tekst: 'Kies je A4-printer', papier: `@page { size: ${A4.b}mm ${A4.h}mm; margin: 0; }` },
};

/**
 * context = { artikelen: Map<code, Artikel>, sjablonen: Sjabloon[],
 *             aanvullingen: Record<code, Record<veld, string>>, huisstijl }
 */
function elementen(printer, items, context) {
  const uit = [];
  for (const item of items) {
    const sjabloon = context.sjablonen.find(s => s.id === item.sjabloon);
    const artikel = context.artikelen.get(item.artikel);
    if (!sjabloon || !artikel || sjabloon.printer !== printer) continue;
    const inhoud = vul(sjabloon, artikel, context.aanvullingen?.[item.artikel] || {}, item.qr);
    const sleutel = [item.sjabloon, item.artikel, item.qr].join('|');
    for (let n = 0; n < Math.max(0, item.aantal | 0); n++) {
      const el = teken(inhoud, context.huisstijl);
      el.dataset.sleutel = sleutel;
      uit.push({ el, formaat: inhoud.formaat });
    }
  }
  return uit;
}

function snijtekens(posities, b, h) {
  let d = '';
  for (const [x, y] of posities) {
    const x2 = x + b, y2 = y + h;
    for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x2, y, 1, -1], [x, y2, -1, 1], [x2, y2, 1, 1]]) {
      d += `M${(cx + sx * SNIJ_AFSTAND).toFixed(2)} ${cy.toFixed(2)}h${sx * SNIJ}M${cx.toFixed(2)} ${(cy + sy * SNIJ_AFSTAND).toFixed(2)}v${sy * SNIJ}`;
    }
  }
  return `<svg class="snijtekens" viewBox="0 0 ${A4.b} ${A4.h}" style="position:absolute;left:0;top:0;width:${A4.b}mm;height:${A4.h}mm;pointer-events:none"><path d="${d}" stroke="#000" stroke-width=".2" fill="none"/></svg>`;
}

function a4Vellen(lijst) {
  const groepen = new Map();
  for (const x of lijst) {
    const k = x.formaat.b + 'x' + x.formaat.h;
    if (!groepen.has(k)) groepen.set(k, { formaat: x.formaat, els: [] });
    groepen.get(k).els.push(x.el);
  }
  const vellen = [];
  for (const { formaat, els } of groepen.values()) {
    const ind = a4Indeling(formaat.b, formaat.h);
    if (!ind.posities.length) continue;
    for (const groep of verdeel(els, ind.posities.length)) {
      const vel = document.createElement('div');
      vel.className = 'a4';
      groep.forEach((el, j) => {
        const [x, y] = ind.posities[j];
        const plek = document.createElement('div');
        plek.className = 'plek';
        plek.style.cssText = `left:${x.toFixed(2)}mm;top:${y.toFixed(2)}mm;width:${ind.b}mm;height:${ind.h}mm`;
        if (ind.gedraaid) el.style.transform = `translateY(${ind.h}mm) rotate(-90deg)`;
        plek.appendChild(el);
        vel.appendChild(plek);
      });
      vel.insertAdjacentHTML('beforeend', snijtekens(ind.posities.slice(0, groep.length), ind.b, ind.h));
      vellen.push(vel);
    }
  }
  return vellen;
}

function labelVellen(lijst) {
  const vellen = [];
  let half = null;
  for (const { el, formaat } of lijst) {
    if (formaat.h * 2 <= LABEL.h) {
      if (half) { half.appendChild(el); half = null; continue; }
      half = document.createElement('div');
      half.className = 'pagina tweeling';
      half.appendChild(el);
      vellen.push(half);
      continue;
    }
    const p = document.createElement('div');
    p.className = 'pagina';
    p.appendChild(el);
    vellen.push(p);
  }
  return vellen;
}

/** Pagina's (A4-vellen of Citizen-labels) voor deze printopdracht; nog niet passend gemaakt. */
export function tekenVellen(printer, items, context) {
  const lijst = elementen(printer, items, context);
  return printer === 'label' ? labelVellen(lijst) : a4Vellen(lijst);
}

/** Tekst in alle vellen passend maken. Gelijke items worden één keer gemeten. */
export async function pasVellenAan(vellen) {
  const klaar = new Map();
  for (const vel of vellen) {
    for (const el of vel.querySelectorAll('.signb,.lbl')) {
      const k = el.dataset.sleutel;
      if (k && klaar.has(k)) { el.innerHTML = klaar.get(k); continue; }
      await pasAan(el);
      if (k) klaar.set(k, el.innerHTML);
    }
  }
}

function vraag(tekst) {
  const balk = document.getElementById('printbalk');
  balk.innerHTML = `<span>${tekst}</span><span class="pijl" aria-hidden="true">→</span>` +
    '<button type="button" class="primary" data-k="ja">Printen</button><button type="button" data-k="nee">Annuleren</button>';
  balk.hidden = false;
  balk.querySelector('[data-k="ja"]').focus();
  return new Promise(ok => {
    balk.onclick = (e) => {
      const k = e.target.closest('button')?.dataset.k;
      if (!k) return;
      balk.hidden = true;
      balk.onclick = null;
      ok(k === 'ja');
    };
  });
}

/** Zet het drukwerk klaar, vraagt de juiste printer te kiezen en opent het printvenster. */
export async function print(printer, items, context, { alleenEerste = false } = {}) {
  const doel = document.getElementById('drukwerk');
  let vellen = tekenVellen(printer, items, context);
  if (alleenEerste) vellen = vellen.slice(0, 1);
  if (!vellen.length) return false;
  doel.replaceChildren(...vellen);
  doel.dataset.printer = printer;
  await pasVellenAan(vellen);
  if (!(await vraag(PRINTERS[printer].tekst))) return false;
  document.getElementById('papier').textContent = PRINTERS[printer].papier;
  window.print();
  return true;
}
