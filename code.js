// GENERIERT von build.mjs aus src/main/*.js — nicht von Hand editieren.

// ===== 00-config.js =====
// ===========================================================================
// 00-config.js — Konfig-Schema, Profile, Laden/Speichern/Validieren
// Alle früher hart verdrahteten Größen (STROKE, KEY, GROESSEN, FARB_KEY aus v1)
// stecken jetzt hier. Zur Laufzeit liegt die aktive Konfig in `CFG`.
// ===========================================================================

const KONFIG_SCHLUESSEL  = 'icon-pipeline/konfig';   // pluginData am Dokument
const SCHALTER_SCHLUESSEL = 'icon-pipeline/schalter'; // clientStorage (gerätebezogen)
const KLASSE_SCHLUESSEL  = 'icon-pipeline/klasse';   // pluginData an der Source (Frei-Modus)
const PD_SCHLUESSEL      = 'zds';                    // pluginData am Set — bleibt 'zds' (Kompatibilität)

const KLASSEN = ['Square', 'Circular', 'Wide', 'Tall'];
const RASTER_WERTE = [1, 0.5, 0.25];
const RADIUS_MODI = ['proportional', 'fest', 'keine'];
const FARB_MODI = ['source', 'hex', 'variable'];
const PROFIL_NAMEN = ['zds', 'generic'];

// Die aktive Konfiguration. Wird in 70-main beim init gesetzt.
let CFG = null;

const PROFILE = {
  zds: {
    version: 1,
    adapter: 'zds',
    sprache: 'auto',
    master: {
      groesse: 72,
      kontur: 6,
      keylines: { Square: 56, Circular: 60, Wide: 64, Tall: 64 }
    },
    variantenProperty: 'Size',
    groessen: [
      { N: 14, kontur: 1.5, keylines: { Square: 12, Circular: 13, Wide: 14, Tall: 14 },
        raster: 0.5, rasterGrob: null, radius: { modus: 'proportional', wert: 1, min: 0 }, standard: false },
      { N: 18, kontur: 1.5, keylines: { Square: 14, Circular: 15, Wide: 16, Tall: 16 },
        raster: 0.5, rasterGrob: null, radius: { modus: 'proportional', wert: 1, min: 0 }, standard: true },
      { N: 24, kontur: 2,   keylines: { Square: 18, Circular: 19, Wide: 20, Tall: 20 },
        raster: 0.5, rasterGrob: 1,    radius: { modus: 'proportional', wert: 1, min: 0 }, standard: false }
    ],
    farbe: {
      modus: 'variable',
      hex: '#444444',
      // Colors → Text/70
      variable: { key: 'c03b6366f45ff8c719530cff7a2150965e4200fd', name: 'Text/70', id: '' },
      sourceAngleichen: true
    },
    snapping: true,
    strokeFassung: false
  },
  generic: {
    version: 1,
    adapter: 'auto',
    sprache: 'auto',
    master: {
      groesse: 24,
      kontur: 2,
      keylines: { Square: 20, Circular: 22, Wide: 22, Tall: 22 }
    },
    variantenProperty: 'Size',
    groessen: [
      { N: 16, kontur: 1.5, keylines: { Square: 14, Circular: 15, Wide: 15, Tall: 15 },
        raster: 0.5, rasterGrob: null, radius: { modus: 'proportional', wert: 1, min: 0 }, standard: false },
      { N: 20, kontur: 1.5, keylines: { Square: 17, Circular: 18, Wide: 18, Tall: 18 },
        raster: 0.5, rasterGrob: null, radius: { modus: 'proportional', wert: 1, min: 0 }, standard: false },
      { N: 24, kontur: 2,   keylines: { Square: 20, Circular: 22, Wide: 22, Tall: 22 },
        raster: 0.5, rasterGrob: 1,    radius: { modus: 'proportional', wert: 1, min: 0 }, standard: true }
    ],
    farbe: {
      modus: 'source',
      hex: '#444444',
      variable: null,
      sourceAngleichen: false
    },
    snapping: true,
    strokeFassung: false
  }
};

function cfgKopie(o) { return JSON.parse(JSON.stringify(o)); }

function konfigDefaults(profil) {
  return cfgKopie(PROFILE[profil] || PROFILE.generic);
}

// --- Validierung -----------------------------------------------------------

function cfgZahl(v, standard, min) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n)) return null;
  if (typeof min === 'number' && n < min) return null;
  return n;
}

