"""Beheerscherm: pincode, sjablonen en editor, instellingen, wijzigingen op deze pc.
Draait zonder werkscherm (app_starten = False) op een model met GeheugenOpslag."""
import os
import re
import struct
import unittest
import zlib

from playwright.sync_api import expect

from basis import ROOT, PaginaTest

MODEL = """async ({ artikelen }) => {
    const { GeheugenOpslag } = await import('./js/opslag.js');
    const { laadModel } = await import('./js/model.js');
    window.model = await laadModel(new GeheugenOpslag(), 'dsl');
    if (artikelen) await window.model.zetArtikelen(Object.values(window.T.A));
}"""

START = """async ({ extra }) => {
    const { startBeheer } = await import('./js/beheer.js');
    document.querySelector('header').hidden = true;
    document.querySelector('main').hidden = true;
    document.getElementById('beheerScherm').hidden = false;
    window.terug = 0;
    const extraOnderdelen = extra ? [{ id: 'publiceren', titel: 'Publiceren', teken: (doel) => { doel.innerHTML = '<p id="extraInhoud">Hallo</p>'; } }] : [];
    window.beheer = await startBeheer(document, window.model, {
        profielId: 'dsl',
        terug: () => { window.terug++; window.naamBijTerug = window.model.effectief().sjablonen.find(s => s.id === 'gitterbox').naam; },
        extraOnderdelen,
    });
}"""


class Hulp(PaginaTest):
    app_starten = False

    def maak_model(self, artikelen=True):
        self.laad_voorbeeld()
        self.pagina.evaluate(MODEL, {'artikelen': artikelen})

    def start(self, extra=False):
        self.pagina.evaluate(START, {'extra': extra})

    def open(self, onderdeel):
        self.pagina.locator(f'#beheerMenu [data-onderdeel="{onderdeel}"]').click()
        expect(self.pagina.locator('#beheerForm')).to_have_attribute('data-onderdeel', onderdeel)

    def model(self, js):
        return self.pagina.evaluate(f'async () => {{ const m = window.model; const e = m.effectief(); return {js}; }}')

    def wacht_model(self, js):
        self.pagina.wait_for_function(f'() => {{ const m = window.model; const e = m.effectief(); return {js}; }}')


