import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lengte, maat, polen, kwaliteit, kaal, kabel, PATRONEN } from '../../v2/js/afleiden.js';

const tabel = (fn, gevallen) => { for (const [in_, uit] of gevallen) assert.equal(fn(in_), uit, in_); };

test('lengte', () => tabel(lengte, [
  ['Speakon 4p Verlengkabel 12,5m', '12,5'],
  ['Speakon 2p 1 meter kabel', '1'],
  ['Speakon 2p 75m Verlengkabel zwart op haspel', '75'],
  ['Speakon 8p Verlengkabel 1.5 m', '1,5'],
  ['Speakon 4p 2m twist (geel) Verlengkabel', '2'],
  ['Speakon 4p (Groen 4²) Verlengkabel 2,5m', '2,5'],
  ['XLR kabel 2.50 mtr', '2,5'],
  ['Speakon 8p Koppelbus', ''],
  ['Pipe & drape staander 120cm fixed', ''],
  ['Backdrop 6 x 3m B kwaliteit', ''],
  ['Pipe & drape ligger 0,9-1,2m telescopisch', '0,9-1,2'],
]));

test('maat', () => tabel(maat, [
  ['Backdrop 6 x 3m B kwaliteit', '6 × 3'],
  ['Backdrop 3.5 x 4m', '3,5 × 4'],
  ['Pipe & drape doek 4x3m zw satijn geplooid', '4 × 3'],
  ['Backdrop 1,5 x 3m', '1,5 × 3'],
  ['Pipe & drape doek 3,0 x 1,20m geplooit zwart', '3 × 1,2'],
  ['Showgear Backdrop 6 x 3,5 ( W x H ) 320g/m2', '6 × 3,5'],
  ['Backdrop 6 × 6m', '6 × 6'],
]));

test('geen_valse_maat', () => {
  tabel(maat, [
    ['LK19 > 3 x NL4 Break out t.b.v. W8LM', ''],
    ['4 x Speakon 2p 10m snake grijs Verlengkabel', ''],
    ['Speakon 1 x 4P > 2 x 8P Verloop', ''],
    ['Pipe & drape baseplate 45x45cm', ''],
  ]);
  assert.equal(lengte('4 x Speakon 2p 10m snake grijs Verlengkabel'), '10');
});

test('polen', () => tabel(polen, [
  ['Speakon 4p Verlengkabel 2,5m', 'NL4'],
  ['Speakon 8p Koppelbus', 'NL8'],
  ['Speakon 2p 1 meter kabel', 'NL2'],
  ['Speakon 4P ( Groen 4² ) bridgekabel tbv SXH218', 'NL4'],
  ['2x NL2 > 4x NL2 split box', 'NL2'],
  ['Kenwood TK-3201 Portofoon', ''],
]));

test('kwaliteit', () => tabel(kwaliteit, [
  ['Backdrop 6 x 3m B kwaliteit', 'B'],
  ['Backdrop 6 x 3m (B-kwaliteit)', 'B'],
  ['Backdrop 6 x 6m A kwaliteit', 'A'],
  ['Backdrop 1 x 6m', ''],
]));

test('kaal', () => tabel(kaal, [
  ['Speakon 4p Verlengkabel 12,5m', 'Speakon 4p Verlengkabel'],
  ['Backdrop 6 x 3m B kwaliteit', 'Backdrop'],
  ['Speakon 2p 50m Verlengkabel grijs op haspel', 'Speakon 2p Verlengkabel grijs op haspel'],
  ['Backdrop 6 x 3m (B-kwaliteit)', 'Backdrop'],
  ['Pipe & drape doek 4x3m zw satijn geplooid', 'Pipe & drape doek zw satijn geplooid'],
  ['Pipe & drape staander 1,8-4,2m telescopisch', 'Pipe & drape staander telescopisch'],
]));

test('kabel', () => tabel(kabel, [
  ['Speakon 4p Verlengkabel 2,5m', 'ja'],
  ['Speakon 4p 50m op haspel', 'ja'],
  ['Speakon 4P ( Groen 4² ) bridgekabel tbv SXH218', 'ja'],
  ['4 x Speakon 2p 10m snake grijs Verlengkabel', 'ja'],
  ['Speakon 8p Koppelbus', ''],
  ['Speakon 4p > Speakon 8p Verloop (sub)', ''],
  ['2x NL2 > 4x NL2 split box', ''],
]));

test('patronen', () => {
  assert.deepEqual(Object.keys(PATRONEN).sort(), ['kaal', 'kabel', 'kwaliteit', 'lengte', 'maat', 'polen']);
  assert.equal(PATRONEN.lengte('Speakon 4p Verlengkabel 7,5m'), '7,5');
});
