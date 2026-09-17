// ===========================================================================
// test/run.mjs — Kopftest ohne npm. Aufruf: node test/run.mjs
//
// Wichtig: der Runner baut NICHT über build.mjs, sondern konkateniert
// `src/main/*.js` selbst (Dateinamen-Reihenfolge, wie build.mjs). So testet er
// immer den QUELLSTAND, auch wenn code.js gerade veraltet ist.
//
// Die Tests sind gegen den Zielzustand aus ARCHITEKTUR.md (v2 + Runde 3)
// geschrieben, behandeln den Ist-Stand aber tolerant, wo das sinnvoll ist:
// `konfigValidieren().fehler` darf String ODER { pfad, text } liefern — der
// Test sagt, welche Form er vorgefunden hat.
// ===========================================================================

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { stubFigma, HTML_STUB } from './stub-figma.mjs';

const WURZEL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(WURZEL, 'src', 'main');

// --- Mini-Runner -----------------------------------------------------------

let anzOk = 0, anzFail = 0, anzUeber = 0;
const fehlschlaege = [];

function test(name, fn) {
  try {
    const r = fn();
    if (r === 'skip') { anzUeber++; console.log('  ~  ' + name + ' (übersprungen)'); return; }
    anzOk++; console.log('  ok ' + name);
  } catch (e) {
    anzFail++;
    fehlschlaege.push({ name, grund: (e && e.message) || String(e) });
    console.log('  FAIL ' + name + '\n       ' + ((e && e.message) || String(e)));
  }
}

function gruppe(titel) { console.log('\n— ' + titel + ' ' + '—'.repeat(Math.max(0, 62 - titel.length))); }

function ok(bed, meldung) { if (!bed) throw new Error(meldung || 'Bedingung nicht erfüllt'); }
function gleich(ist, soll, was) {
  if (ist !== soll) throw new Error((was || 'Wert') + ': ist ' + JSON.stringify(ist) + ', erwartet ' + JSON.stringify(soll));
}
function nah(ist, soll, was, eps = 1e-9) {
  if (!(Math.abs(ist - soll) < eps)) throw new Error((was || 'Wert') + ': ist ' + ist + ', erwartet ' + soll);
}
function wirft(fn, code, was) {
  let e = null;
  try { fn(); } catch (err) { e = err; }
  if (!e) throw new Error((was || 'Aufruf') + ' hat nicht geworfen');
  if (code && e.code !== code) throw new Error((was || 'Aufruf') + ' warf ' + (e.code || e.message) + ', erwartet ' + code);
  return e;
}

// --- Quellen laden ---------------------------------------------------------

const dateien = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
const quellen = new Map();
for (const f of dateien) quellen.set(f, fs.readFileSync(path.join(SRC, f), 'utf8'));

const uiLogikDir = path.join(WURZEL, 'src', 'ui', 'logik');
const uiQuelle = fs.existsSync(uiLogikDir)
  ? fs.readdirSync(uiLogikDir).filter(f => f.endsWith('.js')).sort().map(f => fs.readFileSync(path.join(uiLogikDir, f), 'utf8')).join('\n')
  : fs.readFileSync(path.join(WURZEL, 'gen-ui.mjs'), 'utf8');
const mainQuelle = quellen.get('70-main.js') || '';

// Syntaxprüfung je Datei — so steht im Fehlerfall der DATEINAME im Protokoll.
gruppe('Quellen');
let syntaxOk = true;
for (const f of dateien) {
  test('Syntax ' + f, () => {
    try { new vm.Script(quellen.get(f), { filename: f }); }
    catch (e) { syntaxOk = false; throw new Error(f + ': ' + e.message); }
  });
}

const konkat = dateien.map(f => '// ===== ' + f + ' =====\n' + quellen.get(f).trim() + '\n').join('\n');

// Ein Scope, wie in Figma. `hol`/`setz` reichen Namen über direktes eval
// heraus — so bricht der Runner nicht, wenn eine erwartete Funktion (noch)
// fehlt: `hol('planen')` liefert dann einfach undefined.
let API = null, STUB = null, ladeFehler = null;
if (syntaxOk) {
  try {
    STUB = stubFigma();
    const fabrik = new Function('figma', '__html__', konkat +
      '\n;return { hol: function (n) { try { return eval(n); } catch (e) { return undefined; } },' +
      '          setz: function (n, v) { try { eval(n + " = v"); return true; } catch (e) { return false; } } };');
    API = fabrik(STUB.figma, HTML_STUB);
  } catch (e) { ladeFehler = e; }
}

