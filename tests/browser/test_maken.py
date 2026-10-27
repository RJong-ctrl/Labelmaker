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
        expect(p.locator('#vellen .signb .streep')).to_have_css('background-color', 'rgb(0, 176, 80)')
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
        expect(p.locator('#vellen .signb .groot')).to_have_count(0)
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

    def losse(self, verwacht=None, wacht=5):
        """Ids van de losse items in de opslag; met verwacht: even wachten tot het opruimen klaar is."""
        import time
        eind = time.time() + wacht
        while True:
            ids = self.pagina.evaluate("async () => { const { openOpslag } = await import('./js/opslag.js'); return (await (await openOpslag('dsl')).alle('losse')).map(x => x.id); }")
            if verwacht is None or ids == verwacht or time.time() > eind:
                return ids
            self.pagina.wait_for_timeout(100)

    def test_gescand_exemplaar_is_gewone_regel(self):
        p = self.pagina
        self.inlezen()
        p.locator('#makenZoek').fill('bd6x3b-02')
        p.locator('#makenZoek').press('Enter')
        p.locator('#makenVelden select[name="Kleur"]').select_option('Zwart')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        # Kleur ingevuld = eigen versie; zonder wijziging (kleur al bekend) wordt het een gewone regel
        p.locator('#velLeeg').click()
        expect(p.locator('#printA4')).to_have_text('Print 0 op A4')
        self.assertEqual(self.losse([]), [])
        p.evaluate("async () => { const { openOpslag } = await import('./js/opslag.js'); await (await openOpslag('dsl')).schrijf('aanvullingen', 'LI8163-B', { Kleur: 'Zwart' }); }")
        p.reload()
        p.locator('#makenZoek').fill('bd6x3b-02')
        p.locator('#makenZoek').press('Enter')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#velLijst li').first).to_contain_text('bd6x3b-02')
        self.assertEqual(self.losse([]), [])

    def test_bijwerken_houdt_aantal(self):
        p = self.pagina
        p.locator('#makenVelden input[name="Naam"]').fill('Statafel')
        p.locator('#makenOpVel').click()
        rij = p.locator('#velLijst li').first
        rij.locator('input.aantal').fill('5')
        rij.locator('input.aantal').press('Tab')
        expect(p.locator('#printA4')).to_have_text('Print 5 op A4')
        p.locator('#velLijst li').first.get_by_role('button', name='Aanpassen').click()
        expect(p.locator('#makenVelden input[name="__aantal"]')).to_have_value('5')
        p.locator('#makenVelden input[name="Groot"]').fill('Ø 80')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 5 op A4')

    def test_tijdelijk_item_weg_met_regel(self):
        p = self.pagina
        p.locator('#makenVelden input[name="Naam"]').fill('Eenmalig')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        self.assertEqual(len(self.losse()), 1)
        p.locator('#velLijst li').first.get_by_role('button', name='Verwijderen').click()
        expect(p.locator('#printA4')).to_have_text('Print 0 op A4')
        p.wait_for_timeout(300)
        self.assertEqual(self.losse([]), [])

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
        expect(p.locator('#vellen .signb .groot')).to_have_text('Ø 80 cm')

    def test_qr_leesbaar_in_voorbeeld_maken(self):
        p = self.pagina
        p.locator('#makenVelden input[name="Naam"]').fill('Kist 1')
        p.locator('#makenVelden input[name="__qr"]').fill('kist-1')
        b = p.locator('#makenVoorbeeld .signb')
        expect(b.locator('.qc')).to_have_text('kist-1')


    def test_wandbord_letters_niet_afgekapt(self):
        """De haak van de J steekt links en onder uit: geen inkt mag tegen de rand van het titelvak komen."""
        p = self.pagina
        for soort, veld in [('wandbord-liggend', 'Locatie'), ('wandbord-staand', 'Locatie'), ('bordje-staand', 'Naam'), ('leeg-liggend', 'Naam')]:
            p.locator('#makenSoort').select_option(soort)
            p.locator('#makenVelden input[name="%s"]' % veld).fill('J-2')
            vak = p.locator('#makenVoorbeeld .signb .titel')
            expect(vak).to_have_text('J-2')
            p.wait_for_timeout(500)
            # Vergelijk met dezelfde titel zonder enige afknipping: er mag niets verschillen.
            r = vak.bounding_box()
            bm = p.locator('#makenVoorbeeld .signb .bm').bounding_box()   # tekstgebied, rechts van de kleurband
            m = 40
            sb = p.locator('#makenVoorbeeld .signb').bounding_box()
            gebied = {'x': bm['x'], 'y': r['y'], 'width': min(r['x'] + r['width'] + m, sb['x'] + sb['width'] - 3) - bm['x'], 'height': r['height'] + m}
            nu = p.screenshot(clip=gebied)
            vak.evaluate("e => { for (let x = e; x && !x.classList.contains('voorbeeld-maken'); x = x.parentElement) x.style.setProperty('overflow', 'visible', 'important'); }")
            vrij = p.screenshot(clip=gebied)
            a1 = cv2.imdecode(np.frombuffer(nu, np.uint8), cv2.IMREAD_GRAYSCALE)
            a2 = cv2.imdecode(np.frombuffer(vrij, np.uint8), cv2.IMREAD_GRAYSCALE)
            self.assertLess(int(cv2.absdiff(a1, a2).max()), 60, soort + ': letters afgeknipt')

    def test_wandbord_a4(self):
        p = self.pagina
        p.locator('#makenSoort').select_option('wandbord-liggend')
        p.locator('#makenVelden input[name="Locatie"]').fill('J-2')
        p.locator('#makenVelden input[name="Inhoud"]').fill('Speakon kabels')
        expect(p.locator('#makenVoorbeeld .signb .titel')).to_have_text('J-2')
        expect(p.locator('#makenVoorbeeld .signb .qc')).to_have_text('J-2')
        p.locator('#makenVelden input[name="__aantal"]').fill('2')
        p.locator('#makenOpVel').click()
        expect(p.locator('#vellen .a4')).to_have_count(2)           # één wandbord per A4
        expect(p.locator('#vellen .a4').first.locator('.signb')).to_have_count(1)
        self.assertEqual(self.fouten, [])

    def test_wandbord_a5_twee_per_a4(self):
        p = self.pagina
        for n, soort in enumerate(['wandbord-a5-staand', 'wandbord-a5-liggend']):
            p.locator('#makenSoort').select_option(soort)
            p.locator('#makenVelden input[name="Locatie"]').fill('J-2-1')
            p.locator('#makenVelden input[name="__aantal"]').fill('2')
            p.locator('#makenOpVel').click()
            expect(p.locator('#printA4')).to_have_text('Print %d op A4' % (2 * n + 2))
        expect(p.locator('#vellen .a4')).to_have_count(2)
        expect(p.locator('#vellen .a4').first.locator('.signb')).to_have_count(2)
        self.assertEqual(self.fouten, [])

    def test_kistbordje_twee_per_a4(self):
        p = self.pagina
        p.locator('#makenSoort').select_option('kist')
        p.locator('#makenVelden input[name="Naam"]').fill('DMX kit groot [Case]')
        p.locator('#makenVelden input[name="Gewicht"]').fill('66,20')
        p.locator('#makenVelden textarea[name="Inhoud"]').fill('30 DMX 3p 1,25m\n2 DMX 3p Afsluiter')
        k = p.locator('#makenVoorbeeld .signb.kist')
        expect(k.locator('.kt')).to_have_text(['DMX 3p 1,25m', 'DMX 3p Afsluiter'])
        expect(k).to_contain_text('66,20 kg')
        p.locator('#makenVelden input[name="__aantal"]').fill('2')
        p.locator('#makenOpVel').click()
        expect(p.locator('#vellen .a4')).to_have_count(1)
        expect(p.locator('#vellen .a4 .signb.kist')).to_have_count(2)
        self.assertEqual(self.fouten, [])

    def test_pipe_drape_maat_onder_de_naam(self):
        p = self.pagina
        self.inlezen()
        self.opzoeken('PD5143')
        expect(p.locator('#makenVelden input[name="Lengte"]')).to_have_value('4')
        expect(p.locator('#makenVelden input[name="Hoogte"]')).to_have_value('3')
        p.locator('#makenVelden input[name="Hoogte"]').fill('3,5')
        b = p.locator('#makenVoorbeeld .signb')
        expect(b.locator('.groot')).to_have_text('4 × 3,5m')
        t, g = b.locator('.titel').bounding_box(), b.locator('.groot').bounding_box()
        self.assertGreaterEqual(g['y'], t['y'] + t['height'] - 1, 'maat staat onder de naam')

    def test_randkleur_kiezen_bij_artikel(self):
        p = self.pagina
        self.inlezen()
        self.opzoeken('GE9402')
        # gitterbox kleurt zelf op lengte; ook hier kun je de kleur kiezen
        p.locator('#makenVelden select[name="Doorsnede"]').select_option('2,5 mm²')
        p.locator('#makenVelden select[name="Randkleur"]').select_option('Groen')
        expect(p.locator('#makenVoorbeeld .signb .streep')).to_have_css('background-color', 'rgb(0, 176, 80)')
        p.locator('#makenOpVel').click()
        expect(p.locator('#vellen .signb .streep')).to_have_css('background-color', 'rgb(0, 176, 80)')
        self.assertEqual(self.fouten, [])

    def test_geen_randkleur_bij_qr_label(self):
        p = self.pagina
        p.locator('#makenSoort').select_option('qrlabel')
        expect(p.locator('#makenVelden select[name="Randkleur"]')).to_have_count(0)


