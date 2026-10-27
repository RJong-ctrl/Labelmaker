import json
import os
import unittest

from playwright.sync_api import expect

from basis import ROOT, PaginaTest


class Overstap(PaginaTest):
    pad = '/'
    basis_blokkeren = False

    def test_hoofdadres_opent_v2(self):
        p = self.pagina
        p.wait_for_url('**/v2/')
        expect(p.locator('#printLabel')).to_be_visible()
        expect(p.locator('#melding')).to_contain_text('Basis van')
        expect(p.locator('#aantalArtikelen')).to_contain_text('in totaal')
        n = int(p.locator('#aantalArtikelen').inner_text().split()[0])
        self.assertGreaterEqual(n, 4000)

    def test_beheer_link_blijft_werken(self):
        p = self.pagina
        p.goto(self.basis + '/#beheer')
        p.wait_for_url('**/v2/#beheer')
        expect(p.locator('#beheerScherm')).to_be_visible()

    def test_versie_25_op_v1(self):
        p = self.pagina
        p.goto(self.basis + '/v1/')
        self.assertEqual(p.title(), 'DSL Labelmaker')

    def test_basisbestand_veilig(self):
        tekst = open(os.path.join(ROOT, 'v2', 'data', 'dsl.json'), encoding='utf-8').read()
        basis = json.loads(tekst)
        self.assertEqual(basis['type'], 'labelmaker-basis')
        mag = {'id', 'combinatie', 'sjabloon', 'naam', 'code', 'qr', 'exemplaren', 'pad', 'map', 'locatie', 'soort', 'type', 'aantal', 'kisten'}
        for a in basis['artikelen']:
            self.assertTrue(set(a) <= mag, set(a) - mag)
            for kist in a.get('kisten', {}).values():   # per kist alleen nummer, inhoud en gewicht
                self.assertEqual(set(kist), {'nr', 'inhoud', 'gewicht'})
        for woord in ('prijs', 'Opmerking intern', 'pincode', 'Boekwaarde', 'Nieuwprijs'):
            self.assertNotIn(woord, tekst)
        ok = self.pagina.evaluate("""async (t) => { const { leesBasis } = await import('/v2/js/publiceren.js'); return !leesBasis(t).fout; }""", tekst)
        self.assertTrue(ok)


if __name__ == '__main__':
    unittest.main()


class HoofdadresOffline(PaginaTest):
    service_workers = 'allow'

    def test_hoofdadres_opent_offline(self):
        p = self.pagina
        p.evaluate("""async () => {
            for (let i = 0; i < 100; i++) {
                const r = await navigator.serviceWorker.getRegistration('/');
                const v2 = await navigator.serviceWorker.getRegistration('/v2/');
                if (r?.active && r.scope.endsWith('/') && !r.scope.endsWith('/v2/') && v2?.active) return;
                await new Promise(z => setTimeout(z, 100));
            }
            throw new Error('service workers niet actief');
        }""")
        p.reload()
        p.goto(self.basis + '/')
        p.wait_for_url('**/v2/')
        self.context.set_offline(True)
        self.server.shutdown()
        self.server.server_close()
        p.goto(self.basis + '/')
        p.wait_for_url('**/v2/')
        expect(p.locator('#printLabel')).to_be_visible()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
