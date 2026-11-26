import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leesXlsx } from '../../v2/js/bestanden.js';
import { importeer } from '../../v2/js/import.js';
import { DSL_SJABLONEN, groepVan, GROEPEN, SUBGROEPEN, subgroepVan, vul, ontbrekend, qrsVoor, standaardSjabloon } from '../../v2/js/sjablonen.js';
import { KLEURNAMEN, tint, inkt, sleutel } from '../../v2/js/kleuren.js';

const b = await readFile(new URL('../fixtures/out/voorbeeld.xlsx', import.meta.url));
const A = Object.fromEntries(importeer(await leesXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))).artikelen.map(a => [a.code, a]));
const S = Object.fromEntries(DSL_SJABLONEN.map(s => [s.id, s]));

test('dsl_sjablonen_aanwezig', () => {
  assert.deepEqual(Object.keys(S).sort(), ['backdrop', 'bakbord', 'bordje-liggend', 'bordje-staand', 'gitterbox', 'kist', 'kist-bw1000', 'kist-bw6040', 'kist-modern', 'leeg-liggend', 'leeg-staand', 'locatie', 'locatie-half', 'pipe-drape', 'qrlabel', 'qrlabel-half', 'speakertas', 'stellingbord', 'stellingbord-a5', 'wandbord-a5-liggend', 'wandbord-a5-staand', 'wandbord-liggend', 'wandbord-staand']);
  assert.equal(S['bordje-staand'].printer, 'a4');
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

test('geen_doorsnede_als_het_geen_kabel_is', () => {
  assert.deepEqual(ontbrekend(S.gitterbox, A.GE9391, {}), []);
  const verloop = { ...A.GE9402, naam: 'Speakon 4p > Speakon 8p Verloop (sub)' };
  assert.deepEqual(ontbrekend(S.gitterbox, verloop, {}), []);
  // ook een eerder opgeslagen doorsnede komt er niet op
  assert.deepEqual(vul(S.gitterbox, A.GE9391, { Doorsnede: '2,5 mm²' }, 'nl8-koppel').label, { tekst: 'NL8', kleur: '#7f7f7f' });
  const haspel = { ...A.GE9402, naam: 'Speakon 4p 50m op haspel' };
  assert.deepEqual(ontbrekend(S.gitterbox, haspel, {}).map(v => v.naam), ['Doorsnede']);
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
  assert.equal(i.groot, '6 × 3m');
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
  assert.equal(i.groot, '4 × 3m');
  assert.deepEqual(i.eigenschappen, [['Inhoud', 'Pipe & drape doek zw satijn geplooid']]);
  assert.equal(i.opmaak, 'liggend');
});

test('algemeen_bordje', () => {
  const i = vul(S['bordje-staand'], A.CO1120, {}, 'kenporto-00');
  assert.equal(i.titel, 'Kenwood TK-3201 Portofoon');
  assert.equal(i.qr, 'kenporto-00');
  assert.equal(i.opmaak, 'staand');
  assert.deepEqual(ontbrekend(S['bordje-staand'], A.CO1120, {}), []);
  const r = vul(S['bordje-staand'], A.CO1120, { Omschrijving: 'Portofoon', Regels: 'Kleur: Zwart\nlader erbij' }, '');
  assert.deepEqual(r.eigenschappen, [['Omschrijving', 'Portofoon'], ['Kleur', 'Zwart'], ['', 'lader erbij']]);
  assert.equal(S['bordje-staand'].velden.find(v => v.naam === 'Regels').meerregelig, true);
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
  assert.equal(standaardSjabloon(A.CO1120, 'bordje'), 'bordje-staand');
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

// ---------- fase 2 ----------
import { geldigeKleur, DSL_REGELS } from '../../v2/js/sjablonen.js';

const vrij = (extra = {}) => ({
  id: 'proef', naam: 'Proef', printer: 'a4', opmaak: 'staand', formaat: { b: 74, h: 105 }, gat: true, voet: true, logoBoven: false, cert: '',
  velden: [
    { naam: 'Breedte', soort: 'getal', herkomst: { type: 'aanvulling' }, verplicht: false },
    { naam: 'Hoogte', soort: 'getal', herkomst: { type: 'aanvulling' }, verplicht: false },
    { naam: 'Regels', soort: 'tekst', herkomst: { type: 'aanvulling' }, verplicht: false },
  ],
  plekken: { titel: ['Proef'], groot: [{ veld: 'Breedte' }, ' × ', { veld: 'Hoogte' }, ' m'], label: [], eigenschappen: [], onder: [] },
  kleuren: { rand: { sleutel: [{ veld: 'Breedte' }, ' × ', { veld: 'Hoogte' }], waarden: { '6×3,5': '#c000c0' } } },
  ...extra,
});

test('kleursleutel_tokens', () => {
  const i = vul(vrij(), A.GE9402, { Breedte: '6', Hoogte: '3,5' }, 'x');
  assert.equal(i.rand, '#c000c0');
  assert.equal(i.groot, '6 × 3,5 m');
});

test('oud_kleurformaat_werkt', () => {
  assert.equal(vul(S.gitterbox, A.GE9402, { Doorsnede: '2,5 mm²' }, 'x').rand, '#ffff00');
});

test('ongeldige_kleur_wordt_grijs', () => {
  const s = vrij({ kleuren: { rand: { sleutel: [{ veld: 'Breedte' }], waarden: { '6': 'red;background:url(x)' } } } });
  assert.equal(vul(s, A.GE9402, { Breedte: '6' }, 'x').rand, '#7f7f7f');
});

test('regelsveld', () => {
  const i = vul(vrij({ regelsVeld: 'Regels' }), A.GE9402, { Regels: 'Breedte: 6 m\nKleur: Zwart\nlos' }, 'x');
  assert.deepEqual(i.eigenschappen, [['Breedte', '6 m'], ['Kleur', 'Zwart'], ['', 'los']]);
});

test('geldige_kleur', () => {
  assert.equal(geldigeKleur('#FFAA00'), '#ffaa00');
  assert.equal(geldigeKleur('red'), null);
  assert.equal(geldigeKleur('"><b>'), null);
  assert.equal(geldigeKleur('#fff'), null);
});

test('regels_instelbaar', () => {
  const regels = { bordje: [{ pad: 'Portofoon', sjabloon: 'qrlabel-half' }, ...DSL_REGELS.bordje], standaard: DSL_REGELS.standaard };
  assert.equal(standaardSjabloon(A.CO1120, 'bordje', regels), 'qrlabel-half');
  assert.equal(standaardSjabloon(A.GE9402, 'bordje', regels), 'gitterbox');
  assert.equal(standaardSjabloon(A.GE9402, 'qrlabel', { ...regels, standaard: { ...regels.standaard, qrlabel: 'qrlabel-half' } }), 'qrlabel-half');
});

test('los_item_eigen_sjabloon', () => {
  const los = { ...A.GE9402, id: 'los-1', sjabloon: 'backdrop' };
  assert.equal(standaardSjabloon(los, 'bordje'), 'backdrop');
  assert.equal(standaardSjabloon(los, 'locatie'), 'locatie');
});

test('aanvulling_overschrijft_kolom_en_naam', () => {
  // Een aanvulling met de naam van een veld gaat voor (ook leeg = weg van het bordje).
  assert.equal(vul(S.locatie, A.GE9412, { Locatie: 'B-3' }, '').titel, 'B-3');
  assert.equal(vul(S.locatie, A.GE9402, {}, '').titel, 'V-1-2');
  assert.equal(vul(S.locatie, A.GE9402, { Locatie: 'B-3' }, '').titel, 'B-3');
  const zonderLengte = vul(S.gitterbox, A.GE9402, { Doorsnede: '2,5 mm²', Lengte: '' }, 'x');
  assert.equal(zonderLengte.groot, '');
  assert.equal(zonderLengte.rand, '#7f7f7f');
  assert.deepEqual(ontbrekend(S.gitterbox, A.GE9402, { Kabel: '' }), []);
  assert.equal(vul(S.gitterbox, A.GE9402, { Omschrijving: 'Verlengkabel NL4' }, 'x').titel, 'Verlengkabel NL4');
});

test('leeg_bordje', () => {
  for (const id of ['leeg-staand', 'leeg-liggend']) {
    const sj = DSL_SJABLONEN.find(s => s.id === id);
    assert.ok(sj, id);
    assert.ok(sj.velden.every(v => v.herkomst.type === 'aanvulling' || v.naam === 'Naam'));
    const los = { id: 'los-1', naam: 'Nooduitgang', code: '', qr: '', exemplaren: [], pad: '', map: 'Losse items', locatie: '', soort: 'bulk', type: 'Los item', combinatie: false, aantal: 0, sjabloon: id };
    const i = vul(sj, los, { Groot: '6 × 3 m', Regels: 'Kleur: Zwart', Onderregel: 'Alleen voor intern gebruik', Randkleur: 'Rood' }, '');
    assert.equal(i.titel, 'Nooduitgang');
    assert.equal(i.groot, '6 × 3 m');
    assert.equal(i.rand, '#ff0000');
    assert.deepEqual(i.eigenschappen, [['Kleur', 'Zwart']]);
    assert.equal(i.onder, 'Alleen voor intern gebruik');
    assert.deepEqual(ontbrekend(sj, los, {}), []);
  }
});

test('randkleur_zelf_kiezen_op_elk_bordje', () => {
  // Gitterbox kleurt op lengte (10 m = rood); een gekozen Randkleur gaat voor.
  assert.equal(vul(S.gitterbox, A.GE9402, { Randkleur: 'Groen' }, 'x').rand, '#00b050');
  assert.equal(vul(S['bordje-staand'], A.GE9402, { Randkleur: 'lichtblauw' }, 'x').rand, '#00b0f0');
  // Leeg of 'Automatisch' = wat het sjabloon zegt; 'Geen' = grijs; onzin = sjabloon.
  assert.equal(vul(S.gitterbox, A.GE9402, { Randkleur: '' }, 'x').rand, vul(S.gitterbox, A.GE9402, {}, 'x').rand);
  assert.equal(vul(S.gitterbox, A.GE9402, { Randkleur: 'Geen' }, 'x').rand, '#7f7f7f');
  assert.equal(vul(S.gitterbox, A.GE9402, { Randkleur: 'red;x' }, 'x').rand, vul(S.gitterbox, A.GE9402, {}, 'x').rand);
});

test('wandbord_a4_locatie_groot', () => {
  const art = { ...A.GE9402, locatie: 'J-2' };
  const i = vul(S['wandbord-liggend'], art, { Inhoud: 'Speakon kabels' }, 'x');
  assert.equal(i.opmaak, 'wand');
  assert.equal(i.titel, 'J-2');
  assert.equal(i.onder, 'Speakon kabels');
  assert.equal(i.qr, 'J-2');                       // QR = de locatie
  assert.deepEqual(S['wandbord-liggend'].formaat, { b: 281, h: 194 });
  assert.deepEqual(S['wandbord-staand'].formaat, { b: 194, h: 281 });
  assert.equal(S['wandbord-staand'].printer, 'a4');
  assert.equal(vul(S['wandbord-staand'], art, { Randkleur: 'Blauw' }, 'x').rand, '#0050ff');
  assert.deepEqual(ontbrekend(S['wandbord-staand'], { ...art, locatie: '' }, {}).map(v => v.naam), []);
});

test('kistbordje_met_inhoudslijst', () => {
  // Zoals het oude bordje, zonder klant/productie/datum/check (daar komt de projectsticker) en zonder locatie.
  assert.deepEqual(S.kist.velden.map(v => v.naam), ['Naam', 'Kistnummer', 'Gewicht', 'Inhoud', 'Extra inhoud']);
  const i = vul(S.kist, A.GE9402, { Gewicht: '66,20', Inhoud: '30 DMX 3p 1,25m grijs\n40× DMX 3p 2,5m\n2 x Afsluiter\nlosse regel\n\n' }, 'dsl01');
  assert.equal(i.opmaak, 'kist');
  assert.deepEqual(S.kist.formaat, { b: 194, h: 136 });
  assert.equal(i.titel, 'Speakon 4p Verlengkabel 2,5m');
  assert.equal(i.qr, 'dsl01');
  assert.equal(i.rand, '#005abb');
  assert.equal(i.waarden.Gewicht, '66,20');
  assert.deepEqual(i.lijst, [['30', 'DMX 3p 1,25m grijs'], ['40', 'DMX 3p 2,5m'], ['2', 'Afsluiter'], ['', 'losse regel']]);
});

test('lengte_en_hoogte_zelf_invullen', () => {
  // Backdrop: breedte en hoogte uit de naam, elk apart aan te passen.
  assert.deepEqual(S.backdrop.velden.filter(v => v.herkomst.type === 'naam').map(v => v.naam), ['Naam', 'Breedte', 'Hoogte', 'Kwaliteit']);
  assert.equal(vul(S.backdrop, A['LI8163-B'], { Kleur: 'Zwart', Hoogte: '4' }, 'x').groot, '6 × 4m');
  // Pipe & Drape: lengte en hoogte.
  assert.deepEqual(S['pipe-drape'].velden.map(v => v.naam), ['Naam', 'Lengte', 'Hoogte']);
  assert.equal(vul(S['pipe-drape'], A.PD5143, { Lengte: '5' }, 'x').groot, '5 × 3m');
});

test('wandbord_a5', () => {
  assert.deepEqual(S['wandbord-a5-liggend'].formaat, { b: 194, h: 136 });
  assert.deepEqual(S['wandbord-a5-staand'].formaat, { b: 136, h: 194 });
  assert.equal(vul(S['wandbord-a5-staand'], { ...A.GE9402, locatie: 'J-2-1' }, {}, 'x').titel, 'J-2-1');
});

test('dsl_blauw_als_kleur', () => {
  assert.equal(KLEURNAMEN['DSL blauw'], '#005abb');
  assert.equal(vul(S.gitterbox, A.GE9402, { Randkleur: 'DSL blauw' }, 'x').rand, '#005abb');
  assert.equal(vul(S['leeg-staand'], A.GE9402, { Randkleur: 'DSL blauw' }, 'x').rand, '#005abb');
  assert.ok(S['leeg-staand'].velden.find(v => v.naam === 'Randkleur').opties.includes('DSL blauw'));
});

test('kistbordje_vult_zich_uit_exemplaar', () => {
  const kist = { ...A.GE9402, naam: 'Martin Audio 2x DD6 Speaker [Case]', code: '*GE2162', exemplaren: ['*GE2162-01', '*GE2162-02'],
    kisten: { '*GE2162-01': { nr: 'DSL01', inhoud: '2 Martin Audio DD6\n1 Flightcase DD6', gewicht: '27,34' } } };
  const i = vul(S.kist, kist, {}, '*GE2162-01');
  assert.equal(i.onder, 'DSL01');
  assert.equal(i.waarden.Gewicht, '27,34');
  assert.deepEqual(i.lijst, [['2', 'Martin Audio DD6'], ['1', 'Flightcase DD6']]);
  // ander exemplaar zonder gegevens: code van het artikel, geen inhoud
  const j = vul(S.kist, kist, {}, '*GE2162-02');
  assert.equal(j.onder, '*GE2162');
  assert.deepEqual(j.lijst, []);
  // zelf ingevuld gaat voor
  assert.deepEqual(vul(S.kist, kist, { Inhoud: '1 Iets anders' }, '*GE2162-01').lijst, [['1', 'Iets anders']]);
});

test('kistbordje_modern_ook_te_kiezen', () => {
  assert.equal(S['kist-modern'].opmaak, 'kist-modern');
  assert.deepEqual(S['kist-modern'].formaat, { b: 194, h: 136 });
  assert.deepEqual(S['kist-modern'].velden.map(v => v.naam), S.kist.velden.map(v => v.naam));
  // zwart-wit (Robin, 24 nov), ook als er een andere randkleur is ingevuld; net als de B&W-bordjes
  for (const id of ['kist-modern', 'kist-bw1000', 'kist-bw6040']) {
    assert.equal(vul(S[id], A.GE9402, {}, 'x').rand, '#000000', id);
    assert.equal(vul(S[id], A.GE9402, { Randkleur: 'Rood' }, 'x').rand, '#000000', id);
  }
});

test('kist_met_eigen_artikel_qr_neemt_eerste_kist', () => {
  // Combinaties hebben in Rentman ook een eigen QR (niet die van een exemplaar): dan de eerste kist.
  const kist = { ...A.GE9402, naam: '4 x Shure PSM900 [Case]', code: '*GE5000', qr: '1013369', exemplaren: ['1013368'],
    kisten: { 1013368: { nr: 'DSL01', inhoud: '4 Shure P9T', gewicht: '12,89' } } };
  const i = vul(S.kist, kist, {}, '1013369');
  assert.deepEqual(i.lijst, [['4', 'Shure P9T']]);
  assert.equal(i.onder, 'DSL01');
  assert.equal(i.waarden.Gewicht, '12,89');
});

test('automatisch_materiaalbordje_voor_kist_met_inhoud', () => {
  const kist = { ...A.GE9402, pad: 'Materialen / Geluid / Microfoons', naam: '4 x Shure PSM900 [Case]', kisten: { x: { nr: 'DSL01', inhoud: '4 P9T', gewicht: '' } } };
  assert.equal(standaardSjabloon(kist, 'bordje'), 'kist');
  // zonder bekende inhoud: gewoon bordje
  assert.equal(standaardSjabloon({ ...kist, kisten: { x: { nr: 'DSL01', inhoud: '', gewicht: '33' } } }, 'bordje'), 'bordje-staand');
  // een regel op categorie gaat voor
  assert.equal(standaardSjabloon({ ...A.GE9402, kisten: kist.kisten }, 'bordje'), 'gitterbox');
});

test('extra_inhoud_per_kisttype_komt_erbij', () => {
  const kist = { ...A.GE9402, naam: 'Martin Audio 2x DD6 [Case]', code: '*GE2162', qr: '1016954', exemplaren: ['*GE2162-01', '*GE2162-02'],
    kisten: { '*GE2162-01': { nr: 'DSL01', inhoud: '2 Martin Audio DD6', gewicht: '27,34' }, '*GE2162-02': { nr: 'DSL02', inhoud: '2 Martin Audio DD6', gewicht: '' } } };
  const extra = { 'Extra inhoud': '2 Speakon kabel 10m\n1 Regenhoes' };
  assert.ok(S.kist.velden.find(v => v.naam === 'Extra inhoud').onthouden);
  for (const qr of ['*GE2162-01', '*GE2162-02']) {
    assert.deepEqual(vul(S.kist, kist, extra, qr).lijst, [['2', 'Martin Audio DD6'], ['2', 'Speakon kabel 10m'], ['1', 'Regenhoes']]);
  }
  assert.deepEqual(vul(S['kist-modern'], kist, extra, '*GE2162-01').lijst.length, 3);
});

test('stellingbord_als_sjabloon_met_kleur_per_zone', () => {
  const sj = S.stellingbord;
  assert.equal(sj.opmaak, 'wand');
  assert.deepEqual(sj.formaat, { b: 194, h: 281 });
  assert.deepEqual(sj.velden.map(v => v.naam), ['Locatie', 'Inhoud', 'QR-code']);
  const leeg = { ...A.GE9402, naam: '', code: '', locatie: '' };
  const i = vul(sj, leeg, { Code: 'G3', Wat: 'Torens, takels' }, '');
  assert.equal(i.titel, 'G3');
  assert.equal(i.onder, 'Torens, takels');
  assert.equal(vul(sj, leeg, { Code: 'G3', 'QR-code': 'ja' }, '').qr, 'G3');
  assert.equal(i.rand, '#ff0000');                                       // zone G = rood
  assert.equal(vul(sj, leeg, { Code: 'A4-2-1' }, '').rand, '#005abb');   // begint met A
  assert.equal(vul(sj, leeg, { Code: 'Q1' }, '').rand, '#005abb');       // onbekende zone: DSL blauw
  assert.equal(vul(sj, leeg, { Code: 'G3', Randkleur: 'Groen' }, '').rand, '#00b050'); // zelf gekozen gaat voor
});

test('bakbord_16_cm_breed', () => {
  // Bakbord: naam linksboven, artikelnummer eronder, QR van het artikel (QR-veld), die één keer klein onder de QR.
  const sj = S.bakbord;
  assert.deepEqual(sj.formaat, { b: 160, h: 48 });
  assert.equal(sj.printer, 'a4');
  assert.equal(sj.voet, false);
  assert.deepEqual(sj.velden.map(v => v.naam), ['Naam', 'Artikelnummer']);
  assert.ok(!sj.plekken.qr?.length);     // QR uit het QR-veld (artikel), niet uit een veld
  const i = vul(sj, A.GE9402, {}, 'GE9402-QR');
  assert.equal(i.titel, 'Speakon 4p Verlengkabel 2,5m');
  assert.equal(i.onder, 'GE9402');
  assert.equal(i.qr, 'GE9402-QR');
  assert.equal(i.rand, '#005abb');                                              // standaard DSL blauw
  assert.equal(vul(sj, A.GE9402, { Randkleur: 'Rood' }, 'x').rand, '#ff0000'); // zelf te kiezen
});

test('wandborden_standaard_dsl_blauw', () => {
  for (const id of ['wandbord-staand', 'wandbord-liggend', 'wandbord-a5-staand', 'wandbord-a5-liggend']) {
    const art = { ...A.GE9402, locatie: 'A1' };
    assert.equal(vul(S[id], art, {}, 'x').rand, '#005abb', id);
    assert.equal(vul(S[id], art, { Randkleur: 'Geel' }, 'x').rand, '#ffff00', id);   // zelf te kiezen
  }
});

test('wandborden_met_of_zonder_qr', () => {
  for (const id of ['wandbord-staand', 'wandbord-liggend', 'wandbord-a5-staand', 'wandbord-a5-liggend']) {
    const sj = S[id];
    const veld = sj.velden.find(v => v.naam === 'QR-code');
    assert.ok(veld, id);
    assert.deepEqual(veld.keuzes.map(k => k.tekst), ['Met QR-code', 'Zonder QR-code']);
    const art = { ...A.GE9402, locatie: 'A1' };
    const aanv = { Code: 'A1' };
    assert.equal(vul(sj, art, aanv, 'x').qr, 'A1', id);
    assert.equal(vul(sj, art, { ...aanv, 'QR-code': 'nee' }, 'x').qr, '', id);
  }
});

test('stellingbord_standaard_zonder_qr', () => {
  // In Rentman heb je weinig aan de QR van een stellingbord: standaard zonder, aan te zetten.
  const sj = S.stellingbord;
  const veld = sj.velden.find(v => v.naam === 'QR-code');
  assert.deepEqual(veld.keuzes.map(k => k.tekst), ['Zonder QR-code', 'Met QR-code']);
  assert.equal(vul(sj, A.GE9402, { Code: 'A1' }, 'x').qr, '');
  assert.equal(vul(sj, A.GE9402, { Code: 'A1', 'QR-code': 'ja' }, 'x').qr, 'A1');
});

test('stellingbord_a5', () => {
  const sj = S['stellingbord-a5'];
  assert.deepEqual(sj.formaat, { b: 136, h: 194 });
  assert.equal(sj.opmaak, 'wand');
  assert.deepEqual(sj.velden.map(v => v.naam), ['Locatie', 'Inhoud', 'QR-code']);
  assert.equal(vul(sj, A.GE9402, { Code: 'A1' }, 'x').qr, '');       // ook standaard zonder QR
  assert.equal(S.stellingbord.naam, 'Stellingbord A4');
  assert.equal(sj.naam, 'Stellingbord A5');
});

test('sjablonen_in_groepen', () => {
  assert.deepEqual(GROEPEN.map(g => g.sleutel), ['bordjes', 'magazijn', 'kisten', 'labels']);
  const g = (id) => groepVan(S[id]).sleutel;
  assert.equal(g('bordje-staand'), 'bordjes');
  assert.equal(g('backdrop'), 'bordjes');
  assert.equal(g('stellingbord-a5'), 'magazijn');
  assert.equal(g('bakbord'), 'magazijn');
  assert.equal(g('wandbord-a5-liggend'), 'magazijn');
  assert.equal(g('kist-modern'), 'kisten');
  assert.equal(g('gitterbox'), 'magazijn');      // strook hoort bij het magazijn, naast het bakbord
  assert.equal(g('qrlabel'), 'labels');
});

test('sjablonen_in_subgroepen', () => {
  // Binnen een groep kleine rijtjes met een titel, naast elkaar (Robin, 23 nov): B&W cases los naast de kisten.
  const sub = (id) => subgroepVan(S[id]).titel;
  const per = {};
  for (const sj of DSL_SJABLONEN) (per[groepVan(sj).sleutel + ' / ' + sub(sj.id)] ??= []).push(sj.id);
  assert.deepEqual(per, {
    'labels / QR-labels': ['qrlabel', 'qrlabel-half'],
    'labels / Locatielabels': ['locatie', 'locatie-half'],
    'bordjes / Doeken': ['backdrop', 'pipe-drape'],
    'kisten / Materiaalbordjes': ['speakertas', 'kist', 'kist-modern'],
    'bordjes / Algemeen': ['leeg-staand', 'leeg-liggend', 'bordje-staand', 'bordje-liggend'],
    'magazijn / Stellingen': ['stellingbord', 'stellingbord-a5'],
    'magazijn / Bakken & gitterboxen': ['bakbord', 'gitterbox'],
    'magazijn / Wanden': ['wandbord-staand', 'wandbord-liggend', 'wandbord-a5-staand', 'wandbord-a5-liggend'],
    'kisten / B&W cases': ['kist-bw1000', 'kist-bw6040'],
  });
  // elke subgroep hoort bij zijn eigen groep, en een eigen sjabloon valt ook ergens in
  for (const sj of DSL_SJABLONEN) assert.equal(subgroepVan(sj).groep, groepVan(sj).sleutel);
  assert.equal(subgroepVan({ id: 'x', naam: 'Eigen case', opmaak: 'kist-modern', formaat: { b: 120, h: 80, r: 5 } }).titel, 'B&W cases');
  // volgorde in het venster: de groepen in GROEPEN-volgorde, binnen een groep de subgroepen in SUBGROEPEN-volgorde
  assert.deepEqual(SUBGROEPEN.map(s => s.groep), ['bordjes', 'bordjes', 'magazijn', 'magazijn', 'magazijn', 'kisten', 'kisten', 'labels', 'labels']);
});

test('kist_bw1000', () => {
  // B&W outdoor.case type 1000: uitsparing in het deksel 160 × 97 mm met ronde hoeken (Robin, 16 nov).
  const sj = S['kist-bw1000'];
  assert.equal(sj.opmaak, 'kist-modern');
  assert.equal(sj.naam, 'Materiaalbordje B&W type 1000');
  const { b, h, r } = sj.formaat;
  const kantje = 3;                                   // lamineerrand rondom
  assert.ok(b + 2 * kantje <= 158 && h + 2 * kantje <= 95, 'gelamineerd past met speling in 160 × 97');
  assert.ok(r > 0);
  assert.equal(groepVan(sj).sleutel, 'kisten');
  assert.deepEqual(sj.velden.map(v => v.naam), S['kist-modern'].velden.map(v => v.naam));
  assert.equal(vul(sj, A.GE9402, {}, 'x').formaat.r, r);
});

test('speakertas_kaartje', () => {
  // Kaartje aan een speakertas: liggend 105 × 74 in de stijl van het moderne materiaalbordje (B&W type 1000),
  // met inhoud, gewicht en QR van het exemplaar, gat om op te hangen, zonder projectsticker (Robin, 16 nov).
  const sj = S.speakertas;
  assert.equal(sj.opmaak, 'kist-modern');
  assert.deepEqual(sj.formaat, S['pipe-drape'].formaat);
  assert.equal(sj.gat, true);
  assert.equal(sj.sticker, false);
  assert.deepEqual(sj.velden.map(v => v.naam), S['kist-modern'].velden.map(v => v.naam));
  const tas = { ...A.GE9402, naam: 'Speakertas E8', kisten: { 'tas-02': { nr: 'DSL02', gewicht: '7,5', inhoud: '1 d&b E8\n1 regenhoes' } } };
  const i = vul(sj, tas, {}, 'tas-02');
  assert.equal(i.titel, 'Speakertas E8');
  assert.equal(i.qr, 'tas-02');
  assert.equal(i.sticker, false);
  assert.equal(i.waarden.Gewicht, '7,5');
  assert.deepEqual(i.lijst, [['1', 'd&b E8'], ['1', 'regenhoes']]);
  assert.equal(vul(S['kist-modern'], tas, {}, 'tas-02').sticker, true);
});

test('kist_bw6040', () => {
  // B&W outdoor.case type 6040: uitsparing in het deksel max. 255 × 127 mm (Robin, 23 nov).
  const sj = S['kist-bw6040'];
  assert.equal(sj.opmaak, 'kist-modern');
  assert.equal(sj.naam, 'Materiaalbordje B&W type 6040');
  const { b, h, r } = sj.formaat;
  assert.ok(b + 2 * 3 <= 253 && h + 2 * 3 <= 125, 'gelamineerd past met speling in 255 × 127');
  assert.ok(r > 0);
  assert.ok(b <= 194 || h <= 194, 'past (gedraaid) op A4');
  assert.equal(groepVan(sj).sleutel, 'kisten');
  assert.deepEqual(sj.velden.map(v => v.naam), S['kist-modern'].velden.map(v => v.naam));
});

test('velden_overal_hetzelfde', async () => {
  // Continuïteit (Robin, 23 nov): hetzelfde gegeven heet in elk sjabloon hetzelfde.
  const { PROFIEL_STANDAARD } = await import('../../v2/js/standaard.js');
  const BASIS_SJABLONEN = [...PROFIEL_STANDAARD.basis.sjablonen, ...PROFIEL_STANDAARD.dsl.sjablonen];
  const NAAM = {
    'kolom:naam': 'Naam', 'naam:kaal': 'Naam', 'kolom:code': 'Artikelnummer', 'kolom:locatie': 'Locatie',
    'exemplaar:nr': 'Kistnummer', 'exemplaar:gewicht': 'Gewicht', 'exemplaar:inhoud': 'Inhoud',
  };
  const fout = [];
  for (const sj of [...DSL_SJABLONEN, ...BASIS_SJABLONEN]) {
    for (const veld of sj.velden) {
      const h = veld.herkomst;
      const soort = h.type + ':' + (h.sleutel || h.kolom || h.patroon || '');
      if (NAAM[soort] && veld.naam !== NAAM[soort]) fout.push(`${sj.id}: ${veld.naam} → ${NAAM[soort]}`);
      if (['Code', 'Wat', 'Omschrijving'].includes(veld.naam) && sj.plekken.titel.some(t => t.veld === veld.naam)) fout.push(`${sj.id}: titel uit ${veld.naam}`);
      if (/^(Breedte|Hoogte|Lengte)$/.test(veld.naam) && veld.eenheid !== 'm') fout.push(`${sj.id}: ${veld.naam} zonder eenheid m`);
    }
    // eigen locatiecode (stellingbord) heet ook Locatie, de omschrijving erbij Inhoud, net als op het wandbord
    if (sj.opmaak === 'wand' && !sj.velden.some(v => v.naam === 'Naam')) {
      if (!sj.velden.some(v => v.naam === 'Locatie')) fout.push(`${sj.id}: wandbord zonder Locatie`);
      for (const n of ['Code', 'Wat']) if (sj.velden.some(v => v.naam === n)) fout.push(`${sj.id}: ${n}`);
    }
  }
  assert.deepEqual(fout, []);
});

test('oude_veldnamen_blijven_werken', () => {
  // Al ingevulde aanvullingen onder de oude naam (Code, Wat, Omschrijving) gaan niet verloren.
  const sb = vul(S.stellingbord, { id: 'los', naam: '', code: '' }, { Code: 'B2', Wat: 'Kabels' }, '');
  assert.equal(sb.titel, 'B2');
  assert.equal(sb.onder, 'Kabels');
  assert.equal(vul(S['bordje-staand'], A.GE9402, { Code: 'X1' }, '').onder, 'Artikelnummer X1');
  assert.equal(vul(S.kist, A.GE9402, { Code: 'DSL09' }, '').waarden.Kistnummer, 'DSL09');
  assert.equal(vul(S.gitterbox, A.GE9402, { Omschrijving: 'Stroomkabel' }, '').titel, 'Stroomkabel');
  // de nieuwe naam gaat voor
  assert.equal(vul(S.stellingbord, { id: 'los', naam: '', code: '' }, { Code: 'B2', Locatie: 'C3' }, '').titel, 'C3');
});

test('bewust_zonder_qr', async () => {
  // 'Zonder QR-code' aangevinkt: geen QR en ook geen rode 'Geen QR-code'-melding; ontbrekende QR blijft gemeld.
  const { GEEN_QR } = await import('../../v2/js/sjablonen.js');
  const i = vul(S['bordje-staand'], A.GE9402, {}, GEEN_QR);
  assert.equal(i.qr, '');
  assert.equal(i.geenQr, true);
  assert.equal(vul(S['bordje-staand'], A.GE9402, {}, '').geenQr, false);
  assert.equal(vul(S.stellingbord, { id: 'l', naam: '', code: '' }, { Locatie: 'A1' }, '').geenQr, true);   // standaard zonder
});

test('inhoud_met_kopjes_en_notities', () => {
  // Inhoud van inhoud (Robin, 26 nov): kopje = regel zonder aantal in HOOFDLETTERS of eindigend op ':';
  // notitie onder het vorige artikel = regel die begint met ↳, > of -.
  const tekst = 'RQ RACK STAGE\n1x Optocore Festival Box Grand\n2 Sonible ML:mio\n\nKABELBAK (AW RQ 4HE)\n2 Fiberfox dualcore kabel 30m\n2 Verloop 230V schuko > Powercon\n↳ hoort bij rack\nKabels:\n> los erbij\nregenhoes';
  const i = vul(S.kist, A.GE9402, { Inhoud: tekst }, '');
  assert.deepEqual(i.lijst, [
    ['', 'RQ RACK STAGE', 'kop'],
    ['1', 'Optocore Festival Box Grand'],
    ['2', 'Sonible ML:mio'],
    ['', 'KABELBAK (AW RQ 4HE)', 'kop'],
    ['2', 'Fiberfox dualcore kabel 30m'],
    ['2', 'Verloop 230V schuko > Powercon'],
    ['', 'hoort bij rack', 'noot'],
    ['', 'Kabels', 'kop'],
    ['', 'los erbij', 'noot'],
    ['', 'regenhoes'],
  ]);
  // gewone lijst blijft precies zoals hij was
  assert.deepEqual(vul(S.kist, A.GE9402, { Inhoud: '30 DMX 3p 1,25m\nDMX' }, '').lijst, [['30', 'DMX 3p 1,25m'], ['', 'DMX', 'kop']]);
});

test('cijfer_aan_begin_is_niet_altijd_een_aantal', () => {
  // Robin, 26 nov: een naam die met een cijfer begint sprong altijd naar de aantal-kolom.
  // Aantal alleen als er na het getal een spatie of x/× komt; met ' vooraan nooit een aantal (zoals in Excel).
  const l = (t) => vul(S.kist, A.GE9402, { Inhoud: t }, '').lijst;
  assert.deepEqual(l('230V verloop schuko'), [['', '230V verloop schuko']]);
  assert.deepEqual(l('4HE kabelbak'), [['', '4HE kabelbak']]);
  assert.deepEqual(l('1,25m DMX kabel'), [['', '1,25m DMX kabel']]);
  assert.deepEqual(l('2x4 m truss'), [['', '2x4 m truss']]);
  assert.deepEqual(l("'19 inch rack"), [['', '19 inch rack']]);
  // aantallen blijven werken
  assert.deepEqual(l('2 kabel\n3x kabel\n4 x kabel\n5× kabel\n6×kabel\n1,5 m'), [['2', 'kabel'], ['3', 'kabel'], ['4', 'kabel'], ['5', 'kabel'], ['6', 'kabel'], ['1,5', 'm']]);
  // een regel met cijfers in hoofdletters is geen kopje
  assert.deepEqual(l('230V'), [['', '230V']]);
});
