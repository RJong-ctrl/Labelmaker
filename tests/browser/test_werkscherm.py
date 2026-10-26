import os
import unittest

import cv2
import numpy as np
from playwright.sync_api import expect

from basis import FIXTURES, PaginaTest

VOORBEELD = os.path.join(FIXTURES, 'voorbeeld.xlsx')


class Hulp(PaginaTest):
    def inlezen(self):
        p = self.pagina
        p.locator('#bestand').set_input_files(VOORBEELD)
        p.wait_for_function("document.querySelector('#melding').textContent.includes('ingelezen')")

    def rij(self, code):
        return self.pagina.locator(f'#lijst li[data-code="{code}"]')

    def kies(self, code):
        self.rij(code).locator('input[type=checkbox]').check()

    def aanvullen(self, veld, waarde):
        d = self.pagina.locator('#aanvulling')
        d.wait_for(state='visible')
        d.locator(f'select[name="{veld}"]').select_option(waarde)
        d.get_by_role('button', name='Opslaan').click()
        d.wait_for(state='hidden')



class Werkscherm(Hulp):
    def test_leeg_scherm_legt_uit(self):
        self.assertIn('Artikelen inlezen', self.pagina.locator('#artikelen').inner_text())
        self.assertEqual(self.fouten, [])

    def test_inlezen_en_zoeken(self):
        p = self.pagina
        self.inlezen()
        self.assertIn('9 artikelen ingelezen', p.locator('#melding').inner_text())
        expect(p.locator('#lijst li')).to_have_count(8)
        p.locator('#combinaties').check()
        expect(p.locator('#lijst li')).to_have_count(9)
        p.locator('#combinaties').uncheck()
        p.locator('#zoek').fill('nl4 12,5')
        expect(p.locator('#lijst li')).to_have_count(1)
        expect(p.locator('#lijst li')).to_have_attribute('data-code', 'GE9412')
        p.locator('#zoek').fill('')
        p.locator('#chips button', has_text='Pipe en drape').click()
        expect(p.locator('#lijst li')).to_have_count(1)
        self.assertEqual(self.fouten, [])

    def test_strook_met_aanvulling(self):
        p = self.pagina
        self.inlezen()
        self.kies('GE9402')
        p.locator('#actBordje').click()
        self.aanvullen('Doorsnede', '2,5 mm²')
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        self.assertTrue(p.locator('#printA4').is_enabled())
        self.kies('GE9402')
        p.locator('#actBordje').click()
        p.wait_for_function("document.querySelector('#printA4').textContent.includes('Print 2')")
        self.assertTrue(p.locator('#aanvulling').is_hidden())

    def test_qrlabel_per_exemplaar(self):
        p = self.pagina
        self.inlezen()
        self.kies('LI8163-B')
        p.locator('#actQr').click()
        p.wait_for_function("document.querySelector('#printLabel').textContent.includes('Print 2')")
        self.assertEqual(p.locator('#tabLabel').inner_text().strip(), 'Citizen (2)')

    def test_locatielabel_zonder_locatie_overgeslagen(self):
        p = self.pagina
        self.inlezen()
        self.kies('GE9402')
        self.kies('GE9412')
        p.locator('#actLoc').click()
        p.wait_for_function("document.querySelector('#printLabel').textContent.includes('Print 1')")
        self.assertIn('zonder locatie', p.locator('#melding').inner_text())

    def test_blijft_na_herladen(self):
        p = self.pagina
        self.inlezen()
        self.kies('GE9402')
        p.locator('#actBordje').click()
        self.aanvullen('Doorsnede', '4 mm²')
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')  # pas dan is het printvel bewaard
        p.reload()
        p.wait_for_function("document.querySelector('#printA4').textContent.includes('Print 1')")
        expect(p.locator('#velLijst li')).to_have_count(1)
        self.kies('GE9412')
        p.locator('#actBordje').click()
        self.aanvullen('Doorsnede', '4 mm²')
        self.kies('GE9402')
        p.locator('#actBordje').click()
        p.wait_for_function("document.querySelector('#printA4').textContent.includes('Print 3')")

    def test_aantal_en_verwijderen(self):
        p = self.pagina
        self.inlezen()
        self.kies('CO1120')
        p.locator('#actQr').click()
        rij = p.locator('#velLijst li').first
        rij.locator('input.aantal').fill('5')
        rij.locator('input.aantal').press('Tab')
        p.wait_for_function("document.querySelector('#printLabel').textContent.includes('Print 5')")
        rij.get_by_role('button', name='Verwijderen').click()
        p.wait_for_function("document.querySelector('#printLabel').textContent.includes('Print 0')")
        self.assertTrue(p.locator('#printLabel').is_disabled())

    def test_lijst_toont_maximaal_200_rijen(self):
        p = self.pagina
        p.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            const o = await openOpslag('dsl');
            await o.schrijfVeel('artikelen', Array.from({ length: 1000 }, (_, i) => {
                const code = 'N' + String(i).padStart(4, '0');
                return { id: code, waarde: { id: code, naam: 'Nep artikel ' + i, code, qr: 'q' + i, exemplaren: [], pad: 'Materialen / Nep', map: 'Nep', locatie: '', soort: 'bulk', type: 'Fysiek item', combinatie: false, aantal: 1 } };
            }));
        }""")
        p.reload()
        p.wait_for_function("document.querySelectorAll('#lijst li').length > 0")
        expect(p.locator('#lijst li')).to_have_count(200)
        self.assertEqual(p.locator('#lijstmelding').inner_text().strip(), '200 van 1000 getoond, zoek verder om te verfijnen')

    def test_printknop_rechtsboven_na_vullen(self):
        p = self.pagina
        self.inlezen()
        self.kies('CO1120')
        p.locator('#actQr').click()
        p.wait_for_function("document.querySelector('#printLabel').textContent.includes('Print 1')")
        for knop in ('#printLabel', '#printA4'):
            b = p.locator(knop).bounding_box()
            self.assertLess(b['y'], 80)
            self.assertGreater(b['x'], self.viewport['width'] * 0.6)

    def test_laatst_geprint(self):
        p = self.pagina
        self.inlezen()
        self.kies('GE9402')
        p.locator('#actBordje').click()
        self.aanvullen('Doorsnede', '2,5 mm²')
        p.evaluate('window.print = () => { window.geprint = true; }')
        p.locator('#printA4').click()
        p.locator('#printbalk').get_by_role('button', name='Printen').click()
        p.wait_for_function('window.geprint === true')
        p.locator('#chips button', has_text='Laatst geprint').click()
        p.wait_for_function("document.querySelectorAll('#lijst li').length === 1")
        self.assertEqual(p.locator('#lijst li').get_attribute('data-code'), 'GE9402')

    def test_alleen_eerste_via_pijltje(self):
        p = self.pagina
        self.inlezen()
        self.kies('CO1120')
        p.locator('#actQr').click()
        p.locator('#printMeer').click()
        p.locator('#printMenu').get_by_role('button', name='Alleen eerste label (Citizen)').click()
        expect(p.locator('#printbalk')).to_contain_text('Citizen CL-E321')


class Herinlezen(Hulp):
    def test_verdwenen_artikel_gaat_van_printvel(self):
        p = self.pagina
        self.inlezen()
        self.kies('CO1120')
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        csv = 'Naam (in database);Code;QR-codes / RFID\nSpeakon 8p Koppelbus;GE9391;nl8-koppel\n'
        p.locator('#bestand').set_input_files({'name': 'nieuw.csv', 'mimeType': 'text/csv', 'buffer': csv.encode('utf-8')})
        expect(p.locator('#melding')).to_contain_text('1 artikel ingelezen')
        expect(p.locator('#melding')).to_contain_text('niet meer in de export')
        expect(p.locator('#printLabel')).to_have_text('Print 0 op Citizen')
        expect(p.locator('#velLijst li')).to_have_count(0)
        p.reload()
        expect(p.locator('#printLabel')).to_have_text('Print 0 op Citizen')

    def test_focus_terug_naar_zoekveld(self):
        p = self.pagina
        expect(p.locator('#zoek')).to_be_focused()
        self.inlezen()
        self.kies('CO1120')
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        expect(p.locator('#zoek')).to_be_focused()
        self.kies('GE9402')
        p.locator('#actBordje').click()
        self.aanvullen('Doorsnede', '4 mm²')
        expect(p.locator('#zoek')).to_be_focused()


class ZonderOpslag(Hulp):
    init_script = "Object.defineProperty(window, 'indexedDB', { get() { throw new Error('geblokkeerd'); } });"

    def test_werkt_in_geheugen_met_melding(self):
        p = self.pagina
        expect(p.locator('#melding')).to_contain_text('slaat niets op')
        self.inlezen()
        expect(p.locator('#melding')).to_contain_text('9 artikelen ingelezen')
        expect(p.locator('#lijst li')).to_have_count(8)


class Scannen(Hulp):
    """Voorbeeld-QR uitlezen gaat beter met een hogere pixeldichtheid."""
    apparaatschaal = 3

    def test_scannen_exemplaar(self):
        p = self.pagina
        self.inlezen()
        p.locator('#zoek').fill('bd6x3b-02')
        p.locator('#zoek').press('Enter')
        self.assertTrue(self.rij('LI8163-B').locator('input[type=checkbox]').is_checked())
        self.assertEqual(p.locator('#zoek').input_value(), '')
        p.locator('#actBordje').click()
        self.aanvullen('Kleur', 'Zwart')
        expect(p.locator('#tabA4')).to_have_text('A4 (1)')
        self.assertIn('bd6x3b-02', p.locator('#velLijst').inner_text())
        bordje = p.locator('#voorbeeld .signb')
        bordje.wait_for()
        img = cv2.imdecode(np.frombuffer(bordje.screenshot(), np.uint8), cv2.IMREAD_GRAYSCALE)
        img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST)
        self.assertEqual(cv2.QRCodeDetector().detectAndDecode(img)[0], 'bd6x3b-02')



if __name__ == '__main__':
    unittest.main()
