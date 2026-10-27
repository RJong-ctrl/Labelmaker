// Inhoud tekenen als bordje, strook of label (huisstijl uit versie 25).
// teken() bouwt het element in mm; pasAan() maakt de tekst passend zodra het
// element in de pagina staat.

import { qrSvg } from './qr.js';
import { tint, inkt, isLicht, ONBEKEND } from './kleuren.js';
import { geldigeKleur } from './sjablonen.js';
import { esc } from './html.js';

// Oud formaat (fase 1); teken() neemt ook het profielformaat
// { logo: string|null, voet: string[], certIcoon: string|null, lettertype: 'futura'|'barlow'|'arial'|'eigen' }.
export const HUISSTIJL_DSL = {
  logo: new URL('../assets/dsl-logo.svg', import.meta.url).href,
  voet: [
    'DSL Geluids- & Lichtverhuur, De Fok 23, 1742 PC Schagen',
    'Tel. 0224-218130 | info@dslverhuur.nl | www.dslverhuur.nl',
  ],
  lettertype: 'DSL Futura',
  labelLettertype: 'DSL Label',
};

const LETTERTYPEN = ['futura', 'barlow', 'arial', 'eigen'];

/** Huisstijl (profiel of oud formaat) in één vaste vorm; onbekende lettertypen worden Futura. */
function huisstijlVan(hs) {
  const h = hs && typeof hs === 'object' ? hs : HUISSTIJL_DSL;
  const tekst = (x) => (typeof x === 'string' && x.trim() ? x.trim() : null);
  return {
    logo: tekst(h.logo),
    voet: Array.isArray(h.voet) ? h.voet.map(l => String(l ?? '').trim()).filter(Boolean) : [],
    // Alleen een ingebouwde afbeelding (data-URL): nooit een bron van buiten.
    certIcoon: /^data:image\//i.test(tekst(h.certIcoon) || '') ? tekst(h.certIcoon) : null,
    lettertype: LETTERTYPEN.includes(h.lettertype) ? h.lettertype : 'futura',   // ook het oude 'DSL Futura'
  };
}

