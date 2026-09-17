// ===========================================================================
// 10-errors.js — PipelineFehler + Protokoll-Kanal zur UI.
// Jeder Fehler trägt einen Code; Text und Hinweis kommen aus 05-i18n.
// Was in v1 still fehlschlug (Token, Fit, union, geratene Klasse), meldet
// sich jetzt über `melden()` als warn/info statt zu verschwinden.
// ===========================================================================

const FEHLER_CODES = [
  'KEIN_ZIEL', 'KEINE_SOURCE', 'SOURCE_LEER', 'SOURCE_MASS', 'FIT_FEHLT',
  'VARIANTE_FEHLT', 'FARBE_UNAUFLOESBAR', 'UNION_FALLBACK', 'KLASSE_GERATEN',
  'SEITEN_FEHLEN', 'KARTE_OHNE_SET', 'GROESSE_UNBEKANNT',
  'SET_HAT_FREMDE_VARIANTE', 'FRAME_ZU_KOMPONENTE', 'KONFIG_UNGUELTIG',
  'BIBLIOTHEK_UNZUGAENGLICH', 'KEINE_BIBLIOTHEKEN',
  // Runde 3
  'GESPERRT', 'FRAME_NICHT_ERLAUBT', 'STROKEHEIM_AUS', 'ABGEBROCHEN', 'EXPORT_FEHLT',
  // Runde 4 — strukturierte Audit-Befunde (Abschnitt 28.1) und Lizenz
  'KEYLINE_ABWEICHUNG', 'STRUKTUR_KNOTEN', 'STRUKTUR_TYP', 'RESTKONTUR',
  'FARBE_UNGEBUNDEN', 'LUECKE_ENG', 'KANTE_SCHIEF', 'VORLAGE_GEAENDERT',
  'KEIN_SET', 'LIZENZ_NOETIG'
];

class PipelineFehler extends Error {
  constructor(code, params, nodeId) {
    super(t('fehler.' + code, params || {}));
    this.name = 'PipelineFehler';
    this.code = code;
    this.params = params || {};
    this.hinweis = t('hinweis.' + code, params || {});
    this.nodeId = nodeId || null;
  }
}

// Ein einziger Kanal zur UI — auch 60-build und 40-adapter melden hierüber.
const ui = m => figma.ui.postMessage(m);

// Dem Event-Loop Luft geben, damit die UI zwischen Icons zeichnen kann.
const tick = () => new Promise(r => setTimeout(r, 0));

// Zusatzfelder einer Log-Nachricht (Runde 4): die UI gruppiert danach.
// `extra` ist immer optional — alte Aufrufe bleiben unverändert gültig.
function logExtra(m, extra) {
  if (!extra) return m;
  if (extra.name != null) m.name = extra.name;
  if (extra.N != null) m.N = extra.N;
  if (extra.schwere) m.schwere = extra.schwere;
  if (extra.code && m.code == null) m.code = extra.code;
  if (extra.hinweis && m.hinweis == null) m.hinweis = extra.hinweis;
  if (extra.funktion) m.funktion = extra.funktion;
  return m;
}

// Log-Art aus der Schwere (Abschnitt 28.1).
function artVonSchwere(schwere) {
  return schwere === 'fehler' ? 'err' : (schwere === 'info' ? 'info' : 'warn');
}

// Warnung/Info mit Code — dieselben Texte wie ein geworfener PipelineFehler.
function melden(art, code, params, nodeId, extra) {
  const p = params || {};
  ui(logExtra({
    type: 'log',
    art: art,
    code: code,
    text: t('fehler.' + code, p),
    hinweis: t('hinweis.' + code, p),
    nodeId: nodeId || null,
    schwere: art === 'err' ? 'fehler' : (art === 'info' ? 'info' : 'warnung')
  }, Object.assign({ name: p.name, N: p.N }, extra || {})));
}

// Freitext-Protokoll ohne Code (Audit-Zeilen, Fortschrittsnotizen).
// extra = { name, N, schwere } — für die Gruppierung im Protokoll.
function logZeile(art, text, nodeId, extra) {
  ui(logExtra({ type: 'log', art: art, text: text, nodeId: nodeId || null }, extra));
}

// Beliebigen Fehler in eine Log-Nachricht übersetzen.
function fehlerLog(e) {
  if (e instanceof PipelineFehler) {
    return logExtra(
      { type: 'log', art: 'err', text: e.message, hinweis: e.hinweis, code: e.code, nodeId: e.nodeId },
      { name: e.params && e.params.name, N: e.params && e.params.N, schwere: 'fehler',
        funktion: e.params && e.params.funktion });   // LIZENZ_NOETIG: welche Funktion gesperrt ist
  }
  return { type: 'log', art: 'err', text: t('log.fehler', { grund: (e && e.message) || String(e) }), schwere: 'fehler' };
}