test('src/main lädt in einem Scope', () => {
  ok(syntaxOk, 'mindestens eine Quelldatei ist syntaktisch kaputt (siehe oben)');
  ok(!ladeFehler, 'Laden warf: ' + (ladeFehler && ladeFehler.message));
  ok(API, 'kein API-Handle');
});

const H = n => (API ? API.hol(n) : undefined);
const S = (n, v) => (API ? API.setz(n, v) : false);
const braucht = n => { const v = H(n); if (v === undefined) throw new Error('`' + n + '` existiert (noch) nicht im Quellstand'); return v; };

// ===========================================================================
// Konfiguration
// ===========================================================================
gruppe('Konfiguration');

// Fehlerform tolerant lesen: String (v2) oder { pfad, text } (Runde 3).
function fehlerForm(liste) {
  if (!Array.isArray(liste) || !liste.length) return 'leer';
  return liste.every(f => f && typeof f === 'object' && 'pfad' in f) ? 'objekt'
       : liste.every(f => typeof f === 'string') ? 'string' : 'gemischt';
}
function fehlerText(f) { return typeof f === 'string' ? f : (f && f.text) || String(f); }

test('PROFIL_NAMEN enthält die fünf Profile aus Runde 3', () => {
  const namen = braucht('PROFIL_NAMEN');
  const soll = ['zds', 'generic', 'material', 'lucide', 'apple'];
  const fehlt = soll.filter(n => namen.indexOf(n) < 0);
  ok(!fehlt.length, 'PROFIL_NAMEN = [' + namen.join(', ') + '] — es fehlen: ' + fehlt.join(', '));
});

test('jedes Profil in PROFIL_NAMEN validiert fehlerfrei', () => {
  const namen = braucht('PROFIL_NAMEN');
  const defaults = braucht('konfigDefaults');
  const val = braucht('konfigValidieren');
  const schlecht = [];
  namen.forEach(n => {
    const d = defaults(n);
    ok(d && typeof d === 'object', 'konfigDefaults("' + n + '") liefert nichts');
    const r = val(d);
    if (r.fehler.length) schlecht.push(n + ': ' + r.fehler.map(fehlerText).join(' | '));
  });
  ok(!schlecht.length, 'Profile mit Meldungen:\n       ' + schlecht.join('\n       '));
});

test('jedes Profil hat genau eine Standardgröße und aufsteigende N', () => {
  const namen = braucht('PROFIL_NAMEN');
  const defaults = braucht('konfigDefaults');
  namen.forEach(n => {
    const d = defaults(n);
    const std = d.groessen.filter(g => g.standard);
    gleich(std.length, 1, n + ': Anzahl Standardgrößen');
    const Ns = d.groessen.map(g => g.N);
    gleich(Ns.slice().sort((a, b) => a - b).join(), Ns.join(), n + ': Größen sortiert');
    gleich(new Set(Ns).size, Ns.length, n + ': Größen eindeutig');
  });
});

test('konfigDefaults liefert eine tiefe Kopie', () => {
  const defaults = braucht('konfigDefaults');
  const a = defaults('generic'), b = defaults('generic');
  a.groessen[0].kontur = 99;
  ok(b.groessen[0].kontur !== 99, 'konfigDefaults teilt Objekte zwischen Aufrufen');
});

