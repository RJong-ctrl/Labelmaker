// Werkscherm: artikelen zoeken en kiezen, printvel per printer, voorbeeld en printen.

import { leesBestand } from './bestanden.js';
import { importeer, RENTMAN } from './import.js';
import { DSL_SJABLONEN, vul, ontbrekend, qrsVoor, standaardSjabloon } from './sjablonen.js';
import { HUISSTIJL_DSL } from './opmaak.js';
import { tekenVellen, pasVellenAan, print, LABEL } from './printen.js';
import { A4 } from './indeling.js';
import { esc } from './html.js';

const MAX_RIJEN = 200;
const LAATST = '__laatst';
const DERTIG_DAGEN = 30 * 24 * 3600 * 1000;
const PX = 96 / 25.4;

const norm = (s) => String(s ?? '').toLowerCase().replace(/×/g, 'x').replace(/,/g, '.').replace(/\s+/g, ' ').trim();
const sjabloon = (id) => DSL_SJABLONEN.find(s => s.id === id);
const nlSort = new Intl.Collator('nl', { numeric: true, sensitivity: 'base' });

export async function start(root, opslag, { waarschuwing = '' } = {}) {
  const $ = (id) => root.getElementById(id);
  const st = {
    artikelen: [], perCode: new Map(), qrIndex: new Map(), zoektekst: new Map(),
    aanvullingen: {}, vel: { label: [], a4: [] }, printlog: [],
    keuze: new Map(), // code → Set van exemplaar-QR's, of null voor het hele artikel
    tab: 'label', map: null, combinaties: false,
  };

  // ---------- laden ----------
  st.artikelen = (await opslag.alle('artikelen')).map(x => x.waarde);
  st.aanvullingen = Object.fromEntries((await opslag.alle('aanvullingen')).map(x => [x.id, x.waarde]));
  st.vel.label = (await opslag.lees('printvel', 'label')) || [];
  st.vel.a4 = (await opslag.lees('printvel', 'a4')) || [];
  // Printlog: alleen de laatste 30 dagen worden gebruikt; ouder wordt opgeruimd.
  const grensLog = Date.now() - DERTIG_DAGEN;
  for (const { id, waarde } of await opslag.alle('printlog')) {
    if ((waarde?.tijd || 0) < grensLog) await opslag.wis('printlog', id).catch(() => {});
    else st.printlog.push(waarde);
  }
  const inst = (await opslag.lees('instellingen', 'werkscherm')) || {};
  st.tab = inst.tab === 'a4' ? 'a4' : 'label';
  st.combinaties = !!inst.combinaties;
  $('combinaties').checked = st.combinaties;

  function indexeer() {
    st.perCode = new Map(st.artikelen.map(a => [a.code, a]));
    st.qrIndex = new Map();
    st.zoektekst = new Map();
    for (const a of st.artikelen) {
      if (a.qr) st.qrIndex.set(a.qr.toLowerCase(), { code: a.code, exemplaar: null });
      for (const e of a.exemplaren) st.qrIndex.set(e.toLowerCase(), { code: a.code, exemplaar: e });
      st.zoektekst.set(a.code, norm([a.naam, a.code, a.qr, ...a.exemplaren, a.locatie].join(' ')));
    }
    st.artikelen.sort((x, y) => nlSort.compare(x.naam, y.naam));
  }
  indexeer();

  const opslagFout = (e) => melding('Opslaan mislukt: ' + (e?.message || e) + '. Wat je nu doet, is na herladen misschien weg.', true);
  const bewaarInst = () => opslag.schrijf('instellingen', 'werkscherm', { tab: st.tab, combinaties: st.combinaties }).catch(opslagFout);
  const bewaarVel = () => Promise.all([opslag.schrijf('printvel', 'label', st.vel.label), opslag.schrijf('printvel', 'a4', st.vel.a4)]).catch(opslagFout);
  const context = () => ({ artikelen: st.perCode, sjablonen: DSL_SJABLONEN, aanvullingen: st.aanvullingen, huisstijl: HUISSTIJL_DSL });

  function melding(tekst, fout = false) {
    const m = $('melding');
    m.textContent = tekst;
    m.classList.toggle('fout', fout);
    m.hidden = !tekst;
  }

  // ---------- artikellijst ----------
  function laatstGeprint() {
    const grens = Date.now() - DERTIG_DAGEN, gezien = new Map();
    for (const r of st.printlog) if (r.tijd >= grens && (!gezien.has(r.artikel) || gezien.get(r.artikel) < r.tijd)) gezien.set(r.artikel, r.tijd);
    return [...gezien].sort((a, b) => b[1] - a[1]).map(([code]) => code);
  }

  function tekenChips() {
    const tel = new Map();
    for (const a of st.artikelen) if (a.map && (st.combinaties || !a.combinatie)) tel.set(a.map, (tel.get(a.map) || 0) + 1);
    const top = [...tel].sort((a, b) => b[1] - a[1] || nlSort.compare(a[0], b[0])).slice(0, 12);
    const chip = (waarde, tekst) => `<button type="button" class="chip" data-map="${esc(waarde ?? '')}" aria-pressed="${st.map === waarde}">${tekst}</button>`;
    $('chips').innerHTML = chip(null, 'Alle') + chip(LAATST, 'Laatst geprint') + top.map(([m, n]) => chip(m, `${esc(m)} <span class="n">${n}</span>`)).join('');
  }

  function gefilterd() {
    const woorden = norm($('zoek').value).split(' ').filter(Boolean);
    let basis;
    if (st.map === LAATST) basis = laatstGeprint().map(c => st.perCode.get(c)).filter(Boolean);
    else basis = st.artikelen.filter(a => (st.combinaties || !a.combinatie) && (st.map === null || a.map === st.map));
    if (woorden.length) basis = basis.filter(a => { const t = st.zoektekst.get(a.code); return woorden.every(w => t.includes(w)); });
    const gekozen = [...st.keuze.keys()].map(c => st.perCode.get(c)).filter(Boolean);
    const rest = basis.filter(a => !st.keuze.has(a.code));
    return { rijen: [...gekozen, ...rest], totaal: gekozen.length + rest.length };
  }

  function tekenLijst() {
    const heeft = st.artikelen.length > 0;
    $('leegArtikelen').hidden = heeft;
    $('chips').hidden = !heeft;
    $('combinaties').closest('label').hidden = !heeft;
    $('aantalArtikelen').textContent = heeft ? `${st.artikelen.length} in totaal` : '';
    const { rijen, totaal } = gefilterd();
    const zichtbaar = rijen.slice(0, MAX_RIJEN);
    $('lijst').innerHTML = zichtbaar.map(a => {
      const k = st.keuze.get(a.code);
      const sub = [a.code, a.locatie].filter(Boolean).map(esc).join(' · ');
      const ex = k ? [...k].map(e => `<span class="tag">${esc(e)}</span>`).join('') : '';
      return `<li data-code="${esc(a.code)}"${st.keuze.has(a.code) ? ' class="gekozen"' : ''}><label>`
        + `<input type="checkbox"${st.keuze.has(a.code) ? ' checked' : ''}>`
        + `<span class="txt"><span class="nm">${esc(a.naam)}</span><span class="sub">${sub}${ex}</span></span>`
        + (a.map ? `<span class="map">${esc(a.map)}</span>` : '') + '</label></li>';
    }).join('');
    const m = $('lijstmelding');
    m.hidden = totaal <= MAX_RIJEN;
    m.textContent = `${MAX_RIJEN} van ${totaal} getoond, zoek verder om te verfijnen`;
    if (heeft && !totaal) { m.hidden = false; m.textContent = 'Niets gevonden.'; }
    tekenKeuze();
  }

  function tekenKeuze() {
    const n = st.keuze.size;
    $('gekozen').textContent = n ? `${n} gekozen` : 'Niets gekozen';
    for (const id of ['actBordje', 'actQr', 'actLoc']) $(id).disabled = !n;
  }

  // ---------- printvel ----------
  const som = (items) => items.reduce((s, i) => s + (i.aantal | 0), 0);

  function voegToe(printer, item) {
    const lijst = st.vel[printer];
    const zelfde = lijst.find(i => i.sjabloon === item.sjabloon && i.artikel === item.artikel && i.qr === item.qr);
    if (zelfde) zelfde.aantal += item.aantal;
    else lijst.push(item);
  }

  function tekenVel() {
    const nL = som(st.vel.label), nA = som(st.vel.a4);
    $('printLabel').textContent = `Print ${nL} op Citizen`;
    $('printA4').textContent = `Print ${nA} op A4`;
    $('printLabel').disabled = !nL;
    $('printA4').disabled = !nA;
    $('tabLabel').textContent = `Citizen (${nL})`;
    $('tabA4').textContent = `A4 (${nA})`;
    $('tabLabel').setAttribute('aria-selected', st.tab === 'label');
    $('tabA4').setAttribute('aria-selected', st.tab === 'a4');
    const items = st.vel[st.tab];
    $('leegVel').hidden = items.length > 0;
    $('velLeeg').disabled = !items.length;
    $('velLijst').innerHTML = items.map((it, i) => {
      const a = st.perCode.get(it.artikel), sj = sjabloon(it.sjabloon);
      let kleur = '#7f7f7f';
      if (a && sj) kleur = vul(sj, a, st.aanvullingen[it.artikel] || {}, it.qr).rand;
      const sub = [sj ? sj.naam : it.sjabloon, it.qr].filter(Boolean).map(esc).join(' · ');
      return `<li data-i="${i}"><span class="stip" style="background:${esc(kleur)}"></span>`
        + `<span class="txt"><span class="nm">${a ? esc(a.naam) : esc(it.artikel) + ' (niet meer in de export)'}</span><span class="sub">${sub}</span></span>`
        + `<input class="aantal" type="number" min="1" max="999" value="${it.aantal}" aria-label="Aantal">`
        + '<button type="button" class="klein weg" aria-label="Verwijderen" title="Verwijderen">×</button></li>';
    }).join('');
    tekenVoorbeeld();
  }

  let voorbeeldBeurt = 0;
  async function tekenVoorbeeld() {
    const beurt = ++voorbeeldBeurt;
    await new Promise(r => setTimeout(r, 120));
    if (beurt !== voorbeeldBeurt) return;
    const doel = $('vellen');
    const vellen = tekenVellen(st.tab, st.vel[st.tab], context());
    const toon = vellen.slice(0, 6);
    const formaat = st.tab === 'label' ? LABEL : A4;
    const breedte = Math.max(200, doel.clientWidth - 4);
    const s = Math.min(st.tab === 'label' ? 1.6 : 1, breedte / (formaat.b * PX));
    const doos = toon.map(v => {
      const d = document.createElement('div');
      d.className = 'vb';
      d.style.width = (formaat.b * PX * s).toFixed(1) + 'px';
      d.style.height = (formaat.h * PX * s).toFixed(1) + 'px';
      v.style.transform = `scale(${s})`;
      v.style.transformOrigin = '0 0';
      d.appendChild(v);
      return d;
    });
    doel.replaceChildren(...doos);
    await pasVellenAan(toon);
    if (beurt !== voorbeeldBeurt) return;
    const woord = st.tab === 'label' ? ['label', 'labels'] : ['vel', 'vellen'];
    $('voorbeeldInfo').textContent = vellen.length
      ? `${vellen.length} ${woord[vellen.length === 1 ? 0 : 1]}` + (vellen.length > toon.length ? `, eerste ${toon.length} getoond` : '')
      : '';
  }

  // ---------- aanvullen ----------
  function vraagAanvulling(artikel, velden) {
    const dlg = $('aanvulling');
    dlg.innerHTML = `<form method="dialog"><h2>Aanvullen</h2><p class="hint">${esc(artikel.naam)} · ${esc(artikel.code)}</p>`
      + velden.map(v => `<label class="veld"><span>${esc(v.naam)}</span>`
        + (v.opties
          ? `<select name="${esc(v.naam)}" required><option value="">Kies…</option>${v.opties.map(o => `<option>${esc(o)}</option>`).join('')}</select>`
          : `<input type="text" name="${esc(v.naam)}" required>`)
        + '</label>').join('')
      + '<p class="hint">Dit wordt onthouden voor dit artikel.</p>'
      + '<div class="acties"><button type="button" data-k="over">Overslaan</button><button type="submit" class="primary">Opslaan</button></div></form>';
    const form = dlg.querySelector('form');
    return new Promise(ok => {
      let klaar = false;
      const einde = (w) => { if (klaar) return; klaar = true; if (dlg.open) dlg.close(); ok(w); };
      form.addEventListener('submit', () => einde(Object.fromEntries(new FormData(form))));
      form.querySelector('[data-k="over"]').addEventListener('click', () => einde(null));
      dlg.addEventListener('cancel', () => einde(null), { once: true });
      dlg.showModal();
      form.querySelector('select,input')?.focus();
    });
  }

  // ---------- acties ----------
  async function actie(soort) {
    let toegevoegd = 0, zonderLocatie = 0, overgeslagen = 0, printer = null;
    for (const [code, exemplaren] of [...st.keuze]) {
      const a = st.perCode.get(code);
      if (!a) continue;
      const sid = standaardSjabloon(a, soort), sj = sjabloon(sid);
      if (soort === 'locatie' && !a.locatie) { zonderLocatie++; continue; }
      const mist = ontbrekend(sj, a, st.aanvullingen[code] || {});
      if (mist.length) {
        const w = await vraagAanvulling(a, mist);
        if (!w) { overgeslagen++; continue; }
        st.aanvullingen[code] = { ...(st.aanvullingen[code] || {}), ...w };
        await opslag.schrijf('aanvullingen', code, st.aanvullingen[code]).catch(opslagFout);
      }
      // Aangevinkt = één met de artikel-QR; gescande exemplaren = die exemplaren; 'Per exemplaar' = allemaal.
      const qrs = soort === 'locatie' ? ['']
        : exemplaren ? [...exemplaren]
        : $('perExemplaar').checked ? qrsVoor(a)
        : [a.qr || a.exemplaren?.[0] || ''];
      for (const qr of qrs) { voegToe(sj.printer, { sjabloon: sid, artikel: code, qr, aantal: 1 }); toegevoegd++; }
      printer = sj.printer;
    }
    st.keuze.clear();
    $('perExemplaar').checked = false;
    if (printer) st.tab = printer;
    await bewaarVel();
    bewaarInst();
    tekenLijst();
    tekenVel();
    const delen = [`${toegevoegd} toegevoegd aan het printvel`];
    if (zonderLocatie) delen.push(`${zonderLocatie} zonder locatie overgeslagen`);
    if (overgeslagen) delen.push(`${overgeslagen} overgeslagen`);
    melding(delen.join(', ') + '.');
    $('zoek').focus();
  }

  let printBezig = false;
  async function printen(printer, alleenEerste = false) {
    const items = st.vel[printer];
    if (!som(items) || printBezig) return;
    printBezig = true;
    let gelukt;
    try { gelukt = await print(printer, items, context(), { alleenEerste }); }
    finally { printBezig = false; }
    if (!gelukt || alleenEerste) return;
    const tijd = Date.now(), stempel = new Date(tijd).toISOString();
    const regels = items.map((it, i) => ({ id: `${stempel}#${String(i).padStart(4, '0')}`, waarde: { ...it, tijd } }));
    await opslag.schrijfVeel('printlog', regels).catch(opslagFout);
    st.printlog.push(...regels.map(r => r.waarde));
    if (st.map === LAATST) tekenLijst();
  }

  async function importeren(file) {
    let rijen;
    try {
      melding('Bezig met inlezen…');
      rijen = await leesBestand(file);
    } catch (e) {
      melding('Kon het bestand niet lezen: ' + e.message, true);
      $('bestand').value = '';
      return;
    }
    try {
      const { artikelen, ontbrekend: mist } = importeer(rijen);
      if (!artikelen.length) {
        melding(mist.includes('naam') || mist.includes('code')
          ? 'In dit bestand staan geen kolommen "Naam (in database)" en "Code". Kies de materiaalexport uit Rentman.'
          : 'Geen artikelen gevonden in dit bestand.', true);
        return;
      }
      try {
        await opslag.vervangAlle('artikelen', artikelen.map(a => ({ id: a.code, waarde: a })));
      } catch (e) {
        melding('De artikelen konden niet worden opgeslagen (' + (e?.message || e) + '). De vorige lijst is bewaard gebleven.', true);
        return;
      }
      st.artikelen = artikelen;
      indexeer();
      st.keuze.clear();
      // Regels op het printvel waarvan het artikel niet meer bestaat, kunnen niet geprint worden.
      let weg = 0;
      for (const p of ['label', 'a4']) {
        const voor = st.vel[p].length;
        st.vel[p] = st.vel[p].filter(i => st.perCode.has(i.artikel));
        weg += voor - st.vel[p].length;
      }
      if (weg) await bewaarVel();
      tekenChips();
      tekenLijst();
      tekenVel();
      const delen = [`${artikelen.length} ${artikelen.length === 1 ? 'artikel' : 'artikelen'} ingelezen.`];
      if (mist.length) delen.push(`Kolommen niet gevonden: ${mist.map(v => RENTMAN[v]).join(', ')}.`);
      if (weg) delen.push(`${weg} ${weg === 1 ? 'regel' : 'regels'} van het printvel verwijderd: artikel niet meer in de export.`);
      melding(delen.join(' '));
    } catch (e) {
      melding('Inlezen mislukt: ' + e.message, true);
    } finally {
      $('bestand').value = '';
    }
  }

  function scan() {
    const waarde = $('zoek').value.trim().toLowerCase();
    const hit = st.qrIndex.get(waarde) || (st.perCode.has($('zoek').value.trim()) ? { code: $('zoek').value.trim(), exemplaar: null } : null);
    if (!hit) return false;
    const a = st.perCode.get(hit.code);
    const heelGekozen = st.keuze.has(hit.code) && st.keuze.get(hit.code) === null;
    if (hit.exemplaar && !heelGekozen) {
      st.keuze.set(hit.code, new Set([...(st.keuze.get(hit.code) || []), hit.exemplaar]));
    } else st.keuze.set(hit.code, null);
    if (a.combinatie && !st.combinaties) { st.combinaties = true; $('combinaties').checked = true; tekenChips(); }
    $('zoek').value = '';
    melding(`Gescand: ${a.naam}${hit.exemplaar ? ' (' + hit.exemplaar + ')' : ''}`);
    tekenLijst();
    return true;
  }

  // ---------- gebeurtenissen ----------
  $('inlezen').addEventListener('click', () => $('bestand').click());
  $('bestand').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importeren(f); });
  let zoekTimer;
  $('zoek').addEventListener('input', () => { clearTimeout(zoekTimer); zoekTimer = setTimeout(tekenLijst, 120); });
  $('zoek').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(zoekTimer); if (!scan()) tekenLijst(); } });
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('button.chip');
    if (!b) return;
    st.map = b.dataset.map === '' ? null : b.dataset.map;
    tekenChips();
    tekenLijst();
  });
  $('combinaties').addEventListener('change', (e) => { st.combinaties = e.target.checked; bewaarInst(); tekenChips(); tekenLijst(); });
  $('lijst').addEventListener('change', (e) => {
    const li = e.target.closest('li');
    if (!li || e.target.type !== 'checkbox') return;
    if (e.target.checked) st.keuze.set(li.dataset.code, null);
    else st.keuze.delete(li.dataset.code);
    li.classList.toggle('gekozen', e.target.checked);
    tekenKeuze();
  });
  $('actBordje').addEventListener('click', () => actie('bordje'));
  $('actQr').addEventListener('click', () => actie('qrlabel'));
  $('actLoc').addEventListener('click', () => actie('locatie'));
  $('tabLabel').addEventListener('click', () => { st.tab = 'label'; bewaarInst(); tekenVel(); });
  $('tabA4').addEventListener('click', () => { st.tab = 'a4'; bewaarInst(); tekenVel(); });
  $('velLijst').addEventListener('change', (e) => {
    if (!e.target.classList.contains('aantal')) return;
    const it = st.vel[st.tab][+e.target.closest('li').dataset.i];
    it.aantal = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1));
    bewaarVel();
    tekenVel();
  });
  $('velLijst').addEventListener('click', (e) => {
    if (!e.target.closest('button.weg')) return;
    st.vel[st.tab].splice(+e.target.closest('li').dataset.i, 1);
    bewaarVel();
    tekenVel();
  });
  $('velLeeg').addEventListener('click', () => { st.vel[st.tab] = []; bewaarVel(); tekenVel(); melding('Printvel leeggemaakt.'); });
  $('printLabel').addEventListener('click', () => printen('label'));
  $('printA4').addEventListener('click', () => printen('a4'));
  const menu = $('printMenu');
  const zetMenu = (open) => { menu.hidden = !open; $('printMeer').setAttribute('aria-expanded', open); };
  $('printMeer').addEventListener('click', (e) => { e.stopPropagation(); zetMenu(menu.hidden); });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-printer]');
    if (!b) return;
    zetMenu(false);
    printen(b.dataset.printer, true);
  });
  root.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) zetMenu(false); });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) zetMenu(false); });

  tekenChips();
  tekenLijst();
  tekenVel();
  if (waarschuwing) melding(waarschuwing, true);
  $('zoek').focus();
}
