// Offline werken: registreert de service worker (sw.js) en meldt of er sinds de vorige
// start een nieuwe versie van de app het overgenomen heeft.

const SLEUTEL = 'labelmaker-sw-versie';
const WACHT_OP_VERSIE_MS = 2000;

/** Vraagt de worker die deze pagina bedient om zijn VERSIE (werkt ook zonder internet). */
function vraagVersie(worker) {
  return new Promise((klaar) => {
    const kanaal = new MessageChannel();
    const timer = setTimeout(() => klaar(null), WACHT_OP_VERSIE_MS);
    kanaal.port1.onmessage = (e) => {
      clearTimeout(timer);
      klaar(typeof e.data?.versie === 'string' ? e.data.versie : null);
    };
    worker.postMessage({ type: 'versie' }, [kanaal.port2]);
  });
}

/**
 * Registreert sw.js (alleen op http/https) en zoekt bij elke start naar een nieuwe versie.
 * `nieuweVersie` is true bij de eerste start nadat een nieuwe service worker het overnam
 * (de bestanden van deze start komen dan al uit de nieuwe versie). Gooit nooit een fout.
 * @returns {Promise<{nieuweVersie: boolean}>}
 */
export async function registreerOffline() {
  try {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return { nieuweVersie: false };
    const registratie = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {
      scope: './',
      updateViaCache: 'none', // sw.js zelf nooit uit de HTTP-cache (GitHub Pages: max-age=600)
    });
    registratie.update().catch(() => {}); // elke start zoeken, ook zonder internet geen probleem

    // Zonder besturende worker (eerste bezoek) valt er niets te vergelijken.
    const worker = navigator.serviceWorker.controller;
    const versie = worker ? await vraagVersie(worker) : null;
    if (!versie) return { nieuweVersie: false };
    const vorige = localStorage.getItem(SLEUTEL);
    localStorage.setItem(SLEUTEL, versie);
    return { nieuweVersie: vorige !== null && vorige !== versie };
  } catch {
    return { nieuweVersie: false };
  }
}
