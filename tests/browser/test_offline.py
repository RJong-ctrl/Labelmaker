"""Offline werken. Deze tests draaien tegen een eigen server op een tijdelijke kopie van v2/:
- Playwright's route() ziet de verzoeken van een service worker (sw.js-update, data/) niet;
  met een eigen server kan een test sw.js en bestanden gewoon op schijf wijzigen;
- de server geeft net als GitHub Pages `Cache-Control: max-age=600`, zodat de tests de
  HTTP-cache echt in de weg laten zitten."""
import functools
import http.server
import json
import os
import re
import shutil
import tempfile
import threading
import unittest

from basis import ROOT, PaginaTest

V2 = os.path.join(ROOT, 'v2')

REGISTREER = "async () => (await import('./js/offline.js')).registreerOffline()"

# Wacht tot de service worker actief is (de pagina bestuurt hij daarna via clients.claim()).
WACHT_OP_ACTIEF = "async () => { await navigator.serviceWorker.ready; return null; }"

CACHES = "async () => (await caches.keys()).filter(k => k.startsWith('labelmaker-')).sort()"

CACHE_INHOUD = """async (naam) => (await (await caches.open(naam)).keys())
    .map(r => new URL(r.url).pathname).sort()"""

CACHE_TEKST = """async ([naam, pad]) => (await (await caches.open(naam)).match(pad)).text()"""

DATA_OPHALEN = "() => fetch('data/dsl.json').then(r => r.json())"

LETTERTYPE = """async () => {
    await document.fonts.load('700 12pt "DSL Futura"');
    await document.fonts.ready;
    const geladen = [...document.fonts].filter(f => f.family.replace(/"/g, '') === 'DSL Futura' && f.status === 'loaded');
    return { check: document.fonts.check('700 12pt "DSL Futura"'), geladen: geladen.length };
}"""


class _Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.server.verzoeken.append((self.path, {k.lower(): v for k, v in self.headers.items()}))
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'public, max-age=600')  # zoals GitHub Pages
        super().end_headers()


def lees(pad):
    with open(pad, encoding='utf-8') as f:
        return f.read()


def schrijf(pad, tekst):
    os.makedirs(os.path.dirname(pad), exist_ok=True)
    with open(pad, 'w', encoding='utf-8') as f:
        f.write(tekst)


def bestanden_uit_sw(tekst):
    """De lijst BESTANDEN uit sw.js."""
    blok = re.search(r'const BESTANDEN = \[(.*?)\];', tekst, re.S).group(1)
    return re.findall(r"'([^']*)'", blok)


class OfflineBasis(PaginaTest):
    """Per test een eigen server op een verse kopie van v2/ (zodat een test die kan aanpassen)."""

    basis_blokkeren = False
    service_workers = 'allow'

    def setUp(self):
        self.map = tempfile.mkdtemp(prefix='labelmaker-offline-')
        shutil.copytree(V2, os.path.join(self.map, 'v2'))
        self.v2 = os.path.join(self.map, 'v2')
        # Zoals op de site: naast v2/ staat de service worker van het hoofdadres.
        shutil.copy(os.path.join(V2, '..', 'sw-hoofd.js'), self.map)
        self.zet_data({'nr': 1})
        handler = functools.partial(_Handler, directory=self.map)
        self.eigen_server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        self.eigen_server.verzoeken = []
        threading.Thread(target=self.eigen_server.serve_forever, daemon=True).start()
        self.basis = 'http://127.0.0.1:%d' % self.eigen_server.server_address[1]
        super().setUp()

    def tearDown(self):
        super().tearDown()
        self.eigen_server.shutdown()
        self.eigen_server.server_close()
        shutil.rmtree(self.map, ignore_errors=True)

    def zet_data(self, inhoud):
        """Schrijft data/dsl.json met steeds een andere wijzigingstijd (Last-Modified heeft seconden als maat)."""
        pad = os.path.join(self.v2, 'data', 'dsl.json')
        schrijf(pad, json.dumps(inhoud))
        self.versie_teller = getattr(self, 'versie_teller', 0) + 60
        os.utime(pad, (1_700_000_000 + self.versie_teller, 1_700_000_000 + self.versie_teller))

    def netwerk_uit(self):
        """Echt offline: de browser meldt offline én de server bestaat niet meer.
        (Playwrights set_offline geldt niet voor de eigen verzoeken van de service worker.)"""
        self.context.set_offline(True)
        self.eigen_server.shutdown()
        self.eigen_server.server_close()

    def registreer_en_wacht(self):
        """Registreren en wachten tot de service worker actief is en de pagina bestuurt."""
        p = self.pagina
        self.assertEqual(p.evaluate(REGISTREER), {'nieuweVersie': False})
        p.evaluate(WACHT_OP_ACTIEF)
        p.wait_for_function('navigator.serviceWorker.controller !== null')

    def nieuwe_sw(self, versie):
        """Zet een sw.js met een andere VERSIE op schijf (en stuurt hem als nieuwe versie uit)."""
        pad = os.path.join(self.v2, 'sw.js')
        nieuw, aantal = re.subn(r"(const VERSIE = ')[^']+(')", lambda m: m.group(1) + versie + m.group(2), lees(pad), count=1)
        self.assertEqual(aantal, 1, 'VERSIE niet gevonden in sw.js')
        schrijf(pad, nieuw)
        return 'labelmaker-' + versie


