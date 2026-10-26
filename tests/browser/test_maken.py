import os
import unittest

import cv2
import numpy as np
from playwright.sync_api import expect

from basis import FIXTURES, PaginaTest

VOORBEELD = os.path.join(FIXTURES, 'voorbeeld.xlsx')


class Maken(PaginaTest):
    def inlezen(self):
        p = self.pagina
        p.locator('#bestand').set_input_files(VOORBEELD)
        expect(p.locator('#melding')).to_contain_text('ingelezen', timeout=30000)

    def opzoeken(self, tekst, kies=None):
        p = self.pagina
        p.locator('#makenZoek').fill(tekst)
        p.locator('#makenTreffers li', has_text=kies or tekst).first.click()

    def test_maken_is_standaard_en_leeg(self):
        p = self.pagina
        expect(p.locator('#tabMaken')).to_have_attribute('aria-selected', 'true')
        expect(p.locator('#maken')).to_be_visible()
        expect(p.locator('#lijstDeel')).to_be_hidden()
        expect(p.locator('#makenSoort')).to_have_value('auto')
        expect(p.locator('#makenVelden input[name="Naam"]')).to_have_value('')
        expect(p.locator('#makenVoorbeeld .signb')).to_have_count(1)
        self.assertEqual(self.fouten, [])

    def test_leeg_bordje_van_scratch(self):
        p = self.pagina
        p.locator('#makenVelden input[name="Naam"]').fill('Nooduitgang')
        p.locator('#makenVelden select[name="Randkleur"]').select_option('Groen')
        expect(p.locator('#makenVoorbeeld .signb .titel')).to_have_text('Nooduitgang')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#voorbeeld .signb .streep')).to_have_css('background-color', 'rgb(0, 176, 80)')
        expect(p.locator('#makenVelden input[name="Naam"]')).to_have_value('')

    def test_artikel_opzoeken_vult_in_en_aanpassen(self):
        p = self.pagina
        self.inlezen()
        self.opzoeken('GE9402')
        expect(p.locator('#makenArtikel')).to_contain_text('Speakon 4p Verlengkabel 2,5m')
        expect(p.locator('#makenVelden input[name="Omschrijving"]')).to_have_value('Speakon 4p Verlengkabel')
        expect(p.locator('#makenVelden input[name="Lengte"]')).to_have_value('2,5')
        expect(p.locator('#makenVelden input[name="__qr"]')).to_have_value('nl4-2.50m')
        p.locator('#makenVelden input[name="Lengte"]').fill('')
        p.locator('#makenVelden select[name="Doorsnede"]').select_option('4 mm²')
        expect(p.locator('#makenVoorbeeld .signb .groot')).to_have_count(0)
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#voorbeeld .signb .groot')).to_have_count(0)
        # het artikel zelf is niet veranderd
        self.opzoeken('GE9402')
        expect(p.locator('#makenVelden input[name="Lengte"]')).to_have_value('2,5')

    def test_verplicht_veld_eerst_invullen(self):
        p = self.pagina
        self.inlezen()
        self.opzoeken('GE9402')
        p.locator('#makenOpVel').click()
        expect(p.locator('#melding')).to_contain_text('Doorsnede')
        expect(p.locator('#printA4')).to_have_text('Print 0 op A4')

    def test_ongewijzigd_artikel_is_gewone_regel(self):
        p = self.pagina
        self.inlezen()
        self.opzoeken('CO1120')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#velLijst li').first).to_contain_text('Kenwood TK-3201 Portofoon')
        aantal = p.evaluate("async () => { const { openOpslag } = await import('./js/opslag.js'); return (await (await openOpslag('dsl')).alle('losse')).length; }")
        self.assertEqual(aantal, 0)

    def test_scannen_in_maken(self):
        p = self.pagina
        self.inlezen()
        p.locator('#makenZoek').fill('bd6x3b-02')
        p.locator('#makenZoek').press('Enter')
        expect(p.locator('#makenArtikel')).to_contain_text('Backdrop 6 x 3m B kwaliteit')
        expect(p.locator('#makenVelden input[name="__qr"]')).to_have_value('bd6x3b-02')
        expect(p.locator('#makenSoort')).to_have_value('auto')
        expect(p.locator('#makenVoorbeeld .signb.staand')).to_have_count(1)

    def test_soort_kiezen(self):
        p = self.pagina
        self.inlezen()
        self.opzoeken('CO1120')
        p.locator('#makenSoort').select_option('qrlabel-half')
        expect(p.locator('#makenVoorbeeld .lbl')).to_have_count(1)
        p.locator('#makenOpVel').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')

    def test_bewaren_als_los_item(self):
        p = self.pagina
        p.locator('#makenVelden input[name="Naam"]').fill('Statafel')
        p.locator('#makenBewaar').check()
        p.locator('#makenOpVel').click()
        p.locator('#tabLijst').click()
        expect(p.locator('#chips')).to_contain_text('Losse items')
        expect(p.locator('#lijst li', has_text='Statafel')).to_have_count(1)

    def test_aanpassen_opent_in_maken(self):
        p = self.pagina
        p.locator('#makenVelden input[name="Naam"]').fill('Statafel')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        p.locator('#velLijst li').first.get_by_role('button', name='Aanpassen').click()
        expect(p.locator('#makenVelden input[name="Naam"]')).to_have_value('Statafel')
        p.locator('#makenVelden input[name="Groot"]').fill('Ø 80 cm')
        expect(p.locator('#makenOpVel')).to_have_text('Bijwerken')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#voorbeeld .signb .groot')).to_have_text('Ø 80 cm')

    def test_qr_leesbaar_in_voorbeeld_maken(self):
        p = self.pagina
        p.locator('#makenVelden input[name="Naam"]').fill('Kist 1')
        p.locator('#makenVelden input[name="__qr"]').fill('kist-1')
        b = p.locator('#makenVoorbeeld .signb')
        expect(b.locator('.qc')).to_have_text('kist-1')


if __name__ == '__main__':
    unittest.main()