function cfgHex(v) {
  let s = String(v || '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(s)) s = '#' + s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

function cfgKeylines(v, standard) {
  const k = {};
  KLASSEN.forEach(kl => {
    const n = cfgZahl(v && v[kl], null, 0.0001);
    k[kl] = n == null ? standard : n;
  });
  return k;
}

function cfgRaster(v) {
  const n = cfgZahl(v, null, 0);
  if (n == null) return null;
  let beste = RASTER_WERTE[0], d = Infinity;
  RASTER_WERTE.forEach(r => { const dd = Math.abs(r - n); if (dd < d) { d = dd; beste = r; } });
  return beste;
}

// Repariert, was reparierbar ist, und sammelt die Meldungen für die UI.
function konfigValidieren(k) {
  const fehler = [];
  const d = konfigDefaults('generic');
  let o;
  try { o = k && typeof k === 'object' ? cfgKopie(k) : {}; } catch (e) { o = {}; }

  o.version = 1;

  if (['auto', 'zds', 'frei'].indexOf(o.adapter) < 0) { o.adapter = d.adapter; fehler.push(t('konfig.adapter')); }
  if (['auto', 'de', 'en'].indexOf(o.sprache) < 0) { o.sprache = d.sprache; fehler.push(t('konfig.sprache')); }

  const vp = String(o.variantenProperty == null ? '' : o.variantenProperty).trim();
  if (!vp) { o.variantenProperty = d.variantenProperty; fehler.push(t('konfig.variantenProperty')); }
  else o.variantenProperty = vp;

  // --- Master ---
  const m = (o.master && typeof o.master === 'object') ? o.master : {};
  const mg = cfgZahl(m.groesse, null, 1);
  if (mg == null) { fehler.push(t('konfig.masterGroesse')); m.groesse = d.master.groesse; } else m.groesse = mg;
  const mk = cfgZahl(m.kontur, null, 0.0001);
  if (mk == null) { fehler.push(t('konfig.masterKontur')); m.kontur = d.master.kontur; } else m.kontur = mk;
  m.keylines = cfgKeylines(m.keylines, m.groesse);
  o.master = m;

  // --- Größen ---
  let gs = Array.isArray(o.groessen) ? o.groessen : [];
  const gesehen = {};
  gs = gs.map(g => (g && typeof g === 'object') ? g : {}).filter(g => {
    const N = cfgZahl(g.N, null, 1);
    if (N == null || Math.round(N) !== N) { fehler.push(t('konfig.groesseN', { wert: String(g.N) })); return false; }
    if (gesehen[N]) { fehler.push(t('konfig.groesseDoppelt', { N: N })); return false; }
    gesehen[N] = true; g.N = N; return true;
  });
  if (!gs.length) { fehler.push(t('konfig.keineGroessen')); gs = cfgKopie(d.groessen); }

  gs.forEach(g => {
    const kt = cfgZahl(g.kontur, null, 0.0001);
    if (kt == null) { fehler.push(t('konfig.kontur', { N: g.N })); g.kontur = 1.5; } else g.kontur = kt;
    g.keylines = cfgKeylines(g.keylines, g.N);
    const r = cfgRaster(g.raster);
    if (r == null) { fehler.push(t('konfig.raster', { N: g.N })); g.raster = 0.5; } else g.raster = r;
    if (g.rasterGrob == null || g.rasterGrob === '' || g.rasterGrob === false) g.rasterGrob = null;
    else {
      const rg = cfgRaster(g.rasterGrob);
      if (rg == null || rg <= g.raster) { fehler.push(t('konfig.rasterGrob', { N: g.N })); g.rasterGrob = null; }
      else g.rasterGrob = rg;
    }
    const rad = (g.radius && typeof g.radius === 'object') ? g.radius : {};
    if (RADIUS_MODI.indexOf(rad.modus) < 0) { fehler.push(t('konfig.radiusModus', { N: g.N })); rad.modus = 'proportional'; }
    const rw = cfgZahl(rad.wert, null, 0); rad.wert = rw == null ? 1 : rw;
    const rm = cfgZahl(rad.min, null, 0);  rad.min  = rm == null ? 0 : rm;
    g.radius = rad;
    g.standard = !!g.standard;
    g.keylinesManuell = !!g.keylinesManuell;   // UI-Merker: Keylines von Hand gesetzt → folgen N nicht mehr
  });

  gs.sort((a, b) => a.N - b.N);
  const std = gs.filter(g => g.standard);
  if (std.length !== 1) {
    if (std.length > 1) fehler.push(t('konfig.mehrereStandard'));
    else fehler.push(t('konfig.keinStandard'));
    gs.forEach(g => { g.standard = false; });
    (std[0] || gs[gs.length - 1]).standard = true;
  }
  o.groessen = gs;

  // --- Farbe ---
  const f = (o.farbe && typeof o.farbe === 'object') ? o.farbe : {};
  if (FARB_MODI.indexOf(f.modus) < 0) { fehler.push(t('konfig.farbModus')); f.modus = d.farbe.modus; }
  const hx = cfgHex(f.hex);
  if (hx == null) { if (f.modus === 'hex') fehler.push(t('konfig.farbHex')); f.hex = '#444444'; } else f.hex = hx;
  if (f.variable && typeof f.variable === 'object') {
    f.variable = {
      key:  String(f.variable.key  || ''),
      name: String(f.variable.name || ''),
      id:   String(f.variable.id   || '')
    };
    if (!f.variable.key && !f.variable.id && !f.variable.name) f.variable = null;
  } else f.variable = null;
  if (f.modus === 'variable' && !f.variable) { fehler.push(t('konfig.farbVariable')); f.modus = 'source'; }
  f.sourceAngleichen = !!f.sourceAngleichen;
  o.farbe = f;

  o.snapping = o.snapping === undefined ? true : !!o.snapping;
  o.strokeFassung = !!o.strokeFassung;

  return { ok: fehler.length === 0, fehler: fehler, konfig: o };
}

// Platzhalter für spätere Schema-Versionen — heute gibt es nur v1.
function konfigMigrieren(k) {
  if (!k || typeof k !== 'object') return k;
  if (!k.version) k.version = 1;
  return k;
}

async function konfigLaden() {
  let roh = null;
  try {
    const s = figma.root.getPluginData(KONFIG_SCHLUESSEL);
    if (s) roh = JSON.parse(s);
  } catch (e) { roh = null; }
  if (!roh) {
    let istZds = false;
    try { istZds = await adapterZds.erkennen(); } catch (e) { istZds = false; }
    roh = konfigDefaults(istZds ? 'zds' : 'generic');
  }
  const pruef = konfigValidieren(konfigMigrieren(roh));
  CFG = pruef.konfig;
  return pruef;
}

async function konfigSpeichern(k) {
  const pruef = konfigValidieren(konfigMigrieren(k));
  CFG = pruef.konfig;
  try { figma.root.setPluginData(KONFIG_SCHLUESSEL, JSON.stringify(CFG)); }
  catch (e) { throw new PipelineFehler('KONFIG_UNGUELTIG', { grund: e.message }); }
  return pruef;
}

async function schalterLaden() {
  try {
    const e = await figma.clientStorage.getAsync(SCHALTER_SCHLUESSEL);
    if (e) return { snap: !!e.snap, stroke: !!e.stroke };
  } catch (err) {}
  return { snap: !!(CFG && CFG.snapping), stroke: !!(CFG && CFG.strokeFassung) };
}

async function schalterSpeichern(snap, stroke) {
  try { await figma.clientStorage.setAsync(SCHALTER_SCHLUESSEL, { snap: !!snap, stroke: !!stroke }); }
  catch (e) {}
}

// --- kleine Zugriffshelfer -------------------------------------------------

function groesseCfg(N) {
  const g = CFG && CFG.groessen.find(x => x.N === N);
  if (!g) throw new PipelineFehler('GROESSE_UNBEKANNT', { N: N });
  return g;
}

function variantenName(N) { return CFG.variantenProperty + '=' + N; }

// '…=24' → 24; alles andere → null.
function variantenN(name) {
  const m = /=\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(String(name || ''));
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return isFinite(n) ? n : null;
}

// Erkennt, ob ein Name dem konfigurierten Variantenschema folgt.
function istVariantenName(name) {
  const p = CFG ? CFG.variantenProperty : 'Size';
  return new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*-?\\d').test(String(name || ''));
}

function keylineVon(g, klasse) {
  const k = g.keylines && g.keylines[klasse];
  return typeof k === 'number' ? k : g.N;
}

function standardGroesse() {
  return CFG.groessen.find(g => g.standard) || CFG.groessen[0];
}

function groessenListe() { return CFG.groessen.map(g => g.N); }

// ===== 05-i18n.js =====
// ===========================================================================
// 05-i18n.js — Wörterbuch für den Hauptthread (de/en) und t(key, params).
// Die UI übersetzt ihre eigenen Strings; hier steht nur, was der Hauptthread
// erzeugt: Logs, Fazit, Fehler/Hinweise, Set-Beschreibungen, Konfig-Meldungen.
// ===========================================================================

let SPRACHE = 'en';

const SPRACHEN = {
  de: {
    // --- Fehler ---
    'fehler.KEIN_ZIEL': 'Nichts Passendes ausgewählt.',
    'hinweis.KEIN_ZIEL': 'Wähle eine Icon-Karte, ein Varianten-Set oder eine Master-Komponente aus.',
    'fehler.KEINE_SOURCE': '{name}: keine Source-Komponente gefunden.',
    'hinweis.KEINE_SOURCE': 'Erwartet wird eine Komponente mit {mass} × {mass} px.',
    'fehler.SOURCE_LEER': '{name}: die Source enthält keine Vektoren.',
    'hinweis.SOURCE_LEER': 'Ohne zeichnende Ebenen lässt sich keine Keyline messen.',
    'fehler.SOURCE_MASS': '{name}: Source misst {ist}, erwartet {soll}.',
    'hinweis.SOURCE_MASS': 'Die Master-Größe steht in den Einstellungen unter „Master“. Setze die Source auf dieses Maß oder passe die Konfiguration an.',
    'fehler.FIT_FEHLT': '{name} / {N}: die Keyline ließ sich nicht einpassen.',
    'hinweis.FIT_FEHLT': 'Die Bisektion fand kein Maß — meist sind die Renderbounds leer (unsichtbare oder leere Ebenen).',
    'fehler.VARIANTE_FEHLT': '{name}: Variante {variante} fehlte im Set und wurde ergänzt.',
    'hinweis.VARIANTE_FEHLT': 'Die neue Variante hat noch keine Instanzen im File.',
    'fehler.FARBE_UNAUFLOESBAR': 'Die eingestellte Farbvariable ließ sich nicht auflösen.',
    'hinweis.FARBE_UNAUFLOESBAR': 'Bibliothek nicht verfügbar oder Variable gelöscht. Es wird ein einfaches Grau gesetzt.',
    'fehler.UNION_FALLBACK': '{name} / {N}: union nicht möglich, es wurde direkt geflattet.',
    'hinweis.UNION_FALLBACK': 'Überlappende Konturen können dadurch als Kanten sichtbar bleiben.',
    'fehler.KLASSE_GERATEN': '{name}: Klasse {klasse} geraten.',
    'hinweis.KLASSE_GERATEN': 'Aus dem Seitenverhältnis abgeleitet. Über die Auswahlzeile lässt sich die Klasse festlegen.',
    'fehler.SEITEN_FEHLEN': 'Seiten „Icons“/„Source“ nicht gefunden — falsches File?',
    'hinweis.SEITEN_FEHLEN': 'Das ZDS-Profil erwartet dieses Board. Stelle in den Einstellungen auf „Frei“ um.',
    'fehler.KARTE_OHNE_SET': '{name}: noch kein Library-Set — es wird neu angelegt.',
    'hinweis.KARTE_OHNE_SET': 'Danach einsortieren und Suchbegriffe in die Beschreibung ergänzen.',
    'fehler.GROESSE_UNBEKANNT': 'Größe {N} steht nicht in der Konfiguration.',
    'hinweis.GROESSE_UNBEKANNT': 'Ergänze sie in den Einstellungen unter „Größen“.',
    'fehler.SET_HAT_FREMDE_VARIANTE': '{name}: Variante {variante} steht nicht in der Konfiguration.',
    'hinweis.SET_HAT_FREMDE_VARIANTE': 'Sie bleibt unangetastet — weder gebaut noch gelöscht.',
    'fehler.FRAME_ZU_KOMPONENTE': '{name}: Frame wurde in eine Komponente umgewandelt.',
    'hinweis.FRAME_ZU_KOMPONENTE': 'Nur Komponenten lassen sich instanziieren und damit einpassen.',
    'fehler.KONFIG_UNGUELTIG': 'Die Konfiguration konnte nicht gespeichert werden: {grund}',
    'fehler.BIBLIOTHEK_UNZUGAENGLICH': 'Team-Libraries nicht abfragbar: {grund}',
    'hinweis.BIBLIOTHEK_UNZUGAENGLICH': 'Braucht die Manifest-Berechtigung „teamlibrary“ und ein Figma-Konto mit Zugriff auf die Library. Bei Development-Plugins nach Manifest-Änderungen das Plugin über „Import plugin from manifest“ neu importieren.',
    'fehler.KEINE_BIBLIOTHEKEN': 'Keine Variablen-Kollektionen aus Libraries gefunden ({lokal} lokale Farbvariablen).',
    'hinweis.KEINE_BIBLIOTHEKEN': 'Figma liefert nur Kollektionen aus Libraries, die in diesem File unter Assets → Libraries aktiviert sind. Library aktivieren, dann „Aktualisieren“.',
    'hinweis.KONFIG_UNGUELTIG': 'Prüfe die markierten Felder im Tab „Einstellungen“.',

    // --- Konfig-Prüfung ---
    'konfig.adapter': 'Adapter unbekannt — auf Standard zurückgesetzt.',
    'konfig.sprache': 'Sprache unbekannt — auf Standard zurückgesetzt.',
    'konfig.variantenProperty': 'Variantenproperty darf nicht leer sein.',
    'konfig.masterGroesse': 'Master-Größe muss eine Zahl > 0 sein.',
    'konfig.masterKontur': 'Master-Kontur muss eine Zahl > 0 sein.',
    'konfig.groesseN': 'Größe „{wert}“ ist keine ganze Zahl > 0 — Zeile verworfen.',
    'konfig.groesseDoppelt': 'Größe {N} kommt mehrfach vor — Dublette verworfen.',
    'konfig.keineGroessen': 'Keine gültige Größe übrig — Standardgrößen eingesetzt.',
    'konfig.kontur': 'Kontur für {N} muss > 0 sein.',
    'konfig.raster': 'Raster für {N} muss 1, 0,5 oder 0,25 sein.',
    'konfig.rasterGrob': 'Grobes Raster für {N} muss gröber als das Raster sein — abgeschaltet.',
    'konfig.radiusModus': 'Radius-Modus für {N} unbekannt — „proportional“ gesetzt.',
    'konfig.mehrereStandard': 'Mehrere Standardgrößen — nur die erste bleibt.',
    'konfig.keinStandard': 'Keine Standardgröße gesetzt — die größte wurde gewählt.',
    'konfig.farbModus': 'Farbmodus unbekannt — auf Standard zurückgesetzt.',
    'konfig.farbHex': 'Hex-Farbe ungültig — #444444 gesetzt.',
    'konfig.farbVariable': 'Keine Farbvariable gewählt — Modus „Source“ gesetzt.',

    // --- Bau-Protokoll ---
    'und': 'und',
    'bau.kopf': '{name} ({klasse}) → {liste}',
    'bau.mass': '{N}: {ist}/{soll}',
    'bau.ohneFit': '???',
    'bau.gerastet': ' ({n} Kanten gerastet)',
    'bau.geschuetzt': ' · {n} Knoten formgeschützt',
    'bau.aa': ' · AA {aa}% · Fehler {w} vs {g}',
    'bau.trend': ' · zuvor {vor} {pfeil}',
    'bau.hinting': ' → Hinting −{delta}%',
    'bau.gleichwertig': ' → gleichwertig',
    'bau.snapOhneWirkung': ' — Snapping ohne Wirkung, Fit-Geometrie behalten',
    'bau.sourceMisst': ' — Source misst {ist} statt {soll}',
    'bau.strokeAbgelegt': ' · Stroke-Fassung abgelegt',
    'bau.neuesSet': ' — NEUES Set, bitte einsortieren + Suchbegriffe in die Beschreibung',

    // --- Set-Beschreibung ---
    'set.beschreibung': 'Icon {name} in {groessen} px. Größe über die Property {prop}. Geflattet — ein Pfad, keine Kontur.',
    'set.suchbegriffe': '{basis}\n\nSuchbegriffe: {kw}',

    // --- Audit ---
    'audit.keineSource': '{name}: keine Source',
    'audit.keinSet': '{name}: kein Library-Set',
    'audit.schiefeKante': '{name}: schiefe Kante {wert} — in der Source begradigen',
    'audit.veraltet': '{name}: Source geändert seit letztem Build — neu durchziehen',
    'audit.keyline': '{name} {klasse}/{N}: {ist} statt {soll}',
    'audit.knoten': '{name}/{N}: {n} Knoten statt 1',
    'audit.typ': '{name}/{N}: {typ} statt VECTOR',
    'audit.restkontur': '{name}/{N}: Restkontur vorhanden',
    'audit.farbe': '{name}/{N}: Farbe nicht an die Variable gebunden',
    'audit.luecke': '{name}/{N}: Zwischenraum {wert} px — verschlammt bei 1×',
    'audit.laeuft': 'Audit läuft …',

    // --- Fazit / Status ---
    'fazit.neuGebaut': 'neu gebaut',
    'fazit.audit': 'Audit: {treffer}/{gesamt} auf der Keyline · gerade Kanten auf dem Raster: {rAuf}/{rGesamt}{veraltet}',
    'fazit.veraltet': ' · VERALTET: {n}',
    'fazit.alle': '{ok}/{n} gebaut · Keyline {treffer}/{gesamt} · Raster {rAuf}/{rGesamt}{veraltet}',
    'fazit.abgebrochen': 'Abgebrochen: {grund}',
    'log.fehler': 'Fehler: {grund}',
    'log.klasseGesetzt': '{name}: Klasse auf {klasse} gesetzt.',
    'log.konfigGespeichert': 'Konfiguration gespeichert.',
    'log.konfigZurueck': 'Konfiguration auf Profil „{profil}“ zurückgesetzt.'
  },

  en: {
    'fehler.KEIN_ZIEL': 'Nothing suitable selected.',
    'hinweis.KEIN_ZIEL': 'Select an icon card, a variant set or a master component.',
    'fehler.KEINE_SOURCE': '{name}: no source component found.',
    'hinweis.KEINE_SOURCE': 'A component of {mass} × {mass} px is expected.',
    'fehler.SOURCE_LEER': '{name}: the source contains no vectors.',
    'hinweis.SOURCE_LEER': 'Without drawing layers there is no keyline to measure.',
    'fehler.SOURCE_MASS': '{name}: source measures {ist}, expected {soll}.',
    'hinweis.SOURCE_MASS': 'The master size lives in Settings under “Master”. Resize the source or adjust the configuration.',
    'fehler.FIT_FEHLT': '{name} / {N}: could not fit the keyline.',
    'hinweis.FIT_FEHLT': 'The bisection found no size — usually the render bounds are empty (hidden or empty layers).',
    'fehler.VARIANTE_FEHLT': '{name}: variant {variante} was missing from the set and has been added.',
    'hinweis.VARIANTE_FEHLT': 'The new variant has no instances in the file yet.',
    'fehler.FARBE_UNAUFLOESBAR': 'The configured colour variable could not be resolved.',
    'hinweis.FARBE_UNAUFLOESBAR': 'Library unavailable or variable deleted. A plain grey is used instead.',
    'fehler.UNION_FALLBACK': '{name} / {N}: union failed, flattened directly.',
    'hinweis.UNION_FALLBACK': 'Overlapping strokes may remain visible as edges.',
    'fehler.KLASSE_GERATEN': '{name}: class {klasse} was guessed.',
    'hinweis.KLASSE_GERATEN': 'Derived from the aspect ratio. You can set the class in the selection row.',
    'fehler.SEITEN_FEHLEN': 'Pages “Icons”/“Source” not found — wrong file?',
    'hinweis.SEITEN_FEHLEN': 'The ZDS profile expects that board. Switch to “Free” in the settings.',
    'fehler.KARTE_OHNE_SET': '{name}: no library set yet — a new one will be created.',
    'hinweis.KARTE_OHNE_SET': 'Afterwards file it away and add keywords to the description.',
    'fehler.GROESSE_UNBEKANNT': 'Size {N} is not in the configuration.',
    'hinweis.GROESSE_UNBEKANNT': 'Add it in Settings under “Sizes”.',
    'fehler.SET_HAT_FREMDE_VARIANTE': '{name}: variant {variante} is not in the configuration.',
    'hinweis.SET_HAT_FREMDE_VARIANTE': 'It is left alone — neither built nor deleted.',
    'fehler.FRAME_ZU_KOMPONENTE': '{name}: frame was converted into a component.',
    'hinweis.FRAME_ZU_KOMPONENTE': 'Only components can be instantiated and therefore fitted.',
    'fehler.KONFIG_UNGUELTIG': 'The configuration could not be saved: {grund}',
    'fehler.BIBLIOTHEK_UNZUGAENGLICH': 'Team libraries cannot be queried: {grund}',
    'hinweis.BIBLIOTHEK_UNZUGAENGLICH': 'Requires the manifest permission “teamlibrary” and a Figma account with access to the library. For development plugins, re-import the plugin via “Import plugin from manifest” after manifest changes.',
    'fehler.KEINE_BIBLIOTHEKEN': 'No variable collections from libraries found ({lokal} local color variables).',
    'hinweis.KEINE_BIBLIOTHEKEN': 'Figma only returns collections from libraries enabled in this file under Assets → Libraries. Enable the library, then “Refresh”.',
    'hinweis.KONFIG_UNGUELTIG': 'Check the highlighted fields in the “Settings” tab.',

    'konfig.adapter': 'Unknown adapter — reset to default.',
    'konfig.sprache': 'Unknown language — reset to default.',
    'konfig.variantenProperty': 'The variant property must not be empty.',
    'konfig.masterGroesse': 'Master size must be a number > 0.',
    'konfig.masterKontur': 'Master stroke must be a number > 0.',
    'konfig.groesseN': 'Size “{wert}” is not a whole number > 0 — row dropped.',
    'konfig.groesseDoppelt': 'Size {N} appears more than once — duplicate dropped.',
    'konfig.keineGroessen': 'No valid size left — default sizes inserted.',
    'konfig.kontur': 'Stroke for {N} must be > 0.',
    'konfig.raster': 'Grid for {N} must be 1, 0.5 or 0.25.',
    'konfig.rasterGrob': 'Coarse grid for {N} must be coarser than the grid — disabled.',
    'konfig.radiusModus': 'Unknown radius mode for {N} — set to “proportional”.',
    'konfig.mehrereStandard': 'Several default sizes — only the first one kept.',
    'konfig.keinStandard': 'No default size set — the largest one was chosen.',
    'konfig.farbModus': 'Unknown colour mode — reset to default.',
    'konfig.farbHex': 'Invalid hex colour — set to #444444.',
    'konfig.farbVariable': 'No colour variable selected — mode set to “source”.',

    'und': 'and',
    'bau.kopf': '{name} ({klasse}) → {liste}',
    'bau.mass': '{N}: {ist}/{soll}',
    'bau.ohneFit': '???',
    'bau.gerastet': ' ({n} edges snapped)',
    'bau.geschuetzt': ' · {n} nodes shape-protected',
    'bau.aa': ' · AA {aa}% · error {w} vs {g}',
    'bau.trend': ' · previously {vor} {pfeil}',
    'bau.hinting': ' → hinting −{delta}%',
    'bau.gleichwertig': ' → equivalent',
    'bau.snapOhneWirkung': ' — snapping had no effect, kept the fit geometry',
    'bau.sourceMisst': ' — source measures {ist} instead of {soll}',
    'bau.strokeAbgelegt': ' · stroke version stored',
    'bau.neuesSet': ' — NEW set, please file it and add keywords to the description',

    'set.beschreibung': 'Icon {name} at {groessen} px. Size via the {prop} property. Flattened — one path, no stroke.',
    'set.suchbegriffe': '{basis}\n\nKeywords: {kw}',

    'audit.keineSource': '{name}: no source',
    'audit.keinSet': '{name}: no library set',
    'audit.schiefeKante': '{name}: skewed edge {wert} — straighten it in the source',
    'audit.veraltet': '{name}: source changed since the last build — rebuild it',
    'audit.keyline': '{name} {klasse}/{N}: {ist} instead of {soll}',
    'audit.knoten': '{name}/{N}: {n} nodes instead of 1',
    'audit.typ': '{name}/{N}: {typ} instead of VECTOR',
    'audit.restkontur': '{name}/{N}: leftover stroke',
    'audit.farbe': '{name}/{N}: colour not bound to the variable',
    'audit.luecke': '{name}/{N}: gap of {wert} px — muddy at 1×',
    'audit.laeuft': 'Audit running …',

    'fazit.neuGebaut': 'rebuilt',
    'fazit.audit': 'Audit: {treffer}/{gesamt} on the keyline · straight edges on the grid: {rAuf}/{rGesamt}{veraltet}',
    'fazit.veraltet': ' · OUTDATED: {n}',
    'fazit.alle': '{ok}/{n} built · keyline {treffer}/{gesamt} · grid {rAuf}/{rGesamt}{veraltet}',
    'fazit.abgebrochen': 'Aborted: {grund}',
    'log.fehler': 'Error: {grund}',
    'log.klasseGesetzt': '{name}: class set to {klasse}.',
    'log.konfigGespeichert': 'Configuration saved.',
    'log.konfigZurueck': 'Configuration reset to profile “{profil}”.'
  }
};

function t(key, params) {
  const buch = SPRACHEN[SPRACHE] || SPRACHEN.en;
  let s = buch[key];
  if (s === undefined) s = SPRACHEN.en[key];
  if (s === undefined) return key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (ganz, name) =>
    (params[name] === undefined || params[name] === null) ? ganz : String(params[name]));
}

// 'auto' → Browsersprache der UI, sonst die eingestellte Sprache.
function spracheSetzen(cfgSprache, uiSprache) {
  let s = cfgSprache;
  if (s !== 'de' && s !== 'en') s = /^de/i.test(String(uiSprache || '')) ? 'de' : 'en';
  SPRACHE = s;
  return s;
}

// „14, 18 und 24“
function listeUnd(werte) {
  const a = werte.map(String);
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' ' + t('und') + ' ' + a[a.length - 1];
}

// ===== 10-errors.js =====
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
  'BIBLIOTHEK_UNZUGAENGLICH', 'KEINE_BIBLIOTHEKEN'
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

// ===== 20-geometrie.js =====
// ===========================================================================
// 20-geometrie.js — Messen, Normalisieren, Einpassen, Radien, Staffeln.
// Aus v1 übernommen: gb, fitten, konturSetzen, staffeln, fingerabdruck.
// Generalisiert: normalisieren (CFG.master.kontur + optionale Farbbindung),
// radienRegel (ersetzt radienSkalieren), staffeln (beliebige Größenliste).
// ===========================================================================

const ZEICHEN_TYPEN = ['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'RECTANGLE', 'LINE', 'POLYGON', 'STAR'];

// Renderbounds aller zeichnenden Ebenen — die echte Tinte, inkl. Konturbreite.
function gb(node) {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9, n = 0;
  node.findAll(x => ZEICHEN_TYPEN.indexOf(x.type) >= 0)
    .forEach(x => { const r = x.absoluteRenderBounds; if (!r) return; n++;
      a = Math.min(a, r.x); b = Math.min(b, r.y);
      c = Math.max(c, r.x + r.width); d = Math.max(d, r.y + r.height); });
  return n ? { w: c - a, h: d - b } : null;
}

// Klasse → gemessene Achse.
function achseVon(klasse) {
  return klasse === 'Wide' ? 'w' : (klasse === 'Tall' ? 'h' : 'max');
}

function massAuf(m, achse) {
  if (!m) return null;
  return achse === 'w' ? m.w : (achse === 'h' ? m.h : Math.max(m.w, m.h));
}

// Source auf den Master-Zustand bringen: alles skaliert mit, Konturen auf
// CFG.master.kontur. Die Farbbindung nur, wenn die Konfig das ausdrücklich will
// (ZDS: sourceAngleichen true + Variable Text/70 → wie v1).
function normalisieren(src) {
  const w = CFG.master.kontur;
  const varb = (CFG.farbe.sourceAngleichen && CTX.farbVariable) ? CTX.farbVariable : null;
  src.findAll(x => true).forEach(x => {
    try { if (x.constraints) x.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; } catch (e) {}
  });
  src.findAll(x => x.strokes && x.strokes.length).forEach(x => {
    try { x.strokeWeight = w; }
    catch (e) {
      ['strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight']
        .forEach(p => { try { x[p] = w; } catch (e2) {} });
    }
    if (varb) x.strokes = x.strokes.map(p => p.type === 'SOLID'
      ? figma.variables.setBoundVariableForPaint(p, 'color', varb) : p);
  });
  if (varb) src.findAll(x => x.fills && Array.isArray(x.fills) && x.fills.length).forEach(x => {
    x.fills = x.fills.map(p => p.type === 'SOLID'
      ? figma.variables.setBoundVariableForPaint(p, 'color', varb) : p);
  });
}

function konturSetzen(inst, w) {
  inst.findAll(x => x.strokes && x.strokes.length).forEach(x => {
    try { x.setBoundVariable('strokeWeight', null); } catch (e) {}
    try { x.strokeWeight = w; }
    catch (e) {
      ['strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight']
        .forEach(p => { try { x[p] = w; } catch (e2) {} });
    }
  });
}

// Radien nach Regel — NACH dem Detach, wo alles editierbar ist.
// Deckt alle drei Arten ab: uniformer cornerRadius, Per-Ecke-Radien (mixed)
// und Vertex-Radien im Vektornetz. Radien verändern die Außenmaße nicht
// (Tangentenpunkte) — der Keyline-Fit bleibt gültig.
// regel = groesseCfg(N).radius: { modus:'proportional'|'fest'|'keine', wert, min }
async function radienRegel(root, f, regel) {
  const modus = (regel && regel.modus) || 'proportional';
  const wert = (regel && typeof regel.wert === 'number') ? regel.wert : 0;
  const min = (regel && typeof regel.min === 'number') ? regel.min : 0;
  // Proportional ohne Skalierung und ohne Mindestwert ist ein No-Op (wie v1).
  if (modus === 'proportional' && Math.abs(f - 1) < 1e-9 && min <= 0) return;

  const neu = r => {
    if (modus === 'keine') return 0;
    const v = modus === 'fest' ? wert : r * f;
    return v < min ? 0 : v;
  };

  const knoten = [root, ...root.findAll(x => true)];
  for (const x of knoten) {
    let uniform = false;
    try {
      if (typeof x.cornerRadius === 'number' && x.cornerRadius > 0) {
        x.cornerRadius = neu(x.cornerRadius); uniform = true;
      }
    } catch (e) {}
    if (!uniform) {
      ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'].forEach(pp => {
        try { if (typeof x[pp] === 'number' && x[pp] > 0) x[pp] = neu(x[pp]); } catch (e) {}
      });
      try {
        if (x.type === 'VECTOR' && x.vectorNetwork &&
            x.vectorNetwork.vertices.some(v => (v.cornerRadius || 0) > 0)) {
          const netz = x.vectorNetwork;
          const V = netz.vertices.map(v => {
            const n = Object.assign({}, v);
            if ((n.cornerRadius || 0) > 0) n.cornerRadius = neu(n.cornerRadius);
            return n;
          });
          await x.setVectorNetworkAsync({ vertices: V, segments: netz.segments, regions: netz.regions });
        }
      } catch (e) {}
    }
  }
}

