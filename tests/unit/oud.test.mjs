import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leesV25 } from '../../v2/js/oud.js';
import { vul, ontbrekend, qrsVoor, standaardSjabloon } from '../../v2/js/sjablonen.js';
import { PROFIEL_STANDAARD } from '../../v2/js/standaard.js';
import { TOEGESTANE_VELDEN } from '../../v2/js/import.js';

const DSL = PROFIEL_STANDAARD.dsl;
const DSLS = Object.fromEntries(DSL.sjablonen.map(s => [s.id, s]));

// Echte v25-structuren: wat versie 25 in localStorage bewaart (hier als gelezen JSON).
const F = JSON.parse(await readFile(new URL('../fixtures/v25-voorbeeld.json', import.meta.url), 'utf8'));
const opslagVan = (map) => ({ get: (k) => (k in map ? (typeof map[k] === 'string' ? map[k] : JSON.stringify(map[k])) : null) });
const exportVan = (f) => ({ type: 'labelmaker-bordjes', version: 2, bordjes: f['lm-signs'], sjablonen: f['lm-tpls'], certicoon: f['lm-certicon'] });
const sjabloonVan = (r, id) => r.sjablonen.find(s => s.id === id);
const itemVan = (r, id) => r.losseItems.find(x => x.id === id);

// Een v25-sjabloon zoals het beheerformulier het bewaart.
const tpl = (extra = {}) => ({
  id: 'tx', naam: 'Proef', titel: '', fmt: 'P', fields: 'b | Breedte | getal | m', hero: '{b} m', regels: 'Breedte: {b} m',
  xl: '', xt: '', cert: '', ckey: '{b}', w: '', h: '', badge: '', bkey: '', colors: {}, bcolors: {}, nofoot: false, nohole: false, logotop: false, ...extra,
});
const uitTpls = (...t) => leesV25({ opslag: opslagVan({ 'lm-tpls': t }) });
const bordje = (extra = {}) => ({ id: 'sx', fmt: 'P', titel: 'Titel', hero: '', kleur: '#ffff00', regels: '', extraLabel: 'Omschrijving', extraText: '', qr: '', cert: '', ...extra });
const uitBordjes = (bordjes, tpls = []) => leesV25({ export: { type: 'labelmaker-bordjes', bordjes, sjablonen: tpls } });

test('v25_kleuren_naar_dsl', () => {
  const r = leesV25({ export: exportVan(F) });
  assert.equal(r.kleurenDsl.backdrop['6×3,5'], '#b000b0');
  assert.equal(r.kleurenDsl.gitterbox['25'], '#ff8c00');
  assert.equal(r.kleurenDsl.gitterbox['2,5'], '#ffff00');
  assert.equal(r.kleurenDsl['pipe-drape']['3×3'], '#ffff00');
  assert.deepEqual(Object.keys(r.kleurenDsl).sort(), ['backdrop', 'gitterbox', 'pipe-drape']);
  // de drie standaardsjablonen worden geen nieuw sjabloon
  assert.ok(!r.sjablonen.some(s => /^v25-t-(backdrop|pd|gbkabel)$/.test(s.id)));
  assert.ok(!r.sjablonen.some(s => ['backdrop', 'pipe-drape', 'gitterbox'].includes(s.id)));
});

test('v25_kleursleutels_worden_genormaliseerd', () => {
  const r = uitTpls({ id: 't-backdrop', naam: 'Backdrop', colors: { '6 x 3.5': '#B000B0', '3x2': 'rood', '4 x 4': 'red;background:url(x)', '5 x 5': '#fff' } });
  assert.deepEqual(r.kleurenDsl.backdrop, { '6×3,5': '#b000b0', '3×2': '#ff0000' });
});

test('v25_kleuren_werken_in_de_dsl_sjablonen', () => {
  const r = leesV25({ export: exportVan(F) });
  const backdrop = { ...DSLS.backdrop, kleuren: { rand: { ...DSLS.backdrop.kleuren.rand, waarden: r.kleurenDsl.backdrop } } };
  const art = { naam: 'Backdrop 6 x 3,5m', code: 'LI1', qr: '', exemplaren: [], soort: 'bulk' };
  assert.equal(vul(backdrop, art, { Kleur: 'Zwart' }, '').rand, '#b000b0');
  const gitterbox = { ...DSLS.gitterbox, kleuren: { ...DSLS.gitterbox.kleuren, rand: { ...DSLS.gitterbox.kleuren.rand, waarden: r.kleurenDsl.gitterbox } } };
  assert.equal(vul(gitterbox, { naam: 'Speakon 4p Verlengkabel 25m', code: 'GE1' }, { Doorsnede: '4 mm²' }, '').rand, '#ff8c00');
});