class Offline(OfflineBasis):
    def test_offline_openen(self):
        p = self.pagina
        self.registreer_en_wacht()
        self.assertEqual(len(p.evaluate(CACHES)), 1)

        self.netwerk_uit()
        antwoord = p.reload()
        self.assertTrue(antwoord.from_service_worker, 'de pagina moet uit de service worker komen, niet van het netwerk')
        self.assertFalse(p.evaluate('navigator.onLine'))
        p.locator('#printLabel').wait_for(state='visible')
        p.wait_for_function("document.querySelector('#printLabel').textContent.includes('Citizen')")

        lettertype = p.evaluate(LETTERTYPE)
        self.assertTrue(lettertype['check'], 'DSL Futura 700 hoort offline beschikbaar te zijn')
        self.assertGreaterEqual(lettertype['geladen'], 1)
        self.assertEqual(self.fouten, [])

    def test_data_netwerk_eerst_met_terugval_op_cache(self):
        p = self.pagina
        self.registreer_en_wacht()
        naam = p.evaluate(CACHES)[0]
        self.assertFalse([k for k in p.evaluate(CACHE_INHOUD, naam) if '/data/' in k], 'data/ hoort niet in de voorraad bij installeren')

        self.assertEqual(p.evaluate(DATA_OPHALEN), {'nr': 1})
        self.zet_data({'nr': 2})
        self.assertEqual(p.evaluate(DATA_OPHALEN), {'nr': 2}, 'online wint het netwerk, ook al is de HTTP-cache nog geldig (max-age=600)')
        self.zet_data({'nr': 3})
        self.netwerk_uit()
        self.assertEqual(p.evaluate(DATA_OPHALEN), {'nr': 2}, 'offline: de laatst geziene versie uit de cache')
        self.assertEqual(p.evaluate("() => fetch('data/onbekend.json').then(() => 'ok', () => 'fout')"), 'fout')

    def test_data_ontbreekt_geeft_gewoon_404(self):
        p = self.pagina
        self.registreer_en_wacht()
        status = p.evaluate("() => fetch('data/bestaat-niet.json').then(r => r.status)")
        self.assertEqual(status, 404)

    def test_andere_mappen_blijven_van_het_netwerk(self):
        """Wat niet bij de app hoort (bijvoorbeeld /v1/) mag de service worker niet overnemen."""
        p = self.pagina
        schrijf(os.path.join(self.map, 'v1', 'index.html'), 'oude versie')
        self.registreer_en_wacht()
        self.assertEqual(p.evaluate("() => fetch('/v1/index.html').then(r => r.text())"), 'oude versie')
        naam = p.evaluate(CACHES)[0]
        self.assertFalse([k for k in p.evaluate(CACHE_INHOUD, naam) if '/v1/' in k])


