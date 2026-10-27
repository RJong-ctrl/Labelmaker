import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROFIEL_STANDAARD } from '../../v2/js/standaard.js';
import { vul, ontbrekend } from '../../v2/js/sjablonen.js';

const artikel = { id: 'X1', naam: 'Testkist 2,5m', code: 'X1', qr: 'q1', exemplaren: [], pad: '', map: '', locatie: 'A1', soort: 'bulk', type: '', combinatie: false, aantal: 1 };

test('standaard_profielen', () => {
  const { dsl, basis } = PROFIEL_STANDAARD;
  assert.equal(dsl.sjablonen.length, 16);
  assert.deepEqual(basis.sjablonen.map(s => s.id), ['qrlabel', 'locatie', 'leeg-staand', 'leeg-liggend', 'bordje-staand', 'bordje-liggend', 'strook', 'wandbord-staand', 'wandbord-liggend', 'wandbord-a5-staand', 'wandbord-a5-liggend', 'kist']);
  for (const p of [dsl, basis]) {
    for (const s of p.sjablonen) {
      const i = vul(s, artikel, {}, 'q1');
      assert.ok(i.formaat.b > 0 && i.formaat.h > 0, s.id);
    }
    assert.deepEqual(Object.keys(p.printers).sort(), ['a4', 'label']);
    assert.ok(p.regels.standaard.qrlabel && p.regels.standaard.locatie && p.regels.standaard.bordje);
  }
  assert.deepEqual(dsl.printers.label, { naam: 'Citizen CL-E321', b: 76, h: 56 });
  assert.equal(dsl.kolommen.naam, 'Naam (in database)');
  assert.equal(basis.huisstijl.logo, null);
  assert.deepEqual(basis.huisstijl.voet, []);
  assert.equal(dsl.huisstijl.voet.length, 2);
  assert.equal(vul(basis.sjablonen[4], artikel, { Groot: '20 m' }, 'q1').titel, 'Testkist 2,5m');
  assert.deepEqual(ontbrekend(basis.sjablonen[4], artikel, {}), []);
});
