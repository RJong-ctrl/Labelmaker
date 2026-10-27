// Sjablooneditor (beheer): Basis, Velden, Wat waar komt en Kleuren.
// Elke geldige wijziging gaat als volledig sjabloon naar opWijziging(); ongeldige
// invoer (eigen kleur, maat, veldnaam) krijgt een melding en wordt niet doorgegeven.

import { geldigeKleur } from './sjablonen.js';
import { KLEURNAMEN, sleutel } from './kleuren.js';
import { PATRONEN } from './afleiden.js';
import { TOEGESTANE_VELDEN } from './import.js';
import { esc } from './html.js';

export const OPMAKEN = { staand: 'Bordje staand', liggend: 'Bordje liggend', strook: 'Strook', wand: 'Wandbord (A4)', kist: 'Materiaalbordje kist', qrlabel: 'QR-label', locatie: 'Locatielabel' };
export const STANDAARD_FORMAAT = { staand: { b: 74, h: 105 }, liggend: { b: 105, h: 74 }, strook: { b: 180, h: 48 }, wand: { b: 194, h: 281 }, kist: { b: 194, h: 136 }, qrlabel: { b: 76, h: 56 }, locatie: { b: 76, h: 56 } };
export const KOLOM_NAMEN = {
  naam: 'Naam', code: 'Artikelnummer', qr: 'QR-code', exemplaren: 'QR-codes exemplaren', pad: 'Pad (categorie)',
  map: 'Map', locatie: 'Locatie', soort: 'Soort (bulk of serie)', type: 'Type materiaal', aantal: 'Aantal',
};
const PATROON_NAMEN = { lengte: 'Lengte (12,5)', maat: 'Maat (6 × 3)', breedte: 'Maat: eerste getal (6)', hoogte: 'Maat: tweede getal (3)', polen: 'Polen (NL4)', kwaliteit: 'Kwaliteit (A of B)', kaal: 'Naam zonder maat', kabel: 'Is een kabel (ja)' };
const HERKOMST = { kolom: 'Kolom uit de export', naam: 'Uit de naam', aanvulling: 'Aanvulling' };
const SOORT = { tekst: 'Tekst', getal: 'Getal', keuze: 'Keuzelijst' };
const PLEK = { titel: 'Titel', groot: 'Groot', label: 'Label', onder: 'Onderregel', qr: 'QR-code' };
const PLEK_HINT = { groot: 'bijv. {Lengte} m', label: 'gekleurd rondje of pil', qr: 'leeg = QR-code van het artikel' };
const KLEURREGEL = { rand: 'Kleurrand', label: 'Label' };
const LABELS = new Set(['qrlabel', 'locatie']);
const MIN_MM = 10, MAX_MM = 297;

const plekkenVoor = (opmaak) => (opmaak === 'qrlabel' || opmaak === 'kist' ? ['titel', 'onder'] : opmaak === 'locatie' || opmaak === 'wand' ? ['titel', 'onder', 'qr'] : ['titel', 'groot', 'label', 'onder']);
const isBordje = (opmaak) => !LABELS.has(opmaak);
const opt = (waarde, tekst, gekozen) => `<option value="${esc(waarde)}"${gekozen ? ' selected' : ''}>${esc(tekst)}</option>`;
const nlSort = new Intl.Collator('nl', { numeric: true, sensitivity: 'base' });
const getal = (s) => { const n = Number(String(s ?? '').trim().replace(',', '.')); return String(s ?? '').trim() && Number.isFinite(n) ? n : NaN; };

/** Tokens als tekst: velden tussen accolades, bijv. '{Lengte} m'. */
export function naarTekst(tokens = []) {
  return (tokens || []).map(t => (typeof t === 'string' ? t : `{${t.veld}}`)).join('');
}

/** Tekst met {Veld} terug naar tokens; '{}' of een losse accolade blijft gewone tekst. */
export function naarTokens(tekst = '') {
  const uit = [];
  const stuk = (s) => {
    if (!s) return;
    if (typeof uit[uit.length - 1] === 'string') uit[uit.length - 1] += s;
    else uit.push(s);
  };
  const re = /\{([^{}]+)\}/g;
  let i = 0, m;
  while ((m = re.exec(tekst))) {
    stuk(tekst.slice(i, m.index));
    const naam = m[1].trim();
    if (naam) uit.push({ veld: naam });
    else stuk(m[0]);
    i = re.lastIndex;
  }
  stuk(tekst.slice(i));
  return uit;
}

