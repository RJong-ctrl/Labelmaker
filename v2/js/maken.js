// Maken: een leeg formulier om een bordje, strook of label te maken. Een artikel
// opzoeken (of scannen) vult de velden in; alles blijft aanpasbaar.

import { vul, ontbrekend, standaardSjabloon, veldwaarde, natuurlijkeWaarde, RANDKLEUREN, GROEPEN, groepVan, SUBGROEPEN, subgroepVan, GEEN_QR, zoekScanArtikelen, scanRegels } from './sjablonen.js';
import { teken, pasAan } from './opmaak.js';
import { veldInvoer, vraagReeks } from './dialogen.js';
import { leesReeks, zoneKleur } from './reeks.js';
import { esc } from './html.js';

const PX = 96 / 25.4;
const LEEG = { id: '__nieuw', naam: '', code: '', qr: '', exemplaren: [], pad: '', map: '', locatie: '', soort: 'bulk', type: '', combinatie: false, aantal: 0 };
const INHOUDTIP = '<p class="inhoudtip"><b>2 naam</b> = aantal · <b>HOOFDLETTERS</b> of eindigend op <b>:</b> = kopje · '
  + '<b>↳</b>, <b>&gt;</b> of <b>-</b> vooraan = notitie onder het artikel erboven · <b>\'</b> vooraan = nooit een aantal (\'19 inch rack)</p>';
const BRON = { kolom: 'uit het artikel', naam: 'uit de naam', exemplaar: 'uit de kist' };
const norm = (s) => String(s ?? '').toLowerCase().replace(/×/g, 'x').replace(/,/g, '.').replace(/\s+/g, ' ').trim();

/**
 * h = { model, E, sjabloon(id), artikelen(), perId(), qrIndex(), voegToe(printer, item), vervang(printer, index, item),
 *       naarPrinter(printer), melding(tekst, fout), bewaarVel(), tekenAlles() }
 */
