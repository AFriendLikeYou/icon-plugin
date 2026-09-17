// ZDS Icon Pipeline — Direktbau + optionales Pixel-Snapping + Diff-Vorschau (Onionskin).
// Source → Kontur je Größe → Bisektions-Fit auf die Keyline → union→flatten
// → Inhalt der bestehenden Library-Variante tauschen (Instanzen bleiben verbunden).

const STROKE = { 14: 1.5, 18: 1.5, 24: 2 };
const KEY = {
  Square:   { 14: 12, 18: 14, 24: 18 },
  Circular: { 14: 13, 18: 15, 24: 19 },
  Wide:     { 14: 14, 18: 16, 24: 20 },
  Tall:     { 14: 14, 18: 16, 24: 20 },
};
const ZEICHEN_KEYLINE = { Square: 56, Circular: 60, Wide: 64, Tall: 64 };
const GROESSEN = [14, 18, 24];
const FARB_KEY = 'c03b6366f45ff8c719530cff7a2150965e4200fd'; // Colors → Text/70

let ctx = null;

async function kontext() {
  await figma.loadAllPagesAsync();
  const IC = figma.root.children.find(p => p.name === 'Icons');
  const SRC = figma.root.children.find(p => p.name === 'Source');
  if (!IC || !SRC) throw new Error('Seiten „Icons"/„Source" nicht gefunden — falsches File?');
  await IC.loadAsync(); await SRC.loadAsync();
  const K = SRC.children.find(c => c.name === 'ZDS Icons · Karten');
  const TB = SRC.children.find(c => /^Tab-Bar · zurückgestellt/.test(c.name));
  let T70 = null; try { T70 = await figma.variables.importVariableByKeyAsync(FARB_KEY); } catch (e) {}
  const STATUS = SRC.findAll(n => n.type === 'COMPONENT_SET' && n.name === '.Icon status')[0] || null;
  return { IC, SRC, K, TB, T70, STATUS };
}

function gb(node) {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9, n = 0;
  node.findAll(x => ['VECTOR','BOOLEAN_OPERATION','ELLIPSE','RECTANGLE','LINE','POLYGON','STAR'].includes(x.type))
    .forEach(x => { const r = x.absoluteRenderBounds; if (!r) return; n++;
      a = Math.min(a, r.x); b = Math.min(b, r.y);
      c = Math.max(c, r.x + r.width); d = Math.max(d, r.y + r.height); });
  return n ? { w: c - a, h: d - b } : null;
}

// ---------- Auflösen ----------

function karteZu(node) {
  let n = node;
  while (n && n.type !== 'PAGE') { if (/^Karte · /.test(n.name)) return n; n = n.parent; }
  return null;
}
function iconName(karte) {
  return karte.name.replace(/^Karte · /, '').replace(/ \(verschlankt\)$/, '');
}
async function sourceZu(karte) {
  const z1 = karte.children.find(c => c.name === '01 · source');
  if (!z1) return null;
  const comp = z1.children.find(c => c.type === 'COMPONENT');
  if (comp) return comp;
  const inst = z1.children.find(c => c.type === 'INSTANCE' && c.name !== 'grid');
  if (inst) return await inst.getMainComponentAsync();
  return null;
}
async function klasseZu(karte, src) {
  const z1 = karte.children.find(c => c.name === '01 · source');
  const g = z1 && z1.children.find(c => c.name === 'grid');
  if (g && g.type === 'INSTANCE') {
    const mc = await g.getMainComponentAsync();
    if (mc) { const k = mc.name.replace('GuideType=', ''); if (KEY[k]) return k; if (k === 'Keylines') return 'Square'; }
  }
  const m = gb(src); const r = m.w / m.h;
  return r >= 1.2 ? 'Wide' : (r <= 0.833 ? 'Tall' : 'Square');
}
function librarySet(name) {
  const s = ctx.IC.findAll(n => n.type === 'COMPONENT_SET' && n.name === name)[0];
  if (s) return s;
  return ctx.TB ? ctx.TB.findAll(n => n.type === 'COMPONENT_SET' && n.name === '.' + name)[0] : null;
}

// Ablage für ungeplättete, optimierte Fassungen — Punkt-Präfix, wird nie publiziert.
function strokeHeim() {
  let h = ctx.SRC.children.find(c => c.name === 'ZDS Icons · Stroke-Fassungen (optimiert)');
  if (h) return h;
  h = figma.createFrame(); ctx.SRC.appendChild(h);
  h.name = 'ZDS Icons · Stroke-Fassungen (optimiert)';
  const alt = ctx.SRC.children.find(c => /Arbeitsdateien \(versteckt\)/.test(c.name));
  h.x = alt ? alt.x : 100; h.y = alt ? alt.y + alt.height + 80 : 100;
  h.resize(1250, 240);
  h.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  return h;
}

