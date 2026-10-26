import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg } from '../../v2/js/qr.js';

test('matrix_is_vierkant', () => {
  const m = qrMatrix('nl4-2.50m');
  assert.equal(m.length, 21);
  for (const rij of m) assert.equal(rij.length, 21);
  // linksboven zit altijd een zoekpatroon: buitenrand donker, ring licht
  assert.equal(m[0][0], true);
  assert.equal(m[1][1], false);
  assert.equal(m[3][3], true);
});

test('utf8', () => {
  const m = qrMatrix('é – Wit');
  assert.ok(m.length >= 21);
});

test('te_lang_geeft_fout', () => {
  assert.throws(() => qrMatrix('x'.repeat(3000)), Error);
});

test('svg_met_stille_zone', () => {
  const { svg, modules } = qrSvg('nl4-2.50m');
  assert.equal(modules, 21);
  assert.match(svg, /viewBox="0 0 25 25"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
});
