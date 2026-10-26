import os
import unittest

from playwright.sync_api import expect

from basis import FIXTURES, PaginaTest

VOORBEELD = os.path.join(FIXTURES, 'voorbeeld.xlsx')


class Integratie(PaginaTest):
    def test_beheer_openen_en_terug(self):
        p = self.pagina
        p.locator('#bestand').set_input_files(VOORBEELD)
        expect(p.locator('#melding')).to_contain_text('ingelezen')
        p.locator('#beheer').click()
        expect(p.locator('#beheerScherm')).to_be_visible()
        expect(p.locator('header')).to_be_hidden()
        for naam in ['Publiceren', 'Profielen', 'Oude gegevens (versie 25)']:
            expect(p.locator('#beheerScherm')).to_contain_text(naam)
        p.locator('#beheerScherm').get_by_role('button', name='Publiceren').click()
        expect(p.locator('#beheerScherm').get_by_role('button', name='Publicatiebestand maken')).to_be_visible()
        p.locator('#beheerScherm').get_by_role('button', name='Terug naar werkscherm').click()
        expect(p.locator('header')).to_be_visible()
        expect(p.locator('#beheerScherm')).to_be_hidden()
        p.locator('#tabLijst').click()
        p.locator('#lijst li[data-code="CO1120"] input[type=checkbox]').check()
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        self.assertEqual(self.fouten, [])

    def test_kleur_in_beheer_ook_in_werkscherm(self):
        p = self.pagina
        p.locator('#bestand').set_input_files(VOORBEELD)
        expect(p.locator('#melding')).to_contain_text('ingelezen')
        p.locator('#tabLijst').click()
        p.locator('#lijst li[data-code="GE9412"] input[type=checkbox]').check()
        p.locator('#actBordje').click()
        d = p.locator('#aanvulling')
        d.locator('select[name="Doorsnede"]').select_option('2,5 mm²')
        d.get_by_role('button', name='Opslaan').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        # kleur 12,5 → oranje, zoals in beheer (via het model van de pagina)
        p.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            const { laadModel } = await import('./js/model.js');
            const m = await laadModel(await openOpslag('dsl'), 'dsl', 'dsl');
            const s = m.effectief().sjablonen.find(x => x.id === 'gitterbox');
            await m.zetSjabloon({ ...s, kleuren: { ...s.kleuren, rand: { ...s.kleuren.rand, waarden: { ...s.kleuren.rand.waarden, '12,5': '#ff8c00' } } } });
        }""")
        p.reload()
        p.locator('#tabA4').click()
        expect(p.locator('#voorbeeld .signb .streep')).to_have_css('background-color', 'rgb(255, 140, 0)')


if __name__ == '__main__':
    unittest.main()
