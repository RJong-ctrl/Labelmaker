import time
import unittest

from basis import PaginaTest


class Opslag(PaginaTest):
    app_starten = False

    def test_indexeddb_blijft_na_herladen(self):
        p = self.pagina
        t0 = time.time()
        p.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            const o = await openOpslag('test');
            await o.wis('artikelen');
            const items = Array.from({ length: 4000 }, (_, i) => ({ id: 'A' + String(i).padStart(4, '0'), waarde: { naam: 'Artikel ' + i } }));
            await o.schrijfVeel('artikelen', items);
            await o.schrijf('aanvullingen', 'A0001', { Doorsnede: '2,5 mm²' });
        }""")
        p.reload()
        uit = p.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            const o = await openOpslag('test');
            const alle = await o.alle('artikelen');
            const r = { n: alle.length, eerste: alle[0], aanv: await o.lees('aanvullingen', 'A0001'), geen: await o.lees('artikelen', 'X') };
            await o.wis('artikelen', 'A0000');
            r.na = (await o.alle('artikelen')).length;
            return r;
        }""")
        self.assertLess(time.time() - t0, 3)
        self.assertEqual(uit['n'], 4000)
        self.assertEqual(uit['eerste'], {'id': 'A0000', 'waarde': {'naam': 'Artikel 0'}})
        self.assertEqual(uit['aanv'], {'Doorsnede': '2,5 mm²'})
        self.assertIsNone(uit['geen'])
        self.assertEqual(uit['na'], 3999)
        self.assertEqual(self.fouten, [])

    def test_vervang_alle_in_een_keer(self):
        uit = self.pagina.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            const o = await openOpslag('test-v');
            await o.schrijfVeel('artikelen', [{ id: 'oud', waarde: 1 }]);
            await o.vervangAlle('artikelen', [{ id: 'nieuw', waarde: 2 }]);
            return (await o.alle('artikelen')).map(x => x.id);
        }""")
        self.assertEqual(uit, ['nieuw'])

    def test_opslag_upgrade_v1_naar_v2(self):
        uit = self.pagina.evaluate("""async () => {
            await new Promise((ok, fout) => {
                const r = indexedDB.open('labelmaker-oud', 1);
                r.onupgradeneeded = () => { for (const s of ['artikelen', 'aanvullingen', 'printvel', 'printlog', 'instellingen']) r.result.createObjectStore(s); };
                r.onsuccess = () => { const tx = r.result.transaction('artikelen', 'readwrite'); tx.objectStore('artikelen').put({ naam: 'Kabel' }, 'K1'); tx.oncomplete = () => { r.result.close(); ok(); }; };
                r.onerror = fout;
            });
            const { openOpslag } = await import('./js/opslag.js');
            const o = await openOpslag('oud');
            await o.schrijf('sjablonen', 'x', { id: 'x' });
            return [await o.lees('artikelen', 'K1'), (await o.alle('sjablonen')).length, (await o.alle('losse')).length, (await o.alle('basis')).length];
        }""")
        self.assertEqual(uit, [{'naam': 'Kabel'}, 1, 0, 0])

    def test_profielen_gescheiden(self):
        uit = self.pagina.evaluate("""async () => {
            const { openOpslag } = await import('./js/opslag.js');
            const a = await openOpslag('test-a'), b = await openOpslag('test-b');
            await a.schrijf('instellingen', 'x', 1);
            return [await a.lees('instellingen', 'x'), await b.lees('instellingen', 'x')];
        }""")
        self.assertEqual(uit, [1, None])


if __name__ == '__main__':
    unittest.main()
