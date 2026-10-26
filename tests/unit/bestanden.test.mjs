import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leesXlsx, leesCsv } from '../../v2/js/bestanden.js';

const OUT = new URL('../fixtures/out/', import.meta.url);
const buffer = async (naam) => { const b = await readFile(new URL(naam, OUT)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

test('xlsx_voorbeeld', async () => {
  const rijen = await leesXlsx(await buffer('voorbeeld.xlsx'));
  assert.equal(rijen.length, 10);
  assert.equal(rijen[0].length, 75);
  assert.equal(rijen[0][2], 'Naam (in database)');
  const ge = rijen.find(r => r.includes('GE9402'));
  assert.ok(ge.includes('nl4-2.50m'));
});

test('xlsx_tekens_en_getallen', async () => {
  const rijen = await leesXlsx(await buffer('voorbeeld.xlsx'));
  const kop = rijen[0];
  const pd = rijen.find(r => r.includes('PD5143'));
  assert.equal(pd[kop.indexOf('Naam (in database)')], 'Pipe & drape doek 4x3m zw satijn geplooid');
  assert.equal(pd[kop.indexOf('Huidig aantal')], '12');
  assert.equal(pd[kop.indexOf('Gewicht')], '1.5');
  const lk = rijen.find(r => r.includes('GE9509'));
  assert.equal(lk[kop.indexOf('Naam (in database)')], 'LK19 > 3 x NL4 Break out t.b.v. W8LM');
  assert.equal(lk[kop.indexOf('Opmerking extern')], 'Graag droog retour');
});

test('csv_met_bom_en_puntkomma', async () => {
  const tekst = await readFile(new URL('voorbeeld.csv', OUT), 'utf8');
  const rijen = leesCsv(tekst);
  const xlsx = await leesXlsx(await buffer('voorbeeld.xlsx'));
  assert.deepEqual(rijen[0], xlsx[0]);
  assert.equal(rijen.length, 10);
  const ge = rijen.find(r => r.includes('GE9402'));
  assert.equal(ge[rijen[0].indexOf('Korte omschrijving webshop')], 'Kabel; zwart "pro"');
});

test('csv_aanhalingstekens', () => {
  assert.deepEqual(leesCsv('a;b\n"x;y";"z ""q"""'), [['a', 'b'], ['x;y', 'z "q"']]);
});

test('csv_komma_en_tab', () => {
  assert.deepEqual(leesCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(leesCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
});
