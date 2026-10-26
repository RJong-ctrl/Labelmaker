import { test } from 'node:test';
import assert from 'node:assert/strict';
import { samen, wijzigingen } from '../../v2/js/samenvoegen.js';
import { PROFIEL_STANDAARD } from '../../v2/js/standaard.js';

const STD = PROFIEL_STANDAARD.dsl;
const leeg = () => ({ sjablonen: [], instellingen: {}, artikelen: [], losse: [], aanvullingen: {} });
const art = (code, naam = code) => ({ id: code, naam, code, qr: '', exemplaren: [], pad: '', map: '', locatie: '', soort: 'bulk', type: '', combinatie: false, aantal: 0 });
const basis = (extra = {}) => ({ type: 'labelmaker-basis', versie: 1, profiel: 'dsl', datum: '2026-10-27T10:00:00.000Z', artikelen: [art('B1')], losseItems: [], sjablonen: [], aanvullingen: {}, ...extra });

test('alleen_standaard', () => {
  const e = samen(STD, null, leeg());
  assert.deepEqual(e.sjablonen.map(s => s.id), STD.sjablonen.map(s => s.id));
  assert.equal(e.printers.label.b, 76);
  assert.deepEqual(e.artikelen, []);
  assert.equal(e.basisDatum, null);
});

test('basis_over_standaard', () => {
  const gb = { ...STD.sjablonen.find(s => s.id === 'gitterbox'), naam: 'Strook (basis)' };
  const e = samen(STD, basis({ sjablonen: [gb], printers: { label: { naam: 'Citizen', b: 100, h: 50 }, a4: { naam: 'Kantoor' } } }), leeg());
  assert.equal(e.sjablonen.find(s => s.id === 'gitterbox').naam, 'Strook (basis)');
  assert.equal(e.printers.label.b, 100);
  assert.deepEqual(e.artikelen.map(a => a.code), ['B1']);
  assert.equal(e.basisDatum, '2026-10-27T10:00:00.000Z');
});

test('lokaal_wint_per_veld', () => {
  const l = leeg();
  l.aanvullingen = { GE9402: { Doorsnede: '4 mm²' } };
  const e = samen(STD, basis({ aanvullingen: { GE9402: { Doorsnede: '2,5 mm²', Kleur: 'Wit' }, X: { Kleur: 'Rood' } } }), l);
  assert.deepEqual(e.aanvullingen.GE9402, { Doorsnede: '4 mm²', Kleur: 'Wit' });
  assert.deepEqual(e.aanvullingen.X, { Kleur: 'Rood' });
});

test('sjabloon_lokaal_verwijderd_en_nieuw', () => {
  const l = leeg();
  l.sjablonen = [{ id: 'pipe-drape', verwijderd: true }, { ...STD.sjablonen[0], id: 'kist', naam: 'Kist' }];
  const ids = samen(STD, null, l).sjablonen.map(s => s.id);
  assert.ok(!ids.includes('pipe-drape'));
  assert.equal(ids[ids.length - 1], 'kist');
});

test('nieuwste_artikellijst_wint', () => {
  const l = leeg();
  l.artikelen = [art('L1')];
  l.instellingen.artikelenDatum = '2026-10-26T10:00:00.000Z';
  assert.deepEqual(samen(STD, basis(), l).artikelen.map(a => a.code), ['B1']);
  l.instellingen.artikelenDatum = '2026-10-28T10:00:00.000Z';
  assert.deepEqual(samen(STD, basis(), l).artikelen.map(a => a.code), ['L1']);
});

test('losse_items_samen', () => {
  const l = leeg();
  l.losse = [{ ...art('los-1', 'Lokaal'), sjabloon: 'qrlabel' }, { id: 'los-2', verwijderd: true }];
  const e = samen(STD, basis({ losseItems: [{ ...art('los-2', 'Basis 2'), sjabloon: 'qrlabel' }, { ...art('los-3', 'Basis 3'), sjabloon: 'qrlabel' }] }), l);
  assert.deepEqual(e.losseItems.map(a => a.id).sort(), ['los-1', 'los-3']);
});

test('wijzigingen_lijst', () => {
  const b = basis({ aanvullingen: { GE9402: { Doorsnede: '2,5 mm²' } }, regels: STD.regels });
  const l = leeg();
  l.aanvullingen = { GE9402: { Doorsnede: '4 mm²' }, GE9412: { Doorsnede: '2,5 mm²' } };
  l.sjablonen = [{ ...STD.sjablonen.find(s => s.id === 'gitterbox'), naam: 'Strook' }];
  l.instellingen.regels = { ...STD.regels, bordje: [] };
  const w = wijzigingen(b, l);
  assert.deepEqual(w.map(x => x.soort).sort(), ['aanvulling', 'aanvulling', 'instelling', 'sjabloon']);
  assert.ok(w.every(x => typeof x.omschrijving === 'string' && x.omschrijving.length > 3));
  const a = w.find(x => x.soort === 'aanvulling' && x.id === 'GE9402');
  assert.equal(a.veld, 'Doorsnede');
  // gelijk aan basis = geen wijziging
  l.aanvullingen.GE9402.Doorsnede = '2,5 mm²';
  assert.equal(wijzigingen(b, l).filter(x => x.id === 'GE9402').length, 0);
});

test('wijziging_artikellijst_nieuwer_dan_basis', () => {
  const l = leeg();
  l.artikelen = [art('L1')];
  l.instellingen.artikelenDatum = '2026-10-28T10:00:00.000Z';
  assert.deepEqual(wijzigingen(basis(), l).map(x => x.soort), ['artikelen']);
  l.instellingen.artikelenDatum = '2026-10-20T10:00:00.000Z';
  assert.deepEqual(wijzigingen(basis(), l), []);
});
