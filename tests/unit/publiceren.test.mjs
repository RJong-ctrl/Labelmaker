import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maakBasis, leesBasis, haalBasis, bestandsnaam, korteDatum } from '../../v2/js/publiceren.js';
import { samen } from '../../v2/js/samenvoegen.js';
import { PROFIEL_STANDAARD } from '../../v2/js/standaard.js';
import { TOEGESTANE_VELDEN } from '../../v2/js/import.js';

const STD = PROFIEL_STANDAARD.dsl;
const leeg = () => ({ sjablonen: [], instellingen: {}, artikelen: [], losse: [], aanvullingen: {} });
const art = (code, naam = code, extra = {}) => ({
  id: code, naam, code, qr: 'qr-' + code, exemplaren: [], pad: 'Materialen / Geluid', map: 'Geluid', locatie: 'V-1-2',
  soort: 'bulk', type: 'Fysiek item', combinatie: false, aantal: 3, ...extra,
});
const NU = new Date('2026-10-26T20:00:00Z');

// Een effectieve toestand waar alles verbodens in zit.
function vervuild() {
  const l = leeg();
  l.artikelen = [art('GE9402', 'Speakon 4p Verlengkabel 2,5m', { prijs: 4711, verhuurprijs: '12,50', 'Opmerking intern': 'GEHEIM-OPMERKING', inkoop: 8123 })];
  l.losse = [{ ...art('los-1', 'Testkist', { sjabloon: 'qrlabel', nieuwprijs: 6619, 'Opmerking intern': 'GEHEIM-LOS' }) }];
  l.aanvullingen = { GE9402: { Doorsnede: '4 mm²', 'Opmerking intern': 'GEHEIM-AANV' } };
  const e = samen(STD, null, l);
  e.pincode = '1234';
  e.instellingen = { pincode: '1234' };
  e.huisstijl = { ...e.huisstijl, eigenLettertype: 'data:font/ttf;base64,FONTDATA', pincode: '1234' };
  e.kolommen = { ...e.kolommen, prijs: 'Verhuurprijs' };
  return e;
}

test('basis_zonder_verboden_velden', () => {
  const basis = maakBasis(vervuild(), 'dsl', NU);
  const tekst = JSON.stringify(basis);
  for (const verboden of ['4711', '12,50', 'GEHEIM', '8123', '6619', '1234', 'FONTDATA', 'pincode', 'eigenLettertype', 'Opmerking intern', 'prijs', 'inkoop']) {
    assert.ok(!tekst.includes(verboden), `"${verboden}" hoort niet in de publicatie`);
  }
  // wat wel mag, blijft
  assert.equal(basis.artikelen[0].naam, 'Speakon 4p Verlengkabel 2,5m');
  assert.equal(basis.losseItems[0].sjabloon, 'qrlabel');
  assert.deepEqual(basis.aanvullingen, { GE9402: { Doorsnede: '4 mm²' } });
  const mag = new Set(['id', 'combinatie', 'sjabloon', ...TOEGESTANE_VELDEN]);
  for (const a of [...basis.artikelen, ...basis.losseItems]) for (const k of Object.keys(a)) assert.ok(mag.has(k), k);
  assert.deepEqual(Object.keys(basis.kolommen).filter(k => !TOEGESTANE_VELDEN.includes(k)), []);
});

test('basis_formaat', () => {
  const basis = maakBasis(samen(STD, null, leeg()), 'dsl', NU);
  assert.deepEqual(Object.keys(basis), ['type', 'versie', 'profiel', 'datum', 'artikelen', 'losseItems', 'sjablonen', 'regels', 'huisstijl', 'printers', 'kolommen', 'aanvullingen']);
  assert.equal(basis.type, 'labelmaker-basis');
  assert.equal(basis.versie, 1);
  assert.equal(basis.profiel, 'dsl');
  assert.equal(basis.datum, '2026-10-26T20:00:00.000Z');
  assert.equal(basis.sjablonen.length, STD.sjablonen.length);
  assert.deepEqual(basis.huisstijl, STD.huisstijl);
  assert.deepEqual(basis.printers, STD.printers);
});

test('basis_datum_standaard_is_nu', () => {
  const voor = Date.now();
  const d = Date.parse(maakBasis(samen(STD, null, leeg()), 'dsl').datum);
  assert.ok(d >= voor && d <= Date.now());
});

test('basis_eigen_lettertype_blijft_pc_gebonden', () => {
  const e = samen(STD, null, leeg());
  e.huisstijl = { ...e.huisstijl, lettertype: 'eigen', eigenLettertype: 'data:font/woff2;base64,ZZZ' };
  const h = maakBasis(e, 'dsl', NU).huisstijl;
  assert.equal(h.lettertype, 'eigen');
  assert.ok(!JSON.stringify(h).includes('ZZZ'));
});

