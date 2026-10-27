// Dialogen van het werkscherm: velden invullen, los item, kolommen koppelen, profiel maken.
// Elke functie toont <dialog id="aanvulling"> en geeft een Promise met de waarden of null.

import { esc } from './html.js';

function toon(dlg, html, lees) {
  dlg.innerHTML = html;
  const form = dlg.querySelector('form');
  return new Promise(ok => {
    let klaar = false;
    const einde = (w) => { if (klaar) return; klaar = true; if (dlg.open) dlg.close(); ok(w); };
    form.addEventListener('submit', (e) => { e.preventDefault(); einde(lees(form)); });
    form.querySelectorAll('[data-k="over"]').forEach(b => b.addEventListener('click', () => einde(null)));
    form.querySelectorAll('[data-k]:not([data-k="over"])').forEach(b => b.addEventListener('click', () => einde({ __knop: b.dataset.k })));
    dlg.addEventListener('cancel', () => einde(null), { once: true });
    dlg.showModal();
    form.querySelector('select,input,textarea')?.focus();
  });
}

const knoppen = (opslaan, extra = '') =>
  `<div class="acties">${extra}<button type="button" data-k="over">Annuleren</button><button type="submit" class="primary">${esc(opslaan)}</button></div>`;

/** Invoer voor één veld van een sjabloon. */
export function veldInvoer(v, waarde = '', { verplicht = v.verplicht } = {}) {
  const naam = esc(v.naam), w = esc(waarde), req = verplicht ? ' required' : '';
  let invoer;
  if (v.keuzes?.length) {
    invoer = `<select name="${naam}"${req}>` + v.keuzes.map(k => `<option value="${esc(k.waarde)}"${k.waarde === waarde ? ' selected' : ''}>${esc(k.tekst)}</option>`).join('') + '</select>';
  } else if (v.opties?.length) {
    invoer = `<select name="${naam}"${req}><option value="">${verplicht ? 'Kies…' : '—'}</option>`
      + v.opties.map(o => `<option${o === waarde ? ' selected' : ''}>${esc(o)}</option>`).join('') + '</select>';
  } else if (v.meerregelig) {
    invoer = `<textarea name="${naam}" rows="4" placeholder="${esc(v.plaatshouder || 'Kop: waarde (één per regel)')}"${req}>${w}</textarea>`;
  } else {
    invoer = `<input type="text" name="${naam}" value="${w}"${req}>`;
  }
  const bron = v.bron ? ` <small class="hint">${esc(v.bron)}</small>` : '';
  return `<label class="veld"><span>${naam}${v.eenheid ? ` (${esc(v.eenheid)})` : ''}${bron}</span>${invoer}</label>`;
}

const formWaarden = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));

/** Verplichte (of alle) aanvulvelden van een sjabloon voor één artikel. */
export function vraagVelden(dlg, { titel, onder, velden, waarden = {}, opslaan = 'Opslaan', hint = 'Dit wordt onthouden voor dit artikel.' }) {
  const html = `<form><h2>${esc(titel)}</h2>${onder ? `<p class="hint">${esc(onder)}</p>` : ''}`
    + velden.map(v => veldInvoer(v, waarden[v.naam] || '')).join('')
    + (hint ? `<p class="hint">${esc(hint)}</p>` : '') + knoppen(opslaan) + '</form>';
  return toon(dlg, html, formWaarden);
}

/**
 * Los item maken of bewerken. sjablonen = alle sjablonen; item = bestaand los item of null.
 * Geeft { sjabloon, naam, code, qrs: string[], locatie, aanvullingen } of { __knop: 'verwijder' } of null.
 */