function normaliseer(bron) {
  const s = structuredClone(bron);
  s.velden = (s.velden || []).map(v => ({ ...v, herkomst: { ...(v.herkomst || { type: 'aanvulling' }) } }));
  s.plekken = { titel: [], groot: [], label: [], eigenschappen: [], onder: [], ...(s.plekken || {}) };
  s.plekken.eigenschappen = (s.plekken.eigenschappen || []).map(e => ({ kop: e.kop || '', waarde: [...(e.waarde || [])] }));
  s.formaat = { ...(s.formaat || STANDAARD_FORMAAT[s.opmaak] || STANDAARD_FORMAAT.staand) };
  s.kleuren = { ...(s.kleuren || {}) };
  for (const k of ['rand', 'label']) {
    const r = s.kleuren[k];
    if (r) s.kleuren[k] = { sleutel: r.sleutel ? [...r.sleutel] : (r.veld ? [{ veld: r.veld }] : []), waarden: { ...(r.waarden || {}) } };
  }
  return s;
}

let teller = 0;

/**
 * Tekent de editor in doel. opties:
 *  - opWijziging(sjabloon): na elke geldige wijziging (volledig sjabloon, kopie)
 *  - waardenVoor(tokens, sjabloon) -> string[]: waarden die bij de artikelen voorkomen (kleurtabel)
 *  - signal: AbortSignal; daarna reageert de editor nergens meer op
 * Geeft { sjabloon() } terug: de huidige stand.
 */