// Bisektion: Instanzgröße suchen, bei der die gemessene Achse die Keyline trifft.
function fitten(box, inst, src, N, soll, achse) {
  const setz = S => { inst.resize(S, S); inst.x = (N - S) / 2; inst.y = (N - S) / 2; };
  const miss = () => massAuf(gb(box), achse);
  let lo = N * 0.4, hi = N * 2.6, ist = null;
  for (let i = 0; i < 42; i++) {
    const S = (lo + hi) / 2; setz(S); ist = miss();
    if (ist == null) return null;
    if (Math.abs(ist - soll) < 0.002) break;
    if (ist < soll) lo = S; else hi = S;
  }
  return ist;
}

// Varianten sortieren, mittig setzen, Standardvariante an Index 0 (= Figma-Default
// beim Einfügen). Maße des Sets aus den Kindern statt fest 120×56;
// Ränder 12/16 ergeben für die ZDS-Größen 14/18/24 wieder exakt 120×56.
const STAFFEL_RAND_X = 12;
const STAFFEL_RAND_Y = 16;
const STAFFEL_LUECKE = 20;

function staffeln(cs) {
  const kinder = cs.children.slice().sort((a, b) => {
    const na = variantenN(a.name), nb = variantenN(b.name);
    return (na == null ? 1e9 : na) - (nb == null ? 1e9 : nb);
  });
  if (!kinder.length) return;
  let x = STAFFEL_RAND_X, hMax = 0;
  kinder.forEach(c => { c.x = x; x += c.width + STAFFEL_LUECKE; hMax = Math.max(hMax, c.height); });
  const breite = Math.max(1, x - STAFFEL_LUECKE + STAFFEL_RAND_X);
  const hoehe  = Math.max(1, hMax + 2 * STAFFEL_RAND_Y);
  cs.resizeWithoutConstraints(breite, hoehe);
  kinder.forEach(c => { c.y = Math.round((hoehe - c.height) / 2); });
  standardNachVorn(cs);
}

// Standardvariante als erstes Kind = Default beim Einfügen.
function standardNachVorn(cs) {
  const std = standardGroesse();
  if (!std) return;
  const v = cs.children.find(c => c.name === variantenName(std.N));
  if (v && cs.children[0] !== v) cs.insertChild(0, v);
}

// Geometrie-Fingerabdruck der Source — Grundlage der Veraltet-Erkennung im Audit.
function fingerabdruck(src) {
  let h = 5381;
  const add = t2 => { for (let i = 0; i < t2.length; i++) h = ((h << 5) + h + t2.charCodeAt(i)) | 0; };
  src.findAll(x => true).forEach(x => {
    add(x.type + '|' + x.name + '|' + [x.x, x.y, x.width, x.height].map(v => Math.round(v * 100) / 100).join(','));
    if (typeof x.strokeWeight === 'number') add('s' + Math.round(x.strokeWeight * 100) / 100);
    if (typeof x.cornerRadius === 'number') add('r' + Math.round(x.cornerRadius * 100) / 100);
    try { if (x.vectorPaths) add('p' + x.vectorPaths.map(q => q.data.length).join('.')); } catch (e) {}
  });
  return String(h);
}

// ===== 30-snap.js =====
// ---------------------------------------------------------------------------
// Paket „Snap" — Pixel-Snapping v2 („Stem-Hinting"), parametrisiert
// ---------------------------------------------------------------------------
// Portiert aus code.v1.js (Zeilen 162–612). Inhaltlich unverändert; das feste
// 0,5-Raster und der N === 24-Sonderfall sind durch rc = { raster, rasterGrob }
// ersetzt. Keine Globals (kein CFG/GROESSEN/STROKE/KEY), kein import/export.
//
// REGRESSIONS-NACHWEIS — mit rc = { raster: 0.5, rasterGrob: N === 24 ? 1 : null }
// liefert jede Stelle bitgenau das alte Ergebnis:
//
//  1. rund(w, 0.5, p) = Math.round((w − p) / 0.5) * 0.5 + p
//     = Math.round((w − p) * 2) / 2 + p  — die Division durch 0.5 bzw. die
//     Multiplikation mit 2 sind in IEEE-754 exakt (Zweierpotenz), also identisch
//     zum alten `halb`. Für r = 1 ergibt rund() exakt das alte `ganz`.
//  2. snapWert(w, p, rc): rasterGrob = 1 ⇔ N === 24; die Toleranz
//     SNAP.GROB_TOLERANZ = 0.35 ist die alte 0.35-Schranke; sonst Rückfall auf
//     rund(w, raster, p) = altes `halb`. → alter snapWert-Körper 1:1.
//  3. Phase (w / 2) % rc.raster = (w / 2) % 0.5 — an allen drei Stellen
//     (VECTOR, RECTANGLE, LINE) wörtlich der alte Ausdruck.
//  4. rasterRate: Math.abs(w − rund(w, raster)) < 0.01 = alte Prüfung gegen
//     Math.round(w * 2) / 2, Toleranz 0.01 unverändert.
//  5. Rhythmus-Schutz, gapZiel: alt `Math.round(g * 2) / 2`, neu
//     snapWert(g, 0, rc). Unterschied nur möglich, wenn das grobe Raster greift
//     (|grob − g| ≤ 0.35). Dann ist g NICHT in der Nähe von x,5 (Abstand zur
//     Ganzzahl wäre ~0.5 > 0.35), also war auch alt |halb − g| > 0.02 →
//     `rasterbar` in beiden Fassungen false, und gapZiel wird nicht benutzt.
//     Greift das grobe Raster nicht, ist snapWert = rund(g, 0.5, 0) = alt.
//     Die Toleranzen 0.06 (gleicher Abstand) und 0.02 (rasterbar) skalieren
//     bewusst NICHT mit dem Raster und bleiben literal.
//  6. Rhythmus-Schutz, fSnap/basis: snapWert(…, phase, rc) = alter snapWert.
//  7. Fill-Stem-Paare, dz: alt
//     `(N === 24 && |Math.round(d) − d| ≤ 0.35) ? Math.round(d) : Math.round(d*2)/2`
//     — das ist wörtlich snapWert(d, 0, rc) mit rasterGrob = 1 für N === 24.
//  8. Fill-Stem-Paare, zentrumserhaltende Prüfung: alt
//     `|basis − Math.round(basis * 2) / 2| > 0.01`, neu
//     `|basis − rund(basis, rc.raster)| > 0.01` (Phase hier stets 0).
//  9. Unverändert übernommen: Gelenk-Schutz, Extrema-Hinting, Mitte-Schutz
//     (N/2 ± 0.05), Spiegel-Kopplung, Winkel-Kipp-Prüfung 0.05°,
//     Rechteck-Finalisierung, geradeKanten, engeLuecken, schiefeWinkel.
//
// – erkennt gerade, (nahezu) achsparallele Kanten inkl. Mikro-Neigung bis
//   0,08 px und BEGRADIGT sie
// – Kantenpaare im Konturabstand rasten STARR als Paar → Strichgewicht bleibt
//   bit-genau
// – Einzelkanten aufs konfigurierte Raster, bei gesetztem rasterGrob bevorzugt
//   das gröbere Raster; Kurven/Diagonalen unangetastet
const SNAP = { NEIGUNG: 0.08, LUECKE: 0.15, SPANNE: 0.3, MAXWEG: 0.3, GROB_TOLERANZ: 0.35 };

// Raster-Konfig defensiv normalisieren (fehlende Felder → altes Verhalten).
function snap_rc(rc) {
  const r = rc && typeof rc.raster === 'number' && rc.raster > 0 ? rc.raster : 0.5;
  const grob = rc && typeof rc.rasterGrob === 'number' && rc.rasterGrob > 0 ? rc.rasterGrob : null;
  return { raster: r, rasterGrob: grob };
}