// ---------- Bausteine ----------

function normalisieren(src, T70) {
  src.findAll(x => true).forEach(x => { try { if (x.constraints) x.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; } catch (e) {} });
  src.findAll(x => x.strokes && x.strokes.length).forEach(x => {
    try { x.strokeWeight = 6; }
    catch (e) { ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight'].forEach(p => { try { x[p] = 6; } catch (e2) {} }); }
    if (T70) x.strokes = x.strokes.map(p => p.type === 'SOLID' ? figma.variables.setBoundVariableForPaint(p, 'color', T70) : p);
  });
  if (T70) src.findAll(x => x.fills && Array.isArray(x.fills) && x.fills.length).forEach(x => {
    x.fills = x.fills.map(p => p.type === 'SOLID' ? figma.variables.setBoundVariableForPaint(p, 'color', T70) : p);
  });
}

function konturSetzen(inst, w) {
  inst.findAll(x => x.strokes && x.strokes.length).forEach(x => {
    try { x.setBoundVariable('strokeWeight', null); } catch (e) {}
    try { x.strokeWeight = w; }
    catch (e) { ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight'].forEach(p => { try { x[p] = w; } catch (e2) {} }); }
  });
}

// Radien proportional zur Slotgröße skalieren — NACH dem Detach, wo alles editierbar ist.
// Deckt alle drei Arten ab: uniformer cornerRadius, Per-Ecke-Radien (mixed) und
// Vertex-Radien im Vektornetz (in Instanzen unveränderbar, hier nicht mehr).
// Radien verändern die Außenmaße nicht (Tangentenpunkte) — der Keyline-Fit bleibt gültig.
async function radienSkalieren(root, f) {
  if (Math.abs(f - 1) < 1e-9) return;
  const knoten = [root, ...root.findAll(x => true)];
  for (const x of knoten) {
    let uniform = false;
    try { if (typeof x.cornerRadius === 'number' && x.cornerRadius > 0) {
      x.cornerRadius = x.cornerRadius * f; uniform = true; } } catch (e) {}
    if (!uniform) {
      ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'].forEach(pp => {
        try { if (typeof x[pp] === 'number' && x[pp] > 0) x[pp] = x[pp] * f; } catch (e) {}
      });
      try {
        if (x.type === 'VECTOR' && x.vectorNetwork &&
            x.vectorNetwork.vertices.some(v => (v.cornerRadius || 0) > 0)) {
          const netz = x.vectorNetwork;
          const V = netz.vertices.map(v => { const n = Object.assign({}, v);
            if ((n.cornerRadius || 0) > 0) n.cornerRadius = n.cornerRadius * f; return n; });
          await x.setVectorNetworkAsync({ vertices: V, segments: netz.segments, regions: netz.regions });
        }
      } catch (e) {}
    }
  }
}

function fitten(box, inst, src, N, soll, achse) {
  const setz = S => { inst.resize(S, S); inst.x = (N - S) / 2; inst.y = (N - S) / 2; };
  const miss = () => { const m = gb(box); if (!m) return null;
    return achse === 'w' ? m.w : (achse === 'h' ? m.h : Math.max(m.w, m.h)); };
  let lo = N * 0.4, hi = N * 2.6, ist = null;
  for (let i = 0; i < 42; i++) {
    const S = (lo + hi) / 2; setz(S); ist = miss();
    if (ist == null) return null;
    if (Math.abs(ist - soll) < 0.002) break;
    if (ist < soll) lo = S; else hi = S;
  }
  return ist;
}

function staffeln(cs) {
  const ord = { 'Size=14': 0, 'Size=18': 1, 'Size=24': 2 };
  const kinder = cs.children.slice().sort((a, b) => (ord[a.name] ?? 9) - (ord[b.name] ?? 9));
  let x = 12; kinder.forEach(c => { c.x = x; x += c.width + 20; });
  cs.resizeWithoutConstraints(120, 56);
  kinder.forEach(c => { c.y = Math.round((56 - c.height) / 2); });
  // Size=18 als erste Variante in der Ebenenreihenfolge = Default beim Einfügen
  const v18 = cs.children.find(c => c.name === 'Size=18');
  if (v18 && cs.children[0] !== v18) cs.insertChild(0, v18);
}

// Pixel-Snapping v2 („Stem-Hinting"):
// – erkennt gerade, (nahezu) achsparallele Kanten inkl. Mikro-Neigung bis 0,08 px und BEGRADIGT sie
// – Kantenpaare im Konturabstand (1,5 / 2,0) rasten STARR als Paar → Strichgewicht bleibt bit-genau
// – Einzelkanten aufs 0,5-Raster, bei 24 bevorzugt ganze Pixel; Kurven/Diagonalen unangetastet
const SNAP = { NEIGUNG: 0.08, LUECKE: 0.15, SPANNE: 0.3, MAXWEG: 0.3 };

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

