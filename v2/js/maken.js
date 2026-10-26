// Maken: een leeg formulier om een bordje, strook of label te maken. Een artikel
// opzoeken (of scannen) vult de velden in; alles blijft aanpasbaar.

import { vul, ontbrekend, standaardSjabloon, veldwaarde, RANDKLEUREN } from './sjablonen.js';
import { teken, pasAan } from './opmaak.js';
import { veldInvoer } from './dialogen.js';
import { esc } from './html.js';

const PX = 96 / 25.4;
const LEEG = { id: '__nieuw', naam: '', code: '', qr: '', exemplaren: [], pad: '', map: '', locatie: '', soort: 'bulk', type: '', combinatie: false, aantal: 0 };
const BRON = { kolom: 'uit het artikel', naam: 'uit de naam' };
const norm = (s) => String(s ?? '').toLowerCase().replace(/×/g, 'x').replace(/,/g, '.').replace(/\s+/g, ' ').trim();

/**
 * h = { model, E, sjabloon(id), artikelen(), perId(), qrIndex(), voegToe(printer, item), vervang(printer, index, item),
 *       naarPrinter(printer), melding(tekst, fout), bewaarVel(), tekenAlles() }
 */
export function startMaken(root, h) {
  const doel = root.getElementById('maken');
  const m = { artikel: null, sjabloonId: 'auto', waarden: {}, bewerkt: new Set(), qr: '', qrBewerkt: false, vanRij: null, perExemplaar: false, aantal: 1 };

  const sjabloonId = () => (m.sjabloonId !== 'auto' ? m.sjabloonId
    : m.artikel ? standaardSjabloon(m.artikel, 'bordje', h.E().regels) : (h.sjabloon('leeg-staand') ? 'leeg-staand' : h.E().sjablonen[0]?.id));
  const huidigSjabloon = () => h.sjabloon(sjabloonId()) || h.E().sjablonen[0];
  const basisArtikel = () => m.artikel || LEEG;
  const artikelAanv = () => (m.artikel ? h.E().aanvullingen[m.artikel.id] || {} : {});
  const overrides = () => {
    const o = { ...artikelAanv() };
    for (const k of m.bewerkt) o[k] = m.waarden[k] ?? '';
    return o;
  };
  const qrWaarde = () => (m.qrBewerkt ? m.qr : (m.artikel?.qr || m.artikel?.exemplaren?.[0] || ''));
  // Een QR van het artikel zelf (artikel-QR of een van zijn exemplaren) is geen eigen wijziging.
  const qrEigen = () => m.qrBewerkt && !(m.artikel && (m.qr === (m.artikel.qr || '') || (m.artikel.exemplaren || []).includes(m.qr)));

  function soortOpties() {
    const groep = (printer, titel) => {
      const lijst = h.E().sjablonen.filter(s => s.printer === printer);
      return lijst.length ? `<optgroup label="${esc(titel)}">${lijst.map(s => `<option value="${esc(s.id)}"${s.id === m.sjabloonId ? ' selected' : ''}>${esc(s.naam)}</option>`).join('')}</optgroup>` : '';
    };
    return `<option value="auto"${m.sjabloonId === 'auto' ? ' selected' : ''}>Automatisch (volgt het artikel)</option>`
      + groep('a4', 'A4') + groep('label', h.E().printers?.label?.naam || 'Labelprinter');
  }

  function tekenFormulier() {
    const a = m.artikel;
    doel.innerHTML = '<div class="rij2">'
      + '<div class="zoeken"><label class="veld"><span>Artikel opzoeken <small>(optioneel)</small></span>'
      + '<input type="search" id="makenZoek" placeholder="Naam, code of QR — of scan" autocomplete="off"></label>'
      + '<ul id="makenTreffers" class="treffers" role="listbox" aria-label="Gevonden artikelen"></ul></div>'
      + `<label class="veld"><span>Soort</span><select id="makenSoort">${soortOpties()}</select></label></div>`
      + (a ? `<div id="makenArtikel" class="gekoppeld"><b>${esc(a.naam)}</b><span class="hint">${esc(a.code || '')}</span><button type="button" class="klein" id="makenLos" aria-label="Artikel loskoppelen">×</button></div>` : '<div id="makenArtikel" hidden></div>')
      + '<div id="makenVelden" class="velden"></div>'
      + '<div class="knoppenrij"><label class="vink"><input type="checkbox" id="makenBewaar"> Bewaren onder Losse items</label>'
      + `<button type="button" id="makenLeeg">Leegmaken</button><button type="button" id="makenOpVel" class="primary">${m.vanRij ? 'Bijwerken' : 'Op printvel'}</button></div>`;
    tekenVelden();
  }

  function tekenVelden() {
    const sj = huidigSjabloon();
    const art = basisArtikel(), o = overrides();
    const velden = (sj?.velden || []).map(v => {
      const waarde = m.bewerkt.has(v.naam) ? (m.waarden[v.naam] ?? '') : veldwaarde(v, art, artikelAanv());
      const vorm = {
        ...v, verplicht: false, bron: m.artikel ? (BRON[v.herkomst.type] || '') : '',
        ...(v.herkomst.patroon === 'kabel' ? { keuzes: [{ waarde: 'ja', tekst: 'Ja' }, { waarde: '', tekst: 'Nee' }] } : {}),
      };
      const html = veldInvoer(vorm, waarde, { verplicht: false });
      return v.meerregelig ? html.replace('class="veld"', 'class="veld breed"') : html;
    });
    void o;
    // Randkleur zelf kiezen kan op elk A4-bordje en elke strook (leeg = wat het sjabloon zegt).
    if (sj?.printer === 'a4' && !sj.velden.some(v => v.naam === 'Randkleur')) {
      const w = m.bewerkt.has('Randkleur') ? (m.waarden.Randkleur ?? '') : (artikelAanv().Randkleur || '');
      velden.push(veldInvoer({ naam: 'Randkleur', keuzes: [{ waarde: '', tekst: 'Automatisch' }, ...RANDKLEUREN.map(k => ({ waarde: k, tekst: k }))] }, w, { verplicht: false }));
    }
    const ex = m.artikel?.exemplaren?.length ? `<label class="vink breed"><input type="checkbox" id="makenPerEx"${m.perExemplaar ? ' checked' : ''}> Eén per exemplaar (${m.artikel.exemplaren.length})</label>` : '';
    root.getElementById('makenVelden').innerHTML = velden.join('')
      + `<label class="veld"><span>QR-code <small>(leeg = geen)</small></span><input type="text" name="__qr" value="${esc(qrWaarde())}" autocomplete="off"></label>`
      + `<label class="veld"><span>Aantal</span><input type="number" name="__aantal" min="1" max="999" value="${m.aantal}"></label>` + ex;
    tekenVoorbeeld();
  }

  let beurt = 0;
  async function tekenVoorbeeld() {
    const mijn = ++beurt;
    const sj = huidigSjabloon();
    const vak = root.getElementById('makenVoorbeeld');
    if (!sj || !vak) return;
    const inhoud = vul(sj, basisArtikel(), overrides(), qrWaarde());
    const el = teken(inhoud, h.E().huisstijl);
    // Het voorbeeld staat bovenin de kolom Voorbeeld en neemt hooguit de halve kolomhoogte.
    const kolom = root.getElementById('voorbeeld');
    const breedte = Math.max(160, vak.clientWidth - 24);
    const hoogte = Math.max(160, (kolom?.clientHeight || 600) * 0.5 - 40);
    const s = Math.min(1.3, breedte / (inhoud.formaat.b * PX), hoogte / (inhoud.formaat.h * PX));
    const d = document.createElement('div');
    d.className = 'vb';
    d.style.width = (inhoud.formaat.b * PX * s).toFixed(1) + 'px';
    d.style.height = (inhoud.formaat.h * PX * s).toFixed(1) + 'px';
    el.style.transform = `scale(${s})`;
    el.style.transformOrigin = '0 0';
    d.appendChild(el);
    vak.replaceChildren(d);
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
    m.bewerkt.clear(); m.waarden = {};
    m.qrBewerkt = !!exemplaar; m.qr = exemplaar || '';
    m.perExemplaar = false;
    tekenFormulier();
    root.getElementById('makenOpVel').focus();
  }
  /** Scan of exacte QR/code: artikel koppelen. Geeft true als het lukte. */
  function scan(tekst) {
    const ruw = String(tekst || '').trim();
    const hit = h.qrIndex().get(ruw.toLowerCase()) || (h.perId().has(ruw) ? { id: ruw, exemplaar: null } : null);
    if (!hit) return false;
    koppel(h.perId().get(hit.id), hit.exemplaar);
    return true;
  }

  function reset() {
    Object.assign(m, { artikel: null, sjabloonId: 'auto', waarden: {}, bewerkt: new Set(), qr: '', qrBewerkt: false, vanRij: null, perExemplaar: false, aantal: 1 });
    tekenFormulier();
    root.getElementById('makenZoek')?.focus();
  }

  // ---------- op printvel ----------
  async function opVel() {
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
    reset();
  }

  /** Een regel van het printvel openen om aan te passen. */
  function laad(item, printer, index) {
    const a = h.perId().get(item.artikel);
    Object.assign(m, { artikel: null, waarden: {}, bewerkt: new Set(), qr: '', qrBewerkt: false, perExemplaar: false, vanRij: { printer, index }, aantal: item.aantal || 1 });
    if (a?.los) {
      // los item: bronartikel (als dat er nog is) met de opgeslagen wijzigingen
      const bron = a.bron ? h.perId().get(a.bron) : null;
      m.artikel = bron || null;
      const aanv = h.E().aanvullingen[a.id] || {};
      for (const [k, v] of Object.entries(aanv)) { m.waarden[k] = v; m.bewerkt.add(k); }
      if (!bron) { m.waarden.Naam = m.waarden.Naam ?? a.naam; m.bewerkt.add('Naam'); }
      m.qr = item.qr; m.qrBewerkt = !bron || item.qr !== (bron.qr || '');
    } else if (a) {
      m.artikel = a;
      m.qr = item.qr; m.qrBewerkt = item.qr !== (a.qr || '');
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
    if (!t.name) return;
    if (t.name === '__qr') { m.qr = t.value.trim(); m.qrBewerkt = true; }
    else { m.waarden[t.name] = t.value; m.bewerkt.add(t.name); }
    clearTimeout(voorbeeldTimer);
    voorbeeldTimer = setTimeout(tekenVoorbeeld, 150);
  });
  doel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'makenSoort') { m.sjabloonId = t.value; tekenVelden(); return; }
    if (t.id === 'makenPerEx') { m.perExemplaar = t.checked; return; }
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
    if (e.target.closest('#makenLos')) { m.artikel = null; m.bewerkt.clear(); m.waarden = {}; m.qrBewerkt = false; tekenFormulier(); return; }
    if (e.target.closest('#makenLeeg')) { reset(); return; }
    if (e.target.closest('#makenOpVel')) opVel().catch(err => h.melding('Op het printvel zetten mislukt: ' + err.message, true));
  });

  tekenFormulier();
  return { laad, reset, scan, vernieuw: tekenFormulier };
}