test('v25_eigen_sjabloon', () => {
  const r = leesV25({ export: exportVan(F) });
  const s = sjabloonVan(r, 'v25-t1k9x3ab');
  assert.equal(s.naam, 'Kabelhaspel');
  assert.equal(s.printer, 'a4');
  assert.equal(s.opmaak, 'staand');
  assert.deepEqual(s.formaat, { b: 74, h: 105 });
  assert.deepEqual(s.velden, [
    { naam: 'Lengte', soort: 'getal', eenheid: 'm', herkomst: { type: 'aanvulling' }, verplicht: true },
    { naam: 'Type', soort: 'keuze', opties: ['Schuko', 'CEE 16A', 'CEE 32A'], herkomst: { type: 'aanvulling' }, verplicht: true },
    { naam: 'Opmerking', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false },
  ]);
  assert.deepEqual(s.plekken, {
    titel: ['Kabelhaspel'],
    groot: [{ veld: 'Lengte' }, ' m'],
    label: [{ veld: 'Type' }],
    eigenschappen: [
      { kop: 'Lengte', waarde: [{ veld: 'Lengte' }, ' m'] },
      { kop: 'Type', waarde: [{ veld: 'Type' }] },
      { kop: 'Opmerking', waarde: [{ veld: 'Opmerking' }] },
      { kop: 'Inhoud', waarde: ['Haspel met ', { veld: 'Lengte' }, ' m kabel'] },
    ],
    onder: [],
  });
  assert.deepEqual(s.kleuren.rand, { sleutel: [{ veld: 'Lengte' }], waarden: { 25: '#ff8c00', 50: '#7030a0' } });
  assert.deepEqual(s.kleuren.label, { sleutel: [{ veld: 'Type' }], waarden: { cee16a: '#00a050', schuko: '#7f7f7f' } });
  assert.equal(s.gat, true);
  assert.equal(s.voet, true);
  assert.equal(s.logoBoven, false);
  assert.equal(s.cert, '');
  assert.equal(s.regelsVeld, undefined);
});

test('v25_eigen_sjabloon_tekent_zoals_versie_25', () => {
  const r = leesV25({ export: exportVan(F) });
  const s = sjabloonVan(r, 'v25-t1k9x3ab');
  const los = itemVan(r, 'v25-sm2f7q1z');
  const i = vul(s, los, r.aanvullingen[los.id], 'hsp-50-01');
  assert.equal(i.titel, 'Kabelhaspel');
  assert.equal(i.groot, '50 m');
  // de regel met de lege optionele opmerking valt weg, zoals in versie 25
  assert.deepEqual(i.eigenschappen, [['Lengte', '50 m'], ['Type', 'CEE 16A'], ['Inhoud', 'Haspel met 50 m kabel']]);
  assert.equal(i.rand, '#7030a0');
  assert.deepEqual(i.label, { tekst: 'CEE 16A', kleur: '#00a050' });
  assert.equal(i.qr, 'hsp-50-01');
  assert.equal(i.opmaak, 'staand');
  // alles ingevuld, dus niets dat nog gevraagd wordt
  assert.deepEqual(ontbrekend(s, los, r.aanvullingen[los.id]), []);
  assert.deepEqual(ontbrekend(s, los, {}).map(v => v.naam), ['Lengte', 'Type']);
});

test('v25_sjabloon_formaat_en_vlaggen', () => {
  const r = uitTpls(
    tpl({ id: 'a', fmt: 'L' }),
    tpl({ id: 'b', fmt: 'P', w: '100', h: 150 }),
    tpl({ id: 'c', fmt: 'L', w: 180, h: 48, nofoot: true, nohole: true, logotop: true }),
    tpl({ id: 'd', fmt: 'L', w: '120', h: '60' }),
    tpl({ id: 'e', fmt: 'L', w: 156, h: 60 }),
    tpl({ id: 'f', fmt: 'L', w: 200, h: 61 }),
    tpl({ id: 'g', fmt: undefined, w: '', h: '' }),
    tpl({ id: 'h', fmt: 'L', w: 130 }),
  );
  const k = (id) => { const s = sjabloonVan(r, 'v25-' + id); return [s.opmaak, s.formaat.b, s.formaat.h]; };
  assert.deepEqual(k('a'), ['liggend', 105, 74]);
  assert.deepEqual(k('b'), ['staand', 100, 150]);
  assert.deepEqual(k('c'), ['strook', 180, 48]);
  assert.deepEqual(k('d'), ['liggend', 120, 60]);
  assert.deepEqual(k('e'), ['strook', 156, 60]);
  assert.deepEqual(k('f'), ['liggend', 200, 61]);
  assert.deepEqual(k('g'), ['staand', 74, 105]);
  assert.deepEqual(k('h'), ['liggend', 130, 74]);
  const c = sjabloonVan(r, 'v25-c');
  assert.deepEqual([c.gat, c.voet, c.logoBoven], [false, false, true]);
  assert.deepEqual([sjabloonVan(r, 'v25-a').gat, sjabloonVan(r, 'v25-a').voet], [true, true]);
  for (const s of r.sjablonen) assert.equal(s.printer, 'a4');
});