// Runden auf ein Raster r mit Phasenversatz (Mittellinien von Konturen liegen
// nicht auf dem Raster, sondern um die halbe Strichstärke versetzt).
function rund(wert, r, phase = 0) {
  return Math.round((wert - phase) / r) * r + phase;
}

// Ein Wert aufs Raster: erst grob (wenn konfiguriert und der Weg kurz genug
// ist), sonst aufs feine Raster.
function snapWert(wert, phase, rc) {
  const c = snap_rc(rc);
  if (c.rasterGrob) {
    const grob = rund(wert, c.rasterGrob, phase);
    if (Math.abs(grob - wert) <= SNAP.GROB_TOLERANZ) return grob;
  }
  return rund(wert, c.raster, phase);
}

function geradeKanten(netz, V, achse) {
  const quer = achse === 'x' ? 'y' : 'x';
  const idx = new Set();
  netz.segments.forEach(seg => {
    const a = V[seg.start], b = V[seg.end];
    const t0 = seg.tangentStart || { x: 0, y: 0 }, t1 = seg.tangentEnd || { x: 0, y: 0 };
    if (t0.x || t0.y || t1.x || t1.y) return;                       // Kurve
    if (Math.abs(a[achse] - b[achse]) <= SNAP.NEIGUNG &&
        Math.abs(a[quer] - b[quer]) > SNAP.NEIGUNG) { idx.add(seg.start); idx.add(seg.end); }
  });
  const arr = [...idx].sort((i, j) => V[i][achse] - V[j][achse]);
  const cluster = []; let g = [];
  for (const i of arr) {
    if (g.length && (V[i][achse] - V[g[g.length - 1]][achse] > SNAP.LUECKE
                  || V[i][achse] - V[g[0]][achse] > SNAP.SPANNE)) { cluster.push(g); g = []; }
    g.push(i);
  }
  if (g.length) cluster.push(g);
  return cluster.map(g2 => ({ idx: g2, wert: g2.reduce((s2, i) => s2 + V[i][achse], 0) / g2.length }));
}

// Schärfe-Metrik fürs Audit: wie viele gerade Kanten liegen auf dem Raster?
function rasterRate(flat, raster) {
  if (!flat.vectorNetwork) return null;
  const r = snap_rc({ raster }).raster;
  const netz = flat.vectorNetwork;
  const V = netz.vertices.map(v => Object.assign({}, v));
  const off = { x: flat.x, y: flat.y };
  let auf = 0, gesamt = 0;
  for (const achse of ['x', 'y']) {
    geradeKanten(netz, V, achse).forEach(c => {
      gesamt++;
      const w = c.wert + off[achse];
      if (Math.abs(w - rund(w, r)) < 0.01) auf++;
    });
  }
  return { auf, gesamt };
}

// Stroke-Snapping: rastet die LEBENDIGE Geometrie vor dem Flatten —
// Mittellinien von Konturen mit gewichtsabhängigem Versatz (Phase = (w/2) % raster),
// Kanten füllungsbasierter Formen direkt aufs Raster. Stroke-Fassung und
// geflattete Library entstehen danach aus derselben Geometrie und sind
// kantenidentisch. Behandelt VECTOR (auch 90°-rotiert), RECTANGLE und LINE,
// rekursiv durch Booleans.
async function strokeSnap(box, N, rc) {
  const RC = snap_rc(rc);
  const bT = box.absoluteTransform, b02 = bT[0][2], b12 = bT[1][2];
  function num(w) { return typeof w === 'number' ? w : 0; }
  function gewichtVon(x) {
    if ((x.strokes || []).length === 0) return 0;
    return num(x.strokeWeight) || num(x.strokeTopWeight) || num(x.strokeLeftWeight) || 0;
  }
  const eintraege = { x: [], y: [] };
  const belegt = new Set(); // (node|vertex|achse), die schon über gerade Segmente rasten
  const vecJobs = new Map();
  function geradeWinkel(V, segs) {
    return segs.map(seg => {
      const t0 = seg.tangentStart || { x: 0, y: 0 }, t1 = seg.tangentEnd || { x: 0, y: 0 };
      if (t0.x || t0.y || t1.x || t1.y) return null;
      const A = V[seg.start], B = V[seg.end];
      return Math.atan2(B.y - A.y, B.x - A.x);
    });
  }
  function vecJob(node) {
    if (!vecJobs.has(node)) {
      const netz = node.vectorNetwork;
      const V = netz.vertices.map(v => Object.assign({}, v));
      vecJobs.set(node, { netz, V, dirty: false,
        winkel0: geradeWinkel(V, netz.segments) });
    }
    return vecJobs.get(node);
  }
  const rectJobs = new Map();
  function rectJob(node) {
    if (!rectJobs.has(node)) rectJobs.set(node, {});
    return rectJobs.get(node);
  }

  for (const node of box.findAll(x => true)) {
    const t = node.absoluteTransform;
    const rigide = Math.abs(Math.abs(t[0][0] * t[1][1] - t[0][1] * t[1][0]) - 1) < 0.001 &&
      ((Math.abs(t[0][1]) < 1e-6 && Math.abs(t[1][0]) < 1e-6) ||
       (Math.abs(t[0][0]) < 1e-6 && Math.abs(t[1][1]) < 1e-6));
    if (!rigide) continue;
    const toBox = (lx, ly) => [t[0][0] * lx + t[0][1] * ly + t[0][2] - b02,
                               t[1][0] * lx + t[1][1] * ly + t[1][2] - b12];
    // Box-Delta entlang einer Achse → lokales Delta (R ist orthogonal, Inverse = Transponierte)
    const axDelta = (achse, d) => {
      const v = achse === 'x' ? [d, 0] : [0, d];
      return [t[0][0] * v[0] + t[1][0] * v[1], t[0][1] * v[0] + t[1][1] * v[1]];
    };

    if (node.type === 'VECTOR' && node.vectorNetwork) {
      const w = gewichtVon(node);
      const phase = w ? (w / 2) % RC.raster : 0;
      const job = vecJob(node);
      // GELENK-SCHUTZ: Vertices, an denen eine gerade DIAGONALE hängt.
      // Eine gerastete Achskante würde das geteilte Gelenk mitziehen und
      // die Diagonale aus dem Winkel kippen (queue-down-Pfeilspitze).
      const diagGelenk = new Set();
      node.vectorNetwork.segments.forEach(seg => {
        const t0 = seg.tangentStart || { x: 0, y: 0 }, t1 = seg.tangentEnd || { x: 0, y: 0 };
        if (t0.x || t0.y || t1.x || t1.y) return;
        const A = job.V[seg.start], B = job.V[seg.end];
        const a = toBox(A.x, A.y), b = toBox(B.x, B.y);
        const achsig = Math.abs(a[0] - b[0]) <= SNAP.NEIGUNG || Math.abs(a[1] - b[1]) <= SNAP.NEIGUNG;
        if (!achsig) { diagGelenk.add(seg.start); diagGelenk.add(seg.end); }
      });
      node.vectorNetwork.segments.forEach(seg => {
        const t0 = seg.tangentStart || { x: 0, y: 0 }, t1 = seg.tangentEnd || { x: 0, y: 0 };
        if (t0.x || t0.y || t1.x || t1.y) return;
        const A = job.V[seg.start], B = job.V[seg.end];
        const a = toBox(A.x, A.y), b = toBox(B.x, B.y);
        for (const [achse, i0, i1, q0, q1] of [['x', 0, 0, 1, 1], ['y', 1, 1, 0, 0]]) {
          if (Math.abs(a[i0] - b[i1]) <= SNAP.NEIGUNG && Math.abs(a[q0] - b[q1]) > SNAP.NEIGUNG) {
            belegt.add(node.id + '|' + seg.start + '|' + achse);
            belegt.add(node.id + '|' + seg.end + '|' + achse);
            eintraege[achse].push({
              wert: (a[i0] + b[i1]) / 2, phase,
              gelenk: diagGelenk.has(seg.start) || diagGelenk.has(seg.end),
              apply: ziel => {
                [[seg.start, a[i0]], [seg.end, b[i1]]].forEach(([vi, boxW]) => {
                  const d = axDelta(achse, ziel - boxW);
                  job.V[vi].x += d[0]; job.V[vi].y += d[1];
                });
                job.dirty = true;
              }
            });
          }
        }
      });
      // Extrema-Hinting: Kurven-Scheitel (achsparallele Tangenten) einrasten —
      // Glockenkuppeln, Sprechblasen-Oberkanten, Bögen. Verschiebung ≤ 0,3 px.
      const inzidenz = new Map();
      node.vectorNetwork.segments.forEach(seg => {
        const t0 = seg.tangentStart || { x: 0, y: 0 }, t1 = seg.tangentEnd || { x: 0, y: 0 };
        const kurve = !!(t0.x || t0.y || t1.x || t1.y);
        const richt = (vi, tg, oi) => {
          const d = (tg.x || tg.y) ? [tg.x, tg.y]
            : [job.V[oi].x - job.V[vi].x, job.V[oi].y - job.V[vi].y];
          return [t[0][0] * d[0] + t[0][1] * d[1], t[1][0] * d[0] + t[1][1] * d[1]];
        };
        [[seg.start, t0, seg.end], [seg.end, t1, seg.start]].forEach(([vi, tg, oi]) => {
          if (!inzidenz.has(vi)) inzidenz.set(vi, { dirs: [], kurve: false });
          const e2 = inzidenz.get(vi);
          e2.dirs.push(richt(vi, tg, oi)); e2.kurve = e2.kurve || kurve;
        });
      });
      for (const [vi, inf] of inzidenz) {
        if (!inf.kurve || inf.dirs.length < 2) continue;
        const p0 = toBox(job.V[vi].x, job.V[vi].y);
        for (const [achse2, ia] of [['x', 0], ['y', 1]]) {
          if (belegt.has(node.id + '|' + vi + '|' + achse2)) continue;
          const qa = ia === 0 ? 1 : 0;
          const flach = inf.dirs.every(d => Math.abs(d[ia]) <= 0.1 * Math.max(1e-6, Math.abs(d[qa])));
          if (!flach) continue;
          const wert = p0[ia];
          eintraege[achse2].push({ wert, phase, apply: ziel => {
            const d = axDelta(achse2, ziel - wert);
            job.V[vi].x += d[0]; job.V[vi].y += d[1]; job.dirty = true; } });
        }
      }
    }

    if (node.type === 'RECTANGLE' && Math.abs(t[0][1]) < 1e-6) {
      const w = gewichtVon(node);
      const phase = w ? (w / 2) % RC.raster : 0;
      const o = toBox(0, 0);
      const kanten = [
        ['x', 'links',  o[0]],               ['x', 'rechts', o[0] + node.width],
        ['y', 'oben',   o[1]],               ['y', 'unten',  o[1] + node.height]];
      kanten.forEach(([achse, name2, wert]) => {
        eintraege[achse].push({ wert, phase,
          apply: ziel => { rectJob(node)[name2] = ziel; } });
      });
    }

    if (node.type === 'LINE') {
      const w = gewichtVon(node); if (!w) continue;
      const phase = (w / 2) % RC.raster;
      const o = toBox(0, 0), e = toBox(node.width, 0);
      if (Math.abs(o[1] - e[1]) <= SNAP.NEIGUNG) {         // waagerecht in Box-Sicht
        eintraege.y.push({ wert: o[1], phase,
          apply: ziel => { node.y = node.y + (ziel - o[1]); } });
      } else if (Math.abs(o[0] - e[0]) <= SNAP.NEIGUNG) {  // senkrecht
        eintraege.x.push({ wert: o[0], phase,
          apply: ziel => { node.x = node.x + (ziel - o[0]); } });
      }
    }
  }

  // Clustern je Achse UND Phasen-Klasse, dann rasten.
  // MITTE-SCHUTZ: Linien auf der Box-Mittelachse werden NIE verschoben — ihre
  // Gegenstücke (Diagonalen/Spitzen) können nicht mitwandern, das Icon würde
  // verformt (arrow-Schaft). Symmetrie schlägt Schärfe.
  // SPIEGEL-KOPPLUNG: Cluster, die einander an der Mitte spiegeln (menu, pause),
  // übernehmen das gespiegelte Ziel des Partners statt unabhängig zu runden.
  let bewegt = 0;
  for (const achse of ['x', 'y']) {
    const klassen = {};
    eintraege[achse].forEach(e => {
      const k = String(Math.round(e.phase * 100));
      (klassen[k] = klassen[k] || []).push(e);
    });
    for (const k of Object.keys(klassen)) {
      const arr = klassen[k].sort((a, b) => a.wert - b.wert);
      const cluster = [];
      let gruppe = [];
      const abschliessen = () => { if (gruppe.length) {
        cluster.push({ gruppe, mittel: gruppe.reduce((s2, e) => s2 + e.wert, 0) / gruppe.length });
        gruppe = []; } };
      for (const e of arr) {
        if (gruppe.length && (e.wert - gruppe[gruppe.length - 1].wert > SNAP.LUECKE
                           || e.wert - gruppe[0].wert > SNAP.SPANNE)) abschliessen();
        gruppe.push(e);
      }
      abschliessen();

      const ziel = new Array(cluster.length).fill(undefined);

      // RHYTHMUS-SCHUTZ: ≥3 parallele Linien mit gleichem Abstand (Listen-Icons).
      // Einzelrundung (v. a. die Präferenz des groben Rasters) macht aus
      // 5,33/5,33/5,33 sonst 5/6/5 — die Reihe kippt. Regel: rasterbarer
      // Abstand → Reihe STARR verschieben (zentrumserhaltend, wenn sie um
      // N/2 symmetrisch liegt), sonst Reihe komplett pinnen.
      // Die Toleranzen 0.06 und 0.02 skalieren bewusst NICHT mit dem Raster.
      let i0 = 0;
      while (i0 < cluster.length - 2) {
        const g = cluster[i0 + 1].mittel - cluster[i0].mittel;
        let ende = i0 + 1;
        while (ende + 1 < cluster.length &&
               Math.abs((cluster[ende + 1].mittel - cluster[ende].mittel) - g) <= 0.06) ende++;
        const n2 = ende - i0 + 1;
        if (n2 >= 3) {
          const idx = []; for (let k2 = i0; k2 <= ende; k2++) idx.push(k2);
          const gelenkig = idx.some(k2 => cluster[k2].gruppe.some(e => e.gelenk));
          const gapZiel = snapWert(g, 0, RC);
          const rasterbar = Math.abs(gapZiel - g) <= 0.02;
          let basis = null;
          if (!gelenkig && rasterbar) {
            const reiheMitte = (cluster[i0].mittel + cluster[ende].mittel) / 2;
            if (Math.abs(reiheMitte - N / 2) <= 0.05) {
              const f = N / 2 - (n2 - 1) * gapZiel / 2;              // zentrumserhaltend
              const fSnap = snapWert(f, cluster[i0].gruppe[0].phase, RC);
              if (Math.abs(fSnap - f) <= 0.01) basis = f;
            } else {
              basis = snapWert(cluster[i0].mittel, cluster[i0].gruppe[0].phase, RC);
            }
          }
          const passt = basis != null &&
            idx.every((k2, q) => Math.abs(basis + q * gapZiel - cluster[k2].mittel) <= SNAP.MAXWEG);
          idx.forEach((k2, q) => { ziel[k2] = passt ? basis + q * gapZiel : null; });
        }
        i0 = n2 >= 3 ? ende + 1 : i0 + 1;
      }

      // FILL-STEM-PAARE: Flächen-Balken (audio-bars, pause …) haben zwei
      // Füllkanten (Phase 0) in beliebigem Abstand. Einzeln gerundet werden
      // gleiche Balken ungleich (v. a. bei grobem Raster) — deshalb:
      // benachbarte Kanten als Paar, Breite mitrunden, starr setzen.
      for (let i = 0; i + 1 < cluster.length; i++) {
        if (ziel[i] !== undefined || ziel[i + 1] !== undefined) continue;
        const cA = cluster[i], cB = cluster[i + 1];
        if (cA.gruppe[0].phase !== 0 || cB.gruppe[0].phase !== 0) continue;
        if (cA.gruppe.some(e => e.gelenk) || cB.gruppe.some(e => e.gelenk)) continue;
        const d = cB.mittel - cA.mittel;
        if (d < 0.8 || d > 4.5) continue;
        const dz = snapWert(d, 0, RC);
        if (dz < 0.5 || Math.abs(dz - d) > 0.3) continue;
        const paarMitte = (cA.mittel + cB.mittel) / 2;
        let basis;
        if (Math.abs(paarMitte - N / 2) <= 0.05) {
          basis = N / 2 - dz / 2;                                   // zentrumserhaltend
          if (Math.abs(basis - rund(basis, RC.raster)) > 0.01) { ziel[i] = null; ziel[i + 1] = null; continue; }
        } else {
          basis = snapWert(cA.mittel, 0, RC);
        }
        if (Math.abs(basis - cA.mittel) <= SNAP.MAXWEG &&
            Math.abs(basis + dz - cB.mittel) <= SNAP.MAXWEG + Math.abs(dz - d)) {
          ziel[i] = basis; ziel[i + 1] = basis + dz; i++;           // Paar verbraucht
        }
      }

      for (let i = 0; i < cluster.length; i++) {
        if (ziel[i] !== undefined) continue;
        const c = cluster[i];
        if (c.gruppe.some(e => e.gelenk)) { ziel[i] = null; continue; }        // Gelenk-Schutz
        if (Math.abs(c.mittel - N / 2) <= 0.05) { ziel[i] = null; continue; }  // Mitte-Schutz
        const z = snapWert(c.mittel, c.gruppe[0].phase, RC);
        ziel[i] = Math.abs(z - c.mittel) <= SNAP.MAXWEG ? z : null;
      }
      for (let i = 0; i < cluster.length; i++) for (let j = i + 1; j < cluster.length; j++) {
        if (Math.abs(cluster[i].mittel + cluster[j].mittel - N) > 0.08) continue;
        if (ziel[i] == null) { if (ziel[j] != null && Math.abs(ziel[j] - cluster[j].mittel) > 0.0005) ziel[j] = null; continue; }
        const gespiegelt = N - ziel[i];
        if (Math.abs(gespiegelt - cluster[j].mittel) <= SNAP.MAXWEG &&
            Math.abs(gespiegelt - (ziel[j] == null ? cluster[j].mittel : ziel[j])) > 0.0005) {
          if (ziel[j] == null || Math.abs(ziel[j] - gespiegelt) <= 0.01) ziel[j] = gespiegelt;
        }
      }
      cluster.forEach((c, i) => {
        if (ziel[i] == null) return;
        const noetig = c.gruppe.some(e => Math.abs(ziel[i] - e.wert) > 0.0005);
        if (noetig) { c.gruppe.forEach(e => e.apply(ziel[i])); bewegt++; }
      });
    }
  }

  // Rechtecke final setzen (x/y zuerst, dann Maß)
  for (const [node, j] of rectJobs) {
    const o = { x: node.x, y: node.y, w: node.width, h: node.height };
    // Deltas aus Box-Zielen: parent-Ketten sind unrotiert → Box-Delta == lokales Delta.
    if (j.links != null && j.rechts != null) { const bx = node.absoluteTransform[0][2] - b02;
      node.x = o.x + (j.links - bx);
      node.resize(Math.max(0.01, (j.rechts - j.links)), node.height); }
    else if (j.links != null) { const bx = node.absoluteTransform[0][2] - b02; node.x = o.x + (j.links - bx); }
    else if (j.rechts != null) { const bx = node.absoluteTransform[0][2] - b02;
      node.resize(Math.max(0.01, j.rechts - bx), node.height); }
    if (j.oben != null && j.unten != null) { const by = node.absoluteTransform[1][2] - b12;
      node.y = node.y + (j.oben - by);
      node.resize(node.width, Math.max(0.01, (j.unten - j.oben))); }
    else if (j.oben != null) { const by = node.absoluteTransform[1][2] - b12; node.y = node.y + (j.oben - by); }
    else if (j.unten != null) { const by = node.absoluteTransform[1][2] - b12;
      node.resize(node.width, Math.max(0.01, j.unten - by)); }
  }
  let geschuetzt = 0;
  for (const [node, job] of vecJobs) {
    if (!job.dirty) continue;
    const winkel1 = geradeWinkel(job.V, job.netz.segments);
    const gekippt = job.winkel0.some((w0, i) => {
      const w1 = winkel1[i];
      if (w0 == null || w1 == null) return false;
      let d = Math.abs(w1 - w0) * 180 / Math.PI;
      if (d > 180) d = 360 - d;
      return d > 0.05;
    });
    if (gekippt) { job.dirty = false; geschuetzt++; continue; }  // Knoten unangetastet lassen
    await node.setVectorNetworkAsync({ vertices: job.V, segments: job.netz.segments, regions: job.netz.regions });
  }
  return { bewegt, geschuetzt };
}