class Toegang(Hulp):
    def test_pincode_drempel(self):
        p = self.pagina
        self.maak_model()
        p.evaluate("() => model.zetPcInstelling('pincode', '1234')")
        self.start()
        expect(p.locator('#pincode')).to_be_visible()
        expect(p.locator('#beheerMenu')).to_have_count(0)
        p.locator('#pincode').fill('9999')
        p.locator('#pincode').press('Enter')
        expect(p.locator('#beheerScherm')).to_contain_text('Onjuiste pincode')
        expect(p.locator('#beheerMenu')).to_have_count(0)
        expect(p.locator('#pincode')).to_be_focused()
        p.locator('#pincode').fill('1234')
        p.locator('#pincode').press('Enter')
        expect(p.locator('#beheerMenu')).to_be_visible()
        expect(p.locator('#pincode')).to_have_count(0)
        self.assertEqual(self.fouten, [])

    def test_zonder_pincode_meteen_beheer(self):
        p = self.pagina
        self.maak_model()
        self.start()
        expect(p.locator('#beheerMenu')).to_be_visible()
        expect(p.locator('#pincode')).to_have_count(0)
        expect(p.locator('#beheerForm')).to_be_visible()
        expect(p.locator('#beheerVoorbeeld')).to_be_visible()
        self.assertEqual(self.fouten, [])

    def test_terug_vanaf_pincode(self):
        p = self.pagina
        self.maak_model()
        p.evaluate("() => model.zetPcInstelling('pincode', '1234')")
        self.start()
        p.get_by_role('button', name='Terug naar werkscherm').click()
        p.wait_for_function('window.terug === 1')

    def test_pincode_instellen_en_wissen(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('pincode')
        f = p.locator('#beheerForm')
        expect(f).to_contain_text('geen pincode')
        f.locator('#beheerNieuwePincode').fill('12')
        f.get_by_role('button', name='Pincode instellen').click()
        expect(f).to_contain_text('4 tot 8 cijfers')
        self.assertIsNone(p.evaluate("() => model.pcInstelling('pincode')"))
        f.locator('#beheerNieuwePincode').fill('4321')
        f.get_by_role('button', name='Pincode instellen').click()
        p.wait_for_function("async () => (await model.pcInstelling('pincode')) === '4321'")
        expect(f).to_contain_text('pincode ingesteld')
        self.start()
        expect(p.locator('#pincode')).to_be_visible()
        p.locator('#pincode').fill('4321')
        p.locator('#pincode').press('Enter')
        self.open('pincode')
        p.locator('#beheerForm').get_by_role('button', name='Pincode wissen').click()
        p.wait_for_function("async () => (await model.pcInstelling('pincode')) === undefined")
        self.assertNotIn('pincode', str(self.model('e')))
        self.assertEqual(self.fouten, [])


class Indeling(Hulp):
    def test_menu_met_sjablonen_en_onderdelen(self):
        p = self.pagina
        self.maak_model()
        self.start(extra=True)
        menu = p.locator('#beheerMenu')
        for naam in ('Gitterbox-strook', 'Backdrop', 'QR-label', 'Nieuw sjabloon', 'Categorie → sjabloon', 'Huisstijl',
                     'Printers', 'Artikelen inlezen', 'Wijzigingen op deze pc', 'Pincode', 'Publiceren'):
            expect(menu.get_by_role('button', name=naam, exact=True)).to_have_count(1)
        dubbel = p.evaluate("""() => [...document.querySelectorAll('#beheerScherm [id]')]
            .filter(el => document.querySelectorAll('#' + CSS.escape(el.id)).length > 1).map(el => el.id)""")
        self.assertEqual(dubbel, [], 'ids in beheer botsen met het werkscherm')
        menu.get_by_role('button', name='Publiceren').click()
        expect(p.locator('#extraInhoud')).to_have_text('Hallo')
        expect(menu.get_by_role('button', name='Publiceren')).to_have_attribute('aria-current', 'page')
        self.assertEqual(p.locator('#beheerScherm').get_by_role('button', name=re.compile(r'^Print(\s|$)|printen', re.I)).count(), 0,
                         'geen printknoppen in beheer')
        # Opnieuw starten zonder dat onderdeel: dan gewoon het eerste sjabloon.
        self.start(extra=False)
        expect(p.locator('#beheerForm')).to_have_attribute('data-onderdeel', 'sjabloon:qrlabel')
        self.assertEqual(self.fouten, [])

    def test_drie_kolommen_op_1100(self):
        p = self.pagina
        p.set_viewport_size({'width': 1100, 'height': 760})
        self.maak_model()
        self.start()
        self.open('sjabloon:gitterbox')
        m, f, v = (p.locator(s).bounding_box() for s in ('#beheerMenu', '#beheerForm', '#beheerVoorbeeld'))
        self.assertLess(m['x'] + m['width'], f['x'])
        self.assertLess(f['x'] + f['width'], v['x'])
        self.assertGreaterEqual(f['width'], 400)
        self.assertLessEqual(p.evaluate('document.documentElement.scrollWidth'), 1100)
        self.assertEqual(self.fouten, [])

    def test_toetsenbord_en_focus(self):
        p = self.pagina
        self.maak_model()
        self.start()
        p.keyboard.press('Tab')
        expect(p.locator('#beheerTerug')).to_be_focused()
        stijl = p.evaluate('() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, parseFloat(s.outlineWidth)]; }')
        self.assertNotEqual(stijl[0], 'none')
        self.assertGreaterEqual(stijl[1], 2)
        p.keyboard.press('Tab')
        eerste = p.locator('#beheerMenu [data-onderdeel]').first
        expect(eerste).to_be_focused()
        p.keyboard.press('ArrowDown')
        expect(p.locator('#beheerMenu [data-onderdeel]').nth(1)).to_be_focused()
        p.keyboard.press('End')
        expect(p.locator('#beheerMenu [data-onderdeel="pincode"]')).to_be_focused()
        p.keyboard.press('Enter')
        expect(p.locator('#beheerForm')).to_have_attribute('data-onderdeel', 'pincode')
        p.keyboard.press('Home')
        expect(eerste).to_be_focused()
        # Alles wat je kunt aanklikken is een echte knop of invoer (bereikbaar met Tab).
        nep = p.evaluate("""() => [...document.querySelectorAll('#beheerScherm [data-actie], #beheerScherm [data-beheer], #beheerScherm [data-onderdeel]')]
            .filter(el => !['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && el.id !== 'beheerForm').length""")
        self.assertEqual(nep, 0)
        p.locator('#beheerTerug').focus()
        p.keyboard.press('Enter')
        p.wait_for_function('window.terug === 1')
        self.assertEqual(self.fouten, [])

    def test_terug_bewaart_eerst(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('sjabloon:gitterbox')
        p.locator('#beheerForm [data-pad="naam"]').fill('Strook X')
        p.locator('#beheerTerug').click()
        p.wait_for_function('window.terug === 1')
        self.assertEqual(p.evaluate('window.naamBijTerug'), 'Strook X')

    def test_stop_bewaart_en_event(self):
        p = self.pagina
        self.maak_model()
        self.start()
        p.evaluate("""() => { window.events = [];
            document.addEventListener('beheer-wijziging', (e) => window.events.push(e.detail)); }""")
        self.open('sjabloon:gitterbox')
        p.locator('#beheerForm [data-pad="naam"]').fill('Strook Y')
        p.evaluate('() => window.beheer.stop()')
        self.assertEqual(self.model(GITTERBOX + '.naam'), 'Strook Y')
        self.assertEqual(p.evaluate('window.events'), [{'soort': 'sjabloon', 'id': 'gitterbox'}])
        # Na stop reageert beheer nergens meer op.
        p.locator('#beheerForm [data-pad="naam"]').fill('Strook Z')
        p.wait_for_timeout(500)
        self.assertEqual(self.model(GITTERBOX + '.naam'), 'Strook Y')
        self.assertEqual(self.fouten, [])

    def test_opmaak_wisselen(self):
        p = self.pagina
        self.maak_model()
        self.start()
        p.locator('#beheerMenu [data-onderdeel="nieuw"]').click()
        f = p.locator('#beheerForm')
        f.locator('[data-pad="opmaak"]').select_option('qrlabel')
        expect(f.locator('[data-pad="printer"]')).to_have_value('label')
        expect(f.locator('[data-pad="formaat.b"]')).to_have_value('76')
        expect(f.locator('[data-pad="formaat.h"]')).to_have_value('56')
        expect(f.locator('[data-pad="plek.groot"]')).to_have_count(0)
        expect(f.locator('[data-blok="kleuren"]')).to_contain_text('geen kleuren')
        expect(p.locator('#beheerVoorbeeldDoel .lbl')).to_have_count(1)
        f.locator('[data-pad="opmaak"]').focus()
        f.locator('[data-pad="opmaak"]').select_option('liggend')
        expect(f.locator('[data-pad="printer"]')).to_have_value('a4')
        expect(f.locator('[data-pad="formaat.b"]')).to_have_value('105')
        expect(f.locator('[data-pad="opmaak"]')).to_be_focused()
        f.locator('[data-pad="formaat.h"]').fill('5')
        f.locator('[data-pad="formaat.h"]').press('Tab')
        expect(f.locator('[data-melding="basis"]')).to_contain_text('tussen 10 en 297')
        self.wacht_model("e.sjablonen.some(s => s.opmaak === 'liggend' && s.formaat.b === 105 && s.formaat.h === 74 && s.id.startsWith('sjabloon'))")
        expect(p.locator('#beheerVoorbeeldDoel .signb.liggend')).to_have_count(1)
        self.assertEqual(self.fouten, [])


GITTERBOX = "e.sjablonen.find(s => s.id === 'gitterbox')"


class Editor(Hulp):
    def kleurrand(self):
        return self.pagina.locator('#beheerForm .kleurregel[data-regel="rand"]')

    def test_sjabloon_bewerken_live(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('sjabloon:gitterbox')
        p.locator('#beheerArtikel').fill('GE9412')
        p.locator('#beheerArtikel').press('Enter')
        streep = p.locator('#beheerVoorbeeldDoel .band.streep')
        expect(streep).to_have_css('background-color', 'rgb(127, 127, 127)')
        expect(p.locator('#beheerVoorbeeldInfo')).to_have_text('Speakon 4p Verlengkabel 12,5m · GE9412')
        self.assertGreater(p.locator('#beheerVoorbeeldInfo').bounding_box()['height'], 10)
        rand = self.kleurrand()
        expect(rand.locator('[data-zonder]')).to_contain_text('12,5')
        rand.get_by_role('button', name='Waarde toevoegen').click()
        rij = rand.locator('tr.kleurrij').last
        expect(rij.locator('[data-pad$=".waarde"]')).to_be_focused()
        rij.locator('[data-pad$=".waarde"]').fill('12,5')
        rij.locator('select[data-pad$=".naam"]').select_option('oranje')
        expect(streep).to_have_css('background-color', 'rgb(255, 140, 0)')
        expect(p.locator('#beheerStatus')).to_have_text('Opgeslagen')
        self.wacht_model(GITTERBOX + ".kleuren.rand.waarden['12,5'] === '#ff8c00'")
        self.assertEqual(self.model(GITTERBOX + ".kleuren.rand.waarden['2,5']"), '#ffff00')
        expect(rand.locator('[data-zonder]')).not_to_contain_text('12,5')
        # Het werkscherm leest hetzelfde model: daar krijgt GE9412 nu ook oranje.
        rand_ws = p.evaluate("""async () => {
            const { vul } = await import('./js/sjablonen.js');
            const e = model.effectief();
            return vul(e.sjablonen.find(s => s.id === 'gitterbox'), T.A['GE9412'], {}, '').rand;
        }""")
        self.assertEqual(rand_ws, '#ff8c00')
        self.assertIn('gitterbox', self.model("m.wijzigingen().map(w => w.id)"))
        self.assertEqual(self.fouten, [])

    def test_nieuw_sjabloon_en_veld(self):
        p = self.pagina
        self.maak_model()
        self.start()
        p.locator('#beheerMenu [data-onderdeel="nieuw"]').click()
        f = p.locator('#beheerForm')
        naam = f.locator('[data-pad="naam"]')
        expect(naam).to_be_focused()
        naam.fill('Kist')
        f.locator('[data-pad="opmaak"]').select_option('staand')
        f.get_by_role('button', name='Veld toevoegen').click()
        rij = f.locator('li.veldrij').last
        expect(rij.locator('[data-pad$=".naam"]')).to_be_focused()
        rij.locator('[data-pad$=".naam"]').fill('Inhoud')
        rij.locator('[data-pad$=".naam"]').press('Tab')
        rij.locator('[data-pad$=".herkomst"]').select_option('aanvulling')
        rij.locator('[data-pad$=".verplicht"]').check()
        titel = f.locator('[data-pad="plek.titel"]')
        titel.fill('')
        f.locator('[data-blok="plekken"] .veldchip', has_text='{Naam}').click()
        expect(titel).to_have_value('{Naam}')
        groot = f.locator('[data-pad="plek.groot"]')
        groot.click()
        f.locator('[data-blok="plekken"] .veldchip', has_text='{Inhoud}').click()
        expect(groot).to_have_value('{Inhoud}')
        expect(groot).to_be_focused()
        expect(p.locator('#beheerMenu')).to_contain_text('Kist')
        expect(p.locator('#beheerTitel')).to_have_text('Kist')
        self.wacht_model("(() => { const s = e.sjablonen.find(s => s.naam === 'Kist'); return !!s && s.plekken.groot.length === 1; })()")
        uit = p.evaluate("""async () => {
            const { ontbrekend, vul } = await import('./js/sjablonen.js');
            const s = model.effectief().sjablonen.find(s => s.naam === 'Kist');
            const a = T.A['CO1120'];
            return { opmaak: s.opmaak, printer: s.printer, veld: s.velden.find(v => v.naam === 'Inhoud'), titel: s.plekken.titel,
                     mist: ontbrekend(s, a, {}).map(v => v.naam), groot: vul(s, a, { Inhoud: '12 kabels' }).groot,
                     dsl: s.id === 'gitterbox' || s.id === 'backdrop' };
        }""")
        self.assertEqual(uit['opmaak'], 'staand')
        self.assertEqual(uit['printer'], 'a4')
        self.assertEqual(uit['veld'], {'naam': 'Inhoud', 'soort': 'tekst', 'herkomst': {'type': 'aanvulling'}, 'verplicht': True})
        self.assertEqual(uit['titel'], [{'veld': 'Naam'}])
        self.assertEqual(uit['mist'], ['Inhoud'])
        self.assertEqual(uit['groot'], '12 kabels')
        self.assertFalse(uit['dsl'])
        self.assertEqual(self.fouten, [])

    def test_veld_hernoemen_werkt_door(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('sjabloon:gitterbox')
        f = p.locator('#beheerForm')
        lengte = f.locator('li.veldrij').nth(1).locator('[data-pad$=".naam"]')
        expect(lengte).to_have_value('Lengte')
        lengte.fill('Len')
        lengte.press('Tab')
        expect(f.locator('[data-pad="plek.groot"]')).to_have_value('{Len} m')
        expect(f.locator('[data-pad="kleur.rand.sleutel"]')).to_have_value('{Len}')
        kabel = f.locator('li.veldrij').nth(3).locator('[data-pad$=".naam"]')
        kabel.fill('IsKabel')
        kabel.press('Tab')
        self.wacht_model(GITTERBOX + ".velden.find(v => v.naam === 'Doorsnede').alleenAls === 'IsKabel'")
        self.assertEqual(self.model(GITTERBOX + ".plekken.groot"), [{'veld': 'Len'}, ' m'])
        self.assertEqual(self.model(GITTERBOX + ".kleuren.rand.sleutel"), [{'veld': 'Len'}])
        dubbel = f.locator('li.veldrij').nth(4).locator('[data-pad$=".naam"]')
        dubbel.fill('Len')
        dubbel.press('Tab')
        expect(f.locator('[data-melding="velden"]')).to_contain_text('al een veld')
        expect(dubbel).to_have_value('Doorsnede')
        self.assertEqual(self.fouten, [])

    def test_kleur_alleen_hex(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('sjabloon:gitterbox')
        rand = self.kleurrand()
        rij = rand.locator('tr.kleurrij').first
        expect(rij.locator('[data-pad$=".waarde"]')).to_have_value('2,5')
        rij.locator('select[data-pad$=".naam"]').select_option('eigen')
        hex_ = rij.locator('[data-pad$=".hex"]')
        expect(hex_).to_be_focused()
        melding = rand.locator('[data-melding="kleur.rand"]')
        for fout in ('red', '"><b id="vet">x</b>', '#12345'):
            hex_.fill(fout)
            hex_.press('Tab')
            expect(melding).to_contain_text('geen kleurcode')
        expect(p.locator('#vet')).to_have_count(0)
        p.wait_for_timeout(500)
        self.assertEqual(self.model("m.wijzigingen().filter(w => w.soort === 'sjabloon').length"), 0)
        hex_.fill('#00AA11')
        hex_.press('Tab')
        expect(melding).to_have_text('')
        self.wacht_model(GITTERBOX + ".kleuren.rand.waarden['2,5'] === '#00aa11'")
        expect(rij.locator('input[type=color]')).to_have_value('#00aa11')
        expect(rij.locator('select[data-pad$=".naam"]')).to_have_value('eigen')
        waarden = self.model("Object.values(" + GITTERBOX + ".kleuren.rand.waarden)")
        self.assertTrue(all(len(w) == 7 and w.startswith('#') for w in waarden), waarden)
        self.assertEqual(self.fouten, [])

    def test_editor_html_blijft_tekst(self):
        p = self.pagina
        self.maak_model()
        self.start()
        p.locator('#beheerMenu [data-onderdeel="nieuw"]').click()
        f = p.locator('#beheerForm')
        f.locator('[data-pad="naam"]').fill('<b id="vet">Vet</b>')
        boos = '"><img src=x onerror="window.__xss=1">'
        f.locator('[data-pad="plek.titel"]').fill(boos)
        expect(p.locator('#beheerVoorbeeldDoel .titel')).to_contain_text('<img src=x')
        expect(p.locator('#beheerMenu')).to_contain_text('<b id="vet">Vet</b>')
        expect(p.locator('#beheerTitel')).to_have_text('<b id="vet">Vet</b>')
        self.wacht_model("e.sjablonen.some(s => s.naam === '<b id=\"vet\">Vet</b>')")
        sid = self.model("e.sjablonen.find(s => s.naam === '<b id=\"vet\">Vet</b>').id")
        self.open('sjabloon:qrlabel')
        self.open('sjabloon:' + sid)
        expect(f.locator('[data-pad="naam"]')).to_have_value('<b id="vet">Vet</b>')
        expect(f.locator('[data-pad="plek.titel"]')).to_have_value(boos)
        expect(p.locator('#beheerVoorbeeldDoel .titel')).to_contain_text('<img src=x')
        expect(p.locator('#vet')).to_have_count(0)
        expect(p.locator('img[src="x"]')).to_have_count(0)
        self.assertIsNone(p.evaluate('window.__xss'))
        self.assertEqual(self.fouten, [])

    def test_sjabloon_weg_printvel_en_regel(self):
        p = self.pagina
        self.maak_model()
        p.evaluate("""async () => {
            const { DSL_REGELS } = await import('./js/sjablonen.js');
            const s = structuredClone(model.effectief().sjablonen.find(s => s.id === 'bordje-staand'));
            await model.zetSjabloon({ ...s, id: 'eigenkist', naam: 'Kist' });
            await model.zetPrintvel('a4', [
                { sjabloon: 'eigenkist', artikel: 'CO1120', qr: 'kenporto-00', aantal: 2 },
                { sjabloon: 'gitterbox', artikel: 'GE9402', qr: 'nl4-2.50m', aantal: 1 },
                { sjabloon: 'eigenkist', artikel: 'GE9391', qr: 'nl8-koppel', aantal: 1 }]);
            await model.zetPrintvel('label', [{ sjabloon: 'qrlabel', artikel: 'CO1120', qr: 'kenporto-00', aantal: 1 }]);
            await model.zetInstelling('regels', { bordje: [{ pad: 'Portofoon', sjabloon: 'eigenkist' }, ...DSL_REGELS.bordje],
                                                  standaard: { ...DSL_REGELS.standaard, bordje: 'eigenkist' } });
        }""")
        self.start()
        self.open('sjabloon:eigenkist')
        f = p.locator('#beheerForm')
        vraag = p.locator('#beheerVraag')
        f.get_by_role('button', name='Verwijderen', exact=True).click()
        expect(vraag).to_be_visible()
        expect(vraag).to_contain_text('2 regels van het printvel')
        expect(vraag).to_contain_text('1 categorie-regel')
        vraag.get_by_role('button', name='Annuleren').click()
        expect(vraag).to_be_hidden()
        expect(p.locator('#beheerMenu [data-onderdeel="sjabloon:eigenkist"]')).to_have_count(1)
        f.get_by_role('button', name='Verwijderen', exact=True).click()
        vraag.get_by_role('button', name='Verwijderen', exact=True).click()
        melding = p.locator('#beheerMelding')
        expect(melding).to_contain_text('Sjabloon "Kist" verwijderd')
        expect(melding).to_contain_text('2 regels van het printvel')
        expect(melding).to_contain_text('1 categorie-regel')
        expect(p.locator('#beheerMenu [data-onderdeel="sjabloon:eigenkist"]')).to_have_count(0)
        uit = p.evaluate("""async () => {
            const { standaardSjabloon } = await import('./js/sjablonen.js');
            const e = model.effectief();
            return { a4: (await model.printvel('a4')).map(i => i.sjabloon), label: (await model.printvel('label')).length,
                     regels: e.regels.bordje.map(r => r.sjabloon), standaard: e.regels.standaard.bordje,
                     co: standaardSjabloon(T.A['CO1120'], 'bordje', e.regels), eigenkist: e.sjablonen.some(s => s.id === 'eigenkist'),
                     wijz: model.wijzigingen().map(w => w.id) };
        }""")
        self.assertEqual(uit['a4'], ['gitterbox'])
        self.assertEqual(uit['label'], 1)
        self.assertNotIn('eigenkist', uit['regels'])
        self.assertEqual(uit['standaard'], 'bordje-staand')
        self.assertEqual(uit['co'], 'bordje-staand')
        self.assertFalse(uit['eigenkist'])
        self.assertNotIn('eigenkist', uit['wijz'], 'alleen-lokaal sjabloon laat geen "verwijderd" achter')
        self.assertEqual(self.fouten, [])

    def test_dsl_sjabloon_niet_weg_wel_terugzetten(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('sjabloon:gitterbox')
        f = p.locator('#beheerForm')
        expect(f.get_by_role('button', name='Verwijderen', exact=True)).to_have_count(0)
        terug = f.get_by_role('button', name='Terugzetten')
        expect(terug).to_be_disabled()
        f.locator('[data-pad="naam"]').fill('Anders')
        expect(terug).to_be_enabled()
        expect(p.locator('#beheerMenu [data-onderdeel="sjabloon:gitterbox"]')).to_contain_text('Anders')
        terug.click()
        p.locator('#beheerVraag').get_by_role('button', name='Terugzetten').click()
        expect(f.locator('[data-pad="naam"]')).to_have_value('Gitterbox-strook')
        expect(p.locator('#beheerTitel')).to_have_text('Gitterbox-strook')
        expect(f.get_by_role('button', name='Terugzetten')).to_be_disabled()
        expect(p.locator('#beheerMenu [data-onderdeel="sjabloon:gitterbox"]')).to_contain_text('Gitterbox-strook')
        self.assertEqual(self.model("m.wijzigingen().filter(w => w.soort === 'sjabloon').length"), 0)
        self.assertEqual(self.fouten, [])

    def test_dupliceren(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('sjabloon:backdrop')
        p.locator('#beheerForm').get_by_role('button', name='Dupliceren').click()
        expect(p.locator('#beheerForm')).to_have_attribute('data-onderdeel', 'sjabloon:backdrop-kopie')
        expect(p.locator('#beheerTitel')).to_have_text('Backdrop (kopie)')
        expect(p.locator('#beheerMenu')).to_contain_text('Backdrop (kopie)')
        expect(p.locator('#beheerForm').get_by_role('button', name='Verwijderen', exact=True)).to_have_count(1)
        gelijk = self.model("JSON.stringify(e.sjablonen.find(s => s.id === 'backdrop-kopie').velden) === JSON.stringify(e.sjablonen.find(s => s.id === 'backdrop').velden)")
        self.assertTrue(gelijk)
        self.assertEqual(self.fouten, [])

    def test_tokens_heen_en_terug(self):
        uit = self.pagina.evaluate("""async () => {
            const { naarTokens, naarTekst } = await import('./js/editor.js');
            return [naarTokens('Artikelnummer {Artikelnummer}'), naarTokens('{Lengte} m'), naarTokens('{} en {Kleur'),
                    naarTekst([{ veld: 'Connector' }, ' ', { veld: 'Doorsnede' }])];
        }""")
        self.assertEqual(uit[0], ['Artikelnummer ', {'veld': 'Artikelnummer'}])
        self.assertEqual(uit[1], [{'veld': 'Lengte'}, ' m'])
        self.assertEqual(uit[2], ['{} en {Kleur'])
        self.assertEqual(uit[3], '{Connector} {Doorsnede}')


class Wijzigingen(Hulp):
    def test_wijzigingen_weggooien(self):
        p = self.pagina
        self.maak_model(artikelen=False)
        p.evaluate("""async () => {
            await model.laadBasis({ type: 'labelmaker-basis', versie: 1, profiel: 'dsl', datum: '2026-10-26T10:00:00.000Z',
                artikelen: Object.values(T.A), losseItems: [], sjablonen: [], aanvullingen: { GE9402: { Doorsnede: '2,5 mm²' } } });
            await model.zetAanvulling('GE9402', { Doorsnede: '4 mm²' });
        }""")
        self.start()
        self.open('wijzigingen')
        f = p.locator('#beheerForm')
        expect(f).to_contain_text('Basis van 26 okt')
        rijen = f.locator('li.wijziging')
        expect(rijen).to_have_count(1)
        expect(rijen.first).to_contain_text('Speakon 4p Verlengkabel 2,5m')
        expect(rijen.first).to_contain_text('Doorsnede: 4 mm²')
        rijen.first.get_by_role('button', name='Weggooien').click()
        expect(rijen).to_have_count(0)
        expect(f).to_contain_text('Geen wijzigingen')
        expect(p.locator('#beheerMelding')).to_contain_text('Weggegooid')
        self.assertEqual(self.model('e.aanvullingen.GE9402.Doorsnede'), '2,5 mm²')
        self.assertEqual(self.model('m.wijzigingen().length'), 0)
        self.assertEqual(self.fouten, [])

    def test_wijzigingen_sjabloon_en_artikellijst(self):
        p = self.pagina
        self.maak_model()
        p.evaluate("""async () => {
            const e = model.effectief();
            await model.zetSjabloon({ ...structuredClone(e.sjablonen.find(s => s.id === 'bordje-staand')), id: 'eigenkist', naam: 'Kist' });
            await model.zetSjabloon({ ...structuredClone(e.sjablonen.find(s => s.id === 'gitterbox')), naam: 'Strook anders' });
            await model.zetPrintvel('a4', [{ sjabloon: 'eigenkist', artikel: 'CO1120', qr: 'kenporto-00', aantal: 1 }]);
        }""")
        self.start()
        self.open('wijzigingen')
        f = p.locator('#beheerForm')
        rijen = f.locator('li.wijziging')
        expect(rijen).to_have_count(3)
        vraag = p.locator('#beheerVraag')
        rijen.filter(has_text='Artikellijst').get_by_role('button', name='Weggooien').click()
        expect(vraag).to_contain_text('geen artikelen')
        vraag.get_by_role('button', name='Annuleren').click()
        expect(rijen).to_have_count(3)
        rijen.filter(has_text='Kist').get_by_role('button', name='Weggooien').click()
        expect(vraag).to_contain_text('alleen op deze pc')
        vraag.get_by_role('button', name='Weggooien').click()
        expect(rijen).to_have_count(2)
        expect(p.locator('#beheerMelding')).to_contain_text('1 regel van het printvel')
        expect(p.locator('#beheerMenu [data-onderdeel="sjabloon:eigenkist"]')).to_have_count(0)
        self.assertEqual(p.evaluate("async () => (await model.printvel('a4')).length"), 0)
        rijen.filter(has_text='Strook anders').get_by_role('button', name='Weggooien').click()
        vraag.get_by_role('button', name='Weggooien').click()
        expect(rijen).to_have_count(1)
        expect(p.locator('#beheerMenu [data-onderdeel="sjabloon:gitterbox"]')).to_contain_text('Gitterbox-strook')
        self.assertEqual(self.fouten, [])


def png(breedte=2, hoogte=2):
    """Klein, geldig PNG-bestand (rood)."""
    def blok(soort, data):
        return struct.pack('>I', len(data)) + soort + data + struct.pack('>I', zlib.crc32(soort + data) & 0xffffffff)
    rauw = b''.join(b'\x00' + b'\xff\x00\x00' * breedte for _ in range(hoogte))
    return (b'\x89PNG\r\n\x1a\n' + blok(b'IHDR', struct.pack('>IIBBBBB', breedte, hoogte, 8, 2, 0, 0, 0))
            + blok(b'IDAT', zlib.compress(rauw)) + blok(b'IEND', b''))


class Instellingen(Hulp):
    def test_categorie_regels(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('regels')
        f = p.locator('#beheerForm')
        expect(f.locator('tr.regelrij')).to_have_count(3)
        f.get_by_role('button', name='Regel toevoegen').click()
        rij = f.locator('tr.regelrij').last
        expect(rij.locator('[data-veld="pad"]')).to_be_focused()
        rij.locator('[data-veld="pad"]').fill('Portofoon')
        rij.locator('select[data-veld="sjabloon"]').select_option('qrlabel-half')
        self.wacht_model("e.regels.bordje.length === 4 && e.regels.bordje[3].pad === 'Portofoon' && e.regels.bordje[3].sjabloon === 'qrlabel-half'")
        for i in (3, 2, 1):
            f.locator('tr.regelrij').nth(i).get_by_role('button', name='omhoog').click()
            expect(f.locator('tr.regelrij').nth(i - 1).get_by_role('button', name='omhoog')).to_be_focused() if i > 1 else None
        expect(f.locator('tr.regelrij').first.locator('[data-veld="pad"]')).to_have_value('Portofoon')
        f.locator('select[data-standaard="bordje"]').select_option('bordje-liggend')
        f.get_by_role('button', name='Regel toevoegen').click()
        expect(f.locator('[data-melding="regels"]')).to_contain_text('telt niet mee')
        self.wacht_model("e.regels.bordje[0].pad === 'Portofoon' && e.regels.standaard.bordje === 'bordje-liggend'")
        uit = p.evaluate("""async () => {
            const { standaardSjabloon } = await import('./js/sjablonen.js');
            const r = model.effectief().regels;
            return { n: r.bordje.length, eerste: r.bordje[0], keys: r.bordje.map(x => Object.keys(x).sort().join(',')),
                     sj: ['CO1120', 'GE9402', 'PD5143', '*PD1011'].map(c => standaardSjabloon(T.A[c], 'bordje', r)) };
        }""")
        self.assertEqual(uit['n'], 4, 'lege regel telt niet mee')
        self.assertEqual(uit['eerste'], {'pad': 'Portofoon', 'sjabloon': 'qrlabel-half'})
        self.assertEqual(uit['sj'], ['qrlabel-half', 'gitterbox', 'pipe-drape', 'bordje-liggend'])
        f.locator('tr.regelrij').first.get_by_role('button', name='verwijderen').click()
        self.wacht_model("e.regels.bordje.length === 3 && !e.regels.bordje.some(r => r.pad === 'Portofoon')")
        self.assertEqual(self.fouten, [])

    def test_huisstijl_logo_upload(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('huisstijl')
        f = p.locator('#beheerForm')
        f.locator('#beheer-logo-bestand').set_input_files({'name': 'logo.png', 'mimeType': 'image/png', 'buffer': png()})
        self.wacht_model("String(e.huisstijl.logo).startsWith('data:image/png;base64,')")
        expect(f.locator('img[data-voor="logo"]')).to_have_attribute('src', re.compile('^data:image/png;base64,'))
        expect(p.locator('#beheerVoorbeeldDoel img[src^="data:image/png"]')).to_have_count(1)
        klein = self.model('e.huisstijl.logo')
        f.locator('#beheer-logo-bestand').set_input_files({'name': 'groot.png', 'mimeType': 'image/png', 'buffer': bytes(400 * 1024)})
        expect(f.locator('[data-melding="logo"]')).to_contain_text('300 kB')
        self.assertEqual(self.model('e.huisstijl.logo'), klein)
        f.locator('#beheer-certIcoon-bestand').set_input_files({'name': 'x.txt', 'mimeType': 'text/plain', 'buffer': b'hoi'})
        expect(f.locator('[data-melding="certIcoon"]')).to_contain_text('afbeelding')
        f.locator('#beheer-certIcoon-bestand').set_input_files({'name': 'cert.png', 'mimeType': 'image/png', 'buffer': png(3, 3)})
        self.wacht_model("String(e.huisstijl.certIcoon).startsWith('data:image/png;base64,')")
        f.locator('[data-huisstijl="voet"]').fill('Regel een\n\nRegel twee | info')
        self.wacht_model("JSON.stringify(e.huisstijl.voet) === JSON.stringify(['Regel een', 'Regel twee | info'])")
        f.get_by_label('Arial').check()
        self.wacht_model("e.huisstijl.lettertype === 'arial'")
        f.get_by_role('button', name='Logo weghalen').click()
        self.wacht_model('e.huisstijl.logo === null')
        self.assertTrue(self.model("String(e.huisstijl.certIcoon).startsWith('data:image/png')"))
        self.assertEqual(self.fouten, [])

    def test_eigen_lettertype_alleen_op_deze_pc(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('huisstijl')
        f = p.locator('#beheerForm')
        expect(f).to_contain_text('Wordt niet gepubliceerd')
        with open(os.path.join(ROOT, 'v2', 'fonts', 'jost-400.woff'), 'rb') as bestand:
            woff = bestand.read()
        f.locator('#beheer-font-bestand').set_input_files({'name': 'Mijn Letter.woff', 'mimeType': 'font/woff', 'buffer': woff})
        p.wait_for_function("async () => (await model.pcInstelling('eigenLettertype'))?.naam === 'Mijn Letter.woff'")
        expect(f).to_contain_text('Mijn Letter.woff')
        lengte = p.evaluate("async () => atob((await model.pcInstelling('eigenLettertype')).data).length")
        self.assertEqual(lengte, len(woff))
        self.assertNotIn('Mijn Letter', self.model('JSON.stringify(e)'))
        self.assertTrue(p.evaluate("""() => [...document.fonts].some(f => f.family.replace(/"/g, '') === 'DSL Eigen' && f.status === 'loaded')"""))
        f.get_by_label('Eigen lettertype').check()
        self.wacht_model("e.huisstijl.lettertype === 'eigen'")
        f.locator('#beheer-font-bestand').set_input_files({'name': 'kapot.ttf', 'mimeType': 'font/ttf', 'buffer': b'geen lettertype'})
        expect(f.locator('[data-melding="font"]')).to_contain_text('niet lezen')
        p.wait_for_function("async () => (await model.pcInstelling('eigenLettertype'))?.naam === 'Mijn Letter.woff'")
        f.get_by_role('button', name='Lettertype weghalen').click()
        p.wait_for_function("async () => (await model.pcInstelling('eigenLettertype')) === undefined")
        self.assertEqual(self.fouten, [])

    def test_printers(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('printers')
        f = p.locator('#beheerForm')
        expect(f.locator('[data-printer="label.naam"]')).to_have_value('Citizen CL-E321')
        f.locator('[data-printer="label.naam"]').fill('Zebra')
        f.locator('[data-printer="label.b"]').fill('100')
        f.locator('[data-printer="label.h"]').fill('50')
        f.locator('[data-printer="a4.naam"]').fill('Kantoor')
        self.wacht_model("e.printers.label.naam === 'Zebra' && e.printers.label.b === 100 && e.printers.label.h === 50 && e.printers.a4.naam === 'Kantoor'")
        f.locator('[data-printer="label.b"]').fill('0')
        f.locator('[data-printer="label.b"]').press('Tab')
        expect(f.locator('[data-melding="printers"]')).to_contain_text('tussen')
        p.wait_for_timeout(500)
        self.assertEqual(self.model('e.printers.label.b'), 100)
        self.assertEqual(self.fouten, [])

    def test_artikelen_inlezen_kolommen(self):
        p = self.pagina
        self.maak_model()
        self.start()
        self.open('kolommen')
        f = p.locator('#beheerForm')
        expect(f.get_by_label('Rentman')).to_be_checked()
        expect(f.locator('[data-kolom="naam"]')).to_be_disabled()
        expect(f.locator('[data-kolom="naam"]')).to_have_value('Naam (in database)')
        f.get_by_label('Eigen kolomnamen').check()
        expect(f.locator('[data-kolom="naam"]')).to_be_enabled()
        f.locator('[data-kolom="naam"]').fill('Omschrijving')
        f.locator('[data-kolom="code"]').fill('Nummer')
        self.wacht_model("e.kolommen.naam === 'Omschrijving' && e.kolommen.code === 'Nummer' && e.kolommen.qr === 'QR-codes / RFID'")
        uit = p.evaluate("""async () => {
            const { importeer, TOEGESTANE_VELDEN } = await import('./js/import.js');
            const k = model.effectief().kolommen;
            return { n: importeer([['Omschrijving', 'Nummer'], ['Kabel', 'K1']], k).artikelen.length,
                     vreemd: Object.keys(k).filter(x => !TOEGESTANE_VELDEN.includes(x)) };
        }""")
        self.assertEqual(uit, {'n': 1, 'vreemd': []})
        f.locator('[data-kolom="code"]').fill('')
        f.locator('[data-kolom="code"]').press('Tab')
        expect(f.locator('[data-melding="kolommen"]')).to_contain_text('nodig')
        f.get_by_label('Rentman').check()
        self.wacht_model("JSON.stringify(e.kolommen) === JSON.stringify({ naam: 'Naam (in database)', code: 'Code', qr: 'QR-codes / RFID', exemplaren: 'QR-codes / RFID exemplaren', pad: 'Pad', map: 'Map (Map)', locatie: 'Locatie in magazijn per voorraadlocatie [Standaard voorraadlocatie]', soort: 'Methode voorraadberekening', type: 'Type materiaal', aantal: 'Huidig aantal' })")
        expect(f.locator('[data-melding="kolommen"]')).to_have_text('')
        self.assertEqual(self.fouten, [])


if __name__ == '__main__':
    unittest.main()