test('v25_sjabloon_certificaat_en_titel', () => {
  const r = uitTpls(tpl({ id: 'c', naam: 'Met cert', titel: 'Kist {b}', cert: 'Gecertificeerd volgens DIN 4102 B1' }));
  const s = sjabloonVan(r, 'v25-c');
  assert.equal(s.cert, 'Gecertificeerd volgens DIN 4102 B1');
  assert.deepEqual(s.plekken.titel, ['Kist ', { veld: 'Breedte' }]);
});

test('v25_sjabloon_onbekend_veld_en_dubbele_labels', () => {
  const r = uitTpls(tpl({ id: 'u', fields: 'a | Maat | getal | cm\nb | Maat | getal | cm\nc | | tekst | optioneel', hero: '{a} x {b} {zz}', regels: 'Eerste: {a}\nTweede: {b}\n{c}\nzonder dubbele punt', badge: '{c}' }));
  const s = sjabloonVan(r, 'v25-u');
  assert.deepEqual(s.velden.map(v => v.naam), ['Maat', 'Maat (b)', 'c']);
  assert.deepEqual(s.velden.map(v => v.verplicht), [true, true, false]);
  assert.equal(s.velden[0].eenheid, 'cm');
  assert.deepEqual(s.plekken.groot, [{ veld: 'Maat' }, ' x ', { veld: 'Maat (b)' }, ' …']);
  assert.deepEqual(s.plekken.eigenschappen.map(e => e.kop), ['Eerste', 'Tweede', '', '']);
  assert.deepEqual(s.plekken.eigenschappen[3].waarde, ['zonder dubbele punt']);
  assert.deepEqual(s.plekken.label, [{ veld: 'c' }]);
});

test('v25_sjabloon_zonder_velden_of_kleuren', () => {
  const r = uitTpls(tpl({ id: 'k', fields: '', hero: '', regels: '', ckey: '', colors: { 1: '#ff0000' } }), { naam: 'zonder id' }, null, 'rommel');
  assert.equal(r.sjablonen.length, 1);
  const s = r.sjablonen[0];
  assert.deepEqual(s.velden, []);
  assert.deepEqual(s.plekken, { titel: ['Proef'], groot: [], label: [], eigenschappen: [], onder: [] });
  assert.deepEqual(s.kleuren, {});
  assert.equal(vul(s, { naam: 'x' }, {}, '').rand, '#7f7f7f');
  assert.equal(r.telling.sjablonen, 1);
});

test('v25_bordjes_naar_losse_items', () => {
  const r = leesV25({ export: exportVan(F), opslag: opslagVan(F) });
  assert.deepEqual(itemVan(r, 'v25-sm2f7q1z'), {
    id: 'v25-sm2f7q1z', naam: 'Kabelhaspel', code: '', qr: 'hsp-50-01', exemplaren: [], pad: '', map: 'Losse items', locatie: '',
    soort: 'bulk', type: 'Los item', combinatie: false, aantal: 0, sjabloon: 'v25-t1k9x3ab',
  });
  assert.deepEqual(r.aanvullingen['v25-sm2f7q1z'], { Lengte: '50', Type: 'CEE 16A' });

  // vrij bordje met twee QR-codes op aparte regels: per code een bordje
  const vrij = itemVan(r, 'v25-sm2f9k4c');
  assert.deepEqual(vrij, {
    id: 'v25-sm2f9k4c', naam: 'Kabelgoot', code: '', qr: 'DSLB0615-01', exemplaren: ['DSLB0615-01', 'DSLB0615-02'], pad: '', map: 'Losse items', locatie: '',
    soort: 'serie', type: 'Los item', combinatie: false, aantal: 0, sjabloon: 'vrij-liggend',
  });
  assert.deepEqual(qrsVoor(vrij), ['DSLB0615-01', 'DSLB0615-02']);
  assert.deepEqual(r.aanvullingen['v25-sm2f9k4c'], {
    Groot: '3 m', Regels: 'Breedte: 20 cm\nKleur: Grijs\nOmschrijving: Per stuk verpakt', Randkleur: 'groen',
  });
  assert.deepEqual(r.telling, { sjablonen: 1, bordjes: 2, labels: 2, locaties: 2 });
  assert.equal(r.losseItems.length, 6);
});

