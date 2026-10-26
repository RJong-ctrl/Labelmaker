// Excel (.xlsx) en csv lezen tot een tabel met tekst: string[][].
// Werkt in de browser en in Node 22 (geen DOMParser, geen bibliotheken).

const ENTITEITEN = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function ontsleutel(s) {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) =>
      e[0] === '#'
        ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
        : ENTITEITEN[e.toLowerCase()])
    .replace(/_x([0-9a-f]{4})_/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Tekst uit alle <t>-elementen, zonder fonetische hulptekst (<rPh>). */
function tekstVan(xml) {
  const zonderRph = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let uit = '';
  for (const m of zonderRph.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) uit += m[1];
  return ontsleutel(uit);
}

function attribuut(tag, naam) {
  const m = new RegExp('\\s' + naam + '="([^"]*)"').exec(tag);
  return m ? ontsleutel(m[1]) : null;
}

function getal(v) {
  if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v)) return v;
  return String(Number(Number(v).toPrecision(15)));
}

function kolomNummer(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

async function pakUit(buffer) {
  const u = new Uint8Array(buffer), dv = new DataView(buffer);
  let einde = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { einde = i; break; }
  }
  if (einde < 0) throw new Error('Dit is geen geldig Excel-bestand (.xlsx).');
  const aantal = dv.getUint16(einde + 10, true);
  let p = dv.getUint32(einde + 16, true);
  const td = new TextDecoder();
  const bestanden = {};
  for (let k = 0; k < aantal; k++) {
    const methode = dv.getUint16(p + 10, true), grootte = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    bestanden[td.decode(u.subarray(p + 46, p + 46 + nl))] = { methode, grootte, offset };
    p += 46 + nl + xl + cl;
  }
  return async (naam) => {
    const f = bestanden[naam];
    if (!f) return null;
    const start = f.offset + 30 + dv.getUint16(f.offset + 26, true) + dv.getUint16(f.offset + 28, true);
    const data = u.subarray(start, start + f.grootte);
    if (f.methode === 0) return td.decode(data);
    const stroom = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stroom).text();
  };
}

/** Eerste werkblad van een .xlsx als tabel met tekst. */
export async function leesXlsx(buffer) {
  const lees = await pakUit(buffer);
  const gedeeld = [];
  const sst = await lees('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) gedeeld.push(m[1] ? tekstVan(m[1]) : '');

  let pad = 'xl/worksheets/sheet1.xml';
  const wb = await lees('xl/workbook.xml'), rels = await lees('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const blad = /<sheet\b[^>]*>/.exec(wb);
    const rid = blad && attribuut(blad[0], '\\w+:id');
    for (const r of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      if (attribuut(r[0], 'Id') !== rid) continue;
      let doel = attribuut(r[0], 'Target');
      doel = doel.startsWith('/') ? doel.slice(1) : 'xl/' + doel;
      pad = doel;
    }
  }
  const xml = await lees(pad);
  if (!xml) throw new Error('Geen werkblad gevonden in dit Excel-bestand.');

  const rijen = [];
  const data = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(xml);
  for (const rm of (data ? data[1] : '').matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rij = [];
    let kol = 0;
    for (const cm of (rm[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attribuut(cm[1], 'r');
      if (ref) kol = kolomNummer(ref);
      const type = attribuut(cm[1], 't');
      const inhoud = cm[2] || '';
      let waarde = '';
      if (type === 'inlineStr') waarde = tekstVan(inhoud);
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inhoud);
        waarde = v ? ontsleutel(v[1]) : '';
        if (type === 's') waarde = gedeeld[+waarde] ?? '';
        else if (!type || type === 'n') waarde = getal(waarde);
      }
      rij[kol] = waarde;
      kol++;
    }
    rijen.push(rij);
  }
  const breedte = Math.max(0, ...rijen.map(r => r.length));
  for (const r of rijen) for (let i = 0; i < breedte; i++) if (r[i] === undefined) r[i] = '';
  return rijen;
}

function scheidingsteken(tekst) {
  let inQuote = false;
  const tel = { ';': 0, '\t': 0, ',': 0 };
  for (const ch of tekst) {
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && (ch === '\n' || ch === '\r')) break;
    else if (!inQuote && ch in tel) tel[ch]++;
  }
  return Object.keys(tel).reduce((a, b) => (tel[b] > tel[a] ? b : a), ';');
}

/** Csv met ; , of tab (bepaald op de eerste regel), aanhalingstekens en "" binnen velden. */
export function leesCsv(tekst) {
  if (tekst.charCodeAt(0) === 0xfeff) tekst = tekst.slice(1);
  const sep = scheidingsteken(tekst);
  const rijen = [];
  let rij = [], veld = '', inQuote = false;
  for (let i = 0; i < tekst.length; i++) {
    const ch = tekst[i];
    if (inQuote) {
      if (ch === '"') {
        if (tekst[i + 1] === '"') { veld += '"'; i++; } else inQuote = false;
      } else veld += ch;
    } else if (ch === '"') inQuote = true;
    else if (ch === sep) { rij.push(veld); veld = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && tekst[i + 1] === '\n') i++;
      rij.push(veld); rijen.push(rij); rij = []; veld = '';
    } else veld += ch;
  }
  if (veld !== '' || rij.length) { rij.push(veld); rijen.push(rij); }
  return rijen;
}

/** Leest een gekozen bestand op extensie. Csv uit Excel kan Windows-1252 zijn. */
export async function leesBestand(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'xlsx') return leesXlsx(await file.arrayBuffer());
  if (ext === 'csv' || ext === 'txt') {
    const bytes = await file.arrayBuffer();
    let tekst;
    try { tekst = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { tekst = new TextDecoder('windows-1252').decode(bytes); }
    return leesCsv(tekst);
  }
  throw new Error('Kies een Excel- (.xlsx) of csv-bestand.');
}
