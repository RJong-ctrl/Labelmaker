// Beheeronderdelen Publiceren, Profielen en Oude gegevens (versie 25).
// beheerOnderdelen() geeft { id, titel, teken(doel) }[] voor startBeheer().

import { esc } from './html.js';
import { maakBasis, bestandsnaam, korteDatum } from './publiceren.js';
import { leesV25 } from './oud.js';
import { profielen, maakProfiel, hernoemProfiel, verwijderProfiel, exporteerProfiel, importeerProfiel, kiesProfiel } from './profielen.js';
import { openOpslag } from './opslag.js';

const UPLOAD = 'https://github.com/RJong-ctrl/Labelmaker/upload/main/v2/data';

function download(naam, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = naam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const leesBestandTekst = (file) => file.text();

export function beheerOnderdelen(root, model, { profielId, herlaad = () => location.reload() } = {}) {
  return [
    { id: 'publiceren', titel: 'Publiceren', teken: (doel) => publiceren(doel, model, profielId) },
    { id: 'profielen', titel: 'Profielen', teken: (doel) => profielenBeheer(doel, model, profielId, herlaad) },
    { id: 'v25', titel: 'Oude gegevens (versie 25)', teken: (doel) => oudeGegevens(doel, model) },
  ];
}

function publiceren(doel, model, profielId) {
  const e = model.effectief();
  const w = model.wijzigingen();
  doel.innerHTML = '<h2>Publiceren</h2>'
    + `<p>Maakt één bestand met de artikelen (zonder prijzen en interne opmerkingen), sjablonen, kleuren, categorie-regels, huisstijl en aanvullingen van dit profiel. Elke pc laadt dat bij het opstarten.</p>`
    + `<p class="hint">Laatste basis op deze pc: <b>${e.basisDatum ? esc(korteDatum(e.basisDatum)) : 'nog geen'}</b>. Wijzigingen op deze pc: <b>${w.length}</b> (gaan mee in de publicatie).</p>`
    + `<div class="acties"><button type="button" class="primary" data-k="maak">Publicatiebestand maken</button></div>`
    + `<ol class="stappen"><li>Klik op <b>Publicatiebestand maken</b>; je krijgt <code>${esc(bestandsnaam(profielId))}</code>.</li>`
    + `<li>Open <a href="${UPLOAD}" target="_blank" rel="noopener">GitHub → map v2/data → Upload files</a>, sleep het bestand erin en klik <b>Commit changes</b>. Of stuur het naar Claude.</li>`
    + '<li>Binnen ongeveer een minuut laden alle pc\'s de nieuwe basis bij het opstarten.</li></ol>'
    + '<p class="hint">Nooit in het bestand: prijzen, interne opmerkingen, de pincode en een eigen lettertypebestand.</p>'
    + '<p class="melding-beheer" role="status"></p>';
  doel.querySelector('[data-k="maak"]').addEventListener('click', () => {
    const basis = maakBasis(model.effectief(), profielId, new Date(), model.standaard);
    download(bestandsnaam(profielId), basis);
    doel.querySelector('.melding-beheer').textContent = `Bestand gemaakt: ${basis.artikelen.length} artikelen, ${basis.sjablonen.length} sjablonen.`;
  });
}

function profielenBeheer(doel, model, profielId, herlaad) {
  const teken = (melding = '') => {
    doel.innerHTML = '<h2>Profielen</h2><p class="hint">Een profiel is een eigen werkruimte met eigen artikelen, sjablonen en huisstijl. Kiezen doe je in de kop van het werkscherm.</p>'
      + '<ul class="profielen">' + profielen().map(p => `<li data-id="${esc(p.id)}"><span class="nm">${esc(p.naam)}${p.id === profielId ? ' <span class="hint">(open)</span>' : ''}</span>`
        + `<button type="button" class="klein" data-k="export">Exporteren</button>`
        + (p.id === 'dsl' ? '' : `<button type="button" class="klein" data-k="hernoem">Hernoemen</button><button type="button" class="klein" data-k="weg">Verwijderen</button>`)
        + '</li>').join('') + '</ul>'
      + '<h3>Nieuw profiel</h3><div class="rij"><input type="text" name="nieuw" placeholder="Naam" aria-label="Naam nieuw profiel">'
      + '<select name="vanuit" aria-label="Beginnen met"><option value="basis">Neutrale basissjablonen</option><option value="dsl">Kopie van de DSL-sjablonen</option></select>'
      + '<button type="button" data-k="nieuw">Aanmaken</button></div>'
      + '<h3>Profiel importeren</h3><p class="hint">Een bestand dat met Exporteren is gemaakt (ook van een andere pc).</p>'
      + '<input type="file" accept=".json,application/json" name="import" aria-label="Profielbestand kiezen">'
      + `<p class="melding-beheer" role="status">${esc(melding)}</p>`;
  };
  teken();
  doel.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-k]');
    if (!b) return;
    const id = b.closest('li')?.dataset.id;
    try {
      if (b.dataset.k === 'export') {
        const opslag = id === profielId ? model.opslag : await openOpslag(id);
        download(`labelmaker-profiel-${id}.json`, await exporteerProfiel(opslag, id));
        teken(`Profiel "${profielen().find(p => p.id === id)?.naam}" geëxporteerd.`);
      } else if (b.dataset.k === 'hernoem') {
        const li = b.closest('li');
        const naam = profielen().find(p => p.id === id)?.naam || '';
        li.querySelector('.nm').innerHTML = `<input type="text" value="${esc(naam)}" aria-label="Nieuwe naam">`;
        b.dataset.k = 'hernoemOk'; b.textContent = 'Opslaan';
        li.querySelector('input').focus();
      } else if (b.dataset.k === 'hernoemOk') {
        hernoemProfiel(id, b.closest('li').querySelector('input').value);
        teken('Naam aangepast.');
      } else if (b.dataset.k === 'weg') {
        b.dataset.k = 'wegOk'; b.textContent = 'Zeker weten? Alles van dit profiel op deze pc gaat weg';
      } else if (b.dataset.k === 'wegOk') {
        await verwijderProfiel(id);
        if (id === profielId) { kiesProfiel('dsl'); return herlaad(); }
        teken('Profiel verwijderd.');
      } else if (b.dataset.k === 'nieuw') {
        const naam = doel.querySelector('[name="nieuw"]').value.trim();
        if (!naam) { teken('Vul eerst een naam in.'); return; }
        const nieuw = await maakProfiel(naam, doel.querySelector('[name="vanuit"]').value);
        teken(`Profiel "${naam}" aangemaakt. Kies het in de kop van het werkscherm.`);
        void nieuw;
      }
    } catch (e) { teken(e.message); }
  });
  doel.addEventListener('change', async (ev) => {
    if (ev.target.name !== 'import' || !ev.target.files[0]) return;
    try {
      const json = JSON.parse(await leesBestandTekst(ev.target.files[0]));
      const id = await importeerProfiel(json, openOpslag);
      teken(`Profiel "${profielen().find(p => p.id === id)?.naam}" geïmporteerd.`);
    } catch (e) {
      teken(e instanceof SyntaxError ? 'Dit is geen profielbestand van de Labelmaker.' : e.message);
    }
  });
}