test('v25_losse_items_zijn_artikelen_zonder_verboden_velden', () => {
  const r = leesV25({ export: exportVan(F), opslag: opslagVan(F) });
  const mag = new Set(['id', 'combinatie', 'sjabloon', ...TOEGESTANE_VELDEN]);
  for (const a of r.losseItems) {
    for (const k of Object.keys(a)) assert.ok(mag.has(k), k);
    assert.ok(a.id.startsWith('v25-'), a.id);
    assert.equal(a.map, 'Losse items');
    assert.equal(a.type, 'Los item');
  }
  assert.equal(new Set(r.losseItems.map(a => a.id)).size, r.losseItems.length);
});

test('v25_vrij_bordje_tekent_zoals_versie_25', () => {
  const r = leesV25({ export: exportVan(F) });
  const s = sjabloonVan(r, 'vrij-liggend');
  const los = itemVan(r, 'v25-sm2f9k4c');
  const i = vul(s, los, r.aanvullingen[los.id], 'DSLB0615-02');
  assert.equal(i.titel, 'Kabelgoot');
  assert.equal(i.groot, '3 m');
  assert.deepEqual(i.eigenschappen, [['Breedte', '20 cm'], ['Kleur', 'Grijs'], ['Omschrijving', 'Per stuk verpakt']]);
  assert.equal(i.rand, '#00b050');
  assert.equal(i.opmaak, 'liggend');
  assert.deepEqual(i.formaat, { b: 105, h: 74 });
  assert.equal(i.qr, 'DSLB0615-02');
  assert.equal(i.onder, '');
  assert.equal(i.gat, true);
  assert.deepEqual(ontbrekend(s, los, r.aanvullingen[los.id]), []);
});

test('v25_vrije_sjablonen_alleen_als_ze_nodig_zijn', () => {
  const r = leesV25({ export: exportVan(F) });
  assert.deepEqual(r.sjablonen.map(s => s.id), ['v25-t1k9x3ab', 'vrij-liggend']);
  const alleen = uitBordjes([bordje({ fmt: 'P' })]);
  assert.deepEqual(alleen.sjablonen.map(s => s.id), ['vrij-staand']);
  assert.deepEqual(uitBordjes([bordje({ fmt: 'P' }), bordje({ id: 'sy', fmt: 'L' })]).sjablonen.map(s => s.id), ['vrij-staand', 'vrij-liggend']);
  assert.deepEqual(uitBordjes([]).sjablonen, []);
  const s = sjabloonVan(alleen, 'vrij-staand');
  assert.equal(s.printer, 'a4');
  assert.equal(s.opmaak, 'staand');
  assert.deepEqual(s.formaat, { b: 74, h: 105 });
  assert.equal(s.regelsVeld, 'Regels');
  assert.ok(s.velden.some(v => v.naam === 'Regels' && v.herkomst.type === 'aanvulling' && !v.verplicht));
  assert.ok(s.velden.some(v => v.naam === 'Groot'));
  const l = sjabloonVan(uitBordjes([bordje({ fmt: 'L' })]), 'vrij-liggend');
  assert.deepEqual(l.formaat, { b: 105, h: 74 });
  assert.equal(l.opmaak, 'liggend');
});

test('v25_vrij_bordje_kleur', () => {
  const r = uitBordjes([bordje({ id: 'a', kleur: '#FFFF00' }), bordje({ id: 'b', kleur: '#123ABC' }), bordje({ id: 'c', kleur: undefined }), bordje({ id: 'd', kleur: 'rommel' })]);
  assert.equal(r.aanvullingen['v25-a'].Randkleur, 'geel');
  assert.equal(r.aanvullingen['v25-b'].Randkleur, '#123abc');
  assert.equal(r.aanvullingen['v25-c'].Randkleur, 'geel');
  assert.equal(r.aanvullingen['v25-d'], undefined); // geen bruikbare kleur, geen tekst: niets te bewaren
  const s = sjabloonVan(r, 'vrij-staand');
  const rand = (id) => vul(s, itemVan(r, id), r.aanvullingen[id], '').rand;
  assert.equal(rand('v25-a'), '#ffff00');
  assert.equal(rand('v25-b'), '#123abc');
  assert.equal(rand('v25-c'), '#ffff00');
  assert.equal(rand('v25-d'), '#7f7f7f');
  assert.ok(s.velden.find(v => v.naam === 'Randkleur').opties.includes('#123abc'));
});

