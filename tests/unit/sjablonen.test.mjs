import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leesXlsx } from '../../v2/js/bestanden.js';
import { importeer } from '../../v2/js/import.js';
import { DSL_SJABLONEN, vul, ontbrekend, qrsVoor, standaardSjabloon } from '../../v2/js/sjablonen.js';
import { KLEURNAMEN, tint, inkt, sleutel } from '../../v2/js/kleuren.js';

const b = await readFile(new URL('../fixtures/out/voorbeeld.xlsx', import.meta.url));
const A = Object.fromEntries(importeer(await leesXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))).artikelen.map(a => [a.code, a]));
const S = Object.fromEntries(DSL_SJABLONEN.map(s => [s.id, s]));

test('dsl_sjablonen_aanwezig', () => {
  assert.deepEqual(Object.keys(S).sort(), ['backdrop', 'gitterbox', 'locatie', 'locatie-half', 'pipe-drape', 'qrlabel', 'qrlabel-half']);
  assert.deepEqual(S.gitterbox.formaat, { b: 180, h: 48 });
  assert.deepEqual(S.backdrop.formaat, { b: 74, h: 105 });
  assert.deepEqual(S['pipe-drape'].formaat, { b: 105, h: 74 });
  assert.deepEqual(S['qrlabel-half'].formaat, { b: 76, h: 28 });
  assert.equal(S.qrlabel.printer, 'label');
  assert.equal(S.backdrop.printer, 'a4');
});

test('gitterbox_2_5', () => {
  const i = vul(S.gitterbox, A.GE9402, { Doorsnede: '2,5 mm²' }, 'nl4-2.50m');
  assert.equal(i.titel, 'Speakon 4p Verlengkabel');
  assert.equal(i.groot, '2,5 m');
  assert.deepEqual(i.label, { tekst: 'NL4 2,5 mm²', kleur: '#c00000' });
  assert.equal(i.rand, '#ffff00');
  assert.equal(i.onder, 'Artikelnummer GE9402');
  assert.equal(i.qr, 'nl4-2.50m');
  assert.equal(i.opmaak, 'strook');
  assert.equal(i.logoBoven, true);
  assert.equal(i.gat, false);
  assert.equal(i.voet, false);
});

test('gitterbox_4_mm_groen_label', () => {
  const i = vul(S.gitterbox, A.GE9407, { Doorsnede: '4 mm²' }, '');
  assert.equal(i.rand, '#0050ff');
  assert.deepEqual(i.label, { tekst: 'NL4 4 mm²', kleur: '#00a050' });
});

test('koppelbus_zonder_lengte', () => {
  const i = vul(S.gitterbox, A.GE9391, { Doorsnede: '2,5 mm²' }, 'nl8-koppel');
  assert.equal(i.groot, '');
  assert.equal(i.rand, '#7f7f7f');
  assert.equal(i.titel, 'Speakon 8p Koppelbus');
});

test('twaalf_vijf_onbekend', () => {
  assert.equal(vul(S.gitterbox, A.GE9412, { Doorsnede: '2,5 mm²' }, 'nl4-12.50m').rand, '#7f7f7f');
});

test('ontbrekende_doorsnede', () => {
  const o = ontbrekend(S.gitterbox, A.GE9402, {});
  assert.deepEqual(o.map(v => v.naam), ['Doorsnede']);
  assert.deepEqual(o[0].opties, ['2,5 mm²', '4 mm²']);
  assert.deepEqual(ontbrekend(S.gitterbox, A.GE9402, { Doorsnede: '4 mm²' }), []);
  assert.deepEqual(ontbrekend(S.qrlabel, A.GE9402, {}), []);
});

test('backdrop_per_exemplaar', () => {
  assert.deepEqual(qrsVoor(A['LI8163-B']), ['bd6x3b-01', 'bd6x3b-02']);
  const i = vul(S.backdrop, A['LI8163-B'], { Kleur: 'Zwart' }, 'bd6x3b-01');
  assert.equal(i.titel, 'Backdrop');
  assert.equal(i.groot, '6 × 3 m');
  assert.deepEqual(i.eigenschappen, [['Kwaliteit', 'B'], ['Kleur', 'Zwart']]);
  assert.equal(i.qr, 'bd6x3b-01');
  assert.equal(i.cert, 'Gecertificeerd volgens DIN 4102 B1');
  assert.equal(i.gat, true);
  assert.equal(i.voet, true);
  assert.deepEqual(ontbrekend(S.backdrop, A['LI8163-B'], {}).map(v => v.naam), ['Kleur']);
});

test('lege_eigenschap_valt_weg', () => {
  const zonder = { ...A['LI8163-B'], naam: 'Backdrop 1 x 6m' };
  assert.deepEqual(vul(S.backdrop, zonder, { Kleur: 'Wit' }, 'x').eigenschappen, [['Kleur', 'Wit']]);
});

test('pipe_drape', () => {
  const i = vul(S['pipe-drape'], A.PD5143, {}, '1004421');
  assert.equal(i.titel, 'Pipe & Drape');
  assert.equal(i.groot, '4 × 3 m');
  assert.deepEqual(i.eigenschappen, [['Inhoud', 'Pipe & drape doek zw satijn geplooid']]);
  assert.equal(i.opmaak, 'liggend');
});

test('qrlabel_en_locatie', () => {
  const q = vul(S.qrlabel, A.GE9402, {}, 'nl4-2.50m');
  assert.equal(q.titel, 'Speakon 4p Verlengkabel 2,5m');
  assert.equal(q.onder, 'V-1-2');
  assert.equal(q.qr, 'nl4-2.50m');
  assert.equal(q.label, null);
  const l = vul(S.locatie, A.GE9402, {}, 'nl4-2.50m');
  assert.equal(l.titel, 'V-1-2');
  assert.equal(l.qr, 'V-1-2');
  assert.equal(l.onder, 'Speakon 4p Verlengkabel 2,5m');
});

test('qrs_terugval', () => {
  assert.deepEqual(qrsVoor(A.CO1120), ['kenporto-00']);
  assert.deepEqual(qrsVoor(A.GE9407), ['']);
  assert.deepEqual(qrsVoor(A.GE9402), ['nl4-2.50m']);
});

test('standaardsjabloon', () => {
  assert.equal(standaardSjabloon(A.GE9402, 'bordje'), 'gitterbox');
  assert.equal(standaardSjabloon(A['LI8163-B'], 'bordje'), 'backdrop');
  assert.equal(standaardSjabloon(A.PD5143, 'bordje'), 'pipe-drape');
  assert.equal(standaardSjabloon(A.CO1120, 'bordje'), 'qrlabel');
  assert.equal(standaardSjabloon(A.GE9402, 'qrlabel'), 'qrlabel');
  assert.equal(standaardSjabloon(A.GE9402, 'locatie'), 'locatie');
});

test('kleuren', () => {
  assert.equal(sleutel('2.5'), '2,5');
  assert.equal(sleutel(' 2,5 mm² '), '2,5mm²');
  assert.equal(sleutel('6 x 3'), '6×3');
  assert.equal(inkt('#ffff00'), '#000');
  assert.equal(inkt('#0050ff'), '#fff');
  assert.equal(tint('#ff0000', 0.25), 'rgb(255,191,191)');
  assert.equal(KLEURNAMEN.oranje, '#ff8c00');
});