// Enge Zwischenräume finden: Abstände paralleler gerader Kanten unter 1 px
// verschlammen bei 1× — Prüfregel fürs Audit (relevant bei der 14er).
function engeLuecken(flat) {
  if (!flat.vectorNetwork) return [];
  const netz = flat.vectorNetwork;
  const V = netz.vertices.map(v => Object.assign({}, v));
  const funde = [];
  for (const achse of ['x', 'y']) {
    const werte = geradeKanten(netz, V, achse).map(c => c.wert).sort((a, b) => a - b);
    for (let i = 1; i < werte.length; i++) {
      const d = werte[i] - werte[i - 1];
      if (d > 0.05 && d < 0.95) funde.push(d);
    }
  }
  return funde;
}

// Schiefe Winkel finden: gerade Segmente, die KNAPP neben einem kanonischen
// Winkel (0/30/45/60/90°) liegen — vermutliche Zeichenfehler. Bewusst nur
// Warnung, kein Auto-Fix: Segmentenden hängen an Nachbargeometrie.
// Ergänzt die pixelbasierte Begradigung (0,08 px), die lange, leicht
// gekippte Kanten prinzipbedingt nicht erkennt.
function schiefeWinkel(wurzel) {
  const funde = new Map();
  for (const node of [wurzel, ...wurzel.findAll(x => true)]) {
    if (node.type !== 'VECTOR' || !node.vectorNetwork) continue;
    const t = node.absoluteTransform;
    const V = node.vectorNetwork.vertices;
    node.vectorNetwork.segments.forEach(seg => {
      const t0 = seg.tangentStart || { x: 0, y: 0 }, t1 = seg.tangentEnd || { x: 0, y: 0 };
      if (t0.x || t0.y || t1.x || t1.y) return;
      const A = V[seg.start], B = V[seg.end];
      const dx = t[0][0] * (B.x - A.x) + t[0][1] * (B.y - A.y);
      const dy = t[1][0] * (B.x - A.x) + t[1][1] * (B.y - A.y);
      if (Math.hypot(dx, dy) < 4) return;               // Mini-Segmente ignorieren
      let a = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      if (a > 90) a = 180 - a;
      for (const soll of [0, 30, 45, 60, 90]) {
        const d = Math.abs(a - soll);
        if (d > 0.15 && d <= 2.5) {
          const key = soll + '|' + Math.round(a * 20);
          if (!funde.has(key)) funde.set(key, a.toFixed(2) + '° (soll ' + soll + '°)');
        }
      }
    });
  }
  return [...funde.values()];
}

// ===== 40-adapter.js =====
// ===========================================================================
// 40-adapter.js — Adapter-Schicht.
// Ein Adapter beantwortet vier Fragen: Was ist ausgewählt (Ziel)? Wo liegt das
// bestehende Set? Wohin kommt ein neues? Und was ist danach zu pflegen?
// 60-build kennt nur noch „Ziele“, keine ZDS-Karten mehr.
//
// Ziel = { name, src, klasse, klasseQuelle, karte, fokusNode }
// ===========================================================================

// Laufzeit-Kontext: Adapter-Referenzen + aufgelöste Farbvariable.
let CTX = { farbVariable: null, farbSchluessel: null, zds: null, frei: null };
let ADAPTER = null;

const ZDS_KARTEN_FRAME = 'ZDS Icons · Karten';
const ZDS_STROKE_HEIM = 'ZDS Icons · Stroke-Fassungen (optimiert)';
const FREI_STROKE_HEIM = 'Icon Pipeline · Stroke';

// Quadratisch und (±0.5) auf Master-Maß?
function hatMasterMass(node) {
  const g = CFG.master.groesse;
  return Math.abs(node.width - g) <= 0.5 && Math.abs(node.height - g) <= 0.5;
}

function seiteVon(node) {
  let n = node;
  while (n && n.type !== 'PAGE') n = n.parent;
  return n || null;
}

// ---------------------------------------------------------------- ZDS -----

function zdsKarteZu(node) {
  let n = node;
  while (n && n.type !== 'PAGE') { if (/^Karte · /.test(n.name)) return n; n = n.parent; }
  return null;
}

function zdsIconName(karte) {
  return karte.name.replace(/^Karte · /, '').replace(/ \(verschlankt\)$/, '');
}

async function zdsSourceZu(karte) {
  const z1 = karte.children.find(c => c.name === '01 · source');
  if (!z1) return null;
  const comp = z1.children.find(c => c.type === 'COMPONENT');
  if (comp) return comp;
  const inst = z1.children.find(c => c.type === 'INSTANCE' && c.name !== 'grid');
  if (inst) return await inst.getMainComponentAsync();
  return null;
}

// Klasse zuerst aus der Grid-Instanz (verlässlich), sonst aus dem Seitenverhältnis.
async function zdsKlasseZu(karte, src) {
  const z1 = karte.children.find(c => c.name === '01 · source');
  const g = z1 && z1.children.find(c => c.name === 'grid');
  if (g && g.type === 'INSTANCE') {
    const mc = await g.getMainComponentAsync();
    if (mc) {
      const k = mc.name.replace('GuideType=', '');
      if (KLASSEN.indexOf(k) >= 0) return { klasse: k, quelle: 'grid' };
      if (k === 'Keylines') return { klasse: 'Square', quelle: 'grid' };
    }
  }
  return klasseRaten(src);
}

// Seitenverhältnis → Klasse (identisch zu v1).
function klasseRaten(src) {
  const m = src ? gb(src) : null;
  const r = m ? m.w / m.h : 1;
  return { klasse: r >= 1.2 ? 'Wide' : (r <= 0.833 ? 'Tall' : 'Square'), quelle: 'heuristik' };
}

function zdsLibrarySet(name) {
  const c = CTX.zds;
  const s = c.IC.findAll(n => n.type === 'COMPONENT_SET' && n.name === name)[0];
  if (s) return s;
  // Tab-Bar-Fallback: dort liegen die zurückgestellten Sets mit Punkt-Präfix.
  return c.TB ? (c.TB.findAll(n => n.type === 'COMPONENT_SET' && n.name === '.' + name)[0] || null) : null;
}

function zdsKarten() {
  const c = CTX.zds;
  const karten = [];
  [c.K, c.TB].filter(Boolean).forEach(s =>
    s.children.filter(x => /^Karte · /.test(x.name)).forEach(x => karten.push(x)));
  return karten;
}

// Preview-Zellen der Karte mit Instanzen der frisch gebauten Varianten füllen.
function zdsPreviewFuellen(karte, name, set) {
  const z2 = karte.children.find(c => c.name === '02 · library auf dem Grid');
  if (!z2) return;
  for (const g of CFG.groessen) {
    const N = g.N;
    const grid = z2.children.find(c => c.name === 'grid' && Math.round(c.width) === N);
    if (!grid) continue;
    const da = z2.children.find(c => c.type === 'INSTANCE' && c.name !== 'grid' && Math.round(c.width) === N);
    if (da) continue;
    const v = set.children.find(c => c.name === variantenName(N));
    if (!v) continue;
    const i = v.createInstance(); z2.appendChild(i); i.name = name; i.x = grid.x; i.y = grid.y;
  }
}

