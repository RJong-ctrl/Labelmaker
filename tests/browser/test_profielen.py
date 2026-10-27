import json
import os
import unittest

from playwright.sync_api import expect

from basis import FIXTURES, PaginaTest

VOORBEELD = os.path.join(FIXTURES, 'voorbeeld.xlsx')


class Profielen(PaginaTest):
    def test_nieuw_profiel_is_leeg_en_los(self):
        p = self.pagina
        p.locator('#bestand').set_input_files(VOORBEELD)
        expect(p.locator('#melding')).to_contain_text('9 artikelen ingelezen')
        expect(p.locator('#profiel')).to_have_value('dsl')
        p.locator('#profiel').select_option('__nieuw')
        d = p.locator('#aanvulling')
        d.locator('input[name="naam"]').fill('Thuis')
        d.get_by_role('button', name='Aanmaken').click()
        expect(p.locator('#profiel')).to_have_value('thuis')
        expect(p.locator('#lijst li')).to_have_count(0)
        p.locator('#tabLijst').click()
        expect(p.locator('#leegArtikelen')).to_be_visible()
        opties = p.locator('#sjabloonKeuze option:not([value=""])').all_inner_texts()
        self.assertEqual(opties, ['QR-label', 'Locatielabel', 'Leeg bordje staand', 'Leeg bordje liggend', 'Bordje staand', 'Bordje liggend', 'Strook', 'Wandbord A4 staand', 'Wandbord A4 liggend', 'Wandbord A5 staand', 'Wandbord A5 liggend', 'Materiaalbordje kist (A5)'])
        p.locator('#profiel').select_option('dsl')
        expect(p.locator('#profiel')).to_have_value('dsl')
        expect(p.locator('#lijst li')).to_have_count(8)
        self.assertEqual(self.fouten, [])


class Basis(PaginaTest):
    def test_basis_wordt_geladen(self):
        p = self.pagina
        artikel = {'id': 'GE9402', 'naam': 'Speakon 4p Verlengkabel 2,5m', 'code': 'GE9402', 'qr': 'nl4-2.50m', 'exemplaren': [],
                   'pad': 'Materialen / Geluid / Bekabeling / Speakon / Speakon 4 polig', 'map': 'Speakon 4 polig', 'locatie': 'V-1-2',
                   'soort': 'bulk', 'type': 'Fysiek item', 'combinatie': False, 'aantal': 13}
        basis = {'type': 'labelmaker-basis', 'versie': 1, 'profiel': 'dsl', 'datum': '2026-10-26T12:00:00.000Z',
                 'artikelen': [artikel], 'losseItems': [], 'sjablonen': [], 'aanvullingen': {'GE9402': {'Doorsnede': '2,5 mm²'}}}
        p.route('**/data/dsl.json', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(basis)))
        p.reload()
        expect(p.locator('#melding')).to_contain_text('Basis van 26 okt geladen')
        p.locator('#tabLijst').click()
        rij = p.locator('#lijst li[data-code="GE9402"]')
        rij.locator('input[type=checkbox]').check()
        p.locator('#actBordje').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#aanvulling')).to_be_hidden()
        # tweede keer: zelfde basis → geen melding meer
        p.reload()
        expect(p.locator('#lijst li[data-code="GE9402"]')).to_have_count(1)
        p.wait_for_timeout(500)
        self.assertNotIn('Basis van', p.locator('#melding').inner_text())


if __name__ == '__main__':
    unittest.main()