// (pixelSnap entfernt — Snapping läuft seit dem Kantenidentitäts-Umbau
//  ausschließlich VOR dem Flatten in strokeSnap.)
// Schärfe-Metrik fürs Audit: wie viele gerade Kanten liegen auf dem 0,5-Raster?
function rasterRate(flat) {
  if (!flat.vectorNetwork) return null;
  const netz = flat.vectorNetwork;
  const V = netz.vertices.map(v => Object.assign({}, v));
  const off = { x: flat.x, y: flat.y };
  let auf = 0, gesamt = 0;
  for (const achse of ['x', 'y']) {
    geradeKanten(netz, V, achse).forEach(c => {
      gesamt++;
      const w = c.wert + off[achse];
      if (Math.abs(w - Math.round(w * 2) / 2) < 0.01) auf++;
    });
  }
  return { auf, gesamt };
}

// Geometrie-Fingerabdruck der Source — Grundlage der Veraltet-Erkennung im Audit.
function fingerabdruck(src) {
  let h = 5381;
  const add = t => { for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; };
  src.findAll(x => true).forEach(x => {
    add(x.type + '|' + x.name + '|' + [x.x, x.y, x.width, x.height].map(v => Math.round(v * 100) / 100).join(','));
    if (typeof x.strokeWeight === 'number') add('s' + Math.round(x.strokeWeight * 100) / 100);
    if (typeof x.cornerRadius === 'number') add('r' + Math.round(x.cornerRadius * 100) / 100);
    try { if (x.vectorPaths) add('p' + x.vectorPaths.map(q => q.data.length).join('.')); } catch (e) {}
  });
  return String(h);
}

