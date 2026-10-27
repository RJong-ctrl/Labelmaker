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

test('csv_rentman_inch_teken', () => {
  // Rentman zet een " aan het eind van een naam als "" vlak voor het afsluitende teken: "Flightcase 19"";
  assert.deepEqual(leesCsv('a;b;c\n"Flightcase touchscreen 19"";"KL1964";1\n"x";"y";2'),
    [['a', 'b', 'c'], ['Flightcase touchscreen 19"', 'KL1964', '1'], ['x', 'y', '2']]);
  // netjes ge-escaped blijft werken, ook aan het eind
  assert.deepEqual(leesCsv('a;b\n"19""";"z"'), [['a', 'b'], ['19"', 'z']]);
  // een " midden in een veld zonder aanhalingstekens is gewoon een teken
  assert.deepEqual(leesCsv('a;b\nKast 19" breed;2'), [['a', 'b'], ['Kast 19" breed', '2']]);
});

test('csv_rentman_aanhalingstekens_zonder_escape', () => {
  // Rentman verdubbelt " binnen een veld niet: "Wedge 12"/1" 400W";
  assert.deepEqual(leesCsv('a;b\n"Wedge rechts 12"/1" 400W";"GE2174R"'), [['a', 'b'], ['Wedge rechts 12"/1" 400W', 'GE2174R']]);
  assert.deepEqual(leesCsv('a;b\n"x ""y"" z";2'), [['a', 'b'], ['x "y" z', '2']]);
});

test('csv_rentman_aanhalingsteken_voor_regeleinde_in_veld', () => {
  // Opmerking over meerdere regels met een " aan het eind van een regel: "2 x 10" / 1 x 1"\n\n500 Watt"
  assert.deepEqual(leesCsv('a;b;c\n"Hartke";"2 x 10" / 1 x 1"\n\n500 Watt";"VB"\n"x";"y";"z"'),
    [['a', 'b', 'c'], ['Hartke', '2 x 10" / 1 x 1"\n\n500 Watt', 'VB'], ['x', 'y', 'z']]);
});