const adapterZds = {
  name: 'zds',

  async erkennen() {
    const IC = figma.root.children.find(p => p.name === 'Icons');
    const SRC = figma.root.children.find(p => p.name === 'Source');
    if (!IC || !SRC) return false;
    try { await SRC.loadAsync(); } catch (e) { return false; }
    return !!SRC.children.find(c => c.name === ZDS_KARTEN_FRAME);
  },

  async kontext() {
    await figma.loadAllPagesAsync();
    const IC = figma.root.children.find(p => p.name === 'Icons');
    const SRC = figma.root.children.find(p => p.name === 'Source');
    if (!IC || !SRC) throw new PipelineFehler('SEITEN_FEHLEN');
    await IC.loadAsync(); await SRC.loadAsync();
    const K = SRC.children.find(c => c.name === ZDS_KARTEN_FRAME);
    const TB = SRC.children.find(c => /^Tab-Bar · zurückgestellt/.test(c.name));
    const STATUS = SRC.findAll(n => n.type === 'COMPONENT_SET' && n.name === '.Icon status')[0] || null;
    CTX.zds = { IC: IC, SRC: SRC, K: K, TB: TB, STATUS: STATUS };
    return CTX.zds;
  },

  async aufloesen(sel) {
    if (!sel || !CTX.zds) return null;
    let karte = zdsKarteZu(sel);
    if (!karte) {
      // Auswahl im Library-Set → zugehörige Karte über den Namen finden.
      let n = sel;
      while (n && n.type !== 'PAGE' && n.type !== 'COMPONENT_SET') n = n.parent;
      if (n && n.type === 'COMPONENT_SET' && CTX.zds.K)
        karte = CTX.zds.K.children.find(c => c.name === 'Karte · ' + n.name)
             || CTX.zds.K.children.find(c => c.name === 'Karte · ' + n.name.replace(/^\./, ''))
             || null;
    }
    if (!karte) return null;
    return await zdsZiel(karte);
  },

  zielSet(ziel) { return zdsLibrarySet(ziel.name); },

  zielEltern(ziel) { return { node: CTX.zds.IC, x: 80, y: 120 }; },

  arbeitsFlaeche(ziel) { return CTX.zds.IC; },

  // Ablage für ungeplättete, optimierte Fassungen — wird nie publiziert.
  strokeHeim(ziel) {
    const SRC = CTX.zds.SRC;
    let h = SRC.children.find(c => c.name === ZDS_STROKE_HEIM);
    if (h) return h;
    h = figma.createFrame(); SRC.appendChild(h);
    h.name = ZDS_STROKE_HEIM;
    const alt = SRC.children.find(c => /Arbeitsdateien \(versteckt\)/.test(c.name));
    h.x = alt ? alt.x : 100; h.y = alt ? alt.y + alt.height + 80 : 100;
    h.resize(1250, 240);
    h.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    return h;
  },

  async alle() {
    const ziele = [];
    for (const karte of zdsKarten()) ziele.push(await zdsZiel(karte));
    return ziele;
  },

  async nachBuild(ziel, set, info) {
    const karte = ziel.karte;
    if (!karte) return;
    zdsPreviewFuellen(karte, ziel.name, set);
    // Suchbegriffe aus der Karte in die Set-Beschreibung spiegeln.
    const mk = karte.children.find(c => c.name === 'meta · keywords');
    const kw = mk && mk.children[1] ? mk.children[1].characters : null;
    if (kw && !/\{keywords/.test(kw))
      set.description = t('set.suchbegriffe', { basis: setBeschreibung(ziel.name), kw: kw });
    // Status-Chip der Karte auf „published“.
    if (CTX.zds.STATUS) {
      const chip = karte.children.find(c => c.name === 'status' && c.type === 'INSTANCE');
      const pub = CTX.zds.STATUS.children.find(c => c.name === 'status=published');
      if (chip && pub) { try { chip.swapComponent(pub); } catch (e) {} }
    }
  }
};

async function zdsZiel(karte) {
  const name = zdsIconName(karte);
  const src = await zdsSourceZu(karte);
  const kl = src ? await zdsKlasseZu(karte, src) : { klasse: 'Square', quelle: 'heuristik' };
  return {
    name: name, src: src, klasse: kl.klasse, klasseQuelle: kl.quelle,
    karte: karte, fokusNode: karte
  };
}

// --------------------------------------------------------------- Frei -----

// '.Name (72px source)' → 'Name'
function freiNameBereinigen(name) {
  return String(name == null ? '' : name)
    .replace(/^\.+/, '')
    .replace(/\s*\([^()]*\)\s*$/, '')
    .trim();
}

function freiKlasse(src) {
  let ov = '';
  try { ov = src.getPluginData(KLASSE_SCHLUESSEL) || ''; } catch (e) {}
  if (KLASSEN.indexOf(ov) >= 0) return { klasse: ov, quelle: 'override' };
  return klasseRaten(src);
}

function freiZielAusSource(src, name) {
  const kl = freiKlasse(src);
  return {
    name: name || freiNameBereinigen(src.name),
    src: src, klasse: kl.klasse, klasseQuelle: kl.quelle,
    karte: null, fokusNode: src
  };
}

// Source über den Namen suchen: aktuelle Seite zuerst, dann alle Seiten.
async function freiSourceSuchen(name) {
  const passt = n => n.type === 'COMPONENT' && hatMasterMass(n) && freiNameBereinigen(n.name) === name;
  const hier = figma.currentPage.findAll(passt)[0];
  if (hier) return hier;
  await figma.loadAllPagesAsync();
  for (const p of figma.root.children) {
    if (p === figma.currentPage) continue;
    try { await p.loadAsync(); } catch (e) { continue; }
    const f = p.findAll(passt)[0];
    if (f) return f;
  }
  return null;
}

// Ein einzelner Knoten → Ziel oder null.
async function freiZielAusKnoten(node) {
  if (!node) return null;

  // 1) Variante eines Sets → über das Set gehen.
  if (node.type === 'COMPONENT' && istVariantenName(node.name) &&
      node.parent && node.parent.type === 'COMPONENT_SET') {
    return await freiZielAusSet(node.parent);
  }

  // 2) Varianten-Set.
  if (node.type === 'COMPONENT_SET') return await freiZielAusSet(node);

  // 3) Master-Komponente = Source.
  if (node.type === 'COMPONENT' && hatMasterMass(node)) return freiZielAusSource(node);

  // 4) Frame im Master-Maß → Ziel ohne src; die Umwandlung in eine Komponente
  //    passiert erst beim Bauen (quellePruefen), nie bei der bloßen Auswahl.
  if (node.type === 'FRAME' && hatMasterMass(node)) {
    const name = freiNameBereinigen(node.name);
    const kl = klasseRaten(node);
    return { name: name, src: null, frame: node, klasse: kl.klasse, klasseQuelle: kl.quelle,
      karte: null, fokusNode: node };
  }

  return null;
}

async function freiZielAusSet(set) {
  const hatVarianten = set.children.some(c => istVariantenName(c.name));
  if (!hatVarianten) return null;
  const name = freiNameBereinigen(set.name);
  const src = await freiSourceSuchen(name);
  if (!src) return null;
  return freiZielAusSource(src, name);
}

const adapterFrei = {
  name: 'frei',

  async erkennen() { return true; },

  async kontext() { CTX.frei = { seite: figma.currentPage.id }; return CTX.frei; },

  // Vom Selektionsknoten aufwärts, Instanzen über getMainComponentAsync.
  async aufloesen(sel) {
    let n = sel;
    while (n && n.type !== 'PAGE' && n.type !== 'DOCUMENT') {
      if (n.type === 'INSTANCE') {
        let mc = null;
        try { mc = await n.getMainComponentAsync(); } catch (e) { mc = null; }
        if (mc) { const z = await freiZielAusKnoten(mc); if (z) return z; }
      }
      const z = await freiZielAusKnoten(n);
      if (z) return z;
      n = n.parent;
    }
    return null;
  },

  zielSet(ziel) {
    const passt = n => n.type === 'COMPONENT_SET' && freiNameBereinigen(n.name) === ziel.name;
    const hier = figma.currentPage.findAll(passt)[0];
    if (hier) return hier;
    for (const p of figma.root.children) {
      if (p === figma.currentPage) continue;
      let f = null;
      // Nur bereits geladene Seiten — zielSet ist bewusst synchron.
      try { f = p.findAll(passt)[0]; } catch (e) { f = null; }
      if (f) return f;
    }
    return null;
  },

  zielEltern(ziel) {
    let p = ziel.src.parent;
    while (p && ['PAGE', 'FRAME', 'SECTION'].indexOf(p.type) < 0) p = p.parent;
    if (!p) p = figma.currentPage;
    return { node: p, x: ziel.src.x + ziel.src.width + 40, y: ziel.src.y };
  },

  arbeitsFlaeche(ziel) { return seiteVon(ziel.src) || figma.currentPage; },

  strokeHeim(ziel) {
    const seite = seiteVon(ziel.src) || figma.currentPage;
    let h = seite.children.find(c => c.type === 'FRAME' && c.name === FREI_STROKE_HEIM);
    if (h) return h;
    h = figma.createFrame(); seite.appendChild(h);
    h.name = FREI_STROKE_HEIM;
    h.x = ziel.src.x; h.y = ziel.src.y + ziel.src.height + 120;
    h.resize(1250, 240);
    h.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    return h;
  },

  // Alle Master-Komponenten der aktuellen Seite, die nicht Variante eines Sets sind.
  async alle() {
    const comps = figma.currentPage.findAll(n =>
      n.type === 'COMPONENT' && hatMasterMass(n) &&
      !(n.parent && n.parent.type === 'COMPONENT_SET'));
    return comps.map(c => freiZielAusSource(c));
  },

  async nachBuild(ziel, set, info) { /* pluginData macht 60-build zentral */ }
};

// -------------------------------------------------------------- Wahl ------

async function adapterWaehlen(cfg) {
  const wunsch = (cfg && cfg.adapter) || 'auto';
  let gewaehlt = adapterFrei;
  if (wunsch === 'zds') gewaehlt = adapterZds;
  else if (wunsch === 'frei') gewaehlt = adapterFrei;
  else {
    let ok = false;
    try { ok = await adapterZds.erkennen(); } catch (e) { ok = false; }
    gewaehlt = ok ? adapterZds : adapterFrei;
  }
  ADAPTER = gewaehlt;
  await ADAPTER.kontext();
  return ADAPTER;
}

// ===== 50-farbe.js =====
// ===========================================================================
// 50-farbe.js — Farbquellen listen, Variable auflösen, Ziel-Paint erzeugen.
// v1 kannte nur eine feste Library-Variable (Text/70). Jetzt drei Modi:
// 'variable' (wie ZDS), 'hex' und 'source' (Farbe der Source übernehmen).
// ===========================================================================

const FARBE_FALLBACK = '#444444';

function hexZuRgb(hex) {
  const h = String(hex || FARBE_FALLBACK).replace('#', '');
  const v = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  const n = parseInt(v, 16);
  if (!isFinite(n)) return { r: 0.267, g: 0.267, b: 0.267 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function rgbZuHex(c) {
  if (!c) return null;
  const k = v => ('0' + Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16)).slice(-2);
  return '#' + k(c.r) + k(c.g) + k(c.b);
}

// Ersten konkreten COLOR-Wert einer Variable holen (Alias bis zu 8× auflösen).
async function farbeWertVon(v) {
  let cur = v, tiefe = 0;
  while (cur && tiefe++ < 8) {
    const werte = cur.valuesByMode || {};
    const schluessel = Object.keys(werte);
    if (!schluessel.length) return null;
    const w = werte[schluessel[0]];
    if (w && w.type === 'VARIABLE_ALIAS') {
      try { cur = await figma.variables.getVariableByIdAsync(w.id); } catch (e) { return null; }
      continue;
    }
    return rgbZuHex(w);
  }
  return null;
}

async function farbenListen() {
  const lokal = [];
  try {
    const vs = await figma.variables.getLocalVariablesAsync('COLOR');
    for (const v of vs) {
      let koll = '';
      try {
        const c = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
        koll = c ? c.name : '';
      } catch (e) {}
      lokal.push({ id: v.id, key: v.key || '', name: v.name, kollektion: koll, hex: await farbeWertVon(v) });
    }
  } catch (e) {}

  const bibliotheken = [];
  const diagnose = { bibFehler: null, kollektionen: 0, kollektionsFehler: [] };
  try {
    if (!figma.teamLibrary) throw new Error('figma.teamLibrary fehlt — Berechtigung "teamlibrary" im Manifest?');
    const kolls = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    diagnose.kollektionen = kolls.length;
    for (const k of kolls) {
      let vars = [];
      try {
        const alle = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(k.key);
        vars = alle.filter(v => v.resolvedType === 'COLOR').map(v => ({ key: v.key, name: v.name }));
      } catch (e) { diagnose.kollektionsFehler.push(k.name + ': ' + (e && e.message)); }
      if (vars.length) bibliotheken.push({
        kollektionKey: k.key, kollektion: k.name, bibliothek: k.libraryName, variablen: vars
      });
    }
  } catch (e) { diagnose.bibFehler = (e && e.message) || String(e); }

  return { lokal: lokal, bibliotheken: bibliotheken, diagnose: diagnose };
}

// key → id → Name. Ergebnis landet in CTX.farbVariable.
async function farbeVariableAufloesen(cfgFarbe) {
  const f = cfgFarbe || (CFG && CFG.farbe) || {};
  if (f.modus !== 'variable' || !f.variable) { CTX.farbVariable = null; CTX.farbSchluessel = null; return null; }

  const sig = (f.variable.key || '') + '|' + (f.variable.id || '') + '|' + (f.variable.name || '');
  if (CTX.farbVariable && CTX.farbSchluessel === sig) return CTX.farbVariable;

  let v = null;
  if (f.variable.key) {
    try { v = await figma.variables.importVariableByKeyAsync(f.variable.key); } catch (e) { v = null; }
  }
  if (!v && f.variable.id) {
    try { v = await figma.variables.getVariableByIdAsync(f.variable.id); } catch (e) { v = null; }
  }
  if (!v && f.variable.name) {
    try {
      const alle = await figma.variables.getLocalVariablesAsync('COLOR');
      v = alle.find(x => x.name === f.variable.name) || null;
    } catch (e) { v = null; }
  }

  CTX.farbVariable = v;
  CTX.farbSchluessel = v ? sig : null;
  if (!v) melden('warn', 'FARBE_UNAUFLOESBAR', { name: f.variable.name || f.variable.key || '' });
  return v;
}

// Erster SOLID-Paint der Source: Konturen haben Vorrang vor Füllungen.
function farbeSourcePaint(src) {
  if (!src) return null;
  const knoten = [src, ...src.findAll(x => true)];
  for (const x of knoten) {
    const s = x.strokes;
    if (Array.isArray(s)) { const p = s.find(q => q && q.type === 'SOLID'); if (p) return p; }
  }
  for (const x of knoten) {
    const fl = x.fills;
    if (Array.isArray(fl)) { const p = fl.find(q => q && q.type === 'SOLID'); if (p) return p; }
  }
  return null;
}

// Paint für die geflattete Fläche.
function farbeZielPaint(srcPaint) {
  const f = (CFG && CFG.farbe) || { modus: 'source' };

  if (f.modus === 'variable') {
    // Grau wie in v1 — die Bindung überschreibt es, ohne sie bleibt es sichtbar.
    const p = { type: 'SOLID', color: { r: 0.267, g: 0.267, b: 0.267 } };
    if (CTX.farbVariable) {
      try { return figma.variables.setBoundVariableForPaint(p, 'color', CTX.farbVariable); } catch (e) {}
    }
    return p;
  }

  if (f.modus === 'hex') return { type: 'SOLID', color: hexZuRgb(f.hex || FARBE_FALLBACK) };

  // 'source': Paint der Source kopieren, inklusive boundVariables.
  if (srcPaint && srcPaint.type === 'SOLID') {
    let kopie;
    try { kopie = JSON.parse(JSON.stringify(srcPaint)); } catch (e) { kopie = null; }
    if (kopie) {
      kopie.type = 'SOLID';
      kopie.visible = true;
      if (typeof kopie.opacity !== 'number') kopie.opacity = 1;
      return kopie;
    }
  }
  return { type: 'SOLID', color: hexZuRgb(FARBE_FALLBACK) };
}

// Für die UI: kann diese Auswahl aufgelöst werden und wie sieht sie aus?
async function farbePruefen(auswahl) {
  const f = auswahl || (CFG && CFG.farbe) || {};
  if (f.modus === 'hex') {
    const h = String(f.hex || FARBE_FALLBACK);
    return { ok: /^#[0-9a-fA-F]{6}$/.test(h), hex: h, name: h };
  }
  if (f.modus === 'source') return { ok: true, hex: null, name: 'source' };

  const merk = CTX.farbVariable, merkS = CTX.farbSchluessel;
  CTX.farbVariable = null; CTX.farbSchluessel = null;
  const v = await farbeVariableAufloesen(f);
  const hex = v ? await farbeWertVon(v) : null;
  const erg = { ok: !!v, hex: hex, name: v ? v.name : ((f.variable && f.variable.name) || '') };
  // Cache nicht durch eine Probe zerschießen, wenn die aktive Konfig eine andere ist.
  if (!v) { CTX.farbVariable = merk; CTX.farbSchluessel = merkS; }
  return erg;
}

// ===== 60-build.js =====
// ===========================================================================
// 60-build.js — Bauen, Vorschau, Audit.
// Aus v1: baueGroesse, einIcon, vorschau, audit, messeGuete.
// Generalisiert: Schleifen über CFG.groessen, Ziele statt Karten, Adapter für
// Set/Eltern/Stroke-Heim/Nachpflege, Farbe über 50-farbe.
// ===========================================================================

// --- Güte-Messung (läuft in der UI: 1×-Rasterung gegen 8×-Referenz) --------

const messWarte = new Map();
let messZaehler = 0;

function messeGuete(paare) {
  return new Promise(res => {
    const id = ++messZaehler;
    const timer = setTimeout(() => { if (messWarte.has(id)) { messWarte.delete(id); res(null); } }, 6000);
    messWarte.set(id, werte => { clearTimeout(timer); res(werte); });
    ui({ type: 'mess', id: id, paare: paare });
  });
}

function messwertEinloesen(id, werte) {
  const r = messWarte.get(id);
  if (r) { messWarte.delete(id); r(werte); return true; }
  return false;
}

// --- Beschreibung ----------------------------------------------------------

function setBeschreibung(name) {
  return t('set.beschreibung', {
    name: name,
    groessen: listeUnd(groessenListe()),
    prop: CFG.variantenProperty
  });
}

// --- Source prüfen ---------------------------------------------------------

function quellePruefen(ziel) {
  // Frei-Modus: ein ausgewählter Frame wird erst jetzt zur Komponente (Undo-fähig, nur beim Bauen).
  if (!ziel.src && ziel.frame && !ziel.frame.removed && ziel.frame.type === 'FRAME') {
    const comp = figma.createComponentFromNode(ziel.frame);
    ziel.src = comp; ziel.fokusNode = comp; ziel.frame = null;
    melden('info', 'FRAME_ZU_KOMPONENTE', { name: ziel.name }, comp.id);
  }
  const src = ziel.src;
  if (!src) throw new PipelineFehler('KEINE_SOURCE',
    { name: ziel.name, mass: CFG.master.groesse }, ziel.fokusNode ? ziel.fokusNode.id : null);
  const g = CFG.master.groesse;
  if (Math.abs(src.width - g) > 0.5 || Math.abs(src.height - g) > 0.5) {
    // Warnung, kein Abbruch: der Keyline-Fit ist maßunabhängig, nur Radien/Hinweise beziehen sich auf den Master.
    melden('warn', 'SOURCE_MASS', {
      name: ziel.name,
      ist: Math.round(src.width * 100) / 100 + ' × ' + Math.round(src.height * 100) / 100,
      soll: g + ' × ' + g
    }, src.id);
  }
  if (!gb(src)) throw new PipelineFehler('SOURCE_LEER', { name: ziel.name }, src.id);
}

// --- Eine Größe bauen ------------------------------------------------------
// Ephemer. Bei aktivem Snapping entscheidet das AA-Orakel: beide Kandidaten
// (mit/ohne Snap) werden echt gerastert, der schärfere gewinnt.
async function baueGroesse(ziel, N, snap, strokeAuch) {
  const g = groesseCfg(N);
  const src = ziel.src;
  const kl = ziel.klasse;
  const achse = achseVon(kl);
  const soll = keylineVon(g, kl);
  const flaeche = ADAPTER.arbeitsFlaeche(ziel);
  const rc = { raster: g.raster, rasterGrob: g.rasterGrob };
  const srcPaint = CFG.farbe.modus === 'source' ? farbeSourcePaint(src) : null;

  async function bauKandidat(mitSnap) {
    const box = figma.createFrame(); flaeche.appendChild(box);
    box.name = '__fit'; box.x = -4000; box.y = -4000;
    box.resize(N, N); box.fills = []; box.clipsContent = false;
    const inst = src.createInstance(); box.appendChild(inst);
    konturSetzen(inst, g.kontur);
    const ist = fitten(box, inst, src, N, soll, achse);
    // Nur einmal melden: bei aktivem Snapping laufen zwei Kandidaten durch.
    if (ist == null && !mitSnap) melden('warn', 'FIT_FEHLT', { name: ziel.name, N: N }, src.id);
    const fSkal = inst.width / CFG.master.groesse;
    const det = inst.detachInstance();
    let runde = 0;
    while (runde++ < 12) {
      const a = det.findAll(n => n.type === 'INSTANCE' && !n.removed);
      if (!a.length) break;
      let ch = false;
      a.forEach(n => { try { if (!n.removed) { n.detachInstance(); ch = true; } } catch (e) {} });
      if (!ch) break;
    }
    await radienRegel(det, fSkal, g.radius);

    let gerastet = 0, geschuetzt = 0;
    if (mitSnap) { const r = await strokeSnap(box, N, rc); gerastet = r.bewegt; geschuetzt = r.geschuetzt; }

    // Ungeplättete Fassung sichern, bevor union/flatten die Kontur frisst.
    let strokeComp = null;
    if (strokeAuch) {
      strokeComp = figma.createComponent(); flaeche.appendChild(strokeComp);
      strokeComp.name = variantenName(N); strokeComp.resize(N, N);
      strokeComp.fills = []; strokeComp.clipsContent = true;
      const klon = det.clone();
      for (const kind of klon.children.slice()) {
        const cx = kind.x, cy = kind.y;
        strokeComp.appendChild(kind); kind.x = det.x + cx; kind.y = det.y + cy;
      }
      klon.remove();
    }

    let flat;
    try { const u = figma.union(det.children.slice(), det); flat = figma.flatten([u], det); }
    catch (e) {
      if (!mitSnap) melden('warn', 'UNION_FALLBACK', { name: ziel.name, N: N }, src.id);
      flat = figma.flatten(det.children.slice(), det);
    }
    flat.name = 'Stroke'; flat.strokes = [];
    flat.fills = [farbeZielPaint(srcPaint)];

    const fAbs = flat.absoluteBoundingBox, bAbs = box.absoluteBoundingBox;
    const fx = fAbs.x - bAbs.x, fy = fAbs.y - bAbs.y;
    box.appendChild(flat); flat.x = fx; flat.y = fy;
    det.remove();
    return { box: box, flat: flat, ist: ist, gerastet: gerastet, geschuetzt: geschuetzt, strokeComp: strokeComp };
  }

  if (!snap) return await bauKandidat(false);

  const A = await bauKandidat(true);   // mit Snapping
  const B = await bauKandidat(false);  // ohne
  let werte = null;
  try {
    A.box.clipsContent = true; B.box.clipsContent = true;
    const ex = async K2 => ({
      px1: await K2.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } }),
      px8: await K2.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 8 } })
    });
    werte = await messeGuete([await ex(A), await ex(B)]);
    A.box.clipsContent = false; B.box.clipsContent = false;
  } catch (e) {}
  let sieger = A, verlierer = B;
  if (werte && werte.length === 2) {
    const wa = werte[0], wb = werte[1];
    if (wb.fehler < wa.fehler - 1e-6 ||
        (Math.abs(wb.fehler - wa.fehler) <= 1e-6 && wb.aa < wa.aa)) { sieger = B; verlierer = A; }
  }
  if (verlierer.strokeComp) { try { verlierer.strokeComp.remove(); } catch (e) {} }
  verlierer.box.remove();
  if (werte && werte.length === 2) sieger.aaInfo = { snap: werte[0], plain: werte[1], mitSnap: sieger === A };
  return sieger;
}