export function tekenEditor(doel, sjabloon, { opWijziging = () => {}, waardenVoor = null, signal } = {}) {
  const s = normaliseer(sjabloon);
  const uid = ++teller;
  const rijen = {};
  for (const k of ['rand', 'label']) {
    rijen[k] = Object.entries(s.kleuren[k]?.waarden || {}).map(([waarde, kleur]) => ({ waarde, kleur: geldigeKleur(kleur) || '' }))
      .sort((a, b) => nlSort.compare(a.waarde, b.waarde));
  }
  const laatstePad = {}; // per blok: de plek waar een veldblokje in komt
  const wortel = document.createElement('div');
  wortel.className = 'editor';
  doel.replaceChildren(wortel);

  // ---------- sjabloon opbouwen ----------
  function bouw() {
    const uit = structuredClone(s);
    for (const k of ['rand', 'label']) {
      const tokens = s.kleuren[k]?.sleutel || [];
      const waarden = {};
      for (const r of rijen[k]) {
        const w = sleutel(r.waarde), c = geldigeKleur(r.kleur);
        if (w && c) waarden[w] = c;
      }
      if (tokens.length || Object.keys(waarden).length) uit.kleuren[k] = { sleutel: tokens, waarden };
      else delete uit.kleuren[k];
    }
    if (!uit.regelsVeld) delete uit.regelsVeld;
    return uit;
  }
  const wijzig = () => { if (!signal?.aborted) opWijziging(bouw()); };
  const luister = (type, fn) => wortel.addEventListener(type, fn, { signal });

  const $ = (sel) => wortel.querySelector(sel);
  const pad = (p) => wortel.querySelector(`[data-pad="${CSS.escape(p)}"]`);
  const meld = (blok, tekst) => { const m = $(`[data-melding="${blok}"]`); if (m) m.textContent = tekst || ''; };
  const veldNamen = () => s.velden.map(v => v.naam);

  // ---------- blokken ----------
  function htmlBasis() {
    const bordje = isBordje(s.opmaak);
    const vink = (k, tekst) => `<label class="vink"><input type="checkbox" data-pad="${k}"${s[k] ? ' checked' : ''}> ${tekst}</label>`;
    return `<h3 id="ed${uid}-basis">Basis</h3><div class="raster">`
      + `<label class="veld breed"><span>Naam</span><input type="text" data-pad="naam" value="${esc(s.naam)}" autocomplete="off"></label>`
      + `<label class="veld"><span>Opmaak</span><select data-pad="opmaak">${Object.entries(OPMAKEN).map(([k, t]) => opt(k, t, s.opmaak === k)).join('')}</select></label>`
      + `<label class="veld"><span>Printer</span><select data-pad="printer">${opt('label', 'Labelprinter', s.printer === 'label')}${opt('a4', 'A4-printer', s.printer !== 'label')}</select></label>`
      + `<div class="veld" role="group" aria-labelledby="ed${uid}-maat"><span id="ed${uid}-maat">Formaat in mm</span><span class="maat">`
      + `<input type="number" data-pad="formaat.b" min="${MIN_MM}" max="${MAX_MM}" step="any" value="${esc(s.formaat.b)}" aria-label="Breedte in mm">`
      + `<span aria-hidden="true">×</span><input type="number" data-pad="formaat.h" min="${MIN_MM}" max="${MAX_MM}" step="any" value="${esc(s.formaat.h)}" aria-label="Hoogte in mm"></span></div>`
      + (bordje
        ? `<div class="vinken">${vink('gat', 'Gatmarkering')}${vink('voet', 'Voettekst')}</div>`
          + `<label class="veld breed"><span>Certificaatregel</span><input type="text" data-pad="cert" value="${esc(s.cert || '')}" placeholder="leeg = geen" autocomplete="off"></label>`
        : '')
      + `</div><p class="fout" data-melding="basis" role="alert"></p>`;
  }

  function htmlVeld(v, i) {
    const h = v.herkomst || { type: 'aanvulling' };
    const extra = v.soort === 'keuze' ? (v.opties || []).join('; ') : v.soort === 'getal' ? (v.eenheid || '') : '';
    const bron = h.type === 'kolom'
      ? `<label class="veld"><span>Kolom</span><select data-pad="veld.${i}.bron">${TOEGESTANE_VELDEN.filter(k => k !== 'exemplaren').map(k => opt(k, KOLOM_NAMEN[k] || k, h.kolom === k)).join('')}</select></label>`
      : h.type === 'naam'
        ? `<label class="veld"><span>Patroon</span><select data-pad="veld.${i}.bron">${Object.keys(PATRONEN).map(k => opt(k, PATROON_NAMEN[k] || k, h.patroon === k)).join('')}</select></label>`
        : '<span class="veld leeg-veld" aria-hidden="true"></span>';
    return `<li class="veldrij" data-i="${i}">`
      + `<label class="veld"><span>Naam</span><input type="text" data-pad="veld.${i}.naam" value="${esc(v.naam)}" autocomplete="off"></label>`
      + `<label class="veld"><span>Soort</span><select data-pad="veld.${i}.soort">${Object.entries(SOORT).map(([k, t]) => opt(k, t, (v.soort || 'tekst') === k)).join('')}</select></label>`
      + `<label class="veld"><span>${v.soort === 'keuze' ? 'Keuzes (met ;)' : v.soort === 'getal' ? 'Eenheid' : 'Eenheid / keuzes'}</span>`
      + `<input type="text" data-pad="veld.${i}.extra" value="${esc(extra)}"${v.soort === 'tekst' || !v.soort ? ' disabled placeholder="—"' : v.soort === 'keuze' ? ' placeholder="Zwart; Wit"' : ' placeholder="m"'} autocomplete="off"></label>`
      + `<label class="veld"><span>Herkomst</span><select data-pad="veld.${i}.herkomst">${Object.entries(HERKOMST).map(([k, t]) => opt(k, t, h.type === k)).join('')}</select></label>`
      + bron
      + `<label class="veld"><span>Alleen als</span><select data-pad="veld.${i}.alleenAls" title="Alleen tonen als dit andere veld een waarde heeft">${htmlAlleenAls(v)}</select></label>`
      + `<label class="vink"><input type="checkbox" data-pad="veld.${i}.verplicht"${v.verplicht ? ' checked' : ''}> Verplicht</label>`
      + `<button type="button" class="klein weg" data-actie="veld-weg" data-i="${i}" aria-label="Veld ${esc(v.naam)} verwijderen" title="Verwijderen">×</button>`
      + '</li>';
  }
  const htmlAlleenAls = (v) => opt('', '—', !v.alleenAls) + s.velden.filter(x => x !== v).map(x => opt(x.naam, x.naam, v.alleenAls === x.naam)).join('');

  function htmlVelden() {
    return `<h3>Velden</h3><p class="hint">Kolom uit de export, uit de naam (vaste patronen) of aanvulling: één keer per artikel invullen.</p>`
      + `<ol class="velden">${s.velden.map(htmlVeld).join('')}</ol>`
      + `<div class="acties"><button type="button" data-actie="veld-erbij">Veld toevoegen</button></div><p class="fout" data-melding="velden" role="alert"></p>`;
  }

  const htmlChips = () => `<div class="chips veldchips" role="group" aria-label="Veld invoegen">`
    + (s.velden.length ? s.velden.map(v => `<button type="button" class="chip veldchip" data-actie="invoegen" data-veld="${esc(v.naam)}">{${esc(v.naam)}}</button>`).join('') : '<span class="hint">Nog geen velden.</span>')
    + '</div>';

  function htmlPlekken() {
    const bordje = isBordje(s.opmaak);
    const eig = s.plekken.eigenschappen;
    return `<h3>Wat waar komt</h3>${htmlChips()}<p class="hint">Klik in een plek en dan op een veld. Vaste tekst typ je erbij. Een plek met alleen lege velden verdwijnt.</p>`
      + '<div class="plekken">'
      + plekkenVoor(s.opmaak).map(k => `<label class="veld"><span>${PLEK[k]}${PLEK_HINT[k] ? ` <small>${esc(PLEK_HINT[k])}</small>` : ''}</span>`
        + `<input type="text" class="tokens" data-pad="plek.${k}" value="${esc(naarTekst(s.plekken[k]))}" autocomplete="off" spellcheck="false"></label>`).join('')
      + '</div>'
      + (bordje
        ? `<h4>Eigenschappen</h4><ol class="eigenschappen">${eig.map((e, i) => `<li class="eigrij">`
          + `<input type="text" data-pad="eig.${i}.kop" value="${esc(e.kop)}" aria-label="Kop eigenschap ${i + 1}" placeholder="Kop" autocomplete="off">`
          + `<input type="text" class="tokens" data-pad="eig.${i}.waarde" value="${esc(naarTekst(e.waarde))}" aria-label="Waarde eigenschap ${i + 1}" placeholder="{Veld}" autocomplete="off" spellcheck="false">`
          + `<button type="button" class="klein weg" data-actie="eig-weg" data-i="${i}" aria-label="Eigenschap ${i + 1} verwijderen" title="Verwijderen">×</button></li>`).join('')}</ol>`
          + `<div class="acties"><button type="button" data-actie="eig-erbij">Eigenschap toevoegen</button></div>`
          + `<label class="veld smal"><span>Vrije regels uit veld <small>Kop: waarde, één per regel</small></span><select data-pad="regelsVeld">${opt('', '—', !s.regelsVeld)}${s.velden.map(v => opt(v.naam, v.naam, s.regelsVeld === v.naam)).join('')}</select></label>`
        : '')
      + '<p class="fout" data-melding="plekken" role="status"></p>';
  }

  function htmlKleurRij(k, r, i) {
    const naam = Object.keys(KLEURNAMEN).find(n => KLEURNAMEN[n] === r.kleur);
    const keuze = r.eigen ? 'eigen' : naam || (r.kleur ? 'eigen' : '');
    return `<tr class="kleurrij" data-i="${i}">`
      + `<td><input type="text" data-pad="kleur.${k}.${i}.waarde" value="${esc(r.waarde)}" list="ed${uid}-w-${k}" aria-label="Waarde" autocomplete="off"></td>`
      + `<td class="kleurcel"><select data-pad="kleur.${k}.${i}.naam" aria-label="Kleur">${opt('', 'Kies…', !keuze)}${Object.keys(KLEURNAMEN).map(n => opt(n, n, keuze === n)).join('')}${opt('eigen', 'Eigen kleur', keuze === 'eigen')}</select>`
      + `<input type="color" data-pad="kleur.${k}.${i}.kiezer" value="${esc(r.kleur || '#7f7f7f')}" aria-label="Kleur kiezen">`
      + `<input type="text" class="hex" data-pad="kleur.${k}.${i}.hex" value="${esc(r.invoer ?? r.kleur)}" aria-label="Kleurcode" placeholder="#rrggbb" autocomplete="off" spellcheck="false"></td>`
      + `<td><button type="button" class="klein weg" data-actie="kleur-weg" data-regel="${k}" data-i="${i}" aria-label="Waarde ${esc(r.waarde)} verwijderen" title="Verwijderen">×</button></td></tr>`;
  }

  function htmlKleurRegel(k) {
    const tokens = s.kleuren[k]?.sleutel || [];
    return `<div class="kleurregel" data-regel="${k}"><h4>${KLEURREGEL[k]}</h4>`
      + `<label class="veld"><span>Volgt <small>bijv. {Lengte}</small></span><input type="text" class="tokens" data-pad="kleur.${k}.sleutel" value="${esc(naarTekst(tokens))}" autocomplete="off" spellcheck="false"></label>`
      + `<table class="kleurtabel"><thead><tr><th scope="col">Waarde</th><th scope="col">Kleur</th><th scope="col"><span class="bh-sr">Verwijderen</span></th></tr></thead>`
      + `<tbody>${rijen[k].map((r, i) => htmlKleurRij(k, r, i)).join('')}</tbody></table>`
      + `<datalist id="ed${uid}-w-${k}"></datalist>`
      + `<div class="acties"><button type="button" data-actie="kleur-erbij" data-regel="${k}">Waarde toevoegen</button></div>`
      + `<p class="hint" data-zonder="${k}"></p><p class="fout" data-melding="kleur.${k}" role="alert"></p></div>`;
  }

  function htmlKleuren() {
    if (!isBordje(s.opmaak)) return '<h3>Kleuren</h3><p class="hint">QR- en locatielabels hebben geen kleuren.</p>';
    return `<h3>Kleuren</h3>${htmlChips()}<p class="hint">Per waarde een kleur; waarden zonder kleur worden grijs.</p>`
      + htmlKleurRegel('rand') + htmlKleurRegel('label');
  }

  const BLOKKEN = { basis: htmlBasis, velden: htmlVelden, plekken: htmlPlekken, kleuren: htmlKleuren };

  /** Blokken opnieuw tekenen; de focus blijft op hetzelfde invoerveld als dat er nog is. */
  function herteken(...namen) {
    const actief = document.activeElement;
    const p = actief && wortel.contains(actief) ? actief.dataset.pad : null;
    let sel = null;
    try { if (p && typeof actief.selectionStart === 'number') sel = [actief.selectionStart, actief.selectionEnd]; } catch { /* geen tekstveld */ }
    for (const n of namen) wortel.querySelector(`[data-blok="${n}"]`).innerHTML = BLOKKEN[n]();
    if (namen.includes('kleuren')) { vulSuggesties('rand'); vulSuggesties('label'); }
    if (namen.includes('plekken') || namen.includes('kleuren')) controleerVelden();
    if (p && !wortel.contains(actief)) {
      const nieuw = pad(p);
      if (nieuw) { nieuw.focus(); try { if (sel) nieuw.setSelectionRange(...sel); } catch { /* geen tekstveld */ } }
    }
  }

  wortel.innerHTML = Object.keys(BLOKKEN).map(n => `<section class="blok" data-blok="${n}"></section>`).join('');
  herteken(...Object.keys(BLOKKEN));

  // ---------- kleurwaarden uit de artikelen ----------
  function vulSuggesties(k) {
    const lijst = $(`#ed${uid}-w-${k}`), zonder = $(`[data-zonder="${k}"]`);
    if (!lijst || !zonder) return;
    const tokens = s.kleuren[k]?.sleutel || [];
    const waarden = tokens.length && waardenVoor ? waardenVoor(tokens, bouw()) : [];
    lijst.innerHTML = waarden.map(w => `<option value="${esc(w)}"></option>`).join('');
    const bekend = new Set(rijen[k].filter(r => geldigeKleur(r.kleur)).map(r => sleutel(r.waarde)));
    const mist = waarden.filter(w => !bekend.has(sleutel(w)));
    zonder.textContent = mist.length ? `Zonder kleur (grijs): ${mist.slice(0, 12).join(' · ')}${mist.length > 12 ? ' …' : ''}` : '';
  }

  /** Waarschuwt voor {Veld} dat niet in de velden staat. */
  function controleerVelden() {
    const namen = new Set(veldNamen());
    const alle = [...plekkenVoor(s.opmaak).map(k => s.plekken[k]), ...s.plekken.eigenschappen.map(e => e.waarde), s.kleuren.rand?.sleutel, s.kleuren.label?.sleutel];
    const onbekend = [...new Set(alle.flat().filter(t => t && typeof t !== 'string' && !namen.has(t.veld)).map(t => t.veld))];
    const tekst = onbekend.length ? `Onbekend veld: ${onbekend.map(n => `{${n}}`).join(', ')}. Dat blijft leeg.` : '';
    meld('plekken', tekst);
  }

  // ---------- wijzigingen ----------
  function zetOpmaak(nieuw) {
    const oud = s.opmaak, std = STANDAARD_FORMAAT[oud];
    const wasStandaard = std && s.formaat.b === std.b && s.formaat.h === std.h;
    const andereSoort = LABELS.has(oud) !== LABELS.has(nieuw);
    s.opmaak = nieuw;
    if (andereSoort) s.printer = LABELS.has(nieuw) ? 'label' : 'a4';
    if (wasStandaard || andereSoort || oud === 'strook' || nieuw === 'strook') s.formaat = { ...STANDAARD_FORMAAT[nieuw] };
    else if ((nieuw === 'staand') === (s.formaat.b > s.formaat.h)) s.formaat = { b: s.formaat.h, h: s.formaat.b };
  }

  function hernoemVeld(oud, nieuw) {
    const vervang = (tokens) => (tokens || []).map(t => (typeof t !== 'string' && t.veld === oud ? { veld: nieuw } : t));
    for (const k of Object.keys(s.plekken)) if (k !== 'eigenschappen' && Array.isArray(s.plekken[k])) s.plekken[k] = vervang(s.plekken[k]);
    s.plekken.eigenschappen = s.plekken.eigenschappen.map(e => ({ ...e, waarde: vervang(e.waarde) }));
    for (const k of ['rand', 'label']) if (s.kleuren[k]) s.kleuren[k].sleutel = vervang(s.kleuren[k].sleutel);
    for (const v of s.velden) if (v.alleenAls === oud) v.alleenAls = nieuw;
    if (s.regelsVeld === oud) s.regelsVeld = nieuw;
    if (s.lijstVeld === oud) s.lijstVeld = nieuw;
  }

  function zetVeldExtra(v, tekst) {
    delete v.opties; delete v.eenheid;
    if (v.soort === 'keuze') v.opties = tekst.split(';').map(x => x.trim()).filter(Boolean);
    else if (v.soort === 'getal' && tekst.trim()) v.eenheid = tekst.trim();
  }

  function zetHerkomst(v, type) {
    if (type === 'kolom') v.herkomst = { type, kolom: v.herkomst?.kolom || 'naam' };
    else if (type === 'naam') v.herkomst = { type, patroon: v.herkomst?.patroon || 'lengte' };
    else v.herkomst = { type: 'aanvulling' };
  }

  function maat(el, d, melden) {
    const n = getal(el.value);
    if (!(n >= MIN_MM && n <= MAX_MM)) {
      if (melden) meld('basis', `Maat tussen ${MIN_MM} en ${MAX_MM} mm.`);
      return;
    }
    meld('basis', '');
    if (s.formaat[d] === n) return;
    s.formaat[d] = n;
    wijzig();
  }

  function kleurInvoer(k, i, wat, el, melden) {
    const r = rijen[k][i];
    if (!r) return;
    const rij = el.closest('tr');
    const zet = (hex) => {
      r.kleur = hex; r.invoer = hex;
      rij.querySelector('input[type=color]').value = hex;
      if (wat !== 'hex') rij.querySelector('.hex').value = hex;
      if (wat !== 'naam') {
        const naam = Object.keys(KLEURNAMEN).find(n => KLEURNAMEN[n] === hex);
        rij.querySelector('select').value = r.eigen ? 'eigen' : naam || 'eigen';
      }
      meld('kleur.' + k, '');
      vulSuggesties(k);
      wijzig();
    };
    if (wat === 'waarde') { r.waarde = el.value; vulSuggesties(k); wijzig(); return; }
    if (wat === 'naam') {
      if (el.value === 'eigen') { r.eigen = true; rij.querySelector('.hex').focus(); rij.querySelector('.hex').select(); return; }
      r.eigen = false;
      if (el.value) zet(KLEURNAMEN[el.value]);
      return;
    }
    if (wat === 'kiezer') { const hex = geldigeKleur(el.value); if (hex) zet(hex); return; }
    if (wat === 'hex') {
      r.invoer = el.value;
      const hex = geldigeKleur(el.value);
      if (hex) { if (hex !== r.kleur) zet(hex); else meld('kleur.' + k, ''); }
      else if (melden) meld('kleur.' + k, `"${el.value.trim()}" is geen kleurcode. Kies een kleur uit de lijst of typ een code als #ff8c00.`);
    }
  }

  luister('input', (ev) => {
    const el = ev.target, p = el.dataset.pad;
    if (!p || el.tagName === 'SELECT' || el.type === 'checkbox') return;
    const d = p.split('.');
    if (p === 'naam') {
      if (!el.value.trim()) { meld('basis', 'Geef het sjabloon een naam.'); return; }
      meld('basis', '');
      s.naam = el.value.trim();
      wijzig();
    } else if (p === 'cert') { s.cert = el.value; wijzig(); }
    else if (d[0] === 'formaat') maat(el, d[1], false);
    else if (d[0] === 'plek') { s.plekken[d[1]] = naarTokens(el.value); controleerVelden(); wijzig(); }
    else if (d[0] === 'eig') {
      const e = s.plekken.eigenschappen[+d[1]];
      if (d[2] === 'kop') e.kop = el.value; else e.waarde = naarTokens(el.value);
      controleerVelden();
      wijzig();
    } else if (d[0] === 'veld' && d[2] === 'extra') { zetVeldExtra(s.velden[+d[1]], el.value); wijzig(); }
    else if (d[0] === 'kleur' && d[2] === 'sleutel') {
      s.kleuren[d[1]] = { waarden: {}, ...(s.kleuren[d[1]] || {}), sleutel: naarTokens(el.value) };
      controleerVelden();
      vulSuggesties(d[1]);
      wijzig();
    } else if (d[0] === 'kleur') kleurInvoer(d[1], +d[2], d[3], el, false);
  });

  luister('change', (ev) => {
    const el = ev.target, p = el.dataset.pad;
    if (!p) return;
    const d = p.split('.');
    if (el.type === 'checkbox') {
      if (d[0] === 'veld') s.velden[+d[1]].verplicht = el.checked;
      else s[p] = el.checked;
      wijzig();
    } else if (p === 'opmaak') { zetOpmaak(el.value); herteken('basis', 'plekken', 'kleuren'); wijzig(); }
    else if (p === 'printer') { s.printer = el.value; wijzig(); }
    else if (p === 'regelsVeld') { s.regelsVeld = el.value; wijzig(); }
    else if (d[0] === 'formaat') maat(el, d[1], true);
    else if (d[0] === 'veld') veldWijziging(+d[1], d[2], el);
    else if (d[0] === 'kleur' && (d[3] === 'naam' || d[3] === 'hex')) kleurInvoer(d[1], +d[2], d[3], el, true);
  });

  function veldWijziging(i, wat, el) {
    const v = s.velden[i];
    if (!v) return;
    if (wat === 'naam') {
      const oud = v.naam, nieuw = el.value.trim();
      if (nieuw === oud) return;
      const fout = !nieuw ? 'Een veld heeft een naam nodig.'
        : /[{}]/.test(nieuw) ? 'Een veldnaam mag geen { of } bevatten.'
          : s.velden.some((x, j) => j !== i && x.naam === nieuw) ? `Er is al een veld "${nieuw}".` : '';
      if (fout) { meld('velden', fout); el.value = oud; return; }
      meld('velden', '');
      v.naam = nieuw;
      hernoemVeld(oud, nieuw);
      const knop = el.closest('li').querySelector('[data-actie="veld-weg"]');
      knop.setAttribute('aria-label', `Veld ${nieuw} verwijderen`);
      for (const sel of wortel.querySelectorAll('[data-pad$=".alleenAls"]')) sel.innerHTML = htmlAlleenAls(s.velden[+sel.dataset.pad.split('.')[1]]);
      herteken('plekken', 'kleuren');
      wijzig();
    } else if (wat === 'soort') {
      v.soort = el.value;
      zetVeldExtra(v, el.closest('li').querySelector('[data-pad$=".extra"]').value);
      herteken('velden');
      wijzig();
    } else if (wat === 'herkomst') { zetHerkomst(v, el.value); herteken('velden'); wijzig(); }
    else if (wat === 'bron') {
      if (v.herkomst.type === 'kolom') v.herkomst.kolom = el.value; else v.herkomst.patroon = el.value;
      wijzig();
    } else if (wat === 'alleenAls') {
      if (el.value) v.alleenAls = el.value; else delete v.alleenAls;
      wijzig();
    }
  }

  luister('focusin', (ev) => {
    const el = ev.target;
    if (el.classList?.contains('tokens')) laatstePad[el.closest('[data-blok]').dataset.blok] = el.dataset.pad;
  });

  luister('click', (ev) => {
    const knop = ev.target.closest('button[data-actie]');
    if (!knop || !wortel.contains(knop)) return;
    const a = knop.dataset.actie, i = +knop.dataset.i, k = knop.dataset.regel;
    if (a === 'invoegen') return voegIn(knop);
    if (a === 'veld-erbij') {
      let n = 1;
      while (s.velden.some(v => v.naam === (n === 1 ? 'Nieuw veld' : `Nieuw veld ${n}`))) n++;
      s.velden.push({ naam: n === 1 ? 'Nieuw veld' : `Nieuw veld ${n}`, soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false });
      herteken('velden', 'plekken', 'kleuren');
      const nieuw = pad(`veld.${s.velden.length - 1}.naam`);
      nieuw.focus(); nieuw.select();
    } else if (a === 'veld-weg') {
      const weg = s.velden[i]?.naam;
      s.velden.splice(i, 1);
      for (const v of s.velden) if (v.alleenAls === weg) delete v.alleenAls;
      if (s.regelsVeld === weg) delete s.regelsVeld;
      if (s.lijstVeld === weg) delete s.lijstVeld;
      herteken('velden', 'plekken', 'kleuren');
      $('[data-actie="veld-erbij"]').focus();
    } else if (a === 'eig-erbij') {
      s.plekken.eigenschappen.push({ kop: '', waarde: [] });
      herteken('plekken');
      pad(`eig.${s.plekken.eigenschappen.length - 1}.kop`).focus();
    } else if (a === 'eig-weg') {
      s.plekken.eigenschappen.splice(i, 1);
      herteken('plekken');
      $('[data-actie="eig-erbij"]').focus();
    } else if (a === 'kleur-erbij') {
      if (!s.kleuren[k]) s.kleuren[k] = { sleutel: [], waarden: {} };
      rijen[k].push({ waarde: '', kleur: '' });
      herteken('kleuren');
      pad(`kleur.${k}.${rijen[k].length - 1}.waarde`).focus();
      return; // nog niets te bewaren
    } else if (a === 'kleur-weg') {
      rijen[k].splice(i, 1);
      herteken('kleuren');
      $(`[data-actie="kleur-erbij"][data-regel="${k}"]`).focus();
    } else return;
    wijzig();
  });

  /** Veldblokje invoegen in de laatst gekozen plek van dit blok (of de eerste). */
  function voegIn(knop) {
    const blok = knop.closest('[data-blok]');
    const invoer = (laatstePad[blok.dataset.blok] && pad(laatstePad[blok.dataset.blok])) || blok.querySelector('input.tokens');
    if (!invoer) return;
    const tekst = `{${knop.dataset.veld}}`;
    const begin = invoer.selectionStart ?? invoer.value.length, eind = invoer.selectionEnd ?? begin;
    invoer.setRangeText(tekst, begin, eind, 'end');
    invoer.focus();
    invoer.dispatchEvent(new Event('input', { bubbles: true }));
  }

  return { sjabloon: bouw };
}
