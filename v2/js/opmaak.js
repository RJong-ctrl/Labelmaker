// Inhoud tekenen als bordje, strook of label (huisstijl uit versie 25).
// teken() bouwt het element in mm; pasAan() maakt de tekst passend zodra het
// element in de pagina staat.

import { qrSvg } from './qr.js';
import { tint, inkt, isLicht } from './kleuren.js';

export const HUISSTIJL_DSL = {
  logo: new URL('../assets/dsl-logo.svg', import.meta.url).href,
  voet: [
    'DSL Geluids- & Lichtverhuur, De Fok 23, 1742 PC Schagen',
    'Tel. 0224-218130 | info@dslverhuur.nl | www.dslverhuur.nl',
  ],
  lettertype: 'DSL Futura',
  labelLettertype: 'DSL Label',
};

const STREEP = 1;       // mm, volle kleur aan de binnenkant van het kleurvlak
const TINT = 0.25;      // kleurvlak
const GAT = 8;          // mm, gatmarkering
const PT = 2.835;       // pt per mm
const DPM = 203 / 25.4; // Citizen: punten per mm

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mm = (n) => n.toFixed(2) + 'mm';

function qrOfMelding(tekst, maat, klasse = 'qq') {
  const stijl = `width:${mm(maat)};height:${mm(maat)}`;
  if (!tekst) return `<div class="${klasse} geen-qr" style="${stijl}">Geen QR-code</div>`;
  try { return `<div class="${klasse}" style="${stijl}">${qrSvg(tekst).svg}</div>`; }
  catch { return `<div class="${klasse} geen-qr" style="${stijl}">QR-inhoud te lang</div>`; }
}

/** Passend vak: tekst krijgt de grootste letter tussen min en max (pt). */
const vak = (klasse, max, html, stijl = '', min = 3, regels = 0) =>
  `<div class="fb ${klasse}" data-max="${max.toFixed(1)}" data-min="${min}"${regels ? ` data-regels="${regels}"` : ''} style="${stijl}"><span>${html}</span></div>`;

// ---------- bordjes en stroken ----------