/** v25-gegevens overnemen als lokale wijzigingen. */
export async function neemV25Over(model, gelezen) {
  for (const s of gelezen.sjablonen) await model.zetSjabloon(s);
  const e = model.effectief();
  for (const [id, waarden] of Object.entries(gelezen.kleurenDsl || {})) {
    if (!waarden || !Object.keys(waarden).length) continue;
    const s = e.sjablonen.find(x => x.id === id);
    if (!s) continue;
    const rand = s.kleuren?.rand || { sleutel: [], waarden: {} };
    await model.zetSjabloon({ ...s, kleuren: { ...s.kleuren, rand: { ...rand, waarden: { ...rand.waarden, ...waarden } } } });
  }
  if (gelezen.certIcoon && !e.huisstijl?.certIcoon) await model.zetInstelling('huisstijl', { ...e.huisstijl, certIcoon: gelezen.certIcoon });
  for (const item of gelezen.losseItems) await model.zetLosItem(item);
  for (const [id, w] of Object.entries(gelezen.aanvullingen || {})) await model.zetAanvulling(id, w);
}

function oudeGegevens(doel, model) {
  let gelezen = null;
  const samenvatting = (g) => {
    const t = g.telling || {};
    return `${t.sjablonen || 0} sjablonen, ${t.bordjes || 0} bordjes, ${t.labels || 0} labels en ${t.locaties || 0} locaties gevonden.`;
  };
  doel.innerHTML = '<h2>Oude gegevens (versie 25)</h2>'
    + '<p>Neem je eigen sjablonen, kleurcodes, opgeslagen bordjes, labels en locaties uit de vorige Labelmaker over. Ze komen als losse items en sjablonen in dit profiel en tellen als wijzigingen op deze pc.</p>'
    + '<div class="acties"><button type="button" data-k="browser">Uit deze browser overnemen</button>'
    + '<label class="knop">Exportbestand kiezen<input type="file" accept=".json,application/json" name="v25" hidden></label></div>'
    + '<div class="v25-resultaat" role="status"></div>';
  const uit = doel.querySelector('.v25-resultaat');
  const toon = (g) => {
    gelezen = g;
    const leeg = !g.sjablonen.length && !g.losseItems.length && !Object.values(g.kleurenDsl || {}).some(x => x && Object.keys(x).length);
    uit.innerHTML = `<p>${esc(samenvatting(g))}</p>` + (leeg ? '<p class="hint">Er is niets om over te nemen.</p>' : '<button type="button" class="primary" data-k="over">Overnemen</button>');
  };
  doel.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-k]');
    if (!b) return;
    if (b.dataset.k === 'browser') {
      toon(leesV25({ opslag: { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } } } }));
    } else if (b.dataset.k === 'over' && gelezen) {
      b.disabled = true;
      try {
        await neemV25Over(model, gelezen);
        uit.innerHTML = `<p>Overgenomen: ${esc(samenvatting(gelezen))}</p>`;
      } catch (e) { uit.innerHTML = `<p class="fout">Overnemen mislukt: ${esc(e.message)}</p>`; }
    }
  });
  doel.addEventListener('change', async (ev) => {
    if (ev.target.name !== 'v25' || !ev.target.files[0]) return;
    try { toon(leesV25({ export: JSON.parse(await leesBestandTekst(ev.target.files[0])) })); }
    catch { uit.innerHTML = '<p class="fout">Dit is geen exportbestand van de vorige Labelmaker.</p>'; }
  });
}
