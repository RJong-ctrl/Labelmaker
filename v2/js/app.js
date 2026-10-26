// Opstarten: opslag van het DSL-profiel openen en het werkscherm starten.
import { openOpslag, vraagBlijvend } from './opslag.js';
import { start } from './werkscherm.js';

const opslag = await openOpslag('dsl');
vraagBlijvend();
await start(document, opslag);
