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