function bordje(i, hs) {
  const W = i.formaat.b, H = i.formaat.h;
  const staand = i.opmaak === 'staand', strook = i.opmaak === 'strook';
  const f = staand ? Math.min(W / 73, H / 105) : Math.min(W / 85, H / 48);
  const bw = staand ? W * 0.19 : Math.min(W * 0.15, H * 0.3);
  const gap = staand ? 4 * f : 3.5 * f, pad = staand ? 4 * f : 3 * f;
  const titel = esc(i.titel), groot = esc(i.groot);
  const rijen = i.eigenschappen.map(([k, v]) => [k, v]);
  if (!strook && i.onder) rijen.push(['', i.onder]);
  const tabel = rijen.length
    ? '<div class="tg">' + rijen.map((r, n) => (n ? '<div class="sep"></div>' : '') + `<div class="tk">${esc(r[0])}</div><div class="tv">${esc(r[1])}</div>`).join('') + '</div>'
    : '';
  const kleurLabel = i.label ? i.label.kleur : '#7f7f7f';
  const cert = i.cert ? `<div class="cert" style="font-size:${(5.5 * f).toFixed(1)}pt"><span>${esc(i.cert)}</span></div>` : '';
  const voet = i.voet
    ? `<div class="ft" style="font-size:${(5 * f).toFixed(1)}pt;margin-top:${mm(2.6 * f)};padding-top:${mm(1.6 * f)}">` +
      hs.voet.map(l => '<div>' + l.split('|').map(x => esc(x.trim())).join('<span class="fsep" aria-hidden="true"></span>') + '</div>').join('') + '</div>'
    : '';
  const qrBlok = (qs) => `<div class="qbox">${qrOfMelding(i.qr, qs)}${i.qr ? `<div class="qc" style="font-size:${(5.5 * f).toFixed(1)}pt;max-width:${mm(qs + 4)}">${esc(i.qr)}</div>` : ''}</div>`;

  let main;
  if (staand) {
    const bd = 13 * f;
    const badge = i.label ? `<div class="badge" style="width:${mm(bd)};height:${mm(bd)};background:${esc(kleurLabel)};color:${inkt(kleurLabel)};font-size:${(bd * PT * 0.22).toFixed(1)}pt">${esc(i.label.tekst)}</div>` : '';
    const tH = H * (groot ? 0.085 : 0.12), hH = H * 0.125;
    main = vak('t titel', tH * PT * 0.95, titel, `height:${mm(tH)};flex:0 0 auto`)
      + (groot ? vak('h groot', hH * PT * 0.95, groot, `height:${mm(hH)};flex:0 0 auto`) : '')
      + `<div style="height:${mm(3 * f)};flex:0 0 auto"></div>`
      + vak('tb', 10 * f, tabel)
      + `<div class="bot" style="margin-top:${mm(2 * f)}">${cert || '<span></span>'}<div style="display:flex;align-items:flex-end;gap:${mm(2.5 * f)}">${badge}${qrBlok(17 * f)}</div></div>`
      + voet;
  } else if (strook) {
    const avH = H - 2 * pad, codeH = Math.max(3.2, 4 * f), qs = Math.max(8, avH - codeH - 0.5);
    const pil = i.label ? `<span class="pill" style="background:${esc(kleurLabel)};color:${inkt(kleurLabel)}">${esc(i.label.tekst)}</span>` : '';
    const meta = [...rijen.map(([k, v]) => `<span>${k ? esc(k) + ' ' : ''}${esc(v)}</span>`), i.onder ? `<span>${esc(i.onder)}</span>` : ''].join('');
    const rowH = avH * 0.4;
    main = `<div class="sr" style="gap:${mm(5 * f)}"><div class="sa">`
      + `<div class="stop" style="height:${mm(rowH)};gap:${mm(4 * f)}">${vak('t titel', rowH * PT * 0.9, titel, 'flex:1 1 0')}${groot ? vak('h hs groot', rowH * PT * 0.9, groot, 'flex:0 0 28%') : ''}</div>`
      + `<div class="smid" style="font-size:${(avH * 0.13 * PT).toFixed(1)}pt">${pil}${cert}</div>`
      + (meta ? `<div class="sbot" style="font-size:${(6.8 * f).toFixed(1)}pt;padding-top:${mm(1.2 * f)}">${meta}</div>` : '')
      + `</div><div class="qbox" style="justify-content:center">${qrOfMelding(i.qr, qs)}${i.qr ? `<div class="qc" style="font-size:${(5.5 * f).toFixed(1)}pt;max-width:${mm(qs + 4)}">${esc(i.qr)}</div>` : ''}</div></div>`
      + voet;
  } else {
    const bd = Math.min(H * 0.3, 13 * f);
    const badge = i.label ? `<div class="badge" style="width:${mm(bd)};height:${mm(bd)};background:${esc(kleurLabel)};color:${inkt(kleurLabel)};font-size:${(bd * PT * 0.22).toFixed(1)}pt">${esc(i.label.tekst)}</div>` : '';
    const hdH = H * 0.2;
    main = `<div style="display:flex;gap:${mm(3 * f)};height:${mm(hdH)};flex:0 0 auto">`
      + vak('t titel', hdH * PT * 0.85, titel, 'flex:1 1 0')
      + (groot ? vak('h groot', hdH * PT * 0.85, groot, 'flex:0 0 40%') : '') + '</div>'
      + `<div style="height:${mm(2 * f)};flex:0 0 auto"></div>`
      + `<div style="flex:1 1 auto;min-height:0;display:flex;gap:${mm(2.5 * f)}">${vak('tb', 8.5 * f, tabel, 'flex:1 1 0')}<div style="display:flex;align-items:center;gap:${mm(3 * f)}">${badge}${qrBlok(Math.min(H * 0.34, 17 * f))}</div></div>`
      + (cert ? `<div style="margin-top:${mm(1.2 * f)}">${cert}</div>` : '')
      + voet;
  }

  const kleur = i.rand || '#7f7f7f', licht = isLicht(kleur);
  let gat = '', logoTop = 0, logoH = bw;
  if (i.gat) {
    const r = Math.min(GAT / 2, bw / 2 - 1), cx = bw / 2, cy = Math.max(2.5, 2.5 * f) + r;
    gat = `<svg class="gat" viewBox="-10 -10 20 20" style="left:${mm(cx - r)};top:${mm(cy - r)};width:${mm(2 * r)};height:${mm(2 * r)}"><circle r="9.6" fill="#fff" fill-opacity=".55" stroke="#000" stroke-width=".5" stroke-dasharray="1.6 1.2"/><path d="M-2.4 0H2.4M0-2.4V2.4" stroke="#000" stroke-width=".5"/></svg>`;
  }
  if (!i.logoBoven) { logoH = bw; logoTop = H - 0.5 - logoH; }
  const el = document.createElement('div');
  el.className = 'signb ' + i.opmaak;
  el.dataset.sjabloon = i.sjabloon;
  el.style.width = W + 'mm';
  el.style.height = H + 'mm';
  el.innerHTML =
    `<div class="band vlak" style="left:0;width:${mm(bw)};background:${licht ? '#f1f1f1' : tint(kleur, TINT)}"></div>`
    + `<div class="band streep" style="left:${mm(bw)};width:${mm(licht ? 1.2 : STREEP)};background:${esc(kleur)}${licht ? ';box-shadow:inset .25mm 0 0 #000,inset -.25mm 0 0 #000' : ''}"></div>`
    + `<div class="blg" style="left:0;top:${mm(logoTop)};width:${mm(bw)};height:${mm(logoH)}"><img alt="" src="${esc(hs.logo)}"></div>`
    + gat
    + `<div class="bm" style="left:${mm(bw + STREEP + gap)};right:${mm(pad)};top:${mm(pad)};bottom:${mm(i.voet ? 3.2 * f : pad)}">${main}</div>`;
  return el;
}