test('basis_rondreis', () => {
  const e = vervuild();
  const r = leesBasis(JSON.stringify(maakBasis(e, 'dsl', NU)));
  assert.equal(r.fout, undefined);
  const basis = r.basis;
  assert.deepEqual(basis.sjablonen, JSON.parse(JSON.stringify(e.sjablonen)));
  assert.deepEqual(basis.aanvullingen, { GE9402: { Doorsnede: '4 mm²' } });
  assert.deepEqual(basis.artikelen.map(a => a.code), ['GE9402']);
  assert.deepEqual(basis.regels, e.regels);
  // en als basis weer onder een lege pc gelegd, komt hetzelfde terug
  const terug = samen(STD, basis, leeg());
  assert.deepEqual(terug.sjablonen.map(s => s.id), e.sjablonen.map(s => s.id));
  assert.deepEqual(terug.artikelen.map(a => a.code), ['GE9402']);
  assert.deepEqual(terug.losseItems.map(a => a.id), ['los-1']);
  assert.equal(terug.aanvullingen.GE9402.Doorsnede, '4 mm²');
  assert.equal(terug.basisDatum, '2026-10-26T20:00:00.000Z');
});

test('leesBasis_weigert_rommel', () => {
  const rommel = ['{}', '[]', 'nee', '', 'null', '"tekst"', '42', '{"type":"labelmaker-basis"', JSON.stringify({ type: 'labelmaker-basis', versie: 9 }),
    JSON.stringify({ type: 'labelmaker-profiel', versie: 1 })];
  for (const tekst of rommel) {
    const r = leesBasis(tekst);
    assert.equal(r.basis, undefined, tekst);
    assert.equal(typeof r.fout, 'string', tekst);
    assert.ok(r.fout.length > 10, tekst);
  }
});

test('leesBasis_meldingen_in_het_nederlands', () => {
  assert.equal(leesBasis('nee').fout, 'Dit bestand is geen geldig publicatiebestand: de inhoud is geen JSON.');
  assert.equal(leesBasis('{}').fout, 'Dit is geen publicatiebestand van de Labelmaker.');
  assert.equal(leesBasis('[]').fout, 'Dit is geen publicatiebestand van de Labelmaker.');
  assert.match(leesBasis(JSON.stringify({ type: 'labelmaker-basis', versie: 9 })).fout, /nieuwere versie/);
  assert.match(leesBasis(JSON.stringify({ type: 'labelmaker-basis', versie: 'een', datum: '2026-10-26T20:00:00Z' })).fout, /versie/);
  assert.match(leesBasis(JSON.stringify({ type: 'labelmaker-basis', versie: 1 })).fout, /datum/);
  assert.match(leesBasis(JSON.stringify({ type: 'labelmaker-basis', versie: 1, datum: 'gisteren' })).fout, /datum/);
});

test('leesBasis_controleert_onderdelen', () => {
  const ok = { type: 'labelmaker-basis', versie: 1, datum: '2026-10-26T20:00:00Z' };
  for (const k of ['artikelen', 'losseItems', 'sjablonen']) {
    const r = leesBasis(JSON.stringify({ ...ok, [k]: { niet: 'een lijst' } }));
    assert.equal(r.basis, undefined, k);
    assert.ok(r.fout.includes(k), k);
  }
  for (const k of ['aanvullingen', 'regels', 'huisstijl', 'printers', 'kolommen']) {
    const r = leesBasis(JSON.stringify({ ...ok, [k]: [1, 2] }));
    assert.equal(r.basis, undefined, k);
    assert.ok(r.fout.includes(k), k);
  }
  // een basis met alleen wat nodig is mag (de rest komt dan uit de standaard)
  assert.deepEqual(leesBasis(JSON.stringify({ ...ok, aanvullingen: { X: { Kleur: 'Rood' } } })).basis.aanvullingen, { X: { Kleur: 'Rood' } });
});

test('leesBasis_neemt_ook_een_al_gelezen_object', () => {
  const basis = maakBasis(samen(STD, null, leeg()), 'dsl', NU);
  assert.deepEqual(leesBasis(basis).basis, basis);
});

test('bestandsnaam', () => {
  assert.equal(bestandsnaam('dsl'), 'dsl.json');
  assert.equal(bestandsnaam('thuis-werk'), 'thuis-werk.json');
});

test('haalBasis_offline', async () => {
  assert.equal(await haalBasis('dsl', async () => { throw new TypeError('Failed to fetch'); }), null);
  assert.equal(await haalBasis('dsl', () => { throw new Error('sync'); }), null);
});

test('haalBasis_haalt_data_bestand_naast_de_pagina', async () => {
  const basis = maakBasis(vervuild(), 'dsl', NU);
  const aanroepen = [];
  const fetcher = async (url, opties) => { aanroepen.push([url, opties]); return { ok: true, status: 200, text: async () => JSON.stringify(basis) }; };
  assert.deepEqual(await haalBasis('dsl', fetcher), basis);
  assert.deepEqual(aanroepen, [['data/dsl.json', { cache: 'no-cache' }]]);
});