export function startMaken(root, h) {
  const doel = root.getElementById('maken');
  const m = { kiezen: false, onthouden: {}, artikel: null, sjabloonId: 'auto', waarden: {}, bewerkt: new Set(), qr: '', qrBewerkt: false, geenQr: false, qrVorig: '', vanRij: null, perExemplaar: false, aantal: 1 };

  const sjabloonId = () => (m.sjabloonId !== 'auto' ? m.sjabloonId
    : m.artikel ? standaardSjabloon(m.artikel, 'bordje', h.E().regels) : (h.sjabloon('leeg-staand') ? 'leeg-staand' : h.E().sjablonen[0]?.id));
  const huidigSjabloon = () => h.sjabloon(sjabloonId()) || h.E().sjablonen[0];
  const basisArtikel = () => m.artikel || LEEG;
  const artikelAanv = () => (m.artikel ? h.E().aanvullingen[m.artikel.id] || {} : {});
  const overrides = () => {
    const o = { ...artikelAanv(), ...m.onthouden };
    for (const k of m.bewerkt) o[k] = m.waarden[k] ?? '';
    return o;
  };
  // Velden die per artikel onthouden worden (bijv. extra inhoud van een kist): geen eigen versie,
  // maar een aanvulling op het artikel zelf.
  const onthoudVeld = (naam) => !!m.artikel && !m.artikel.los && !!huidigSjabloon()?.velden?.some(v => v.naam === naam && v.onthouden);
  // Materiaalbordje met bekende kisten: standaard de QR van de eerste kist (die past bij de inhoud).
  const kistQr = () => (huidigSjabloon()?.velden?.some(v => v.herkomst?.type === 'exemplaar') ? Object.keys(m.artikel?.kisten || {})[0] : '');
  const qrWaarde = () => (m.qrBewerkt ? m.qr : (kistQr() || m.artikel?.qr || m.artikel?.exemplaren?.[0] || ''));
  // Een QR van het artikel zelf (artikel-QR of een van zijn exemplaren) is geen eigen wijziging.
  const qrEigen = () => m.qrBewerkt && !(m.artikel && (m.qr === (m.artikel.qr || '') || (m.artikel.exemplaren || []).includes(m.qr)));

  /** Sjablonen per soort, en daarbinnen per rijtje (subgroep); lege overgeslagen. Lege bordjes en kaartjes zonder sticker achteraan. */
  const achter = (s) => (String(s.id).startsWith('leeg-') || s.sticker === false ? 1 : 0);
  const perGroep = () => GROEPEN.map(g => [g, SUBGROEPEN.filter(sg => sg.groep === g.sleutel).map(sg => [sg,
    h.E().sjablonen.filter(s => subgroepVan(s) === sg).map((s, i) => [s, i])
      .sort((a, b) => achter(a[0]) - achter(b[0]) || a[1] - b[1]).map(([s]) => s)])
    .filter(([, l]) => l.length)]).filter(([, subs]) => subs.length);
  const groepTitel = (g) => (g.sleutel === 'labels' ? `Labels · ${h.E().printers?.label?.naam || 'labelprinter'}` : g.titel);


  // Beginscherm: tegels met de sjablonen (en bovenaan zoeken/scannen). Een tegel of een artikel opent het formulier.
  const opStart = () => m.kiezen || (!m.artikel && m.sjabloonId === 'auto' && !m.vanRij);

  // ---------- concept: wat je aan het maken bent, blijft na F5 staan (Robin, 24 nov) ----------
  // Alleen in deze browser (localStorage), per profiel; namen, waarden en QR, geen prijzen (die kent Maken niet).
  const CONCEPT = `labelmaker-concept-${h.profielId || 'dsl'}`;
  let conceptTimer = 0;
  function bewaarConcept() {
    clearTimeout(conceptTimer);
    conceptTimer = setTimeout(() => {
      try {
        if (opStart()) { localStorage.removeItem(CONCEPT); return; }
        localStorage.setItem(CONCEPT, JSON.stringify({ sjabloonId: m.sjabloonId, artikel: m.artikel?.id || null, waarden: m.waarden,
          bewerkt: [...m.bewerkt], qr: m.qr, qrBewerkt: m.qrBewerkt, geenQr: m.geenQr, qrVorig: m.qrVorig, aantal: m.aantal,
          perExemplaar: m.perExemplaar, vanRij: m.vanRij }));
      } catch { /* geen opslag: dan niet */ }
    }, 150);
  }
  function herstelConcept() {
    try {
      const c = JSON.parse(localStorage.getItem(CONCEPT) || 'null');
      if (!c || typeof c !== 'object') return;
      if (c.sjabloonId !== 'auto' && !h.sjabloon(c.sjabloonId)) return;
      const artikel = c.artikel ? h.perId().get(c.artikel) || null : null;
      if (c.artikel && !artikel) return;   // artikel bestaat niet meer: niet half herstellen
      Object.assign(m, {
        sjabloonId: String(c.sjabloonId), artikel, waarden: c.waarden && typeof c.waarden === 'object' ? c.waarden : {},
        bewerkt: new Set(Array.isArray(c.bewerkt) ? c.bewerkt.map(String) : []), qr: String(c.qr ?? ''), qrBewerkt: !!c.qrBewerkt,
        geenQr: !!c.geenQr, qrVorig: String(c.qrVorig ?? ''), aantal: Math.max(1, Math.min(999, Number(c.aantal) || 1)),
        perExemplaar: !!c.perExemplaar, vanRij: c.vanRij && typeof c.vanRij === 'object' ? c.vanRij : null,
      });
    } catch { /* kapot of geen opslag: gewoon leeg beginnen */ }
  }

  function zoekveld() {
    return '<div class="zoeken"><label class="veld"><span>Artikel zoeken of scannen</span>'
      + '<input type="search" id="makenZoek" placeholder="Naam, code of QR" autocomplete="off"></label>'
      + '<ul id="makenTreffers" class="treffers" role="listbox" aria-label="Gevonden artikelen"></ul></div>';
  }
  const artikelChip = (a) => (a ? `<div id="makenArtikel" class="gekoppeld"><b>${esc(a.naam)}</b><span class="hint">${esc(a.code || '')}</span><button type="button" class="klein" id="makenLos" aria-label="Artikel loskoppelen">×</button></div>` : '<div id="makenArtikel" hidden></div>');

  function tekenTegels() {
    bewaarConcept();   // terug bij het begin: geen concept meer
    doel.innerHTML = zoekveld() + artikelChip(m.artikel)
      + '<div class="kiesblok"><button type="button" id="makenKies" class="primary">Sjabloon kiezen</button>'
      + '<p class="hint">Bij een gescand artikel wordt het sjabloon automatisch gekozen.</p></div>';
    tekenVoorbeeld();
  }

  // Sjabloonkeuze als venster: per printer een raster met voorbeeld en naam.
  function kiesvenster() {
    let dlg = root.getElementById('sjabloonVenster');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'sjabloonVenster';
      dlg.className = 'sjabloonkeuze';
      dlg.setAttribute('aria-labelledby', 'sjabloonVensterKop');
      (root.body || document.body).appendChild(dlg);
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg || e.target.closest('[data-sluit]')) { dlg.close(); return; }
        const tegel = e.target.closest('[data-tegel]');
        if (!tegel) return;
        dlg.close();
        m.sjabloonId = tegel.dataset.tegel; m.kiezen = false;
        tekenFormulier();
        root.querySelector('#makenVelden input, #makenVelden textarea, #makenVelden select')?.focus();
      });
    }
    const tegel = (s) => `<button type="button" class="tegel${s.id === m.sjabloonId ? ' gekozen' : ''}" data-tegel="${esc(s.id)}"><span class="duim" data-duim="${esc(s.id)}"></span><span class="tnaam">${esc(s.naam)}</span></button>`;
    // Met een artikel: bovenaan 'Automatisch' (het sjabloon dat bij het artikel hoort).
    const auto = m.artikel ? `<section class="tegelgroep"><h3 class="tegelkop">Bij dit artikel</h3><div class="subgroepen"><div class="subgroep"><div class="tegels">`
      + `<button type="button" class="tegel auto${m.sjabloonId === 'auto' ? ' gekozen' : ''}" data-tegel="auto"><span class="tnaam"><b>Automatisch</b><br>volgt het artikel</span></button></div></div></div></section>` : '';
    dlg.innerHTML = '<div class="kop"><h2 id="sjabloonVensterKop">Sjabloon kiezen</h2><button type="button" class="klein" data-sluit aria-label="Sluiten">×</button></div>'
      + '<div id="makenTegels">' + auto + perGroep().map(([g, subs]) => `<section class="tegelgroep"><h3 class="tegelkop">${esc(groepTitel(g))}</h3><div class="subgroepen">`
        + subs.map(([sg, lijst]) => `<div class="subgroep"><h4 class="subkop">${esc(sg.titel)}</h4><div class="tegels">${lijst.map(tegel).join('')}</div></div>`).join('')
        + '</div></section>').join('') + '</div>';
    dlg.showModal();
    tekenDuimen();
  }

  // Kleine voorbeelden op de tegels (één keer per sjabloon, daarna uit het geheugen).
  const duimen = new Map();
  async function tekenDuimen() {
    const voorbeeld = { ...LEEG, naam: 'Voorbeeld', code: 'AB1234', locatie: 'J-2-1', qr: 'voorbeeld' };
    for (const vak of root.querySelectorAll('#makenTegels [data-duim]')) {
      const sj = h.sjabloon(vak.dataset.duim);
      if (!sj) continue;
      const sleutel = JSON.stringify(sj) + JSON.stringify(h.E().huisstijl);
      const s = Math.min(84 / (sj.formaat.b * PX), 58 / (sj.formaat.h * PX));
      const kader = document.createElement('div');
      kader.className = 'vb';
      kader.style.width = (sj.formaat.b * PX * s).toFixed(1) + 'px';
      kader.style.height = (sj.formaat.h * PX * s).toFixed(1) + 'px';
      let el;
      if (duimen.get(sj.id)?.sleutel === sleutel) { kader.innerHTML = duimen.get(sj.id).html; el = kader.firstElementChild; }
      else {
        el = teken(vul(sj, voorbeeld, { Code: 'A1', Wat: 'Voorbeeld' }, 'voorbeeld'), h.E().huisstijl);
        el.style.transform = `scale(${s})`;
        el.style.transformOrigin = '0 0';
        kader.appendChild(el);
      }
      vak.replaceChildren(kader);
      if (duimen.get(sj.id)?.sleutel !== sleutel) {
        await pasAan(el);
        duimen.set(sj.id, { sleutel, html: kader.innerHTML });
      }
    }
  }

  function tekenFormulier() {
    if (opStart()) { tekenTegels(); return; }
    const a = m.artikel;
    doel.innerHTML = zoekveld()
      // Wisselen gaat via dezelfde pop-up als kiezen (Robin, 23 nov).
      + `<div class="makenkop"><span class="kopje">Sjabloon</span><button type="button" id="makenSoort" class="soortknop" data-sjabloon="${esc(m.sjabloonId)}" aria-haspopup="dialog">`
      + `<span>${m.sjabloonId === 'auto' ? 'Automatisch: ' : ''}${esc(huidigSjabloon()?.naam || '')}</span><span aria-hidden="true">▾</span></button></div>`
      + artikelChip(a)
      + '<div id="makenVelden" class="velden"></div>'
      + '<div class="knoppenrij"><label class="vink"><input type="checkbox" id="makenBewaar"> Bewaren onder Losse items</label>'
      + (kanReeks() && !a && !m.vanRij ? '<button type="button" id="makenReeks">Uit lijst…</button>' : '')
      + `<button type="button" id="makenLeeg">Leegmaken</button><button type="button" id="makenOpVel" class="primary">${m.vanRij ? 'Bijwerken' : 'Op printvel'}</button></div>`;
    tekenVelden();
  }

  // ---------- QR: op elk sjabloon dezelfde regel (Robin, 23 nov) ----------
  // Veld QR-code + vinkje 'Zonder QR-code'. Haalt het sjabloon de QR uit een veld (wandbord: Locatie),
  // dan volgt het veld die waarde en schakelt het vinkje het QR-keuzeveld van het sjabloon.
  const qrSchakelaar = (sj) => sj?.velden?.find(v => v.qrSchakelaar);
  const qrAfgeleid = (sj) => !!sj?.plekken?.qr?.length;
  function zonderQr(sj) {
    const k = qrSchakelaar(sj);
    if (!k) return m.geenQr;
    const w = m.bewerkt.has(k.naam) ? (m.waarden[k.naam] ?? '') : (artikelAanv()[k.naam] ?? '');
    return w === 'nee' || (!!k.standaardZonder && w !== 'ja');
  }
  function qrTekst(sj) {
    if (!qrAfgeleid(sj)) return m.geenQr ? m.qrVorig : qrWaarde();
    const w = vul(sj, basisArtikel(), overrides(), qrWaarde()).waarden;
    return sj.plekken.qr.map(x => (typeof x === 'string' ? x : (w[x.veld] ?? ''))).join('');
  }
  function qrRegel(sj) {
    // Scanlijst: de QR-codes komen per artikel uit Rentman, geen eigen QR-regel.
    if (!sj || sj.zonderQrRegel) return '';
    const af = qrAfgeleid(sj), zonder = zonderQr(sj);
    const uitleg = af ? `volgt ${esc(sj.plekken.qr.find(x => x.veld)?.veld || '')}` : '(leeg = geen)';
    return `<div class="veld qrveld"><label class="veld"><span>QR-code <small>${uitleg}</small></span>`
      + `<input type="text" name="__qr" value="${esc(qrTekst(sj))}" autocomplete="off"${af || zonder ? ' disabled' : ''}></label>`
      + `<label class="vink"><input type="checkbox" name="__geenqr"${zonder ? ' checked' : ''}> Zonder QR-code</label></div>`;
  }
  function zetZonderQr(aan) {
    const sj = huidigSjabloon(), k = qrSchakelaar(sj);
    if (k) { m.waarden[k.naam] = aan ? (k.standaardZonder ? '' : 'nee') : (k.standaardZonder ? 'ja' : ''); m.bewerkt.add(k.naam); }
    else if (aan) { m.qrVorig = qrWaarde(); m.qr = GEEN_QR; m.qrBewerkt = true; m.geenQr = true; }
    else { m.qr = m.qrVorig; m.qrBewerkt = true; m.geenQr = false; }
    tekenVelden();
  }

  function tekenVelden() {
    const sj = huidigSjabloon();
    const art = basisArtikel(), o = overrides();
    const velden = (sj?.velden || []).filter(v => !v.qrSchakelaar).map(v => {
      const waarde = m.bewerkt.has(v.naam) ? (m.waarden[v.naam] ?? '')
        : Object.hasOwn(m.onthouden, v.naam) ? m.onthouden[v.naam] : veldwaarde(v, art, artikelAanv(), qrWaarde());
      const vorm = {
        ...v, verplicht: false, bron: m.artikel ? (v.onthouden && !m.artikel.los ? 'onthouden voor dit artikel' : (BRON[v.herkomst.type] || '')) : '',
        ...(v.herkomst.patroon === 'kabel' ? { keuzes: [{ waarde: 'ja', tekst: 'Ja' }, { waarde: '', tekst: 'Nee' }] } : {}),
      };
      let html = veldInvoer(vorm, waarde, { verplicht: false });
      // Scanlijst: elke regel kiest uit de ingelezen artikelen (naam of artikelnummer).
      if (v.kiesArtikel) html = html.replace('<input type="text"', '<input type="text" list="scanArtikelen" autocomplete="off"');
      // Korte uitleg onder het (eerste) inhoudsveld, altijd zichtbaar (Robin, 26 nov).
      const tip = v.naam === [].concat(sj.lijstVeld || [])[0] ? INHOUDTIP
        : v.naam === 'Artikel 10' && sj.opmaak === 'scanlijst' ? '<p class="inhoudtip" id="scanInfo"></p>' + scanKeuzelijst() : '';
      // Scanlijst: titel over de hele breedte, dan de 10 regels in 2 kolommen (zoals op het vel).
      const breed = v.meerregelig || (sj.opmaak === 'scanlijst' && v.naam === 'Titel');
      return (breed ? html.replace('class="veld"', 'class="veld breed"') : html) + tip;
    });
    void o;
    // Randkleur zelf kiezen kan op elk A4-bordje en elke strook (leeg = wat het sjabloon zegt).
    if (sj?.printer === 'a4' && !sj.kleuren?.rand?.vast && !sj.velden.some(v => v.naam === 'Randkleur')) {
      const w = m.bewerkt.has('Randkleur') ? (m.waarden.Randkleur ?? '') : (artikelAanv().Randkleur || '');
      velden.push(veldInvoer({ naam: 'Randkleur', keuzes: [{ waarde: '', tekst: 'Automatisch' }, ...RANDKLEUREN.map(k => ({ waarde: k, tekst: k }))] }, w, { verplicht: false }));
    }
    // Maat netjes onder elkaar: staat breedte/lengte rechts, dan ruilt Hoogte met het veld erna,
    // zodat Hoogte in dezelfde kolom eronder komt (geen breed veld ertussen).
    const namen = (sj?.velden || []).map(v => v.naam);
    const hi = namen.indexOf('Hoogte');
    const maatVeld = hi > 0 && sj.velden[hi - 1].herkomst?.patroon === 'breedte';
    if (maatVeld && hi + 1 < velden.length && !velden.slice(0, hi + 2).some(x => x.includes('veld breed'))) {
      // positie in het raster (2 kolommen): lengte/breedte rechts = oneven index
      if ((hi - 1) % 2 === 1) [velden[hi], velden[hi + 1]] = [velden[hi + 1], velden[hi]];
    }
    const ex = m.artikel?.exemplaren?.length ? `<label class="vink breed"><input type="checkbox" id="makenPerEx"${m.perExemplaar ? ' checked' : ''}> Eén per exemplaar (${m.artikel.exemplaren.length})</label>` : '';
    root.getElementById('makenVelden').innerHTML = velden.join('')
      + qrRegel(sj)
      + `<label class="veld"><span>Aantal</span><input type="number" name="__aantal" min="1" max="999" value="${m.aantal}"></label>` + ex;
    vulInhoud();
    tekenVoorbeeld();
  }

  // Het Inhoud-veld (of anders het eerste tekstvak) neemt de vrije ruimte onder in het paneel (Robin, 23 nov).
  function vulInhoud() {
    const paneel = root.getElementById('maken');
    const ta = paneel?.querySelector('#makenVelden textarea[name="Inhoud"]') || paneel?.querySelector('#makenVelden textarea');
    if (!ta || !paneel.offsetParent) return;
    ta.style.height = '';
    const basis = ta.getBoundingClientRect().height;
    const onder = Math.max(...[...paneel.children].map(e => e.getBoundingClientRect().bottom));
    const ruimte = paneel.getBoundingClientRect().bottom - parseFloat(getComputedStyle(paneel).paddingBottom || 0) - onder - 2;
    if (ruimte > 4) ta.style.height = (basis + ruimte) + 'px';
  }
  if (typeof ResizeObserver === 'function' && root.getElementById('maken')) {
    let wacht = 0;
    new ResizeObserver(() => { cancelAnimationFrame(wacht); wacht = requestAnimationFrame(vulInhoud); }).observe(root.getElementById('maken'));
  }

  /** Keuzelijst voor de regels van de scanlijst: alle ingelezen artikelen (naam, met het artikelnummer erbij). */
  function scanKeuzelijst() {
    const opties = (h.E().artikelen || []).filter(a => a.naam)
      .map(a => `<option value="${esc(a.naam)}" label="${esc(a.code || '')}"></option>`).join('');
    return `<datalist id="scanArtikelen">${opties}</datalist>`;
  }

  /** Onder de regels van de scanlijst: hoeveel gevonden, wat niet, en welke geen QR in Rentman hebben. */
  function toonScanInfo(sj, inhoud) {
    const info = root.getElementById('scanInfo');
    if (!info || sj.opmaak !== 'scanlijst') return;
    const r = zoekScanArtikelen(scanRegels(inhoud.waarden || {}));
    const n = r.items.length;
    const delen = [n ? `${n} ${n === 1 ? 'artikel' : 'artikelen'}`
      : 'Per regel één artikel: kies uit de lijst of typ het artikelnummer.'];
    if (r.nietGevonden.length) delen.push(`Niet gevonden: ${r.nietGevonden.join(', ')}`);
    if (r.zonderQr.length) delen.push(`Zonder QR in Rentman: ${r.zonderQr.map(a => a.naam).join(', ')}`);
    info.innerHTML = delen.map(d => `<span>${esc(d)}</span>`).join('<br>');
    info.classList.toggle('let-op', r.nietGevonden.length > 0 || r.zonderQr.length > 0);
  }

  let beurt = 0;
  async function tekenVoorbeeld() {
    bewaarConcept();
    const mijn = ++beurt;
    const sj = huidigSjabloon();
    const vak = root.getElementById('makenVoorbeeld');
    if (!sj || !vak) return;
    // Leeg formulier: geen voorbeeld, dan krijgt het printvel de hele kolom.
    const leeg = opStart() || (!m.artikel && ![...m.bewerkt].some(k => String(m.waarden[k] ?? '').trim()) && !(m.qrBewerkt && m.qr));
    const kader = root.getElementById('makenVak');
    if (kader) kader.dataset.leeg = leeg ? '1' : '';
    const inhoud = vul(sj, basisArtikel(), overrides(), qrWaarde());
    toonScanInfo(sj, inhoud);
    const el = teken(inhoud, h.E().huisstijl);
    // Het voorbeeld staat bovenin de kolom Voorbeeld en neemt hooguit de halve kolomhoogte.
    const kolom = root.getElementById('voorbeeld');
    const breedte = Math.max(160, vak.clientWidth - 24);
    const hoogte = Math.max(160, (kolom?.clientHeight || 600) * 0.5 - 40);
    // Lamineerhoes (A5-materiaalbordjes): donkergrijs eromheen, zodat je ziet hoe het bordje erin past (Robin, 26 nov).
    const hoes = sj.hoes && sj.hoes.b >= inhoud.formaat.b && sj.hoes.h >= inhoud.formaat.h ? sj.hoes : null;
    const buiten = hoes || inhoud.formaat;
    const s = Math.min(1.3, breedte / (buiten.b * PX), hoogte / (buiten.h * PX));
    const d = document.createElement('div');
    d.className = 'vb' + (hoes ? ' hoes' : '');
    d.style.width = (buiten.b * PX * s).toFixed(1) + 'px';
    d.style.height = (buiten.h * PX * s).toFixed(1) + 'px';
    el.style.transform = `scale(${s})`;
    el.style.transformOrigin = '0 0';
    if (hoes) {
      el.style.position = 'absolute';
      el.style.left = ((hoes.b - inhoud.formaat.b) / 2 * PX * s).toFixed(1) + 'px';
      el.style.top = ((hoes.h - inhoud.formaat.h) / 2 * PX * s).toFixed(1) + 'px';
    }
    d.appendChild(el);
    const randB = (hoes ? (hoes.b - inhoud.formaat.b) / 2 : 0), randH = (hoes ? (hoes.h - inhoud.formaat.h) / 2 : 0);
    const fmt = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
    if (hoes) {
      // Hoes en onderschrift onder elkaar, in één blok (het voorbeeldvak zet zijn kinderen naast elkaar).
      const blok = document.createElement('div');
      blok.className = 'hoesblok';
      blok.append(d, Object.assign(document.createElement('p'), { className: 'hoesmaat hint',
        textContent: `${hoes.naam} ${hoes.b} × ${hoes.h} mm · bordje ${inhoud.formaat.b} × ${inhoud.formaat.h} mm · rand ${fmt(randB)} / ${fmt(randH)} mm` }));
      vak.replaceChildren(blok);
    } else vak.replaceChildren(d);
    await pasAan(el);
    if (mijn !== beurt) return;
  }

  // ---------- opzoeken ----------
  function treffers(tekst) {
    const woorden = norm(tekst).split(' ').filter(Boolean);
    if (!woorden.length) return [];
    const uit = [];
    for (const a of h.artikelen()) {
      const t = norm([a.naam, a.code, a.qr, ...(a.exemplaren || []), a.locatie].join(' '));
      if (woorden.every(w => t.includes(w))) { uit.push(a); if (uit.length >= 8) break; }
    }
    return uit;
  }
  function tekenTreffers() {
    const lijst = treffers(root.getElementById('makenZoek').value);
    root.getElementById('makenTreffers').innerHTML = lijst.map(a => `<li role="option" data-id="${esc(a.id || a.code)}">${esc(a.naam)}<span class="sub">${esc([a.code, a.locatie].filter(Boolean).join(' · '))}</span></li>`).join('');
  }
  function koppel(a, exemplaar = null) {
    m.artikel = a;
    m.bewerkt.clear(); m.waarden = {}; m.onthouden = {};
    m.qrBewerkt = !!exemplaar; m.qr = exemplaar || '';
    m.perExemplaar = false;
    m.kiezen = false;
    tekenFormulier();
    root.getElementById('makenOpVel')?.focus();
  }
  /** Scan of exacte QR/code: artikel koppelen. Geeft true als het lukte. */
  function scan(tekst) {
    const ruw = String(tekst || '').trim();
    const hit = h.qrIndex().get(ruw.toLowerCase()) || (h.perId().has(ruw) ? { id: ruw, exemplaar: null } : null);
    if (!hit) return false;
    koppel(h.perId().get(hit.id), hit.exemplaar);
    return true;
  }

  /** Leeg formulier. behoud = id van het sjabloon dat open blijft (na Op printvel: verder met hetzelfde soort). */
  function reset(behoud = 'auto') {
    Object.assign(m, { kiezen: false, onthouden: {}, artikel: null, sjabloonId: behoud, waarden: {}, bewerkt: new Set(), qr: '', qrBewerkt: false, geenQr: false, qrVorig: '', vanRij: null, perExemplaar: false, aantal: 1 });
    tekenFormulier();
    root.getElementById('makenZoek')?.focus();
  }

  async function bewaarOnthouden(naam) {
    if (!m.artikel || !Object.hasOwn(m.onthouden, naam)) return;
    const waarde = String(m.onthouden[naam] ?? '').trim();
    const huidig = { ...artikelAanv() };
    const veld = huidigSjabloon()?.velden?.find(v => v.naam === naam);
    // Gelijk aan wat Rentman zegt: niets onthouden, dan volgt het bordje een nieuwe export vanzelf.
    const vanRentman = veld ? natuurlijkeWaarde(veld, m.artikel, qrWaarde()) : '';
    if (waarde && waarde !== vanRentman) huidig[naam] = waarde; else delete huidig[naam];
    for (const k of veld?.erbij || []) delete huidig[k];   // oude 'Extra inhoud' zit nu in het veld zelf
    await h.model.vervangAanvulling(m.artikel.id, huidig);
    delete m.onthouden[naam];
    tekenVoorbeeld();
  }

  // ---------- op printvel ----------
  async function opVel() {
    for (const naam of Object.keys(m.onthouden)) await bewaarOnthouden(naam);
    const sj = huidigSjabloon();
    if (!sj) return;
    const art = basisArtikel(), o = overrides();
    const mist = ontbrekend(sj, art, o);
    if (mist.length) { h.melding(`Vul eerst in: ${mist.map(v => v.naam).join(', ')}.`, true); return; }
    const inhoud = vul(sj, art, o, qrWaarde());
    if (!m.artikel && !inhoud.titel) { h.melding('Vul eerst een titel of naam in, of zoek een artikel op.', true); return; }
    const aantal = Math.max(1, Math.min(999, parseInt(root.querySelector('#makenVelden [name="__aantal"]')?.value, 10) || 1));
    const bewaar = root.getElementById('makenBewaar').checked;
    const ongewijzigd = m.artikel && !m.bewerkt.size && !qrEigen() && !bewaar && !m.artikel.los;
    let items;
    if (ongewijzigd || (m.artikel?.los && !m.bewerkt.size && !qrEigen())) {
      const qrs = m.perExemplaar && m.artikel.exemplaren?.length ? m.artikel.exemplaren : [qrWaarde()];
      items = qrs.map(qr => ({ sjabloon: sj.id, artikel: m.artikel.id, qr, aantal }));
    } else {
      // Eigen versie: een los item met de wijzigingen; het artikel zelf blijft zoals het is.
      const id = 'los-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const a = m.artikel || LEEG;
      const naam = inhoud.titel || a.naam || 'Bordje';
      const qrs = m.perExemplaar && a.exemplaren?.length && !m.qrBewerkt ? a.exemplaren : [qrWaarde()];
      const item = {
        id, naam: m.artikel ? a.naam : naam, code: a.code || '', qr: qrs[0] || '', exemplaren: qrs.length > 1 ? qrs : [],
        pad: a.pad || '', map: 'Losse items', locatie: a.locatie || '', soort: qrs.length > 1 ? 'serie' : 'bulk',
        type: 'Los item', combinatie: false, aantal: 0, sjabloon: sj.id, ...(m.artikel ? { bron: m.artikel.id } : {}), ...(bewaar ? {} : { tijdelijk: true }),
      };
      await h.model.zetLosItem(item);
      await h.model.vervangAanvulling(id, o);
      h.indexeer();
      items = qrs.map(qr => ({ sjabloon: sj.id, artikel: id, qr, aantal }));
    }
    if (m.vanRij) h.vervang(m.vanRij.printer, m.vanRij.index, items);
    else for (const it of items) h.voegToe(sj.printer, it);
    await h.bewaarVel();
    await h.ruimOp();
    h.naarPrinter(sj.printer);
    h.tekenAlles();
    h.melding(m.vanRij ? 'Bijgewerkt op het printvel.' : `Op het printvel gezet${bewaar ? ' en bewaard onder Losse items' : ''}.`);
    // Het label blijft staan (Robin, 16 nov): nog eens klikken zet er nog een op, Leegmaken begint opnieuw.
    tekenFormulier();
    root.getElementById('makenOpVel')?.focus();
  }

  // 'Uit lijst…' bij wandborden en bij sjablonen met een eigen locatieveld (stellingbord; vroeger 'Code').
  const kanReeks = () => { const sj = huidigSjabloon(); return sj?.opmaak === 'wand' || !!sj?.velden?.some(v => ['Locatie', 'Code'].includes(v.naam) && v.herkomst?.type === 'aanvulling'); };

  /** Bordjes uit een geplakte lijst (bijv. de magazijnindeling): per code een los item op het printvel. */
  async function reeksOpVel() {
    const sj = huidigSjabloon();
    const eigenKleuren = !!sj.kleuren?.rand?.begin;   // sjabloon kleurt zelf per zone
    const antwoord = await vraagReeks(root.getElementById('aanvulling'), sj.naam, { kleurKeuze: !eigenKleuren });
    if (!antwoord) return;
    const lijst = leesReeks(antwoord.tekst);
    if (!lijst.length) { h.melding('Geen regels gevonden in de lijst.', true); return; }
    const veld = (naam) => sj.velden.some(v => v.naam === naam);
    for (const { code, wat } of lijst) {
      // vaste id per sjabloon en code: opnieuw plakken werkt het bordje bij in plaats van een tweede te maken
      const id = `los-${sj.id}-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      await h.model.zetLosItem({
        id, naam: wat ? `${code} · ${wat}` : code, code, qr: code, exemplaren: [], pad: '', map: 'Magazijnindeling', locatie: code,
        soort: 'bulk', type: 'Los item', combinatie: false, aantal: 0, sjabloon: sj.id, ...(antwoord.bewaar ? {} : { tijdelijk: true }),
      });
      const kleur = antwoord.kleur && !eigenKleuren ? zoneKleur(code) : '';
      await h.model.vervangAanvulling(id, {
        // Locatie/Inhoud (sinds 23 nov); Code/Wat voor eigen sjablonen van vroeger
        ...(veld('Locatie') ? { Locatie: code } : {}), ...(veld('Inhoud') ? { Inhoud: wat } : {}),
        ...(veld('Code') ? { Code: code } : {}), ...(veld('Wat') ? { Wat: wat } : {}),
        ...(kleur ? { Randkleur: kleur } : {}),
      });
      h.voegToe(sj.printer, { sjabloon: sj.id, artikel: id, qr: code, aantal: 1 });
    }
    h.indexeer();
    await h.bewaarVel();
    h.naarPrinter(sj.printer);
    h.tekenAlles();
    h.melding(`${lijst.length} ${lijst.length === 1 ? 'bordje' : 'bordjes'} op het printvel gezet${antwoord.bewaar ? ' en bewaard onder Losse items' : ''}.`);
  }

  /** Een regel van het printvel openen om aan te passen. */
  function laad(item, printer, index) {
    const a = h.perId().get(item.artikel);
    Object.assign(m, { kiezen: false, onthouden: {}, artikel: null, waarden: {}, bewerkt: new Set(), qr: '', qrBewerkt: false, geenQr: false, qrVorig: '', perExemplaar: false, vanRij: { printer, index }, aantal: item.aantal || 1 });
    if (a?.los) {
      // los item: bronartikel (als dat er nog is) met de opgeslagen wijzigingen
      const bron = a.bron ? h.perId().get(a.bron) : null;
      m.artikel = bron || null;
      const aanv = h.E().aanvullingen[a.id] || {};
      for (const [k, v] of Object.entries(aanv)) { m.waarden[k] = v; m.bewerkt.add(k); }
      if (!bron) { m.waarden.Naam = m.waarden.Naam ?? a.naam; m.bewerkt.add('Naam'); }
      m.qr = item.qr; m.qrBewerkt = !bron || item.qr !== (bron.qr || ''); m.geenQr = item.qr === GEEN_QR; if (m.geenQr) m.qrVorig = bron?.qr || '';
    } else if (a) {
      m.artikel = a;
      m.qr = item.qr; m.qrBewerkt = item.qr !== (a.qr || ''); m.geenQr = item.qr === GEEN_QR; if (m.geenQr) m.qrVorig = a.qr || '';
    }
    m.sjabloonId = item.sjabloon;
    tekenFormulier();
  }

  // ---------- gebeurtenissen ----------
  let voorbeeldTimer;
  doel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'makenZoek') { tekenTreffers(); return; }
    if (t.name === '__aantal') { m.aantal = Math.max(1, parseInt(t.value, 10) || 1); return; }
    if (!t.name || t.name === '__geenqr') return;
    if (t.name === '__qr') { m.qr = t.value.trim(); m.qrBewerkt = true; }
    else if (onthoudVeld(t.name)) m.onthouden[t.name] = t.value;
    else { m.waarden[t.name] = t.value; m.bewerkt.add(t.name); }
    // QR die een veld volgt (Locatie): meteen meeschrijven
    const sj = huidigSjabloon(), qrVeld = root.querySelector('#makenVelden input[name="__qr"]');
    if (qrVeld && qrAfgeleid(sj) && sj.plekken.qr.some(x => x.veld === t.name)) qrVeld.value = qrTekst(sj);
    clearTimeout(voorbeeldTimer);
    voorbeeldTimer = setTimeout(tekenVoorbeeld, 150);
  });
  doel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'makenPerEx') { m.perExemplaar = t.checked; return; }
    if (t.name === '__geenqr') { zetZonderQr(t.checked); return; }
    if (t.name && onthoudVeld(t.name)) { bewaarOnthouden(t.name); return; }
    if (t.tagName === 'SELECT' && t.name) { m.waarden[t.name] = t.value; m.bewerkt.add(t.name); tekenVoorbeeld(); }
  });
  doel.addEventListener('keydown', (e) => {
    if (e.target.id !== 'makenZoek' || e.key !== 'Enter') return;
    e.preventDefault();
    if (!scan(e.target.value)) {
      const eerste = treffers(e.target.value)[0];
      if (eerste) koppel(eerste);
    }
  });
  doel.addEventListener('click', (e) => {
    const li = e.target.closest('#makenTreffers li');
    if (li) { koppel(h.perId().get(li.dataset.id)); return; }
    if (e.target.closest('#makenKies, #makenSoort')) { kiesvenster(); return; }
    if (e.target.closest('#makenLos')) { m.artikel = null; m.bewerkt.clear(); m.waarden = {}; m.onthouden = {}; m.qrBewerkt = false; tekenFormulier(); return; }
    if (e.target.closest('#makenReeks')) { reeksOpVel().catch(err => h.melding('Lijst verwerken mislukt: ' + err.message, true)); return; }
    if (e.target.closest('#makenLeeg')) { reset(m.artikel ? 'auto' : m.sjabloonId); return; }
    if (e.target.closest('#makenOpVel')) opVel().catch(err => h.melding('Op het printvel zetten mislukt: ' + err.message, true));
  });

  herstelConcept();
  tekenFormulier();
  return { laad, reset, scan, vernieuw: tekenFormulier };
}