// ---------- labels voor de Citizen ----------

function labelMaten(b, hVol) {
  return { pad: Math.max(2, Math.min(4, Math.min(b, hVol) * 0.045)), capPt: Math.max(6, Math.min(9, hVol / 56 * 7)) };
}
const snap = (s, modules) => Math.max(1, Math.floor(s * DPM / modules)) * modules / DPM;
const modulesVan = (tekst) => { try { return qrSvg(tekst).modules; } catch { return 0; } };

function labelBasis(i, klasse, d) {
  const el = document.createElement('div');
  el.className = 'lbl ' + klasse;
  el.dataset.sjabloon = i.sjabloon;
  el.style.width = i.formaat.b + 'mm';
  el.style.height = i.formaat.h + 'mm';
  el.style.setProperty('--pad', mm(d.pad));
  el.style.setProperty('--capPt', d.capPt.toFixed(1) + 'pt');
  return el;
}

function qrLabel(i, hs) {
  const W = i.formaat.b, H = i.formaat.h, half = H < 40;
  const d = labelMaten(W, half ? H * 2 : H);
  if (half) {
    const el = labelBasis(i, 'half prod', d);
    const capH = i.qr ? d.capPt * 0.3528 * 1.15 + 0.6 : 0, avail = H - 2 * d.pad * 0.8 - capH;
    const m = modulesVan(i.qr), sz = m ? snap(avail, m) : avail;
    el.innerHTML = `<div class="hq">${qrOfMelding(i.qr, sz, 'qr')}${i.qr ? `<div class="cap">${esc(i.qr)}</div>` : ''}</div>`
      + `<div class="hp">${vak('t1 titel', 30, esc(i.titel), '', 5, i.onder ? 2 : 3)}${i.onder ? vak('t2', 12, esc(i.onder), '', 5) : ''}</div>`;
    return el;
  }
  const el = labelBasis(i, 'lay-top', d);
  const avail = Math.min(H - 2 * d.pad - 10, W * 0.5);
  const m = modulesVan(i.qr);
  const sz = m ? snap(Math.max(8, Math.min(25, avail)), m) : Math.min(20, H * 0.4);
  const qz = m ? 2 * sz / (m + 4) : 0;
  el.innerHTML = vak('t1 titel', Math.round(H * 0.8), esc(i.titel), '', 5)
    + `<div class="bot" style="height:${mm(sz)}">${qrOfMelding(i.qr, sz, 'qr')}`
    + `<div class="meta" style="padding-bottom:${mm(qz)}">${i.onder ? vak('t2', Math.round(H * 0.25), esc(i.onder), '', 5) : ''}`
    + `<div class="metarow">${i.qr ? `<div class="code">${esc(i.qr)}</div>` : '<div></div>'}</div></div>`
    + `<img class="logo" alt="" src="${esc(hs.logo)}" style="height:${mm(Math.min(H * 0.18, sz - qz))};margin-bottom:${mm(qz)}">`
    + '</div>';
  return el;
}

