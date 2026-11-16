import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verschillen } from '../../v2/js/verschillen.js';

const art = (code, x = {}) => ({ id: code, code, naam: 'Art ' + code, qr: '', locatie: '', aantal: 1, ...x });
const kist = (gewicht, inhoud = '1 DD6') => ({ nr: 'DSL01', gewicht, inhoud });

test('verschillen_nieuw_weg_en_gewijzigd', () => {
  const oud = [art('A', { locatie: 'G1' }), art('B'), art('C', { aantal: 4 })];
  const nieuw = [art('A', { locatie: 'G2' }), art('C', { aantal: 6 }), art('D')];
  const v = verschillen(oud, nieuw);
  assert.deepEqual(v.nieuw.map(a => a.code), ['D']);
  assert.deepEqual(v.weg.map(a => a.code), ['B']);
  assert.deepEqual(v.gewijzigd.map(g => [g.code, g.wat]), [
    ['A', [{ veld: 'Locatie', van: 'G1', naar: 'G2' }]],
    ['C', [{ veld: 'Aantal', van: '4', naar: '6' }]],
  ]);
});

test('verschillen_gewicht_en_inhoud_per_kist', () => {
  const oud = [art('K', { kisten: { q1: kist('12,5'), q2: { nr: 'DSL02', gewicht: '10', inhoud: '1 DD6' } } })];
  const nieuw = [art('K', { kisten: { q1: kist('13'), q2: { nr: 'DSL02', gewicht: '10', inhoud: '2 DD6' } } })];
  assert.deepEqual(verschillen(oud, nieuw).gewijzigd[0].wat, [
    { veld: 'Gewicht DSL01', van: '12,5 kg', naar: '13 kg' },
    { veld: 'Inhoud DSL02', van: '1 DD6', naar: '2 DD6' },
  ]);
});

test('verschillen_zonder_kistgegevens_of_kolom_geen_ruis', () => {
  // Gewone materiaalexport (geen exemplaren) na een exemplarenexport: kisten niet als 'weg' melden.
  const oud = [art('K', { locatie: 'A1', kisten: { q1: kist('12') } })];
  const nieuw = [art('K', { locatie: '' })];
  assert.deepEqual(verschillen(oud, nieuw, { ontbrekend: ['locatie'] }).gewijzigd, []);
  assert.deepEqual(verschillen([], nieuw), { nieuw: [], weg: [], gewijzigd: [], eerste: true });
});
