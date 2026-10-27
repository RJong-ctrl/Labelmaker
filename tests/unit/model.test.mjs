import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GeheugenOpslag } from '../../v2/js/opslag.js';
import { laadModel } from '../../v2/js/model.js';

const art = (code) => ({ id: code, naam: code, code, qr: '', exemplaren: [], pad: '', map: '', locatie: '', soort: 'bulk', type: '', combinatie: false, aantal: 0 });
const basis = (datum, extra = {}) => ({ type: 'labelmaker-basis', versie: 1, profiel: 'dsl', datum, artikelen: [art('B1')], losseItems: [], sjablonen: [], aanvullingen: {}, ...extra });

test('model_bewaart_en_laadt', async () => {
  const o = new GeheugenOpslag();
  const m = await laadModel(o, 'dsl');
  await m.zetArtikelen([art('A1'), art('A2')]);
  await m.zetAanvulling('A1', { Doorsnede: '4 mm²' });
  await m.zetInstelling('printers', { label: { naam: 'X', b: 100, h: 50 }, a4: { naam: 'Y' } });
  await m.zetLosItem({ ...art('los-1'), sjabloon: 'qrlabel' });
  await m.zetPcInstelling('pincode', '1234');
  const m2 = await laadModel(o, 'dsl');
  assert.deepEqual(m2.effectief(), m.effectief());
  assert.equal(m2.effectief().artikelen.length, 2);
  assert.deepEqual(m2.effectief().aanvullingen.A1, { Doorsnede: '4 mm²' });
  assert.equal(m2.effectief().printers.label.b, 100);
  assert.equal(await m2.pcInstelling('pincode'), '1234');
  assert.equal(m2.effectief().pincode, undefined);
});

test('zetAanvulling_voegt_samen', async () => {
  const m = await laadModel(new GeheugenOpslag(), 'dsl');
  await m.zetAanvulling('A1', { Doorsnede: '4 mm²' });
  await m.zetAanvulling('A1', { Kleur: 'Zwart' });
  assert.deepEqual(m.effectief().aanvullingen.A1, { Doorsnede: '4 mm²', Kleur: 'Zwart' });
});

test('laadBasis_alleen_nieuwer', async () => {
  const m = await laadModel(new GeheugenOpslag(), 'dsl');
  assert.equal(await m.laadBasis(basis('2026-10-26T10:00:00.000Z')), true);
  assert.equal(await m.laadBasis(basis('2026-10-26T10:00:00.000Z')), false);
  assert.equal(await m.laadBasis(basis('2026-10-25T10:00:00.000Z')), false);
  assert.equal(await m.laadBasis(basis('2026-10-27T10:00:00.000Z')), true);
  assert.equal(m.effectief().basisDatum, '2026-10-27T10:00:00.000Z');
});

test('gooiWeg_herstelt_basis', async () => {
  const m = await laadModel(new GeheugenOpslag(), 'dsl');
  await m.laadBasis(basis('2026-10-26T10:00:00.000Z', { aanvullingen: { GE9402: { Doorsnede: '2,5 mm²' } } }));
  await m.zetAanvulling('GE9402', { Doorsnede: '4 mm²' });
  const s = m.effectief().sjablonen.find(x => x.id === 'gitterbox');
  await m.zetSjabloon({ ...s, naam: 'Anders' });
  await m.verwijderSjabloon('pipe-drape');
  assert.equal(m.wijzigingen().length, 3);
  for (const w of m.wijzigingen()) await m.gooiWeg(w);
  assert.deepEqual(m.wijzigingen(), []);
  assert.equal(m.effectief().aanvullingen.GE9402.Doorsnede, '2,5 mm²');
  assert.equal(m.effectief().sjablonen.find(x => x.id === 'gitterbox').naam, 'Gitterbox-strook');
  assert.ok(m.effectief().sjablonen.some(x => x.id === 'pipe-drape'));
});

test('printvel_en_printlog_via_model', async () => {
  const m = await laadModel(new GeheugenOpslag(), 'dsl');
  assert.deepEqual(await m.printvel('a4'), []);
  await m.zetPrintvel('a4', [{ sjabloon: 'gitterbox', artikel: 'A1', qr: '', aantal: 2 }]);
  assert.equal((await m.printvel('a4'))[0].aantal, 2);
  const nu = Date.now();
  await m.logPrints([{ sjabloon: 'qrlabel', artikel: 'A1', qr: '', aantal: 1, tijd: nu - 40 * 864e5 }, { sjabloon: 'qrlabel', artikel: 'A2', qr: '', aantal: 1, tijd: nu }]);
  assert.deepEqual((await m.printlog(nu - 30 * 864e5)).map(r => r.artikel), ['A2']);
});

test('ander_profiel_andere_standaard', async () => {
  const m = await laadModel(new GeheugenOpslag(), 'thuis', 'basis');
  assert.deepEqual(m.effectief().sjablonen.map(s => s.id), ['qrlabel', 'locatie', 'leeg-staand', 'leeg-liggend', 'bordje-staand', 'bordje-liggend', 'strook', 'wandbord-staand', 'wandbord-liggend', 'kist']);
});

test('los_item_weg_ook_aanvulling_weg', async () => {
  const o = new GeheugenOpslag();
  const m = await laadModel(o, 'dsl');
  await m.zetLosItem({ ...art('los-1'), sjabloon: 'leeg-staand' });
  await m.zetAanvulling('los-1', { Groot: 'x' });
  await m.verwijderLosItem('los-1');
  assert.equal(await o.lees('aanvullingen', 'los-1'), undefined);
  assert.equal(await o.lees('losse', 'los-1'), undefined);
  assert.deepEqual(m.wijzigingen(), []);
});
