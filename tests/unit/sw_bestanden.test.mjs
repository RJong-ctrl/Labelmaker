import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { runInNewContext } from 'node:vm';

const V2 = new URL('../../v2/', import.meta.url).pathname;

/** Tekst van v2/sw.js (pas bij gebruik gelezen, zodat een ontbrekend bestand als testfout meldt). */
function leesSw() {
  assert.ok(existsSync(join(V2, 'sw.js')), 'v2/sw.js bestaat niet');
  return readFileSync(join(V2, 'sw.js'), 'utf8');
}

/** De lijst BESTANDEN uit sw.js (een array van tekstwaarden, eventueel met commentaar). */
function leesBestanden() {
  const m = leesSw().match(/const\s+BESTANDEN\s*=\s*(\[[\s\S]*?\])\s*;/);
  assert.ok(m, 'sw.js bevat geen `const BESTANDEN = [...]`');
  const lijst = runInNewContext(m[1]);
  assert.ok(Array.isArray(lijst) && lijst.every(b => typeof b === 'string'), 'BESTANDEN moet een lijst met teksten zijn');
  return lijst;
}

/** Alle bestanden onder v2/ (met `/`), zonder data/, sw.js zelf en verborgen bestanden (.DS_Store e.d.). */
function bestandenOpSchijf() {
  const uit = [];
  const loop = (map) => {
    for (const d of readdirSync(map, { withFileTypes: true })) {
      if (d.name.startsWith('.')) continue;
      const pad = join(map, d.name);
      if (d.isDirectory()) loop(pad);
      else uit.push(relative(V2, pad).split(sep).join('/'));
    }
  };
  loop(V2);
  return uit.filter(p => p !== 'sw.js' && !p.startsWith('data/'));
}

test('sw_bestanden_compleet', () => {
  const lijst = leesBestanden();
  const verwacht = new Set([...bestandenOpSchijf(), './']);
  const staat = new Set(lijst);
  const ontbreekt = [...verwacht].filter(b => !staat.has(b)).sort();
  const teveel = [...staat].filter(b => !verwacht.has(b)).sort();
  assert.deepEqual({ ontbreekt, teveel }, { ontbreekt: [], teveel: [] },
    `BESTANDEN in v2/sw.js klopt niet met v2/.\n  Ontbreekt in de lijst (offline zou dit bestand missen): ${ontbreekt.join(', ') || '-'}\n  Staat in de lijst maar bestaat niet (de installatie van de service worker zou mislukken): ${teveel.join(', ') || '-'}`);
  assert.equal(staat.size, lijst.length, 'BESTANDEN bevat dubbele regels');
});

test('sw_bestanden_relatief_en_zonder_data', () => {
  for (const b of leesBestanden()) {
    assert.ok(!/^(\/|[a-z]+:)/i.test(b), `${b}: moet een pad relatief aan sw.js zijn`);
    assert.ok(!b.startsWith('data/'), `${b}: data/ is netwerk-eerst en hoort niet in de voorraad`);
  }
});

test('sw_versie_en_cachenaam', () => {
  const SW = leesSw();
  const v = SW.match(/const\s+VERSIE\s*=\s*'([^']+)'/);
  assert.ok(v, "sw.js bevat geen `const VERSIE = '...'`");
  assert.match(v[1], /^[0-9A-Za-z._-]+$/);
  assert.match(SW, /const\s+CACHE\s*=\s*`labelmaker-\$\{VERSIE\}`/, 'cachenaam moet labelmaker-${VERSIE} zijn');
});