// Nach jedem erfolgreichen Build: Export-Settings, Suchbegriffe → Beschreibung,
// Fingerabdruck fürs Audit, Status-Chip der Karte auf „published".
function nachpflege(karte, name, set, snap, src, vorherFehler, neuFehler) {
  set.children.forEach(v => { try { v.exportSettings = [{ format: 'SVG' }]; } catch (e) {} });
  const mk = karte.children.find(c => c.name === 'meta · keywords');
  const kw = mk && mk.children[1] ? mk.children[1].characters : null;
  if (kw && !/\{keywords/.test(kw))
    set.description = 'Icon ' + name + ' in 14, 18 und 24 px. Größe über die Property Size. Geflattet — ein Pfad, keine Kontur.\n\nSuchbegriffe: ' + kw;
  try { set.setPluginData('zds', JSON.stringify({ quelle: fingerabdruck(src), snap: !!snap, zeit: Date.now(),
    fehler: Object.assign({}, vorherFehler, neuFehler) })); } catch (e) {}
  if (ctx.STATUS) {
    const chip = karte.children.find(c => c.name === 'status' && c.type === 'INSTANCE');
    const pub = ctx.STATUS.children.find(c => c.name === 'status=published');
    if (chip && pub) { try { chip.swapComponent(pub); } catch (e) {} }
  }
}

function previewFuellen(karte, name, set) {
  const z2 = karte.children.find(c => c.name === '02 · library auf dem Grid');
  if (!z2) return;
  for (const N of GROESSEN) {
    const grid = z2.children.find(c => c.name === 'grid' && Math.round(c.width) === N);
    if (!grid) continue;
    const da = z2.children.find(c => c.type === 'INSTANCE' && c.name !== 'grid' && Math.round(c.width) === N);
    if (da) continue;
    const v = set.children.find(c => c.name === 'Size=' + N); if (!v) continue;
    const i = v.createInstance(); z2.appendChild(i); i.name = name; i.x = grid.x; i.y = grid.y;
  }
}


// Stroke-Snapping: rastet die LEBENDIGE Geometrie vor dem Flatten —
// Mittellinien von Konturen mit gewichtsabhängigem Versatz (1,5 → x,25/x,75 · 2 → ganz/halb),
// Kanten füllungsbasierter Formen direkt aufs 0,5-Raster. Stroke-Fassung und geflattete
// Library entstehen danach aus derselben Geometrie und sind kantenidentisch.
// Behandelt VECTOR (auch 90°-rotiert), RECTANGLE und LINE, rekursiv durch Booleans.
async function strokeSnap(box, N) {
  const bT = box.absoluteTransform, b02 = bT[0][2], b12 = bT[1][2];
  function num(w) { return typeof w === 'number' ? w : 0; }
  function gewichtVon(x) {
    if ((x.strokes || []).length === 0) return 0;
    return num(x.strokeWeight) || num(x.strokeTopWeight) || num(x.strokeLeftWeight) || 0;
  }
  function snapWert(wert, phase) {
    const halb = Math.round((wert - phase) * 2) / 2 + phase;
    if (N === 24) { const ganz = Math.round(wert - phase) + phase;
      if (Math.abs(ganz - wert) <= 0.35) return ganz; }
    return halb;
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
      const phase = w ? (w / 2) % 0.5 : 0;
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
      const phase = w ? (w / 2) % 0.5 : 0;
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
      const phase = (w / 2) % 0.5;
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
      // Einzelrundung (v. a. die Ganzzahl-Präferenz der 24er) macht aus
      // 5,33/5,33/5,33 sonst 5/6/5 — die Reihe kippt. Regel: rasterbarer
      // Abstand → Reihe STARR verschieben (zentrumserhaltend, wenn sie um
      // N/2 symmetrisch liegt), sonst Reihe komplett pinnen.
      let i0 = 0;
      while (i0 < cluster.length - 2) {
        const g = cluster[i0 + 1].mittel - cluster[i0].mittel;
        let ende = i0 + 1;
        while (ende + 1 < cluster.length &&
               Math.abs((cluster[ende + 1].mittel - cluster[ende].mittel) - g) <= 0.06) ende++;
        const n2 = ende - i0 + 1;
        if (n2 >= 3) {
          const idx = []; for (let k = i0; k <= ende; k++) idx.push(k);
          const gelenkig = idx.some(k => cluster[k].gruppe.some(e => e.gelenk));
          const gapZiel = Math.round(g * 2) / 2;
          const rasterbar = Math.abs(gapZiel - g) <= 0.02;
          let basis = null;
          if (!gelenkig && rasterbar) {
            const reiheMitte = (cluster[i0].mittel + cluster[ende].mittel) / 2;
            if (Math.abs(reiheMitte - N / 2) <= 0.05) {
              const f = N / 2 - (n2 - 1) * gapZiel / 2;              // zentrumserhaltend
              const fSnap = snapWert(f, cluster[i0].gruppe[0].phase);
              if (Math.abs(fSnap - f) <= 0.01) basis = f;
            } else {
              basis = snapWert(cluster[i0].mittel, cluster[i0].gruppe[0].phase);
            }
          }
          const passt = basis != null &&
            idx.every((k, q) => Math.abs(basis + q * gapZiel - cluster[k].mittel) <= SNAP.MAXWEG);
          idx.forEach((k, q) => { ziel[k] = passt ? basis + q * gapZiel : null; });
        }
        i0 = n2 >= 3 ? ende + 1 : i0 + 1;
      }

      // FILL-STEM-PAARE: Flächen-Balken (audio-bars, pause …) haben zwei
      // Füllkanten (Phase 0) in beliebigem Abstand. Einzeln gerundet werden
      // gleiche Balken ungleich (v. a. 24er-Ganzzahl-Präferenz) — deshalb:
      // benachbarte Kanten als Paar, Breite mitrunden, starr setzen.
      for (let i = 0; i + 1 < cluster.length; i++) {
        if (ziel[i] !== undefined || ziel[i + 1] !== undefined) continue;
        const cA = cluster[i], cB = cluster[i + 1];
        if (cA.gruppe[0].phase !== 0 || cB.gruppe[0].phase !== 0) continue;
        if (cA.gruppe.some(e => e.gelenk) || cB.gruppe.some(e => e.gelenk)) continue;
        const d = cB.mittel - cA.mittel;
        if (d < 0.8 || d > 4.5) continue;
        const dz = (N === 24 && Math.abs(Math.round(d) - d) <= 0.35)
          ? Math.round(d) : Math.round(d * 2) / 2;
        if (dz < 0.5 || Math.abs(dz - d) > 0.3) continue;
        const paarMitte = (cA.mittel + cB.mittel) / 2;
        let basis;
        if (Math.abs(paarMitte - N / 2) <= 0.05) {
          basis = N / 2 - dz / 2;                                   // zentrumserhaltend
          if (Math.abs(basis - Math.round(basis * 2) / 2) > 0.01) { ziel[i] = null; ziel[i + 1] = null; continue; }
        } else {
          basis = snapWert(cA.mittel, 0);
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
        const z = snapWert(c.mittel, c.gruppe[0].phase);
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
    const links = j.links != null ? node.x + (j.links - 0) : null; // Ziel in Box == Delta über Differenz
    // Deltas aus Box-Zielen: wir haben Box-Zielwerte, Ausgangswerte stecken im Eintrag — daher über parent-gleiche Deltas:
    // parent-Ketten sind unrotiert → Box-Delta == lokales Delta.
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

// Eine Größe bauen — ephemer. Bei aktivem Snapping entscheidet das AA-Orakel:
// beide Kandidaten (mit/ohne Snap) werden echt gerastert, der schärfere gewinnt.
async function baueGroesse(src, kl, N, snap, strokeAuch) {
  const achse = kl === 'Wide' ? 'w' : (kl === 'Tall' ? 'h' : 'max');

  async function bauKandidat(mitSnap) {
    const box = figma.createFrame(); ctx.IC.appendChild(box);
    box.name = '__fit'; box.x = -4000; box.y = -4000;
    box.resize(N, N); box.fills = []; box.clipsContent = false;
    const inst = src.createInstance(); box.appendChild(inst);
    konturSetzen(inst, STROKE[N]);
    const ist = fitten(box, inst, src, N, KEY[kl][N], achse);
    const fSkal = inst.width / 72;
    const det = inst.detachInstance();
    let g = 0; while (g++ < 12) {
      const a = det.findAll(n => n.type === 'INSTANCE' && !n.removed); if (!a.length) break;
      let ch = false; a.forEach(n => { try { if (!n.removed) { n.detachInstance(); ch = true; } } catch (e) {} });
      if (!ch) break;
    }
    await radienSkalieren(det, fSkal);
    let gerastet = 0, geschuetzt = 0;
    if (mitSnap) { const r = await strokeSnap(box, N); gerastet = r.bewegt; geschuetzt = r.geschuetzt; }
    let strokeComp = null;
    if (strokeAuch) {
      strokeComp = figma.createComponent(); ctx.IC.appendChild(strokeComp);
      strokeComp.name = 'Size=' + N; strokeComp.resize(N, N);
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
    catch (e) { flat = figma.flatten(det.children.slice(), det); }
    flat.name = 'Stroke'; flat.strokes = [];
    const paint = { type: 'SOLID', color: { r: .267, g: .267, b: .267 } };
    flat.fills = [ctx.T70 ? figma.variables.setBoundVariableForPaint(paint, 'color', ctx.T70) : paint];
    const fAbs = flat.absoluteBoundingBox, bAbs = box.absoluteBoundingBox;
    const fx = fAbs.x - bAbs.x, fy = fAbs.y - bAbs.y;
    box.appendChild(flat); flat.x = fx; flat.y = fy;
    det.remove();
    return { box, flat, ist, gerastet, geschuetzt, strokeComp };
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
    const [wa, wb] = werte;
    if (wb.fehler < wa.fehler - 1e-6 ||
        (Math.abs(wb.fehler - wa.fehler) <= 1e-6 && wb.aa < wa.aa)) { sieger = B; verlierer = A; }
  }
  if (verlierer.strokeComp) { try { verlierer.strokeComp.remove(); } catch (e) {} }
  verlierer.box.remove();
  if (werte && werte.length === 2) sieger.aaInfo = { snap: werte[0], plain: werte[1], mitSnap: sieger === A };
  return sieger;
}

// ---------- Kommandos ----------

async function einIcon(karte, snap, strokeAuch) {
  const name = iconName(karte);
  const src = await sourceZu(karte);
  if (!src) throw new Error(name + ': keine 72er-Source in Zelle 01 gefunden.');
  normalisieren(src, ctx.T70);
  const kl = await klasseZu(karte, src);
  const achse = kl === 'Wide' ? 'w' : (kl === 'Tall' ? 'h' : 'max');
  const m72 = gb(src);
  const ist72 = achse === 'w' ? m72.w : (achse === 'h' ? m72.h : Math.max(m72.w, m72.h));
  const hinweis = Math.abs(ist72 - ZEICHEN_KEYLINE[kl]) > 0.15
    ? ' — Source misst ' + ist72.toFixed(2) + ' statt ' + ZEICHEN_KEYLINE[kl] : '';
  let set = librarySet(name);
  const neu = !set;
  let vorher = {};
  try { const pd = set ? JSON.parse(set.getPluginData('zds') || '{}') : {};
    vorher = pd.fehler || {}; } catch (e) {}
  const fehlerNeu = {};
  const frisch = [], ergebnisse = [], strokeComps = [];
  for (const N of GROESSEN) {
    const b = await baueGroesse(src, kl, N, snap, strokeAuch);
    if (b.aaInfo) fehlerNeu[N] = (b.aaInfo.mitSnap ? b.aaInfo.snap : b.aaInfo.plain).fehler;
    if (b.strokeComp) strokeComps.push(b.strokeComp);
    ergebnisse.push(N + ': ' + (b.ist == null ? '???' : b.ist.toFixed(3)) + '/' + KEY[kl][N]
      + (snap && b.gerastet ? ' (' + b.gerastet + ' Kanten gerastet)' : '')
      + (snap && b.geschuetzt ? ' · ' + b.geschuetzt + ' Knoten formgeschützt' : '')
      + (b.aaInfo ? (() => {
          const w = b.aaInfo.mitSnap ? b.aaInfo.snap : b.aaInfo.plain;
          const g = b.aaInfo.mitSnap ? b.aaInfo.plain : b.aaInfo.snap;
          const delta = g.fehler > 1e-9 ? Math.round((1 - w.fehler / g.fehler) * 100) : 0;
          const vor = vorher[N];
          const trend = vor == null ? ''
            : ' · zuvor ' + vor.toFixed(3) + (w.fehler < vor - 0.0005 ? ' ↓' : (w.fehler > vor + 0.0005 ? ' ↑' : ' ='));
          return ' · AA ' + w.aa + '% · Fehler ' + w.fehler.toFixed(3)
            + ' vs ' + g.fehler.toFixed(3) + trend
            + (b.aaInfo.mitSnap
                ? (delta > 0 ? ' → Hinting −' + delta + '%' : ' → gleichwertig')
                : ' — Snapping ohne Wirkung, Fit-Geometrie behalten');
        })() : ''));
    const fx = b.flat.x, fy = b.flat.y;
    if (set) {
      const v = set.children.find(c => c.name === 'Size=' + N);
      if (!v) throw new Error(name + ': Variante Size=' + N + ' fehlt im Library-Set.');
      v.children.slice().forEach(c => c.remove());
      v.appendChild(b.flat); b.flat.x = fx; b.flat.y = fy;
    } else {
      const comp = figma.createComponent(); ctx.IC.appendChild(comp);
      comp.name = 'Size=' + N; comp.resize(N, N); comp.fills = []; comp.clipsContent = true;
      comp.appendChild(b.flat); b.flat.x = fx; b.flat.y = fy;
      frisch.push(comp);
    }
    b.box.remove();
  }
  if (!neu) {
    const v18 = set.children.find(c => c.name === 'Size=18');
    if (v18 && set.children[0] !== v18) set.insertChild(0, v18); // 18 = Default
  }
  if (neu) {
    set = figma.combineAsVariants(frisch, ctx.IC);
    set.name = name; staffeln(set);
    set.description = 'Icon ' + name + ' in 14, 18 und 24 px. Größe über die Property Size. Geflattet — ein Pfad, keine Kontur.';
    set.x = 80; set.y = 120;
  }
  if (strokeAuch && strokeComps.length === GROESSEN.length) {
    const heim = strokeHeim();
    // Erst auf die Source-Seite umziehen — combineAsVariants verlangt gleiche Seite wie der Parent.
    strokeComps.forEach(q => heim.appendChild(q));
    const sName = '.' + name + ' · stroke';
    let sSet = heim.children.find(c => c.type === 'COMPONENT_SET' && c.name === sName);
    if (sSet) {
      // Inhalt tauschen — vorhandene Instanzen der Stroke-Fassung bleiben verbunden
      for (let i = 0; i < GROESSEN.length; i++) {
        const v = sSet.children.find(c => c.name === 'Size=' + GROESSEN[i]);
        const q = strokeComps[i];
        if (v && q) {
          v.children.slice().forEach(c => c.remove());
          q.children.slice().forEach(c => { const cx = c.x, cy = c.y; v.appendChild(c); c.x = cx; c.y = cy; });
          q.remove();
        }
      }
    } else {
      const n = heim.children.filter(c => c.type === 'COMPONENT_SET').length;
      sSet = figma.combineAsVariants(strokeComps, heim);
      sSet.name = sName; staffeln(sSet);
      sSet.x = 40 + (n % 8) * 150; sSet.y = 50 + Math.floor(n / 8) * 90;
      if (sSet.x + 190 > heim.width || sSet.y + 140 > heim.height)
        heim.resizeWithoutConstraints(Math.max(heim.width, sSet.x + 190), Math.max(heim.height, sSet.y + 140));
    }
  }
  previewFuellen(karte, name, set);
  nachpflege(karte, name, set, snap, src, vorher, fehlerNeu);
  return name + ' (' + kl + ') → ' + ergebnisse.join(' · ') + hinweis
    + (strokeAuch ? ' · Stroke-Fassung abgelegt' : '')
    + (neu ? ' — NEUES Set, bitte einsortieren + Suchbegriffe in die Beschreibung' : '');
}

// Diff-Vorschau: baut die Kandidaten nur ephemer, exportiert Alt + Neu als SVG, ändert NICHTS.
async function vorschau(karte, snap) {
  const name = iconName(karte);
  const src = await sourceZu(karte);
  if (!src) throw new Error(name + ': keine 72er-Source gefunden.');
  normalisieren(src, ctx.T70);
  const kl = await klasseZu(karte, src);
  const set = librarySet(name);
  const zellen = [];
  for (const N of GROESSEN) {
    const b = await baueGroesse(src, kl, N, snap);
    b.box.clipsContent = true;
    const neuSvg = await b.box.exportAsync({ format: 'SVG_STRING' });
    const pngNeu = await b.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } });
    const pngNeu2 = await b.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
    let altSvg = null, pngAlt = null, pngAlt2 = null;
    if (set) { const v = set.children.find(c => c.name === 'Size=' + N);
      if (v) { altSvg = await v.exportAsync({ format: 'SVG_STRING' });
        pngAlt = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } });
        pngAlt2 = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } }); } }
    b.box.remove();
    zellen.push({ N, alt: altSvg, neu: neuSvg, pngNeu, pngNeu2, pngAlt, pngAlt2,
      ist: b.ist, soll: KEY[kl][N], gerastet: b.gerastet, guete: b.aaInfo || null });
  }
  return { name, kl, zellen };
}

