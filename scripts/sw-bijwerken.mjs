// Zet de bestandenlijst en de versie in sw.js gelijk met de app-map.
// Draaien vóór elke publicatie: node scripts/sw-bijwerken.mjs [app-map]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const map = process.argv[2] || 'v2';
async function bestanden(dir, basis = '') {
  const uit = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    if (d.name.startsWith('.')) continue;
    const rel = basis ? `${basis}/${d.name}` : d.name;
    if (d.isDirectory()) { if (rel !== 'data') uit.push(...await bestanden(path.join(dir, d.name), rel)); }
    else if (rel !== 'sw.js') uit.push(rel);
  }
  return uit;
}
const lijst = (await bestanden(map)).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
const swPad = path.join(map, 'sw.js');
let sw = await readFile(swPad, 'utf8');
const nu = new Date();
const versie = nu.toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
sw = sw.replace(/const VERSIE = '[^']*';/, `const VERSIE = '${versie}';`);
sw = sw.replace(/const BESTANDEN = \[[\s\S]*?\];/, 'const BESTANDEN = [\n' + ["'./'", ...lijst.map(b => `'${b}'`)].map(x => '  ' + x + ',').join('\n') + '\n];');
await writeFile(swPad, sw);
console.log(`sw.js: versie ${versie}, ${lijst.length + 1} bestanden`);
