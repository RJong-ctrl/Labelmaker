import json
import unittest

from playwright.sync_api import expect

from basis import PaginaTest

OPZET = """async (profielId) => {
    const { GeheugenOpslag } = await import('./js/opslag.js');
    const { laadModel } = await import('./js/model.js');
    const { beheerOnderdelen } = await import('./js/beheer-extra.js');
    const o = new GeheugenOpslag();
    const m = await laadModel(o, profielId);
    await m.zetArtikelen(Object.values(window.T.A));
    await m.zetPcInstelling('pincode', '4321');
    await m.zetAanvulling('GE9402', { Doorsnede: '4 mm²' });
    window.M = m;
    document.body.innerHTML = '<div id="doel"></div>';
    window.O = Object.fromEntries(beheerOnderdelen(document, m, { profielId, herlaad: () => { window.herladen = true; } }).map(x => [x.id, x]));
}"""


class BeheerExtra(PaginaTest):
    app_starten = False

    def setUp(self):
        super().setUp()
        self.laad_voorbeeld()
        self.pagina.evaluate(OPZET, 'dsl')

    def teken(self, id_):
        self.pagina.evaluate("(id) => window.O[id].teken(document.getElementById('doel'))", id_)

    def test_publiceren_download(self):
        p = self.pagina
        self.teken('publiceren')
        with p.expect_download() as dl:
            p.get_by_role('button', name='Publicatiebestand maken').click()
        self.assertEqual(dl.value.suggested_filename, 'dsl.json')
        tekst = open(dl.value.path(), encoding='utf-8').read()
        self.assertNotIn('4321', tekst)
        self.assertNotIn('GEHEIM', tekst)
        ok = p.evaluate("""async (t) => { const { leesBasis } = await import('./js/publiceren.js'); const r = leesBasis(t); return [!r.fout, r.basis && r.basis.artikelen.length, r.basis && r.basis.aanvullingen.GE9402.Doorsnede]; }""", tekst)
        self.assertEqual(ok, [True, 9, '4 mm²'])
        expect(p.locator('#doel')).to_contain_text('9 artikelen')

    def test_profiel_export_import(self):
        p = self.pagina
        p.evaluate("async () => { await window.M.zetSjabloon({ ...window.M.effectief().sjablonen[0], id: 'kist', naam: 'Kist' }); }")
        self.teken('profielen')
        with p.expect_download() as dl:
            p.locator('li[data-id="dsl"]').get_by_role('button', name='Exporteren').click()
        bestand = dl.value.path()
        p.locator('input[name="import"]').set_input_files(bestand)
        expect(p.locator('#doel')).to_contain_text('DSL (2)')
        sj = p.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            const { laadModel } = await import('./js/model.js');
            const m = await laadModel(await openOpslag('dsl-2'), 'dsl-2', 'dsl');
            return m.effectief().sjablonen.map(s => s.id);
        }""")
        self.assertIn('kist', sj)
        self.assertNotIn('4321', open(bestand, encoding='utf-8').read())

    def test_profiel_import_rommel(self):
        p = self.pagina
        self.teken('profielen')
        p.locator('input[name="import"]').set_input_files({'name': 'x.json', 'mimeType': 'application/json', 'buffer': b'{"type":"iets"}'})
        expect(p.locator('#doel')).to_contain_text('Dit is geen profielbestand van de Labelmaker.')

    def test_v25_overnemen_uit_browser(self):
        p = self.pagina
        fixture = json.load(open('tests/fixtures/v25-voorbeeld.json', encoding='utf-8'))
        p.evaluate("""(f) => {
            const sleutels = f.localStorage || {};
            for (const [k, v] of Object.entries(sleutels)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        }""", fixture)
        self.teken('v25')
        p.get_by_role('button', name='Uit deze browser overnemen').click()
        expect(p.locator('.v25-resultaat')).to_contain_text('gevonden')
        p.get_by_role('button', name='Overnemen').click()
        expect(p.locator('.v25-resultaat')).to_contain_text('Overgenomen')
        r = p.evaluate("""() => { const e = window.M.effectief(); return [e.losseItems.length, e.sjablonen.find(s => s.id === 'backdrop').kleuren.rand.waarden['6×3,5']]; }""")
        self.assertGreater(r[0], 0)
        self.assertEqual(r[1], '#b000b0')


if __name__ == '__main__':
    unittest.main()
