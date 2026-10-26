// Beheer: pincode-drempel, sjablonen met editor en live voorbeeld, en de
// instellingen van het profiel. Lezen en schrijven gaat alleen via het model.

import { DSL_SJABLONEN, DSL_REGELS, vul, qrsVoor, standaardSjabloon } from './sjablonen.js';
import { PROFIEL_STANDAARD } from './standaard.js';
import { teken, pasAan } from './opmaak.js';
import { tekenEditor, STANDAARD_FORMAAT, KOLOM_NAMEN } from './editor.js';
import { RENTMAN, TOEGESTANE_VELDEN } from './import.js';
import { profielen } from './profielen.js';
import { esc } from './html.js';

const WACHT = 300;
const PX = 96 / 25.4;
const BESCHERMD = new Set(DSL_SJABLONEN.map(s => s.id));
const STANDAARD_IDS = new Set(Object.values(PROFIEL_STANDAARD).flatMap(p => p.sjablonen.map(s => s.id)));
const nlSort = new Intl.Collator('nl', { numeric: true, sensitivity: 'base' });
const VOORBEELD_ARTIKEL = {
  id: 'voorbeeld', naam: 'Voorbeeldartikel 10m', code: 'VB-0001', qr: 'voorbeeld-qr', exemplaren: [], pad: '', map: '',
  locatie: 'A-1-1', soort: 'bulk', type: '', combinatie: false, aantal: 1,
};
const ONDERDELEN = [
  { id: 'regels', titel: 'Categorie → sjabloon' },
  { id: 'huisstijl', titel: 'Huisstijl' },
  { id: 'printers', titel: 'Printers' },
  { id: 'kolommen', titel: 'Artikelen inlezen' },
  { id: 'wijzigingen', titel: 'Wijzigingen op deze pc' },
];
const PINCODE = { id: 'pincode', titel: 'Pincode' };

const ACTIES = { bordje: 'Bordje of strook', qrlabel: 'QR-label', locatie: 'Locatielabel' };
const LETTERTYPES = { futura: 'Futura', barlow: 'Barlow Condensed', arial: 'Arial', eigen: 'Eigen lettertype' };
const AFBEELDINGEN = { logo: 'Logo', certIcoon: 'Certificaat-icoon' };
const MAX_AFBEELDING = 300 * 1024;
const MAX_LETTERTYPE = 5 * 1024 * 1024;
const LABELMAAT = [10, 300];

const meervoud = (n, een, meer) => `${n} ${n === 1 ? een : meer}`;
const getal = (s) => { const t = String(s ?? '').trim().replace(',', '.'); const n = Number(t); return t && Number.isFinite(n) ? n : NaN; };
const kB = (n) => Math.ceil(n / 1024);
const opt = (waarde, tekst, gekozen) => `<option value="${esc(waarde)}"${gekozen ? ' selected' : ''}>${esc(tekst)}</option>`;
const leesBestand = (file, als) => new Promise((ok, fout) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = () => fout(r.error || new Error('Bestand niet te lezen'));
  if (als === 'url') r.readAsDataURL(file); else r.readAsArrayBuffer(file);
});
function naarBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Eigen lettertype (pc-instelling { naam, data: base64 }) als "DSL Eigen" in deze pagina zetten.
 * Geeft false als het bestand geen bruikbaar lettertype is.
 */
