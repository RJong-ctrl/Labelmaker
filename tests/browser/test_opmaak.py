import unittest

import cv2
import numpy as np

from basis import PaginaTest

# id, sjabloon, artikelcode, aanvullingen, qr, naam-overschrijving
GEVALLEN = [
    ('strook', 'gitterbox', 'GE9402', {'Doorsnede': '2,5 mm²'}, 'nl4-2.50m', None),
    ('koppelbus', 'gitterbox', 'GE9391', {'Doorsnede': '2,5 mm²'}, 'nl8-koppel', None),
    ('zonderqr', 'gitterbox', 'GE9407', {'Doorsnede': '4 mm²'}, '', None),
    ('wit', 'gitterbox', 'GE9402', {'Doorsnede': '2,5 mm²'}, 'nl4-20m', 'Speakon 4p Verlengkabel 20m'),
    ('backdrop', 'backdrop', 'LI8163-B', {'Kleur': 'Zwart'}, 'bd6x3b-01', None),
    ('pd', 'pipe-drape', 'PD5143', {}, '1004421', None),
    ('qrlabel', 'qrlabel', 'GE9402', {}, 'nl4-2.50m', None),
    ('lang', 'qrlabel', 'GE9509', {}, '1001540', None),
    ('qrhalf', 'qrlabel-half', 'CO1120', {}, 'kenporto-00', None),
    ('locatie', 'locatie', 'GE9402', {}, '', None),
    ('lochalf', 'locatie-half', 'CO1120', {}, '', None),
]
QR_VERWACHT = {'strook': 'nl4-2.50m', 'koppelbus': 'nl8-koppel', 'backdrop': 'bd6x3b-01', 'pd': '1004421',
               'qrlabel': 'nl4-2.50m', 'lang': '1001540', 'qrhalf': 'kenporto-00', 'locatie': 'V-1-2', 'lochalf': 'A1'}

TEKEN = """async (gevallen) => {
    const { opmaak, sj, A, S } = window.T;
    document.body.innerHTML = '';
    document.body.style.cssText = 'background:#ddd;display:flex;flex-wrap:wrap;gap:10px;padding:10px';
    for (const [id, sjabloon, code, aanv, qr, naam] of gevallen) {
        const artikel = naam ? { ...A[code], naam } : A[code];
        const el = opmaak.teken(sj.vul(S[sjabloon], artikel, aanv, qr));
        el.id = id;
        document.body.appendChild(el);
        await opmaak.pasAan(el);
    }
}"""


class Opmaak(PaginaTest):
    app_starten = False

    apparaatschaal = 3

    def setUp(self):
        super().setUp()
        self.laad_voorbeeld()
        self.pagina.evaluate(TEKEN, [list(g[:5]) + [g[5]] for g in GEVALLEN])

    def test_elk_sjabloon_past(self):
        r = self.pagina.evaluate("""() => {
            const fouten = [];
            for (const el of document.body.children) {
                const box = el.getBoundingClientRect();
                if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) fouten.push(el.id + ': bordje loopt over');
                for (const b of el.querySelectorAll('.fb')) {
                    const s = b.firstElementChild;
                    if (!s || !s.textContent) continue;
                    if (s.scrollWidth > b.clientWidth + 1 || s.offsetHeight > b.clientHeight + 1) fouten.push(el.id + ': ' + b.className + ' "' + s.textContent + '"');
                    const r = s.getBoundingClientRect();
                    if (r.right > box.right + 1 || r.bottom > box.bottom + 1) fouten.push(el.id + ': buiten bordje ' + b.className);
                }
                for (const v of el.querySelectorAll('.ft>div')) if (v.scrollWidth > v.clientWidth + 1) fouten.push(el.id + ': voettekst');
                const t = el.querySelector('.titel>span');
                if (t && parseFloat(t.style.fontSize) < 8) fouten.push(el.id + ': titel te klein ' + t.style.fontSize);
            }
            return fouten;
        }""")
        self.assertEqual(r, [])
        self.assertEqual(self.fouten, [])

    def test_formaat_in_mm(self):
        maten = self.pagina.evaluate("""() => Object.fromEntries([...document.body.children].map(e => [e.id, [e.style.width, e.style.height]]))""")
        self.assertEqual(maten['strook'], ['180mm', '48mm'])
        self.assertEqual(maten['backdrop'], ['74mm', '105mm'])
        self.assertEqual(maten['pd'], ['105mm', '74mm'])
        self.assertEqual(maten['qrlabel'], ['76mm', '56mm'])
        self.assertEqual(maten['qrhalf'], ['76mm', '28mm'])

    def test_qr_leesbaar(self):
        det = cv2.QRCodeDetector()
        for id_, verwacht in QR_VERWACHT.items():
            png = self.pagina.locator('#' + id_).screenshot()
            img = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_GRAYSCALE)
            tekst, _, _ = det.detectAndDecode(img)
            self.assertEqual(tekst, verwacht, id_)

    def test_strook_schrijflijn(self):
        d = self.pagina.evaluate("""() => {
            const el = document.getElementById('strook');
            const mk = (s) => { const i = document.createElement('i'); i.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; s.appendChild(i); const y = i.getBoundingClientRect().top; i.remove(); return y; };
            return [mk(el.querySelector('.titel>span')), mk(el.querySelector('.groot>span')), el.querySelector('.groot>span').textContent];
        }""")
        self.assertEqual(d[2], '2,5 m')
        self.assertLess(abs(d[0] - d[1]), 0.5)

    def test_wit_heeft_rand(self):
        r = self.pagina.evaluate("""() => {
            const s = document.querySelector('#wit .streep'), g = document.querySelector('#strook .streep');
            return [getComputedStyle(s).backgroundColor, getComputedStyle(s).boxShadow, getComputedStyle(g).backgroundColor, getComputedStyle(g).boxShadow];
        }""")
        self.assertEqual(r[0], 'rgb(255, 255, 255)')
        self.assertIn('rgb(0, 0, 0)', r[1])
        self.assertEqual(r[2], 'rgb(255, 255, 0)')

    def test_geen_qr_melding(self):
        t = self.pagina.locator('#zonderqr .geen-qr')
        self.assertEqual(t.count(), 1)
        self.assertEqual(t.inner_text().strip(), 'Geen QR-code')

    def test_logo_positie(self):
        r = self.pagina.evaluate("""() => {
            const pos = (id, sel) => { const e = document.querySelector('#' + id + ' ' + sel); if (!e) return null; const b = document.getElementById(id).getBoundingClientRect(), r = e.getBoundingClientRect(); return [(r.top - b.top) / b.height, (r.bottom - b.top) / b.height]; };
            return { strookLogo: pos('strook', '.blg'), strookGat: pos('strook', '.gat'), bdLogo: pos('backdrop', '.blg'), bdGat: pos('backdrop', '.gat') };
        }""")
        self.assertLess(r['strookLogo'][0], 0.2)
        self.assertIsNone(r['strookGat'])
        self.assertGreater(r['bdLogo'][1], 0.95)
        self.assertLess(r['bdGat'][1], 0.25)


if __name__ == '__main__':
    unittest.main()
