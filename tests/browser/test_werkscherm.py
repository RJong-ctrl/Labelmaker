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

    def test_artikel_aanvinken_geeft_er_een(self):
        p = self.pagina
        self.inlezen()
        self.kies('LI8163-B')
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        expect(p.locator('#velLijst')).to_contain_text('bd6x3B')

    def test_qrlabel_per_exemplaar_als_gekozen(self):
        p = self.pagina
        self.inlezen()
        self.kies('LI8163-B')
        p.locator('#perExemplaar').check()
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 2 op Citizen')
        expect(p.locator('#tabLabel')).to_have_text('Citizen (2)')
        expect(p.locator('#perExemplaar')).not_to_be_checked()

    def test_locatielabel_zonder_locatie_overgeslagen(self):
        p = self.pagina
        self.inlezen()
        self.kies('GE9402')
        self.kies('GE9412')
        p.locator('#actLoc').click()
        d = p.locator('#aanvulling')
        expect(d).to_contain_text('Locatie ontbreekt')
        d.get_by_role('button', name='Annuleren').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        expect(p.locator('#melding')).to_contain_text('1 zonder locatie overgeslagen')
        expect(p.locator('#melding')).to_have_class('melding fout')

    def test_locatie_invullen_en_onthouden(self):
        p = self.pagina
        self.inlezen()
        self.kies('GE9412')
        p.locator('#actLoc').click()
        d = p.locator('#aanvulling')
        expect(d).to_contain_text('Locatie ontbreekt')
        d.locator('input[name="Locatie"]').fill('B-3')
        d.get_by_role('button', name='Opslaan').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        expect(p.locator('#voorbeeld .lbl .titel')).to_have_text('B-3')
        self.kies('GE9412')
        p.locator('#actLoc').click()
        expect(p.locator('#printLabel')).to_have_text('Print 2 op Citizen')
        expect(d).to_be_hidden()

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
        p.evaluate('() => { window.print = () => { window.geprint = true; }; }')
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


class Vrijheid(Hulp):
    def test_sjabloon_per_keer(self):
        p = self.pagina
        self.inlezen()
        self.kies('GE9402')
        p.locator('#sjabloonKeuze').select_option('qrlabel-half')
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        expect(p.locator('#velLijst')).to_contain_text('QR-label half')
        expect(p.locator('#sjabloonKeuze')).to_have_value('')
        expect(p.locator('#aanvulling')).to_be_hidden()

    def test_ander_sjabloon_liggend(self):
        p = self.pagina
        self.inlezen()
        self.kies('CO1120')
        p.locator('#sjabloonKeuze').select_option('bordje-liggend')
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#voorbeeld .signb.liggend')).to_have_count(1)

    def test_los_item_maken(self):
        p = self.pagina
        p.locator('#losItem').click()
        d = p.locator('#aanvulling')
        d.locator('select[name="__sjabloon"]').select_option('qrlabel')
        d.locator('input[name="__naam"]').fill('Testkist')
        d.locator('input[name="__qr"]').fill('tk-1')
        d.get_by_role('button', name='Opslaan').click()
        expect(p.locator('#chips')).to_contain_text('Losse items')
        rij = p.locator('#lijst li', has_text='Testkist')
        expect(rij.locator('input[type=checkbox]')).to_be_checked()
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        expect(p.locator('#voorbeeld .lbl .titel')).to_have_text('Testkist')
        p.reload()
        expect(p.locator('#lijst li', has_text='Testkist')).to_have_count(1)

    def test_vrij_bordje_met_regels(self):
        p = self.pagina
        p.locator('#losItem').click()
        d = p.locator('#aanvulling')
        d.locator('select[name="__sjabloon"]').select_option('bordje-staand')
        d.locator('input[name="__naam"]').fill('Statafel')
        d.locator('input[name="Groot"]').fill('Ø 80 cm')
        d.locator('textarea[name="Regels"]').fill('Kleur: Zwart\nHoes: Wit')
        d.get_by_role('button', name='Opslaan').click()
        p.locator('#actBordje').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        bordje = p.locator('#voorbeeld .signb')
        expect(bordje.locator('.groot')).to_have_text('Ø 80 cm')
        expect(bordje.locator('.tg')).to_contain_text('Hoes')
        expect(bordje.locator('.geen-qr')).to_have_count(1)

    def test_aanpassen_op_printvel(self):
        p = self.pagina
        self.inlezen()
        self.kies('CO1120')
        p.locator('#actBordje').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        p.locator('#velLijst li').first.get_by_role('button', name='Aanpassen').click()
        d = p.locator('#aanvulling')
        d.locator('input[name="Groot"]').fill('12 st.')
        d.get_by_role('button', name='Opslaan').click()
        expect(p.locator('#voorbeeld .signb .groot')).to_have_text('12 st.')

    def test_kolommen_koppelen(self):
        p = self.pagina
        csv = 'Omschrijving;Nummer;Plek\nStatafel zwart;T1;B-2\n'
        p.locator('#bestand').set_input_files({'name': 'eigen.csv', 'mimeType': 'text/csv', 'buffer': csv.encode('utf-8')})
        d = p.locator('#aanvulling')
        d.locator('select[name="naam"]').select_option('Omschrijving')
        d.locator('select[name="code"]').select_option('Nummer')
        d.locator('select[name="locatie"]').select_option('Plek')
        d.get_by_role('button', name='Inlezen').click()
        expect(p.locator('#melding')).to_contain_text('1 artikel ingelezen')
        expect(p.locator('#lijst li', has_text='Statafel zwart')).to_contain_text('B-2')
        p.locator('#bestand').set_input_files({'name': 'eigen.csv', 'mimeType': 'text/csv', 'buffer': csv.encode('utf-8')})
        expect(p.locator('#melding')).to_contain_text('1 artikel ingelezen')
        expect(d).to_be_hidden()


