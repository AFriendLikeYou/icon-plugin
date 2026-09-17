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
