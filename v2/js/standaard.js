// Profielstandaarden: waar een profiel mee begint, vóór basis en lokale wijzigingen.
// 'dsl' = DSL-sjablonen en -huisstijl met Rentman; 'basis' = neutraal profiel.

import { DSL_SJABLONEN, DSL_REGELS, vrijBordje, leegBordje, wandbord, kistbordje } from './sjablonen.js';
import { RENTMAN } from './import.js';

const kolom = (naam, k, verplicht = false) => ({ naam, soort: 'tekst', herkomst: { type: 'kolom', kolom: k }, verplicht });
const v = (veld) => ({ veld });
const leeg = { titel: [], groot: [], label: [], eigenschappen: [], onder: [] };
const basis = { gat: false, voet: false, logoBoven: false, kleuren: {}, cert: '' };

const bordje = vrijBordje;

const BASIS_SJABLONEN = [
  {
    ...basis, id: 'qrlabel', naam: 'QR-label', printer: 'label', opmaak: 'qrlabel', formaat: { b: 76, h: 56 },
    velden: [kolom('Naam', 'naam', true), kolom('Locatie', 'locatie')],
    plekken: { ...leeg, titel: [v('Naam')], onder: [v('Locatie')] },
  },
  {
    ...basis, id: 'locatie', naam: 'Locatielabel', printer: 'label', opmaak: 'locatie', formaat: { b: 76, h: 56 },
    velden: [kolom('Locatie', 'locatie', true), kolom('Naam', 'naam')],
    plekken: { ...leeg, titel: [v('Locatie')], onder: [v('Naam')], qr: [v('Locatie')] },
  },
  leegBordje('leeg-staand', 'Leeg bordje staand', 'staand', 74, 105),
  leegBordje('leeg-liggend', 'Leeg bordje liggend', 'liggend', 105, 74),
  bordje('bordje-staand', 'Bordje staand', 'staand', 74, 105),
  bordje('bordje-liggend', 'Bordje liggend', 'liggend', 105, 74),
  bordje('strook', 'Strook', 'strook', 180, 48, { logoBoven: true, plekken: { ...leeg, titel: [v('Naam')], groot: [v('Groot')], onder: ['Code ', v('Code')] } }),
  wandbord('wandbord-staand', 'Wandbord A4 staand', 194, 281),
  wandbord('wandbord-liggend', 'Wandbord A4 liggend', 281, 194),
  wandbord('wandbord-a5-staand', 'Wandbord A5 staand', 136, 194),
  wandbord('wandbord-a5-liggend', 'Wandbord A5 liggend', 194, 136),
  kistbordje('kist', 'Materiaalbordje kist (A5)'),
  kistbordje('kist-modern', 'Materiaalbordje kist modern (A5)', 'kist-modern'),
];

export const HUISSTIJL_DSL_PROFIEL = {
  logo: 'assets/dsl-logo.svg',
  voet: [
    'DSL Geluids- & Lichtverhuur, De Fok 23, 1742 PC Schagen',
    'Tel. 0224-218130 | info@dslverhuur.nl | www.dslverhuur.nl',
  ],
  certIcoon: null,
  lettertype: 'futura',
};

export const PROFIEL_STANDAARD = {
  dsl: {
    sjablonen: DSL_SJABLONEN,
    regels: DSL_REGELS,
    huisstijl: HUISSTIJL_DSL_PROFIEL,
    printers: { label: { naam: 'Citizen CL-E321', b: 76, h: 56 }, a4: { naam: 'A4-printer' } },
    kolommen: RENTMAN,
  },
  basis: {
    sjablonen: BASIS_SJABLONEN,
    regels: { bordje: [], standaard: { bordje: 'bordje-staand', qrlabel: 'qrlabel', locatie: 'locatie' } },
    huisstijl: { logo: null, voet: [], certIcoon: null, lettertype: 'futura' },
    printers: { label: { naam: 'Labelprinter', b: 76, h: 56 }, a4: { naam: 'A4-printer' } },
    kolommen: { naam: 'Naam', code: 'Code', qr: 'QR', exemplaren: 'Exemplaren', locatie: 'Locatie', map: 'Categorie' },
  },
};