class MakenPast(PaginaTest):
    """Laptop met 125% schaal (1536×740 zichtbaar): het formulier past zonder scrollen."""
    viewport = {'width': 1536, 'height': 740}

    def test_formulier_past_zonder_scrollen(self):
        p = self.pagina
        maat = p.evaluate("""() => { const m = document.getElementById('maken'); return [m.scrollHeight, m.clientHeight]; }""")
        self.assertLessEqual(maat[0], maat[1] + 1, 'Maken-formulier moet scrollen: %r' % maat)
        expect(p.locator('#makenOpVel')).to_be_in_viewport()

    def test_focusrand_valt_niet_weg(self):
        """De oranje focusrand (2px + 2px afstand) mag niet door de rand van het formulier worden afgesneden."""
        p = self.pagina
        for veld in ['#makenSoort', '#makenZoek', '#makenVelden input[name="Groot"]', '#makenVelden input[name="Naam"]']:
            p.locator(veld).focus()
            ruimte = p.evaluate("""(sel) => { const m = document.getElementById('maken'), e = document.querySelector(sel);
              const a = m.getBoundingClientRect(), b = e.getBoundingClientRect();
              return Math.min(b.left - a.left - m.clientLeft, (a.left + m.clientLeft + m.clientWidth) - b.right, b.top - a.top + m.scrollTop); }""", veld)
            self.assertGreaterEqual(ruimte, 4, veld)

    def test_voorbeeld_staat_in_voorbeeldkolom(self):
        p = self.pagina
        expect(p.locator('#voorbeeld #makenVoorbeeld .signb')).to_have_count(1)
        p.locator('#tabLijst').click()
        expect(p.locator('#makenVoorbeeld')).to_be_hidden()
        p.locator('#tabMaken').click()
        expect(p.locator('#makenVoorbeeld')).to_be_visible()
        self.assertEqual(self.fouten, [])


if __name__ == '__main__':
    unittest.main()