async function audit() {
  let treffer = 0, gesamt = 0, rasterAuf = 0, rasterGesamt = 0, veraltet = 0;
  const abw = [];
  const karten = [];
  [ctx.K, ctx.TB].filter(Boolean).forEach(s2 => s2.children.filter(c => /^Karte · /.test(c.name)).forEach(c => karten.push(c)));
  for (const karte of karten) {
    const name = iconName(karte);
    const src = await sourceZu(karte); if (!src) { abw.push(name + ': keine Source'); continue; }
    const kl = await klasseZu(karte, src);
    const achse = kl === 'Wide' ? 'w' : (kl === 'Tall' ? 'h' : 'max');
    schiefeWinkel(src).forEach(w2 => abw.push(name + ': schiefe Kante ' + w2 + ' — in der Source begradigen'));
    const set = librarySet(name);
    if (!set) { abw.push(name + ': kein Library-Set'); continue; }
    const pd = set.getPluginData ? set.getPluginData('zds') : '';
    if (pd) { try { const d = JSON.parse(pd);
      if (d.quelle && d.quelle !== fingerabdruck(src)) { veraltet++;
        abw.push(name + ': Source geändert seit letztem Build — neu durchziehen'); } } catch (e) {} }
    for (const N of GROESSEN) {
      const v = set.children.find(c => c.name === 'Size=' + N); if (!v) continue;
      // Keyline
      const m = gb(v); if (!m) continue;
      const ist = achse === 'w' ? m.w : (achse === 'h' ? m.h : Math.max(m.w, m.h));
      gesamt++;
      if (Math.abs(ist - KEY[kl][N]) < 0.05) treffer++;
      else abw.push(name + ' ' + kl + '/' + N + ': ' + ist.toFixed(3) + ' statt ' + KEY[kl][N]);
      // Struktur: genau ein Vektor, keine Kontur, Farbe gebunden
      if (v.children.length !== 1) abw.push(name + '/' + N + ': ' + v.children.length + ' Knoten statt 1');
      const kind = v.children[0];
      if (kind) {
        if (kind.type !== 'VECTOR') abw.push(name + '/' + N + ': ' + kind.type + ' statt VECTOR');
        if ((kind.strokes || []).length) abw.push(name + '/' + N + ': Restkontur vorhanden');
        const fb = kind.fills && kind.fills[0] && kind.fills[0].boundVariables;
        if (!(fb && fb.color)) abw.push(name + '/' + N + ': Farbe nicht an Text/70 gebunden');
        const rr = kind.type === 'VECTOR' ? rasterRate(kind) : null;
        if (rr) { rasterAuf += rr.auf; rasterGesamt += rr.gesamt; }
        if (N === 14 && kind.type === 'VECTOR')
          engeLuecken(kind).forEach(g2 => abw.push(name + '/14: Zwischenraum ' + g2.toFixed(2) + ' px — verschlammt bei 1×'));
      }
    }
  }
  return { treffer, gesamt, abw, rasterAuf, rasterGesamt, veraltet };
}