test('v25_qr_regels_worden_exemplaren', () => {
  const r = uitBordjes([
    bordje({ id: 'a', qr: 'x1, x2;x3\tx4\nx1\r\n\n x5 ' }),
    bordje({ id: 'b', qr: 'enkel' }),
    bordje({ id: 'c', qr: '' }),
    bordje({ id: 'd', qr: undefined }),
  ]);
  assert.deepEqual([itemVan(r, 'v25-a').qr, itemVan(r, 'v25-a').exemplaren, itemVan(r, 'v25-a').soort], ['x1', ['x1', 'x2', 'x3', 'x4', 'x5'], 'serie']);
  assert.deepEqual([itemVan(r, 'v25-b').qr, itemVan(r, 'v25-b').exemplaren, itemVan(r, 'v25-b').soort], ['enkel', [], 'bulk']);
  assert.deepEqual([itemVan(r, 'v25-c').qr, itemVan(r, 'v25-c').exemplaren, itemVan(r, 'v25-c').soort], ['', [], 'bulk']);
  assert.deepEqual(qrsVoor(itemVan(r, 'v25-b')), ['enkel']);
});

test('v25_bordje_uit_standaardsjabloon_wordt_een_vrij_bordje', () => {
  // t-backdrop hoort in v2 bij de DSL-sjablonen; een opgeslagen bordje ervan blijft bewaard als vrij bordje
  const backdrop = {
    id: 'sb1', fmt: 'P', titel: 'Backdrop', hero: '6 × 3,5 m', kleur: '#b000b0', regels: 'Breedte: 6 m, knooplinten\nHoogte: 3,5 m\nKleur: Zwart',
    extraLabel: 'Kwaliteit', extraText: 'B1 brandvertragend', qr: 'bd6x3b-01\nbd6x3b-02', cert: 'Gecertificeerd volgens DIN 4102 B1',
    tpl: 't-backdrop', vals: { b: '6', h: '3,5', kleur: 'Zwart' },
  };
  const r = uitBordjes([backdrop], F['lm-tpls']);
  assert.equal(itemVan(r, 'v25-sb1').sjabloon, 'vrij-staand');
  assert.equal(itemVan(r, 'v25-sb1').naam, 'Backdrop');
  assert.deepEqual(itemVan(r, 'v25-sb1').exemplaren, ['bd6x3b-01', 'bd6x3b-02']);
  assert.deepEqual(r.aanvullingen['v25-sb1'], {
    Groot: '6 × 3,5 m',
    Regels: 'Breedte: 6 m, knooplinten\nHoogte: 3,5 m\nKleur: Zwart\nKwaliteit: B1 brandvertragend\nGecertificeerd volgens DIN 4102 B1',
    Randkleur: '#b000b0',
  });
  const i = vul(sjabloonVan(r, 'vrij-staand'), itemVan(r, 'v25-sb1'), r.aanvullingen['v25-sb1'], 'bd6x3b-01');
  assert.equal(i.rand, '#b000b0');
  assert.deepEqual(i.eigenschappen.map(e => e[0]), ['Breedte', 'Hoogte', 'Kleur', 'Kwaliteit', '']);
});

test('v25_bordje_uit_standaardsjabloon_volgt_het_sjabloon_van_nu', () => {
  // versie 25 berekent het bordje bij het tonen opnieuw uit het sjabloon, dus doen wij dat ook
  const sjablonen = F['lm-tpls'].map(t => (t.id === 't-backdrop' ? { ...t, xt: 'B2 brandvertragend', colors: { '6×3,5': '#00b050' } } : t));
  const oud = { id: 'sb2', fmt: 'P', titel: 'Backdrop', hero: '6 × 3,5 m', kleur: '#b000b0', regels: 'oud', extraLabel: 'Kwaliteit', extraText: 'B1 brandvertragend', qr: '', cert: '', tpl: 't-backdrop', vals: { b: '6', h: '3,5', kleur: 'Wit' } };
  const r = uitBordjes([oud], sjablonen);
  assert.equal(r.aanvullingen['v25-sb2'].Regels, 'Breedte: 6 m, knooplinten\nHoogte: 3,5 m\nKleur: Wit\nKwaliteit: B2 brandvertragend\nGecertificeerd volgens DIN 4102 B1');
  assert.equal(r.aanvullingen['v25-sb2'].Randkleur, 'groen');
});