const STREEP = 1;       // mm, volle kleur aan de binnenkant van het kleurvlak
const TINT = 0.25;      // kleurvlak
const GAT = 8;          // mm, gatmarkering
const PT = 2.835;       // pt per mm
const DPM = 203 / 25.4; // Citizen: punten per mm

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
  const wand = i.opmaak === 'wand', kist = i.opmaak === 'kist-modern';
  const staand = i.opmaak === 'staand' || (wand && H > W), strook = i.opmaak === 'strook';
  const f = wand || kist ? Math.min(W, H) / 74 : staand ? Math.min(W / 73, H / 105) : Math.min(W / 85, H / 48);
  const bw = wand || kist ? Math.min(W, H) * 0.17 : staand ? W * 0.19 : Math.min(W * 0.15, H * 0.3);
  const gap = staand ? 4 * f : 3.5 * f, pad = staand ? 4 * f : 3 * f;
  const titel = esc(i.titel), groot = esc(i.groot);
  const rijen = i.eigenschappen.map(([k, v]) => [k, v]);
  // Onderregel (bijv. 'Artikelnummer GE9402') klein linksonder, zoals op de strook.
  const onder = !strook && !wand && !kist && i.onder ? `<div class="onderregel" style="font-size:${(6 * (staand ? Math.min(W / 73, H / 105) : Math.min(W / 85, H / 48))).toFixed(1)}pt">${esc(i.onder)}</div>` : '';
  const tabel = rijen.length
    ? '<div class="tg">' + rijen.map((r, n) => (n ? '<div class="sep"></div>' : '') + `<div class="tk">${esc(r[0])}</div><div class="tv">${esc(r[1])}</div>`).join('') + '</div>'
    : '';
  const kleurLabel = geldigeKleur(i.label?.kleur) || ONBEKEND;
  const certIcoon = hs.certIcoon ? `<img alt="" src="${esc(hs.certIcoon)}" style="width:${mm(5 * f)};height:${mm(5 * f)}">` : '';
  const cert = i.cert ? `<div class="cert" style="font-size:${(5.5 * f).toFixed(1)}pt">${certIcoon}<span>${esc(i.cert)}</span></div>` : '';
  // Geen voettekst in de huisstijl: dan geen voet, ook als het sjabloon er een vraagt.
  const heeftVoet = !!i.voet && hs.voet.length > 0;
  const voet = heeftVoet
    ? `<div class="ft" style="font-size:${(5 * f).toFixed(1)}pt;margin-top:${mm(2.6 * f)};padding-top:${mm(1.6 * f)}">` +
      hs.voet.map(l => '<div>' + l.split('|').map(x => esc(x.trim())).join('<span class="fsep" aria-hidden="true"></span>') + '</div>').join('') + '</div>'
    : '';
  const qrBlok = (qs) => `<div class="qbox">${qrOfMelding(i.qr, qs)}${i.qr ? `<div class="qc" style="font-size:${(5.5 * f).toFixed(1)}pt;max-width:${mm(qs + 4)}">${esc(i.qr)}</div>` : ''}</div>`;

  let main;
  if (kist) {
    // Materiaalbordje: naam en kistnummer bovenaan; de inhoud staat centraal en luchtig (regels met lijntjes,
    // aantal vet). Rechts: gewicht en QR, daaronder het vak voor de projectsticker.
    const kopH = 11 * f / 1.84, st = { b: 80, h: 60 }, qs = 20;
    const gewicht = String(i.waarden?.Gewicht || '').trim();
    const gw = gewicht && /^[\d.,\s]+$/.test(gewicht) ? gewicht + ' kg' : gewicht;
    const regels = (i.lijst || []).map(([n, t]) => `<div class="kr"><span class="ka">${n ? esc(n) + '×' : ''}</span><span class="kt">${esc(t)}</span></div>`).join('');
    main = `<div class="kkop" style="height:${mm(kopH)}">${vak('t titel', kopH * PT * 0.9, titel, 'flex:1 1 0')}${groot ? vak('h groot knr', kopH * PT * 0.9, groot, `flex:0 0 ${mm(30)}`) : ''}</div>`
      + `<div class="krij" style="gap:${mm(5)};margin-top:${mm(2.5)}">`
      + `<div class="klinks">${regels ? vak('klijst', 18, `<div class="kgrid">${regels}</div>`, 'flex:1 1 0;justify-content:flex-start', 5) : '<div class="kleeg">Inhoud</div>'}</div>`
      + `<div class="krechts" style="width:${mm(st.b)}"><div class="kbot"><div class="kgew">${gw ? `<span>Gewicht</span><b>${esc(gw)}</b>` : ''}</div>${i.qr ? qrBlok(qs) : ''}</div>`
      + `<div class="ksticker" style="height:${mm(st.h)}">Projectsticker</div></div></div>`
      + voet;
  } else if (wand) {
    // Wandbord: de locatie zo groot mogelijk, eronder wat er ligt, QR van de locatie rechtsonder.
    const tH = H * (staand ? 0.34 : 0.4);
    main = vak('t titel wrap wt', tH * PT * 0.95, titel, `height:${mm(tH)};flex:0 0 auto`, 20, 2)
      + `<div style="height:${mm(3 * f)};flex:0 0 auto"></div>`;
    const inhoud = i.onder ? vak('w-inhoud wrap', H * (staand ? 0.06 : 0.08) * PT, esc(i.onder), 'flex:1 1 0;min-height:0;justify-content:flex-start', 8, 3) : '<div style="flex:1 1 0"></div>';
    // Staand: inhoud en daaronder de QR; liggend: inhoud links, QR rechts ernaast.
    main += staand
      ? inhoud + `<div class="bot" style="margin-top:${mm(2 * f)}"><span></span>${qrBlok(Math.min(W, H) * 0.25)}</div>`
      : `<div style="flex:1 1 0;min-height:0;display:flex;align-items:stretch;gap:${mm(6 * f)}"><div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column">${inhoud}</div><div style="display:flex;align-items:flex-end">${qrBlok(Math.min(W, H) * 0.25)}</div></div>`;
    main += voet;
  } else if (staand) {
    const bd = 13 * f;
    const badge = i.label ? `<div class="badge" style="width:${mm(bd)};height:${mm(bd)};background:${esc(kleurLabel)};color:${inkt(kleurLabel)};font-size:${(bd * PT * 0.22).toFixed(1)}pt">${esc(i.label.tekst)}</div>` : '';
    // Zonder 'groot' is de naam de hoofdzaak: die krijgt alle vrije ruimte, over meerdere regels.
    const tH = H * 0.085, hH = H * 0.125;
    const links = (cert || onder) ? `<div class="botlinks">${cert}${onder}</div>` : '<span></span>';
    main = (groot ? vak('t titel', tH * PT * 0.95, titel, `height:${mm(tH)};flex:0 0 auto`)
      : vak('t titel wrap', H * 0.11 * PT, titel, `flex:1 1 ${mm(H * 0.2)};min-height:${mm(H * 0.2)}`, 6))
      + (groot ? vak('h groot', hH * PT * 0.95, groot, `height:${mm(hH)};flex:0 0 auto`) : '')
      + `<div style="height:${mm(3 * f)};flex:0 0 auto"></div>`
      + vak('tb', 10 * f, tabel, groot ? '' : 'flex:0 0 auto')
      + `<div class="bot" style="margin-top:${mm(2 * f)}">${links}<div style="display:flex;align-items:flex-end;gap:${mm(2.5 * f)}">${badge}${qrBlok(17 * f)}</div></div>`
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
    // Met 'groot' (bijv. de maat): naam en daaronder groot, net als bij het staande bordje (Robin, 27 okt).
    const tH = H * 0.13, gH = H * 0.17;
    main = (groot
      ? vak('t titel', tH * PT * 0.95, titel, `height:${mm(tH)};flex:0 0 auto`) + vak('h groot', gH * PT * 0.95, groot, `height:${mm(gH)};flex:0 0 auto`)
      : `<div style="display:flex;flex:1 1 ${mm(H * 0.3)};min-height:${mm(H * 0.3)}">${vak('t titel wrap', H * 0.16 * PT, titel, 'flex:1 1 0', 6, 4)}</div>`)
      + `<div style="height:${mm(2 * f)};flex:0 0 auto"></div>`
      + `<div style="${groot ? 'flex:1 1 auto' : 'flex:0 0 auto'};min-height:0;display:flex;align-items:flex-end;gap:${mm(2.5 * f)}">`
      + `<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;justify-content:space-between;align-self:stretch">${vak('tb', 8.5 * f, tabel, 'flex:1 1 auto')}${cert || onder ? `<div class="botlinks">${cert}${onder}</div>` : ''}</div>`
      + `<div style="display:flex;align-items:center;gap:${mm(3 * f)}">${badge}${qrBlok(Math.min(H * 0.34, 17 * f))}</div></div>`
      + voet;
  }

  const kleur = geldigeKleur(i.rand) || ONBEKEND, licht = isLicht(kleur);
  let gat = '', logoTop = 0, logoH = bw;
  if (i.gat) {
    const r = Math.min(GAT / 2, bw / 2 - 1), cx = bw / 2, cy = H - Math.max(2.5, 2.5 * f) - r; // gatmarkering onderaan
    gat = `<svg class="gat" viewBox="-10 -10 20 20" style="left:${mm(cx - r)};top:${mm(cy - r)};width:${mm(2 * r)};height:${mm(2 * r)}"><circle r="9.6" fill="#fff" fill-opacity=".55" stroke="#000" stroke-width=".5" stroke-dasharray="1.6 1.2"/><path d="M-2.4 0H2.4M0-2.4V2.4" stroke="#000" stroke-width=".5"/></svg>`;
  }
  // Logo altijd bovenaan (Robin, 26 okt); logoBoven blijft in het sjabloon voor oudere gegevens.
  logoTop = 0.5;
  const el = document.createElement('div');
  el.className = 'signb ' + i.opmaak;
  el.dataset.sjabloon = i.sjabloon;
  el.style.width = W + 'mm';
  el.style.height = H + 'mm';
  el.innerHTML =
    `<div class="band vlak" style="left:0;width:${mm(bw)};background:${licht ? '#f1f1f1' : tint(kleur, TINT)}"></div>`
    + `<div class="band streep" style="left:${mm(bw)};width:${mm(licht ? 1.2 : STREEP)};background:${esc(kleur)}${licht ? ';box-shadow:inset .25mm 0 0 #000,inset -.25mm 0 0 #000' : ''}"></div>`
    + (hs.logo ? `<div class="blg" style="left:0;top:${mm(logoTop)};width:${mm(bw)};height:${mm(logoH)}"><img alt="" src="${esc(hs.logo)}"></div>` : '')
    + gat
    + `<div class="bm" style="left:${mm(bw + STREEP + gap)};right:${mm(pad)};top:${mm(pad)};bottom:${mm(heeftVoet ? 3.2 * f : pad)}">${main}</div>`;
  return el;
}

