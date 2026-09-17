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
  'SET_HAT_FREMDE_VARIANTE', 'FRAME_ZU_KOMPONENTE', 'KONFIG_UNGUELTIG'
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

// Warnung/Info mit Code — dieselben Texte wie ein geworfener PipelineFehler.
function melden(art, code, params, nodeId) {
  ui({
    type: 'log',
    art: art,
    code: code,
    text: t('fehler.' + code, params || {}),
    hinweis: t('hinweis.' + code, params || {}),
    nodeId: nodeId || null
  });
}

// Freitext-Protokoll ohne Code (Audit-Zeilen, Fortschrittsnotizen).
function logZeile(art, text, nodeId) {
  ui({ type: 'log', art: art, text: text, nodeId: nodeId || null });
}

// Beliebigen Fehler in eine Log-Nachricht übersetzen.
function fehlerLog(e) {
  if (e instanceof PipelineFehler) {
    return { type: 'log', art: 'err', text: e.message, hinweis: e.hinweis, code: e.code, nodeId: e.nodeId };
  }
  return { type: 'log', art: 'err', text: t('log.fehler', { grund: (e && e.message) || String(e) }) };
}