export function vraagLosItem(dlg, sjablonen, item = null, aanvullingen = {}) {
  const sjOpties = (gekozen) => sjablonen.map(s => `<option value="${esc(s.id)}"${s.id === gekozen ? ' selected' : ''}>${esc(s.naam)}</option>`).join('');
  const qrs = item ? [item.qr, ...(item.exemplaren || [])].filter((x, i, a) => x && a.indexOf(x) === i) : [];
  const velden = (sid) => {
    const sj = sjablonen.find(s => s.id === sid);
    return (sj?.velden || []).filter(v => v.herkomst.type === 'aanvulling').map(v => veldInvoer(v, aanvullingen[v.naam] || '', { verplicht: false })).join('');
  };
  const eerste = item?.sjabloon || sjablonen.find(s => s.id === 'leeg-staand')?.id || sjablonen.find(s => s.printer === 'a4')?.id || sjablonen[0]?.id;
  const html = `<form class="lositem"><h2>${item ? 'Bordje bewerken' : 'Nieuw bordje of label'}</h2>`
    + '<p class="hint">Helemaal zelf maken, los van de artikelen. Begint met een leeg bordje; kies hieronder eventueel een ander sjabloon. Wordt bewaard onder <b>Losse items</b>.</p>'
    + `<label class="veld"><span>Sjabloon</span><select name="__sjabloon">${sjOpties(eerste)}</select></label>`
    + `<label class="veld"><span>Titel</span><input type="text" name="__naam" required value="${esc(item?.naam || '')}"></label>`
    + `<label class="veld"><span>QR-code (leeg = geen; meerdere met komma's)</span><input type="text" name="__qr" value="${esc(qrs.join(', '))}"></label>`
    + `<div class="twee"><label class="veld"><span>Code</span><input type="text" name="__code" value="${esc(item?.code || '')}"></label>`
    + `<label class="veld"><span>Locatie</span><input type="text" name="__locatie" value="${esc(item?.locatie || '')}"></label></div>`
    + `<div class="velden">${velden(eerste)}</div>`
    + knoppen('Opslaan', item ? '<button type="button" data-k="verwijder" class="links">Verwijderen</button>' : '') + '</form>';
  const p = toon(dlg, html, (form) => {
    const w = formWaarden(form);
    const uit = { sjabloon: w.__sjabloon, naam: w.__naam, code: w.__code, locatie: w.__locatie, qrs: w.__qr.split(/[,\n;]/).map(x => x.trim()).filter(Boolean), aanvullingen: {} };
    for (const [k, v] of Object.entries(w)) if (!k.startsWith('__')) uit.aanvullingen[k] = v;
    return uit;
  });
  const sel = dlg.querySelector('select[name="__sjabloon"]');
  sel.addEventListener('change', () => { dlg.querySelector('.velden').innerHTML = velden(sel.value); });
  return p;
}

/** Kolommen koppelen: per veld een kolom uit het bestand kiezen. */
export function vraagKolommen(dlg, koppen, huidig, velden) {
  const NAMEN = { naam: 'Naam', code: 'Code / artikelnummer', qr: 'QR-code', exemplaren: 'QR-codes exemplaren', locatie: 'Locatie', map: 'Categorie', pad: 'Pad', soort: 'Soort', type: 'Type', aantal: 'Aantal' };
  const opties = (veld) => '<option value="">—</option>' + koppen.map(k => `<option${k === huidig[veld] ? ' selected' : ''}>${esc(k)}</option>`).join('');
  const html = '<form><h2>Kolommen koppelen</h2><p class="hint">Welke kolom uit je bestand hoort bij welk veld? Naam en code zijn nodig. Dit wordt onthouden voor dit profiel.</p>'
    + velden.map(v => `<label class="veld"><span>${esc(NAMEN[v] || v)}</span><select name="${esc(v)}"${v === 'naam' || v === 'code' ? ' required' : ''}>${opties(v)}</select></label>`).join('')
    + knoppen('Inlezen') + '</form>';
  return toon(dlg, html, (form) => Object.fromEntries(Object.entries(formWaarden(form)).filter(([, v]) => v)));
}

/** Naam voor een nieuw profiel. */
export function vraagProfiel(dlg) {
  const html = '<form><h2>Nieuw profiel</h2><p class="hint">Een eigen werkruimte met eigen artikelen, sjablonen en huisstijl, los van DSL.</p>'
    + '<label class="veld"><span>Naam</span><input type="text" name="naam" required></label>'
    + '<label class="veld"><span>Beginnen met</span><select name="vanuit"><option value="basis">Neutrale basissjablonen</option><option value="dsl">Kopie van de DSL-sjablonen</option></select></label>'
    + knoppen('Aanmaken') + '</form>';
  return toon(dlg, html, formWaarden);
}