test('kaputte Konfig wird repariert', () => {
  const val = braucht('konfigValidieren');
  const kaputt = {
    adapter: 'quatsch', sprache: 'fr', variantenProperty: '   ',
    master: { groesse: -3, kontur: 'x' },
    groessen: [{ N: 20.5 }, { N: 16, kontur: -1, raster: 0.3, rasterGrob: 0.25, radius: { modus: 'x' } }, { N: 16 }],
    farbe: { modus: 'hex', hex: 'zzz' }
  };
  const r = val(kaputt);
  gleich(r.ok, false, 'ok-Flag');
  ok(r.fehler.length >= 6, 'nur ' + r.fehler.length + ' Meldungen — erwartet ≥ 6');
  const k = r.konfig;
  const Ns = k.groessen.map(g => g.N);
  ok(Ns.length >= 1, 'keine Größe übrig');
  gleich(new Set(Ns).size, Ns.length, 'Dublette N=16 nicht entfernt (' + Ns.join(', ') + ')');
  ok(Ns.every(N => Number.isInteger(N) && N > 0), 'nicht-ganzzahliges N überlebt: ' + Ns.join(', '));
  gleich(Ns.slice().sort((a, b) => a - b).join(), Ns.join(), 'Größen nicht sortiert');
  gleich(k.groessen.filter(g => g.standard).length, 1, 'genau eine Standardgröße');
  k.groessen.forEach(g => {
    ok([1, 0.5, 0.25].indexOf(g.raster) >= 0, 'raster nicht geclampt: ' + g.raster);
    ok(g.kontur > 0, 'kontur nicht repariert: ' + g.kontur);
    ok(['proportional', 'fest', 'keine'].indexOf(g.radius.modus) >= 0, 'radius.modus nicht repariert');
    ok(g.rasterGrob === null || g.rasterGrob > g.raster, 'rasterGrob feiner als raster überlebt');
  });
  const g16 = k.groessen.find(g => g.N === 16);
  ok(g16, 'N=16 verschwunden');
  gleich(g16.raster, 0.25, 'raster 0.3 → nächster erlaubter Wert');
  ok(k.master.groesse > 0 && k.master.kontur > 0, 'Master repariert');
  ok(['auto', 'zds', 'frei'].indexOf(k.adapter) >= 0, 'Adapter repariert');
  ok(String(k.variantenProperty).trim().length > 0, 'Variantenproperty repariert');
  gleich(k.farbe.hex, '#444444', 'ungültiger Hex ersetzt');
});

test('konfigValidieren: jeder Fehler trägt einen `pfad` (Runde 3)', () => {
  const val = braucht('konfigValidieren');
  const r = val({ adapter: 'quatsch', master: { groesse: -1 }, groessen: [], farbe: { modus: 'hex', hex: 'zzz' } });
  const form = fehlerForm(r.fehler);
  if (form === 'string') {
    throw new Error('fehler[] ist noch die v2-Form (reine Strings) — Runde 3 verlangt [{ pfad, text }]. '
      + 'Beispiel: ' + JSON.stringify(r.fehler[0]));
  }
  ok(form === 'objekt', 'fehler[] ist ' + form + ' — erwartet durchgängig { pfad, text }');
  const ohne = r.fehler.filter(f => !f.pfad || !String(f.pfad).trim());
  ok(!ohne.length, ohne.length + ' Meldung(en) ohne `pfad`: ' + JSON.stringify(ohne));
  const ohneText = r.fehler.filter(f => !f.text || !String(f.text).trim());
  ok(!ohneText.length, ohneText.length + ' Meldung(en) ohne `text`');
});

test('Fehlerpfade zeigen auf die erwarteten Felder', () => {
  const val = braucht('konfigValidieren');
  if (fehlerForm(val({ adapter: 'x' }).fehler) !== 'objekt') return 'skip';
  const r = val({ adapter: 'x', groessen: [{ N: 16, kontur: -1, standard: true }], farbe: { modus: 'hex', hex: 'zzz' } });
  const pfade = r.fehler.map(f => f.pfad);
  ok(pfade.indexOf('adapter') >= 0, 'kein Fehler mit pfad "adapter" — gefunden: ' + pfade.join(', '));
  ok(pfade.some(p => /^groessen\.\d+\.kontur$/.test(p)), 'kein Fehler mit pfad "groessen.<i>.kontur" — gefunden: ' + pfade.join(', '));
  ok(pfade.indexOf('farbe.hex') >= 0, 'kein Fehler mit pfad "farbe.hex" — gefunden: ' + pfade.join(', '));
});

test('leere Größenliste meldet pfad "groessen"', () => {
  const val = braucht('konfigValidieren');
  const r = val({ groessen: [] });
  if (fehlerForm(r.fehler) !== 'objekt') return 'skip';
  ok(r.fehler.some(f => f.pfad === 'groessen'), 'kein Fehler mit pfad "groessen" — gefunden: ' + r.fehler.map(f => f.pfad).join(', '));
});

