// Werkscherm: artikelen zoeken en kiezen, printvel per printer, voorbeeld en printen.
// Alle gegevens lopen via het model (basis + lokale wijzigingen van dit profiel).

import { leesBestand } from './bestanden.js';
import { importeer } from './import.js';
import { vul, ontbrekend, qrsVoor, standaardSjabloon, veldwaarde, natuurlijkeWaarde } from './sjablonen.js';
import { tekenVellen, pasVellenAan, print } from './printen.js';
import { A4 } from './indeling.js';
import { esc } from './html.js';
import { profielen, kiesProfiel, maakProfiel } from './profielen.js';
import { vraagVelden, vraagLosItem, vraagKolommen, vraagProfiel } from './dialogen.js';
import { startMaken } from './maken.js';

const MAX_RIJEN = 200;
const LAATST = '__laatst';
const LOS = '__los';
const DERTIG_DAGEN = 30 * 24 * 3600 * 1000;
const PX = 96 / 25.4;
const KOLOMVELDEN = ['naam', 'code', 'qr', 'exemplaren', 'locatie', 'map', 'pad', 'soort', 'type', 'aantal'];

const norm = (s) => String(s ?? '').toLowerCase().replace(/×/g, 'x').replace(/,/g, '.').replace(/\s+/g, ' ').trim();
const nlSort = new Intl.Collator('nl', { numeric: true, sensitivity: 'base' });