// Protokollzeile einer Größe zusammensetzen (Wortlaut wie v1).
function bauZeile(b, N, soll, snap, vorher) {
  let s = t('bau.mass', {
    N: N,
    ist: b.ist == null ? t('bau.ohneFit') : b.ist.toFixed(3),
    soll: soll
  });
  if (snap && b.gerastet) s += t('bau.gerastet', { n: b.gerastet });
  if (snap && b.geschuetzt) s += t('bau.geschuetzt', { n: b.geschuetzt });
  if (b.aaInfo) {
    const w = b.aaInfo.mitSnap ? b.aaInfo.snap : b.aaInfo.plain;
    const gg = b.aaInfo.mitSnap ? b.aaInfo.plain : b.aaInfo.snap;
    const delta = gg.fehler > 1e-9 ? Math.round((1 - w.fehler / gg.fehler) * 100) : 0;
    s += t('bau.aa', { aa: w.aa, w: w.fehler.toFixed(3), g: gg.fehler.toFixed(3) });
    const vor = vorher[N];
    if (vor != null) s += t('bau.trend', {
      vor: vor.toFixed(3),
      pfeil: w.fehler < vor - 0.0005 ? '↓' : (w.fehler > vor + 0.0005 ? '↑' : '=')
    });
    s += b.aaInfo.mitSnap
      ? (delta > 0 ? t('bau.hinting', { delta: delta }) : t('bau.gleichwertig'))
      : t('bau.snapOhneWirkung');
  }
  return s;
}

// --- Ein Icon vollständig bauen -------------------------------------------

async function einIcon(ziel, snap, strokeAuch) {
  const name = ziel.name;
  quellePruefen(ziel);
  const src = ziel.src;

  await farbeVariableAufloesen(CFG.farbe);
  normalisieren(src);

  if (ziel.klasseQuelle === 'heuristik')
    melden('info', 'KLASSE_GERATEN', { name: name, klasse: ziel.klasse }, src.id);

  const kl = ziel.klasse;
  const achse = achseVon(kl);
  const istMaster = massAuf(gb(src), achse);
  const sollMaster = CFG.master.keylines[kl];
  const hinweis = (istMaster != null && Math.abs(istMaster - sollMaster) > 0.15)
    ? t('bau.sourceMisst', { ist: istMaster.toFixed(2), soll: sollMaster }) : '';

  let set = ADAPTER.zielSet(ziel);
  const neu = !set;
  if (neu && ADAPTER.name === 'zds') melden('info', 'KARTE_OHNE_SET', { name: name }, ziel.fokusNode ? ziel.fokusNode.id : null);

  let vorher = {};
  try {
    const pd = set ? JSON.parse(set.getPluginData(PD_SCHLUESSEL) || '{}') : {};
    vorher = pd.fehler || {};
  } catch (e) { vorher = {}; }

  const fehlerNeu = {};
  const frisch = [], ergebnisse = [], strokeComps = [];
  let ergaenzt = false;

  for (const g of CFG.groessen) {
    const N = g.N;
    const b = await baueGroesse(ziel, N, snap, strokeAuch);
    if (b.aaInfo) fehlerNeu[N] = (b.aaInfo.mitSnap ? b.aaInfo.snap : b.aaInfo.plain).fehler;
    if (b.strokeComp) strokeComps.push(b.strokeComp);
    ergebnisse.push(bauZeile(b, N, keylineVon(g, kl), snap, vorher));

    const fx = b.flat.x, fy = b.flat.y;
    if (set) {
      let v = set.children.find(c => c.name === variantenName(N));
      if (!v) {
        // Fehlende Variante ergänzen statt abzubrechen (v1 warf hier).
        v = figma.createComponent();
        v.name = variantenName(N); v.resize(N, N); v.fills = []; v.clipsContent = true;
        set.appendChild(v);
        ergaenzt = true;
        melden('info', 'VARIANTE_FEHLT', { name: name, variante: variantenName(N) }, set.id);
      } else {
        v.children.slice().forEach(c => c.remove());
      }
      v.appendChild(b.flat); b.flat.x = fx; b.flat.y = fy;
    } else {
      const comp = figma.createComponent();
      ADAPTER.arbeitsFlaeche(ziel).appendChild(comp);
      comp.name = variantenName(N); comp.resize(N, N); comp.fills = []; comp.clipsContent = true;
      comp.appendChild(b.flat); b.flat.x = fx; b.flat.y = fy;
      frisch.push(comp);
    }
    b.box.remove();
  }

  if (neu) {
    const eltern = ADAPTER.zielEltern(ziel);
    set = figma.combineAsVariants(frisch, eltern.node);
    set.name = name;
    staffeln(set);
    set.description = setBeschreibung(name);
    set.x = eltern.x; set.y = eltern.y;
  } else {
    if (ergaenzt) staffeln(set); else standardNachVorn(set);
    // Fremde Varianten bleiben unangetastet — nur melden.
    set.children.forEach(c => {
      const n = variantenN(c.name);
      if (n != null && !CFG.groessen.some(g => g.N === n))
        melden('warn', 'SET_HAT_FREMDE_VARIANTE', { name: name, variante: c.name }, c.id);
    });
  }

  // Stroke-Fassungen ablegen — kantenidentisch zur geflatteten Library.
  if (strokeAuch && strokeComps.length === CFG.groessen.length) {
    const heim = ADAPTER.strokeHeim(ziel);
    // Erst umziehen — combineAsVariants verlangt dieselbe Seite wie der Parent.
    strokeComps.forEach(q => heim.appendChild(q));
    const sName = '.' + name + ' · stroke';
    let sSet = heim.children.find(c => c.type === 'COMPONENT_SET' && c.name === sName);
    if (sSet) {
      // Inhalt tauschen — vorhandene Instanzen bleiben verbunden.
      for (let i = 0; i < CFG.groessen.length; i++) {
        const v = sSet.children.find(c => c.name === variantenName(CFG.groessen[i].N));
        const q = strokeComps[i];
        if (v && q) {
          v.children.slice().forEach(c => c.remove());
          q.children.slice().forEach(c => { const cx = c.x, cy = c.y; v.appendChild(c); c.x = cx; c.y = cy; });
          q.remove();
        }
      }
    } else {
      const anzahl = heim.children.filter(c => c.type === 'COMPONENT_SET').length;
      sSet = figma.combineAsVariants(strokeComps, heim);
      sSet.name = sName; staffeln(sSet);
      sSet.x = 40 + (anzahl % 8) * 150; sSet.y = 50 + Math.floor(anzahl / 8) * 90;
      if (sSet.x + 190 > heim.width || sSet.y + 140 > heim.height)
        heim.resizeWithoutConstraints(Math.max(heim.width, sSet.x + 190), Math.max(heim.height, sSet.y + 140));
    }
  }

  // Zentrale Nachpflege: Export-Settings + Fingerabdruck fürs Audit.
  set.children.forEach(v => { try { v.exportSettings = [{ format: 'SVG' }]; } catch (e) {} });
  try {
    set.setPluginData(PD_SCHLUESSEL, JSON.stringify({
      quelle: fingerabdruck(src), snap: !!snap, zeit: Date.now(),
      fehler: Object.assign({}, vorher, fehlerNeu)
    }));
  } catch (e) {}

  await ADAPTER.nachBuild(ziel, set, { neu: neu, snap: !!snap, strokeAuch: !!strokeAuch });

  return t('bau.kopf', { name: name, klasse: kl, liste: ergebnisse.join(' · ') })
    + hinweis
    + (strokeAuch ? t('bau.strokeAbgelegt') : '')
    + (neu ? t('bau.neuesSet') : '');
}