test('CFG.schreiben mit konservativen Standardwerten (Runde 3)', () => {
  const val = braucht('konfigValidieren');
  const defaults = braucht('konfigDefaults');
  const k = val(defaults('generic')).konfig;
  ok(k.schreiben && typeof k.schreiben === 'object', 'CFG.schreiben fehlt (Abschnitt 14)');
  gleich(k.schreiben.frameUmwandeln, false, 'schreiben.frameUmwandeln');
  gleich(k.schreiben.strokeHeimAnlegen, true, 'schreiben.strokeHeimAnlegen');
});

test('konfigProfilInfo() beschreibt alle Profile (Runde 3)', () => {
  const info = braucht('konfigProfilInfo');
  const namen = braucht('PROFIL_NAMEN');
  const liste = info();
  ok(Array.isArray(liste), 'konfigProfilInfo() liefert kein Array');
  gleich(liste.length, namen.length, 'Anzahl Einträge');
  liste.forEach(e => {
    ok(e && e.name && e.titel && e.beschreibung, 'unvollständiger Eintrag: ' + JSON.stringify(e));
    ok(!/^profil\./.test(e.titel), 'Titel für "' + e.name + '" ist ein unübersetzter Schlüssel: ' + e.titel);
    ok(!/^profil\./.test(e.beschreibung), 'Beschreibung für "' + e.name + '" ist ein unübersetzter Schlüssel');
  });
});

test('variantenName folgt CFG.variantenProperty', () => {
  const val = braucht('konfigValidieren');
  const defaults = braucht('konfigDefaults');
  const vn = braucht('variantenName');
  const k = val(defaults('generic')).konfig;
  S('CFG', k);
  gleich(vn(24), 'Size=24', 'variantenName(24)');
  k.variantenProperty = 'Größe'; S('CFG', k);
  gleich(vn(16), 'Größe=16', 'variantenName mit eigener Property');
  k.variantenProperty = 'Size'; S('CFG', k);
});