class Robuust(Hulp):
    init_script = """
        window.__faal = false;
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...a) {
            if (window.__faal) throw new DOMException('vol', 'QuotaExceededError');
            return put.apply(this, a);
        };
    """

    def test_html_in_namen_blijft_tekst(self):
        p = self.pagina
        naam = '<img src=x onerror="window.__xss=1"> Kabel "pro" & co'
        csv = 'Naam (in database);Code;QR-codes / RFID;Map (Map)\n"' + naam.replace('"', '""') + '";X1;q1;<b>map</b>\n'
        p.locator('#bestand').set_input_files({'name': 'x.csv', 'mimeType': 'text/csv', 'buffer': csv.encode('utf-8')})
        expect(p.locator('#lijst li')).to_have_count(1)
        expect(p.locator('#lijst li .nm')).to_have_text(naam)
        self.kies('X1')
        p.locator('#actQr').click()
        expect(p.locator('#voorbeeld .lbl .titel')).to_contain_text('Kabel "pro" & co')
        self.assertIsNone(p.evaluate('window.__xss'))
        expect(p.locator('#chips')).to_contain_text('<b>map</b>')

    def test_scannen_artikel_qr(self):
        p = self.pagina
        self.inlezen()
        p.locator('#zoek').fill('NL4-2.50M')
        p.locator('#zoek').press('Enter')
        self.assertTrue(self.rij('GE9402').locator('input[type=checkbox]').is_checked())
        expect(self.rij('GE9402').locator('.tag')).to_have_count(0)

    def test_exemplaar_scannen_houdt_heel_artikel(self):
        p = self.pagina
        self.inlezen()
        self.kies('LI8163-B')
        p.locator('#zoek').fill('bd6x3b-01')
        p.locator('#zoek').press('Enter')
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')

    def test_qrlabel_zonder_qr_melding(self):
        p = self.pagina
        self.inlezen()
        self.kies('GE9407')
        p.locator('#actQr').click()
        expect(p.locator('#voorbeeld .lbl .geen-qr')).to_have_text('Geen QR-code')

    def test_printvel_leegmaken(self):
        p = self.pagina
        self.inlezen()
        self.kies('CO1120')
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        p.locator('#velLeeg').click()
        expect(p.locator('#printLabel')).to_have_text('Print 0 op Citizen')
        expect(p.locator('#velLijst li')).to_have_count(0)

    def test_oude_printlog_opgeruimd(self):
        p = self.pagina
        p.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            const o = await openOpslag('dsl');
            const oud = Date.now() - 40 * 24 * 3600 * 1000;
            await o.schrijf('printlog', new Date(oud).toISOString() + '#0000', { sjabloon: 'qrlabel', artikel: 'X', qr: '', aantal: 1, tijd: oud });
            await o.schrijf('printlog', new Date().toISOString() + '#0000', { sjabloon: 'qrlabel', artikel: 'Y', qr: '', aantal: 1, tijd: Date.now() });
        }""")
        p.reload()
        p.wait_for_function("document.querySelector('#printLabel')")
        expect(p.locator('#zoek')).to_be_focused()
        n = p.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            return (await (await openOpslag('dsl')).alle('printlog')).map(x => x.waarde.artikel);
        }""")
        self.assertEqual(n, ['Y'])

    def test_dubbelklik_en_esc_bij_printen(self):
        p = self.pagina
        self.inlezen()
        self.kies('CO1120')
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        p.evaluate('() => { window.print = () => { window.geprint = (window.geprint || 0) + 1; }; }')
        p.locator('#printLabel').dblclick()
        expect(p.locator('#printbalk')).to_be_visible()
        p.keyboard.press('Escape')
        expect(p.locator('#printbalk')).to_be_hidden()
        p.locator('#printLabel').click()
        p.locator('#printbalk').get_by_role('button', name='Printen').click()
        p.wait_for_function('window.geprint === 1')
        n = p.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            return (await (await openOpslag('dsl')).alle('printlog')).length;
        }""")
        self.assertEqual(n, 1)

    def test_opslaan_mislukt_geeft_melding(self):
        p = self.pagina
        self.inlezen()
        self.kies('CO1120')
        p.locator('#actQr').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')
        p.evaluate('window.__faal = true')
        rij = p.locator('#velLijst li').first
        rij.locator('input.aantal').fill('3')
        rij.locator('input.aantal').press('Tab')
        expect(p.locator('#melding')).to_contain_text('Opslaan mislukt')


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