export async function registreerEigenLettertype(lettertype) {
  if (!lettertype?.data || typeof FontFace !== 'function') return false;
  try {
    const bytes = Uint8Array.from(atob(lettertype.data), c => c.charCodeAt(0));
    const ff = new FontFace('DSL Eigen', bytes.buffer);
    await ff.load();
    for (const f of [...document.fonts]) if (f.family.replace(/"/g, '') === 'DSL Eigen') document.fonts.delete(f);
    document.fonts.add(ff);
    return true;
  } catch {
    return false;
  }
}
const lijstTekst = (delen) => (delen.length < 2 ? delen.join('') : `${delen.slice(0, -1).join(', ')} en ${delen[delen.length - 1]}`);

/**
 * Start beheer in #beheerScherm. Geeft { stop() } terug: bewaart wat nog wacht en
 * ruimt de luisteraars op. terug() wordt aangeroepen na Terug naar werkscherm
 * (eerst wordt alles bewaard). Na elke bewaarde wijziging komt er een event
 * 'beheer-wijziging' (bubbles) met detail { soort, id } op #beheerScherm.
 */
export async function startBeheer(root, model, { profielId = model.profielId, terug = () => {}, extraOnderdelen = [] } = {}) {
  const scherm = root.getElementById('beheerScherm');
  await scherm._beheer?.stop();
  const ac = new AbortController();
  const signal = ac.signal;
  const extra = extraOnderdelen.map(o => ({ ...o, id: 'extra:' + o.id }));
  const st = {
    onderdeel: null, sjabloonId: scherm._laatsteSjabloon || null, keuze: null, werkSjabloon: null, werkHuisstijl: null,
    perLabel: new Map(), perCode: new Map(),
  };
  const profielNaam = (() => { try { return profielen().find(p => p.id === profielId)?.naam || profielId; } catch { return profielId; } })();

  // ---------- bewaren: per sleutel 300 ms wachten, daarna op volgorde ----------
  const wacht = new Map();
  let keten = Promise.resolve(), lopend = 0, gestopt = false;

  // Alleen binnen beheer zoeken: het werkscherm heeft eigen ids.
  const $ = (id) => scherm.querySelector('#' + CSS.escape(id));
  function status(tekst, fout = false) {
    const s = $('beheerStatus');
    if (!s) return;
    s.textContent = tekst;
    s.classList.toggle('fout', fout);
  }
  function melding(tekst, fout = false) {
    const m = $('beheerMelding');
    if (!m) return;
    m.textContent = tekst || '';
    m.classList.toggle('fout', fout);
    m.hidden = !tekst;
  }
  const meld = (soort, id) => scherm.dispatchEvent(new CustomEvent('beheer-wijziging', { bubbles: true, detail: { soort, id } }));

  function bewaarLater(sleutel, taak, ms = WACHT) {
    if (gestopt) return;
    clearTimeout(wacht.get(sleutel)?.timer);
    wacht.set(sleutel, { taak, timer: setTimeout(() => voerUit(sleutel), ms) });
    status('Opslaan…');
  }
  function voerUit(sleutel) {
    const item = wacht.get(sleutel);
    if (!item) return;
    clearTimeout(item.timer);
    wacht.delete(sleutel);
    lopend++;
    keten = keten.then(item.taak).then(() => {
      lopend--;
      if (!lopend && !wacht.size) status('Opgeslagen');
    }, (e) => {
      lopend--;
      status('Niet opgeslagen', true);
      melding('Opslaan mislukt: ' + (e?.message || e), true);
    });
  }
  async function bewaarNu() {
    for (const k of [...wacht.keys()]) voerUit(k);
    await keten;
  }
  /** Direct bewaren (knoppen), via dezelfde volgorde als het uitgestelde bewaren. */
  async function bewaar(taak) {
    status('Opslaan…');
    await bewaarNu();
    let fout = null;
    keten = keten.then(taak).catch(e => { fout = e; });
    await keten;
    if (fout) { status('Niet opgeslagen', true); melding('Opslaan mislukt: ' + (fout?.message || fout), true); return false; }
    if (!lopend && !wacht.size) status('Opgeslagen');
    return true;
  }

  async function stop() {
    if (gestopt) return;
    gestopt = true;
    await bewaarNu();
    clearTimeout(voorbeeldTimer);
    ac.abort();
    waarnemer?.disconnect();
  }
  const api = { stop };
  scherm._beheer = api;

  // ---------- pincode ----------
  const pin = await model.pcInstelling('pincode').catch(() => undefined);
  const kop = `<div class="beheer-kop">`
    + `<button type="button" id="beheerTerug"><span aria-hidden="true">←</span> Terug naar werkscherm</button>`
    + `<h1>Beheer</h1><span class="beheer-profiel">${esc(profielNaam)}</span>`
    + `<span id="beheerStatus" class="beheer-status" role="status" aria-live="polite"></span></div>`
    + `<p id="beheerMelding" class="melding" role="status" hidden></p>`;
  scherm.classList.add('beheer');

  let opWegTerug = false;
  scherm.addEventListener('click', async (ev) => {
    if (!ev.target.closest('#beheerTerug') || opWegTerug) return;
    opWegTerug = true;
    try { await bewaarNu(); terug(); } finally { opWegTerug = false; }
  }, { signal });

  // ---------- indeling ----------
  let form, menu, waarnemer;
  function tekenBeheer() {
    scherm.innerHTML = kop + '<div class="beheer-romp">'
      + '<nav id="beheerMenu" class="kolom beheer-menu" aria-label="Onderdelen van beheer"></nav>'
      + '<section id="beheerForm" class="kolom beheer-form" aria-labelledby="beheerTitel"></section>'
      + '<aside id="beheerVoorbeeld" class="kolom beheer-voorbeeld" aria-labelledby="kopBeheerVoorbeeld">'
      + '<div class="kop"><h2 id="kopBeheerVoorbeeld">Voorbeeld</h2><span id="beheerVoorbeeldSjabloon" class="hint"></span></div>'
      + '<label class="veld"><span>Artikel</span><input type="text" id="beheerArtikel" list="beheerArtikelen" autocomplete="off" placeholder="Zoek op naam of code"></label>'
      + '<datalist id="beheerArtikelen"></datalist>'
      + '<p id="beheerVoorbeeldInfo" class="hint"></p><div id="beheerVoorbeeldDoel" class="voorbeeld-doel"></div></aside>'
      + '</div><dialog id="beheerVraag" class="beheer-vraag"></dialog>';
    form = $('beheerForm');
    menu = $('beheerMenu');
    menu.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-onderdeel]'); if (b) open(b.dataset.onderdeel); }, { signal });
    menu.addEventListener('keydown', menuToetsen, { signal });
    form.addEventListener('click', formKlik, { signal });
    form.addEventListener('input', formInvoer, { signal });
    form.addEventListener('change', formInvoer, { signal });
    const kies = $('beheerArtikel');
    kies.addEventListener('input', () => kiesArtikel(false), { signal });
    kies.addEventListener('change', () => kiesArtikel(true), { signal });
    kies.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); kiesArtikel(true); } }, { signal });
    if (typeof ResizeObserver === 'function') {
      let breedte = 0;
      waarnemer = new ResizeObserver(([e]) => { if (Math.abs(e.contentRect.width - breedte) > 2) { breedte = e.contentRect.width; voorbeeldLater(80); } });
      waarnemer.observe($('beheerVoorbeeldDoel'));
    }
    vulArtikelLijst();
    const eerste = scherm._laatsteOnderdeel && (scherm._laatsteOnderdeel !== 'nieuw') ? scherm._laatsteOnderdeel : 'sjabloon:' + (eersteSjabloon()?.id || '');
    open(eerste);
  }

  const sjablonen = () => model.effectief().sjablonen;
  const sjabloonVan = (id) => sjablonen().find(s => s.id === id);
  const eersteSjabloon = () => sjablonen()[0];
  const sjabloonWijziging = (id) => model.wijzigingen().find(w => w.soort === 'sjabloon' && w.id === id);

  function tekenMenu() {
    const actief = document.activeElement?.closest?.('#beheerMenu') ? document.activeElement.dataset.onderdeel : null;
    const gewijzigd = new Set(model.wijzigingen().filter(w => w.soort === 'sjabloon').map(w => w.id));
    const knop = (id, inhoud, klasse = '') => `<li><button type="button" data-onderdeel="${esc(id)}"${klasse ? ` class="${klasse}"` : ''}`
      + `${st.onderdeel === id ? ' aria-current="page"' : ''}>${inhoud}</button></li>`;
    menu.innerHTML = '<h2 class="menukop" id="beheerMenuSjablonen">Sjablonen</h2><ul aria-labelledby="beheerMenuSjablonen">'
      + sjablonen().map(s => knop('sjabloon:' + s.id, `<span class="nm">${esc(s.naam || s.id)}</span>`
        + (gewijzigd.has(s.id) ? '<span class="gewijzigd" title="Gewijzigd op deze pc"><span class="bh-sr">, gewijzigd op deze pc</span></span>' : ''))).join('')
      + knop('nieuw', '<span aria-hidden="true">+ </span>Nieuw sjabloon', 'nieuw')
      + '</ul><h2 class="menukop" id="beheerMenuInstellingen">Instellingen</h2><ul aria-labelledby="beheerMenuInstellingen">'
      + [...ONDERDELEN, ...extra, PINCODE].map(o => knop(o.id, esc(o.titel))).join('')
      + '</ul>';
    if (actief) menu.querySelector(`[data-onderdeel="${CSS.escape(actief)}"]`)?.focus();
  }

  function menuToetsen(ev) {
    const knoppen = [...menu.querySelectorAll('button[data-onderdeel]')];
    const i = knoppen.indexOf(document.activeElement);
    if (i < 0) return;
    const j = { ArrowDown: Math.min(knoppen.length - 1, i + 1), ArrowUp: Math.max(0, i - 1), Home: 0, End: knoppen.length - 1 }[ev.key];
    if (j === undefined) return;
    ev.preventDefault();
    knoppen[j].focus();
  }

  function formKop(titel, knoppen = '') {
    return `<div class="formkop"><h2 id="beheerTitel">${esc(titel)}</h2>${knoppen ? `<div class="knoppen">${knoppen}</div>` : ''}</div>`;
  }

  let openBeurt = 0;
  async function open(id) {
    const beurt = ++openBeurt;
    await bewaarNu();
    if (beurt !== openBeurt || gestopt) return;
    st.werkHuisstijl = null;
    melding('');
    if (id === 'nieuw') return nieuwSjabloon();
    const bekend = [...ONDERDELEN, ...extra, PINCODE].some(o => o.id === id) || (id.startsWith('sjabloon:') && sjabloonVan(id.slice(9)));
    if (!bekend) id = 'sjabloon:' + (eersteSjabloon()?.id || '');
    st.onderdeel = id;
    scherm._laatsteOnderdeel = id;
    form.dataset.onderdeel = id;
    tekenMenu();
    form.scrollTop = 0;
    if (id.startsWith('sjabloon:')) tekenSjabloon(id.slice(9));
    else if (id === 'pincode') await tekenPincode();
    else if (id === 'regels') tekenRegels();
    else if (id === 'huisstijl') await tekenHuisstijl();
    else if (id === 'printers') tekenPrinters();
    else if (id === 'kolommen') tekenKolommen();
    else if (id === 'wijzigingen') tekenWijzigingen();
    else if (id.startsWith('extra:')) await tekenExtra(extra.find(o => o.id === id));
    else form.innerHTML = formKop(ONDERDELEN.find(o => o.id === id)?.titel || id) + '<p class="hint">Volgt.</p>';
    voorbeeldLater(0);
  }

  const zetMelding = (soort, tekst) => { const m = form.querySelector(`[data-melding="${soort}"]`); if (m) m.textContent = tekst || ''; };

  // ---------- categorie → sjabloon ----------
  function tekenRegels() {
    const r = model.effectief().regels || DSL_REGELS;
    st.regels = {
      bordje: (r.bordje || []).map(x => ({ pad: x.pad || '', naam: x.naam || '', sjabloon: x.sjabloon || '' })),
      standaard: { ...DSL_REGELS.standaard, ...(r.standaard || {}) },
    };
    form.innerHTML = formKop('Categorie → sjabloon')
      + '<p class="hint">Bij <b>Bordje of strook</b> geldt de eerste regel die past. Hoofdletters maken niet uit; staan pad en naam er allebei, dan moeten ze allebei passen. Losse items houden hun eigen sjabloon.</p>'
      + '<table class="regeltabel"><thead><tr><th scope="col">Pad bevat</th><th scope="col">Naam bevat</th><th scope="col">Sjabloon</th>'
      + '<th scope="col"><span class="bh-sr">Volgorde en verwijderen</span></th></tr></thead><tbody></tbody></table>'
      + '<div class="acties links"><button type="button" data-beheer="regel-erbij">Regel toevoegen</button></div>'
      + '<p class="fout" data-melding="regels" role="status"></p>'
      + '<h3>Standaard per knop</h3><div class="raster">'
      + Object.entries(ACTIES).map(([a, titel]) => `<label class="veld"><span>${esc(titel)}</span><select data-standaard="${a}">${sjabloonOpties(st.regels.standaard[a], a === 'bordje' ? null : a)}</select></label>`).join('')
      + '</div>';
    tekenRegelRijen();
  }

  function sjabloonOpties(gekozen, opmaak = null) {
    const lijst = sjablonen().filter(s => !opmaak || s.opmaak === opmaak || s.id === gekozen);
    const onbekend = gekozen && !lijst.some(s => s.id === gekozen) ? opt(gekozen, `(onbekend: ${gekozen})`, true) : '';
    return (gekozen ? '' : opt('', 'Kies…', true)) + onbekend + lijst.map(s => opt(s.id, s.naam || s.id, s.id === gekozen)).join('');
  }

  function tekenRegelRijen(focus = null) {
    const rijen = st.regels.bordje;
    form.querySelector('.regeltabel tbody').innerHTML = rijen.map((r, i) => `<tr class="regelrij" data-i="${i}">`
      + `<td><input type="text" data-veld="pad" value="${esc(r.pad)}" aria-label="Regel ${i + 1}: pad bevat" autocomplete="off"></td>`
      + `<td><input type="text" data-veld="naam" value="${esc(r.naam)}" aria-label="Regel ${i + 1}: naam bevat" autocomplete="off"></td>`
      + `<td><select data-veld="sjabloon" aria-label="Regel ${i + 1}: sjabloon">${sjabloonOpties(r.sjabloon)}</select></td>`
      + `<td class="regelknoppen"><button type="button" class="klein" data-beheer="regel-op" data-i="${i}" aria-label="Regel ${i + 1} omhoog" title="Omhoog"${i ? '' : ' disabled'}>↑</button>`
      + `<button type="button" class="klein" data-beheer="regel-neer" data-i="${i}" aria-label="Regel ${i + 1} omlaag" title="Omlaag"${i < rijen.length - 1 ? '' : ' disabled'}>↓</button>`
      + `<button type="button" class="klein weg" data-beheer="regel-weg" data-i="${i}" aria-label="Regel ${i + 1} verwijderen" title="Verwijderen">×</button></td></tr>`).join('');
    if (focus) form.querySelector(focus)?.focus();
    controleerRegels();
  }

  function controleerRegels() {
    const los = st.regels.bordje.map((r, i) => (!r.pad.trim() && !r.naam.trim()) || !r.sjabloon ? i + 1 : 0).filter(Boolean);
    zetMelding('regels', los.length ? `${los.length === 1 ? 'Regel' : 'Regels'} ${lijstTekst(los.map(String))} ${los.length === 1 ? 'telt' : 'tellen'} niet mee: vul pad of naam in en kies een sjabloon.` : '');
  }

  function bewaarRegels() {
    controleerRegels();
    const regels = {
      ...model.effectief().regels,
      bordje: st.regels.bordje.filter(r => (r.pad.trim() || r.naam.trim()) && r.sjabloon).map(r => ({
        ...(r.pad.trim() ? { pad: r.pad.trim() } : {}), ...(r.naam.trim() ? { naam: r.naam.trim() } : {}), sjabloon: r.sjabloon,
      })),
      standaard: { ...st.regels.standaard },
    };
    bewaarLater('instelling:regels', async () => { await model.zetInstelling('regels', regels); meld('instelling', 'regels'); });
    voorbeeldLater();
  }

  function regelKlik(actie, i) {
    const rijen = st.regels.bordje;
    if (actie === 'regel-erbij') {
      rijen.push({ pad: '', naam: '', sjabloon: '' });
      tekenRegelRijen(`tr.regelrij[data-i="${rijen.length - 1}"] [data-veld="pad"]`);
    } else if (actie === 'regel-weg') {
      rijen.splice(i, 1);
      tekenRegelRijen(rijen.length ? `tr.regelrij[data-i="${Math.min(i, rijen.length - 1)}"] [data-beheer="regel-weg"]` : '[data-beheer="regel-erbij"]');
    } else {
      const j = actie === 'regel-op' ? i - 1 : i + 1;
      if (j < 0 || j >= rijen.length) return;
      [rijen[i], rijen[j]] = [rijen[j], rijen[i]];
      const knop = (j === 0 && actie === 'regel-op') || (j === rijen.length - 1 && actie === 'regel-neer') ? (actie === 'regel-op' ? 'regel-neer' : 'regel-op') : actie;
      tekenRegelRijen(`tr.regelrij[data-i="${j}"] [data-beheer="${knop}"]`);
    }
    bewaarRegels();
  }

  function regelInvoer(el, soort) {
    const rij = el.closest('tr.regelrij');
    if (rij && el.dataset.veld) st.regels.bordje[+rij.dataset.i][el.dataset.veld] = el.value;
    else if (el.dataset.standaard && soort === 'change') st.regels.standaard[el.dataset.standaard] = el.value;
    else return;
    bewaarRegels();
  }

  // ---------- huisstijl ----------
  async function tekenHuisstijl(focus = null) {
    const hs = st.werkHuisstijl || { ...model.effectief().huisstijl };
    st.werkHuisstijl = hs;
    const lt = await model.pcInstelling('eigenLettertype').catch(() => undefined);
    const afbeelding = (k) => {
      const titel = AFBEELDINGEN[k], src = hs[k];
      return `<div class="upload"><h3>${titel}</h3><div class="upload-rij">`
        + `<div class="miniatuur">${src ? `<img data-voor="${k}" alt="${titel}" src="${esc(src)}">` : '<span class="hint">Geen</span>'}</div>`
        + `<button type="button" data-beheer="kies" data-voor="${k}">${titel} kiezen…</button>`
        + (src ? `<button type="button" data-beheer="weg" data-voor="${k}">${titel} weghalen</button>` : '')
        + `<input type="file" id="beheer-${k}-bestand" data-bestand="${k}" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></div>`
        + `<p class="hint">PNG, JPG, SVG of WebP, hoogstens 300 kB.</p><p class="fout" data-melding="${k}" role="alert"></p></div>`;
    };
    form.innerHTML = formKop('Huisstijl')
      + '<label class="veld"><span>Voettekst <small>één regel per regel; | wordt een scheidingsstreepje</small></span>'
      + `<textarea data-huisstijl="voet" rows="3" spellcheck="false">${esc((hs.voet || []).join('\n'))}</textarea></label>`
      + afbeelding('logo') + afbeelding('certIcoon')
      + '<fieldset class="keuzes"><legend>Lettertype</legend>'
      + Object.entries(LETTERTYPES).map(([k, t]) => `<label class="vink"><input type="radio" name="lettertype" value="${k}"${(hs.lettertype || 'futura') === k ? ' checked' : ''}> ${t}</label>`).join('')
      + '</fieldset>'
      + '<div class="upload"><h3>Eigen lettertype</h3>'
      + '<p class="hint">Alleen op deze pc. Wordt niet gepubliceerd (licentie van het lettertype).</p>'
      + `<p>${lt ? `Op deze pc: <b>${esc(lt.naam)}</b>` : 'Op deze pc staat geen eigen lettertype.'}</p>`
      + '<div class="upload-rij"><button type="button" data-beheer="kies" data-voor="font">Lettertype kiezen…</button>'
      + (lt ? '<button type="button" data-beheer="weg" data-voor="font">Lettertype weghalen</button>' : '')
      + '<input type="file" id="beheer-font-bestand" data-bestand="font" accept=".ttf,.otf,.woff,.woff2" hidden></div>'
      + '<p class="hint">TTF, OTF, WOFF of WOFF2.</p><p class="fout" data-melding="font" role="alert"></p></div>';
    if (focus) form.querySelector(focus)?.focus();
  }

  function bewaarHuisstijl() {
    const hs = { ...st.werkHuisstijl };
    bewaarLater('instelling:huisstijl', async () => { await model.zetInstelling('huisstijl', hs); meld('instelling', 'huisstijl'); });
    voorbeeldLater();
  }

  async function laadAfbeelding(k, file) {
    const titel = AFBEELDINGEN[k];
    if (!/^image\/(png|jpeg|svg\+xml|webp|gif)$/.test(file.type)) { zetMelding(k, 'Kies een afbeelding: PNG, JPG, SVG of WebP.'); return; }
    if (file.size > MAX_AFBEELDING) {
      zetMelding(k, `${titel} is ${kB(file.size)} kB; dat mag hoogstens 300 kB zijn. Maak het bestand kleiner en kies het opnieuw.`);
      return;
    }
    let url;
    try { url = await leesBestand(file, 'url'); } catch (e) { zetMelding(k, 'Kon het bestand niet lezen: ' + (e?.message || e)); return; }
    st.werkHuisstijl = { ...st.werkHuisstijl, [k]: url };
    bewaarHuisstijl();
    await tekenHuisstijl(`[data-beheer="kies"][data-voor="${k}"]`);
  }

  async function laadLettertype(file) {
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) { zetMelding('font', 'Kies een lettertype: TTF, OTF, WOFF of WOFF2.'); return; }
    if (file.size > MAX_LETTERTYPE) { zetMelding('font', `Dit lettertype is ${kB(file.size)} kB; hoogstens 5 MB.`); return; }
    let lt;
    try { lt = { naam: file.name, data: naarBase64(await leesBestand(file, 'buffer')) }; }
    catch (e) { zetMelding('font', 'Kon het bestand niet lezen: ' + (e?.message || e)); return; }
    if (!(await registreerEigenLettertype(lt))) { zetMelding('font', `Kan "${file.name}" niet lezen als lettertype. Kies een ander bestand.`); return; }
    if (!(await bewaar(() => model.zetPcInstelling('eigenLettertype', lt)))) return;
    meld('pc', 'eigenLettertype');
    await tekenHuisstijl('[data-beheer="kies"][data-voor="font"]');
    voorbeeldLater(0);
  }

  async function huisstijlKlik(knop) {
    const k = knop.dataset.voor;
    if (knop.dataset.beheer === 'kies') { form.querySelector(`[data-bestand="${k}"]`)?.click(); return; }
    if (k === 'font') {
      if (!(await bewaar(() => model.zetPcInstelling('eigenLettertype', null)))) return;
      for (const f of [...document.fonts]) if (f.family.replace(/"/g, '') === 'DSL Eigen') document.fonts.delete(f);
      meld('pc', 'eigenLettertype');
      await tekenHuisstijl('[data-beheer="kies"][data-voor="font"]');
      return;
    }
    st.werkHuisstijl = { ...st.werkHuisstijl, [k]: null };
    bewaarHuisstijl();
    await tekenHuisstijl(`[data-beheer="kies"][data-voor="${k}"]`);
  }

  function huisstijlInvoer(el, soort) {
    if (el.type === 'file') {
      const file = el.files?.[0];
      if (soort !== 'change' || !file) return;
      el.value = '';
      zetMelding(el.dataset.bestand, '');
      if (el.dataset.bestand === 'font') laadLettertype(file); else laadAfbeelding(el.dataset.bestand, file);
    } else if (el.dataset.huisstijl === 'voet') {
      st.werkHuisstijl = { ...st.werkHuisstijl, voet: el.value.split(/\r?\n/).map(r => r.trim()).filter(Boolean) };
      bewaarHuisstijl();
    } else if (el.name === 'lettertype' && soort === 'change') {
      st.werkHuisstijl = { ...st.werkHuisstijl, lettertype: el.value };
      bewaarHuisstijl();
    }
  }

  // ---------- wijzigingen op deze pc ----------
  const SOORT_NAAM = { sjabloon: 'Sjabloon', instelling: 'Instelling', aanvulling: 'Aanvulling', artikelen: 'Artikellijst', los: 'Los item' };

  function tekenWijzigingen(focusIndex = null) {
    const lijst = model.wijzigingen();
    st.wijzigingen = lijst;
    const e = model.effectief();
    const namen = new Map([...e.artikelen, ...e.losseItems].map(a => [String(sleutelVan(a)), a.naam]));
    const datum = e.basisDatum ? new Date(e.basisDatum) : null;
    const basis = datum && !Number.isNaN(+datum)
      ? `Basis van ${datum.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).replace('.', '')} geladen.`
      : 'Op deze pc is nog geen gepubliceerde basis geladen.';
    form.innerHTML = formKop('Wijzigingen op deze pc')
      + `<p class="hint">${esc(basis)} Wat hier staat wijkt op deze pc af van de basis. Publiceer het om het voor iedereen te bewaren, of gooi het weg om terug te gaan naar de basis.</p>`
      + (lijst.length
        ? '<ul class="wijzigingen">' + lijst.map((w, i) => {
          const sub = w.soort === 'aanvulling' ? [namen.get(String(w.id)), w.id].filter(Boolean).join(' · ') : '';
          return `<li class="wijziging"><span class="soort">${SOORT_NAAM[w.soort] || esc(w.soort)}</span>`
            + `<span class="wtekst"><span class="nm">${esc(w.omschrijving)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>`
            + `<button type="button" data-beheer="weggooien" data-i="${i}" aria-label="Weggooien: ${esc(w.omschrijving)}${sub ? ` (${esc(sub)})` : ''}">Weggooien</button></li>`;
        }).join('') + '</ul>'
        : '<p class="leeg">Geen wijzigingen op deze pc.</p>');
    if (focusIndex !== null) {
      const knoppen = form.querySelectorAll('[data-beheer="weggooien"]');
      (knoppen[Math.min(focusIndex, knoppen.length - 1)] || menu.querySelector('[aria-current="page"]'))?.focus();
    }
  }

  async function gooiWeg(i) {
    await bewaarNu();
    const w = st.wijzigingen?.[i];
    if (!w) return;
    let g = null;
    if (w.soort === 'sjabloon') {
      const sj = sjabloonVan(w.id);
      const onderlaag = STANDAARD_IDS.has(w.id) || (model.basis()?.sjablonen || []).some(s => s.id === w.id);
      if (sj && !onderlaag) g = await gebruik(w.id);
      const regels = g
        ? [`Dit sjabloon staat alleen op deze pc en verdwijnt helemaal.`, ...(gevolgen(g).length ? [`Dit haalt ook weg: ${lijstTekst(gevolgen(g))}.`] : [])]
        : [sj ? 'Je wijzigingen aan dit sjabloon op deze pc gaan verloren.' : 'Het sjabloon komt terug zoals in de basis.'];
      if (!(await vraag(`${w.omschrijving}: weggooien?`, regels, 'Weggooien'))) return;
    } else if (w.soort === 'artikelen') {
      const regels = [model.basis()?.artikelen?.length
        ? 'Deze pc gebruikt daarna weer de artikelen uit de basis.'
        : 'Er is geen basis met artikelen: daarna staan er op deze pc geen artikelen meer, tot je opnieuw inleest.'];
      if (!(await vraag('Artikellijst van deze pc weggooien?', regels, 'Weggooien'))) return;
    }
    const gelukt = await bewaar(async () => {
      if (g) await ruimOp(w.id, g);
      await model.gooiWeg(w);
    });
    if (!gelukt) return;
    meld('weggegooid', w.id);
    if (w.soort === 'artikelen' || w.soort === 'los') vulArtikelLijst();
    tekenMenu();
    tekenWijzigingen(i);
    const extraTekst = g && gevolgen(g).length ? ` ${lijstTekst(gevolgen(g))} weggehaald.` : '';
    melding(`Weggegooid: ${w.omschrijving}.${extraTekst}`);
    voorbeeldLater(0);
  }

  // ---------- printers ----------
  function tekenPrinters() {
    const p = model.effectief().printers;
    const veld = (pad, titel, waarde, extra = '') => `<label class="veld"><span>${titel}</span><input type="${extra ? 'number' : 'text'}" data-printer="${pad}" value="${esc(waarde)}"${extra} autocomplete="off"></label>`;
    const maat = ` min="${LABELMAAT[0]}" max="${LABELMAAT[1]}" step="any"`;
    form.innerHTML = formKop('Printers')
      + '<h3>Labelprinter</h3><div class="raster">' + veld('label.naam', 'Naam', p.label?.naam || '')
      + veld('label.b', 'Breedte in mm', p.label?.b ?? '', maat) + veld('label.h', 'Hoogte in mm', p.label?.h ?? '', maat) + '</div>'
      + '<h3>A4-printer</h3><div class="raster">' + veld('a4.naam', 'Naam', p.a4?.naam || '') + '</div>'
      + '<p class="hint">De naam komt in de melding vóór het printen (<i>Kies printer: …</i>). De labelmaat bepaalt het papierformaat op de labelprinter.</p>'
      + '<p class="fout" data-melding="printers" role="alert"></p>';
  }

  function printerInvoer(el, soort) {
    if (!el.dataset.printer) return;
    const lees = (k) => form.querySelector(`[data-printer="${k}"]`).value;
    const e = model.effectief().printers || {};
    const p = {
      ...e,
      label: { ...(e.label || {}), naam: lees('label.naam').trim(), b: getal(lees('label.b')), h: getal(lees('label.h')) },
      a4: { ...(e.a4 || {}), naam: lees('a4.naam').trim() },
    };
    const goed = (n) => n >= LABELMAAT[0] && n <= LABELMAAT[1];
    const fout = !p.label.naam || !p.a4.naam ? 'Geef beide printers een naam.'
      : !goed(p.label.b) || !goed(p.label.h) ? `De labelmaat moet tussen ${LABELMAAT[0]} en ${LABELMAAT[1]} mm liggen.` : '';
    if (fout) { if (soort === 'change') zetMelding('printers', fout); return; }
    zetMelding('printers', '');
    bewaarLater('instelling:printers', async () => { await model.zetInstelling('printers', p); meld('instelling', 'printers'); });
  }

  // ---------- artikelen inlezen ----------
  const isRentman = (k) => TOEGESTANE_VELDEN.every(v => (k?.[v] || '') === (RENTMAN[v] || ''));

  function tekenKolommen(eigen = null) {
    const k = model.effectief().kolommen || RENTMAN;
    const rentman = eigen === null ? isRentman(k) : !eigen;
    const waarden = rentman ? RENTMAN : (eigen === true && isRentman(k) ? { ...RENTMAN } : k);
    form.innerHTML = formKop('Artikelen inlezen')
      + '<p class="hint">Welke kolom uit je export bij welk veld hoort. Prijzen, interne opmerkingen en alle andere kolommen worden nooit ingelezen. Inlezen doe je in het werkscherm met <b>Artikelen inlezen</b>.</p>'
      + '<fieldset class="keuzes"><legend>Kolomnamen</legend>'
      + `<label class="vink"><input type="radio" name="kolomSoort" value="rentman"${rentman ? ' checked' : ''}> Rentman-export (voorinstelling)</label>`
      + `<label class="vink"><input type="radio" name="kolomSoort" value="eigen"${rentman ? '' : ' checked'}> Eigen kolomnamen</label></fieldset>`
      + '<div class="raster kolommen">' + TOEGESTANE_VELDEN.map(v => `<label class="veld"><span>${esc(KOLOM_NAMEN[v] || v)}${v === 'naam' || v === 'code' ? ' <small>nodig</small>' : ''}</span>`
        + `<input type="text" data-kolom="${v}" value="${esc(waarden[v] || '')}"${rentman ? ' disabled' : ''} autocomplete="off" spellcheck="false"></label>`).join('') + '</div>'
      + '<p class="fout" data-melding="kolommen" role="alert"></p>';
  }

  function kolomInvoer(el, soort) {
    if (el.name === 'kolomSoort') {
      if (soort !== 'change') return;
      const eigen = el.value === 'eigen';
      tekenKolommen(eigen);
      form.querySelector(`input[name="kolomSoort"][value="${el.value}"]`)?.focus();
      if (!eigen) bewaarLater('instelling:kolommen', async () => { await model.zetInstelling('kolommen', { ...RENTMAN }); meld('instelling', 'kolommen'); });
      return;
    }
    if (el.dataset.kolom) bewaarKolommen(soort === 'change');
  }

  function bewaarKolommen(melden) {
    const k = {};
    for (const v of TOEGESTANE_VELDEN) {
      const w = form.querySelector(`[data-kolom="${v}"]`)?.value.trim();
      if (w) k[v] = w;
    }
    if (!k.naam || !k.code) { if (melden) zetMelding('kolommen', 'Naam en Artikelnummer zijn nodig om te kunnen inlezen.'); return; }
    zetMelding('kolommen', '');
    bewaarLater('instelling:kolommen', async () => { await model.zetInstelling('kolommen', k); meld('instelling', 'kolommen'); });
  }

  async function tekenExtra(o) {
    form.innerHTML = formKop(o.titel) + '<div class="extra-inhoud"></div>';
    try { await o.teken(form.querySelector('.extra-inhoud')); }
    catch (e) { melding(`${o.titel}: ${e?.message || e}`, true); }
  }

  // ---------- sjablonen ----------
  function tekenSjabloon(id) {
    const sj = sjabloonVan(id);
    if (!sj) { form.innerHTML = formKop('Sjablonen') + '<p class="leeg">Er zijn geen sjablonen. Klik op <b>Nieuw sjabloon</b>.</p>'; return; }
    if (st.sjabloonId !== id) { st.keuze = null; $('beheerArtikel').value = ''; }
    st.sjabloonId = id;
    scherm._laatsteSjabloon = id;
    st.werkSjabloon = sj;
    form.innerHTML = formKop(sj.naam || sj.id, sjabloonKnoppen(id)) + (BESCHERMD.has(id)
      ? '<p class="hint">Standaardsjabloon: niet te verwijderen. <b>Terugzetten</b> haalt je wijzigingen op deze pc weg.</p>' : '')
      + '<div class="editor-plek"></div>';
    tekenEditor(form.querySelector('.editor-plek'), sj, {
      opWijziging: (s) => {
        st.werkSjabloon = s;
        $('beheerTitel').textContent = s.naam || s.id;
        bewaarLater('sjabloon:' + s.id, async () => { await model.zetSjabloon(s); tekenMenu(); werkKnoppenBij(); meld('sjabloon', s.id); });
        voorbeeldLater();
      },
      waardenVoor,
      signal,
    });
  }

  function sjabloonKnoppen(id) {
    const onderlaag = BESCHERMD.has(id) || STANDAARD_IDS.has(id) || (model.basis()?.sjablonen || []).some(s => s.id === id);
    return '<button type="button" data-beheer="dupliceren">Dupliceren</button>'
      + (onderlaag ? `<button type="button" data-beheer="terugzetten"${sjabloonWijziging(id) ? '' : ' disabled'}>Terugzetten</button>` : '')
      + (BESCHERMD.has(id) ? '' : '<button type="button" data-beheer="verwijderen" class="gevaar">Verwijderen</button>');
  }

  function werkKnoppenBij() {
    const k = form.querySelector('[data-beheer="terugzetten"]');
    if (k && st.onderdeel === 'sjabloon:' + st.sjabloonId) k.disabled = !sjabloonWijziging(st.sjabloonId);
  }

  function uniekeId(basis) {
    const bezet = new Set([...sjablonen().map(s => s.id), ...(model.basis()?.sjablonen || []).map(s => s.id), ...STANDAARD_IDS]);
    let id = basis, n = 2;
    while (bezet.has(id)) id = `${basis}-${n++}`;
    return id;
  }

  async function nieuwSjabloon() {
    const s = {
      id: uniekeId('sjabloon'), naam: 'Nieuw sjabloon', printer: 'a4', opmaak: 'staand', formaat: { ...STANDAARD_FORMAAT.staand },
      gat: true, voet: true, logoBoven: false, cert: '', kleuren: {},
      velden: [
        { naam: 'Naam', soort: 'tekst', herkomst: { type: 'kolom', kolom: 'naam' }, verplicht: true },
        { naam: 'Code', soort: 'tekst', herkomst: { type: 'kolom', kolom: 'code' }, verplicht: false },
      ],
      plekken: { titel: [{ veld: 'Naam' }], groot: [], label: [], eigenschappen: [], onder: [{ veld: 'Code' }] },
    };
    if (!(await bewaar(() => model.zetSjabloon(s)))) return;
    meld('sjabloon', s.id);
    await open('sjabloon:' + s.id);
    const naam = form.querySelector('[data-pad="naam"]');
    naam?.focus();
    naam?.select();
  }

  async function dupliceer() {
    await bewaarNu();
    const bron = st.werkSjabloon || sjabloonVan(st.sjabloonId);
    if (!bron) return;
    const kopie = { ...structuredClone(bron), id: uniekeId(bron.id + '-kopie'), naam: `${bron.naam || bron.id} (kopie)` };
    if (!(await bewaar(() => model.zetSjabloon(kopie)))) return;
    meld('sjabloon', kopie.id);
    await open('sjabloon:' + kopie.id);
    melding(`Kopie gemaakt: ${kopie.naam}.`);
  }

  async function zetTerug(id) {
    await bewaarNu();
    const w = sjabloonWijziging(id);
    if (!w) return;
    const naam = sjabloonVan(id)?.naam || id;
    if (!(await vraag(`"${naam}" terugzetten?`, ['Je wijzigingen aan dit sjabloon op deze pc gaan verloren.'], 'Terugzetten'))) return;
    if (!(await bewaar(() => model.gooiWeg(w)))) return;
    meld('sjabloon', id);
    await open('sjabloon:' + id);
    melding(`"${sjabloonVan(id)?.naam || naam}" teruggezet.`);
  }

  /** Waar het sjabloon nog gebruikt wordt: printvellen, categorie-regels, standaard per actie. */
  async function gebruik(id) {
    const vel = { label: await model.printvel('label'), a4: await model.printvel('a4') };
    const regels = model.effectief().regels;
    return {
      vel, regels,
      nVel: vel.label.filter(i => i.sjabloon === id).length + vel.a4.filter(i => i.sjabloon === id).length,
      nRegels: (regels.bordje || []).filter(r => r.sjabloon === id).length,
      standaard: Object.keys(ACTIES).filter(a => regels.standaard?.[a] === id),
    };
  }
  const gevolgen = (g) => [
    ...(g.nVel ? [`${meervoud(g.nVel, 'regel', 'regels')} van het printvel`] : []),
    ...(g.nRegels ? [meervoud(g.nRegels, 'categorie-regel', 'categorie-regels')] : []),
    ...g.standaard.map(a => `de standaard voor ${ACTIES[a]}`),
  ];

  /** Printvelregels en categorie-regels van een verdwenen sjabloon weghalen; standaard valt terug. */
  async function ruimOp(id, g) {
    for (const p of ['label', 'a4']) {
      const rest = g.vel[p].filter(i => i.sjabloon !== id);
      if (rest.length !== g.vel[p].length) await model.zetPrintvel(p, rest);
    }
    if (g.nRegels || g.standaard.length) {
      const standaard = { ...g.regels.standaard };
      for (const a of g.standaard) standaard[a] = DSL_REGELS.standaard[a];
      await model.zetInstelling('regels', { ...g.regels, bordje: (g.regels.bordje || []).filter(r => r.sjabloon !== id), standaard });
    }
  }

  async function verwijder(id) {
    await bewaarNu();
    const sj = sjabloonVan(id);
    if (!sj || BESCHERMD.has(id)) return;
    const g = await gebruik(id);
    const delen = gevolgen(g);
    const ok = await vraag(`Sjabloon "${sj.naam || id}" verwijderen?`,
      [delen.length ? `Dit haalt ook weg: ${lijstTekst(delen)}.` : 'Het staat niet op het printvel en in geen categorie-regel.'], 'Verwijderen');
    if (!ok) return;
    const gelukt = await bewaar(async () => {
      await ruimOp(id, g);
      const w = sjabloonWijziging(id);
      if (w) await model.gooiWeg(w);
      if (sjabloonVan(id)) await model.verwijderSjabloon(id);
    });
    if (!gelukt) return;
    meld('sjabloon', id);
    if (g.nVel) meld('printvel', id);
    if (g.nRegels || g.standaard.length) meld('instelling', 'regels');
    st.sjabloonId = null;
    scherm._laatsteSjabloon = null;
    await open('sjabloon:' + (eersteSjabloon()?.id || ''));
    menu.querySelector('[aria-current="page"]')?.focus();
    melding(`Sjabloon "${sj.naam || id}" verwijderd` + (delen.length ? `; ${lijstTekst(delen)} weggehaald.` : '.'));
  }

  /** Bevestigen in een dialoog; Annuleren staat voorop (Esc = annuleren). */
  function vraag(titel, regels, ja) {
    const dlg = $('beheerVraag');
    const terugFocus = document.activeElement;
    dlg.innerHTML = `<form method="dialog"><h2>${esc(titel)}</h2>${regels.map(r => `<p>${esc(r)}</p>`).join('')}`
      + `<div class="acties"><button type="button" data-k="nee">Annuleren</button><button type="submit" class="bevestig">${esc(ja)}</button></div></form>`;
    return new Promise(ok => {
      let klaar = false;
      const einde = (w) => {
        if (klaar) return;
        klaar = true;
        if (dlg.open) dlg.close();
        if (terugFocus?.isConnected) terugFocus.focus();
        ok(w);
      };
      dlg.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); einde(true); });
      dlg.querySelector('[data-k="nee"]').addEventListener('click', () => einde(false));
      dlg.addEventListener('cancel', () => einde(false), { once: true });
      dlg.showModal();
      dlg.querySelector('[data-k="nee"]').focus();
    });
  }

  async function formKlik(ev) {
    const knop = ev.target.closest('button[data-beheer]');
    if (!knop) return;
    const actie = knop.dataset.beheer;
    if (actie === 'dupliceren') return dupliceer();
    if (actie === 'terugzetten') return zetTerug(st.sjabloonId);
    if (actie === 'verwijderen') return verwijder(st.sjabloonId);
    if (actie === 'pin-zet') return zetPincode();
    if (actie === 'pin-wis') return wisPincode();
    if (actie.startsWith('regel-')) return regelKlik(actie, +knop.dataset.i);
    if (actie === 'kies' || actie === 'weg') return huisstijlKlik(knop);
    if (actie === 'weggooien') return gooiWeg(+knop.dataset.i);
  }

  function formInvoer(ev) {
    const el = ev.target;
    if (ev.type === 'input' && (el.tagName === 'SELECT' || ['checkbox', 'radio', 'file'].includes(el.type))) return;
    if (st.onderdeel === 'regels') regelInvoer(el, ev.type);
    else if (st.onderdeel === 'huisstijl') huisstijlInvoer(el, ev.type);
    else if (st.onderdeel === 'printers') printerInvoer(el, ev.type);
    else if (st.onderdeel === 'kolommen') kolomInvoer(el, ev.type);
  }

  // ---------- pincode instellen ----------
  async function tekenPincode() {
    const heeft = !!(await model.pcInstelling('pincode').catch(() => undefined));
    form.innerHTML = formKop('Pincode')
      + `<p>${heeft ? 'Op deze pc is een pincode ingesteld.' : 'Op deze pc is geen pincode ingesteld.'}</p>`
      + '<p class="hint">Een drempel, geen beveiliging. Geldt alleen op deze pc en wordt nooit gepubliceerd.</p>'
      + `<div class="raster smal"><label class="veld"><span>${heeft ? 'Nieuwe pincode' : 'Pincode'}</span>`
      + '<input type="password" id="beheerNieuwePincode" inputmode="numeric" autocomplete="new-password"></label></div>'
      + '<p class="fout" data-melding="pincode" role="alert"></p>'
      + `<div class="acties links"><button type="button" class="primary" data-beheer="pin-zet">Pincode instellen</button>`
      + (heeft ? '<button type="button" data-beheer="pin-wis">Pincode wissen</button>' : '') + '</div>';
    form.querySelector('#beheerNieuwePincode').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); zetPincode(); } });
  }
  async function zetPincode() {
    const v = form.querySelector('#beheerNieuwePincode').value.trim();
    if (!/^\d{4,8}$/.test(v)) { form.querySelector('[data-melding="pincode"]').textContent = 'Een pincode is 4 tot 8 cijfers.'; return; }
    if (!(await bewaar(() => model.zetPcInstelling('pincode', v)))) return;
    meld('pc', 'pincode');
    await tekenPincode();
    melding('Pincode ingesteld. Vanaf nu vraagt beheer op deze pc om deze pincode.');
  }
  async function wisPincode() {
    if (!(await bewaar(() => model.zetPcInstelling('pincode', null)))) return;
    meld('pc', 'pincode');
    await tekenPincode();
    melding('Pincode gewist.');
  }

  // ---------- voorbeeld ----------
  const sleutelVan = (a) => a.id ?? a.code;
  const labelVan = (a) => (a.code ? `${a.naam} · ${a.code}` : `${a.naam} · los item`);
  const alleArtikelen = () => { const e = model.effectief(); return [...e.losseItems, ...e.artikelen]; };

  function vulArtikelLijst() {
    const lijst = alleArtikelen().filter(a => a && a.naam).sort((x, y) => nlSort.compare(x.naam, y.naam));
    st.perLabel = new Map(lijst.map(a => [labelVan(a), a]));
    st.perCode = new Map(lijst.filter(a => a.code).map(a => [String(a.code).toLowerCase(), a]));
    st.lijst = lijst;
    $('beheerArtikelen').innerHTML = lijst.map(a => `<option value="${esc(labelVan(a))}"></option>`).join('');
  }

  function kiesArtikel(definitief) {
    const v = $('beheerArtikel').value.trim();
    const a = st.perLabel.get(v) || st.perCode.get(v.toLowerCase());
    if (a) { st.keuze = sleutelVan(a); voorbeeldLater(0); return; }
    if (definitief && !v) { st.keuze = null; voorbeeldLater(0); }
    else if (definitief) $('beheerVoorbeeldInfo').textContent = `Geen artikel "${v}" gevonden.`;
  }

  function pastBij(sj, a, regels) {
    if (a.combinatie) return false;
    if (sj.opmaak === 'qrlabel') return true;
    if (sj.opmaak === 'locatie') return !!a.locatie;
    if (a.sjabloon) return a.sjabloon === sj.id;
    return standaardSjabloon(a, 'bordje', regels) === sj.id;
  }

  function beheerArtikel(sj) {
    const e = model.effectief();
    if (st.keuze !== null) { const a = st.lijst.find(x => sleutelVan(x) === st.keuze); if (a) return { a, hoe: 'gekozen' }; }
    const a = st.lijst.find(x => pastBij(sj, x, e.regels));
    return a ? { a, hoe: 'past' } : { a: VOORBEELD_ARTIKEL, hoe: 'nep' };
  }

  /** Waarden die bij de artikelen van dit sjabloon voorkomen voor deze kleursleutel. */
  function waardenVoor(tokens, sj) {
    const e = model.effectief();
    let lijst = st.lijst.filter(a => pastBij(sj, a, e.regels));
    if (!lijst.length) lijst = st.lijst;
    const proef = { ...sj, plekken: { titel: tokens }, kleuren: {}, regelsVeld: undefined };
    const gezien = new Set();
    for (const a of lijst) {
      const w = vul(proef, a, e.aanvullingen[sleutelVan(a)] || {}).titel;
      if (w) gezien.add(w);
      if (gezien.size >= 60) break;
    }
    return [...gezien].sort(nlSort.compare);
  }

  /** Het sjabloon in het voorbeeld: het geopende; bij Huisstijl een bordje met voettekst. */
  function voorbeeldSjabloon() {
    if (st.onderdeel?.startsWith('sjabloon:') && st.werkSjabloon) return st.werkSjabloon;
    const laatste = sjabloonVan(st.sjabloonId);
    if (st.onderdeel === 'huisstijl' && !(laatste?.voet && laatste.opmaak !== 'strook')) {
      return sjablonen().find(s => s.voet && s.opmaak === 'staand') || sjablonen().find(s => s.voet) || laatste || eersteSjabloon();
    }
    return laatste || sjablonen().find(s => s.opmaak === 'staand') || eersteSjabloon();
  }

  let voorbeeldTimer, voorbeeldBeurt = 0;
  function voorbeeldLater(ms = WACHT) {
    if (gestopt) return;
    clearTimeout(voorbeeldTimer);
    voorbeeldTimer = setTimeout(tekenVoorbeeld, ms);
  }
  async function tekenVoorbeeld() {
    if (gestopt || !$('beheerVoorbeeldDoel')) return;
    const beurt = ++voorbeeldBeurt;
    const doel = $('beheerVoorbeeldDoel'), info = $('beheerVoorbeeldInfo');
    const sj = voorbeeldSjabloon();
    if (!sj) { doel.replaceChildren(); info.textContent = ''; return; }
    const e = model.effectief();
    const { a, hoe } = beheerArtikel(sj);
    $('beheerVoorbeeldSjabloon').textContent = `${sj.naam || sj.id} · ${sj.formaat.b} × ${sj.formaat.h} mm`;
    info.textContent = hoe === 'nep' ? 'Voorbeeldartikel: er past geen artikel bij dit sjabloon.' : `${a.naam}${a.code ? ' · ' + a.code : ''}`;
    let el;
    try { el = teken(vul(sj, a, e.aanvullingen[sleutelVan(a)] || {}, qrsVoor(a)[0] || ''), st.werkHuisstijl || e.huisstijl); }
    catch (err) { doel.innerHTML = `<p class="fout">Voorbeeld lukt niet: ${esc(err?.message || err)}</p>`; return; }
    const b = sj.formaat.b * PX, h = sj.formaat.h * PX;
    const s = Math.min(2.5, Math.max(80, doel.clientWidth - 8) / b, Math.max(160, doel.clientHeight - 8) / h);
    const doos = document.createElement('div');
    doos.className = 'vb';
    doos.style.width = (b * s).toFixed(1) + 'px';
    doos.style.height = (h * s).toFixed(1) + 'px';
    el.style.transform = `scale(${s})`;
    el.style.transformOrigin = '0 0';
    doos.appendChild(el);
    doel.replaceChildren(doos);
    await pasAan(el);
    if (beurt !== voorbeeldBeurt) return;
    doel.dataset.klaar = String(beurt);
  }

  function tekenPoort() {
    scherm.innerHTML = kop + `<div class="beheer-poort"><form id="beheerPinForm" class="kolom" autocomplete="off">`
      + `<h2>Pincode</h2><p class="hint">Beheer is afgeschermd op deze pc.</p>`
      + `<label class="veld"><span>Pincode</span><input type="password" id="pincode" inputmode="numeric" autocomplete="off"></label>`
      + `<p id="beheerPinFout" class="fout" role="alert"></p>`
      + `<div class="acties"><button type="submit" class="primary">Openen</button></div></form></div>`;
    $('beheerPinForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const invoer = $('pincode');
      if (invoer.value.trim() === String(pin)) { tekenBeheer(); return; }
      $('beheerPinFout').textContent = 'Onjuiste pincode';
      invoer.value = '';
      invoer.focus();
    }, { signal });
    $('pincode').focus();
  }


  if (pin) tekenPoort();
  else tekenBeheer();
  return api;
}