test('groesseCfg wirft GROESSE_UNBEKANNT', () => {
  const val = braucht('konfigValidieren');
  const defaults = braucht('konfigDefaults');
  const gc = braucht('groesseCfg');
  S('CFG', val(defaults('generic')).konfig);
  ok(gc(24) && gc(24).N === 24, 'groesseCfg(24) liefert die 24er nicht');
  const e = wirft(() => gc(999), 'GROESSE_UNBEKANNT', 'groesseCfg(999)');
  ok(!/\{/.test(e.message), 'Platzhalter blieb stehen: ' + e.message);
});

// ===========================================================================
// i18n
// ===========================================================================
gruppe('i18n');

const PLATZ = s => new Set((String(s).match(/\{(\w+)\}/g) || []));

test('de und en haben denselben Schlüsselsatz', () => {
  const SPRACHEN = braucht('SPRACHEN');
  const de = Object.keys(SPRACHEN.de), en = Object.keys(SPRACHEN.en);
  const fehltEn = de.filter(k => !(k in SPRACHEN.en));
  const fehltDe = en.filter(k => !(k in SPRACHEN.de));
  ok(!fehltEn.length && !fehltDe.length,
    (fehltEn.length ? 'nur in de: ' + fehltEn.join(', ') + '\n       ' : '') +
    (fehltDe.length ? 'nur in en: ' + fehltDe.join(', ') : ''));
});

test('gleiche Platzhalter in de und en', () => {
  const SPRACHEN = braucht('SPRACHEN');
  const schief = [];
  Object.keys(SPRACHEN.de).forEach(k => {
    if (!(k in SPRACHEN.en)) return;
    const a = PLATZ(SPRACHEN.de[k]), b = PLATZ(SPRACHEN.en[k]);
    const nurA = [...a].filter(x => !b.has(x)), nurB = [...b].filter(x => !a.has(x));
    if (nurA.length || nurB.length) schief.push(k + ' (de: ' + [...a].join('') + ' / en: ' + [...b].join('') + ')');
  });
  ok(!schief.length, 'Platzhalter weichen ab:\n       ' + schief.join('\n       '));
});

test('jeder FEHLER_CODE hat fehler.<CODE> und hinweis.<CODE> in de und en', () => {
  const SPRACHEN = braucht('SPRACHEN');
  const codes = braucht('FEHLER_CODES');
  const fehlt = [];
  codes.forEach(c => ['de', 'en'].forEach(sp => {
    if (SPRACHEN[sp]['fehler.' + c] === undefined) fehlt.push(sp + ': fehler.' + c);
    if (SPRACHEN[sp]['hinweis.' + c] === undefined) fehlt.push(sp + ': hinweis.' + c);
  }));
  ok(!fehlt.length, fehlt.join(', '));
});

test('FEHLER_CODES enthält die neuen Codes aus Runde 3', () => {
  const codes = braucht('FEHLER_CODES');
  const neu = ['GESPERRT', 'FRAME_NICHT_ERLAUBT', 'STROKEHEIM_AUS', 'ABGEBROCHEN', 'EXPORT_FEHLT'];
  const fehlt = neu.filter(c => codes.indexOf(c) < 0);
  ok(!fehlt.length, 'FEHLER_CODES fehlen: ' + fehlt.join(', '));
});

test('Zusatz-Texte aus 06-i18n-zusatz.js hängen in SPRACHEN', () => {
  if (!quellen.has('06-i18n-zusatz.js')) throw new Error('src/main/06-i18n-zusatz.js existiert (noch) nicht');
  const SPRACHEN = braucht('SPRACHEN');
  const q = quellen.get('06-i18n-zusatz.js');
  const schluessel = [...q.matchAll(/^\s*'([a-zA-Z][\w.]*)'\s*:/gm)].map(m => m[1]);
  ok(schluessel.length, 'keine Schlüssel in 06-i18n-zusatz.js gefunden');
  const fehlt = schluessel.filter(k => SPRACHEN.de[k] === undefined && SPRACHEN.en[k] === undefined);
  ok(!fehlt.length, 'nicht in SPRACHEN angekommen (Object.assign vergessen?): ' + fehlt.slice(0, 10).join(', '));
});

test('t() ersetzt Platzhalter und lässt kein "{" stehen', () => {
  const SPRACHEN = braucht('SPRACHEN');
  const t = braucht('t');
  const setz = braucht('spracheSetzen');
  const uebrig = [];
  ['de', 'en'].forEach(sp => {
    setz(sp, null);
    Object.keys(SPRACHEN[sp]).forEach(k => {
      const params = {};
      [...PLATZ(SPRACHEN[sp][k])].forEach(p => { params[p.slice(1, -1)] = 'X'; });
      const s = t(k, params);
      if (/\{/.test(s)) uebrig.push(sp + ' ' + k + ' → ' + s);
      // Nur gepunktete Schlüssel prüfen: Einzelwörter wie 'und' sind in de mit
      // sich selbst übersetzt und wären sonst falsch-positiv.
      if (s === k && k.indexOf('.') >= 0) uebrig.push(sp + ' ' + k + ' → unübersetzt');
    });
  });
  setz('en', null);
  ok(!uebrig.length, uebrig.slice(0, 10).join('\n       '));
});

test('t() fällt für unbekannte Schlüssel auf den Schlüssel zurück', () => {
  const t = braucht('t');
  gleich(t('gibt.es.nicht'), 'gibt.es.nicht', 'Rückfall');
});

test('spracheSetzen: auto folgt der UI-Sprache', () => {
  const setz = braucht('spracheSetzen');
  gleich(setz('auto', 'de-DE'), 'de', 'auto + de-DE');
  gleich(setz('auto', 'en-GB'), 'en', 'auto + en-GB');
  gleich(setz('auto', null), 'en', 'auto ohne UI-Sprache → en');
  gleich(setz('de', 'en-US'), 'de', 'feste Sprache schlägt UI');
  setz('en', null);
});

test('PipelineFehler trägt Code, Message und Hinweis', () => {
  const PF = braucht('PipelineFehler');
  braucht('spracheSetzen')('de', null);
  const e = new PF('FIT_FEHLT', { name: 'mail', N: 14 }, 'n:1');
  gleich(e.code, 'FIT_FEHLT', 'code');
  gleich(e.nodeId, 'n:1', 'nodeId');
  ok(e.message.indexOf('mail') >= 0, 'Name nicht eingesetzt: ' + e.message);
  ok(!/\{/.test(e.message) && !/\{/.test(e.hinweis), 'Platzhalter blieb stehen');
  braucht('spracheSetzen')('en', null);
});

// ===========================================================================
// Snapping (Regression gegen die v1-Formeln)
// ===========================================================================
gruppe('Snapping');

const R05 = { raster: 0.5, rasterGrob: null };
const R025 = { raster: 0.25, rasterGrob: null };
const RGROB = { raster: 0.5, rasterGrob: 1 };

test('SNAP.GROB_TOLERANZ === 0.35', () => nah(braucht('SNAP').GROB_TOLERANZ, 0.35, 'GROB_TOLERANZ'));

test('rund() rundet auf Raster mit Phase', () => {
  const rund = braucht('rund');
  nah(rund(6.3, 0.5), 6.5, 'rund(6.3, .5)');
  nah(rund(6.3, 1), 6, 'rund(6.3, 1)');
  nah(rund(6.3, 0.25), 6.25, 'rund(6.3, .25)');
  nah(rund(6.3, 0.5, 0.25), 6.25, 'rund(6.3, .5, .25)');
});

test('rund() ist bitgleich zur alten Halb-/Ganz-Rundung (4000 Zufallswerte)', () => {
  const rund = braucht('rund');
  for (let i = 0; i < 4000; i++) {
    const w = Math.random() * 48 - 24, p = [0, 0.25, 0.1][i % 3];
    if (rund(w, 0.5, p) !== Math.round((w - p) * 2) / 2 + p) throw new Error('rund(' + w + ', .5, ' + p + ') weicht ab');
    if (rund(w, 1, p) !== Math.round(w - p) + p) throw new Error('rund(' + w + ', 1, ' + p + ') weicht ab');
  }
});

test('Phase einer Kontur = (w/2) % raster', () => {
  nah((1.5 / 2) % 0.5, 0.25, 'Kontur 1.5 @ .5');
  nah((1.5 / 2) % 0.25, 0, 'Kontur 1.5 @ .25');
  nah((2 / 2) % 0.5, 0, 'Kontur 2 @ .5');
});

test('snapWert: Kontur 1.5 @ Raster 0.5 landet auf x.25 / x.75', () => {
  const sw = braucht('snapWert');
  const p = (1.5 / 2) % 0.5;
  nah(sw(6.2, p, R05), 6.25, 'snapWert(6.2)');
  nah(sw(6.6, p, R05), 6.75, 'snapWert(6.6)');
  nah(sw(11.9, p, R05), 11.75, 'snapWert(11.9)');
  for (const v of [3.1, 5.44, 9.87, 12.03, 17.6]) {
    const rest = ((sw(v, p, R05) % 1) + 1) % 1;
    ok(rest === 0.25 || rest === 0.75, 'snapWert(' + v + ') → Rest ' + rest);
  }
});

test('snapWert: Kontur 1.5 @ Raster 0.25 → Phase 0, Viertelpixel', () => {
  const sw = braucht('snapWert');
  const p = (1.5 / 2) % 0.25;
  nah(p, 0, 'Phase');
  nah(sw(6.2, p, R025), 6.25, 'snapWert(6.2)');
  nah(sw(6.6, p, R025), 6.5, 'snapWert(6.6)');
});

test('snapWert: grobes Raster 1 mit Toleranz 0.35', () => {
  const sw = braucht('snapWert');
  nah(sw(6.3, 0, RGROB), 6, '6.3 → grob (Weg 0.30)');
  nah(sw(6.45, 0, RGROB), 6.5, '6.45 → fein (Weg 0.45 > 0.35)');
  nah(sw(6.35, 0, RGROB), 6, '6.35 → grob (Weg genau 0.35)');
  nah(sw(6.45, 0, R05), 6.5, '6.45 ohne grob');
});

test('snapWert === alter snapWert (N===24 ⇔ rasterGrob 1), 20000 Zufallswerte', () => {
  const sw = braucht('snapWert');
  const alt = (wert, phase, N) => {
    const halb = Math.round((wert - phase) * 2) / 2 + phase;
    if (N === 24) { const ganz = Math.round(wert - phase) + phase; if (Math.abs(ganz - wert) <= 0.35) return ganz; }
    return halb;
  };
  for (let i = 0; i < 20000; i++) {
    const w = Math.random() * 24, p = [0, 0.25, (1.5 / 2) % 0.5, (2 / 2) % 0.5][i % 4];
    for (const N of [14, 18, 24]) {
      const rc = { raster: 0.5, rasterGrob: N === 24 ? 1 : null };
      if (sw(w, p, rc) !== alt(w, p, N)) throw new Error('N=' + N + ' w=' + w + ' p=' + p + ': ' + sw(w, p, rc) + ' ≠ ' + alt(w, p, N));
    }
  }
});

test('gapZiel/rasterbar identisch zum alten Code (20000 Zufallswerte)', () => {
  const sw = braucht('snapWert');
  for (let i = 0; i < 20000; i++) {
    const g = Math.random() * 8;
    const neu = sw(g, 0, RGROB), alt = Math.round(g * 2) / 2;
    const rb = Math.abs(neu - g) <= 0.02, rbAlt = Math.abs(alt - g) <= 0.02;
    if (rb !== rbAlt) throw new Error('rasterbar weicht ab bei g=' + g);
    if (rb && neu !== alt) throw new Error('Ziel weicht ab bei g=' + g);
  }
});

test('snap_rc normalisiert defensiv auf das alte Verhalten', () => {
  const rc = braucht('snap_rc');
  gleich(rc(null).raster, 0.5, 'ohne Konfig → 0.5');
  gleich(rc(null).rasterGrob, null, 'ohne Konfig → kein grobes Raster');
  gleich(rc({ raster: 0, rasterGrob: 0 }).raster, 0.5, 'raster 0 → 0.5');
});

// ===========================================================================
// Kleinteile
// ===========================================================================
gruppe('Namen und Farben');

test('freiNameBereinigen(".mail (72px source)") === "mail"', () => {
  const f = braucht('freiNameBereinigen');
  gleich(f('.mail (72px source)'), 'mail', 'Punkt + Klammerzusatz');
  gleich(f('  arrow-right  '), 'arrow-right', 'trimmen');
  gleich(f('..chevron (24)'), 'chevron', 'mehrere Punkte');
  gleich(f(null), '', 'null');
});

test('hexZuRgb / rgbZuHex Rundreise', () => {
  const zuRgb = braucht('hexZuRgb'), zuHex = braucht('rgbZuHex');
  ['#000000', '#ffffff', '#444444', '#1e1e1e', '#ff0080', '#0a0b0c'].forEach(h => {
    gleich(zuHex(zuRgb(h)), h, 'Rundreise ' + h);
  });
  const c = zuRgb('#ff0000');
  nah(c.r, 1, 'r'); nah(c.g, 0, 'g'); nah(c.b, 0, 'b');
  gleich(zuHex(zuRgb('#abc')), '#aabbcc', 'Kurzform');
  gleich(zuHex(null), null, 'rgbZuHex(null)');
});

test('variantenN liest N aus dem Variantennamen', () => {
  const vn = braucht('variantenN');
  gleich(vn('Size=24'), 24, 'Size=24');
  gleich(vn('Größe = 18'), 18, 'mit Leerzeichen');
  gleich(vn('Stroke'), null, 'kein Variantenname');
});

// ===========================================================================
// Protokoll-Vertrag UI ↔ Main
// ===========================================================================
gruppe('Protokoll-Vertrag');

// Main empfängt:  m.type === '…' in 70-main.js
// Main sendet:    ui({ type: '…' …}) / ui(Object.assign({ type: '…' }…)) in src/main/*.js
// UI sendet:      send({ type: '…' …}) in gen-ui.mjs
// UI empfängt:    m.type === '…' in gen-ui.mjs
const treffer = (re, txt) => [...String(txt).matchAll(re)].map(m => m[1]);
const einmalig = a => [...new Set(a)].sort();

const mainEmpfaengt = einmalig(treffer(/\bm\.type\s*===\s*'([^']+)'/g, mainQuelle));
const mainSendet = einmalig(dateien.flatMap(f =>
  treffer(/\bui\(\s*(?:Object\.assign\(\s*)?\{\s*type:\s*'([^']+)'/g, quellen.get(f))));
const uiSendet = einmalig(treffer(/\bsend\(\s*\{\s*type:\s*'([^']+)'/g, uiQuelle));
const uiEmpfaengt = einmalig(treffer(/\bm\.type\s*===\s*'([^']+)'/g, uiQuelle)
  .concat(treffer(/\bbei\(\s*'([^']+)'/g, uiQuelle)));

// Bewusst einseitig: `fertig` entsperrt nur die UI, es gibt keine Gegenrichtung.
const EINSEITIG_MAIN = ['fertig'];
const EINSEITIG_UI = [];

test('Regexe finden überhaupt Nachrichten', () => {
  ok(mainEmpfaengt.length >= 5, 'Main empfängt nur ' + mainEmpfaengt.length + ' Typen — Regex passt nicht mehr');
  ok(mainSendet.length >= 5, 'Main sendet nur ' + mainSendet.length + ' Typen');
  ok(uiSendet.length >= 5, 'UI sendet nur ' + uiSendet.length + ' Typen');
  ok(uiEmpfaengt.length >= 5, 'UI empfängt nur ' + uiEmpfaengt.length + ' Typen');
});

test('jede von der UI gesendete Nachricht wird im Main behandelt', () => {
  const offen = uiSendet.filter(x => mainEmpfaengt.indexOf(x) < 0 && EINSEITIG_UI.indexOf(x) < 0);
  ok(!offen.length, 'UI sendet, 70-main.js behandelt nicht: ' + offen.join(', ')
    + '\n       (Main behandelt: ' + mainEmpfaengt.join(', ') + ')');
});

test('jede vom Main gesendete Nachricht wird in der UI behandelt', () => {
  const offen = mainSendet.filter(x => uiEmpfaengt.indexOf(x) < 0 && EINSEITIG_MAIN.indexOf(x) < 0);
  ok(!offen.length, 'Main sendet, gen-ui.mjs behandelt nicht: ' + offen.join(', ')
    + '\n       (UI behandelt: ' + uiEmpfaengt.join(', ') + ')');
});

test('messwert/mess laufen beidseitig', () => {
  ok(mainSendet.indexOf('mess') >= 0, 'Main sendet `mess` nicht');
  ok(uiEmpfaengt.indexOf('mess') >= 0, 'UI behandelt `mess` nicht');
  ok(uiSendet.indexOf('messwert') >= 0, 'UI sendet `messwert` nicht');
  ok(mainEmpfaengt.indexOf('messwert') >= 0, 'Main behandelt `messwert` nicht');
});

test('Protokoll aus Runde 3 vollständig (Abschnitt 22)', () => {
  const sollEmpfangen = ['planen', 'abbrechen', 'vorschauMit', 'bericht', 'exportieren', 'beispielAnlegen'];
  const sollSenden = ['plan', 'bericht', 'exportDaten'];
  const fehltE = sollEmpfangen.filter(x => mainEmpfaengt.indexOf(x) < 0);
  const fehltS = sollSenden.filter(x => mainSendet.indexOf(x) < 0);
  ok(!fehltE.length && !fehltS.length,
    (fehltE.length ? 'Main behandelt nicht: ' + fehltE.join(', ') + '. ' : '') +
    (fehltS.length ? 'Main sendet nicht: ' + fehltS.join(', ') + '.' : ''));
});

// ===========================================================================
// Konkatenierbarkeit
// ===========================================================================
gruppe('Konkatenation');

test('keine import/export-Anweisungen in src/main', () => {
  const schuldig = dateien.filter(f => /^\s*(import|export)\s/m.test(quellen.get(f)));
  ok(!schuldig.length, schuldig.join(', '));
});

test('keine doppelten Top-Level-Deklarationen', () => {
  const RE = /^(?:async\s+)?(function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  const wo = new Map();
  const doppelt = [];
  for (const f of dateien) {
    for (const m of quellen.get(f).matchAll(RE)) {
      const name = m[2];
      if (wo.has(name)) doppelt.push(name + ' (' + wo.get(name) + ' und ' + f + ')');
      else wo.set(name, f);
    }
  }
  ok(!doppelt.length, doppelt.join('\n       '));
});

test('Dateireihenfolge entspricht der Spezifikation', () => {
  const soll = ['00-config.js', '05-i18n.js', '10-errors.js', '20-geometrie.js', '30-snap.js',
    '40-adapter.js', '50-farbe.js', '60-build.js', '70-main.js'];
  const fehlt = soll.filter(f => dateien.indexOf(f) < 0);
  ok(!fehlt.length, 'fehlende Kerndateien: ' + fehlt.join(', '));
  gleich(dateien.join(), dateien.slice().sort().join(), 'readdir-Reihenfolge ist sortiert');
});

// ===========================================================================
// Ergebnis
// ===========================================================================
console.log('\n' + '='.repeat(66));
console.log(anzOk + ' bestanden, ' + anzFail + ' fehlgeschlagen'
  + (anzUeber ? ', ' + anzUeber + ' übersprungen' : ''));
if (anzFail) {
  console.log('\nFehlgeschlagen:');
  fehlschlaege.forEach(f => console.log('  · ' + f.name + '\n      ' + f.grund.split('\n')[0]));
}
process.exit(anzFail ? 1 : 0);
