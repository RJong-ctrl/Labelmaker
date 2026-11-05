import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leesReeks, zoneKleur, ZONEKLEUREN } from '../../v2/js/reeks.js';

test('reeks_uit_excel_geplakt', () => {
  const tekst = 'Code\tWat\tWaar\nA1\tVersterkers, rackcases\tLinker pand, vooraan\n\nG3\tTorens, takels\tRechter pand\nV1\tVerkoop: confetti, batterijen, tape\tVerkoophok (notatie V1-1-3 blijft)\n';
  assert.deepEqual(leesReeks(tekst), [
    { code: 'A1', wat: 'Versterkers, rackcases', waar: 'Linker pand, vooraan' },
    { code: 'G3', wat: 'Torens, takels', waar: 'Rechter pand' },
    { code: 'V1', wat: 'Verkoop: confetti, batterijen, tape', waar: 'Verkoophok (notatie V1-1-3 blijft)' },
  ]);
});

test('reeks_met_puntkomma_of_alleen_codes', () => {
  assert.deepEqual(leesReeks('A1;Subs\nA2'), [{ code: 'A1', wat: 'Subs', waar: '' }, { code: 'A2', wat: '', waar: '' }]);
  // dubbele codes één keer
  assert.equal(leesReeks('A1\tx\nA1\ty').length, 1);
});

test('kleur_per_zone', () => {
  assert.equal(zoneKleur('A4-2-1'), 'DSL blauw');
  assert.equal(zoneKleur('b'), ZONEKLEUREN.B);
  assert.equal(zoneKleur('Z2'), 'Geen');
  assert.equal(zoneKleur('Q9'), '');            // onbekende zone: automatisch
});