// --- Vorschau: baut ephemer, ändert nichts --------------------------------

async function vorschau(ziel, snap) {
  quellePruefen(ziel);
  const src = ziel.src;
  await farbeVariableAufloesen(CFG.farbe);
  normalisieren(src);
  const kl = ziel.klasse;
  const set = ADAPTER.zielSet(ziel);
  const zellen = [];

  for (const g of CFG.groessen) {
    const N = g.N;
    const b = await baueGroesse(ziel, N, snap, false);
    b.box.clipsContent = true;
    const neuSvg = await b.box.exportAsync({ format: 'SVG_STRING' });
    const pngNeu  = await b.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } });
    const pngNeu2 = await b.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
    const pngNeu8 = await b.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 8 } });
    let altSvg = null, pngAlt = null, pngAlt2 = null, pngAlt8 = null;
    if (set) {
      const v = set.children.find(c => c.name === variantenName(N));
      if (v) {
        altSvg  = await v.exportAsync({ format: 'SVG_STRING' });
        pngAlt  = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } });
        pngAlt2 = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
        pngAlt8 = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 8 } });
      }
    }
    b.box.remove();
    zellen.push({
      N: N, kontur: g.kontur, raster: g.raster, radius: g.radius,
      alt: altSvg, neu: neuSvg,
      pngNeu: pngNeu, pngNeu2: pngNeu2, pngNeu8: pngNeu8,
      pngAlt: pngAlt, pngAlt2: pngAlt2, pngAlt8: pngAlt8,
      ist: b.ist, soll: keylineVon(g, kl), gerastet: b.gerastet, guete: b.aaInfo || null
    });
  }
  return { name: ziel.name, klasse: kl, kl: kl, zellen: zellen };
}

// --- Audit -----------------------------------------------------------------

async function audit() {
  let treffer = 0, gesamt = 0, rasterAuf = 0, rasterGesamt = 0, veraltet = 0;
  const abw = [];
  const ziele = await ADAPTER.alle();
  const kleinste = CFG.groessen.length ? CFG.groessen[0].N : null;
  const farbeGebunden = CFG.farbe.modus === 'variable';

  for (const ziel of ziele) {
    const name = ziel.name;
    const src = ziel.src;
    if (!src) { abw.push(t('audit.keineSource', { name: name })); continue; }
    const kl = ziel.klasse;
    const achse = achseVon(kl);

    schiefeWinkel(src).forEach(w => abw.push(t('audit.schiefeKante', { name: name, wert: w })));

    const set = ADAPTER.zielSet(ziel);
    if (!set) { abw.push(t('audit.keinSet', { name: name })); continue; }

    const pd = set.getPluginData ? set.getPluginData(PD_SCHLUESSEL) : '';
    if (pd) {
      try {
        const d = JSON.parse(pd);
        if (d.quelle && d.quelle !== fingerabdruck(src)) {
          veraltet++; abw.push(t('audit.veraltet', { name: name }));
        }
      } catch (e) {}
    }

    for (const g of CFG.groessen) {
      const N = g.N;
      const v = set.children.find(c => c.name === variantenName(N));
      if (!v) continue;

      // Keyline
      const m = gb(v); if (!m) continue;
      const ist = massAuf(m, achse);
      const soll = keylineVon(g, kl);
      gesamt++;
      if (Math.abs(ist - soll) < 0.05) treffer++;
      else abw.push(t('audit.keyline', { name: name, klasse: kl, N: N, ist: ist.toFixed(3), soll: soll }));

      // Struktur: genau ein Vektor, keine Kontur, Farbe gebunden
      if (v.children.length !== 1) abw.push(t('audit.knoten', { name: name, N: N, n: v.children.length }));
      const kind = v.children[0];
      if (!kind) continue;
      if (kind.type !== 'VECTOR') abw.push(t('audit.typ', { name: name, N: N, typ: kind.type }));
      if ((kind.strokes || []).length) abw.push(t('audit.restkontur', { name: name, N: N }));
      if (farbeGebunden) {
        const fb = kind.fills && kind.fills[0] && kind.fills[0].boundVariables;
        if (!(fb && fb.color)) abw.push(t('audit.farbe', { name: name, N: N }));
      }
      const rr = kind.type === 'VECTOR' ? rasterRate(kind, g.raster) : null;
      if (rr) { rasterAuf += rr.auf; rasterGesamt += rr.gesamt; }
      if (N === kleinste && kind.type === 'VECTOR')
        engeLuecken(kind).forEach(l => abw.push(t('audit.luecke', { name: name, N: N, wert: l.toFixed(2) })));
    }
  }
  return { treffer: treffer, gesamt: gesamt, abw: abw, rasterAuf: rasterAuf, rasterGesamt: rasterGesamt, veraltet: veraltet };
}

// ===== 70-main.js =====
// ===========================================================================
// 70-main.js — UI zeigen, Nachrichten beantworten, Auswahl melden.
// Reihenfolge beim Start: UI sendet `init` → Konfig laden, Adapter wählen,
// dann `konfig`, `einstellungen`, `auswahl`, `fertig`.
// ===========================================================================

let aktivesZiel = null;
let bereit = false;
let auswahlHaengt = false;
let uiSprache = null;   // von der UI beim init gemeldet (navigator.language), für Sprache "auto"

figma.showUI(__html__, { width: 440, height: 700, themeColors: true });

async function initialisieren(uiSprache) {
  await konfigLaden();
  // Sprache erst jetzt bekannt — Prüfmeldungen darum ein zweites Mal erzeugen.
  spracheSetzen(CFG.sprache, uiSprache);
  const pruef = konfigValidieren(CFG);
  CFG = pruef.konfig;
  await adapterWaehlen(CFG);
  await farbeVariableAufloesen(CFG.farbe);
  bereit = true;
  return pruef;
}

function konfigSenden(pruef) {
  ui({
    type: 'konfig',
    konfig: CFG,
    fehler: pruef ? pruef.fehler : [],
    adapter: ADAPTER ? ADAPTER.name : null,
    profile: PROFIL_NAMEN
  });
}

// Auswahl auflösen und melden — das Ziel wird gecacht (wie aktiveKarte in v1).
async function auswahlMelden() {
  if (!bereit || !ADAPTER) return null;
  const sel = figma.currentPage.selection[0];
  let ziel = null;
  try { ziel = sel ? await ADAPTER.aufloesen(sel) : null; } catch (e) { ziel = null; }
  aktivesZiel = ziel;
  let hatSet = false;
  if (ziel) { try { hatSet = !!ADAPTER.zielSet(ziel); } catch (e) { hatSet = false; } }
  ui({
    type: 'auswahl',
    ziel: ziel ? {
      name: ziel.name, klasse: ziel.klasse, klasseQuelle: ziel.klasseQuelle,
      hatSet: hatSet, adapter: ADAPTER.name
    } : null
  });
  return ziel;
}

// selectionchange kann schnell feuern; Auflösung ist async → entprellen.
function auswahlAnstossen() {
  if (auswahlHaengt) return;
  auswahlHaengt = true;
  setTimeout(() => { auswahlHaengt = false; auswahlMelden(); }, 0);
}

// Aktuelles Ziel neu auflösen; null → PipelineFehler KEIN_ZIEL.
async function zielVerlangen() {
  const ziel = await auswahlMelden();
  if (!ziel) throw new PipelineFehler('KEIN_ZIEL');
  return ziel;
}

async function fokussieren(node) {
  if (!node) return;
  try {
    let seite = node;
    while (seite && seite.type !== 'PAGE') seite = seite.parent;
    if (seite && seite !== figma.currentPage) await figma.setCurrentPageAsync(seite);
    figma.viewport.scrollAndZoomIntoView([node]);
  } catch (e) {}
}

figma.ui.onmessage = async m => {
  // Messwerte kommen mitten im Bau zurück — nie durch den Try/Fertig-Block.
  if (m.type === 'messwert') { messwertEinloesen(m.id, m.werte); return; }

  try {
    if (m.type === 'init') {
      uiSprache = m.sprache || null;
      const pruef = await initialisieren(uiSprache);
      konfigSenden(pruef);
      const sch = await schalterLaden();
      ui({ type: 'einstellungen', snap: sch.snap, stroke: sch.stroke });
      await auswahlMelden();
      figma.on('selectionchange', auswahlAnstossen);
      ui({ type: 'fertig' });
      return;
    }

    if (!bereit) await initialisieren(null);

    if (m.type === 'einstellung') {
      await schalterSpeichern(m.snap, m.stroke);
      return; // kein 'fertig' — darf einen laufenden Batch nicht entsperren
    }

    if (m.type === 'fokus') {
      let node = null;
      if (m.nodeId) { try { node = await figma.getNodeByIdAsync(m.nodeId); } catch (e) { node = null; } }
      if (!node && aktivesZiel) node = aktivesZiel.fokusNode || aktivesZiel.src;
      await fokussieren(node);
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'konfigLaden') {
      const pruef = konfigValidieren(CFG);
      konfigSenden(pruef);
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'konfigSpeichern') {
      const pruef = await konfigSpeichern(m.konfig);
      spracheSetzen(CFG.sprache, m.sprache || uiSprache);
      await adapterWaehlen(CFG);
      CTX.farbVariable = null; CTX.farbSchluessel = null;
      await farbeVariableAufloesen(CFG.farbe);
      konfigSenden(pruef);
      logZeile('ok', t('log.konfigGespeichert'));
      await auswahlMelden();
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'konfigZuruecksetzen') {
      const profil = PROFIL_NAMEN.indexOf(m.profil) >= 0 ? m.profil : 'generic';
      const pruef = await konfigSpeichern(konfigDefaults(profil));
      spracheSetzen(CFG.sprache, m.sprache || uiSprache);
      await adapterWaehlen(CFG);
      CTX.farbVariable = null; CTX.farbSchluessel = null;
      await farbeVariableAufloesen(CFG.farbe);
      konfigSenden(pruef);
      logZeile('ok', t('log.konfigZurueck', { profil: profil }));
      await auswahlMelden();
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'farbenListen') {
      const fl = await farbenListen();
      ui(Object.assign({ type: 'farben' }, fl));
      const dg = fl.diagnose || {};
      if (dg.bibFehler) melden('warn', 'BIBLIOTHEK_UNZUGAENGLICH', { grund: dg.bibFehler });
      else if (!dg.kollektionen) melden('info', 'KEINE_BIBLIOTHEKEN', { lokal: fl.lokal.length });
      (dg.kollektionsFehler || []).forEach(z => logZeile('warn', z));
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'farbePruefen') {
      const r = await farbePruefen(m.farbe);
      ui({ type: 'farbeGeprueft', ok: r.ok, hex: r.hex, name: r.name });
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'klasseSetzen') {
      const ziel = await zielVerlangen();
      if (KLASSEN.indexOf(m.klasse) >= 0 && ziel.src) {
        try { ziel.src.setPluginData(KLASSE_SCHLUESSEL, m.klasse); } catch (e) {}
        logZeile('ok', t('log.klasseGesetzt', { name: ziel.name, klasse: m.klasse }), ziel.src.id);
      }
      await auswahlMelden();
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'run') {
      const ziel = await zielVerlangen();
      const text = await einIcon(ziel, !!m.snap, !!m.stroke);
      logZeile('ok', text, ziel.fokusNode ? ziel.fokusNode.id : null);
      ui({ type: 'fazit', gut: true, text: t('fazit.neuGebaut'), beiAuswahl: true });
    }

    if (m.type === 'vorschau') {
      const ziel = await zielVerlangen();
      const d = await vorschau(ziel, !!m.snap);
      ui(Object.assign({ type: 'diff', snap: !!m.snap }, d));
    }

    if (m.type === 'audit') {
      const r = await audit();
      r.abw.forEach(z => logZeile('warn', z));
      ui({
        type: 'fazit', gut: r.abw.length === 0,
        text: t('fazit.audit', {
          treffer: r.treffer, gesamt: r.gesamt, rAuf: r.rasterAuf, rGesamt: r.rasterGesamt,
          veraltet: r.veraltet ? t('fazit.veraltet', { n: r.veraltet }) : ''
        })
      });
    }

    if (m.type === 'alle') {
      const ziele = await ADAPTER.alle();
      let ok = 0;
      for (let i = 0; i < ziele.length; i++) {
        ui({ type: 'progress', i: i + 1, n: ziele.length, name: ziele[i].name });
        try {
          const text = await einIcon(ziele[i], !!m.snap, !!m.stroke);
          ok++; logZeile('ok', text, ziele[i].fokusNode ? ziele[i].fokusNode.id : null);
        } catch (e) {
          ui(fehlerLog(e));
        }
        try { figma.commitUndo(); } catch (e) {}
        await tick();
      }
      logZeile('info', t('audit.laeuft'));
      const r = await audit();
      r.abw.forEach(z => logZeile('warn', z));
      ui({
        type: 'fazit', gut: ok === ziele.length && r.abw.length === 0,
        text: t('fazit.alle', {
          ok: ok, n: ziele.length, treffer: r.treffer, gesamt: r.gesamt,
          rAuf: r.rasterAuf, rGesamt: r.rasterGesamt,
          veraltet: r.veraltet ? t('fazit.veraltet', { n: r.veraltet }) : ''
        })
      });
    }
  } catch (e) {
    ui(fehlerLog(e));
    ui({ type: 'fazit', gut: false, text: t('fazit.abgebrochen', { grund: (e && e.message) || String(e) }) });
  }
  ui({ type: 'fertig' });
};