test('v25_gitterbox_bordje_krijgt_de_badge_als_regel', () => {
  const gb = {
    id: 'sg1', fmt: 'L', titel: 'Speakon 4p Verlengkabel', hero: '2,5 m', kleur: '#ffff00', regels: 'Artikelnummer: GE9402', extraLabel: '', extraText: '', qr: 'nl4-2.50m', cert: '',
    _badge: 'NL4 2,5 mm²', tpl: 't-gbkabel', vals: { art: 'GE9402', naam: 'Speakon 4p Verlengkabel', l: '2,5', con: 'NL4', mm: '2,5 mm²' },
  };
  const r = uitBordjes([gb], F['lm-tpls']);
  assert.equal(itemVan(r, 'v25-sg1').sjabloon, 'vrij-liggend');
  assert.equal(r.aanvullingen['v25-sg1'].Groot, '2,5 m');
  assert.equal(r.aanvullingen['v25-sg1'].Regels, 'Artikelnummer: GE9402\nNL4 2,5 mm²');
  assert.equal(r.aanvullingen['v25-sg1'].Randkleur, 'geel');
});

test('v25_bordje_zonder_sjabloon_in_de_export_gebruikt_wat_is_bewaard', () => {
  // een export zonder sjablonen: het bordje heeft zijn tekst al bewaard
  const r = leesV25({ export: { type: 'labelmaker-bordjes', bordjes: F['lm-signs'] } });
  const los = itemVan(r, 'v25-sm2f7q1z');
  assert.equal(los.sjabloon, 'vrij-staand');
  assert.deepEqual(r.aanvullingen[los.id], { Groot: '50 m', Regels: 'Lengte: 50 m\nType: CEE 16A\nInhoud: Haspel met 50 m kabel\nCEE 16A', Randkleur: 'paars' });
  assert.deepEqual(r.sjablonen.map(s => s.id), ['vrij-staand', 'vrij-liggend']);
  assert.equal(r.telling.sjablonen, 0);
  assert.equal(r.telling.bordjes, 2);
});

test('v25_kleur_van_bordje_zonder_kleur_in_het_sjabloon', () => {
  const s = tpl({ id: 'k', colors: { 5: '#00b050' } });
  const uit = uitBordjes([
    bordje({ id: 'a', tpl: 'k', vals: { b: '5' }, kleur: '#00b050' }),
    bordje({ id: 'b', tpl: 'k', vals: { b: '7,5' }, kleur: '#123456' }),
    bordje({ id: 'c', tpl: 'k', vals: { b: '9' }, kleur: '#7f7f7f' }),
    bordje({ id: 'd', tpl: 'k', vals: { b: '7.5' }, kleur: '#654321' }),
  ], [s]);
  const sj = sjabloonVan(uit, 'v25-k');
  const rand = (id) => vul(sj, itemVan(uit, 'v25-' + id), uit.aanvullingen['v25-' + id], '').rand;
  assert.equal(rand('a'), '#00b050');
  assert.equal(rand('b'), '#123456');
  assert.equal(rand('c'), '#7f7f7f');
  assert.equal(rand('d'), '#123456'); // dezelfde maat: de eerste kleur blijft
  assert.deepEqual(sj.kleuren.rand.waarden, { 5: '#00b050', '7,5': '#123456' });
});

test('v25_bordje_zonder_titel_of_sjabloon_wordt_overgeslagen', () => {
  const r = uitBordjes([null, {}, { id: 'leeg' }, 'tekst', bordje({ id: 'goed' })]);
  assert.deepEqual(r.losseItems.map(x => x.id), ['v25-goed']);
  assert.equal(r.telling.bordjes, 1);
});

test('v25_bordje_zonder_id_krijgt_een_vaste_naam', () => {
  const a = uitBordjes([bordje({ id: undefined, titel: 'A' }), bordje({ id: undefined, titel: 'B' })]);
  const b = uitBordjes([bordje({ id: undefined, titel: 'A' }), bordje({ id: undefined, titel: 'B' })]);
  assert.deepEqual(a.losseItems.map(x => x.id), ['v25-bordje-1', 'v25-bordje-2']);
  assert.deepEqual(a, b);
});

