// Beheer: pincode-drempel, sjablonen met editor en live voorbeeld, en de
// instellingen van het profiel. Lezen en schrijven gaat alleen via het model.

import { DSL_SJABLONEN, DSL_REGELS, vul, qrsVoor, standaardSjabloon } from './sjablonen.js';
import { PROFIEL_STANDAARD } from './standaard.js';
import { teken, pasAan } from './opmaak.js';
import { tekenEditor, STANDAARD_FORMAAT } from './editor.js';
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

const meervoud = (n, een, meer) => `${n} ${n === 1 ? een : meer}`;
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

  const $ = (id) => root.getElementById(id);
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

  scherm.addEventListener('click', async (ev) => {
    if (!ev.target.closest('#beheerTerug')) return;
    await bewaarNu();
    terug();
  }, { signal });

  // ---------- indeling ----------
  let form, menu, waarnemer;
  function tekenBeheer() {
    scherm.innerHTML = kop + '<div class="beheer-romp">'
      + '<nav id="beheerMenu" class="kolom beheer-menu" aria-label="Onderdelen van beheer"></nav>'
      + '<section id="beheerForm" class="kolom beheer-form" aria-labelledby="beheerTitel"></section>'
      + '<aside id="beheerVoorbeeld" class="kolom beheer-voorbeeld" aria-labelledby="kopBeheerVoorbeeld">'
      + '<div class="kop"><h2 id="kopBeheerVoorbeeld">Voorbeeld</h2><span id="voorbeeldSjabloon" class="hint"></span></div>'
      + '<label class="veld"><span>Artikel</span><input type="text" id="voorbeeldArtikel" list="beheerArtikelen" autocomplete="off" placeholder="Zoek op naam of code"></label>'
      + '<datalist id="beheerArtikelen"></datalist>'
      + '<p id="voorbeeldInfo" class="hint"></p><div id="voorbeeldDoel" class="voorbeeld-doel"></div></aside>'
      + '</div><dialog id="beheerVraag" class="beheer-vraag"></dialog>';
    form = $('beheerForm');
    menu = $('beheerMenu');
    menu.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-onderdeel]'); if (b) open(b.dataset.onderdeel); }, { signal });
    menu.addEventListener('keydown', menuToetsen, { signal });
    form.addEventListener('click', formKlik, { signal });
    form.addEventListener('input', formInvoer, { signal });
    form.addEventListener('change', formInvoer, { signal });
    const kies = $('voorbeeldArtikel');
    kies.addEventListener('input', () => kiesArtikel(false), { signal });
    kies.addEventListener('change', () => kiesArtikel(true), { signal });
    kies.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); kiesArtikel(true); } }, { signal });
    if (typeof ResizeObserver === 'function') {
      let breedte = 0;
      waarnemer = new ResizeObserver(([e]) => { if (Math.abs(e.contentRect.width - breedte) > 2) { breedte = e.contentRect.width; voorbeeldLater(80); } });
      waarnemer.observe($('voorbeeldDoel'));
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
    menu.innerHTML = '<h2 class="menukop" id="menuSjablonen">Sjablonen</h2><ul aria-labelledby="menuSjablonen">'
      + sjablonen().map(s => knop('sjabloon:' + s.id, `<span class="nm">${esc(s.naam || s.id)}</span>`
        + (gewijzigd.has(s.id) ? '<span class="gewijzigd" title="Gewijzigd op deze pc"><span class="bh-sr">, gewijzigd op deze pc</span></span>' : ''))).join('')
      + knop('nieuw', '<span aria-hidden="true">+ </span>Nieuw sjabloon', 'nieuw')
      + '</ul><h2 class="menukop" id="menuInstellingen">Instellingen</h2><ul aria-labelledby="menuInstellingen">'
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
    if (id === 'nieuw') return nieuwSjabloon();
    if (id.startsWith('sjabloon:') && !sjabloonVan(id.slice(9))) id = 'sjabloon:' + (eersteSjabloon()?.id || '');
    st.onderdeel = id;
    scherm._laatsteOnderdeel = id;
    form.dataset.onderdeel = id;
    tekenMenu();
    form.scrollTop = 0;
    if (id.startsWith('sjabloon:')) tekenSjabloon(id.slice(9));
    else if (id === 'pincode') await tekenPincode();
    else if (id.startsWith('extra:')) await tekenExtra(extra.find(o => o.id === id));
    else form.innerHTML = formKop(ONDERDELEN.find(o => o.id === id)?.titel || id) + '<p class="hint">Volgt.</p>';
    voorbeeldLater(0);
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
    if (st.sjabloonId !== id) { st.keuze = null; $('voorbeeldArtikel').value = ''; }
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
  }

  function formInvoer() { /* per onderdeel ingevuld */ }

  // ---------- pincode instellen ----------
  async function tekenPincode() {
    const heeft = !!(await model.pcInstelling('pincode').catch(() => undefined));
    form.innerHTML = formKop('Pincode')
      + `<p>${heeft ? 'Op deze pc is een pincode ingesteld.' : 'Op deze pc is geen pincode ingesteld.'}</p>`
      + '<p class="hint">Een drempel, geen beveiliging. Geldt alleen op deze pc en wordt nooit gepubliceerd.</p>'
      + `<div class="raster smal"><label class="veld"><span>${heeft ? 'Nieuwe pincode' : 'Pincode'}</span>`
      + '<input type="password" id="nieuwePincode" inputmode="numeric" autocomplete="new-password"></label></div>'
      + '<p class="fout" data-melding="pincode" role="alert"></p>'
      + `<div class="acties links"><button type="button" class="primary" data-beheer="pin-zet">Pincode instellen</button>`
      + (heeft ? '<button type="button" data-beheer="pin-wis">Pincode wissen</button>' : '') + '</div>';
    form.querySelector('#nieuwePincode').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); zetPincode(); } });
  }
  async function zetPincode() {
    const v = form.querySelector('#nieuwePincode').value.trim();
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
    const v = $('voorbeeldArtikel').value.trim();
    const a = st.perLabel.get(v) || st.perCode.get(v.toLowerCase());
    if (a) { st.keuze = sleutelVan(a); voorbeeldLater(0); return; }
    if (definitief && !v) { st.keuze = null; voorbeeldLater(0); }
    else if (definitief) $('voorbeeldInfo').textContent = `Geen artikel "${v}" gevonden.`;
  }

  function pastBij(sj, a, regels) {
    if (a.combinatie) return false;
    if (sj.opmaak === 'qrlabel') return true;
    if (sj.opmaak === 'locatie') return !!a.locatie;
    if (a.sjabloon) return a.sjabloon === sj.id;
    return standaardSjabloon(a, 'bordje', regels) === sj.id;
  }

  function voorbeeldArtikel(sj) {
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

  function voorbeeldSjabloon() {
    if (st.onderdeel?.startsWith('sjabloon:') && st.werkSjabloon) return st.werkSjabloon;
    return sjabloonVan(st.sjabloonId) || sjablonen().find(s => s.opmaak === 'staand') || eersteSjabloon();
  }

  let voorbeeldTimer, voorbeeldBeurt = 0;
  function voorbeeldLater(ms = WACHT) {
    clearTimeout(voorbeeldTimer);
    voorbeeldTimer = setTimeout(tekenVoorbeeld, ms);
  }
  async function tekenVoorbeeld() {
    if (gestopt || !$('voorbeeldDoel')) return;
    const beurt = ++voorbeeldBeurt;
    const doel = $('voorbeeldDoel'), info = $('voorbeeldInfo');
    const sj = voorbeeldSjabloon();
    if (!sj) { doel.replaceChildren(); info.textContent = ''; return; }
    const e = model.effectief();
    const { a, hoe } = voorbeeldArtikel(sj);
    $('voorbeeldSjabloon').textContent = `${sj.naam || sj.id} · ${sj.formaat.b} × ${sj.formaat.h} mm`;
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
    scherm.innerHTML = kop + `<div class="beheer-poort"><form id="pinForm" class="kolom" autocomplete="off">`
      + `<h2>Pincode</h2><p class="hint">Beheer is afgeschermd op deze pc.</p>`
      + `<label class="veld"><span>Pincode</span><input type="password" id="pincode" inputmode="numeric" autocomplete="off"></label>`
      + `<p id="pinFout" class="fout" role="alert"></p>`
      + `<div class="acties"><button type="submit" class="primary">Openen</button></div></form></div>`;
    $('pinForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const invoer = $('pincode');
      if (invoer.value.trim() === String(pin)) { tekenBeheer(); return; }
      $('pinFout').textContent = 'Onjuiste pincode';
      invoer.value = '';
      invoer.focus();
    }, { signal });
    $('pincode').focus();
  }


  if (pin) tekenPoort();
  else tekenBeheer();
  return api;
}
