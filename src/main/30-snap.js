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