test('v25_labels_en_locaties', () => {
  const r = leesV25({ opslag: opslagVan(F) });
  const labels = r.losseItems.filter(x => x.sjabloon === 'qrlabel');
  assert.deepEqual(labels.map(x => x.id), ['v25-lib-nl4-2.50m', 'v25-lib-kenporto-00']);
  assert.deepEqual(labels[0], {
    id: 'v25-lib-nl4-2.50m', naam: 'Speakon 4p Verlengkabel 2,5m', code: '', qr: 'nl4-2.50m', exemplaren: [], pad: '', map: 'Losse items', locatie: 'V-1-2',
    soort: 'bulk', type: 'Los item', combinatie: false, aantal: 0, sjabloon: 'qrlabel',
  });
  const q = vul(DSLS.qrlabel, labels[0], {}, labels[0].qr);
  assert.equal(q.titel, 'Speakon 4p Verlengkabel 2,5m');
  assert.equal(q.onder, 'V-1-2');
  assert.equal(q.qr, 'nl4-2.50m');

  const locaties = r.losseItems.filter(x => x.sjabloon === 'locatie');
  assert.deepEqual(locaties.map(x => [x.id, x.locatie, x.naam]), [['v25-loc-V-1-2', 'V-1-2', 'Speakon 4p Verlengkabel'], ['v25-loc-A1', 'A1', 'Portofoons']]);
  assert.deepEqual(locaties[0], {
    id: 'v25-loc-V-1-2', naam: 'Speakon 4p Verlengkabel', code: '', qr: '', exemplaren: [], pad: '', map: 'Losse items', locatie: 'V-1-2',
    soort: 'bulk', type: 'Los item', combinatie: false, aantal: 0, sjabloon: 'locatie',
  });
  const l = vul(DSLS.locatie, locaties[0], {}, '');
  assert.equal(l.titel, 'V-1-2');
  assert.equal(l.qr, 'V-1-2');
  assert.equal(l.onder, 'Speakon 4p Verlengkabel');
  assert.deepEqual(r.telling, { sjablonen: 1, bordjes: 2, labels: 2, locaties: 2 });
  // een label of locatie van een los item gebruikt altijd zijn eigen sjabloon
  assert.equal(standaardSjabloon(labels[0], 'bordje', DSL.regels), 'qrlabel');
});

test('v25_locatielijst_regels', () => {
  const loc = ['A1\tRek A\t3', 'B2;Rek B', 'C3', '', '   ', ';zonder code', 'A1;Tweede A1', ' D4 ; Rek D ; 2 '].join('\r\n');
  const r = leesV25({ opslag: opslagVan({ 'lm-loc': loc }) });
  assert.deepEqual(r.losseItems.map(x => [x.id, x.locatie, x.naam]), [
    ['v25-loc-A1', 'A1', 'Rek A'], ['v25-loc-B2', 'B2', 'Rek B'], ['v25-loc-C3', 'C3', ''], ['v25-loc-A1-2', 'A1', 'Tweede A1'], ['v25-loc-D4', 'D4', 'Rek D'],
  ]);
  assert.equal(r.telling.locaties, 5);
  assert.deepEqual(leesV25({ opslag: opslagVan({ 'lm-loc': loc }) }), r); // zelfde invoer, zelfde ids
});

test('v25_labels_zonder_qr_of_naam', () => {
  const lib = [{ qr: 'a', t1: 'Naam A', t2: '' }, { qr: 'b', t1: '', t2: 'B1' }, { t1: 'zonder qr', t2: 'x' }, null, 'rommel', { qr: 'a', t1: 'dubbel', t2: '' }];
  const r = leesV25({ opslag: opslagVan({ 'lm-lib': lib }) });
  assert.deepEqual(r.losseItems.map(x => [x.id, x.naam, x.qr, x.locatie]), [['v25-lib-a', 'dubbel', 'a', ''], ['v25-lib-b', 'b', 'b', 'B1']]);
  assert.equal(r.telling.labels, 2);
});

test('v25_lege_export', () => {
  for (const bron of [{ export: { type: 'labelmaker-bordjes', bordjes: [] } }, { export: { type: 'labelmaker-bordjes' } }, { export: [] }, {}, { opslag: opslagVan({}) }, undefined]) {
    const r = leesV25(bron);
    assert.deepEqual(r.sjablonen, []);
    assert.deepEqual(r.kleurenDsl, { backdrop: {}, 'pipe-drape': {}, gitterbox: {} });
    assert.deepEqual(r.losseItems, []);
    assert.deepEqual(r.aanvullingen, {});
    assert.deepEqual(r.telling, { sjablonen: 0, bordjes: 0, labels: 0, locaties: 0 });
    assert.equal(r.certIcoon, null);
  }
});

