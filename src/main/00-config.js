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
