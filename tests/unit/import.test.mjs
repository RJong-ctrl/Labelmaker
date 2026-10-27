import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leesXlsx } from '../../v2/js/bestanden.js';
import { importeer, TOEGESTANE_VELDEN } from '../../v2/js/import.js';

const NEPBEDRAGEN = ['4711', '8123', '6619', '9377', '5531', '7243', '3917', '2869'];
const voorbeeld = async () => {
  const b = await readFile(new URL('../fixtures/out/voorbeeld.xlsx', import.meta.url));
  return leesXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const per = (artikelen) => Object.fromEntries(artikelen.map(a => [a.code, a]));

test('rentman_voorbeeld', async () => {
  const { artikelen, ontbrekend } = importeer(await voorbeeld());
  assert.deepEqual(ontbrekend, []);
  assert.equal(artikelen.length, 9);
  assert.deepEqual(per(artikelen).GE9402, {
    id: 'GE9402', naam: 'Speakon 4p Verlengkabel 2,5m', code: 'GE9402', qr: 'nl4-2.50m', exemplaren: [],
    pad: 'Materialen / Geluid / Bekabeling / Speakon / Speakon 4 polig', map: 'Speakon 4 polig',
    locatie: 'V-1-2', soort: 'bulk', type: 'Fysiek item', combinatie: false, aantal: 13,
  });
  assert.equal(per(artikelen).CO1120.soort, 'serie');
});

test('kolomvolgorde_maakt_niet_uit', async () => {
  const rijen = await voorbeeld();
  const volgorde = rijen[0].map((_, i) => i).reverse();
  const geschud = rijen.map(r => volgorde.map(i => r[i]));
  assert.deepEqual(importeer(geschud), importeer(rijen));
});

test('alleen_toegestane_velden', async () => {
  const { artikelen } = importeer(await voorbeeld());
  const mag = new Set(['id', ...TOEGESTANE_VELDEN, 'combinatie']);
  for (const a of artikelen) for (const k of Object.keys(a)) assert.ok(mag.has(k), k);
  const json = JSON.stringify(artikelen);
  assert.ok(!json.includes('GEHEIM'));
  assert.ok(!json.includes('droog retour'));
  for (const bedrag of NEPBEDRAGEN) assert.ok(!json.includes(bedrag), bedrag);
});

test('qr_eerste_waarde_en_exemplaren_opgeschoond', async () => {
  const a = per(importeer(await voorbeeld()).artikelen);
  assert.equal(a.PD5143.qr, '1004421');
  assert.deepEqual(a['LI8163-B'].exemplaren, ['bd6x3b-01', 'bd6x3b-02']);
  assert.deepEqual(a.GE9509.exemplaren, ['1001540', '1001541']);
  assert.equal(a.GE9407.qr, '');
});

test('combinatie_herkend', async () => {
  const a = per(importeer(await voorbeeld()).artikelen);
  assert.equal(a['*PD1011'].combinatie, true);
  assert.equal(a.GE9402.combinatie, false);
});

test('ontbrekende_kolom', async () => {
  const rijen = await voorbeeld();
  const i = rijen[0].indexOf('Pad');
  const zonder = rijen.map(r => r.filter((_, k) => k !== i));
  const { artikelen, ontbrekend } = importeer(zonder);
  assert.ok(ontbrekend.includes('pad'));
  assert.equal(artikelen.length, 9);
  assert.ok(artikelen.every(a => a.pad === ''));
});

test('zonder_code_kolom_geen_artikelen', async () => {
  const rijen = await voorbeeld();
  const i = rijen[0].indexOf('Code');
  const { artikelen, ontbrekend } = importeer(rijen.map(r => r.filter((_, k) => k !== i)));
  assert.deepEqual(artikelen, []);
  assert.ok(ontbrekend.includes('code'));
});

test('kopnamen_hoofdletters_en_spaties', () => {
  const { artikelen, ontbrekend } = importeer([[' naam (in database) ', 'CODE'], ['Kabel', 'X1'], ['Zonder code', '']]);
  assert.equal(artikelen.length, 1);
  assert.equal(artikelen[0].naam, 'Kabel');
  assert.equal(artikelen[0].aantal, 0);
  assert.ok(ontbrekend.includes('qr'));
});

// Exemplaren-export: één rij per exemplaar, met de materiaalkolommen erachter.
const EXKOP = ['Weergavenaam (Exemplaar)', 'QR-codes / RFID (Exemplaar)', 'Huidig totale gewicht (Exemplaar)', 'Actuele inhoud van (Exemplaar)',
  'Status (Exemplaar)', 'Materiaal (Exemplaar, Materiaal)', 'Aanschafprijs (Exemplaar)', 'Boekwaarde (Exemplaar)',
  'Naam (in database)', 'Code', 'QR-codes / RFID', 'QR-codes / RFID exemplaren', 'Pad', 'Map (Map)',
  'Locatie in magazijn per voorraadlocatie [Standaard voorraadlocatie]', 'Methode voorraadberekening', 'Type materiaal', 'Huidig aantal', 'Verhuur-/verkoopprijs'];
const exRij = (nr, qr, gewicht, in_, status, naam, code, exemplaren, type = 'Fysiek item') =>
  [nr, qr, gewicht, in_, status, naam, '4711', '8123', naam, code, '', exemplaren, 'Materialen / Geluid', 'Geluid', 'V-1-2', 'Serial number', type, '2', '9377'];
const EXPORT = [EXKOP,
  exRij('DSL01', '*GE2162-01', '27.34', '', 'Compleet', 'Martin Audio 2x DD6  Speaker [Case]', '*GE2162', '*GE2162-01,*GE2162-02', 'Combinatie'),
  exRij('DSL02', '*GE2162-02', '0', '', 'Incompleet', 'Martin Audio 2x DD6  Speaker [Case]', '*GE2162', '*GE2162-01,*GE2162-02', 'Combinatie'),
  exRij('DSL01', 'dd6-01', '0', 'Martin Audio 2x DD6 Speaker [Case] (DSL01)', 'Geen fysieke combinatie', 'Martin Audio DD6', 'GE2160', 'dd6-01,dd6-02,dd6-03'),
  exRij('DSL02', 'dd6-02', '0', 'Martin Audio 2x DD6 Speaker [Case] (DSL01)', 'Geen fysieke combinatie', 'Martin Audio DD6', 'GE2160', 'dd6-01,dd6-02,dd6-03'),
  exRij('DSL03', 'dd6-03', '0', 'Martin Audio 2x DD6 Speaker [Case] (DSL02)', 'Geen fysieke combinatie', 'Martin Audio DD6', 'GE2160', 'dd6-01,dd6-02,dd6-03'),
  exRij('DSL01', 'fc-01', '0', 'Martin Audio 2x DD6 Speaker [Case] (DSL01)', 'Geen fysieke combinatie', 'Flightcase DD6', 'FC0001', 'fc-01'),
];

test('exemplaren_export_inhoud_van_kisten', () => {
  const { artikelen, ontbrekend } = importeer(EXPORT);
  assert.deepEqual(ontbrekend, []);
  const a = per(artikelen);
  assert.deepEqual(Object.keys(a).sort(), ['*GE2162', 'FC0001', 'GE2160']);   // één artikel per code
  assert.deepEqual(a['*GE2162'].kisten, {
    '*GE2162-01': { nr: 'DSL01', inhoud: '2 Martin Audio DD6\n1 Flightcase DD6', gewicht: '27,34' },
    '*GE2162-02': { nr: 'DSL02', inhoud: '1 Martin Audio DD6', gewicht: '' },
  });
  assert.equal(a.GE2160.kisten, undefined);
  // nooit een prijs of waarde, waar dan ook
  const json = JSON.stringify(artikelen);
  for (const bedrag of ['4711', '8123', '9377']) assert.ok(!json.includes(bedrag), bedrag);
});
