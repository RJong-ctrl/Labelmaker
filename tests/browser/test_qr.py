import unittest

import cv2
import numpy as np

from basis import PaginaTest

TEKSTEN = ['nl4-2.50m', 'bd6x3b-01', '1004421', 'é – Wit']


class QR(PaginaTest):
    app_starten = False

    def test_qr_leesbaar(self):
        p = self.pagina
        p.evaluate("""async (teksten) => {
            const { qrSvg } = await import('./js/qr.js');
            document.body.innerHTML = teksten.map((t, i) => {
                const { svg, modules } = qrSvg(t);
                return `<div id="q${i}" style="width:${(modules + 4) * 9}px;background:#fff;padding:20px">${svg}</div>`;
            }).join('');
            document.querySelectorAll('svg').forEach(s => { s.style.width = '100%'; s.style.height = 'auto'; s.style.display = 'block'; });
        }""", TEKSTEN)
        det = cv2.QRCodeDetector()
        for i, t in enumerate(TEKSTEN):
            png = p.locator('#q%d' % i).screenshot()
            img = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_GRAYSCALE)
            tekst, _, _ = det.detectAndDecode(img)
            self.assertEqual(tekst, t)


if __name__ == '__main__':
    unittest.main()