// ---------- UI ----------

const tick = () => new Promise(r => setTimeout(r, 0));
const ui = m => figma.ui.postMessage(m);
const messWarte = new Map(); let messZaehler = 0;
// Güte-Messung in der UI: je Kandidat 1×-Rasterung + 8×-Referenz.
// „fehler" = RMS-Abweichung der echten 1×-Rasterung von der idealen
// (8× flächengemittelt) — misst Treue, nicht nur Weichheit.
function messeGuete(paare) {
  return new Promise(res => {
    const id = ++messZaehler;
    const t = setTimeout(() => { if (messWarte.has(id)) { messWarte.delete(id); res(null); } }, 6000);
    messWarte.set(id, werte => { clearTimeout(t); res(werte); });
    ui({ type: 'mess', id, paare });
  });
}

let aktiveKarte = null;
function auswahlMelden() {
  const sel = figma.currentPage.selection[0];
  let karte = sel ? karteZu(sel) : null;
  if (!karte && sel) {
    let n = sel; while (n && n.type !== 'PAGE' && n.type !== 'COMPONENT_SET') n = n.parent;
    if (n && n.type === 'COMPONENT_SET' && ctx && ctx.K)
      karte = ctx.K.children.find(c => c.name === 'Karte · ' + n.name) || null;
  }
  aktiveKarte = karte;
  ui({ type: 'auswahl', karte: karte ? karte.name : null });
  return karte;
}

