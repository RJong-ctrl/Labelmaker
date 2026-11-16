import { test } from 'node:test';
import assert from 'node:assert/strict';
import { a4Indeling, verdeel, pakA4 } from '../../v2/js/indeling.js';

const binnenA4 = (l) => l.posities.every(([x, y]) => x >= 5 && y >= 5 && x + l.b <= 205 && y + l.h <= 292);
const geenOverlap = (l) => l.posities.every(([x, y], i) => l.posities.every(([x2, y2], j) =>
  i === j || x + l.b + 8 <= x2 || x2 + l.b + 8 <= x || y + l.h + 8 <= y2 || y2 + l.h + 8 <= y));

test('a7_vier_per_vel', () => {
  const l = a4Indeling(74, 105);
  assert.equal(l.posities.length, 4);
  assert.equal(l.gedraaid, false);
  assert.ok(binnenA4(l) && geenOverlap(l));
});

test('liggend_gedraaid', () => {
  const l = a4Indeling(105, 74);
  assert.equal(l.posities.length, 4);
  assert.equal(l.gedraaid, true);
  assert.deepEqual([l.b, l.h], [74, 105]);
  assert.ok(binnenA4(l) && geenOverlap(l));
});

test('strook_vijf_per_vel', () => {
  const l = a4Indeling(180, 48);
  assert.equal(l.posities.length, 5);
  assert.equal(l.gedraaid, false);
  assert.ok(binnenA4(l) && geenOverlap(l));
});

test('te_groot_past_niet', () => {
  assert.equal(a4Indeling(300, 300).posities.length, 0);
});

test('verdeel', () => {
  assert.deepEqual(verdeel([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(verdeel([], 4), []);
});

test('a4_wandbord_en_kist', () => {
  assert.equal(a4Indeling(194, 281).posities.length, 1);
  const l = a4Indeling(281, 194);
  assert.equal(l.posities.length, 1);
  assert.equal(l.gedraaid, true);
  assert.equal(a4Indeling(194, 136).posities.length, 2);   // twee kistbordjes (A5-hoes) per A4
});

// Verschillende formaten samen op één vel (Robin, 16 nov: losse pagina's per formaat is zonde van papier).
const rechtGoed = (vellen) => {
  for (const vel of vellen) {
    for (const p of vel) assert.ok(p.x >= 8 - 1e-6 && p.y >= 8 - 1e-6 && p.x + p.b <= 202 + 1e-6 && p.y + p.h <= 289 + 1e-6, 'binnen de marge');
    vel.forEach((p, i) => vel.forEach((q, j) => {
      if (i < j) assert.ok(p.x + p.b + 8 <= q.x + 1e-6 || q.x + q.b + 8 <= p.x + 1e-6 || p.y + p.h + 8 <= q.y + 1e-6 || q.y + q.h + 8 <= p.y + 1e-6, 'geen overlap, 8 mm snijruimte');
    }));
  }
};

test('pak_a4_gemengd_op_een_vel', () => {
  // materiaalbordje A5 (194 × 136) en twee speakertas-kaartjes (105 × 74): samen op één vel
  const vellen = pakA4([{ b: 194, h: 136 }, { b: 105, h: 74 }, { b: 105, h: 74 }]);
  assert.equal(vellen.length, 1);
  assert.deepEqual(vellen[0].map(p => p.i).sort(), [0, 1, 2]);
  rechtGoed(vellen);
  // gedraaid: de maten op het vel zijn verwisseld
  for (const p of vellen[0]) if (p.gedraaid) assert.ok(p.b < p.h);
});

test('pak_a4_een_formaat_als_vanouds', () => {
  const vellen = pakA4(Array(5).fill({ b: 74, h: 105 }));
  assert.deepEqual(vellen.map(v => v.length), [4, 1]);
  const ind = a4Indeling(74, 105);
  assert.deepEqual(vellen[0].map(p => [p.x, p.y]), ind.posities);
});

test('pak_a4_willekeurig_altijd_netjes_en_zuinig', () => {
  const maten = [{ b: 194, h: 136 }, { b: 150, h: 87 }, { b: 105, h: 74 }, { b: 74, h: 105 }, { b: 160, h: 48 }, { b: 194, h: 281 }];
  let zaad = 7; const rnd = () => (zaad = (zaad * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 50; n++) {
    const lijst = Array.from({ length: 1 + Math.floor(rnd() * 12) }, () => maten[Math.floor(rnd() * maten.length)]);
    const vellen = pakA4(lijst);
    rechtGoed(vellen);
    assert.deepEqual(vellen.flat().map(p => p.i).sort((a, b) => a - b), lijst.map((_, i) => i));
    for (const vel of vellen) for (const p of vel) {
      const m = lijst[p.i];
      assert.deepEqual(p.gedraaid ? [p.h, p.b] : [p.b, p.h], [m.b, m.h]);
    }
    // nooit meer vellen dan los per formaat
    const los = Object.values(Object.groupBy(lijst, m => m.b + 'x' + m.h)).reduce((s, g) => s + Math.ceil(g.length / a4Indeling(g[0].b, g[0].h).posities.length), 0);
    assert.ok(vellen.length <= los, `${vellen.length} > ${los}`);
  }
});

test('pak_a4_te_groot_valt_weg', () => {
  assert.deepEqual(pakA4([{ b: 300, h: 300 }, { b: 74, h: 105 }]).flat().map(p => p.i), [1]);
});
