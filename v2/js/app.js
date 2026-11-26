// Opstarten: profiel kiezen, opslag openen, model laden, basis van de site ophalen,
// werkscherm starten; #beheer toont het beheerscherm.
import { openOpslag, vraagBlijvend, GeheugenOpslag } from './opslag.js';
import { laadModel } from './model.js';
import { start } from './werkscherm.js';
import { profielen, huidigProfiel } from './profielen.js';

const profielId = huidigProfiel();
const profiel = profielen().find(p => p.id === profielId);

let opslag, waarschuwing = '';
try {
  opslag = await openOpslag(profielId);
  vraagBlijvend();
} catch {
  opslag = new GeheugenOpslag();
  waarschuwing = 'Deze browser staat geen opslag toe (bijvoorbeeld in een privévenster). De Labelmaker werkt wel, maar slaat niets op: na het sluiten ben je alles kwijt.';
}
const model = await laadModel(opslag, profielId, profiel?.standaard);
const scherm = await start(document, model, { waarschuwing, profielId });
document.body.dataset.klaar = '1'; // werkscherm is opgestart (tests wachten hierop)

// Gedeelde basis van de site (data/<profiel>.json); zonder internet werkt de laatst geladen basis.
(async () => {
  try {
    const { haalBasis, leesBasis, korteDatum } = await import('./publiceren.js');
    const json = await haalBasis(profielId);
    if (!json) return;
    const gelezen = leesBasis(JSON.stringify(json));
    if (gelezen.fout) return;
    if (await model.laadBasis(gelezen.basis)) {
      scherm.vernieuw();
      scherm.melding(`Basis van ${korteDatum(gelezen.basis.datum)} geladen.`);
    }
  } catch { /* geen basis beschikbaar */ }
})();

// Offline werken.
(async () => {
  try {
    const { registreerOffline } = await import('./offline.js');
    // Ook het hoofdadres (doorverwijzing naar v2/) offline beschikbaar maken.
    if (location.protocol.startsWith('http')) navigator.serviceWorker?.register('../sw-hoofd.js', { scope: '../', updateViaCache: 'none' }).catch(() => {});
    const hadVersie = !!navigator.serviceWorker?.controller;
    const { nieuweVersie } = await registreerOffline();
    if (nieuweVersie) scherm.melding('Nieuwe versie geladen.');
    // Komt er tijdens het werken een nieuwe versie binnen: even herladen, anders lopen oud en nieuw door elkaar.
    if (hadVersie) navigator.serviceWorker?.addEventListener('controllerchange', () => scherm.melding('Er is een nieuwe versie van de Labelmaker. Druk op F5 om hem te gebruiken.'));
  } catch { /* geen offline-ondersteuning */ }
})();

// Beheer (#beheer).
let beheer = null;
async function toonScherm() {
  const inBeheer = location.hash === '#beheer';
  for (const el of [document.querySelector('header'), document.getElementById('werkscherm'), document.getElementById('melding')]) {
    if (inBeheer) { el.dataset.verborgen = el.hidden ? '1' : ''; el.hidden = true; } else if (el.dataset.verborgen !== undefined) { el.hidden = el.dataset.verborgen === '1'; delete el.dataset.verborgen; }
  }
  document.getElementById('beheerScherm').hidden = !inBeheer;
  document.body.classList.toggle('in-beheer', inBeheer);
  if (!inBeheer) {
    if (beheer) { await beheer.stop?.(); beheer = null; await scherm.vernieuw(); }
    return;
  }
  try {
    const { startBeheer } = await import('./beheer.js');
    const { beheerOnderdelen } = await import('./beheer-extra.js');
    beheer = await startBeheer(document, model, {
      profielId,
      terug: () => { location.hash = ''; },
      extraOnderdelen: beheerOnderdelen(document, model, { profielId }),
    });
  } catch (e) {
    document.getElementById('beheerScherm').innerHTML = `<div class="kolom"><p class="leeg">Beheer kon niet worden geopend. <a href="#">Terug naar het werkscherm</a></p></div>`;
    console.warn(e);
  }
}
document.getElementById('beheer').addEventListener('click', () => { location.hash = '#beheer'; });
window.addEventListener('hashchange', toonScherm);
if (location.hash === '#beheer') toonScherm();

// Futura van de pc gebruiken als die er (deels) is, of als bestand van deze pc (Beheer of de balk hieronder).
// Zonder Futura: een balk met één knop om het bestand te kiezen (Robin, 26 nov). Het bestand blijft in deze browser,
// het wordt nooit gepubliceerd (licentie). Bewust geen downloadlink.
(async () => {
  const opmaak = await import('./opmaak.js');
  let r = await opmaak.kiesFutura().catch(() => ({ boek: false, vet: false }));
  try {
    const lt = await model.pcInstelling('eigenLettertype');
    if (lt && await (await import('./beheer.js')).registreerEigenLettertype(lt)) r = await opmaak.kiesFutura();
  } catch { /* geen eigen lettertype */ }
  if (r.boek) scherm.vernieuw();
  const futura = (model.effectief().huisstijl?.lettertype || 'futura') === 'futura';
  document.getElementById('futuraMelding').hidden = !futura || r.boek || r.vet;
})();

document.getElementById('futuraKies').addEventListener('click', () => document.getElementById('futuraBestand').click());
document.getElementById('futuraBestand').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  const fout = document.getElementById('futuraFout');
  fout.textContent = '';
  if (!file) return;
  if (!/futura/i.test(file.name) || !/\.(ttf|otf|woff2?)$/i.test(file.name)) { fout.textContent = ` "${file.name}" is geen Futura-lettertype.`; return; }
  try {
    const beheer = await import('./beheer.js');
    const lt = { naam: file.name, data: beheer.naarBase64(await file.arrayBuffer()) };
    if (!(await beheer.registreerEigenLettertype(lt))) { fout.textContent = ` Kan "${file.name}" niet lezen als lettertype.`; return; }
    await model.zetPcInstelling('eigenLettertype', lt);
    await (await import('./opmaak.js')).kiesFutura();
    document.getElementById('futuraMelding').hidden = true;
    scherm.vernieuw();
  } catch (err) { fout.textContent = ' Bewaren mislukt: ' + (err?.message || err); }
});
