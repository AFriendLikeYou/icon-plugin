  // =========================================================================
  // Vorschau (§33, Runde 6 §39.1–39.7)
  // -------------------------------------------------------------------------
  // Die Bühne ist ein echter Viewport wie Figmas Canvas: EIN <canvas> in
  // Bühnengröße × devicePixelRatio, eigene Kamera {x, y, z}, alles wird je
  // Frame gezeichnet. Weltkoordinaten = Icon-Pixel; z = Gerätepixel je
  // Icon-Pixel.
  //
  // Zwei Modi: „Vorher/Nachher“ (Wischtrenner) und „Überlagern“. Die
  // Vergleichsbasis ist bei aktivem Snapping die ungesnappte Fassung
  // (`zellen[].ohne`), sonst der Library-Stand (`zellen[].alt`).
  //
  // Die Vektordarstellung rastert das SVG je Zoomstufe (2^k, bis 64) neu und
  // zeichnet 1:1 — so wird nichts unscharf. Verschobene Ankerpunkte kommen
  // aus einem eigenen SVG-Pfadparser (siehe „Punkte & Kanten“).
  // =========================================================================

  const ZOOM_STUFEN = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  const Z_MIN = 1, Z_MAX = 64;
  const MODI = ['vn', 'ueberlagern'];
  const W_KARTE = 12;        // Weltabstand zwischen den Größenkarten
  const W_POLSTER = 3;       // Kartenrahmen um die Kachel
  const SICHT_MIN = 64;      // so viel Inhalt bleibt immer im Viewport (Gerätepixel)
  const VEK_MAX = 2048;      // größte Kantenlänge einer Vektor-Bitmap
  const PUNKT_TOLERANZ = 1.5;  // so weit darf ein Punkt gewandert sein, um noch derselbe zu sein
  const PUNKT_MIN = 0.01;      // darunter gilt ein Punkt als unverändert

  let vglModus = 'vn';
  let darstellung = 'vektor';          // pixel | vektor — Vektor ist Standard
  let retina = false;                  // Pixel-Darstellung: 1×-PNG (aus) oder 2×-PNG (an)
  let vglBasis = 'ohne';               // ohne | alt — Vergleichsbasis (§39.2)
  let snapAn = true;                   // Pixel-Snapping-Schalter, wirkt live auf die Bühne
  let blendeStart = 0;                 // 120-ms-Überblendung nach dem Umschalten
  let wischPos = 0.5;                  // Regler im Modus „Vorher/Nachher“
  let blend = 50;                      // Regler („Gewichtung“) im Modus „Überlagern“
  let punkteAn = true, flaechenAn = false;
  let aktiveKarte = 0;
  let raumTaste = false, zieht = false, wischZieht = false;
  let buehneHoehe = 320;
  // Kamera: KAM wird gezeichnet, ZIEL ist das Ziel (Lerp bei Buttons/Tasten).
  const KAM = { x: 0, y: 0, z: 6 };
  const ZIEL = { x: 0, y: 0, z: 6 };
  let sanft = false, malGeplant = false, fitQuelle = '';
  let LAYOUT = [], WELT = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let HOVER = null, hoverTimer = null;
  // Cache-Marken: Modus-, Zoom- und Filterwechsel dürfen die PNGs NICHT neu
  // analysieren — die Zellanalyse hängt nur an Diff, Basis und Hintergrund.
  let anaQuelle = null, anaSig = '', ANA = [];

  function dpr() { return Math.max(1, window.devicePixelRatio || 1); }
  function akzentRgb() { return dunkel ? [78, 166, 255] : [13, 153, 255]; }
  function akzent() { const f = akzentRgb(); return 'rgb(' + f[0] + ',' + f[1] + ',' + f[2] + ')'; }
  function umrissFarbe() { return dunkel ? '#ffffff' : '#1c1c22'; }
  function grundFarbe() { return dunkel ? '#17171a' : '#fafafc'; }
  function kachelGrund() { return dunkel ? '#1e1e1e' : '#ffffff'; }
  function rahmenFarbe() { return dunkel ? '#3a3a42' : '#e3e3e6'; }
  function textFarbe() { return dunkel ? '#e8e8ee' : '#1c1c22'; }
  function textFarbe2() { return dunkel ? '#a9a9b4' : '#6e6e76'; }

  function svgText(svg, farbe) {
    return svg.replace(/fill="[^"]*"/g, 'fill="' + farbe + '"')
              .replace(/fill:[^;"]*/g, 'fill:' + farbe);
  }
  // Ein SVG in genau dieser Pixelgröße rastern. Hängt ein Bild, fällt die
  // Kachel nach 2 s auf die Pixelfassung zurück.
  function svgCanvas(svg, farbe, px) {
    return new Promise(fertig => {
      let erledigt = false;
      const schluss = w => { if (erledigt) return; erledigt = true; fertig(w); };
      setTimeout(() => schluss(null), 2000);
      const img = new Image();
      const s = Math.max(16, Math.min(VEK_MAX, Math.round(px)));
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = s; c.height = s;
          c.getContext('2d').drawImage(img, 0, 0, s, s);
          schluss(c);
        } catch (e) { schluss(null); }
      };
      img.onerror = () => schluss(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText(svg, farbe));
    });
  }

  async function bitmapDaten(bytes) {
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    return { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
  }
  // Rasterfehler: RMS-Abweichung der echten 1×-Rasterung von der idealen
  // (8×-Referenz flächengemittelt aufs Zielraster). 0 = perfekt.
  async function treue(px1, px8) {
    const a = await bitmapDaten(px1);
    const r = await bitmapDaten(px8);
    const f = Math.round(r.w / a.w);
    let sum = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      let acc = 0;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++)
        acc += r.data[(((y * f + dy) * r.w) + (x * f + dx)) * 4 + 3];
      const d = (a.data[((y * a.w) + x) * 4 + 3] - acc / (f * f)) / 255;
      sum += d * d;
    }
    return Math.sqrt(sum / (a.w * a.h));
  }

  async function analysiere(bytes, markierenAa, invertieren) {
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    let voll = 0, teil = 0;
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i];
      if (a > 245) voll++;
      else if (a > 10) { teil++;
        if (markierenAa) { d[i - 3] = 224; d[i - 2] = 60; d[i - 1] = 60; d[i] = 255; } }
      if (invertieren && a > 0) {
        d[i - 3] = 255 - d[i - 3]; d[i - 2] = 255 - d[i - 2]; d[i - 1] = 255 - d[i - 1];
      }
    }
    if (markierenAa || invertieren) g.putImageData(id, 0, 0);
    const belegt = voll + teil;
    return { c: c, aa: belegt ? Math.round(100 * teil / belegt) : 0 };
  }

  // Wie viele Pixel haben ihre Deckung geändert — ohne Regionenbildung.
  const DIFF_SCHWELLE = 24;
  function diffZaehlen(A, B) {
    const w = Math.min(A.w, B.w), h = Math.min(A.h, B.h);
    let pixel = 0, weg = 0, dazu = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = A.data[((y * A.w) + x) * 4 + 3];
      const b = B.data[((y * B.w) + x) * 4 + 3];
      if (Math.abs(a - b) <= DIFF_SCHWELLE) continue;
      pixel++;
      if (a > b) weg++; else dazu++;
    }
    return { pixel: pixel, weg: weg, dazu: dazu };
  }

  // =========================================================================
  // SVG-Pfadparser (§39.4)
  // -------------------------------------------------------------------------
  // Figma exportiert absolute Kommandos; relative und H/V fangen wir trotzdem
  // ab. `transform="translate(x, y)"` auf <g> und <path> wird berücksichtigt,
  // fill-rule ignoriert. Ankerpunkte sind die Endpunkte der Segmente —
  // Kontrollpunkte gehören nicht dazu.
  // =========================================================================
  function translateVon(attr) {
    const m = /translate\(\s*(-?[\d.eE+-]+)[,\s]+(-?[\d.eE+-]+)?\s*\)/.exec(attr || '');
    if (!m) return { x: 0, y: 0 };
    return { x: Number(m[1]) || 0, y: Number(m[2] || 0) || 0 };
  }
  function viewBoxBreite(svg) {
    const vb = /viewBox\s*=\s*"([^"]+)"/.exec(svg);
    if (vb) {
      const t = vb[1].trim().split(/[\s,]+/).map(Number);
      if (t.length === 4 && t[2] > 0) return t[2];
    }
    const w = /\bwidth\s*=\s*"([\d.]+)/.exec(svg);
    return w ? Number(w[1]) || 1 : 1;
  }
  // Alle <path>-Elemente mit aufsummierter Verschiebung der umgebenden <g>.
  function svgPfade(svg) {
    const pfade = [];
    const stapel = [{ x: 0, y: 0 }];
    const re = /<(\/?)(g|path|svg)\b([^>]*)>/g;
    let m;
    while ((m = re.exec(svg))) {
      const zu = m[1] === '/', tag = m[2], attr = m[3] || '';
      if (tag === 'svg') continue;
      if (tag === 'g') {
        if (zu) { if (stapel.length > 1) stapel.pop(); }
        else if (!/\/$/.test(attr)) {
          const v = translateVon(attr), o = stapel[stapel.length - 1];
          stapel.push({ x: o.x + v.x, y: o.y + v.y });
        }
        continue;
      }
      if (zu) continue;
      const d = /\bd\s*=\s*"([^"]*)"/.exec(attr);
      if (!d || !d[1].trim()) continue;
      const v = translateVon(attr), o = stapel[stapel.length - 1];
      pfade.push({ d: d[1], tx: o.x + v.x, ty: o.y + v.y });
    }
    return pfade;
  }
  // Zahlen und Kommandos eines d-Attributs.
  function pfadTokens(d) {
    return String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
  }
  // Anzahl Zahlen je Kommando.
  const CMD_N = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  function pfadAnker(d) {
    const tk = pfadTokens(d);
    const punkte = [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
    const lies = () => Number(tk[i++]);
    while (i < tk.length) {
      if (/[a-zA-Z]/.test(tk[i])) { cmd = tk[i++]; }
      else if (!cmd) { i++; continue; }
      const gross = cmd.toUpperCase();
      const rel = cmd !== gross;
      const n = CMD_N[gross];
      if (n == null) { i++; continue; }
      if (gross === 'Z') { x = sx; y = sy; continue; }
      if (i + n > tk.length) break;
      if (gross === 'H') { const v = lies(); x = rel ? x + v : v; }
      else if (gross === 'V') { const v = lies(); y = rel ? y + v : v; }
      else if (gross === 'A') {
        lies(); lies(); lies(); lies(); lies();
        const px = lies(), py = lies();
        x = rel ? x + px : px; y = rel ? y + py : py;
      } else {
        // Kontrollpunkte überspringen, nur den Endpunkt behalten.
        for (let k = 0; k < n - 2; k++) lies();
        const px = lies(), py = lies();
        x = rel ? x + px : px; y = rel ? y + py : py;
      }
      if (gross === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
      punkte.push({ x: x, y: y });
    }
    return punkte;
  }
  // Pfade + Ankerpunkte einer SVG-Quelle, Punkte in Icon-Pixeln.
  function svgGeometrie(svg, N) {
    const W = viewBoxBreite(svg) || N || 1;
    const pfade = svgPfade(svg);
    const punkte = [];
    pfade.forEach(p => {
      p.W = W;
      pfadAnker(p.d).forEach(a =>
        punkte.push({ x: (a.x + p.tx) * N / W, y: (a.y + p.ty) * N / W }));
    });
    return { W: W, pfade: pfade, punkte: punkte };
  }
  // Paare bilden: jeder neue Punkt nimmt den nächsten freien alten Punkt
  // innerhalb der Toleranz. Zuerst die engsten Paare, damit nichts „verrutscht“.
  function ankerPaare(vor, neu) {
    const kandidaten = [];
    for (let b = 0; b < neu.length; b++) for (let a = 0; a < vor.length; a++) {
      const dx = neu[b].x - vor[a].x, dy = neu[b].y - vor[a].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= PUNKT_TOLERANZ) kandidaten.push({ a: a, b: b, d: d, dx: dx, dy: dy });
    }
    kandidaten.sort((p, q) => p.d - q.d);
    const altBelegt = {}, neuBelegt = {}, paare = [];
    kandidaten.forEach(k => {
      if (altBelegt[k.a] || neuBelegt[k.b]) return;
      altBelegt[k.a] = neuBelegt[k.b] = true;
      if (k.d < PUNKT_MIN) return;
      paare.push({ ax: vor[k.a].x, ay: vor[k.a].y, bx: neu[k.b].x, by: neu[k.b].y,
        dx: k.dx, dy: k.dy, d: k.d });
    });
    return paare;
  }
  function punktText(p) {
    const waag = Math.abs(p.dx) >= Math.abs(p.dy);
    const weg = Math.abs(waag ? p.dx : p.dy);
    const richtung = waag ? t(p.dx >= 0 ? 'reg.rechts' : 'reg.links')
                          : t(p.dy >= 0 ? 'reg.unten' : 'reg.oben');
    return t('pkt.hover', { d: zahl(weg.toFixed(2)), richtung: richtung });
  }

  // ---- Vergleichsbasis (§39.2) --------------------------------------------
  function hatOhne(c) { return !!(c && (c.ohne || c.pngOhne)); }
  function hatAlt(c) { return !!(c && (c.alt || c.pngAlt)); }
  function diffHatOhne() {
    return !!(letzterDiff && (letzterDiff.zellen || []).some(hatOhne));
  }
  // Welche Fassung zeigt „Nachher“? Bei aktivem Snapping die gesnappte
  // (`neu`), sonst die ungesnappte (`ohne`) — beide liegen im selben Diff,
  // deshalb schaltet der Schalter ohne neuen Export um.
  function nachQuelle() { return (snapAn || !diffHatOhne()) ? 'neu' : 'ohne'; }
  // Welche Basis gilt für diese Zelle — mit Rückfall, wenn eine fehlt.
  // Zeigt „Nachher“ bereits die ungesnappte Fassung, taugt sie nicht als Basis.
  function basisVon(c) {
    const frei = nachQuelle() === 'neu';
    if (vglBasis === 'ohne' && frei && hatOhne(c)) return 'ohne';
    if (hatAlt(c)) return 'alt';
    return (frei && hatOhne(c)) ? 'ohne' : null;
  }
  // Die Basis, die die Beschriftung trägt (die der ersten Zelle mit Daten).
  function basisAktiv() {
    const zellen = (letzterDiff && letzterDiff.zellen) || [];
    for (const c of zellen) { const b = basisVon(c); if (b) return b; }
    return null;
  }
  function basisName() {
    const b = basisAktiv();
    return b === 'ohne' ? t('v.basisOhne') : t('v.basisAlt');
  }
  function vorherPille() { return t('pill.vorher') + ' · ' + basisName(); }

  // ---- Analyse je Zelle (einmal je Diff, Basis und Hintergrund) -----------
  function gueteNeu(c) {
    const g = c.guete;
    if (!g) return null;
    return g.mitSnap ? g.snap : g.plain;
  }
  async function analyseHolen() {
    const nq = nachQuelle();
    const sig = (dunkel ? 'd' : 'h') + (retina ? '2' : '1') + '|' + vglBasis + '|' + nq;
    if (anaQuelle === letzterDiff && anaSig === sig) return ANA;
    anaQuelle = letzterDiff; anaSig = sig;
    ANA = [];
    for (const c of (letzterDiff ? letzterDiff.zellen : [])) {
      const basis = basisVon(c);
      const e = { N: c.N, zelle: c, basis: basis,
        bildNeu: null, bildVor: null, aaNeu: null, aaVor: null,
        fehlerNeu: null, fehlerVor: null,
        svgNeu: (nq === 'ohne' ? c.ohne : c.neu) || null,
        svgVor: basis === 'ohne' ? (c.ohne || null) : (c.alt || null),
        vek: {}, vekLauf: {}, geoNeu: null, geoVor: null, paare: null,
        diffZahl: null, misch: null, mischSig: '', dlay: null, dlaySig: '' };
      // Retina zeigt die 2×-Rasterung, sonst die echte 1×-Rasterung.
      const qNeu = nq === 'ohne'
        ? (retina && c.pngOhne2 ? c.pngOhne2 : c.pngOhne)
        : (retina && c.pngNeu2 ? c.pngNeu2 : c.pngNeu);
      const qVor = basis === 'ohne'
        ? (retina && c.pngOhne2 ? c.pngOhne2 : c.pngOhne)
        : (retina && c.pngAlt2 ? c.pngAlt2 : c.pngAlt);
      if (qNeu) { const r = await analysiere(qNeu, false, dunkel); e.bildNeu = r.c; e.aaNeu = r.aa; }
      if (qVor) { const r = await analysiere(qVor, false, dunkel); e.bildVor = r.c; e.aaVor = r.aa; }
      // Rohe 1×-PNGs für die Pixelzählung (unabhängig von Retina).
      const rNeu = nq === 'ohne' ? c.pngOhne : c.pngNeu;
      const rVor = basis === 'ohne' ? c.pngOhne : c.pngAlt;
      if (rNeu && rVor) {
        try { e.diffZahl = diffZaehlen(await bitmapDaten(rVor), await bitmapDaten(rNeu)); } catch (err) {}
      }
      const g = nq === 'ohne' ? c.gueteOhne : gueteNeu(c);
      e.fehlerNeu = g && isFinite(g.fehler) ? g.fehler : null;
      const gv = basis === 'ohne' ? c.gueteOhne : c.gueteAlt;
      e.fehlerVor = gv && isFinite(gv.fehler) ? gv.fehler : null;
      if (e.aaNeu == null && g) e.aaNeu = g.aa;
      if (e.aaVor == null && gv && isFinite(gv.aa)) e.aaVor = gv.aa;
      // Geometrie für „Punkte & Kanten“ — einmal je Zelle.
      if (e.svgNeu) e.geoNeu = svgGeometrie(e.svgNeu, e.N);
      if (e.svgVor) e.geoVor = svgGeometrie(e.svgVor, e.N);
      e.paare = (e.geoNeu && e.geoVor) ? ankerPaare(e.geoVor.punkte, e.geoNeu.punkte) : [];
      ANA.push(e);
    }
    return ANA;
  }

  // ---- Vektor je Zoomstufe rastern (§39.3) --------------------------------
  // Stufe = kleinste Zweierpotenz ≥ Zoom (Gerätepixel je Icon-Pixel), höchstens
  // 64. Die Bitmap wird genau in dieser Auflösung erzeugt und 1:1 gezeichnet.
  function vekStufe() {
    let s = 1;
    while (s < KAM.z && s < 64) s *= 2;
    return s;
  }
  function vekSchluessel(welche, stufe) { return welche + '|' + stufe + '|' + (dunkel ? 'd' : 'h'); }
  // Nächstbeste schon fertige Stufe — damit beim Zoomen nie ein Loch entsteht.
  function vekErsatz(e, welche) {
    let best = null, bestStufe = 0;
    for (let s = 64; s >= 1; s /= 2) {
      const c = e.vek[vekSchluessel(welche, s)];
      if (c && s > bestStufe) { best = c; bestStufe = s; }
    }
    return best;
  }
  function vekBild(e, welche) {
    const svg = welche === 'vor' ? e.svgVor : e.svgNeu;
    if (!svg) return null;
    const stufe = vekStufe();
    const key = vekSchluessel(welche, stufe);
    if (e.vek[key]) return e.vek[key];
    if (!e.vekLauf[key]) {
      e.vekLauf[key] = true;
      svgCanvas(svg, umrissFarbe(), e.N * stufe).then(c => {
        if (c) { e.vek[key] = c; anstossen(false); }
      });
    }
    return vekErsatz(e, welche);
  }
  function bildVon(e, welche) {
    if (darstellung === 'vektor') {
      const v = vekBild(e, welche);
      if (v) return v;
    }
    return welche === 'vor' ? e.bildVor : e.bildNeu;
  }

  // ---- Zahlen und Texte ----------------------------------------------------
  function massStimmt(c) {
    if (c.ist == null || c.soll == null) return null;
    return Math.abs(Number(c.ist) - Number(c.soll)) <= 0.5;
  }
  // Eine Stelle für alle Zahlen: Rasterfehler immer drei Nachkommastellen,
  // Prozent ganzzahlig, Maße zwei Stellen, Dezimaltrennzeichen aus zahl().
  function fmt(art, v) {
    if (v == null || !isFinite(Number(v))) return t('ber.keineDaten');
    const n = Number(v);
    if (art === 'fehler') return zahl(n.toFixed(3));
    if (art === 'prozent') return Math.round(n) + ' %';
    if (art === 'mass') return zahl(n.toFixed(2));
    return zahl(String(n));
  }
  // Vergleichswert: bei Gleichstand nur EINE Zahl statt „0,012 → 0,012“.
  function fmtVgl(art, alt, neu) {
    if (neu == null || !isFinite(Number(neu))) return t('ber.keineDaten');
    const a = alt == null || !isFinite(Number(alt)) ? null : fmt(art, alt);
    const n = fmt(art, neu);
    return (a == null || a === n) ? n : a + ' → ' + n;
  }
  // Delta mit Vorzeichen und Prozent; null, wenn sich nichts geändert hat.
  function fmtDelta(alt, neu) {
    if (alt == null || neu == null || !(Number(alt) > 0)) return null;
    const d = Math.round((Number(neu) - Number(alt)) / Number(alt) * 100);
    if (!isFinite(d) || d === 0) return null;
    return (d < 0 ? '−' : '+') + Math.abs(d) + ' %';
  }
  function deltaText(alt, neu) { return fmtDelta(alt, neu); }
  function radiusText(c) {
    if (c.radius == null) return null;
    if (typeof c.radius !== 'object') return zahl(c.radius);
    return t('radius.' + c.radius.modus) + (c.radius.modus === 'fest' ? ' ' + zahl(c.radius.wert) : '');
  }

  // ---- Urteil-Zeile --------------------------------------------------------
  function pille(text, art) {
    const s = document.createElement('span');
    s.className = 'upill' + (art ? ' ' + art : '');
    s.textContent = text;
    return s;
  }
  function urteilZeichnen(A) {
    const zeile = $('urteil'), txt = $('urteilText'), pillen = $('urteilPills');
    pillen.textContent = '';
    if (!A.length) { zeile.className = 'vzeile urteilzeile'; txt.textContent = ''; return; }
    let aaVorS = 0, aaVorN = 0, aaNeuS = 0, aaNeuN = 0;
    let feVorS = 0, feVorN = 0, feNeuS = 0, feNeuN = 0;
    let massOk = 0, massGes = 0, gerastet = 0, mitVor = 0, punkte = 0;
    A.forEach(e => {
      if (e.aaVor != null) { aaVorS += e.aaVor; aaVorN++; }
      if (e.aaNeu != null) { aaNeuS += e.aaNeu; aaNeuN++; }
      if (e.fehlerVor != null) { feVorS += e.fehlerVor; feVorN++; }
      if (e.fehlerNeu != null) { feNeuS += e.fehlerNeu; feNeuN++; }
      const ok = massStimmt(e.zelle);
      if (ok != null) { massGes++; if (ok) massOk++; }
      gerastet += Number(e.zelle.gerastet) || 0;
      punkte += (e.paare || []).length;
      if (e.bildVor) mitVor++;
    });
    const aaVor = aaVorN ? Math.round(aaVorS / aaVorN) : null;
    const aaNeu = aaNeuN ? Math.round(aaNeuS / aaNeuN) : null;
    const feVor = feVorN ? feVorS / feVorN : null;
    const feNeu = feNeuN ? feNeuS / feNeuN : null;
    const massAlle = massGes > 0 && massOk === massGes;

    // Ein Satz in Klartext; bei Gleichstand keine zwei gleichen Zahlen.
    let art = 'neutral';
    if (!mitVor) {
      txt.textContent = t('urt.neu');
    } else if (aaVor != null && aaNeu != null && aaNeu < aaVor - 0.5) {
      txt.textContent = t('urt.besser', { alt: fmt('prozent', aaVor), neu: fmt('prozent', aaNeu) });
      art = 'gut';
    } else if (aaVor != null && aaNeu != null && aaNeu > aaVor + 0.5) {
      txt.textContent = t('urt.schlechter', { alt: fmt('prozent', aaVor), neu: fmt('prozent', aaNeu) });
      art = 'warn';
    } else {
      txt.textContent = t('urt.gleich', { neu: aaNeu == null ? fmt('fehler', feNeu) : fmt('prozent', aaNeu) });
    }
    if (massGes && !massAlle) art = 'warn';
    zeile.className = 'vzeile urteilzeile ' + art;

    // Höchstens zwei kurze Pills, danach der Hinweis auf die Vergleichsbasis.
    const d = mitVor ? fmtDelta(aaVor, aaNeu) : null;
    const kandidaten = [];
    if (d) kandidaten.push([d, d.charAt(0) === '−' ? 'gut' : 'warn']);
    if (massGes) kandidaten.push([
      t('urt.mass', { n: massOk, m: massGes }) + (massAlle ? ' ✓' : ' △'), massAlle ? 'gut' : 'warn']);
    if (punkte) kandidaten.push([t('urt.punkte', { n: punkte }), '']);
    else if (gerastet) kandidaten.push([t('urt.gerastet', { n: gerastet }), '']);
    if (!kandidaten.length && feNeu != null) kandidaten.push([t('urt.fehler', { v: fmt('fehler', feNeu) }), '']);
    kandidaten.slice(0, 2).forEach(k => pillen.appendChild(pille(k[0], k[1])));
    // Ohne Snapping gibt es keine zweite Basis — dann sagt die Zeile das auch.
    if (mitVor && !diffHatOhne()) pillen.appendChild(pille(t('urt.basisLib'), ''));
    // Unbenutzt, aber erklärend: der gemittelte Rasterfehler steht im Fuß.
    void feVor;
  }

  // Legende: nur das, was gerade gezeichnet wird.
  function legendeZeichnen() {
    const box = $('vLegende');
    box.textContent = '';
    const stuecke = [];
    if (punkteAn) {
      stuecke.push(['vor', t('leg.vorKontur')]);
      stuecke.push(['punktAlt', t('leg.punktAlt')]);
      stuecke.push(['punktNeu', t('leg.punktNeu')]);
    }
    if (flaechenAn) {
      stuecke.push(['weg', t('leg.weg')]);
      stuecke.push(['dazu', t('leg.dazu')]);
    }
    if (!stuecke.length) stuecke.push(['beide', t('leg.aus')]);
    stuecke.forEach(x => {
      const s = document.createElement('span');
      s.className = 'legstueck';
      const i = document.createElement('i');
      i.className = 'legfeld ' + x[0];
      s.appendChild(i);
      const b = document.createElement('span');
      b.textContent = x[1];
      s.appendChild(b);
      box.appendChild(s);
    });
  }

  // ---- Kennzahlen-Fuß (DOM, eine Spalte je Größe) -------------------------
  // Jedes Label trägt ein kleines „?“ mit dem Erklärsatz (§39.6).
  function labelMitHilfe(label, tip) {
    const tt = document.createElement('fig-tooltip');
    tt.setAttribute('text', tip);
    tt.setAttribute('delay', '300');
    const s = document.createElement('span');
    s.className = 'kzname';
    s.textContent = label;
    const f = document.createElement('i');
    f.className = 'hilfezeichen';
    f.textContent = '?';
    s.appendChild(f);
    tt.appendChild(s);
    return tt;
  }
  function kennzahlenZeichnen(A) {
    const box = $('kennzahlen');
    box.textContent = '';
    if (!A.length) return;
    const tab = document.createElement('table');
    tab.className = 'kztab';
    const kopf = document.createElement('tr');
    kopf.appendChild(document.createElement('th'));
    A.forEach(e => {
      const th = document.createElement('th');
      th.textContent = zahl(e.N) + ' px';
      const ok = massStimmt(e.zelle);
      if (ok != null) th.className = ok ? 'gut' : 'warn';
      kopf.appendChild(th);
    });
    tab.appendChild(kopf);
    const zeilen = [
      { label: t('fuss.fehler'), tip: t('ber.tipTreue'),
        wert: e => fmtVgl('fehler', e.fehlerVor, e.fehlerNeu) },
      { label: t('fuss.aa'), tip: t('ber.tipAa'),
        wert: e => fmtVgl('prozent', e.aaVor, e.aaNeu) },
      { label: t('fuss.keyline'), tip: t('ber.tipMass'), wert: e => {
        const c = e.zelle, ok = massStimmt(c);
        return c.soll == null ? t('ber.keineDaten')
          : fmt('mass', c.ist) + ' / ' + zahl(c.soll) + (ok == null ? '' : ok ? ' ✓' : ' △');
      } },
      { label: t('fuss.punkte'), tip: t('tip.punkte'),
        wert: e => (e.paare && e.paare.length) ? String(e.paare.length) : t('ber.keineDaten') }
    ];
    // Im Überlagern-Modus zählt zusätzlich, wie viele Pixel sich geändert haben.
    if (vglModus === 'ueberlagern') zeilen.push({
      label: t('fuss.veraendert'), tip: t('tip.veraendert'),
      wert: e => e.diffZahl && e.diffZahl.pixel ? t('fuss.veraendertWert',
        { n: e.diffZahl.pixel, weg: e.diffZahl.weg, dazu: e.diffZahl.dazu }) : t('ber.keineDaten') });
    zeilen.forEach(z => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'kzlabel';
      td.appendChild(labelMitHilfe(z.label, z.tip));
      tr.appendChild(td);
      A.forEach(e => {
        const c = document.createElement('td');
        c.textContent = z.wert(e);
        tr.appendChild(c);
      });
      tab.appendChild(tr);
    });
    box.appendChild(tab);
  }

  // ---- Hinting (aufklappbar, Standard zu) ---------------------------------
  // Was das Snapping in dieser Größe getan hat. Werte, die der Hauptthread
  // nicht mitschickt (z. B. geschützte Knoten), fallen als Zeile weg.
  function hintingZeichnen(A) {
    const box = $('hintTabelle');
    box.textContent = '';
    if (!A.length) return;
    const zeilen = [
      { label: t('hint.kanten'), wert: e => {
        const n = Number(e.zelle.gerastet);
        return isFinite(n) ? String(n) : null;
      } },
      { label: t('hint.geschuetzt'), wert: e => {
        const n = Number(e.zelle.geschuetzt);
        return isFinite(n) ? String(n) : null;
      } },
      { label: t('hint.orakel'), wert: e => {
        const g = e.zelle.guete;
        if (!g) return null;
        return t(g.mitSnap ? 'hint.orakelSnap' : 'hint.orakelFit');
      } },
      { label: t('hint.raster'), wert: e => {
        const r = e.zelle.raster;
        if (r == null) return null;
        const grob = e.zelle.grob;
        return zahl(r) + (grob ? ' · ' + t('hint.grob', { v: zahl(grob) }) : '');
      } },
      { label: t('hint.phase'), wert: e => {
        const k = Number(e.zelle.kontur), r = Number(e.zelle.raster);
        if (!isFinite(k) || !isFinite(r) || !(r > 0)) return null;
        const ph = ((k / 2) % r + r) % r;
        return fmt('mass', ph) + ' px';
      } },
      { label: t('hint.kontur'), wert: e => {
        const k = Number(e.zelle.kontur);
        return isFinite(k) ? zahl(k) + ' px' : null;
      } },
      { label: t('hint.radius'), wert: e => radiusText(e.zelle) }
    ].map(z => ({ label: z.label, werte: A.map(z.wert) }))
     .filter(z => z.werte.some(w => w != null && w !== ''));
    if (!zeilen.length) return;
    const tab = document.createElement('table');
    tab.className = 'kztab';
    const kopf = document.createElement('tr');
    kopf.appendChild(document.createElement('th'));
    A.forEach(e => {
      const th = document.createElement('th');
      th.textContent = zahl(e.N) + ' px';
      kopf.appendChild(th);
    });
    tab.appendChild(kopf);
    zeilen.forEach(z => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'kzlabel';
      td.textContent = z.label;
      tr.appendChild(td);
      z.werte.forEach(w => {
        const c = document.createElement('td');
        c.textContent = w == null || w === '' ? t('ber.keineDaten') : w;
        tr.appendChild(c);
      });
      tab.appendChild(tr);
    });
    box.appendChild(tab);
  }

  // ---- Layout in Weltkoordinaten -----------------------------------------
  // Eine Kachel je Größe — beide Modi zeigen genau eine Fläche.
  function layoutRechnen(A) {
    LAYOUT = [];
    let x = 0, maxN = 1;
    A.forEach((e, i) => {
      const N = e.N || 1;
      if (N > maxN) maxN = N;
      LAYOUT.push({ e: e, i: i, N: N, x: x, y: -N / 2, breite: N });
      x += N + W_KARTE;
    });
    const rand = W_POLSTER + 1;
    WELT = { x0: -rand, y0: -maxN / 2 - rand, x1: Math.max(0, x - W_KARTE) + rand, y1: maxN / 2 + rand };
  }

  // ---- Kamera --------------------------------------------------------------
  function leinwand() { return $('vpCanvas'); }
  function vpBreite() { return leinwand().width || 1; }
  function vpHoehe() { return leinwand().height || 1; }
  function dx(wx) { return (wx - KAM.x) * KAM.z; }
  function dy(wy) { return (wy - KAM.y) * KAM.z; }
  function weltX(devX) { return KAM.x + devX / KAM.z; }
  function weltY(devY) { return KAM.y + devY / KAM.z; }

  function klemmen(k) {
    k.z = Math.max(Z_MIN, Math.min(Z_MAX, k.z));
    const bw = vpBreite(), bh = vpHoehe();
    const links = (WELT.x0 - k.x) * k.z, rechts = (WELT.x1 - k.x) * k.z;
    if (rechts < SICHT_MIN) k.x = WELT.x1 - SICHT_MIN / k.z;
    else if (links > bw - SICHT_MIN) k.x = WELT.x0 - (bw - SICHT_MIN) / k.z;
    const oben = (WELT.y0 - k.y) * k.z, unten = (WELT.y1 - k.y) * k.z;
    if (unten < SICHT_MIN) k.y = WELT.y1 - SICHT_MIN / k.z;
    else if (oben > bh - SICHT_MIN) k.y = WELT.y0 - (bh - SICHT_MIN) / k.z;
    return k;
  }
  function anstossen(mitLerp) {
    if (mitLerp) sanft = true;
    if (malGeplant) return;
    malGeplant = true;
    requestAnimationFrame(schleife);
  }
  function schleife() {
    malGeplant = false;
    let weiter = false;
    if (sanft) {
      const f = 0.25;
      KAM.x += (ZIEL.x - KAM.x) * f;
      KAM.y += (ZIEL.y - KAM.y) * f;
      KAM.z += (ZIEL.z - KAM.z) * f;
      if (Math.abs(ZIEL.x - KAM.x) > 0.01 || Math.abs(ZIEL.y - KAM.y) > 0.01
        || Math.abs(ZIEL.z - KAM.z) > 0.005) weiter = true;
      else { KAM.x = ZIEL.x; KAM.y = ZIEL.y; KAM.z = ZIEL.z; sanft = false; }
    } else { KAM.x = ZIEL.x; KAM.y = ZIEL.y; KAM.z = ZIEL.z; }
    zeichnen();
    if (weiter) { malGeplant = true; requestAnimationFrame(schleife); }
  }
  function kameraSetzen(x, y, z, mitLerp) {
    ZIEL.x = x; ZIEL.y = y; ZIEL.z = z;
    klemmen(ZIEL);
    if (!mitLerp) { KAM.x = ZIEL.x; KAM.y = ZIEL.y; KAM.z = ZIEL.z; sanft = false; }
    zoomPilleSetzen();
    anstossen(mitLerp);
  }
  // Zoom um einen Punkt im Viewport (Gerätepixel): der Punkt bleibt liegen.
  function zoomUm(devX, devY, neuZ, mitLerp) {
    const z = Math.max(Z_MIN, Math.min(Z_MAX, neuZ));
    const wx = weltX(devX), wy = weltY(devY);
    kameraSetzen(wx - devX / z, wy - devY / z, z, mitLerp);
  }
  function zoomMitte(neuZ, mitLerp) { zoomUm(vpBreite() / 2, vpHoehe() / 2, neuZ, mitLerp); }
  function stufeNehmen(richtung) {
    const z = ZIEL.z;
    if (richtung > 0) {
      for (let i = 0; i < ZOOM_STUFEN.length; i++) if (ZOOM_STUFEN[i] > z + 0.01) return ZOOM_STUFEN[i];
      return Z_MAX;
    }
    for (let i = ZOOM_STUFEN.length - 1; i >= 0; i--) if (ZOOM_STUFEN[i] < z - 0.01) return ZOOM_STUFEN[i];
    return Z_MIN;
  }
  function fitRechnen() {
    if (!LAYOUT.length) return;
    const rand = 14 * dpr(), obenRaum = 30 * dpr();
    const bw = Math.max(40, vpBreite() - 2 * rand);
    const bh = Math.max(40, vpHoehe() - 2 * rand - obenRaum);
    const ww = Math.max(1, WELT.x1 - WELT.x0), wh = Math.max(1, WELT.y1 - WELT.y0);
    const z = Math.max(Z_MIN, Math.min(Z_MAX, Math.min(bw / ww, bh / wh)));
    const mx = (WELT.x0 + WELT.x1) / 2, my = (WELT.y0 + WELT.y1) / 2;
    return { x: mx - vpBreite() / 2 / z, y: my - (vpHoehe() / 2 - obenRaum / 2) / z, z: z };
  }
  function zoomFit(mitLerp) {
    const f = fitRechnen();
    if (f) kameraSetzen(f.x, f.y, f.z, mitLerp !== false);
  }
  function karteMittig(i, mitLerp) {
    const k = LAYOUT[Math.max(0, Math.min(LAYOUT.length - 1, i))];
    if (!k) return;
    aktiveKarte = k.i;
    kameraSetzen(k.x + k.breite / 2 - vpBreite() / 2 / ZIEL.z,
      k.y + k.N / 2 - vpHoehe() / 2 / ZIEL.z, ZIEL.z, mitLerp !== false);
  }
  function aufKarteZoomen(i, mitLerp) {
    const k = LAYOUT[Math.max(0, Math.min(LAYOUT.length - 1, i))];
    if (!k) return;
    aktiveKarte = k.i;
    const rand = 16 * dpr(), obenRaum = 30 * dpr();
    const z = Math.max(Z_MIN, Math.min(Z_MAX, Math.min(
      (vpBreite() - 2 * rand) / (k.breite + 2 * W_POLSTER),
      (vpHoehe() - 2 * rand - obenRaum) / (k.N + 2 * W_POLSTER))));
    kameraSetzen(k.x + k.breite / 2 - vpBreite() / 2 / z,
      k.y + k.N / 2 - (vpHoehe() / 2 - obenRaum / 2) / z, z, mitLerp !== false);
  }

  // ---- Zeichnen ------------------------------------------------------------
  function leinwandMessen() {
    const cv = leinwand(), box = $('buehne');
    const p = dpr();
    const b = Math.max(1, Math.round(box.clientWidth * p));
    const h = Math.max(1, Math.round(box.clientHeight * p));
    if (cv.width !== b || cv.height !== h) { cv.width = b; cv.height = h; return true; }
    return false;
  }
  function rundRechteck(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }
  function pillZeichnen(g, text, x, y, p) {
    g.font = '700 ' + Math.round(9 * p) + 'px Inter, system-ui, sans-serif';
    const b = g.measureText(text).width + 8 * p;
    const h = 13 * p;
    g.fillStyle = dunkel ? 'rgba(30,30,34,.82)' : 'rgba(255,255,255,.86)';
    rundRechteck(g, x, y, b, h, 4 * p);
    g.fill();
    g.fillStyle = textFarbe2();
    g.textBaseline = 'middle';
    g.fillText(text, x + 4 * p, y + h / 2 + 0.5 * p);
    g.textBaseline = 'alphabetic';
    return b;
  }

  // ---- Überlagern: farbige Onionskin ---------------------------------------
  // Deckung neutral, Unterschiede farbig. Je Pixel aus den Alphawerten:
  // gemeinsam = min(vor, neu) → Grau, nur vor → Orange, nur neu → Akzentblau.
  // Der Regler gewichtet die beiden Differenzanteile.
  const MISCH_GRAU = { hell: [58, 58, 68], dunkel: [217, 217, 222] };
  const MISCH_WEG  = { hell: [245, 166, 35], dunkel: [255, 184, 77] };
  function wegRgb() { return dunkel ? MISCH_WEG.dunkel : MISCH_WEG.hell; }
  function rgbText(f, alpha) {
    return 'rgba(' + f[0] + ',' + f[1] + ',' + f[2] + ',' + (alpha == null ? 1 : alpha) + ')';
  }
  // Auflösung der Rechenbilder: Pixel = echte Rasterung, Vektor feiner.
  function bildAufl(N) { return darstellung === 'vektor' ? N * 8 : (retina ? N * 2 : N); }
  function alphaFeld(bild, R) {
    const c = document.createElement('canvas');
    c.width = R; c.height = R;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = R !== bild.width;
    g.clearRect(0, 0, R, R);
    g.drawImage(bild, 0, 0, R, R);
    const d = g.getImageData(0, 0, R, R).data;
    const a = new Uint8ClampedArray(R * R);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    return a;
  }
  // Rechenquelle: im Vektormodus die feinste fertige Bitmap, sonst das PNG.
  function rechenBild(e, welche) {
    if (darstellung === 'vektor') {
      const v = vekErsatz(e, welche) || vekBild(e, welche);
      if (v) return v;
    }
    return welche === 'vor' ? e.bildVor : e.bildNeu;
  }
  function mischCanvas(e) {
    const R = bildAufl(e.N);
    const stufe = Math.round(blend / 5) * 5;
    const qVor = rechenBild(e, 'vor'), qNeu = rechenBild(e, 'neu');
    const sig = darstellung + '|' + R + '|' + stufe + '|' + (dunkel ? 'd' : 'h')
      + '|' + (qVor ? qVor.width : 0) + '|' + (qNeu ? qNeu.width : 0);
    if (e.mischSig === sig && e.misch) return e.misch;
    if (!qNeu && !qVor) return null;
    const A = qVor ? alphaFeld(qVor, R) : null;
    const B = qNeu ? alphaFeld(qNeu, R) : null;
    const c = document.createElement('canvas');
    c.width = R; c.height = R;
    const g = c.getContext('2d');
    const bild = g.createImageData(R, R);
    const d = bild.data;
    const grau = dunkel ? MISCH_GRAU.dunkel : MISCH_GRAU.hell;
    const weg = dunkel ? MISCH_WEG.dunkel : MISCH_WEG.hell;
    const dazu = akzentRgb();
    const gNeu = stufe / 100, gVor = 1 - gNeu;
    const vergleich = !!(A && B);
    for (let i = 0; i < R * R; i++) {
      const a = A ? A[i] / 255 : 0, b = B ? B[i] / 255 : 0;
      if (!vergleich) {
        const v = Math.max(a, b);
        if (v <= 0.004) continue;
        const k0 = i * 4;
        d[k0] = grau[0]; d[k0 + 1] = grau[1]; d[k0 + 2] = grau[2];
        d[k0 + 3] = Math.round(v * 255);
        continue;
      }
      const gem = Math.min(a, b);
      const nurA = Math.max(0, a - b) * gVor;
      const nurB = Math.max(0, b - a) * gNeu;
      const summe = gem + nurA + nurB;
      if (summe <= 0.004) continue;
      const k = i * 4;
      d[k]     = (grau[0] * gem + weg[0] * nurA + dazu[0] * nurB) / summe;
      d[k + 1] = (grau[1] * gem + weg[1] * nurA + dazu[1] * nurB) / summe;
      d[k + 2] = (grau[2] * gem + weg[2] * nurA + dazu[2] * nurB) / summe;
      d[k + 3] = Math.round(Math.min(1, summe) * 255);
    }
    g.putImageData(bild, 0, 0);
    e.misch = c; e.mischSig = sig;
    return c;
  }

  // Nach dem Umschalten blendet die Nachher-Kachel in 120 ms ein.
  function nachAlpha() {
    if (!blendeStart) return 1;
    const f = (Date.now() - blendeStart) / 120;
    if (f >= 1) { blendeStart = 0; return 1; }
    return Math.max(0.05, f);
  }
  function bildZeichnen(g, bild, x, y, s, alpha) {
    if (!bild) return;
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    // Vektor-Bitmaps sind in Zoomauflösung gerastert: 1:1, nur beim Nachziehen
    // einer gröberen Stufe wird geglättet. Pixelansicht bleibt hart.
    g.imageSmoothingEnabled = darstellung === 'vektor' && Math.abs(bild.width - s) > 0.5;
    g.drawImage(bild, x, y, s, s);
    g.restore();
  }

  // ---- Flächen-Differenz (Schalter „Flächen“) -----------------------------
  // Entfernte Bereiche orange, hinzugekommene blau, je 70 % Deckung.
  function diffLayer(e) {
    const R = bildAufl(e.N);
    const qVor = rechenBild(e, 'vor'), qNeu = rechenBild(e, 'neu');
    const sig = darstellung + '|' + R + '|' + (dunkel ? 'd' : 'h')
      + '|' + (qVor ? qVor.width : 0) + '|' + (qNeu ? qNeu.width : 0);
    if (e.dlaySig === sig && e.dlay !== undefined) return e.dlay;
    e.dlaySig = sig; e.dlay = null;
    if (!qVor || !qNeu) return null;
    const A = alphaFeld(qVor, R), B = alphaFeld(qNeu, R);
    const c = document.createElement('canvas');
    c.width = R; c.height = R;
    const g = c.getContext('2d');
    const bild = g.createImageData(R, R);
    const d = bild.data;
    const weg = wegRgb(), dazu = akzentRgb();
    const schwelle = DIFF_SCHWELLE / 255;
    for (let i = 0; i < R * R; i++) {
      const diff = (A[i] - B[i]) / 255;
      if (Math.abs(diff) <= schwelle) continue;
      const f = diff > 0 ? weg : dazu;
      const k = i * 4;
      d[k] = f[0]; d[k + 1] = f[1]; d[k + 2] = f[2];
      d[k + 3] = Math.round(Math.min(1, Math.abs(diff)) * 0.7 * 255);
    }
    g.putImageData(bild, 0, 0);
    e.dlay = c;
    return c;
  }
  function flaechenZeichnen(g, e, x, y, s) {
    if (!flaechenAn) return;
    const lay = diffLayer(e);
    if (!lay) return;
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(lay, x, y, s, s);
    g.restore();
  }

  // ---- Punkte & Kanten (§39.4) --------------------------------------------
  // Vorher-Kontur dünn gestrichelt orange, Nachher-Kontur 1 px dunkel/hell,
  // verschobene Punkte als hohler Ring (alt) → gefüllter Punkt (neu).
  function pfadeStreichen(g, geo, x, y, s, N, farbe, p, gestrichelt) {
    if (!geo || typeof Path2D !== 'function') return;
    const f = s / (geo.W || N);
    geo.pfade.forEach(pf => {
      let pd;
      try { pd = new Path2D(pf.d); } catch (e) { return; }
      g.save();
      g.translate(x, y);
      g.scale(f, f);
      g.translate(pf.tx, pf.ty);
      g.strokeStyle = farbe;
      g.lineWidth = p / f;
      if (gestrichelt) g.setLineDash([3 * p / f, 2.5 * p / f]);
      g.stroke(pd);
      g.restore();
    });
  }
  function punkteZeichnen(g, e, x, y, s, N, p) {
    if (!punkteAn) return;
    const skal = s / N;
    if (e.geoVor) pfadeStreichen(g, e.geoVor, x, y, s, N, rgbText(wegRgb(), 0.85), p, true);
    if (e.geoNeu) pfadeStreichen(g, e.geoNeu, x, y, s, N, umrissFarbe(), p, false);
    const paare = e.paare || [];
    if (!paare.length) return;
    const r = Math.max(2.5 * p, Math.min(4.5 * p, skal * 0.22));
    g.save();
    paare.forEach(pa => {
      const ax = x + pa.ax * skal, ay = y + pa.ay * skal;
      const bx = x + pa.bx * skal, by = y + pa.by * skal;
      const hov = HOVER && HOVER.paar === pa;
      g.strokeStyle = rgbText(wegRgb(), 0.8);
      g.lineWidth = p;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      g.beginPath(); g.arc(ax, ay, r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = akzent();
      g.beginPath(); g.arc(bx, by, hov ? r * 1.25 : r * 0.9, 0, Math.PI * 2); g.fill();
      if (hov) {
        g.strokeStyle = umrissFarbe();
        g.lineWidth = p;
        g.beginPath(); g.arc(bx, by, r * 1.9, 0, Math.PI * 2); g.stroke();
      }
    });
    g.restore();
  }
  // Sagt an der Nachher-Kachel, welche Fassung gerade zu sehen ist.
  function snapPille(g, x, y, p, rechteKante) {
    const txt = t(nachQuelle() === 'ohne' ? 'pill.snapAus' : 'pill.snapAn');
    g.font = '700 ' + Math.round(9 * p) + 'px Inter, system-ui, sans-serif';
    const b = g.measureText(txt).width + 8 * p;
    pillZeichnen(g, txt, rechteKante == null ? x : rechteKante - b, y, p);
  }
  // Kleine Zahl-Pille oben rechts: wie viele Kanten gerastet wurden.
  function kantenPille(g, k, x, y, s, p) {
    const n = Number(k.e.zelle.gerastet) || 0;
    if (!punkteAn || !n) return;
    const txt = t('urt.gerastet', { n: n });
    g.font = '700 ' + Math.round(9 * p) + 'px Inter, system-ui, sans-serif';
    const b = g.measureText(txt).width + 8 * p;
    pillZeichnen(g, txt, x + s - b - 4 * p, y + 20 * p, p);
  }

  function kachelZeichnen(g, k, p) {
    const s = k.N * KAM.z;
    const x = dx(k.x), y = dy(k.y);
    if (x > vpBreite() || y > vpHoehe() || x + s < 0 || y + s < 0) return;
    const e = k.e;
    g.fillStyle = kachelGrund();
    g.fillRect(x, y, s, s);

    const na = nachAlpha();
    if (vglModus === 'ueberlagern') {
      const m = mischCanvas(e);
      if (m) {
        g.save();
        g.globalAlpha = na;
        g.imageSmoothingEnabled = true;
        g.drawImage(m, x, y, s, s);
        g.restore();
      }
      flaechenZeichnen(g, e, x, y, s);
      punkteZeichnen(g, e, x, y, s, k.N, p);
      const bb0 = pillZeichnen(g, t('pill.beide'), x + 4 * p, y + 4 * p, p);
      snapPille(g, x + 8 * p + bb0, y + 4 * p, p);
    } else {
      // Vorher/Nachher: links die Basis, rechts das Ergebnis, Griff dazwischen.
      const vor = bildVon(e, 'vor');
      bildZeichnen(g, vor, x, y, s);
      if (!vor) {
        g.fillStyle = textFarbe2();
        g.font = Math.round(9 * p) + 'px Inter, system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(t('diff.nuralt'), x + s / 2, y + s / 2);
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      }
      const w = Math.max(0, Math.min(s, s * wischPos));
      g.save();
      g.beginPath(); g.rect(x + w, y, s - w, s); g.clip();
      g.fillStyle = kachelGrund();
      g.fillRect(x + w, y, s - w, s);
      bildZeichnen(g, bildVon(e, 'neu'), x, y, s, na);
      flaechenZeichnen(g, e, x, y, s);
      g.restore();
      punkteZeichnen(g, e, x, y, s, k.N, p);
      // Griff
      g.save();
      g.strokeStyle = dunkel ? 'rgba(255,255,255,.9)' : 'rgba(20,20,30,.8)';
      g.lineWidth = p;
      g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w, y + s); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(x + w, y + s / 2, 6 * p, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,20,30,.35)'; g.stroke();
      g.restore();
      pillZeichnen(g, vorherPille(), x + 4 * p, y + 4 * p, p);
      g.font = '700 ' + Math.round(9 * p) + 'px Inter, system-ui, sans-serif';
      const bb = g.measureText(t('pill.nachher')).width + 8 * p;
      pillZeichnen(g, t('pill.nachher'), x + s - bb - 4 * p, y + 4 * p, p);
      snapPille(g, 0, y + 21 * p, p, x + s - 4 * p);
      kantenPille(g, k, x, y, s, p);
    }

    // Pixelraster ab 6 Gerätepixeln je Icon-Pixel, sehr dezent
    if (KAM.z >= 6) {
      g.save();
      g.strokeStyle = dunkel ? 'rgba(200,200,220,.08)' : 'rgba(40,40,60,.08)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < k.N; i++) {
        const gx = Math.round(x + i * KAM.z) + 0.5;
        const gy = Math.round(y + i * KAM.z) + 0.5;
        g.moveTo(gx, y); g.lineTo(gx, y + s);
        g.moveTo(x, gy); g.lineTo(x + s, gy);
      }
      g.stroke();
      g.restore();
    }
    g.strokeStyle = rahmenFarbe();
    g.lineWidth = p;
    g.strokeRect(x + p / 2, y + p / 2, s - p, s - p);
  }

  function zeichnen() {
    const cv = leinwand();
    if (!cv || !cv.getContext) return;
    const g = cv.getContext('2d');
    const p = dpr();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = grundFarbe();
    g.fillRect(0, 0, cv.width, cv.height);
    g.textBaseline = 'alphabetic';
    LAYOUT.forEach(k => {
      const x = dx(k.x - W_POLSTER), y = dy(k.y - W_POLSTER);
      const w = (k.breite + 2 * W_POLSTER) * KAM.z, h = (k.N + 2 * W_POLSTER) * KAM.z;
      if (x > cv.width || x + w < 0) return;
      g.strokeStyle = k.i === aktiveKarte ? akzent() : rahmenFarbe();
      g.lineWidth = p;
      rundRechteck(g, x + p / 2, y + p / 2, w - p, h - p, 8 * p);
      g.stroke();
      // Titel über der Karte, feste Schriftgröße in Gerätepixeln
      const ty = y - 5 * p;
      g.font = '700 ' + Math.round(11 * p) + 'px Inter, system-ui, sans-serif';
      g.fillStyle = textFarbe();
      const titel = zahl(k.N) + ' px';
      g.fillText(titel, x, ty);
      const tb = g.measureText(titel).width;
      k.titelFeld = { x: x - 4 * p, y: ty - 13 * p, w: tb + 8 * p, h: 18 * p };
      let tx = x + tb + 6 * p;
      const ok = massStimmt(k.e.zelle);
      if (ok != null) {
        g.fillStyle = ok ? '#12a76a' : '#c98a12';
        g.beginPath(); g.arc(tx + 3 * p, ty - 3.5 * p, 3 * p, 0, Math.PI * 2); g.fill();
        tx += 10 * p;
      }
      const d = deltaText(k.e.aaVor, k.e.aaNeu);
      if (d) {
        g.font = '700 ' + Math.round(9.5 * p) + 'px Inter, system-ui, sans-serif';
        g.fillStyle = d.charAt(0) === '−' ? '#12a76a' : '#c98a12';
        g.fillText(d, tx, ty);
      }
      kachelZeichnen(g, k, p);
    });
    if (blendeStart) anstossen(false);
  }

  // ---- Hit-Test und Hover --------------------------------------------------
  function titelUnter(devX, devY) {
    for (const k of LAYOUT) {
      const f = k.titelFeld;
      if (f && devX >= f.x && devY >= f.y && devX < f.x + f.w && devY < f.y + f.h) return k;
    }
    return null;
  }
  function kachelUnter(devX, devY) {
    const wx = weltX(devX), wy = weltY(devY);
    for (const k of LAYOUT) {
      if (wx >= k.x && wy >= k.y && wx < k.x + k.N && wy < k.y + k.N) {
        return { k: k, lx: wx - k.x, ly: wy - k.y,
          px: Math.floor(wx - k.x), py: Math.floor(wy - k.y) };
      }
    }
    return null;
  }
  // Nächster verschobener Punkt unter dem Zeiger (in Icon-Pixeln gemessen).
  function paarUnter(tr) {
    if (!punkteAn || !tr) return null;
    const grenze = Math.max(0.35, 8 / Math.max(1, KAM.z));
    let best = null, bestD = grenze;
    (tr.k.e.paare || []).forEach(pa => {
      const d = Math.sqrt((tr.lx - pa.bx) * (tr.lx - pa.bx) + (tr.ly - pa.by) * (tr.ly - pa.by));
      if (d < bestD) { bestD = d; best = pa; }
    });
    return best;
  }
  function griffNah(devX, devY) {
    if (vglModus !== 'vn') return null;
    for (const k of LAYOUT) {
      const s = k.N * KAM.z;
      const x = dx(k.x), y = dy(k.y);
      if (devY < y || devY > y + s) continue;
      if (Math.abs(devX - (x + s * wischPos)) <= 12 * dpr()) return k;
    }
    return null;
  }
  function hoverSetzen(treffer) {
    const alt = HOVER && HOVER.paar;
    HOVER = treffer;
    if ((treffer && treffer.paar) !== alt) anstossen(false);
    const tip = $('vpTip');
    if (treffer && treffer.text) {
      tip.hidden = false;
      tip.textContent = treffer.text;
      const box = $('buehne').getBoundingClientRect();
      tip.style.left = Math.max(4, Math.min(box.width - 10, treffer.cssX + 12)) + 'px';
      tip.style.top = Math.max(4, treffer.cssY + 14) + 'px';
    } else tip.hidden = true;
  }

  // ---- Bühne aufbauen ------------------------------------------------------
  function zoomPilleSetzen() {
    $('zoomWertAnzeige').textContent = Math.round(ZIEL.z * 100) + ' %';
  }

  // Kamera-Reset nur, wenn wirklich etwas anderes zu sehen ist.
  function fitSignatur() {
    if (!letzterDiff) return '';
    return (letzterDiff.name || '') + '|' + (letzterDiff.zellen || []).map(c => c.N).join(',');
  }
  async function renderKarten() {
    if (!letzterDiff) return;
    const A = await analyseHolen();
    urteilZeichnen(A);
    kennzahlenZeichnen(A);
    hintingZeichnen(A);
    layoutRechnen(A);
    leinwandMessen();
    const fsig = fitSignatur();
    if (fitQuelle !== fsig) { fitQuelle = fsig; zoomFit(false); }
    else { klemmen(ZIEL); kameraSetzen(ZIEL.x, ZIEL.y, ZIEL.z, false); }
    kopfZeichnen();
    anstossen(false);
  }

  // ---- Werkzeuge und Zeilen ------------------------------------------------
  function reglerZeichnen() {
    // Der Regler ist sichtbar, sobald es eine Vergleichsbasis gibt (§39.5).
    const basis = !!basisAktiv();
    const zeile = $('scrubberZeile');
    zeile.hidden = !basis;
    $('scrubberLabel').textContent = vglModus === 'ueberlagern' ? t('v.gewichtung') : t('v.scrubber');
    const wert100 = vglModus === 'ueberlagern' ? blend : Math.round(wischPos * 100);
    wert($('blendRegler'), wert100);
  }
  function kopfZeichnen() {
    $('diff').classList.add('an');
    $('diff').classList.toggle('dunkel', dunkel);
    MODI.forEach(m => $('diff').classList.toggle('modus-' + m, vglModus === m));
    try { $('segModus').setAttribute('value', vglModus); } catch (e) {}
    try { $('segDarstellung').setAttribute('value', darstellung); } catch (e) {}
    try { $('segBasis').setAttribute('value', vglBasis); } catch (e) {}
    $('basisZeile').hidden = !(diffHatOhne() && nachQuelle() === 'neu');
    $('btnRetina').hidden = darstellung !== 'pixel';
    $('btnRetina').classList.toggle('an', retina);
    anhaken($('chkPunkte'), punkteAn);
    anhaken($('chkFlaechen'), flaechenAn);
    reglerZeichnen();
    legendeZeichnen();
    zoomPilleSetzen();
  }
  function renderDiff() {
    if (!letzterDiff) return;
    kopfZeichnen();
    renderKarten();
  }

  // ---- Pixel-Snapping live umschalten -------------------------------------
  // Liegt die ungesnappte Fassung im Diff, tauscht der Schalter nur die
  // Nachher-Quelle: keine neue Vorschau, keine Kamera-Bewegung. Fehlt sie
  // (Vorschau wurde ohne Snapping erzeugt), wird sie einmal nachgefordert.
  function snapUmschalten(an) {
    snapAn = !!an;
    if (!letzterDiff || !$('diff').classList.contains('an')) return false;
    if (!diffHatOhne()) {
      if (!snapAn || !hatAuswahl || beschaeftigt) return false;
      $('fazit').className = 'fazit';
      sperren(true);
      send({ type: 'vorschau', snap: true });
      return true;
    }
    blendeStart = Date.now();
    kopfZeichnen();
    renderKarten();
    return true;
  }
  bei('einstellungen', m => { if (m && typeof m.snap === 'boolean') snapAn = m.snap; });

  // Vektor ist der Standard; Pixel zeigt die echte Rasterung (mit Retina 2×).
  function darstellungSetzen(v, melden) {
    const neu = v === 'pixel' ? 'pixel' : 'vektor';
    if (neu === darstellung) { kopfZeichnen(); return; }
    darstellung = neu;
    kopfZeichnen();
    if (letzterDiff) renderKarten(); else anstossen(false);
    if (melden) send({ type: 'merkerSetzen', schluessel: 'darstellung', wert: darstellung });
  }
  function modusSetzen(m, melden) {
    if (MODI.indexOf(m) < 0 || m === vglModus) return;
    vglModus = m;
    kopfZeichnen();
    if (letzterDiff) renderKarten();
    if (melden) send({ type: 'merkerSetzen', schluessel: 'vergleichsmodus', wert: vglModus });
  }
  function basisSetzen(b, melden) {
    const neu = b === 'alt' ? 'alt' : 'ohne';
    if (neu === vglBasis) return;
    vglBasis = neu;
    kopfZeichnen();
    if (letzterDiff) renderKarten();
    if (melden) send({ type: 'merkerSetzen', schluessel: 'vglBasis', wert: vglBasis });
  }
  bei('merker', m => {
    if (!m) return;
    if (m.schluessel === 'vergleichsmodus' && MODI.indexOf(m.wert) >= 0) {
      vglModus = m.wert;
      kopfZeichnen();
      if (letzterDiff) renderKarten();
    }
    if (m.schluessel === 'vglBasis' && (m.wert === 'ohne' || m.wert === 'alt')) {
      vglBasis = m.wert;
      kopfZeichnen();
      if (letzterDiff) renderKarten();
    }
    if (m.schluessel === 'buehneHoehe' && Number(m.wert) > 0) {
      hoeheSetzen(Number(m.wert));
    }
    if (m.schluessel === 'darstellung' && (m.wert === 'pixel' || m.wert === 'vektor')) {
      darstellungSetzen(m.wert, false);
    }
    if (m.schluessel === 'retina') {
      retina = !!m.wert;
      kopfZeichnen();
      if (letzterDiff) renderKarten();
    }
  });
  send({ type: 'merkerLaden', schluessel: 'vergleichsmodus' });
  send({ type: 'merkerLaden', schluessel: 'vglBasis' });
  send({ type: 'merkerLaden', schluessel: 'buehneHoehe' });
  send({ type: 'merkerLaden', schluessel: 'darstellung' });
  send({ type: 'merkerLaden', schluessel: 'retina' });

  function hoeheSetzen(h, melden) {
    buehneHoehe = Math.max(200, Math.min(600, Math.round(h)));
    const el = $('buehne');
    el.style.height = buehneHoehe + 'px';
    el.style.flex = 'none';
    if (leinwandMessen()) { klemmen(ZIEL); anstossen(false); }
    if (melden) send({ type: 'merkerSetzen', schluessel: 'buehneHoehe', wert: buehneHoehe });
  }
  // Die Bühne misst sich selbst nach, wenn das Panel sie wachsen lässt.
  if (typeof ResizeObserver === 'function') {
    try {
      new ResizeObserver(() => {
        if (!letzterDiff) return;
        if (leinwandMessen()) { klemmen(ZIEL); anstossen(false); }
      }).observe($('buehne'));
    } catch (e) {}
  }

  // ---- Bedienung -----------------------------------------------------------
  $('segModus').addEventListener('change', e => {
    modusSetzen(String((e && e.detail) || $('segModus').value || 'vn'), true);
  });
  $('segDarstellung').addEventListener('change', e => {
    const v = String((e && e.detail) || $('segDarstellung').value || 'vektor');
    if (v === darstellung) return;
    darstellungSetzen(v, true);
  });
  $('segBasis').addEventListener('change', e => {
    basisSetzen(String((e && e.detail) || $('segBasis').value || 'ohne'), true);
  });
  $('btnRetina').addEventListener('click', () => {
    retina = !retina;
    send({ type: 'merkerSetzen', schluessel: 'retina', wert: retina });
    kopfZeichnen();
    if (letzterDiff) renderKarten();
  });
  $('chkPunkte').addEventListener('change', e => {
    punkteAn = !!e.target.checked;
    legendeZeichnen();
    if (letzterDiff) kennzahlenZeichnen(ANA);
    anstossen(false);
  });
  $('chkFlaechen').addEventListener('change', e => {
    flaechenAn = !!e.target.checked;
    legendeZeichnen();
    anstossen(false);
  });
  // Ein Regler, zwei Bedeutungen: Wischposition bzw. Gewichtung.
  const reglerNehmen = e => {
    const v = Number((e && e.target && e.target.value) != null ? e.target.value : $('blendRegler').value);
    if (!isFinite(v)) return;
    if (vglModus === 'ueberlagern') { blend = v; } else { wischPos = Math.max(0, Math.min(1, v / 100)); }
    anstossen(false);
  };
  $('blendRegler').addEventListener('input', reglerNehmen);
  $('blendRegler').addEventListener('change', reglerNehmen);
  $('btnGrund').addEventListener('click', () => {
    dunkel = !dunkel;
    if (letzterDiff) renderDiff(); else kopfZeichnen();
  });
  $('zoomMinus').addEventListener('click', () => zoomMitte(stufeNehmen(-1), true));
  $('zoomPlus').addEventListener('click', () => zoomMitte(stufeNehmen(1), true));
  $('zoomFit').addEventListener('click', () => zoomFit(true));
  $('zoomWertAnzeige').addEventListener('click', () => {
    const m = $('zoomMenu');
    m.hidden = !m.hidden;
  });
  $('zoomMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-zoom]');
    if (!b) return;
    $('zoomMenu').hidden = true;
    const v = b.getAttribute('data-zoom');
    if (v === 'fit') zoomFit(true); else zoomMitte(Number(v), true);
  });
  document.addEventListener('click', e => {
    if (!$('zoomPille').contains(e.target)) $('zoomMenu').hidden = true;
  }, true);

  // „⋯“ öffnet die beiden Schalter als fig-popup an seinem Knopf.
  function mehrMenuSetzen(auf) {
    const m = $('mehrMenu');
    try { m.open = auf; } catch (e) { if (auf) m.setAttribute('open', 'true'); else m.removeAttribute('open'); }
  }
  $('btnMehr').addEventListener('click', e => {
    e.stopPropagation();
    mehrMenuSetzen(!$('mehrMenu').open);
  });
  document.addEventListener('click', e => {
    if ($('mehrMenu').open && !$('mehrMenu').contains(e.target) && e.target !== $('btnMehr')) mehrMenuSetzen(false);
  }, true);

  // Höhengriff: 200–600 px, Merker `buehneHoehe`.
  (() => {
    const griff = $('bhGriff');
    let zieh = false, startY = 0, startH = 0;
    griff.addEventListener('pointerdown', e => {
      zieh = true; startY = e.clientY; startH = buehneHoehe;
      griff.setPointerCapture(e.pointerId); e.preventDefault();
    });
    griff.addEventListener('pointermove', e => {
      if (!zieh) return;
      hoeheSetzen(startH + (e.clientY - startY));
    });
    const ende = e => {
      if (!zieh) return;
      zieh = false;
      try { griff.releasePointerCapture(e.pointerId); } catch (err) {}
      hoeheSetzen(buehneHoehe, true);
    };
    griff.addEventListener('pointerup', ende);
    griff.addEventListener('pointercancel', ende);
  })();

  // Tastatur: nur wenn der Fokus NICHT in einem Eingabefeld steht.
  function inEingabe() {
    let el = document.activeElement;
    while (el) {
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (tag.indexOf('fig-input') === 0 || tag === 'fig-dropdown') return true;
      if (el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }
  document.addEventListener('keydown', e => {
    if (inEingabe() || !letzterDiff || !$('diff').classList.contains('an')) return;
    if (e.shiftKey && e.key === ')') { e.preventDefault(); zoomMitte(1, true); return; }   // Shift+0
    if (e.shiftKey && (e.key === '0' || e.code === 'Digit0')) { e.preventDefault(); zoomMitte(1, true); return; }
    if (e.shiftKey && (e.key === '!' || e.code === 'Digit1')) { e.preventDefault(); zoomFit(true); return; }
    if (e.shiftKey && (e.key === '@' || e.code === 'Digit2')) { e.preventDefault(); aufKarteZoomen(aktiveKarte, true); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomMitte(stufeNehmen(1), true); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomMitte(stufeNehmen(-1), true); }
    else if (e.key === '0') { e.preventDefault(); zoomFit(true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); karteMittig(aktiveKarte + 1, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); karteMittig(aktiveKarte - 1, true); }
    else if (e.key === ' ' && !raumTaste) { e.preventDefault(); raumTaste = true; $('buehne').classList.add('raum'); }
  });
  document.addEventListener('keyup', e => {
    if (e.key !== ' ' || !raumTaste) return;
    raumTaste = false;
    $('buehne').classList.remove('raum');
  });

  // Viewport-Gesten: Wheel = Pan, Ctrl/Cmd+Wheel und Pinch = Zoom um den
  // Cursor (stufenlos, exponentiell), Drag/Leertaste/Mittelklick = Pan.
  (() => {
    const box = $('buehne');
    const cv = leinwand();
    const devPos = e => {
      const r = box.getBoundingClientRect();
      const p = dpr();
      return { x: (e.clientX - r.left) * p, y: (e.clientY - r.top) * p,
        cssX: e.clientX - r.left, cssY: e.clientY - r.top };
    };
    box.addEventListener('wheel', e => {
      if (!letzterDiff) return;
      e.preventDefault();
      const d = devPos(e);
      if (e.ctrlKey || e.metaKey) {
        zoomUm(d.x, d.y, ZIEL.z * Math.exp(-e.deltaY * 0.0125), false);
      } else {
        kameraSetzen(ZIEL.x + e.deltaX * dpr() / ZIEL.z, ZIEL.y + e.deltaY * dpr() / ZIEL.z, ZIEL.z, false);
      }
    }, { passive: false });

    let px = 0, py = 0, kx = 0, ky = 0, wischK = null;
    box.addEventListener('pointerdown', e => {
      if (e.target.closest('fig-button, .ovl, .bhgriff')) return;
      const d = devPos(e);
      const g = griffNah(d.x, d.y);
      if (g && !raumTaste && e.button === 0) {
        wischZieht = true; wischK = g;
        box.setPointerCapture(e.pointerId);
        return;
      }
      zieht = true;
      px = e.clientX; py = e.clientY; kx = ZIEL.x; ky = ZIEL.y;
      box.classList.add('zieht');
      box.setPointerCapture(e.pointerId);
      const tk = titelUnter(d.x, d.y);
      if (tk) { karteMittig(tk.i, true); e.preventDefault(); return; }
      const tr = kachelUnter(d.x, d.y);
      if (tr) { aktiveKarte = tr.k.i; anstossen(false); }
      e.preventDefault();
    });
    box.addEventListener('pointermove', e => {
      const d = devPos(e);
      if (wischZieht && wischK) {
        const s = wischK.N * KAM.z, x = dx(wischK.x);
        wischPos = Math.max(0, Math.min(1, (d.x - x) / Math.max(1, s)));
        anstossen(false);
        return;
      }
      if (zieht) {
        const p = dpr();
        kameraSetzen(kx - (e.clientX - px) * p / ZIEL.z, ky - (e.clientY - py) * p / ZIEL.z, ZIEL.z, false);
        return;
      }
      // Hover mit 60 ms Verzögerung
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        const tr = kachelUnter(d.x, d.y);
        if (!tr) { hoverSetzen(null); return; }
        const paar = paarUnter(tr);
        const text = paar ? punktText(paar) : t('px.koord', { x: tr.px, y: tr.py });
        hoverSetzen({ paar: paar, text: text, cssX: d.cssX, cssY: d.cssY });
      }, 60);
    });
    const ende = e => {
      if (zieht) { zieht = false; box.classList.remove('zieht'); }
      // Der Regler unter der Bühne zeigt dieselbe Position — einmal am Ende
      // nachziehen, nicht bei jedem Frame (sonst Attribut-Gewitter).
      if (wischZieht && vglModus !== 'ueberlagern') wert($('blendRegler'), Math.round(wischPos * 100));
      wischZieht = false; wischK = null;
      try { box.releasePointerCapture(e.pointerId); } catch (err) {}
    };
    box.addEventListener('pointerup', ende);
    box.addEventListener('pointercancel', ende);
    box.addEventListener('pointerleave', () => { hoverSetzen(null); });
    box.addEventListener('dblclick', e => {
      const d = devPos(e);
      const tr = kachelUnter(d.x, d.y);
      if (!tr) { zoomFit(true); return; }
      aufKarteZoomen(tr.k.i, true);
    });
    window.addEventListener('resize', () => {
      if (!letzterDiff) return;
      if (leinwandMessen()) { klemmen(ZIEL); anstossen(false); }
    });
    if (cv) cv.addEventListener('contextmenu', e => e.preventDefault());
  })();
