import base64
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
    ('algemeen', 'bordje-staand', 'CO1120', {'Groot': '12 st.'}, 'kenporto-00', None),
    ('algemeenL', 'bordje-liggend', 'GE9509', {}, '1001540', None),
    ('algemeenS', 'bordje-staand', 'GE9509', {}, '1001540', None),
    ('langS', 'bordje-staand', 'GE9402', {}, 'x1', '1 x mini jack stereo > 2 x Jack mono Verloop 1,5m'),
    ('kortS', 'bordje-staand', 'GE9402', {}, 'x2', 'Shuko 230V 10m Verlengkabel'),
    ('langL', 'bordje-liggend', 'GE9402', {}, 'x3', '1 x mini jack stereo > 2 x Jack mono Verloop 1,5m'),
    ('qrlabel', 'qrlabel', 'GE9402', {}, 'nl4-2.50m', None),
    ('lang', 'qrlabel', 'GE9509', {}, '1001540', None),
    ('qrhalf', 'qrlabel-half', 'CO1120', {}, 'kenporto-00', None),
    ('locatie', 'locatie', 'GE9402', {}, '', None),
    ('lochalf', 'locatie-half', 'CO1120', {}, '', None),
]
QR_VERWACHT = {'algemeen': 'kenporto-00', 'algemeenL': '1001540', 'algemeenS': '1001540', 'strook': 'nl4-2.50m', 'koppelbus': 'nl8-koppel', 'backdrop': 'bd6x3b-01', 'pd': '1004421',
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

    def test_lettertypes_meegeleverd(self):
        r = self.pagina.evaluate("""() => {
            const f = [...document.fonts].filter(x => x.family.replace(/"/g, '').startsWith('DSL'));
            return {
                geladen: f.filter(x => x.status === 'loaded').map(x => x.family.replace(/"/g, '') + ' ' + x.weight).sort(),
                bordje: getComputedStyle(document.querySelector('#backdrop')).fontFamily,
                label: getComputedStyle(document.querySelector('#qrlabel')).fontFamily,
                futura: document.fonts.check('700 12pt "DSL Futura"'),
                labelfont: document.fonts.check('700 12pt "DSL Label"'),
            };
        }""")
        self.assertTrue(r['futura'])
        self.assertTrue(r['labelfont'])
        self.assertIn('DSL Futura 700 900', r['geladen'])
        self.assertIn('DSL Label 700 900', r['geladen'])
        self.assertTrue(r['bordje'].startswith('"DSL Futura"'))
        self.assertTrue(r['label'].startswith('"DSL Label"'))

    def test_naam_groot_op_algemeen_bordje(self):
        pt = self.pagina.evaluate("""() => Object.fromEntries(['algemeenL', 'algemeenS'].map(id => [id, parseFloat(document.querySelector('#' + id + ' .titel>span').style.fontSize)]))""")
        self.assertGreaterEqual(pt['algemeenL'], 18)
        self.assertGreaterEqual(pt['algemeenS'], 16)

    def test_lange_naam_blijft_groot(self):
        r = self.pagina.evaluate("""() => Object.fromEntries(['langS', 'kortS', 'langL'].map(id => {
            const el = document.getElementById(id), t = el.querySelector('.titel>span');
            const onder = el.querySelector('.onderregel');
            return [id, { pt: parseFloat(t.style.fontSize), deel: t.getBoundingClientRect().height / el.getBoundingClientRect().height, onder: onder ? onder.textContent : null }];
        }))""")
        self.assertGreaterEqual(r['langS']['pt'], 20, r)
        self.assertGreaterEqual(r['langS']['deel'], 0.3, r)
        self.assertGreaterEqual(r['kortS']['pt'], 22, r)  # 'Verlengkabel' is het langste woord
        self.assertGreaterEqual(r['langL']['pt'], 18, r)
        self.assertEqual(r['langS']['onder'], 'Artikelnummer GE9402')

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
            return { strookLogo: pos('strook', '.blg'), strookGat: pos('strook', '.gat'), bdLogo: pos('backdrop', '.blg'), bdGat: pos('backdrop', '.gat'), pdLogo: pos('pd', '.blg'), pdGat: pos('pd', '.gat') };
        }""")
        # Logo altijd bovenaan, gatmarkering (perforatie) onderaan.
        self.assertLess(r['strookLogo'][0], 0.2)
        self.assertIsNone(r['strookGat'])
        self.assertLess(r['bdLogo'][0], 0.05)
        self.assertGreater(r['bdGat'][0], 0.75)
        self.assertLess(r['pdLogo'][0], 0.05)
        self.assertGreater(r['pdGat'][0], 0.6)


# ---------- huisstijl uit het profiel ----------

VOET = ['DSL Geluids- & Lichtverhuur, De Fok 23, 1742 PC Schagen',
        'Tel. 0224-218130 | info@dslverhuur.nl | www.dslverhuur.nl']
PROFIEL_DSL = {'logo': 'assets/dsl-logo.svg', 'voet': VOET, 'certIcoon': None, 'lettertype': 'futura'}
PROFIEL_BASIS = {'logo': None, 'voet': [], 'certIcoon': None, 'lettertype': 'futura'}
ICOON = 'data:image/svg+xml;base64,' + base64.b64encode(
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#0a0"/></svg>').decode()

# id, sjabloon, artikelcode, aanvullingen, qr, huisstijl (None = standaard)
TEKEN_HS = """async (gevallen) => {
    const { opmaak, sj, A, S } = window.T;
    document.body.innerHTML = '';
    document.body.style.cssText = 'background:#ddd;display:flex;flex-wrap:wrap;gap:10px;padding:10px';
    for (const [id, sjabloon, code, aanv, qr, hs] of gevallen) {
        const el = opmaak.teken(sj.vul(S[sjabloon], A[code], aanv, qr), hs ?? undefined);
        el.id = id;
        document.body.appendChild(el);
        await opmaak.pasAan(el);
    }
}"""

FONT = """([id, sel]) => getComputedStyle(document.querySelector('#' + id + sel)).fontFamily"""


class Huisstijl(PaginaTest):
    app_starten = False

    def setUp(self):
        super().setUp()
        self.laad_voorbeeld()

    def teken(self, gevallen):
        self.pagina.evaluate(TEKEN_HS, gevallen)

    def font(self, id_, sel=''):
        return self.pagina.evaluate(FONT, [id_, sel])

    def test_zonder_logo_en_voet(self):
        bd = ['backdrop', 'LI8163-B', {'Kleur': 'Zwart'}, 'bd6x3b-01']
        self.teken([
            ['bd', *bd, PROFIEL_BASIS],
            ['bd-met', *bd, PROFIEL_DSL],
            ['st', 'gitterbox', 'GE9402', {'Doorsnede': '2,5 mm²'}, 'nl4-2.50m', PROFIEL_BASIS],
            ['st-met', 'gitterbox', 'GE9402', {'Doorsnede': '2,5 mm²'}, 'nl4-2.50m', PROFIEL_DSL],
            ['ql', 'qrlabel', 'GE9402', {}, 'nl4-2.50m', PROFIEL_BASIS],
            ['ql-met', 'qrlabel', 'GE9402', {}, 'nl4-2.50m', PROFIEL_DSL],
            ['qh', 'qrlabel-half', 'CO1120', {}, 'kenporto-00', PROFIEL_BASIS],
        ])
        p = self.pagina
        # bordje: kleurvlak blijft, geen logo (geen lege img), geen voettekst
        self.assertEqual(p.locator('#bd .band.vlak').count(), 1)
        self.assertEqual(p.locator('#bd .band.streep').count(), 1)
        self.assertEqual(p.locator('#bd img').count(), 0)
        self.assertEqual(p.locator('#bd .ft').count(), 0)
        self.assertEqual(p.locator('#st img').count(), 0)
        self.assertEqual(p.locator('#st .band.vlak').count(), 1)
        # met huisstijl DSL staan logo en voet er wel
        self.assertEqual(p.locator('#bd-met .blg img').count(), 1)
        self.assertEqual(p.locator('#bd-met .ft').count(), 1)
        self.assertEqual(p.locator('#st-met .blg img').count(), 1)
        # de ruimte van de voettekst is voor de inhoud (tabel wordt hoger)
        hoogte = p.evaluate("""() => [document.querySelector('#bd .tb').clientHeight, document.querySelector('#bd-met .tb').clientHeight]""")
        self.assertGreater(hoogte[0], hoogte[1] + 3)
        # labels: geen logo
        self.assertEqual(p.locator('#ql img').count(), 0)
        self.assertEqual(p.locator('#ql-met img.logo').count(), 1)
        self.assertEqual(p.locator('#qh img').count(), 0)
        # QR staat nog op het label
        self.assertEqual(p.locator('#ql .qr svg').count(), 1)
        self.assertEqual(self.fouten, [])

    def test_geen_logo_ook_als_leeg_of_ontbreekt(self):
        self.teken([
            ['a', 'backdrop', 'LI8163-B', {'Kleur': 'Zwart'}, 'x', {'logo': '', 'voet': VOET, 'lettertype': 'futura'}],
            ['b', 'qrlabel', 'GE9402', {}, 'x', {'voet': [], 'lettertype': 'futura'}],
        ])
        self.assertEqual(self.pagina.locator('#a img, #b img').count(), 0)
        self.assertEqual(self.pagina.locator('#a .ft').count(), 1)
        self.assertEqual(self.fouten, [])

    def test_cert_icoon_getoond(self):
        bd = ['backdrop', 'LI8163-B', {'Kleur': 'Zwart'}, 'bd6x3b-01']
        self.teken([
            ['ci', *bd, {**PROFIEL_DSL, 'certIcoon': ICOON}],
            ['zonder', *bd, PROFIEL_DSL],
            ['extern', *bd, {**PROFIEL_DSL, 'certIcoon': 'https://example.invalid/icoon.png'}],
        ])
        p = self.pagina
        r = p.evaluate("""() => {
            const img = document.querySelector('#ci .cert img'), tekst = document.querySelector('#ci .cert span');
            const mm = 96 / 25.4, b = img.getBoundingClientRect(), t = tekst.getBoundingClientRect();
            return { src: img.getAttribute('src'), breed: b.width / mm, hoog: b.height / mm, geladen: img.naturalWidth > 0,
                     voor: b.right <= t.left + 0.5, eerste: img.nextElementSibling === tekst, tekst: tekst.textContent };
        }""")
        self.assertEqual(r['src'], ICOON)
        self.assertAlmostEqual(r['breed'], 5, delta=0.1)   # 5 × f mm, f = 1 bij 74 × 105
        self.assertAlmostEqual(r['hoog'], 5, delta=0.1)
        self.assertTrue(r['geladen'])
        self.assertTrue(r['voor'] and r['eerste'])
        self.assertEqual(r['tekst'], 'Gecertificeerd volgens DIN 4102 B1')
        self.assertEqual(p.locator('#zonder .cert img').count(), 0)
        # alleen een data-URL met een afbeelding; geen externe bron
        self.assertEqual(p.locator('#extern .cert img').count(), 0)
        self.assertEqual(p.locator('#extern .cert span').count(), 1)
        self.assertEqual(self.fouten, [])

    def test_lettertype_keuze(self):
        sign = ['backdrop', 'LI8163-B', {'Kleur': 'Zwart'}, 'x']
        lab = ['qrlabel', 'GE9402', {}, 'x']

        def hs(lt):
            return {**PROFIEL_DSL, 'lettertype': lt}
        self.teken([
            ['s-arial', *sign, hs('arial')],
            ['s-futura', *sign, hs('futura')],
            ['s-barlow', *sign, hs('barlow')],
            ['s-eigen', *sign, hs('eigen')],
            ['s-onbekend', *sign, hs('comic')],
            ['s-oud', *sign, None],                                   # HUISSTIJL_DSL met 'DSL Futura'
            ['l-arial', *lab, hs('arial')],
            ['l-futura', *lab, hs('futura')],
            ['l-barlow', *lab, hs('barlow')],
            ['l-eigen', *lab, hs('eigen')],
        ])
        f = self.font
        self.assertTrue(f('s-arial').startswith('Arial'), f('s-arial'))
        self.assertTrue(f('s-arial', ' .titel>span').startswith('Arial'))
        self.assertTrue(f('s-futura').startswith('"DSL Futura"'))
        self.assertTrue(f('s-barlow').startswith('"DSL Label"'))
        self.assertTrue(f('s-oud').startswith('"DSL Futura"'))
        self.assertTrue(f('s-onbekend').startswith('"DSL Futura"'))
        # eigen lettertype niet geladen: terugval op DSL Futura
        self.assertTrue(f('s-eigen').startswith('"DSL Eigen", "DSL Futura"'), f('s-eigen'))
        # labels houden DSL Label, behalve bij Arial en eigen
        self.assertTrue(f('l-arial').startswith('Arial'))
        self.assertTrue(f('l-futura').startswith('"DSL Label"'))
        self.assertTrue(f('l-barlow').startswith('"DSL Label"'))
        self.assertTrue(f('l-eigen').startswith('"DSL Eigen"'))
        # de tekst past ook met Arial
        scheef = self.pagina.evaluate("""() => [...document.querySelectorAll('#s-arial .fb')].filter(b => {
            const s = b.firstElementChild; return s && (s.scrollWidth > b.clientWidth + 1 || s.offsetHeight > b.clientHeight + 1);
        }).map(b => b.className)""")
        self.assertEqual(scheef, [])
        self.assertEqual(self.fouten, [])

    def test_eigen_lettertype_wordt_afgewacht(self):
        # geregistreerd maar nog niet geladen: pasAan moet erop wachten
        self.pagina.evaluate("""() => {
            document.fonts.add(new FontFace('DSL Eigen', 'url(/v2/fonts/barlow-condensed-700.woff2)', { weight: '400 900' }));
        }""")
        self.teken([['e', 'backdrop', 'LI8163-B', {'Kleur': 'Zwart'}, 'x', {**PROFIEL_DSL, 'lettertype': 'eigen'}]])
        status = self.pagina.evaluate("""() => [...document.fonts].filter(x => x.family.replace(/"/g, '') === 'DSL Eigen').map(x => x.status)""")
        self.assertEqual(status, ['loaded'])
        self.assertTrue(self.font('e').startswith('"DSL Eigen"'))
        self.assertEqual(self.fouten, [])

    def test_ongeldige_kleur_wordt_grijs(self):
        r = self.pagina.evaluate("""async () => {
            const { opmaak, sj, A, S } = window.T;
            const inh = sj.vul(S.gitterbox, A.GE9402, { Doorsnede: '2,5 mm²' }, 'x');
            inh.rand = 'red;background:url(//x.invalid/a.png)';
            inh.label.kleur = '"><b id=kwaad>';
            const el = opmaak.teken(inh);
            document.body.appendChild(el);
            await opmaak.pasAan(el);
            const kleur = (sel) => getComputedStyle(el.querySelector(sel)).backgroundColor;
            return { streep: kleur('.streep'), pil: kleur('.pill'), kwaad: !!document.getElementById('kwaad'),
                     stijlen: [...el.querySelectorAll('[style]')].map(e => e.getAttribute('style')).filter(s => /x\\.invalid|kwaad/.test(s)) };
        }""")
        self.assertEqual(r['streep'], 'rgb(127, 127, 127)')
        self.assertEqual(r['pil'], 'rgb(127, 127, 127)')
        self.assertFalse(r['kwaad'])
        self.assertEqual(r['stijlen'], [])
        self.assertEqual(self.fouten, [])


class FuturaKeuze(PaginaTest):
    def test_zonder_futura_geen_futura_boek(self):
        """Zonder Futura op de pc: meegeleverde Jost, geen futura-boek-klasse."""
        p = self.pagina
        uit = p.evaluate("async () => (await import('./js/opmaak.js')).kiesFutura()")
        self.assertEqual(uit, {'boek': False, 'vet': False})
        self.assertNotIn('futura-boek', p.evaluate('document.documentElement.className'))


if __name__ == '__main__':
    unittest.main()
