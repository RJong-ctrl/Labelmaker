import os
import re
import subprocess
import tempfile
import unittest

from basis import PaginaTest

PRINT = """async ([printer, items, opties, extra]) => {
    const { sj, opmaak, A } = window.T;
    const printen = await import('./js/printen.js');
    window.print = () => { window.geprint = (window.geprint || 0) + 1; };
    const context = {
        artikelen: new Map(Object.entries(A)), sjablonen: sj.DSL_SJABLONEN, huisstijl: opmaak.HUISSTIJL_DSL,
        aanvullingen: { GE9402: { Doorsnede: '2,5 mm²' }, 'LI8163-B': { Kleur: 'Zwart' } },
        ...extra,
    };
    window.__klaar = printen.print(printer, items, context, opties || {});
}"""


def pdf_info(pad):
    uit = subprocess.run(['pdfinfo', pad], capture_output=True, text=True, check=True).stdout
    paginas = int(re.search(r'Pages:\s+(\d+)', uit).group(1))
    b, h = map(float, re.search(r'Page size:\s+([\d.]+) x ([\d.]+) pts', uit).groups())
    return paginas, b / 72 * 25.4, h / 72 * 25.4


class Printen(PaginaTest):
    app_starten = False

    def setUp(self):
        super().setUp()
        self.laad_voorbeeld()

    def printen(self, printer, items, opties=None, knop='Printen', context=None):
        p = self.pagina
        p.evaluate(PRINT, [printer, items, opties, context or {}])
        balk = p.locator('#printbalk')
        balk.wait_for(state='visible')
        tekst = balk.inner_text()
        balk.get_by_role('button', name=knop).click()
        gelukt = p.evaluate('window.__klaar')
        pad = os.path.join(tempfile.mkdtemp(), 'uit.pdf')
        if gelukt:
            p.pdf(path=pad, prefer_css_page_size=True, print_background=True)
        return tekst, gelukt, pad

    def test_tweehonderd_stroken_paginering(self):
        tekst, gelukt, pad = self.printen('a4', [{'sjabloon': 'gitterbox', 'artikel': 'GE9402', 'qr': 'nl4-2.50m', 'aantal': 200}])
        self.assertIn('Kies je A4-printer', tekst)
        self.assertTrue(gelukt)
        self.assertEqual(self.pagina.evaluate('window.geprint'), 1)
        paginas, b, h = pdf_info(pad)
        self.assertEqual(paginas, 40)
        self.assertAlmostEqual(b, 210, delta=0.5)
        self.assertAlmostEqual(h, 297, delta=0.5)
        self.assertEqual(self.fouten, [])

    def test_formaten_op_eigen_vel(self):
        items = [{'sjabloon': 'gitterbox', 'artikel': 'GE9402', 'qr': 'nl4-2.50m', 'aantal': 1},
                 {'sjabloon': 'backdrop', 'artikel': 'LI8163-B', 'qr': 'bd6x3b-01', 'aantal': 1},
                 {'sjabloon': 'pipe-drape', 'artikel': 'PD5143', 'qr': '1004421', 'aantal': 5}]
        _, _, pad = self.printen('a4', items)
        self.assertEqual(pdf_info(pad)[0], 4)  # strook 1, backdrop 1, P&D 5 → 4 per vel = 2
        snij = self.pagina.locator('#drukwerk .a4 .snijtekens').count()
        self.assertEqual(snij, 4)

    def test_citizen_formaat(self):
        tekst, _, pad = self.printen('label', [{'sjabloon': 'qrlabel', 'artikel': 'GE9402', 'qr': 'nl4-2.50m', 'aantal': 3}])
        self.assertIn('Kies printer: Citizen CL-E321', tekst)
        paginas, b, h = pdf_info(pad)
        self.assertEqual(paginas, 3)
        self.assertAlmostEqual(b, 76, delta=0.5)
        self.assertAlmostEqual(h, 56, delta=0.5)

    def test_ander_labelformaat(self):
        printers = {'label': {'naam': 'Zebra ZD421', 'b': 100, 'h': 50}, 'a4': {'naam': 'Kantoorprinter'}}
        tekst, gelukt, pad = self.printen('label', [{'sjabloon': 'qrlabel', 'artikel': 'GE9402', 'qr': 'nl4-2.50m', 'aantal': 3}],
                                          context={'printers': printers})
        self.assertTrue(gelukt)
        self.assertIn('Kies printer: Zebra ZD421', tekst)
        self.assertNotIn('Citizen', tekst)
        paginas, b, h = pdf_info(pad)
        self.assertEqual(paginas, 3)
        self.assertAlmostEqual(b, 100, delta=0.5)
        self.assertAlmostEqual(h, 50, delta=0.5)
        self.assertIn('100mm 50mm', self.pagina.locator('#papier').inner_text())
        maat = self.pagina.evaluate("""() => { const p = document.querySelector('#drukwerk .pagina'); return [p.style.width, p.style.height]; }""")
        self.assertEqual(maat, ['100mm', '50mm'])
        self.assertEqual(self.fouten, [])

    def test_halve_labels_drempel_is_halve_hoogte_van_de_printer(self):
        half = [{'sjabloon': 'qrlabel-half', 'artikel': 'CO1120', 'qr': 'kenporto-00', 'aantal': 3}]  # 28 mm hoog
        # label 56 hoog: twee van 28 op één label (bestaand gedrag) -> 2
        _, _, pad = self.printen('label', half, context={'printers': {'label': {'naam': 'X', 'b': 76, 'h': 56}}})
        self.assertEqual(pdf_info(pad)[0], 2)
        # label 50 hoog: 28 > 25, dus elk op een eigen label -> 3
        _, _, pad = self.printen('label', half, context={'printers': {'label': {'naam': 'X', 'b': 76, 'h': 50}}})
        self.assertEqual(pdf_info(pad)[0], 3)
        # label 60 hoog: 28 <= 30, twee per label -> 2
        _, _, pad = self.printen('label', half, context={'printers': {'label': {'naam': 'X', 'b': 76, 'h': 60}}})
        self.assertEqual(pdf_info(pad)[:1], (2,))

    def test_a4_melding_zonder_printernaam_en_ongeldig_formaat_valt_terug(self):
        printers = {'label': {'naam': 'Zebra', 'b': 'abc', 'h': -5}, 'a4': {'naam': 'Kantoorprinter'}}
        tekst, _, pad = self.printen('a4', [{'sjabloon': 'gitterbox', 'artikel': 'GE9402', 'qr': 'x', 'aantal': 1}],
                                     context={'printers': printers})
        self.assertIn('Kies je A4-printer', tekst)
        self.assertNotIn('Kantoorprinter', tekst)
        _, b, h = pdf_info(pad)
        self.assertAlmostEqual(b, 210, delta=0.5)
        self.assertAlmostEqual(h, 297, delta=0.5)
        tekst, _, pad = self.printen('label', [{'sjabloon': 'qrlabel', 'artikel': 'GE9402', 'qr': 'x', 'aantal': 1}],
                                     context={'printers': printers})
        self.assertIn('Kies printer: Zebra', tekst)
        _, b, h = pdf_info(pad)    # ongeldige maat: standaard 76 x 56
        self.assertAlmostEqual(b, 76, delta=0.5)
        self.assertAlmostEqual(h, 56, delta=0.5)

    def test_printernaam_blijft_tekst(self):
        naam = '<img src=x onerror="window.kwaad=1">Zebra'
        tekst, _, _ = self.printen('label', [{'sjabloon': 'qrlabel', 'artikel': 'GE9402', 'qr': 'x', 'aantal': 1}],
                                   context={'printers': {'label': {'naam': naam, 'b': 76, 'h': 56}}})
        self.assertIn(naam, tekst)
        self.assertEqual(self.pagina.locator('#printbalk img').count(), 0)
        self.assertIsNone(self.pagina.evaluate('window.kwaad'))

    def test_halve_labels_twee_per_label(self):
        _, _, pad = self.printen('label', [{'sjabloon': 'qrlabel-half', 'artikel': 'CO1120', 'qr': 'kenporto-00', 'aantal': 3}])
        paginas, b, h = pdf_info(pad)
        self.assertEqual(paginas, 2)
        self.assertAlmostEqual(h, 56, delta=0.5)

    def test_alleen_eerste(self):
        _, _, pad = self.printen('a4', [{'sjabloon': 'gitterbox', 'artikel': 'GE9402', 'qr': 'nl4-2.50m', 'aantal': 12}], {'alleenEerste': True})
        self.assertEqual(pdf_info(pad)[0], 1)
        _, _, pad = self.printen('label', [{'sjabloon': 'qrlabel', 'artikel': 'GE9402', 'qr': 'x', 'aantal': 3}], {'alleenEerste': True})
        self.assertEqual(pdf_info(pad)[0], 1)

    def test_annuleren_print_niet(self):
        _, gelukt, _ = self.printen('a4', [{'sjabloon': 'gitterbox', 'artikel': 'GE9402', 'qr': 'x', 'aantal': 1}], knop='Annuleren')
        self.assertFalse(gelukt)
        self.assertIsNone(self.pagina.evaluate('window.geprint'))
        self.assertTrue(self.pagina.locator('#printbalk').is_hidden())


if __name__ == '__main__':
    unittest.main()
