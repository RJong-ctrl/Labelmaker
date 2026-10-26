// Opslag in de browser, per profiel. GeheugenOpslag (tests) en IndexedDB
// hebben dezelfde interface: lees, schrijf, schrijfVeel, vervangAlle, alle, wis.

export const SOORTEN = ['artikelen', 'aanvullingen', 'printvel', 'printlog', 'instellingen'];
const VERSIE = 1;

function controleer(soort) {
  if (!SOORTEN.includes(soort)) throw new Error('Onbekende opslagsoort: ' + soort);
}

export class GeheugenOpslag {
  constructor() { this.data = Object.fromEntries(SOORTEN.map(s => [s, new Map()])); }
  async lees(soort, id) {
    controleer(soort);
    const w = this.data[soort].get(id);
    return w === undefined ? undefined : structuredClone(w);
  }
  async schrijf(soort, id, waarde) {
    controleer(soort);
    this.data[soort].set(id, structuredClone(waarde));
  }
  async schrijfVeel(soort, items) {
    controleer(soort);
    for (const { id, waarde } of items) this.data[soort].set(id, structuredClone(waarde));
  }
  async vervangAlle(soort, items) {
    controleer(soort);
    this.data[soort].clear();
    for (const { id, waarde } of items) this.data[soort].set(id, structuredClone(waarde));
  }
  async alle(soort) {
    controleer(soort);
    return [...this.data[soort]].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([id, waarde]) => ({ id, waarde: structuredClone(waarde) }));
  }
  async wis(soort, id) {
    controleer(soort);
    if (id === undefined) this.data[soort].clear();
    else this.data[soort].delete(id);
  }
}

const klaar = (req) => new Promise((ok, fout) => { req.onsuccess = () => ok(req.result); req.onerror = () => fout(req.error); });
const afgerond = (tx) => new Promise((ok, fout) => { tx.oncomplete = () => ok(); tx.onerror = tx.onabort = () => fout(tx.error); });

class IdbOpslag {
  constructor(db) { this.db = db; }
  async lees(soort, id) {
    controleer(soort);
    return klaar(this.db.transaction(soort).objectStore(soort).get(id));
  }
  async schrijf(soort, id, waarde) {
    controleer(soort);
    const tx = this.db.transaction(soort, 'readwrite');
    tx.objectStore(soort).put(waarde, id);
    return afgerond(tx);
  }
  async schrijfVeel(soort, items) {
    controleer(soort);
    const tx = this.db.transaction(soort, 'readwrite');
    const st = tx.objectStore(soort);
    for (const { id, waarde } of items) st.put(waarde, id);
    return afgerond(tx);
  }
  /** Alles van deze soort vervangen, in één transactie (alles of niets). */
  async vervangAlle(soort, items) {
    controleer(soort);
    const tx = this.db.transaction(soort, 'readwrite');
    const st = tx.objectStore(soort);
    st.clear();
    for (const { id, waarde } of items) st.put(waarde, id);
    return afgerond(tx);
  }
  async alle(soort) {
    controleer(soort);
    const st = this.db.transaction(soort).objectStore(soort);
    const [sleutels, waarden] = await Promise.all([klaar(st.getAllKeys()), klaar(st.getAll())]);
    return sleutels.map((id, i) => ({ id, waarde: waarden[i] }));
  }
  async wis(soort, id) {
    controleer(soort);
    const tx = this.db.transaction(soort, 'readwrite');
    if (id === undefined) tx.objectStore(soort).clear();
    else tx.objectStore(soort).delete(id);
    return afgerond(tx);
  }
}

/** IndexedDB-opslag voor één profiel (database 'labelmaker-<profiel>'). */
export async function openOpslag(profiel = 'dsl') {
  const req = indexedDB.open('labelmaker-' + profiel, VERSIE);
  req.onupgradeneeded = () => {
    for (const s of SOORTEN) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
  };
  return new IdbOpslag(await klaar(req));
}

/** Vraag de browser de gegevens niet zomaar op te ruimen. */
export async function vraagBlijvend() {
  try { return !!(await navigator.storage?.persist?.()); } catch { return false; }
}
