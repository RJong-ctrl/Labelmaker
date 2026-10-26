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
        expect(p.locator('#leegArtikelen')).to_be_visible()
        opties = p.locator('#sjabloonKeuze option:not([value=""])').all_inner_texts()
        self.assertEqual(opties, ['QR-label', 'Locatielabel', 'Bordje staand', 'Bordje liggend', 'Strook'])
        p.locator('#profiel').select_option('dsl')
        expect(p.locator('#profiel')).to_have_value('dsl')
        expect(p.locator('#lijst li')).to_have_count(8)
        self.assertEqual(self.fouten, [])


if __name__ == '__main__':
    unittest.main()
