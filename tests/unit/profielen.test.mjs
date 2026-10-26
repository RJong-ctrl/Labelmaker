import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { profielen, huidigProfiel, kiesProfiel, maakProfiel, hernoemProfiel, verwijderProfiel, exporteerProfiel, importeerProfiel, _wisVoorTest } from '../../v2/js/profielen.js';
import { GeheugenOpslag } from '../../v2/js/opslag.js';

beforeEach(() => _wisVoorTest());

test('altijd_dsl', () => {
  assert.deepEqual(profielen(), [{ id: 'dsl', naam: 'DSL', standaard: 'dsl' }]);
  assert.equal(huidigProfiel(), 'dsl');
});

test('profiel_maken_en_slug', async () => {
  assert.equal(await maakProfiel('Thuis werk'), 'thuis-werk');
  assert.equal(await maakProfiel('Thuis werk'), 'thuis-werk-2');
  assert.equal(await maakProfiel('DSL kopie', 'dsl'), 'dsl-kopie');
  assert.deepEqual(profielen().map(p => [p.id, p.standaard]), [['dsl', 'dsl'], ['thuis-werk', 'basis'], ['thuis-werk-2', 'basis'], ['dsl-kopie', 'dsl']]);
  kiesProfiel('thuis-werk');
  assert.equal(huidigProfiel(), 'thuis-werk');
  hernoemProfiel('thuis-werk', 'Thuis');
  assert.equal(profielen().find(p => p.id === 'thuis-werk').naam, 'Thuis');
  await verwijderProfiel('thuis-werk');
  assert.equal(huidigProfiel(), 'dsl');
  await assert.rejects(() => verwijderProfiel('dsl'), Error);
});

test('profiel_export_zonder_pincode', async () => {
  const o = new GeheugenOpslag();
  await o.schrijf('instellingen', 'pc:pincode', '1234');
  await o.schrijf('instellingen', 'pc:eigenLettertype', 'XXX');
  await o.schrijf('instellingen', 'huisstijl', { voet: ['a'] });
  await o.schrijf('artikelen', 'A1', { naam: 'Kabel' });
  const j = await exporteerProfiel(o, 'dsl');
  assert.equal(j.type, 'labelmaker-profiel');
  assert.deepEqual(j.profiel, { id: 'dsl', naam: 'DSL', standaard: 'dsl' });
  const tekst = JSON.stringify(j);
  assert.ok(!tekst.includes('1234') && !tekst.includes('XXX'));
  assert.deepEqual(j.gegevens.artikelen, [{ id: 'A1', waarde: { naam: 'Kabel' } }]);
});

test('profiel_import', async () => {
  const bron = new GeheugenOpslag();
  await bron.schrijf('sjablonen', 'kist', { id: 'kist', naam: 'Kist' });
  const j = await exporteerProfiel(bron, 'dsl');
  const doelen = new Map();
  const open = async (id) => { if (!doelen.has(id)) doelen.set(id, new GeheugenOpslag()); return doelen.get(id); };
  const id = await importeerProfiel(j, open);
  assert.equal(id, 'dsl-2');
  assert.equal(profielen().find(p => p.id === id).naam, 'DSL (2)');
  assert.deepEqual(await (await open(id)).lees('sjablonen', 'kist'), { id: 'kist', naam: 'Kist' });
});

test('profiel_import_rommel', async () => {
  await assert.rejects(() => importeerProfiel({ type: 'iets' }, async () => new GeheugenOpslag()), /Dit is geen profielbestand van de Labelmaker\./);
  await assert.rejects(() => importeerProfiel(null, async () => new GeheugenOpslag()), /Dit is geen profielbestand van de Labelmaker\./);
});