figma.showUI(__html__, { width: 440, height: 700, themeColors: true });

figma.ui.onmessage = async m => {
  if (m.type === 'messwert') {
    const r = messWarte.get(m.id);
    if (r) { messWarte.delete(m.id); r(m.werte); }
    return;
  }
  try {
    if (!ctx) ctx = await kontext();
    if (m.type === 'init') {
      auswahlMelden(); figma.on('selectionchange', auswahlMelden);
      try { const e = await figma.clientStorage.getAsync('zds-einstellungen');
        if (e) ui({ type: 'einstellungen', snap: !!e.snap, stroke: !!e.stroke }); } catch (err) {}
      ui({ type: 'fertig' }); return;
    }
    if (m.type === 'einstellung') {
      try { await figma.clientStorage.setAsync('zds-einstellungen', { snap: !!m.snap, stroke: !!m.stroke }); } catch (err) {}
      return; // kein 'fertig' — darf einen laufenden Batch nicht entsperren
    }
    if (m.type === 'fokus') {
      if (aktiveKarte) { try {
        let seite = aktiveKarte;
        while (seite && seite.type !== 'PAGE') seite = seite.parent;
        if (seite) await figma.setCurrentPageAsync(seite);
        figma.viewport.scrollAndZoomIntoView([aktiveKarte]);
      } catch (e) {} }
      ui({ type: 'fertig' }); return;
    }
    if (m.type === 'run') {
      const karte = auswahlMelden();
      if (!karte) { ui({ type: 'log', text: 'Keine Karte ausgewählt.', art: 'warn' }); ui({ type: 'fertig' }); return; }
      const b = await einIcon(karte, !!m.snap, !!m.stroke);
      ui({ type: 'log', text: b, art: 'ok' });
      ui({ type: 'fazit', gut: true, text: 'neu gebaut', beiAuswahl: true });
    }
    if (m.type === 'vorschau') {
      const karte = auswahlMelden();
      if (!karte) { ui({ type: 'log', text: 'Keine Karte ausgewählt.', art: 'warn' }); ui({ type: 'fertig' }); return; }
      const d = await vorschau(karte, !!m.snap);
      ui({ type: 'diff', ...d, snap: !!m.snap });
    }
    if (m.type === 'audit') {
      const r = await audit();
      r.abw.forEach(z => ui({ type: 'log', text: z, art: 'warn' }));
      ui({ type: 'fazit', gut: r.abw.length === 0, text: 'Audit: ' + r.treffer + '/' + r.gesamt + ' auf der Keyline · gerade Kanten auf 0,5-Raster: ' + r.rasterAuf + '/' + r.rasterGesamt + (r.veraltet ? ' · VERALTET: ' + r.veraltet : '') });
    }
    if (m.type === 'alle') {
      const karten = [];
      [ctx.K, ctx.TB].filter(Boolean).forEach(s => s.children.filter(c => /^Karte · /.test(c.name)).forEach(c => karten.push(c)));
      let ok = 0;
      for (let i = 0; i < karten.length; i++) {
        ui({ type: 'progress', i: i + 1, n: karten.length, name: iconName(karten[i]) });
        try { const b = await einIcon(karten[i], !!m.snap, !!m.stroke); ok++; ui({ type: 'log', text: b, art: 'ok' }); }
        catch (e) { ui({ type: 'log', text: karten[i].name + ': ' + e.message, art: 'err' }); }
        try { figma.commitUndo(); } catch (e) {}
        await tick();
      }
      ui({ type: 'log', text: 'Audit läuft …' });
      const r = await audit();
      r.abw.forEach(z => ui({ type: 'log', text: z, art: 'warn' }));
      ui({ type: 'fazit', gut: ok === karten.length && r.abw.length === 0,
        text: ok + '/' + karten.length + ' gebaut · Keyline ' + r.treffer + '/' + r.gesamt
          + ' · Raster ' + r.rasterAuf + '/' + r.rasterGesamt
          + (r.veraltet ? ' · VERALTET ' + r.veraltet : '') });
    }
  } catch (e) {
    ui({ type: 'log', text: 'Fehler: ' + e.message, art: 'err' });
    ui({ type: 'fazit', gut: false, text: 'Abgebrochen: ' + e.message });
  }
  ui({ type: 'fertig' });
};