// ---------- materiaalbordje voor op de kist (opbouw van het oude bordje) ----------

function kist(i, hs) {
  const W = i.formaat.b, H = i.formaat.h, L = 1.2, w = i.waarden || {};
  const kopH = H * 0.2, voetH = hs.voet.length ? H * 0.085 : 0, st = { b: 80, h: 60 };
  const veld = (naam, waarde, pt) => `<div class="kv" style="font-size:${pt}pt"><b>${esc(naam)}:</b>${vak('kw', pt, esc(waarde || ''), 'flex:1 1 auto', 5)}</div>`;
  const gewicht = String(w.Gewicht || '').trim();
  const gw = gewicht && /^[\d.,\s]+$/.test(gewicht) ? gewicht + ' kg' : gewicht;
  const qs = kopH - 2 * L - 2;
  const lijst = i.lijst || [];
  // Veel regels: twee kolommen. De letter wordt zo groot als past (hooguit 12 pt); lange namen lopen door.
  const regels = lijst.map(([n, t]) => `<div class="kr"><span class="ka">${esc(n)}</span><span class="kt">${esc(t)}</span></div>`).join('');
  const el = document.createElement('div');
  el.className = 'signb kist';
  el.dataset.sjabloon = i.sjabloon;
  el.style.width = W + 'mm';
  el.style.height = H + 'mm';
  el.style.setProperty('--l', mm(L));
  // Kop zoals het oude bordje: logo, twee regels (vroeger klant en productie, nu naam en gewicht), QR.
  // Rechts naast de inhoud het vak voor de projectsticker (Citizen-label 76 × 56 mm).
  el.innerHTML =
    `<div class="krij" style="height:${mm(kopH)};grid-template-columns:${mm(kopH * 1.25)} 1fr ${mm(kopH)}">`
    + `<div class="kc klogo">${hs.logo ? `<img alt="" src="${esc(hs.logo)}">` : ''}</div>`
    + `<div class="kstapel"><div class="kc">${veld('Naam', i.titel, 13)}</div><div class="kc">${veld('Gewicht', gw, 13)}</div></div>`
    + `<div class="kc kqr">${i.qr ? qrOfMelding(i.qr, qs) : ''}</div></div>`
    + `<div class="krij kmidden" style="grid-template-columns:1fr ${mm(st.b + 4)}">`
    + `<div class="kc kinhoud"><div class="kkop"><span class="kl">Inhoud:</span><span style="flex:1 1 auto"></span><span class="kcode">${esc(i.onder)}</span></div>`
    + (regels ? vak('klijst', 12, `<div class="kgrid${lijst.length > 13 ? ' twee' : ''}">${regels}</div>`, 'flex:1 1 0;justify-content:flex-start', 4.5) : '')
    + '</div>'
    + `<div class="kc kstickervak"><div class="ksticker" style="width:${mm(st.b)};height:${mm(st.h)}">Projectsticker</div></div></div>`
    + (voetH ? `<div class="kvoet" style="height:${mm(voetH)}">${hs.voet.map(l => '<div>' + l.split('|').map(x => esc(x.trim())).join('&nbsp; ') + '</div>').join('')}</div>` : '');
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
    + (hs.logo ? `<img class="logo" alt="" src="${esc(hs.logo)}" style="height:${mm(Math.min(H * 0.18, sz - qz))};margin-bottom:${mm(qz)}">` : '')
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

/**
 * Bouwt het element voor deze Inhoud (nog niet passend gemaakt).
 * huisstijl: profielformaat of het oude HUISSTIJL_DSL; het lettertype komt als
 * data-lettertype op het element (de CSS kiest de letter).
 */
export function teken(inhoud, huisstijl = HUISSTIJL_DSL) {
  const hs = huisstijlVan(huisstijl);
  const el = inhoud.opmaak === 'qrlabel' ? qrLabel(inhoud, hs)
    : inhoud.opmaak === 'locatie' ? locatieLabel(inhoud)
      : inhoud.opmaak === 'kist' ? kist(inhoud, hs)
        : bordje(inhoud, hs);
  el.dataset.lettertype = hs.lettertype;
  // Titel die met een J begint: ruimte voor de uitstekende haak (anders afgeknipt).
  if (el.classList.contains('signb')) for (const t of el.querySelectorAll('.t')) if (/^\s*J/.test(t.textContent)) t.classList.add('j');
  return el;
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

/** Staat alleen Futura Book op deze pc (geen Medium/Heavy)? Dan alles in Futura Book (class futura-boek). */
export async function kiesFutura(doc = document) {
  const er = async (bronnen) => { try { await new FontFace('lm-test', bronnen).load(); return true; } catch { return false; } };
  const boek = await er('local("Futura Bk BT"), local("Futura Book BT"), local("FuturaBT-Book"), local("Futura Book"), local("Futura-Book")');
  const vet = await er('local("Futura Hv BT"), local("FuturaBT-Heavy"), local("Futura Bold"), local("Futura-Bold"), local("Futura Md BT"), local("FuturaBT-Medium")');
  doc.documentElement.classList.toggle('futura-boek', boek && !vet);
  return { boek, vet };
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
  // Eigen lettertype: elders als FontFace geregistreerd; zo niet, dan valt de CSS terug op DSL Futura.
  if (el.dataset.lettertype === 'eigen') {
    await Promise.all(['400', '500', '700'].map(w => document.fonts?.load?.(`${w} 12pt "DSL Eigen"`).catch(() => null)));
  }
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