export async function start(root, model, { waarschuwing = '', profielId = 'dsl', herlaad = () => location.reload() } = {}) {
  const $ = (id) => root.getElementById(id);
  const st = {
    artikelen: [], perId: new Map(), qrIndex: new Map(), zoektekst: new Map(),
    vel: { label: await model.printvel('label'), a4: await model.printvel('a4') },
    printlog: await model.printlog(Date.now() - DERTIG_DAGEN),
    keuze: new Map(), // id → Set van exemplaar-QR's, of null voor het hele artikel
    tab: 'label', map: null, combinaties: false,
  };
  const E = () => model.effectief();
  const sjabloon = (id) => E().sjablonen.find(s => s.id === id);
  const inst = (await model.pcInstelling('werkscherm')) || {};
  st.tab = inst.tab === 'a4' ? 'a4' : 'label';
  st.combinaties = !!inst.combinaties;
  $('combinaties').checked = st.combinaties;

  function indexeer() {
    const e = E();
    const losse = e.losseItems.map(x => ({ ...x, map: 'Losse items', los: true }));
    // Tijdelijke losse items (aangepaste bordjes op het printvel) staan niet in de lijst, wel in perId.
    st.artikelen = [...e.artikelen, ...losse.filter(x => !x.tijdelijk)];
    st.perId = new Map([...e.artikelen, ...losse].map(a => [a.id || a.code, a]));
    st.qrIndex = new Map();
    st.zoektekst = new Map();
    for (const a of st.artikelen) {
      const id = a.id || a.code;
      if (a.qr) st.qrIndex.set(a.qr.toLowerCase(), { id, exemplaar: null });
      for (const x of a.exemplaren || []) st.qrIndex.set(x.toLowerCase(), { id, exemplaar: x });
      st.zoektekst.set(id, norm([a.naam, a.code, a.qr, ...(a.exemplaren || []), a.locatie].join(' ')));
    }
    st.artikelen.sort((x, y) => nlSort.compare(x.naam, y.naam));
  }
  indexeer();

  const opslagFout = (e) => melding('Opslaan mislukt: ' + (e?.message || e) + '. Wat je nu doet, is na herladen misschien weg.', true);
  const bewaarInst = () => model.zetPcInstelling('werkscherm', { tab: st.tab, combinaties: st.combinaties, paneel: typeof paneel === 'undefined' ? 'maken' : paneel }).catch(opslagFout);
  const bewaarVel = () => Promise.all([model.zetPrintvel('label', st.vel.label), model.zetPrintvel('a4', st.vel.a4)]).catch(opslagFout);
  const context = () => {
    const e = E();
    return { artikelen: st.perId, sjablonen: e.sjablonen, aanvullingen: e.aanvullingen, huisstijl: e.huisstijl, printers: e.printers };
  };

  function melding(tekst, fout = false) {
    const m = $('melding');
    m.textContent = tekst;
    m.classList.toggle('fout', fout);
    m.hidden = !tekst;
  }

  // ---------- kop: profielen ----------
  function tekenProfielen() {
    $('profiel').innerHTML = profielen().map(p => `<option value="${esc(p.id)}"${p.id === profielId ? ' selected' : ''}>${esc(p.naam)}</option>`).join('')
      + '<option value="__nieuw">Nieuw profiel…</option>';
  }

  // ---------- artikellijst ----------
  function laatstGeprint() {
    const gezien = new Map();
    for (const r of st.printlog) if (!gezien.has(r.artikel) || gezien.get(r.artikel) < r.tijd) gezien.set(r.artikel, r.tijd);
    return [...gezien].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }

  function tekenChips() {
    const tel = new Map();
    for (const a of st.artikelen) if (!a.los && a.map && (st.combinaties || !a.combinatie)) tel.set(a.map, (tel.get(a.map) || 0) + 1);
    const top = [...tel].sort((a, b) => b[1] - a[1] || nlSort.compare(a[0], b[0])).slice(0, 12);
    const chip = (waarde, tekst) => `<button type="button" class="chip" data-map="${esc(waarde ?? '')}" aria-pressed="${st.map === waarde}">${tekst}</button>`;
    const nLos = E().losseItems.filter(x => !x.tijdelijk).length;
    $('chips').innerHTML = chip(null, 'Alle') + chip(LAATST, 'Laatst geprint')
      + (nLos ? chip(LOS, `Losse items <span class="n">${nLos}</span>`) : '')
      + top.map(([m, n]) => chip(m, `${esc(m)} <span class="n">${n}</span>`)).join('');
  }

  function gefilterd() {
    const woorden = norm($('zoek').value).split(' ').filter(Boolean);
    let basis;
    if (st.map === LAATST) basis = laatstGeprint().map(id => st.perId.get(id)).filter(Boolean);
    else if (st.map === LOS) basis = st.artikelen.filter(a => a.los);
    else basis = st.artikelen.filter(a => (st.combinaties || !a.combinatie) && (st.map === null || a.map === st.map));
    if (woorden.length) basis = basis.filter(a => { const t = st.zoektekst.get(a.id || a.code); return woorden.every(w => t.includes(w)); });
    const gekozen = [...st.keuze.keys()].map(id => st.perId.get(id)).filter(Boolean);
    const rest = basis.filter(a => !st.keuze.has(a.id || a.code));
    return { rijen: [...gekozen, ...rest], totaal: gekozen.length + rest.length };
  }

  function tekenLijst() {
    const heeft = st.artikelen.length > 0;
    $('leegArtikelen').hidden = heeft;
    $('chips').hidden = !heeft;
    $('combinaties').closest('label').hidden = !heeft;
    $('aantalArtikelen').textContent = heeft ? `${st.artikelen.length} in totaal` : '';
    const { rijen, totaal } = gefilterd();
    $('lijst').innerHTML = rijen.slice(0, MAX_RIJEN).map(a => {
      const id = a.id || a.code, k = st.keuze.get(id);
      const sub = [a.code, a.locatie].filter(Boolean).map(esc).join(' · ');
      const ex = k ? [...k].map(e => `<span class="tag">${esc(e)}</span>`).join('') : '';
      return `<li data-code="${esc(id)}"${st.keuze.has(id) ? ' class="gekozen"' : ''}><label>`
        + `<input type="checkbox"${st.keuze.has(id) ? ' checked' : ''}>`
        + `<span class="txt"><span class="nm">${esc(a.naam)}</span><span class="sub">${sub}${ex}</span></span>`
        + (a.map ? `<span class="map">${esc(a.map)}</span>` : '') + '</label>'
        + (a.los ? '<button type="button" class="klein bewerk" aria-label="Los item bewerken" title="Bewerken">✎</button>' : '') + '</li>';
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
    for (const id of ['actBordje', 'actQr', 'actLoc', 'sjabloonKeuze']) $(id).disabled = !n;
  }

  function tekenSjabloonKeuze() {
    const groep = (printer, titel) => {
      const lijst = E().sjablonen.filter(s => s.printer === printer);
      return lijst.length ? `<optgroup label="${titel}">${lijst.map(s => `<option value="${esc(s.id)}">${esc(s.naam)}</option>`).join('')}</optgroup>` : '';
    };
    const label = E().printers?.label?.naam || 'Labelprinter';
    $('sjabloonKeuze').innerHTML = '<option value="">Ander sjabloon…</option>' + groep('label', esc(label)) + groep('a4', 'A4');
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
    const labelNaam = E().printers?.label?.naam?.split(' ')[0] || 'label';
    $('printLabel').textContent = `Print ${nL} op ${labelNaam}`;
    $('printA4').textContent = `Print ${nA} op A4`;
    $('printLabel').disabled = !nL;
    $('printA4').disabled = !nA;
    $('tabLabel').textContent = `${labelNaam} (${nL})`;
    $('tabA4').textContent = `A4 (${nA})`;
    $('tabLabel').setAttribute('aria-selected', st.tab === 'label');
    $('tabA4').setAttribute('aria-selected', st.tab === 'a4');
    const items = st.vel[st.tab];
    $('leegVel').hidden = items.length > 0;
    $('velLeeg').disabled = !items.length;
    const aanv = E().aanvullingen;
    $('velLijst').innerHTML = items.map((it, i) => {
      const a = st.perId.get(it.artikel), sj = sjabloon(it.sjabloon);
      let kleur = '#7f7f7f';
      if (a && sj) kleur = vul(sj, a, aanv[it.artikel] || {}, it.qr).rand;
      const sub = [sj ? sj.naam : it.sjabloon + ' (sjabloon bestaat niet meer)', it.qr].filter(Boolean).map(esc).join(' · ');
      return `<li data-i="${i}"><span class="stip" style="background:${esc(kleur)}"></span>`
        + `<span class="txt"><span class="nm">${a ? esc(a.naam) : esc(it.artikel) + ' (niet meer in de export)'}</span><span class="sub">${sub}</span></span>`
        + `<input class="aantal" type="number" min="1" max="999" value="${it.aantal}" aria-label="Aantal">`
        + (a && sj ? '<button type="button" class="klein aanpassen">Aanpassen</button>' : '')
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
    const formaat = st.tab === 'label' ? (E().printers?.label || { b: 76, h: 56 }) : A4;
    const breedte = Math.max(200, doel.clientWidth - 4);
    const s = Math.min(st.tab === 'label' ? 1.6 : 1, breedte / (formaat.b * PX));
    doel.replaceChildren(...toon.map(v => {
      const d = document.createElement('div');
      d.className = 'vb';
      d.style.width = (formaat.b * PX * s).toFixed(1) + 'px';
      d.style.height = (formaat.h * PX * s).toFixed(1) + 'px';
      v.style.transform = `scale(${s})`;
      v.style.transformOrigin = '0 0';
      d.appendChild(v);
      return d;
    }));
    await pasVellenAan(toon);
    if (beurt !== voorbeeldBeurt) return;
    const woord = st.tab === 'label' ? ['label', 'labels'] : ['vel', 'vellen'];
    $('voorbeeldInfo').textContent = vellen.length
      ? `${vellen.length} ${woord[vellen.length === 1 ? 0 : 1]}` + (vellen.length > toon.length ? `, eerste ${toon.length} getoond` : '')
      : '';
  }

  // ---------- acties ----------
  async function actie(soort, gekozenSjabloon = '') {
    let toegevoegd = 0, zonderLocatie = 0, overgeslagen = 0, printer = null;
    const e = E();
    for (const [id, exemplaren] of [...st.keuze]) {
      const a = st.perId.get(id);
      if (!a) continue;
      const sid = gekozenSjabloon || standaardSjabloon(a, soort, e.regels);
      const sj = sjabloon(sid);
      if (!sj) { overgeslagen++; continue; }
      const isLocatie = sj.opmaak === 'locatie';
      if (isLocatie && !a.locatie && !E().aanvullingen[id]?.Locatie) {
        const w = await vraagVelden($('aanvulling'), {
          titel: 'Locatie ontbreekt', onder: `${a.naam}${a.code ? ' · ' + a.code : ''}`,
          velden: [{ naam: 'Locatie', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: true }],
          hint: 'Vul de locatie in; die wordt onthouden. Zet hem ook in Rentman, dan staat hij er bij de volgende export vanzelf in.',
        });
        if (!w?.Locatie) { zonderLocatie++; continue; }
        await model.zetAanvulling(id, { Locatie: w.Locatie }).catch(opslagFout);
      }
      const mist = ontbrekend(sj, a, E().aanvullingen[id] || {});
      if (mist.length) {
        const w = await vraagVelden($('aanvulling'), { titel: 'Aanvullen', onder: `${a.naam} · ${a.code || ''}`, velden: mist });
        if (!w) { overgeslagen++; continue; }
        await model.zetAanvulling(id, w).catch(opslagFout);
      }
      // Aangevinkt = één met de artikel-QR; gescande exemplaren = die exemplaren; 'Per exemplaar' = allemaal.
      const qrs = isLocatie ? ['']
        : exemplaren ? [...exemplaren]
        : $('perExemplaar').checked ? qrsVoor(a)
        : [a.qr || a.exemplaren?.[0] || ''];
      for (const qr of qrs) { voegToe(sj.printer, { sjabloon: sid, artikel: id, qr, aantal: 1 }); toegevoegd++; }
      printer = sj.printer;
    }
    st.keuze.clear();
    $('perExemplaar').checked = false;
    $('sjabloonKeuze').value = '';
    if (printer) st.tab = printer;
    await bewaarVel();
    bewaarInst();
    tekenLijst();
    tekenVel();
    const delen = [`${toegevoegd} toegevoegd aan het printvel`];
    if (zonderLocatie) delen.push(`${zonderLocatie} zonder locatie overgeslagen`);
    if (overgeslagen) delen.push(`${overgeslagen} overgeslagen`);
    melding(delen.join(', ') + '.', zonderLocatie > 0 || overgeslagen > 0);
    $('zoek').focus();
  }

  function aanpassen(item, index) {
    if (!st.perId.get(item.artikel) || !sjabloon(item.sjabloon)) return;
    zetPaneel('maken');
    maken.laad(item, st.tab, index);
    melding('Pas het bordje aan en klik op Bijwerken.');
  }

  async function losItem(bestaand = null) {
    const w = await vraagLosItem($('aanvulling'), E().sjablonen, bestaand, bestaand ? (E().aanvullingen[bestaand.id] || {}) : {});
    if (!w) return;
    if (w.__knop === 'verwijder') {
      await model.verwijderLosItem(bestaand.id).catch(opslagFout);
      for (const p of ['label', 'a4']) st.vel[p] = st.vel[p].filter(i => i.artikel !== bestaand.id);
      st.keuze.delete(bestaand.id);
      await bewaarVel();
      indexeer(); tekenChips(); tekenLijst(); tekenVel();
      melding(`Los item "${bestaand.naam}" verwijderd.`);
      return;
    }
    const id = bestaand?.id || 'los-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const [qr = '', ...rest] = w.qrs;
    const item = {
      id, naam: w.naam, code: w.code, qr, exemplaren: w.qrs.length > 1 ? w.qrs : [], pad: '', map: 'Losse items',
      locatie: w.locatie, soort: w.qrs.length > 1 ? 'serie' : 'bulk', type: 'Los item', combinatie: false, aantal: 0, sjabloon: w.sjabloon,
    };
    void rest;
    await model.zetLosItem(item).catch(opslagFout);
    await model.zetAanvulling(id, w.aanvullingen).catch(opslagFout);
    indexeer();
    if (!bestaand) st.keuze.set(id, null);
    tekenChips(); tekenLijst(); tekenVel();
    melding(bestaand ? `Los item "${item.naam}" bijgewerkt.` : `Los item "${item.naam}" gemaakt en aangevinkt. Kies nu Bordje of strook, QR-label of Locatielabel.`);
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
    const tijd = Date.now();
    const regels = items.map(it => ({ ...it, tijd }));
    await model.logPrints(regels).catch(opslagFout);
    st.printlog.push(...regels);
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
      let kolommen = E().kolommen;
      let { artikelen, ontbrekend: mist } = importeer(rijen, kolommen);
      if (mist.includes('naam') || mist.includes('code')) {
        melding('');
        const koppeling = await vraagKolommen($('aanvulling'), (rijen[0] || []).map(String).filter(Boolean), kolommen, KOLOMVELDEN);
        if (!koppeling) { melding('Inlezen geannuleerd.'); return; }
        kolommen = koppeling;
        ({ artikelen, ontbrekend: mist } = importeer(rijen, kolommen));
        if (!artikelen.length) { melding('Geen artikelen gevonden met deze kolommen.', true); return; }
        await model.zetInstelling('kolommen', kolommen).catch(opslagFout);
      }
      if (!artikelen.length) { melding('Geen artikelen gevonden in dit bestand.', true); return; }
      try {
        await model.zetArtikelen(artikelen);
      } catch (e) {
        melding('De artikelen konden niet worden opgeslagen (' + (e?.message || e) + '). De vorige lijst is bewaard gebleven.', true);
        return;
      }
      indexeer();
      st.keuze.clear();
      // Regels op het printvel waarvan het artikel niet meer bestaat, kunnen niet geprint worden.
      let weg = 0;
      for (const p of ['label', 'a4']) {
        const voor = st.vel[p].length;
        st.vel[p] = st.vel[p].filter(i => st.perId.has(i.artikel));
        weg += voor - st.vel[p].length;
      }
      if (weg) await bewaarVel();
      tekenChips(); tekenLijst(); tekenVel();
      const delen = [`${artikelen.length} ${artikelen.length === 1 ? 'artikel' : 'artikelen'} ingelezen.`];
      const nietGevonden = mist.filter(v => kolommen[v]).map(v => kolommen[v]);
      if (nietGevonden.length) delen.push(`Kolommen niet gevonden: ${nietGevonden.join(', ')}.`);
      if (weg) delen.push(`${weg} ${weg === 1 ? 'regel' : 'regels'} van het printvel verwijderd: artikel niet meer in de export.`);
      melding(delen.join(' '));
    } catch (e) {
      melding('Inlezen mislukt: ' + e.message, true);
    } finally {
      $('bestand').value = '';
    }
  }

  function scan() {
    const ruw = $('zoek').value.trim();
    const hit = st.qrIndex.get(ruw.toLowerCase()) || (st.perId.has(ruw) ? { id: ruw, exemplaar: null } : null);
    if (!hit) return false;
    const a = st.perId.get(hit.id);
    const heelGekozen = st.keuze.has(hit.id) && st.keuze.get(hit.id) === null;
    if (hit.exemplaar && !heelGekozen) st.keuze.set(hit.id, new Set([...(st.keuze.get(hit.id) || []), hit.exemplaar]));
    else st.keuze.set(hit.id, null);
    if (a.combinatie && !st.combinaties) { st.combinaties = true; $('combinaties').checked = true; tekenChips(); }
    $('zoek').value = '';
    melding(`Gescand: ${a.naam}${hit.exemplaar ? ' (' + hit.exemplaar + ')' : ''}`);
    tekenLijst();
    return true;
  }

  // ---------- gebeurtenissen ----------
  $('profiel').addEventListener('change', async (e) => {
    const id = e.target.value;
    if (id === '__nieuw') {
      e.target.value = profielId;
      const w = await vraagProfiel($('aanvulling'));
      if (!w) return;
      const nieuw = await maakProfiel(w.naam, w.vanuit);
      kiesProfiel(nieuw);
      return herlaad();
    }
    kiesProfiel(id);
    herlaad();
  });
  $('inlezen').addEventListener('click', () => $('bestand').click());
  $('bestand').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importeren(f); });
  $('losItem').addEventListener('click', () => { zetPaneel('maken'); maken.reset(); });
  $('tabMaken').addEventListener('click', () => zetPaneel('maken'));
  $('tabLijst').addEventListener('click', () => zetPaneel('lijst'));
  let zoekTimer;
  $('zoek').addEventListener('input', () => { zetPaneel('lijst'); clearTimeout(zoekTimer); zoekTimer = setTimeout(tekenLijst, 120); });
  $('zoek').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); zetPaneel('lijst'); clearTimeout(zoekTimer); if (!scan()) tekenLijst(); } });
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
  $('lijst').addEventListener('click', (e) => {
    if (!e.target.closest('button.bewerk')) return;
    const a = st.perId.get(e.target.closest('li').dataset.code);
    if (a) losItem(a);
  });
  $('actBordje').addEventListener('click', () => actie('bordje'));
  $('actQr').addEventListener('click', () => actie('qrlabel'));
  $('actLoc').addEventListener('click', () => actie('locatie'));
  $('sjabloonKeuze').addEventListener('change', (e) => { if (e.target.value) actie('bordje', e.target.value); });
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
    const li = e.target.closest('li');
    if (!li) return;
    if (e.target.closest('button.weg')) {
      st.vel[st.tab].splice(+li.dataset.i, 1);
      bewaarVel();
      tekenVel();
    } else if (e.target.closest('button.aanpassen')) aanpassen(st.vel[st.tab][+li.dataset.i], +li.dataset.i);
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

  // ---------- panelen: Maken (standaard) en Lijst ----------
  let paneel = inst.paneel === 'lijst' ? 'lijst' : 'maken';
  function zetPaneel(p) {
    if (paneel === p && !$('maken').hidden === (p === 'maken')) return;
    paneel = p;
    $('maken').hidden = p !== 'maken';
    $('lijstDeel').hidden = p !== 'lijst';
    $('tabMaken').setAttribute('aria-selected', p === 'maken');
    $('tabLijst').setAttribute('aria-selected', p === 'lijst');
  }
  const maken = startMaken(root, {
    model, E, sjabloon,
    artikelen: () => st.artikelen, perId: () => st.perId, qrIndex: () => st.qrIndex,
    voegToe, indexeer,
    vervang: (printer, index, items) => {
      st.vel[printer].splice(index, 1);
      for (const it of items) { const p = sjabloon(it.sjabloon)?.printer || printer; st.vel[p].splice(p === printer ? index : st.vel[p].length, 0, it); }
    },
    naarPrinter: (p) => { st.tab = p; bewaarInst(); },
    melding, bewaarVel,
    tekenAlles: () => { tekenChips(); tekenLijst(); tekenVel(); },
  });
  zetPaneel(paneel);
  $('maken').hidden = paneel !== 'maken'; $('lijstDeel').hidden = paneel !== 'lijst';

  // Tijdelijke losse items die niet meer op het printvel staan, opruimen.
  {
    const inGebruik = new Set([...st.vel.label, ...st.vel.a4].map(i => i.artikel));
    for (const x of E().losseItems) if (x.tijdelijk && !inGebruik.has(x.id)) await model.gooiWeg({ soort: 'los', id: x.id }).catch(() => {});
  }

  /** Opnieuw tekenen na een wijziging elders (beheer, nieuwe basis); printvel opnieuw uit de opslag. */
  async function vernieuw(opnieuwLezen = true) {
    if (opnieuwLezen) { st.vel.label = await model.printvel('label'); st.vel.a4 = await model.printvel('a4'); }
    indexeer();
    for (const p of ['label', 'a4']) st.vel[p] = st.vel[p].filter(i => sjabloon(i.sjabloon));
    tekenProfielen(); tekenSjabloonKeuze(); tekenChips(); tekenLijst(); tekenVel();
    maken?.vernieuw();
  }

  await vernieuw(false);
  if (waarschuwing) melding(waarschuwing, true);
  (paneel === 'maken' ? $('makenZoek') : $('zoek'))?.focus();
  return { vernieuw, melding };
}
