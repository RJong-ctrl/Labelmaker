import { test } from 'node:test';
import assert from 'node:assert/strict';
import { a4Indeling, verdeel } from '../../v2/js/indeling.js';

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