function locatieLabel(i) {
  const W = i.formaat.b, H = i.formaat.h, half = H < 40;
  const d = labelMaten(W, half ? H * 2 : H);
  const el = labelBasis(i, 'loc' + (half ? ' half' : ''), d);
  const botH = Math.max(half ? 6 : 10, H * 0.32);
  const m = modulesVan(i.qr);
  const qr = m ? qrOfMelding(i.qr, snap(botH, m), 'qr').replace('style="', 'style="flex:0 0 auto;align-self:flex-end;') : '';
  const onder = (i.onder || qr)
    ? `<div class="lbot" style="height:${mm(botH)}">${i.onder ? vak('ld', 24, esc(i.onder), '', 5) : '<div class="ld"></div>'}${qr}</div>` : '';
  el.innerHTML = vak('lc titel', 400, esc(i.titel), '', 8) + onder;
  return el;
}

/** Bouwt het element voor deze Inhoud (nog niet passend gemaakt). */
export function teken(inhoud, huisstijl = HUISSTIJL_DSL) {
  if (inhoud.opmaak === 'qrlabel') return qrLabel(inhoud, huisstijl);
  if (inhoud.opmaak === 'locatie') return locatieLabel(inhoud);
  return bordje(inhoud, huisstijl);
}

// ---------- passend maken ----------

function past(box, span) {
  if (!(span.scrollWidth <= box.clientWidth + 0.5 && span.offsetHeight <= box.clientHeight + 0.5)) return false;
  const regels = +box.dataset.regels;
  if (regels) {
    const lh = parseFloat(getComputedStyle(span).lineHeight) || parseFloat(span.style.fontSize) * 1.36;
    if (span.offsetHeight > regels * lh + 1) return false;
  }
  return true;
}

function maakPassend(box) {
  const span = box.firstElementChild;
  if (!span || !span.textContent) return;
  const max = +box.dataset.max || 12, min = +box.dataset.min || 3;
  span.style.fontSize = max + 'pt';
  if (past(box, span)) return;
  let lo = min, hi = max, best = min;
  for (let n = 0; n < 9; n++) {
    const mid = (lo + hi) / 2;
    span.style.fontSize = mid + 'pt';
    if (past(box, span)) { best = mid; lo = mid; } else hi = mid;
  }
  span.style.fontSize = best + 'pt';
}

function schrijflijn(span) {
  const i = document.createElement('i');
  i.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  span.appendChild(i);
  const y = i.getBoundingClientRect().top;
  i.remove();
  return y;
}

let lettertypes = null;
/** Meegeleverde lettertypes laden vóór het meten (anders past de tekst niet). */
function laadLettertypes() {
  if (!lettertypes) {
    const nodig = ['400', '500', '700'].map(w => `${w} 12pt "DSL Futura"`).concat(['500 12pt "DSL Label"', '700 12pt "DSL Label"']);
    lettertypes = Promise.all(nodig.map(f => document.fonts?.load?.(f).catch(() => null)))
      .then(() => document.fonts?.ready).catch(() => null);
  }
  return lettertypes;
}

/** Tekst passend maken; het element moet in de pagina staan. */
export async function pasAan(el) {
  await laadLettertypes();
  await Promise.all([...el.querySelectorAll('img')].map(img => (img.decode ? img.decode().catch(() => {}) : null)));
  el.querySelectorAll('.fb').forEach(maakPassend);
  el.querySelectorAll('.hp').forEach(b => b.classList.add('fitted'));
  // Lengte op dezelfde schrijflijn als de titel (strook).
  el.querySelectorAll('.stop').forEach(rij => {
    const t = rij.querySelector('.titel>span'), g = rij.querySelector('.groot>span');
    if (!t || !g) return;
    g.style.transform = '';
    const schaal = el.getBoundingClientRect().width / el.offsetWidth || 1;
    const verschil = (schrijflijn(g) - schrijflijn(t)) / schaal;
    if (Math.abs(verschil) > 0.1) g.style.transform = `translateY(${(-verschil).toFixed(2)}px)`;
  });
  // Voettekst iets kleiner als een regel niet past.
  el.querySelectorAll('.ft').forEach(ft => {
    let fs = parseFloat(ft.style.fontSize) || 5;
    for (let n = 0; n < 14 && [...ft.children].some(d => d.scrollWidth > d.clientWidth + 0.5); n++) {
      fs *= 0.95;
      ft.style.fontSize = fs.toFixed(2) + 'pt';
    }
  });
}