test('v25_vreemde_export_geeft_een_nederlandse_fout', () => {
  const tekst = 'Dit is geen exportbestand van versie 25 van de Labelmaker.';
  for (const vreemd of [{ type: 'labelmaker-profiel', versie: 1 }, { type: 'labelmaker-basis' }, {}, { iets: 1 }, 'tekst', 42, { bordjes: 'nee' }, { type: 'labelmaker-bordjes', bordjes: 'nee' }, { type: 'labelmaker-bordjes', sjablonen: {} }]) {
    assert.throws(() => leesV25({ export: vreemd }), { message: tekst });
  }
});

test('v25_bibliotheek_export', () => {
  const r = leesV25({ export: { type: 'labelmaker-bibliotheek', version: 1, labels: F['lm-lib'] } });
  assert.equal(r.telling.labels, 2);
  assert.equal(r.losseItems[0].sjabloon, 'qrlabel');
});

test('v25_kapotte_opslag', () => {
  const kapot = { ...F, 'lm-tpls': '{kapot' };
  const r = leesV25({ opslag: opslagVan(kapot) });
  // de sjablonen zijn weg, de rest werkt: de bordjes vallen terug op hun bewaarde tekst
  assert.deepEqual(r.sjablonen.map(s => s.id), ['vrij-staand', 'vrij-liggend']);
  assert.equal(r.telling.sjablonen, 0);
  assert.equal(r.telling.bordjes, 2);
  assert.equal(r.telling.labels, 2);
  assert.equal(r.telling.locaties, 2);
  assert.deepEqual(r.kleurenDsl, { backdrop: {}, 'pipe-drape': {}, gitterbox: {} });

  for (const sleutel of ['lm-signs', 'lm-lib']) {
    const x = leesV25({ opslag: opslagVan({ ...F, [sleutel]: '{kapot' }) });
    assert.equal(x.telling.sjablonen, 1);
  }
  assert.equal(leesV25({ opslag: opslagVan({ ...F, 'lm-signs': '{kapot' }) }).telling.bordjes, 0);
  assert.equal(leesV25({ opslag: opslagVan({ ...F, 'lm-lib': '{"geen":"lijst"}' }) }).telling.labels, 0);
  assert.equal(leesV25({ opslag: opslagVan({ ...F, 'lm-lib': 'null' }) }).telling.labels, 0);
  // localStorage die niet te lezen is (geblokkeerd) is gewoon leeg
  const geblokkeerd = leesV25({ opslag: { get() { throw new Error('geblokkeerd'); } } });
  assert.deepEqual(geblokkeerd.telling, { sjablonen: 0, bordjes: 0, labels: 0, locaties: 0 });
});

test('v25_export_en_browseropslag_geven_hetzelfde', () => {
  const uitExport = leesV25({ export: exportVan(F) });
  const uitOpslag = leesV25({ opslag: opslagVan({ 'lm-tpls': F['lm-tpls'], 'lm-signs': F['lm-signs'], 'lm-certicon': F['lm-certicon'] }) });
  assert.deepEqual(uitExport, uitOpslag);
});

test('v25_export_gaat_voor_browseropslag', () => {
  const opslag = opslagVan({ 'lm-signs': [bordje({ id: 'x', titel: 'Uit opslag' }), bordje({ id: 'y', titel: 'Alleen opslag' })] });
  const r = leesV25({ opslag, export: { type: 'labelmaker-bordjes', bordjes: [bordje({ id: 'x', titel: 'Uit export' })] } });
  assert.deepEqual(r.losseItems.map(x => [x.id, x.naam]), [['v25-x', 'Uit export'], ['v25-y', 'Alleen opslag']]);
});

test('v25_certicoon', () => {
  assert.equal(leesV25({ export: exportVan(F) }).certIcoon, F['lm-certicon']);
  assert.equal(leesV25({ opslag: opslagVan(F) }).certIcoon, F['lm-certicon']);
  assert.equal(leesV25({ opslag: opslagVan({ 'lm-certicon': 'javascript:alert(1)' }) }).certIcoon, null);
  assert.equal(leesV25({ opslag: opslagVan({ 'lm-certicon': '<svg onload=x>' }) }).certIcoon, null);
});

test('v25_alles_is_json_en_zonder_verwijzingen', () => {
  // wat we teruggeven wordt als lokale wijziging bewaard: het moet JSON-vast zijn
  const r = leesV25({ export: exportVan(F), opslag: opslagVan(F) });
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  // en het mag de invoer niet aanpassen
  const kopie = JSON.parse(JSON.stringify(F));
  leesV25({ export: exportVan(F), opslag: opslagVan(F) });
  assert.deepEqual(F, kopie);
});
