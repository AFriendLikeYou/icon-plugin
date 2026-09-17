  // =========================================================================
  // Grundlagen
  // =========================================================================
  const $ = id => document.getElementById(id);
  const send = m => parent.postMessage({ pluginMessage: m }, '*');
  const aus = (el, on) => { if (el) el.toggleAttribute('disabled', !!on); };
  const kopie = o => JSON.parse(JSON.stringify(o));
  // Nachrichten-Registry: Module registrieren Handler je Typ, statt 95-nachrichten.js zu ändern.
  //   bei('lizenz', m => …)   — mehrere Handler je Typ erlaubt, Aufruf in Registrierungsreihenfolge
  const HANDLER = {};
  function bei(typ, fn) { (HANDLER[typ] = HANDLER[typ] || []).push(fn); }

  const T = __WOERTER__;
  const KLASSEN = ['Square', 'Circular', 'Wide', 'Tall'];
  const RASTER_WERTE = [1, 0.5, 0.25];

  function navSprache() {
    const s = (navigator.language || 'en').toLowerCase();
    return s.indexOf('de') === 0 ? 'de' : 'en';
  }
  let SPR = navSprache();
  function t(key, params) {
    const tab = T[SPR] || T.en;
    let s = tab[key];
    if (s == null) s = (T.en[key] == null ? key : T.en[key]);
    if (params) Object.keys(params).forEach(k => {
      s = s.split('{' + k + '}').join(String(params[k]));
    });
    return s;
  }
  // Zahl in der jeweiligen Sprache (Dezimaltrennzeichen).
  function zahl(v) {
    if (v == null || v === '') return '?';
    const s = String(v);
    return SPR === 'de' ? s.replace('.', ',') : s;
  }

  // Werte an figui3-Elemente: immer über Attribute, das Modul lädt erst nach
  // diesem Skript und liest beim Upgrade die Attribute.
  function wert(el, v) {
    if (!el) return;
    el.setAttribute('value', v == null ? '' : String(v));
    try { el.value = v; } catch (e) {}
  }
  function anhaken(el, an) {
    if (!el) return;
    el.toggleAttribute('checked', !!an);
    try { el.checked = !!an; } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .split('&').join('&amp;').split('<').join('&lt;')
      .split('>').join('&gt;').split('"').join('&quot;');
  }

  let beschaeftigt = false, hatAuswahl = false;
  let ziel = null;                 // letztes Ziel-Objekt aus 'auswahl'
  let zoom = 6, letzterDiff = null, dunkel = false;
  let logListe = [];
  let KONFIG = null, cfgLokal = null, adapterAktiv = '', konfigFehler = [];
  let farben = null, farbenAngefragt = false, farbSuche = '';
  let wartetAufSpeichern = false;
  let keylinesOffen = {};
  let profile = ['zds', 'generic'], profilInfo = null, profilWahl = 'generic';
  let planDaten = null, planUmfang = 'alle', trockenlaufEinzel = false;
  let bericht = null, berichtSort = { spalte: 'name', ab: false };
  let exportFehlend = [];

