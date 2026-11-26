import re
import os
import unittest

import cv2
import numpy as np
from playwright.sync_api import expect

from basis import FIXTURES, PaginaTest

VOORBEELD = os.path.join(FIXTURES, 'voorbeeld.xlsx')


class MakenHulp:
    def kies(self, soort):
        """Sjabloon kiezen: altijd via het venster (ook vanuit het formulier, Robin 23 nov)."""
        p = self.pagina
        p.locator('#makenSoort' if p.locator('#makenSoort').count() else '#makenKies').click()
        p.locator('#sjabloonVenster [data-tegel="%s"]' % soort).click()
        expect(p.locator('#sjabloonVenster')).to_be_hidden()


class Maken(MakenHulp, PaginaTest):
    def inlezen(self):
        p = self.pagina
        p.locator('#bestand').set_input_files(VOORBEELD)
        expect(p.locator('#melding')).to_contain_text('ingelezen', timeout=30000)

    def opzoeken(self, tekst, kies=None):
        p = self.pagina
        p.locator('#makenZoek').fill(tekst)
        p.locator('#makenTreffers li', has_text=kies or tekst).first.click()

    def test_maken_begint_met_sjabloonkeuze(self):
        """Maken begint met zoeken/scannen en de knop Sjabloon kiezen; die opent een venster met voorbeelden."""
        p = self.pagina
        expect(p.locator('#tabMaken')).to_have_attribute('aria-selected', 'true')
        expect(p.locator('#makenVelden')).to_have_count(0)
        expect(p.locator('#makenVak')).to_be_hidden()
        p.locator('#makenKies').click()
        venster = p.locator('#sjabloonVenster')
        expect(venster).to_be_visible()
        for id in ['leeg-staand', 'kist', 'kist-modern', 'wandbord-staand', 'qrlabel', 'locatie']:
            expect(venster.locator('[data-tegel="%s"]' % id)).to_have_count(1)
        expect(venster.locator('.duim .signb, .duim .lbl')).to_have_count(venster.locator('[data-tegel]').count())
        # per soort een eigen rij
        expect(venster.locator('.tegelkop')).to_have_text(['Bordjes', 'Magazijn', 'Kisten', re.compile('Labels')])
        # binnen een soort kleine rijtjes met een titeltje, naast elkaar (Robin, 23 nov)
        kisten = venster.locator('.tegelgroep').nth(2)
        expect(kisten.locator('.subkop')).to_have_text(['Materiaalbordjes', 'B&W cases'])
        mat = kisten.locator('.subgroep').nth(0).locator('[data-tegel]')
        self.assertEqual(mat.evaluate_all('l => l.map(e => e.dataset.tegel)'), ['kist', 'kist-modern', 'speakertas'])
        bw = kisten.locator('.subgroep').nth(1).locator('[data-tegel]')
        self.assertEqual(bw.evaluate_all('l => l.map(e => e.dataset.tegel)'), ['kist-bw1000', 'kist-bw6040'])
        a, b = kisten.locator('.subgroep').nth(0).bounding_box(), kisten.locator('.subgroep').nth(1).bounding_box()
        self.assertAlmostEqual(a['y'], b['y'], delta=2)             # naast elkaar, niet onder elkaar
        expect(venster.locator('.tegelgroep').nth(1).locator('.subkop')).to_have_text(['Stellingen', 'Bakken & gitterboxen', 'Wanden'])

        # voorbeeldjes tonen ook iets bij sjablonen met eigen velden (Locatie/Inhoud)
        expect(venster.locator('[data-tegel="stellingbord"] .titel')).to_have_text('A1')
        p.keyboard.press('Escape')
        expect(venster).to_be_hidden()
        p.locator('#makenKies').click()
        venster.locator('[data-tegel="leeg-staand"]').click()
        expect(venster).to_be_hidden()
        expect(p.locator('#makenVelden input[name="Naam"]')).to_be_focused()
        # wisselen vanuit het formulier: dezelfde pop-up, geen keuzelijst meer
        soort = p.locator('#makenSoort')
        expect(soort).to_have_attribute('data-sjabloon', 'leeg-staand')
        expect(soort).to_contain_text('Leeg bordje staand')
        expect(p.locator('select#makenSoort')).to_have_count(0)
        expect(p.locator('#makenTerug')).to_have_count(0)
        p.locator('#makenVelden input[name="Naam"]').fill('Blijft staan')
        soort.click()
        expect(venster).to_be_visible()
        expect(venster.locator('[data-tegel="leeg-staand"].gekozen')).to_have_count(1)
        venster.locator('[data-tegel="kist"]').click()
        expect(venster).to_be_hidden()
        expect(soort).to_have_attribute('data-sjabloon', 'kist')
        expect(soort).to_contain_text('Materiaalbordje kist')
        self.assertEqual(self.fouten, [])

    def test_leeg_bordje_van_scratch(self):
        p = self.pagina
        self.kies('leeg-staand')
        p.locator('#makenVelden input[name="Naam"]').fill('Nooduitgang')
        p.locator('#makenVelden select[name="Randkleur"]').select_option('Groen')
        expect(p.locator('#makenVoorbeeld .signb .titel')).to_have_text('Nooduitgang')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#vellen .signb .streep')).to_have_css('background-color', 'rgb(0, 176, 80)')
        # Na Op printvel blijft het label staan (Robin, 16 nov); Leegmaken begint opnieuw met hetzelfde sjabloon.
        expect(p.locator('#makenVelden input[name="Naam"]')).to_have_value('Nooduitgang')
        p.locator('#makenLeeg').click()
        expect(p.locator('#makenVelden input[name="Naam"]')).to_have_value('')

    def test_artikel_blijft_staan_na_op_printvel(self):
        """Na Op printvel niet terug naar de sjabloonlijst: artikel en formulier blijven staan, nog eens = tweede."""
        p = self.pagina
        self.inlezen()
        self.opzoeken('CO1120')
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#makenArtikel')).to_contain_text('Kenwood TK-3201 Portofoon')
        expect(p.locator('#makenVoorbeeld .signb')).to_have_count(1)
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 2 op A4')

    def test_artikel_opzoeken_vult_in_en_aanpassen(self):
        p = self.pagina
        self.inlezen()
        self.opzoeken('GE9402')
        expect(p.locator('#makenArtikel')).to_contain_text('Speakon 4p Verlengkabel 2,5m')
        expect(p.locator('#makenVelden input[name="Naam"]')).to_have_value('Speakon 4p Verlengkabel')
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
        expect(p.locator('#makenSoort')).to_have_attribute('data-sjabloon', 'auto')
        expect(p.locator('#makenSoort')).to_contain_text('Automatisch')
        expect(p.locator('#makenVoorbeeld .signb.staand')).to_have_count(1)
        # met een artikel staat Automatisch bovenaan in de pop-up; een ander sjabloon houdt het artikel vast
        p.locator('#makenSoort').click()
        expect(p.locator('#sjabloonVenster [data-tegel="auto"].gekozen')).to_have_count(1)
        p.locator('#sjabloonVenster [data-tegel="qrlabel"]').click()
        expect(p.locator('#makenArtikel')).to_contain_text('Backdrop 6 x 3m B kwaliteit')
        expect(p.locator('#makenSoort')).to_have_attribute('data-sjabloon', 'qrlabel')

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
        self.kies('leeg-staand')
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
        self.kies('leeg-staand')
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
        self.kies('qrlabel-half')
        expect(p.locator('#makenVoorbeeld .lbl')).to_have_count(1)
        p.locator('#makenOpVel').click()
        expect(p.locator('#printLabel')).to_have_text('Print 1 op Citizen')

    def test_bewaren_als_los_item(self):
        p = self.pagina
        self.kies('leeg-staand')
        p.locator('#makenVelden input[name="Naam"]').fill('Statafel')
        p.locator('#makenBewaar').check()
        p.locator('#makenOpVel').click()
        p.locator('#tabLijst').click()
        expect(p.locator('#chips')).to_contain_text('Losse items')
        expect(p.locator('#lijst li', has_text='Statafel')).to_have_count(1)

    def test_aanpassen_opent_in_maken(self):
        p = self.pagina
        self.kies('leeg-staand')
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
        self.kies('leeg-staand')
        p.locator('#makenVelden input[name="Naam"]').fill('Kist 1')
        p.locator('#makenVelden input[name="__qr"]').fill('kist-1')
        b = p.locator('#makenVoorbeeld .signb')
        expect(b.locator('.qc')).to_have_text('kist-1')


    def test_wandbord_letters_niet_afgekapt(self):
        """De haak van de J steekt links en onder uit: geen inkt mag tegen de rand van het titelvak komen."""
        p = self.pagina
        for soort, veld in [('wandbord-liggend', 'Locatie'), ('wandbord-staand', 'Locatie'), ('bordje-staand', 'Naam'), ('leeg-liggend', 'Naam')]:
            self.kies(soort)
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
        self.kies('wandbord-liggend')
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
            self.kies(soort)
            p.locator('#makenVelden input[name="Locatie"]').fill('J-2-1')
            p.locator('#makenVelden input[name="__aantal"]').fill('2')
            p.locator('#makenOpVel').click()
            expect(p.locator('#printA4')).to_have_text('Print %d op A4' % (2 * n + 2))
        expect(p.locator('#vellen .a4')).to_have_count(2)
        expect(p.locator('#vellen .a4').first.locator('.signb')).to_have_count(2)
        self.assertEqual(self.fouten, [])

    def test_kistbordje_twee_per_a4(self):
        """Klassiek A5: precies zoals het oude Publisher-bordje (Robin, 23 nov)."""
        p = self.pagina
        self.kies('kist')
        p.locator('#makenVelden input[name="Naam"]').fill('DMX kit groot [Case]')
        p.locator('#makenVelden input[name="Kistnummer"]').fill('DSL01')
        p.locator('#makenVelden input[name="Gewicht"]').fill('66,20')
        p.locator('#makenVelden textarea[name="Inhoud"]').fill('30 DMX 3p 1,25m\n2 DMX 3p Afsluiter')
        k = p.locator('#makenVoorbeeld .signb.kist')
        expect(k.locator('.kt')).to_have_text(['DMX 3p 1,25m', 'DMX 3p Afsluiter'])
        expect(k.locator('.ka')).to_have_text(['30', '2'])
        # kop: logo | Klant / Productie | QR ; rij: Datum | Check | Gewicht ; Inhoud: naam (vet), kistnummer rechts ; zwarte voet
        for deel in ['.klogo', '.kqr', '.kvoet']:
            expect(k.locator(deel)).to_have_count(1)
        expect(k.locator('.ksticker')).to_have_count(0)
        expect(k.locator('.kstapel .kv b')).to_have_text(['Klant:', 'Productie:'])
        expect(k.locator('.kdatum .kv b')).to_have_text(['Datum:', 'Check:', 'Gewicht:'])
        expect(k.locator('.kdatum')).to_contain_text('66,20 kg')
        # de staart van de g (kg) mag niet worden afgeknipt (Robin, 23 nov): genoeg regelhoogte in het afgesneden vak
        ruimte = k.locator('.kdatum .kw').evaluate('''e => { const cs = getComputedStyle(e);
            return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize); }''')
        self.assertGreaterEqual(ruimte, 1.25)
        expect(k.locator('.kkop .kl')).to_have_text('Inhoud:')
        expect(k.locator('.kkop .kn')).to_have_text('DMX kit groot [Case]')
        expect(k.locator('.kkop .kcode')).to_have_text('DSL01')
        # 'Inhoud:', de naam en het kistnummer op één schrijflijn (Robin, 23 nov)
        lijnen = k.locator('.kkop .kl, .kkop .kn span, .kkop .kcode').evaluate_all('''l => l.map(e => {
            const m = document.createElement('span'); m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
            e.appendChild(m); const y = m.getBoundingClientRect().top; m.remove(); return y; })''')
        self.assertEqual(len(lijnen), 3)
        self.assertLess(max(lijnen) - min(lijnen), 1.0, lijnen)
        # lettergroottes als het origineel naast elkaar gelegd (Robin, 26 nov)
        pt = lambda sel: k.locator(sel).first.evaluate('e => parseFloat(getComputedStyle(e).fontSize) * 0.75')
        self.assertGreaterEqual(pt('.kdatum .kv'), 13.9)
        self.assertGreaterEqual(pt('.kkop .kl'), 12.9)
        self.assertGreaterEqual(pt('.kkop .kcode'), 12.9)
        self.assertGreaterEqual(pt('.kvoet'), 10.9)
        # gemeten aan het origineel op gelijke breedte (Robin, 26 nov): kop 30,5 mm, datumrij 10 mm, lijnen 1,4 mm
        p.wait_for_timeout(300)
        B = k.bounding_box()['width']
        mm = B / 200                                           # 200 × 140 (A5-sleeve), maten schalen mee met de breedte
        for deel, maat in [('.krij.kkopr', 31.2), ('.krij.kdatum', 10.2)]:
            self.assertAlmostEqual(k.locator(deel).bounding_box()['height'] / mm, maat, delta=0.6, msg=deel)
        lijn = k.evaluate('e => parseFloat(getComputedStyle(e).getPropertyValue("--l"))')
        self.assertAlmostEqual(lijn, 1.4, delta=0.1)
        p.locator('#makenVelden input[name="__aantal"]').fill('2')
        p.locator('#makenOpVel').click()
        expect(p.locator('#vellen .a4')).to_have_count(1)
        expect(p.locator('#vellen .a4 .signb.kist')).to_have_count(2)
        self.assertEqual(self.fouten, [])

    def test_kist_lange_lijst_past(self):
        """Veel regels: twee kolommen; lange namen lopen door op een volgende regel. Alles blijft zichtbaar."""
        p = self.pagina
        self.kies('kist')
        p.locator('#makenVelden input[name="Naam"]').fill('Grote kabelkist')
        regels = ['%d Speakon 4p verlengkabel %d meter zwart met extra lange omschrijving erachter' % (n + 1, n + 1) for n in range(26)]
        p.locator('#makenVelden textarea[name="Inhoud"]').fill('\n'.join(regels))
        k = p.locator('#makenVoorbeeld .signb.kist')
        expect(k.locator('.kr')).to_have_count(26)
        expect(k.locator('.kgrid.twee')).to_have_count(1)
        p.wait_for_timeout(800)
        vak = k.locator('.kinhoud').bounding_box()
        laatste = k.locator('.kr').last.bounding_box()
        self.assertLessEqual(laatste['y'] + laatste['height'], vak['y'] + vak['height'] + 1, 'laatste regel valt eraf')
        self.assertEqual(k.locator('.kt').evaluate_all('l => l.filter(e => e.scrollWidth > e.clientWidth + 1).length'), 0, 'tekst afgekapt')

    def test_projectsticker_past(self):
        """Projectsticker = Citizen-label 76 × 56 mm: het vak moet minstens zo groot zijn (klassiek heeft er geen)."""
        p = self.pagina
        for soort in ['kist-modern']:
            self.kies(soort)
            p.locator('#makenVelden input[name="Naam"]').fill('Kist')
            b = p.locator('#makenVoorbeeld .signb')
            expect(b.locator('.ksticker')).to_have_count(1)
            p.wait_for_timeout(300)
            mm = b.bounding_box()['width'] / 194
            st = b.locator('.ksticker').bounding_box()
            self.assertGreaterEqual(st['width'] / mm, 76, soort)
            self.assertGreaterEqual(st['height'] / mm, 56, soort)

    def test_kist_opzoeken_op_naam_vult_inhoud(self):
        """Kist op naam opzoeken (artikel heeft een eigen QR): inhoud van de eerste kist, met de QR van die kist."""
        p = self.pagina
        p.evaluate("""async () => { const { openOpslag } = await import('./js/opslag.js'); const o = await openOpslag('dsl');
          await o.vervangAlle('artikelen', [{ id: '*GE5000', waarde: { id: '*GE5000', naam: '4 x Shure PSM900 [Case]', code: '*GE5000', qr: '1013369',
            exemplaren: ['1013368'], pad: 'Materialen / Geluid', map: 'Geluid', locatie: '', soort: 'serie', type: 'Combinatie', combinatie: true, aantal: 1,
            kisten: { '1013368': { nr: 'DSL01', inhoud: '4 Shure IEM PSM900 P9T', gewicht: '12,89' } } } }]); }""")
        p.reload()
        p.wait_for_selector('body[data-klaar="1"]')
        # Soort blijft op Automatisch: een kist met bekende inhoud krijgt vanzelf het materiaalbordje
        p.locator('#makenZoek').fill('PSM900')
        p.locator('#makenTreffers li').first.click()
        expect(p.locator('#makenVelden textarea[name="Inhoud"]')).to_have_value('4 Shure IEM PSM900 P9T')
        expect(p.locator('#makenVelden input[name="__qr"]')).to_have_value('1013368')
        expect(p.locator('#makenVoorbeeld .signb.kist .kt')).to_have_text(['Shure IEM PSM900 P9T'])

    def test_extra_inhoud_onthouden_per_kisttype(self):
        """Wat niet in de export staat (bulk) vul je één keer aan; het wordt onthouden voor dat type kist."""
        p = self.pagina
        zet = """async () => { const { openOpslag } = await import('./js/opslag.js'); const o = await openOpslag('dsl');
          await o.vervangAlle('artikelen', [{ id: '*GE2162', waarde: { id: '*GE2162', naam: 'Martin Audio 2x DD6 Speaker [Case]', code: '*GE2162', qr: '1016954',
            exemplaren: ['*GE2162-01', '*GE2162-02'], pad: 'Materialen / Geluid', map: 'Geluid', locatie: '', soort: 'serie', type: 'Combinatie', combinatie: true, aantal: 2,
            kisten: { '*GE2162-01': { nr: 'DSL01', inhoud: '2 Martin Audio DD6', gewicht: '27,34' }, '*GE2162-02': { nr: 'DSL02', inhoud: '2 Martin Audio DD6', gewicht: '' } } } }]); }"""
        p.evaluate(zet)
        p.reload()
        p.wait_for_selector('body[data-klaar="1"]')
        p.locator('#makenZoek').fill('DD6')
        p.locator('#makenTreffers li').first.click()
        # één veld Inhoud: aanpassen = onthouden voor dit artikel (Robin, 26 nov)
        expect(p.locator('#makenVelden textarea[name="Extra inhoud"]')).to_have_count(0)
        inhoud = p.locator('#makenVelden textarea[name="Inhoud"]')
        expect(inhoud).to_have_value('2 Martin Audio DD6')
        inhoud.fill('2 Martin Audio DD6\n2 Speakon kabel 10m\n1 Regenhoes')
        inhoud.blur()
        expect(p.locator('#makenVoorbeeld .signb.kist .kt')).to_have_text(['Martin Audio DD6', 'Speakon kabel 10m', 'Regenhoes'])
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        self.assertEqual(self.losse([]), [])                 # gewone artikelregel, geen eigen versie
        # later, ander exemplaar: de aanvulling staat er al
        p.reload()
        p.wait_for_selector('body[data-klaar="1"]')
        p.locator('#makenZoek').fill('*GE2162-02')
        p.locator('#makenZoek').press('Enter')
        expect(p.locator('#makenVelden textarea[name="Inhoud"]')).to_have_value('2 Martin Audio DD6\n2 Speakon kabel 10m\n1 Regenhoes')
        expect(p.locator('#makenVoorbeeld .signb.kist .kt')).to_have_text(['Martin Audio DD6', 'Speakon kabel 10m', 'Regenhoes'])
        self.assertEqual(self.fouten, [])

    def test_modern_kistnummer_bescheiden(self):
        """Modern: kistnummer niet groot naast de naam, maar klein rechts bij het gewicht; lange naam krijgt de hele breedte."""
        p = self.pagina
        self.kies('kist-modern')
        p.locator('#makenVelden input[name="Naam"]').fill('Martin Audio 2x LE1200s L/R Monitor Speaker [Case]')
        p.locator('#makenVelden input[name="Kistnummer"]').fill('DSL01')
        k = p.locator('#makenVoorbeeld .signb.kist-modern')
        expect(k.locator('.kkop .knr')).to_have_count(0)
        expect(k.locator('.krechts')).to_contain_text('DSL01')
        p.wait_for_timeout(600)
        kop = k.locator('.kkop').bounding_box()['width']
        self.assertGreater(k.locator('.kkop .titel').bounding_box()['width'], kop * 0.95)

    def test_kist_bw1000_ronde_hoeken_en_sticker_past(self):
        """B&W type 1000: klein bordje met ronde hoeken; projectsticker (76 × 56) en inhoud passen binnen het bordje."""
        p = self.pagina
        self.kies('kist-bw1000')
        p.locator('#makenVelden input[name="Naam"]').fill('Shure ULXD4 ontvanger')
        p.locator('#makenVelden textarea[name="Inhoud"]').fill('1 ULXD4\n2 antenne\n1 voeding')
        k = p.locator('#makenVoorbeeld .signb.kist-modern')
        expect(k).to_have_css('border-top-left-radius', re.compile(r'^2[0-9]\.'))   # 6 mm ≈ 22,7 px
        # zwart-wit: zwarte band, geen blauw meer op het bordje (Robin, 24 nov)
        kleuren = k.evaluate('''e => [...e.querySelectorAll('*')].flatMap(x => { const c = getComputedStyle(x); return [c.color, c.backgroundColor]; })
            .filter(c => { const m = c.match(/\\d+/g); return m && m.length >= 3 && !(m[0] === m[1] && m[1] === m[2]); })''')
        self.assertEqual(kleuren, [])
        p.wait_for_timeout(600)
        bb = k.bounding_box()
        st = k.locator('.ksticker').bounding_box()
        self.assertAlmostEqual(st['width'] / bb['width'], 76 / 150, delta=0.005)   # precies de Citizen-sticker
        self.assertAlmostEqual(st['height'] / bb['height'], 56 / 87, delta=0.005)
        expect(k.locator('.ft')).to_have_count(1)   # voettekst ook op de B&W-bordjes (Robin, 24 nov)
        p.wait_for_timeout(300)
        ft = k.locator('.ft').bounding_box()
        for deel in ['.ksticker', '.kgrid', '.kbot']:   # niets loopt over de voetlijn
            b = k.locator(deel).bounding_box()
            self.assertLessEqual(b['y'] + b['height'], ft['y'] + 0.5, deel)
        expect(k.locator('.ft')).to_contain_text('Schagen')
        for el in [st, k.locator('.ft').bounding_box(), k.locator('.kgrid').bounding_box(), k.locator('.kbot').bounding_box()]:
            self.assertLessEqual(el['y'] + el['height'], bb['y'] + bb['height'] + 0.5)
            self.assertLessEqual(el['x'] + el['width'], bb['x'] + bb['width'] + 0.5)
        self.assertEqual(self.fouten, [])

    def test_speakertas_zonder_sticker_met_inhoud(self):
        """Speakertas-kaartje: moderne stijl met inhoud, gewicht en QR, gatmarkering, geen projectsticker."""
        p = self.pagina
        self.kies('speakertas')
        p.locator('#makenVelden input[name="Naam"]').fill('d&b E8 speakertas')
        p.locator('#makenVelden input[name="Gewicht"]').fill('9,4')
        p.locator('#makenVelden textarea[name="Inhoud"]').fill('1 d&b E8\n1 regenhoes')
        p.locator('#makenVelden input[name="__qr"]').fill('e8-tas-03')
        k = p.locator('#makenVoorbeeld .signb.kist-modern')
        expect(k.locator('.ksticker')).to_have_count(0)
        expect(k.locator('.kt')).to_have_text(['d&b E8', 'regenhoes'])
        expect(k.locator('.kgew')).to_contain_text('9,4 kg')
        expect(k.locator('.qq')).to_have_count(1)
        expect(k.locator('.gat')).to_have_count(1)
        p.wait_for_timeout(600)
        bb = k.bounding_box()
        for el in [k.locator('.kgrid').bounding_box(), k.locator('.kbot').bounding_box()]:
            self.assertLessEqual(el['y'] + el['height'], bb['y'] + bb['height'] + 0.5)
            self.assertLessEqual(el['x'] + el['width'], bb['x'] + bb['width'] + 0.5)
        self.assertEqual(self.fouten, [])

    def test_kist_bw6040_sticker_precies_en_alles_past(self):
        """B&W type 6040: ronde hoeken, stickervak precies 76 × 56, inhoud en QR binnen het bordje."""
        p = self.pagina
        self.kies('kist-bw6040')
        p.locator('#makenVelden input[name="Naam"]').fill('Allen & Heath SQ-5 mengtafel')
        p.locator('#makenVelden input[name="Gewicht"]').fill('21')
        p.locator('#makenVelden textarea[name="Inhoud"]').fill('1 SQ-5\n1 voedingskabel\n1 lamp\n1 stofhoes')
        p.locator('#makenVelden input[name="__qr"]').fill('sq5-01')
        k = p.locator('#makenVoorbeeld .signb.kist-modern')
        expect(k).to_have_css('border-top-left-radius', re.compile(r'^2[0-9]\.'))
        p.wait_for_timeout(600)
        bb = k.bounding_box()
        st = k.locator('.ksticker').bounding_box()
        self.assertAlmostEqual(st['width'] / bb['width'], 76 / 245, delta=0.005)
        # indeling zoals Robin hem wil (24 nov): nummer, gewicht en QR rechts boven de sticker
        kb = k.locator('.kbot').bounding_box()
        self.assertLessEqual(kb['y'] + kb['height'], st['y'] + 0.5)
        self.assertGreaterEqual(kb['x'] + 0.5, st['x'])
        self.assertAlmostEqual(st['height'] / bb['height'], 56 / 117, delta=0.005)
        expect(k.locator('.ft')).to_have_count(1)   # voettekst ook op de B&W-bordjes (Robin, 24 nov)
        p.wait_for_timeout(300)
        ft = k.locator('.ft').bounding_box()
        for deel in ['.ksticker', '.kgrid', '.kbot']:   # niets loopt over de voetlijn
            b = k.locator(deel).bounding_box()
            self.assertLessEqual(b['y'] + b['height'], ft['y'] + 0.5, deel)
        expect(k.locator('.ft')).to_contain_text('Schagen')
        for el in [st, k.locator('.ft').bounding_box(), k.locator('.kgrid').bounding_box(), k.locator('.qq').bounding_box()]:
            self.assertLessEqual(el['y'] + el['height'], bb['y'] + bb['height'] + 0.5)
            self.assertLessEqual(el['x'] + el['width'], bb['x'] + bb['width'] + 0.5)
        self.assertEqual(self.fouten, [])

    def test_inhoud_vult_de_ruimte_tot_onderin(self):
        """Het Inhoud-veld gebruikt de vrije ruimte onder in het Maken-paneel (Robin, 23 nov)."""
        p = self.pagina
        self.kies('kist-bw6040')
        ta = p.locator('#makenVelden textarea[name="Inhoud"]')
        extra = p.locator('#makenVelden input[name="Naam"]')
        p.wait_for_timeout(300)
        maken = p.locator('#maken').bounding_box()
        h1 = ta.bounding_box()['height']
        self.assertGreater(h1, extra.bounding_box()['height'] * 4)
        laatste = p.evaluate("() => Math.max(...[...document.querySelectorAll('#maken > *')].map(e => e.getBoundingClientRect().bottom))")
        self.assertLess(maken['y'] + maken['height'] - laatste, 40)       # weinig lege ruimte over
        self.assertLessEqual(laatste, maken['y'] + maken['height'] + 1)   # en geen scrollbalk erbij
        # kleiner venster: het veld krimpt weer mee (maar niet onder de gewone hoogte)
        p.set_viewport_size({'width': 1400, 'height': 700})
        p.wait_for_timeout(300)
        self.assertLess(ta.bounding_box()['height'], h1)
        self.assertGreaterEqual(ta.bounding_box()['height'] + 1, extra.bounding_box()['height'])

    def test_concept_blijft_na_f5(self):
        """Na F5 (bijvoorbeeld na een update) staat wat je aan het maken was er nog (Robin, 24 nov)."""
        p = self.pagina
        self.kies('kist-modern')
        p.locator('#makenVelden input[name="Naam"]').fill('Halve kist')
        p.locator('#makenVelden textarea[name="Inhoud"]').fill('1 a\n2 b')
        p.locator('#makenVelden input[name="__aantal"]').fill('3')
        p.locator('#makenVelden input[name="__geenqr"]').check()
        p.wait_for_timeout(500)
        p.reload()
        p.wait_for_function("document.body.dataset.klaar === '1'")
        expect(p.locator('#makenSoort')).to_have_attribute('data-sjabloon', 'kist-modern')
        expect(p.locator('#makenVelden input[name="Naam"]')).to_have_value('Halve kist')
        expect(p.locator('#makenVelden textarea[name="Inhoud"]')).to_have_value('1 a\n2 b')
        expect(p.locator('#makenVelden input[name="__aantal"]')).to_have_value('3')
        expect(p.locator('#makenVelden input[name="__geenqr"]')).to_be_checked()
        # Leegmaken en dan F5: geen oud concept meer
        p.locator('#makenLeeg').click()
        p.wait_for_timeout(500)
        p.reload()
        p.wait_for_function("document.body.dataset.klaar === '1'")
        expect(p.locator('#makenVelden input[name="Naam"]')).to_have_value('')
        self.assertEqual(self.fouten, [])

    def test_concept_met_artikel_blijft_na_f5(self):
        p = self.pagina
        self.inlezen()
        self.opzoeken('CO1120')
        p.locator('#makenVelden input[name="Naam"]').fill('Eigen naam')
        p.wait_for_timeout(500)
        p.reload()
        p.wait_for_function("document.body.dataset.klaar === '1'")
        expect(p.locator('#makenArtikel')).to_contain_text('Kenwood TK-3201 Portofoon')
        expect(p.locator('#makenVelden input[name="Naam"]')).to_have_value('Eigen naam')

    def test_inhoud_met_kopjes_en_notities(self):
        """Inhoud van inhoud: kopjes over de volle breedte, notitie ingesprongen onder het artikel (Robin, 26 nov)."""
        p = self.pagina
        for soort in ['kist', 'kist-modern']:
            self.kies(soort)
            p.locator('#makenVelden input[name="Naam"]').fill('RQ set stage')
            p.locator('#makenVelden textarea[name="Inhoud"]').fill(
                'RQ RACK STAGE\n1 Optocore Festival Box Grand\n2 Sonible ML:mio\nKABELBAK (AW RQ 4HE)\n2 Fiberfox dualcore kabel 30m\n2 Verloop 230V schuko > Powercon\n↳ hoort bij rack')
            k = p.locator('#makenVoorbeeld .signb')
            expect(k.locator('.kr.kop')).to_have_text(['RQ RACK STAGE', 'KABELBAK (AW RQ 4HE)'])
            expect(k.locator('.kr.noot')).to_have_text(['↳ hoort bij rack'])
            expect(k.locator('.kr:not(.kop):not(.noot) .kt')).to_have_count(4)
            p.wait_for_timeout(300)
            kop = k.locator('.kr.kop').first
            self.assertEqual(kop.evaluate('e => getComputedStyle(e).fontWeight'), '700', soort)
            # kopje: zelfde lettertype als de lijst, kleiner dan de naam bovenaan en niet groter dan een lijstregel
            maat = lambda loc: loc.evaluate('e => parseFloat(getComputedStyle(e).fontSize)')
            familie = lambda loc: loc.evaluate('e => getComputedStyle(e).fontFamily')
            regel = k.locator('.kr:not(.kop):not(.noot) .kt').first
            kopt = kop.locator('.kt')
            self.assertEqual(familie(kopt), familie(regel), soort)
            self.assertLess(maat(kopt), maat(regel), soort)
            if soort == 'kist':
                self.assertLess(maat(kopt), maat(k.locator('.kkop .kn span')), soort)
            # notitie begint onder de naam van het artikel erboven, niet onder het aantal
            noot = k.locator('.kr.noot .kt').bounding_box()
            naam = k.locator('.kr:not(.kop):not(.noot) .kt').last.bounding_box()
            self.assertGreaterEqual(noot['x'] + 0.5, naam['x'], soort)
        self.assertEqual(self.fouten, [])

    def test_uitleg_onder_inhoud(self):
        """Korte uitleg van de schrijfwijze staat altijd onder het Inhoud-veld (Robin, 26 nov)."""
        p = self.pagina
        self.kies('kist')
        tip = p.locator('#makenVelden .inhoudtip')
        expect(tip).to_have_count(1)
        expect(tip).to_be_visible()
        for woord in ['kopje', 'notitie', '↳', "'"]:
            expect(tip).to_contain_text(woord)
        ta = p.locator('#makenVelden textarea[name="Inhoud"]').bounding_box()
        self.assertGreaterEqual(tip.bounding_box()['y'], ta['y'] + ta['height'] - 1)   # eronder
        self.kies('bordje-staand')
        expect(p.locator('#makenVelden .inhoudtip')).to_have_count(0)                   # alleen bij een inhoudslijst

    def test_qr_groter_op_a5_materiaalbordjes(self):
        """Robin, 26 nov: QR-code op de A5-materiaalbordjes groter (was 25 en 20 mm), alles blijft binnen het bordje."""
        p = self.pagina
        for soort, minimaal in [('kist', 27.5), ('kist-modern', 27.5)]:
            self.kies(soort)
            p.locator('#makenVelden input[name="Naam"]').fill('Test')
            p.locator('#makenVelden textarea[name="Inhoud"]').fill('\n'.join(f'{n} kabel {n}m' for n in range(1, 13)))
            p.locator('#makenVelden input[name="__qr"]').fill('RQ-STAGE-01')
            p.wait_for_timeout(600)
            k = p.locator('#makenVoorbeeld .signb')
            mm = k.evaluate('s => s.getBoundingClientRect().width / parseFloat(s.style.width)')
            q = k.locator('.qq').bounding_box()
            self.assertGreaterEqual(q['width'] / mm, minimaal, soort)
            # binnen zijn vak en binnen het bordje, niets overlapt de sticker of de voet
            vak = k.locator('.qq').evaluate('e => e.parentElement.getBoundingClientRect().toJSON()')
            self.assertLessEqual(q['x'] + q['width'], vak['right'] + 0.5, soort)
            self.assertLessEqual(q['y'] + q['height'], vak['bottom'] + 0.5, soort)
            bb = k.bounding_box()
            for deel in ['.ksticker', '.kgrid', '.qq']:
                if k.locator(deel).count():
                    b = k.locator(deel).bounding_box()
                    self.assertLessEqual(b['y'] + b['height'], bb['y'] + bb['height'] + 0.5, f'{soort} {deel}')
            if soort == 'kist-modern':
                st = k.locator('.ksticker').bounding_box()
                self.assertLessEqual(q['y'] + q['height'], st['y'] + 0.5)
                ft = k.locator('.ft').bounding_box()
                self.assertLessEqual(st['y'] + st['height'], ft['y'] + 0.5)
        self.assertEqual(self.fouten, [])

    def test_wandborden_uit_lijst(self):
        """Magazijnindeling uit Excel plakken: één wandbord per code, met wat erin hoort en kleur per zone."""
        p = self.pagina
        self.kies('wandbord-staand')
        p.locator('#makenReeks').click()
        d = p.locator('#aanvulling')
        d.locator('textarea[name="tekst"]').fill('Code\tWat\tWaar\nA1\tVersterkers, rackcases\tLinker pand\nG3\tTorens, takels\tRechter pand\nZ1\tRetour, nog uitpakken\tBij de roldeur')
        d.get_by_role('button', name='Op printvel').click()
        expect(p.locator('#printA4')).to_have_text('Print 3 op A4')
        expect(p.locator('#vellen .signb .titel')).to_have_text(['A1', 'G3', 'Z1'])
        expect(p.locator('#vellen .signb').first).to_contain_text('Versterkers, rackcases')
        expect(p.locator('#vellen .signb .streep').first).to_have_css('background-color', 'rgb(0, 90, 187)')
        expect(p.locator('#vellen .signb .qc').first).to_have_text('A1')
        self.assertEqual(sorted(self.losse()), ['los-wandbord-staand-a1', 'los-wandbord-staand-g3', 'los-wandbord-staand-z1'])
        # nog eens plakken: bijwerken, geen dubbele items
        p.locator('#velLeeg').click()
        self.kies('wandbord-staand') if p.locator('#makenReeks').count() == 0 else None
        p.locator('#makenReeks').click()
        d.locator('textarea[name="tekst"]').fill('A1\tVersterkers')
        d.get_by_role('button', name='Op printvel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        self.assertEqual(len(self.losse()), 3)
        self.assertEqual(self.fouten, [])

    def test_stellingborden_uit_lijst(self):
        p = self.pagina
        self.kies('stellingbord')
        p.locator('#makenReeks').click()
        d = p.locator('#aanvulling')
        expect(d.locator('input[name="kleur"]')).to_have_count(0)      # kleur per zone zit in het sjabloon
        d.locator('textarea[name="tekst"]').fill('A1\tVersterkers, rackcases\nH2\tKabels in gitterboxen')
        d.get_by_role('button', name='Op printvel').click()
        expect(p.locator('#printA4')).to_have_text('Print 2 op A4')
        expect(p.locator('#vellen .signb .titel')).to_have_text(['A1', 'H2'])
        expect(p.locator('#vellen .signb .streep').nth(1)).to_have_css('background-color', 'rgb(0, 176, 80)')
        expect(p.locator('#vellen .signb .qbox')).to_have_count(0)        # stellingbord standaard zonder QR
        p.locator('#velLijst li').nth(1).get_by_role('button', name='Aanpassen').click()
        expect(p.locator('#makenVelden input[name="Inhoud"]')).to_have_value('Kabels in gitterboxen')
        self.assertEqual(self.fouten, [])

    def test_bakbord_naam_code_en_qr(self):
        """Bakbord: naam linksboven, artikelnummer eronder, QR uit het QR-veld en die één keer klein onder de QR."""
        p = self.pagina
        self.inlezen()
        self.kies('bakbord') if p.locator('#makenSoort').count() == 0 else None
        self.opzoeken('GE9402')
        self.kies('bakbord')
        qr = p.locator('#makenVelden input[name="__qr"]')
        expect(qr).to_have_count(1)
        b = p.locator('#makenVoorbeeld .signb')
        expect(b.locator('.titel')).to_have_text('Speakon 4p Verlengkabel 2,5m')
        expect(b.locator('.w-inhoud')).to_have_text('GE9402')
        expect(b.locator('.qc')).to_have_count(1)
        expect(b.locator('.qc')).to_have_text(qr.input_value())
        p.locator('#makenVelden input[name="__aantal"]').fill('6')
        p.locator('#makenOpVel').click()
        expect(p.locator('#vellen .a4')).to_have_count(2)
        expect(p.locator('#vellen .a4').first.locator('.signb')).to_have_count(5)
        self.assertEqual(self.fouten, [])

    def test_bakbord_logo_zoals_strook(self):
        """Bakbord en strook zijn allebei 48 mm hoog: de kleurband met logo moet even breed zijn."""
        p = self.pagina
        maat = {}
        self.inlezen()
        self.opzoeken('GE9402')
        for soort in ['bakbord', 'gitterbox']:
            self.kies(soort)
            b = p.locator('#makenVoorbeeld .signb')
            expect(b.locator('.blg')).to_have_count(1)
            maat[soort] = b.locator('.blg').bounding_box()['width'] / b.bounding_box()['height']
        self.assertAlmostEqual(maat['bakbord'], maat['gitterbox'], delta=0.01)

    def test_qr_overal_hetzelfde(self):
        """Elk sjabloon dezelfde QR-regel: veld QR-code + vinkje Zonder QR-code (Robin, 23 nov)."""
        p = self.pagina
        qr = p.locator('#makenVelden input[name="__qr"]')
        zonder = p.locator('#makenVelden input[name="__geenqr"]')
        b = p.locator('#makenVoorbeeld .signb')
        for soort in ['bordje-staand', 'kist-modern', 'gitterbox', 'wandbord-staand', 'stellingbord', 'kist-bw1000']:
            self.kies(soort)
            expect(qr).to_have_count(1)
            expect(zonder).to_have_count(1)
            expect(p.locator('#makenVelden select[name="QR-code"]')).to_have_count(0)
            expect(p.locator('#makenVelden label', has=p.locator('input[name="__qr"]'))).to_contain_text('QR-code')
        # gewoon bordje: zelf invullen; vinkje haalt hem weg en zet hem terug
        self.kies('bordje-staand')
        p.locator('#makenVelden input[name="Naam"]').fill('Test')
        qr.fill('abc-1')
        expect(b.locator('.qbox')).to_have_count(1)
        zonder.check()
        expect(b.locator('.qbox')).to_have_count(0)
        expect(qr).to_be_disabled()
        zonder.uncheck()
        expect(qr).to_have_value('abc-1')
        expect(b.locator('.qbox')).to_have_count(1)
        # wandbord: de QR volgt de locatie
        for soort in ['wandbord-staand', 'wandbord-liggend']:
            self.kies(soort)
            p.locator('#makenVelden input[name="Locatie"]').fill('B4')
            expect(qr).to_have_value('B4')
            expect(qr).to_be_disabled()
            expect(b.locator('.qbox')).to_have_count(1)
            zonder.check()
            expect(b.locator('.qbox')).to_have_count(0)
            expect(b).not_to_contain_text('Geen QR-code')
            zonder.uncheck()
            expect(b.locator('.qbox')).to_have_count(1)
        # stellingbord: standaard zonder QR, aan te zetten
        self.kies('stellingbord')
        p.locator('#makenVelden input[name="Locatie"]').fill('A1')
        expect(zonder).to_be_checked()
        expect(b.locator('.qbox')).to_have_count(0)
        zonder.uncheck()
        expect(b.locator('.qbox')).to_have_count(1)
        expect(qr).to_have_value('A1')
        self.assertEqual(self.fouten, [])

    def test_kist_scannen_vult_inhoud(self):
        """Inhoud en gewicht uit de exemplaren-export: scan de kist, het bordje vult zich."""
        p = self.pagina
        p.evaluate("""async () => { const { openOpslag } = await import('./js/opslag.js'); const o = await openOpslag('dsl');
          await o.vervangAlle('artikelen', [{ id: '*GE2162', waarde: { id: '*GE2162', naam: 'Martin Audio 2x DD6 Speaker [Case]', code: '*GE2162', qr: '',
            exemplaren: ['*GE2162-01', '*GE2162-02'], pad: 'Materialen / Geluid', map: 'Geluid', locatie: '', soort: 'serie', type: 'Combinatie', combinatie: true, aantal: 2,
            kisten: { '*GE2162-01': { nr: 'DSL01', inhoud: '2 Martin Audio DD6\\n1 Flightcase DD6', gewicht: '27,34' } } } }]); }""")
        p.reload()
        p.wait_for_selector('body[data-klaar="1"]')
        self.kies('kist')
        p.locator('#makenZoek').fill('*GE2162-01')
        p.locator('#makenZoek').press('Enter')
        expect(p.locator('#makenVelden textarea[name="Inhoud"]')).to_have_value('2 Martin Audio DD6\n1 Flightcase DD6')
        expect(p.locator('#makenVelden input[name="Kistnummer"]')).to_have_value('DSL01')
        k = p.locator('#makenVoorbeeld .signb.kist')
        expect(k.locator('.kt')).to_have_text(['Martin Audio DD6', 'Flightcase DD6'])
        expect(k).to_contain_text('27,34 kg')
        self.assertEqual(self.fouten, [])

    def test_lengte_en_hoogte_onder_elkaar(self):
        p = self.pagina
        for soort, eerste in [('pipe-drape', 'Lengte'), ('backdrop', 'Breedte')]:
            self.kies(soort)
            a = p.locator('#makenVelden input[name="%s"]' % eerste).bounding_box()
            h = p.locator('#makenVelden input[name="Hoogte"]').bounding_box()
            self.assertAlmostEqual(a['x'], h['x'], delta=1, msg=soort)
            self.assertGreater(h['y'], a['y'], soort)

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
        for soort in ['qrlabel', 'kist', 'kist-modern']:   # materiaalbordje modern is altijd DSL blauw
            self.kies(soort)
            expect(p.locator('#makenVelden select[name="Randkleur"]')).to_have_count(0)


class MakenPast(MakenHulp, PaginaTest):
    """Laptop met 125% schaal (1536×740 zichtbaar): het formulier past zonder scrollen."""
    viewport = {'width': 1536, 'height': 740}

    def test_formulier_past_zonder_scrollen(self):
        p = self.pagina
        self.kies('leeg-staand')
        maat = p.evaluate("""() => { const m = document.getElementById('maken'); return [m.scrollHeight, m.clientHeight]; }""")
        self.assertLessEqual(maat[0], maat[1] + 1, 'Maken-formulier moet scrollen: %r' % maat)
        expect(p.locator('#makenOpVel')).to_be_in_viewport()

    def test_focusrand_valt_niet_weg(self):
        """De oranje focusrand (2px + 2px afstand) mag niet door de rand van het formulier worden afgesneden."""
        p = self.pagina
        self.kies('leeg-staand')
        for veld in ['#makenSoort', '#makenZoek', '#makenVelden input[name="Groot"]', '#makenVelden input[name="Naam"]']:
            p.locator(veld).focus()
            ruimte = p.evaluate("""(sel) => { const m = document.getElementById('maken'), e = document.querySelector(sel);
              const a = m.getBoundingClientRect(), b = e.getBoundingClientRect();
              return Math.min(b.left - a.left - m.clientLeft, (a.left + m.clientLeft + m.clientWidth) - b.right, b.top - a.top + m.scrollTop); }""", veld)
            self.assertGreaterEqual(ruimte, 4, veld)

    def test_printvel_krijgt_de_ruimte(self):
        """Is het formulier leeg (bijv. na Op printvel), dan krijgt het printvel de hele kolom; nooit zijwaarts scrollen."""
        p = self.pagina
        self.kies('pipe-drape')
        p.locator('#makenVelden input[name="Naam"]').fill('Pipe & drape doek')
        p.locator('#makenVelden input[name="Lengte"]').fill('4')
        p.locator('#makenVelden input[name="Hoogte"]').fill('3')
        expect(p.locator('#makenVak')).to_be_visible()
        p.locator('#makenOpVel').click()
        expect(p.locator('#printA4')).to_have_text('Print 1 op A4')
        expect(p.locator('#makenVak')).to_be_visible()     # label blijft staan
        p.locator('#makenLeeg').click()
        expect(p.locator('#makenVak')).to_be_hidden()
        p.wait_for_timeout(600)
        kolom = p.locator('#voorbeeld').bounding_box()['height']
        self.assertGreater(p.locator('#vellen').bounding_box()['height'], kolom * 0.75)
        self.assertLessEqual(p.evaluate("(() => { const v = document.getElementById('vellen'); return v.scrollWidth - v.clientWidth; })()"), 1)

    def test_voorbeeld_staat_in_voorbeeldkolom(self):
        p = self.pagina
        self.kies('leeg-staand')
        p.locator('#makenVelden input[name="Naam"]').fill('Kist')
        expect(p.locator('#voorbeeld #makenVoorbeeld .signb')).to_have_count(1)
        p.locator('#tabLijst').click()
        expect(p.locator('#makenVoorbeeld')).to_be_hidden()
        p.locator('#tabMaken').click()
        expect(p.locator('#makenVoorbeeld')).to_be_visible()
        self.assertEqual(self.fouten, [])


if __name__ == '__main__':
    unittest.main()
