import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GeheugenOpslag } from '../../v2/js/opslag.js';

test('geheugen_crud', async () => {
  const o = new GeheugenOpslag();
  assert.equal(await o.lees('artikelen', 'GE9402'), undefined);
  await o.schrijf('artikelen', 'GE9402', { naam: 'Speakon' });
  await o.schrijf('artikelen', 'CO1120', { naam: 'Portofoon' });
  assert.deepEqual(await o.lees('artikelen', 'GE9402'), { naam: 'Speakon' });
  assert.deepEqual((await o.alle('artikelen')).map(x => x.id), ['CO1120', 'GE9402']);
  await o.wis('artikelen', 'CO1120');
  assert.deepEqual((await o.alle('artikelen')).map(x => x.id), ['GE9402']);
  await o.wis('artikelen');
  assert.deepEqual(await o.alle('artikelen'), []);
});

test('geheugen_bewaart_kopie', async () => {
  const o = new GeheugenOpslag();
  const w = { lijst: [1] };
  await o.schrijf('printvel', 'a4', w);
  w.lijst.push(2);
  assert.deepEqual(await o.lees('printvel', 'a4'), { lijst: [1] });
});

test('geheugen_schrijfveel_en_soorten_los', async () => {
  const o = new GeheugenOpslag();
  await o.schrijfVeel('artikelen', [{ id: 'b', waarde: 2 }, { id: 'a', waarde: 1 }]);
  await o.schrijf('aanvullingen', 'a', { Doorsnede: '4 mm²' });
  assert.deepEqual(await o.alle('artikelen'), [{ id: 'a', waarde: 1 }, { id: 'b', waarde: 2 }]);
  assert.deepEqual(await o.lees('aanvullingen', 'a'), { Doorsnede: '4 mm²' });
  await assert.rejects(() => o.schrijf('prijzen', 'x', 1), Error);
});
