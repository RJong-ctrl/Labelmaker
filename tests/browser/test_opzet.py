import unittest

from basis import PaginaTest


class Opzet(PaginaTest):
    def test_v2_laadt_met_printknoppen_rechtsboven(self):
        p = self.pagina
        self.assertEqual(p.title(), 'Labelmaker')
        knoppen = p.locator('header .print button.primary')
        self.assertEqual(knoppen.count(), 2)
        p.wait_for_function("document.querySelector('#printLabel').textContent.includes('Citizen')")
        self.assertEqual(knoppen.nth(0).inner_text().strip(), 'Print 0 op Citizen')
        self.assertEqual(knoppen.nth(1).inner_text().strip(), 'Print 0 op A4')
        self.assertTrue(knoppen.nth(0).is_disabled())
        self.assertTrue(knoppen.nth(1).is_disabled())
        rechts = knoppen.nth(1).bounding_box()
        self.assertLessEqual(self.viewport['width'] - (rechts['x'] + rechts['width']), 40)
        self.assertLess(rechts['y'], 80, 'printknop hoort bovenin')
        self.assertEqual(self.fouten, [])


if __name__ == '__main__':
    unittest.main()
