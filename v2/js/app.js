// Opstarten: opslag van het DSL-profiel openen en het werkscherm starten.
// Staat de browser geen opslag toe, dan werkt alles in het geheugen.
import { openOpslag, vraagBlijvend, GeheugenOpslag } from './opslag.js';
import { start } from './werkscherm.js';

let opslag, waarschuwing = '';
try {
  opslag = await openOpslag('dsl');
  vraagBlijvend();
} catch {
  opslag = new GeheugenOpslag();
  waarschuwing = 'Deze browser staat geen opslag toe (bijvoorbeeld in een privévenster). De Labelmaker werkt wel, maar slaat niets op: na het sluiten ben je alles kwijt.';
}
await start(document, opslag, { waarschuwing });