test('haalBasis_werkt_ook_met_json_antwoord', async () => {
  const basis = maakBasis(samen(STD, null, leeg()), 'dsl', NU);
  assert.deepEqual(await haalBasis('dsl', async () => ({ ok: true, json: async () => basis })), basis);
});

test('haalBasis_404_en_rommel_geven_null', async () => {
  assert.equal(await haalBasis('dsl', async () => ({ ok: false, status: 404, text: async () => '<html>niet gevonden</html>' })), null);
  assert.equal(await haalBasis('dsl', async () => ({ ok: true, text: async () => '{"type":"labelmaker-basis"' })), null);
  assert.equal(await haalBasis('dsl', async () => ({ ok: true, text: async () => '<!doctype html><title>Labelmaker</title>' })), null);
  assert.equal(await haalBasis('dsl', async () => ({ ok: true, text: async () => JSON.stringify({ type: 'iets-anders', versie: 1, datum: '2026-10-26T20:00:00Z' }) })), null);
  assert.equal(await haalBasis('dsl', async () => ({ ok: true, json: async () => { throw new SyntaxError('kapot'); } })), null);
  assert.equal(await haalBasis('dsl', async () => undefined), null);
});

test('haalBasis_zet_de_profielnaam_veilig_in_het_pad', async () => {
  let url;
  await haalBasis('../geheim', async (u) => { url = u; return { ok: false }; });
  assert.equal(url, 'data/..%2Fgeheim.json');
});

test('korte_datum', () => {
  assert.equal(korteDatum('2026-10-26T20:00:00Z'), '26 okt');
  assert.equal(korteDatum('2026-01-05T10:00:00.000Z'), '5 jan');
  assert.equal(korteDatum('2026-03-09T10:00:00Z'), '9 mrt');
  assert.equal(korteDatum('2026-05-31T10:00:00Z'), '31 mei');
  assert.equal(korteDatum('2026-12-24T10:00:00Z'), '24 dec');
  assert.equal(korteDatum(new Date('2026-08-01T10:00:00Z')), '1 aug');
  // na middernacht in Nederland is het al de volgende dag
  assert.equal(korteDatum('2026-10-26T23:30:00Z'), '27 okt');
  assert.equal(korteDatum('onzin'), '');
  assert.equal(korteDatum(undefined), '');
});

test('alle_maanden', () => {
  const verwacht = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  verwacht.forEach((m, i) => assert.equal(korteDatum(`2026-${String(i + 1).padStart(2, '0')}-15T12:00:00Z`), `15 ${m}`));
});

test('basis_zonder_ongewijzigde_standaard', () => {
  const std = PROFIEL_STANDAARD.dsl;
  const e = samen(std, null, { sjablonen: [], instellingen: {}, artikelen: [], losse: [], aanvullingen: {} });
  const b = maakBasis(e, 'dsl', new Date('2026-10-26T12:00:00Z'), std);
  assert.deepEqual(b.sjablonen, []);
  assert.equal(b.regels, undefined);
  assert.equal(b.huisstijl, undefined);
  assert.equal(b.printers, undefined);
  assert.equal(b.kolommen, undefined);
  const gb = std.sjablonen.find(s => s.id === 'gitterbox');
  const e2 = samen(std, null, { sjablonen: [{ ...gb, naam: 'Strook' }, { ...gb, id: 'eigen', naam: 'Eigen' }], instellingen: { printers: { label: { naam: 'X', b: 100, h: 50 }, a4: { naam: 'Y' } } }, artikelen: [], losse: [], aanvullingen: {} });
  const b2 = maakBasis(e2, 'dsl', new Date('2026-10-26T12:00:00Z'), std);
  assert.deepEqual(b2.sjablonen.map(s => s.id), ['gitterbox', 'eigen']);
  assert.equal(b2.printers.label.b, 100);
  assert.ok(!leesBasis(JSON.stringify(b2)).fout);
  // zonder standaard: alles mee (oud gedrag)
  assert.equal(maakBasis(e, 'dsl', new Date()).sjablonen.length, std.sjablonen.length);
});

test('tijdelijke_losse_items_niet_gepubliceerd', () => {
  const std = PROFIEL_STANDAARD.dsl;
  const los = (id, extra = {}) => ({ id, naam: id, code: '', qr: '', exemplaren: [], pad: '', map: 'Losse items', locatie: '', soort: 'bulk', type: 'Los item', combinatie: false, aantal: 0, sjabloon: 'leeg-staand', ...extra });
  const e = samen(std, null, { sjablonen: [], instellingen: {}, artikelen: [], losse: [los('los-tijd', { tijdelijk: true }), los('los-vast')],
    aanvullingen: { 'los-tijd': { Groot: 'x' }, 'los-vast': { Groot: 'y' }, 'los-weg': { Groot: 'z' } } });
  const b = maakBasis(e, 'dsl', new Date('2026-10-26T12:00:00Z'), std);
  assert.deepEqual(b.losseItems.map(x => x.id), ['los-vast']);
  assert.deepEqual(Object.keys(b.aanvullingen), ['los-vast']);
});