class NieuweVersie(OfflineBasis):
    """Een nieuwe sw.js (andere VERSIE) vervangt de hele cache en wordt eenmalig gemeld."""
    app_starten = False

    def setUp(self):
        super().setUp()
        p = self.pagina
        self.registreer_en_wacht()
        # Tweede start onder de eerste versie: die versie wordt onthouden, geen melding.
        self.assertEqual(p.evaluate(REGISTREER), {'nieuweVersie': False})
        self.oud = p.evaluate(CACHES)
        self.assertEqual(len(self.oud), 1)

    def wacht_op_overname(self, versie):
        """Wacht tot de worker met deze VERSIE klaar is met installeren én activeren (en de pagina bestuurt).
        Let op: bij skipWaiting() wisselt `controller` al aan het begin van het activeren, dus kijk naar de
        toestand van de registratie. Stuur de oude worker tijdens het wachten geen berichten: Chromium
        activeert een wachtende worker pas als de oude niets te doen heeft.
        (wait_for_function wacht niet op een belofte, daarom hier een begrensde controle in de pagina zelf.)"""
        toestand = self.pagina.evaluate("""async (naam) => {
            const tot = Date.now() + 7000;
            let r;
            for (;;) {
                r = await navigator.serviceWorker.getRegistration();
                if (!r.installing && !r.waiting && r.active && r.active.state === 'activated'
                    && navigator.serviceWorker.controller && await caches.has(naam)) return null;
                if (Date.now() > tot) break;
                await new Promise((klaar) => setTimeout(klaar, 25));
            }
            return { installing: r.installing && r.installing.state, waiting: r.waiting && r.waiting.state,
                     active: r.active && r.active.state, controller: !!navigator.serviceWorker.controller,
                     caches: await caches.keys() };
        }""", 'labelmaker-' + versie)
        sw_verzoeken = [(pad, kop.get('cache-control'), kop.get('if-modified-since')) for pad, kop in self.eigen_server.verzoeken if pad.endswith('sw.js')]
        self.assertIsNone(toestand, f'worker {versie} is niet actief geworden: {toestand}; sw.js-verzoeken: {sw_verzoeken}')

    def werk_bij(self, versie):
        """Nieuwe sw.js uitsturen, de update laten ophalen en wachten tot hij de pagina bestuurt."""
        p = self.pagina
        nieuw = self.nieuwe_sw(versie)
        p.evaluate("() => navigator.serviceWorker.getRegistration().then(r => r.update()).then(() => null)")
        self.wacht_op_overname(versie)
        return nieuw

    def test_nieuwe_versie_vervangt_cache(self):
        p = self.pagina
        self.assertEqual(p.evaluate(DATA_OPHALEN), {'nr': 1})
        voor = p.evaluate(CACHE_INHOUD, self.oud[0])
        nieuw = self.werk_bij('test-nieuw-1')
        self.assertEqual(p.evaluate(CACHES), [nieuw], 'alleen de nieuwe cache mag overblijven')
        self.assertEqual(p.evaluate(CACHE_INHOUD, nieuw), voor, 'de nieuwe cache heeft dezelfde bestanden, ook de laatst geziene basis')
        # En nog een keer: ook de vorige "nieuwe" cache verdwijnt.
        nieuwer = self.werk_bij('test-nieuw-2')
        self.assertEqual(p.evaluate(CACHES), [nieuwer])
        self.assertEqual(self.fouten, [])

    def test_basis_blijft_beschikbaar_na_update(self):
        p = self.pagina
        self.assertEqual(p.evaluate(DATA_OPHALEN), {'nr': 1})
        self.werk_bij('test-nieuw-1')
        self.netwerk_uit()
        self.assertEqual(p.evaluate(DATA_OPHALEN), {'nr': 1})

    def test_nieuwe_versie_wordt_eenmalig_gemeld(self):
        p = self.pagina
        self.werk_bij('test-nieuw-1')
        self.assertEqual(p.evaluate(REGISTREER), {'nieuweVersie': True})
        self.assertEqual(p.evaluate(REGISTREER), {'nieuweVersie': False})
        self.assertEqual(p.evaluate("() => localStorage.getItem('labelmaker-sw-versie')"), 'test-nieuw-1')

    def test_update_haalt_verse_bestanden_en_slaat_http_cache_over(self):
        """GitHub Pages geeft max-age=600: de nieuwe cache mag geen 10 minuten oude bestanden bevatten."""
        p = self.pagina
        css = os.path.join(self.v2, 'css', 'app.css')
        schrijf(css, lees(css) + '\n/* nieuwe-versie-marker */\n')
        self.eigen_server.verzoeken.clear()
        nieuw = self.werk_bij('test-nieuw-1')

        self.assertIn('nieuwe-versie-marker', p.evaluate(CACHE_TEKST, [nieuw, '/v2/css/app.css']))
        gevraagd = {pad: kop for pad, kop in self.eigen_server.verzoeken}
        for b in bestanden_uit_sw(lees(os.path.join(self.v2, 'sw.js'))):
            pad = '/v2/' + ('' if b == './' else b)
            self.assertIn(pad, gevraagd, f'{b} is bij de update niet opgehaald')
            self.assertEqual(gevraagd[pad].get('cache-control'), 'no-cache', f'{b} moet de HTTP-cache overslaan')
        reg = p.evaluate("() => navigator.serviceWorker.getRegistration().then(r => r.updateViaCache)")
        self.assertEqual(reg, 'none', 'sw.js zelf mag niet uit de HTTP-cache komen')

    def test_elke_start_zoekt_naar_een_nieuwe_versie(self):
        p = self.pagina
        nieuw = self.nieuwe_sw('test-nieuw-1')
        p.evaluate(REGISTREER)  # geen aparte update(): registreerOffline zelf zoekt
        self.wacht_op_overname('test-nieuw-1')
        self.assertEqual(p.evaluate(CACHES), [nieuw])


class Veilig(OfflineBasis):
    """registreerOffline gooit nooit een fout."""
    app_starten = False

    def test_register_weigert(self):
        p = self.pagina
        p.evaluate("() => { navigator.serviceWorker.register = () => Promise.reject(new Error('geweigerd')); }")
        self.assertEqual(p.evaluate(REGISTREER), {'nieuweVersie': False})

    def test_opslag_kapot(self):
        p = self.pagina
        p.evaluate("() => { Storage.prototype.getItem = () => { throw new Error('geen opslag'); }; Storage.prototype.setItem = () => { throw new Error('geen opslag'); }; }")
        self.assertEqual(p.evaluate(REGISTREER), {'nieuweVersie': False})

    def test_zonder_service_worker_api(self):
        p = self.pagina
        p.evaluate("() => { Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true }); }")
        self.assertEqual(p.evaluate(REGISTREER), {'nieuweVersie': False})


if __name__ == '__main__':
    unittest.main()
