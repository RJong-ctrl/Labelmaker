"""Gedeelde opzet voor de browsertests: een lokale webserver op de repo-root
en headless Chromium. Gebruik: class MijnTest(PaginaTest)."""
import functools
import http.server
import os
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FIXTURES = os.path.join(ROOT, 'tests', 'fixtures', 'out')


class _StilleHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class PaginaTest(unittest.TestCase):
    """Start per testklasse één server en één browser; per test een schone pagina."""

    pad = '/v2/'
    viewport = {'width': 1400, 'height': 900}

    @classmethod
    def setUpClass(cls):
        handler = functools.partial(_StilleHandler, directory=ROOT)
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        cls.basis = 'http://127.0.0.1:%d' % cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport=self.viewport)
        self.pagina = self.context.new_page()
        self.fouten = []
        self.pagina.on('console', lambda m: m.type == 'error' and self.fouten.append(m.text))
        self.pagina.on('pageerror', lambda e: self.fouten.append(str(e)))
        self.pagina.goto(self.basis + self.pad)

    def tearDown(self):
        self.context.close()
