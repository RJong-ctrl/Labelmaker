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
  document.getElementById('werkscherm').hidden = inBeheer;
  document.getElementById('beheerScherm').hidden = !inBeheer;
  document.body.classList.toggle('in-beheer', inBeheer);
  if (!inBeheer) { if (beheer) scherm.vernieuw(); return; }
  try {
    const { startBeheer } = await import('./beheer.js');
    const { beheerOnderdelen } = await import('./beheer-extra.js').catch(() => ({ beheerOnderdelen: () => [] }));
    beheer = await startBeheer(document, model, {
      profielId,
      terug: () => { location.hash = ''; },
      extraOnderdelen: beheerOnderdelen(document, model, { profielId }),
    });
  } catch {
    document.getElementById('beheerScherm').innerHTML = '<div class="kolom"><p class="leeg">Beheer komt er binnenkort aan. <a href="#">Terug naar het werkscherm</a></p></div>';
  }
}
document.getElementById('beheer').addEventListener('click', () => { location.hash = location.hash === '#beheer' ? '' : '#beheer'; });
window.addEventListener('hashchange', toonScherm);
if (location.hash === '#beheer') toonScherm();
