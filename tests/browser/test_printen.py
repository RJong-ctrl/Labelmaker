import os
import re
import subprocess
import tempfile
import unittest

from basis import PaginaTest

PRINT = """async ([printer, items, opties]) => {
    const { sj, opmaak, A } = window.T;
    const printen = await import('./js/printen.js');
    window.print = () => { window.geprint = (window.geprint || 0) + 1; };
    const context = {
        artikelen: new Map(Object.entries(A)), sjablonen: sj.DSL_SJABLONEN, huisstijl: opmaak.HUISSTIJL_DSL,
        aanvullingen: { GE9402: { Doorsnede: '2,5 mm²' }, 'LI8163-B': { Kleur: 'Zwart' } },
    };
    window.__klaar = printen.print(printer, items, context, opties || {});
}"""


def pdf_info(pad):
    uit = subprocess.run(['pdfinfo', pad], capture_output=True, text=True, check=True).stdout
    paginas = int(re.search(r'Pages:\s+(\d+)', uit).group(1))
    b, h = map(float, re.search(r'Page size:\s+([\d.]+) x ([\d.]+) pts', uit).groups())
    return paginas, b / 72 * 25.4, h / 72 * 25.4


class Printen(PaginaTest):
    def setUp(self):
        super().setUp()
        self.laad_voorbeeld()

    def printen(self, printer, items, opties=None, knop='Printen'):
        p = self.pagina
        p.evaluate(PRINT, [printer, items, opties])
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
