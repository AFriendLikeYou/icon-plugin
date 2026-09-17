  // =========================================================================
  // Vorschau (§33) — Urteil, Canvas-Bühne, Kennzahlen, Details
  // -------------------------------------------------------------------------
  // Die Bühne ist ein echter Viewport wie Figmas Canvas: EIN <canvas> in
  // Bühnengröße × devicePixelRatio, eigene Kamera {x, y, z}, alles wird je
  // Frame gezeichnet. Kein DOM-Reflow beim Zoomen, nie unscharf: die
  // Pixelansicht zeichnet das 1×-PNG ohne Glättung (echte Rasterung), die
  // Vektoransicht eine hochaufgelöste SVG-Bitmap mit Glättung.
  // Weltkoordinaten = Icon-Pixel; z = Gerätepixel je Icon-Pixel (100 % = 1).
  // =========================================================================

  const ZOOM_STUFEN = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  const Z_MIN = 1, Z_MAX = 64;
  const MODI = ['neben', 'wischen', 'ueberlagern'];
  // Modi mit nur einer Kachel je Karte
  function einKachelModus() { return vglModus === 'wischen' || vglModus === 'ueberlagern'; }
  const W_LUECKE = 4;        // Weltabstand zwischen Vorher- und Nachher-Kachel
  const W_KARTE = 12;        // Weltabstand zwischen den Größenkarten
  const W_POLSTER = 3;       // Kartenrahmen um die Kacheln
  const VEK_AUFL = 16;       // Auflösungsfaktor der Vektor-Bitmaps
  const SICHT_MIN = 64;      // so viel Inhalt bleibt immer im Viewport (Gerätepixel)

  let vglModus = 'neben';
  let darstellung = 'vektor';          // pixel | vektor — Vektor ist Standard
  let retina = false;                  // Pixel-Darstellung: 1×-PNG (aus) oder 2×-PNG (an)
  let wischPos = 0.5;
  let markieren = true;
  let verbesserung = false, blend = 100;
  let aktiveKarte = 0;
  let raumTaste = false, zieht = false, wischZieht = false;
  let buehneHoehe = 320;
  // Kamera: KAM wird gezeichnet, ZIEL ist das Ziel (Lerp bei Buttons/Tasten).
  const KAM = { x: 0, y: 0, z: 6 };
  const ZIEL = { x: 0, y: 0, z: 6 };
  let sanft = false, malGeplant = false, fitQuelle = null;
  let LAYOUT = [], WELT = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let HOVER = null, hoverTimer = null;
  // Cache-Marken: Modus-, Zoom- und Filterwechsel dürfen die PNGs NICHT neu
  // analysieren — die Zellanalyse hängt nur an Diff und Hintergrund.
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
  // Vektor-Bitmap: einmal je Zelle in Bühnenauflösung rastern, danach nur noch
  // skalieren (mit Glättung) — so bleibt die Geometrie bei jedem Zoom glatt.
  function svgCanvas(svg, farbe, N) {
    return new Promise(fertig => {
      let erledigt = false;
      // Ein hängendes Bild darf die Vorschau nie blockieren: nach 2 s ohne
      // Antwort fällt die Kachel auf die Pixelfassung zurück.
      const schluss = w => { if (erledigt) return; erledigt = true; fertig(w); };
      setTimeout(() => schluss(null), 2000);
      const img = new Image();
      const s = Math.max(64, N * VEK_AUFL);
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

  // ---- Änderungsregionen ---------------------------------------------------
  // |alpha_alt − alpha_neu| > 24 ergibt eine Maske auf dem 1×-Raster;
  // zusammenhängende Bereiche (8er-Nachbarschaft) werden zu Regionen. Regionen
  // unter 2 Pixeln fallen weg, höchstens 20 je Kachel — sonst wäre die Kachel
  // ein Gitter; bei mehr bleiben die größten.
  const MARK_SCHWELLE = 24, MARK_MIN = 2, MARK_MAX = 20;
  function regionenFinden(A, B) {
    const w = Math.min(A.w, B.w), h = Math.min(A.h, B.h);
    const maske = new Uint8Array(w * h);
    let treffer = 0, weg = 0, dazu = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = A.data[((y * A.w) + x) * 4 + 3];
      const b = B.data[((y * B.w) + x) * 4 + 3];
      if (Math.abs(a - b) > MARK_SCHWELLE) {
        maske[y * w + x] = 1; treffer++;
        if (a > b) weg++; else dazu++;
      }
    }
    if (!treffer) return { regionen: [], pixel: 0, weg: 0, dazu: 0 };
    const regionen = [], stapel = [];
    for (let s = 0; s < maske.length; s++) {
      if (maske[s] !== 1) continue;
      let x0 = s % w, x1 = x0, y0 = (s - x0) / w, y1 = y0, n = 0;
      let sAlt = 0, sNeu = 0, mxAlt = 0, myAlt = 0, mxNeu = 0, myNeu = 0;
      maske[s] = 2; stapel.push(s);
      while (stapel.length) {
        const p = stapel.pop();
        const px = p % w, py = (p - px) / w;
        n++;
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
        const a = A.data[((py * A.w) + px) * 4 + 3];
        const b = B.data[((py * B.w) + px) * 4 + 3];
        sAlt += a; sNeu += b;
        mxAlt += a * (px + 0.5); myAlt += a * (py + 0.5);
        mxNeu += b * (px + 0.5); myNeu += b * (py + 0.5);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (maske[q] === 1) { maske[q] = 2; stapel.push(q); }
        }
      }
      if (n < MARK_MIN) continue;
      regionen.push({
        x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n: n,
        flAlt: sAlt / 255, flNeu: sNeu / 255,
        dx: (sAlt > 0 && sNeu > 0) ? (mxNeu / sNeu - mxAlt / sAlt) : 0,
        dy: (sAlt > 0 && sNeu > 0) ? (myNeu / sNeu - myAlt / sAlt) : 0
      });
    }
    regionen.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    return { regionen: regionen.slice(0, MARK_MAX), pixel: treffer, weg: weg, dazu: dazu };
  }
  // Heuristik für den Hover-Text: schmale, langgestreckte Regionen sind
  // gerasterte Kanten; der Weg kommt aus dem Schwerpunkt alt → neu.
  function regionText(r) {
    const schmal = Math.min(r.w, r.h) <= 2 && Math.max(r.w, r.h) >= 3 * Math.min(r.w, r.h);
    if (!schmal) {
      const d = Math.round((r.flNeu - r.flAlt) * 100) / 100;
      return t('reg.form', { d: zahl(Math.abs(d).toFixed(2)) });
    }
    const waag = Math.abs(r.dx) >= Math.abs(r.dy);
    const weg = Math.round(Math.abs(waag ? r.dx : r.dy) * 4) / 4 || 0.5;
    const richtung = waag ? t(r.dx >= 0 ? 'reg.rechts' : 'reg.links')
                          : t(r.dy >= 0 ? 'reg.unten' : 'reg.oben');
    return t('reg.kante', { d: zahl(weg.toFixed(2)), richtung: richtung });
  }

  // ---- Analyse je Zelle (einmal je Diff und Hintergrund) -------------------
  function gueteNeu(c) {
    const g = c.guete;
    if (!g) return null;
    return g.mitSnap ? g.snap : g.plain;
  }
  // „vorher“ = Werte der Alt-Variante. Der Rasterfehler der Alt-Variante wird
  // nicht gemessen; wenn ihn der Hauptthread doch mitschickt, zeigen wir ihn.
  function fehlerAltVon(c) {
    const g = c.gueteAlt;
    return g && isFinite(g.fehler) ? g.fehler : null;
  }
  async function analyseHolen() {
    const sig = (dunkel ? 'd' : 'h') + (retina ? '2' : '1');
    if (anaQuelle === letzterDiff && anaSig === sig) return ANA;
    anaQuelle = letzterDiff; anaSig = sig;
    ANA = [];
    for (const c of (letzterDiff ? letzterDiff.zellen : [])) {
      const e = { N: c.N, zelle: c, bildAlt: null, bildNeu: null, vekAlt: null, vekNeu: null,
        aaAlt: null, aaNeu: null, regionen: [], andersPixel: 0, weg: 0, dazu: 0,
        misch: null, mischSig: '', dlay: null, dlaySig: '' };
      // Retina zeigt die 2×-Rasterung, sonst die echte 1×-Rasterung.
      const qNeu = retina && c.pngNeu2 ? c.pngNeu2 : c.pngNeu;
      const qAlt = retina && c.pngAlt2 ? c.pngAlt2 : c.pngAlt;
      if (qNeu) { const r = await analysiere(qNeu, false, dunkel); e.bildNeu = r.c; e.aaNeu = r.aa; }
      if (qAlt) { const r = await analysiere(qAlt, false, dunkel); e.bildAlt = r.c; e.aaAlt = r.aa; }
      if (c.neu) e.vekNeu = await svgCanvas(c.neu, umrissFarbe(), c.N);
      if (c.alt) e.vekAlt = await svgCanvas(c.alt, umrissFarbe(), c.N);
      if (c.pngAlt && c.pngNeu) {
        const A = await bitmapDaten(c.pngAlt);
        const B = await bitmapDaten(c.pngNeu);
        const d = regionenFinden(A, B);
        e.regionen = d.regionen; e.andersPixel = d.pixel;
        e.weg = d.weg; e.dazu = d.dazu;
      }
      const g = gueteNeu(c);
      e.fehlerNeu = g && isFinite(g.fehler) ? g.fehler : null;
      e.fehlerAlt = fehlerAltVon(c);
      if (e.aaNeu == null && g) e.aaNeu = g.aa;
      ANA.push(e);
    }
    return ANA;
  }
  function bildVon(e, welche) {
    if (darstellung === 'vektor') {
      const v = welche === 'alt' ? e.vekAlt : e.vekNeu;
      if (v) return v;
    }
    return welche === 'alt' ? e.bildAlt : e.bildNeu;
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
  function fehlerText(v) { return v == null ? null : fmt('fehler', v); }
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
    if (!A.length) { zeile.className = 'urteilzeile'; txt.textContent = ''; return; }
    let aaAltS = 0, aaAltN = 0, aaNeuS = 0, aaNeuN = 0;
    let feAltS = 0, feAltN = 0, feNeuS = 0, feNeuN = 0;
    let massOk = 0, massGes = 0, gerastet = 0, mitAlt = 0;
    A.forEach(e => {
      if (e.aaAlt != null) { aaAltS += e.aaAlt; aaAltN++; }
      if (e.aaNeu != null) { aaNeuS += e.aaNeu; aaNeuN++; }
      if (e.fehlerAlt != null) { feAltS += e.fehlerAlt; feAltN++; }
      if (e.fehlerNeu != null) { feNeuS += e.fehlerNeu; feNeuN++; }
      const ok = massStimmt(e.zelle);
      if (ok != null) { massGes++; if (ok) massOk++; }
      gerastet += Number(e.zelle.gerastet) || 0;
      if (e.bildAlt) mitAlt++;
    });
    const aaAlt = aaAltN ? Math.round(aaAltS / aaAltN) : null;
    const aaNeu = aaNeuN ? Math.round(aaNeuS / aaNeuN) : null;
    const feAlt = feAltN ? feAltS / feAltN : null;
    const feNeu = feNeuN ? feNeuS / feNeuN : null;
    const massAlle = massGes > 0 && massOk === massGes;

    // Ein Satz in Klartext; bei Gleichstand keine zwei gleichen Zahlen.
    let art = 'neutral';
    if (!mitAlt) {
      txt.textContent = t('urt.neu');
    } else if (aaAlt != null && aaNeu != null && aaNeu < aaAlt - 0.5) {
      txt.textContent = t('urt.besser', { alt: fmt('prozent', aaAlt), neu: fmt('prozent', aaNeu) });
      art = 'gut';
    } else if (aaAlt != null && aaNeu != null && aaNeu > aaAlt + 0.5) {
      txt.textContent = t('urt.schlechter', { alt: fmt('prozent', aaAlt), neu: fmt('prozent', aaNeu) });
      art = 'warn';
    } else {
      txt.textContent = t('urt.gleich', { neu: aaNeu == null ? fmt('fehler', feNeu) : fmt('prozent', aaNeu) });
    }
    if (massGes && !massAlle) art = 'warn';
    zeile.className = 'urteilzeile ' + art;

    // Höchstens zwei kurze Pills: erst das Delta, dann Maß bzw. gerastete Kanten.
    const d = mitAlt ? fmtDelta(aaAlt, aaNeu) : null;
    const kandidaten = [];
    if (d) kandidaten.push([d, d.charAt(0) === '−' ? 'gut' : 'warn']);
    if (massGes) kandidaten.push([
      t('urt.mass', { n: massOk, m: massGes }) + (massAlle ? ' ✓' : ' △'), massAlle ? 'gut' : 'warn']);
    if (gerastet) kandidaten.push([t('urt.gerastet', { n: gerastet }), '']);
    if (!kandidaten.length && feNeu != null) kandidaten.push([t('urt.fehler', { v: fmt('fehler', feNeu) }), '']);
    kandidaten.slice(0, 2).forEach(k => pillen.appendChild(pille(k[0], k[1])));
  }

  // Legende: drei Farbfelder — in jedem Modus dieselbe Zuordnung.
  function legendeZeichnen() {
    const box = $('vLegende');
    box.textContent = '';
    [['weg', t('leg.weg')], ['dazu', t('leg.dazu')], ['beide', t('leg.beide')]].forEach(x => {
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
        wert: e => fmtVgl('fehler', e.fehlerAlt, e.fehlerNeu) },
      { label: t('fuss.aa'), tip: t('ber.tipAa'),
        wert: e => fmtVgl('prozent', e.aaAlt, e.aaNeu) },
      { label: t('fuss.keyline'), tip: t('ber.tipMass'), wert: e => {
        const c = e.zelle, ok = massStimmt(c);
        return c.soll == null ? t('ber.keineDaten')
          : fmt('mass', c.ist) + ' / ' + zahl(c.soll) + (ok == null ? '' : ok ? ' ✓' : ' △');
      } }
    ];
    // Im Überlagern-Modus zählt zusätzlich, wie viele Pixel sich geändert haben.
    if (vglModus === 'ueberlagern') zeilen.push({
      label: t('fuss.veraendert'), tip: t('tip.veraendert'),
      wert: e => e.andersPixel ? t('fuss.veraendertWert',
        { n: e.andersPixel, weg: e.weg || 0, dazu: e.dazu || 0 }) : t('ber.keineDaten') });
    zeilen.forEach(z => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'kzlabel';
      const tt = document.createElement('fig-tooltip');
      tt.setAttribute('text', z.tip);
      tt.setAttribute('delay', '400');
      const s = document.createElement('span');
      s.textContent = z.label;
      tt.appendChild(s);
      td.appendChild(tt);
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
  function layoutRechnen(A) {
    LAYOUT = [];
    let x = 0, maxN = 1;
    A.forEach((e, i) => {
      const N = e.N || 1;
      if (N > maxN) maxN = N;
      const breite = einKachelModus() ? N : 2 * N + W_LUECKE;
      LAYOUT.push({ e: e, i: i, N: N, x: x, y: -N / 2, breite: breite });
      x += breite + W_KARTE;
    });
    const rand = W_POLSTER + 1;
    WELT = { x0: -rand, y0: -maxN / 2 - rand, x1: Math.max(0, x - W_KARTE) + rand, y1: maxN / 2 + rand };
  }
  function kacheln(k) {
    if (vglModus === 'ueberlagern') return [{ x: k.x, y: k.y, welche: 'misch' }];
    if (vglModus === 'wischen') return [{ x: k.x, y: k.y, welche: 'wisch' }];
    return [{ x: k.x, y: k.y, welche: 'alt' }, { x: k.x + k.N + W_LUECKE, y: k.y, welche: 'neu' }];
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
    zoom = KAM.z;
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
    const rand = 14 * dpr(), obenRaum = 18 * dpr();
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
    const rand = 16 * dpr(), obenRaum = 18 * dpr();
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
    return b;
  }
  // ---- Überlagern: farbige Onionskin ---------------------------------------
  // Deckung neutral, Unterschiede farbig. Je Pixel aus den Alphawerten:
  // gemeinsam = min(alt, neu) → Grau, nur alt → Orange, nur neu → Akzentblau,
  // Teildeckung mischt proportional. Der Überblend-Regler gewichtet die beiden
  // Differenzanteile (0 % = nur Vorher, 100 % = nur Nachher).
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
  function mischCanvas(e) {
    // Auflösung: Pixelansicht zeigt die echte Rasterung (N), die Vektoransicht
    // rastert feiner (N × 8). Der Regler wirkt in 5-%-Stufen, damit das Ziehen
    // nicht jedes Bild neu rechnet.
    const R = bildAufl(e.N);
    const stufe = Math.round(blend / 5) * 5;
    const sig = darstellung + '|' + R + '|' + stufe + '|' + (dunkel ? 'd' : 'h');
    if (e.mischSig === sig && e.misch) return e.misch;
    const qAlt = darstellung === 'vektor' ? (e.vekAlt || e.bildAlt) : e.bildAlt;
    const qNeu = darstellung === 'vektor' ? (e.vekNeu || e.bildNeu) : e.bildNeu;
    if (!qNeu && !qAlt) return null;
    const A = qAlt ? alphaFeld(qAlt, R) : null;
    const B = qNeu ? alphaFeld(qNeu, R) : null;
    const c = document.createElement('canvas');
    c.width = R; c.height = R;
    const g = c.getContext('2d');
    const bild = g.createImageData(R, R);
    const d = bild.data;
    const grau = dunkel ? MISCH_GRAU.dunkel : MISCH_GRAU.hell;
    const weg = dunkel ? MISCH_WEG.dunkel : MISCH_WEG.hell;
    const dazu = akzentRgb();
    const gNeu = stufe / 100, gAlt = 1 - gNeu;
    // Ohne Alt-Variante gibt es nichts zu vergleichen: alles neutral.
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
      const nurA = Math.max(0, a - b) * gAlt;
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

  function bildZeichnen(g, bild, x, y, s, alpha) {
    if (!bild) return;
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.imageSmoothingEnabled = darstellung === 'vektor';
    g.drawImage(bild, x, y, s, s);
    g.restore();
  }
  function markenAn() { return markieren && vglModus !== 'ueberlagern'; }
  // Differenz-Layer über der Nachher-Kachel: entfernte Bereiche orange,
  // hinzugekommene blau, je 70 % Deckung. In der Vektor-Darstellung aus den
  // hochauflösenden SVG-Bitmaps gerechnet (glatte Konturen), sonst aus den
  // PNGs. Gecacht je Zelle über eine Signatur.
  function diffLayer(e) {
    const R = bildAufl(e.N);
    const sig = darstellung + '|' + R + '|' + (dunkel ? 'd' : 'h');
    if (e.dlaySig === sig && e.dlay !== undefined) return e.dlay;
    e.dlaySig = sig; e.dlay = null;
    const qAlt = darstellung === 'vektor' ? (e.vekAlt || e.bildAlt) : e.bildAlt;
    const qNeu = darstellung === 'vektor' ? (e.vekNeu || e.bildNeu) : e.bildNeu;
    if (!qAlt || !qNeu) return null;
    const A = alphaFeld(qAlt, R), B = alphaFeld(qNeu, R);
    const c = document.createElement('canvas');
    c.width = R; c.height = R;
    const g = c.getContext('2d');
    const bild = g.createImageData(R, R);
    const d = bild.data;
    const weg = wegRgb(), dazu = akzentRgb();
    const schwelle = MARK_SCHWELLE / 255;
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
  // Ein 1-px-Rahmen je veränderter Region, in der Farbe ihrer Richtung.
  function markenZeichnen(g, ana, x, y, N, s, p) {
    if (!markenAn() || !ana) return;
    const lay = diffLayer(ana);
    if (lay) {
      g.save();
      g.imageSmoothingEnabled = darstellung === 'vektor';
      g.drawImage(lay, x, y, s, s);
      g.restore();
    }
    const regionen = ana.regionen || [];
    if (!regionen.length) return;
    const e = s / N;
    g.save();
    g.lineWidth = p;
    regionen.forEach(r => {
      const rot = r.flAlt >= r.flNeu;
      g.strokeStyle = rgbText(rot ? wegRgb() : akzentRgb());
      const rx = x + r.x * e, ry = y + r.y * e, rw = r.w * e, rh = r.h * e;
      g.strokeRect(rx + p / 2, ry + p / 2, Math.max(0, rw - p), Math.max(0, rh - p));
      if (HOVER && HOVER.region === r) {
        g.save();
        g.lineWidth = 2 * p;
        g.strokeRect(rx - p, ry - p, rw + 2 * p, rh + 2 * p);
        g.restore();
      }
    });
    g.restore();
  }
  // Kleine Zahl-Pille oben rechts: wie viele Kanten gerastet wurden.
  function kantenPille(g, k, x, y, s, p) {
    const n = Number(k.e.zelle.gerastet) || 0;
    if (!markenAn() || !n) return;
    const txt = t('urt.gerastet', { n: n });
    g.font = '700 ' + Math.round(9 * p) + 'px Inter, system-ui, sans-serif';
    const b = g.measureText(txt).width + 8 * p;
    pillZeichnen(g, txt, x + s - b - 4 * p, y + 20 * p, p);
  }
  function kachelZeichnen(g, k, kx, ky, welche, p) {
    const s = k.N * KAM.z;
    const x = dx(kx), y = dy(ky);
    if (x > vpBreite() || y > vpHoehe() || x + s < 0 || y + s < 0) return;
    g.fillStyle = kachelGrund();
    g.fillRect(x, y, s, s);
    const e = k.e;
    if (welche === 'misch') {
      const m = mischCanvas(e);
      if (m) {
        g.save();
        g.imageSmoothingEnabled = darstellung === 'vektor';
        g.drawImage(m, x, y, s, s);
        g.restore();
      }
      pillZeichnen(g, t('pill.beide'), x + 4 * p, y + 4 * p, p);
    } else if (welche === 'wisch') {
      bildZeichnen(g, bildVon(e, 'alt'), x, y, s);
      const w = Math.max(0, Math.min(s, s * wischPos));
      g.save();
      g.beginPath(); g.rect(x, y, w, s); g.clip();
      if (blend < 100) bildZeichnen(g, bildVon(e, 'alt'), x, y, s);
      bildZeichnen(g, bildVon(e, 'neu'), x, y, s, blend / 100);
      markenZeichnen(g, e, x, y, k.N, s, p);
      g.restore();
      // Griff
      g.save();
      g.strokeStyle = dunkel ? 'rgba(255,255,255,.9)' : 'rgba(20,20,30,.8)';
      g.lineWidth = p;
      g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w, y + s); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(x + w, y + s / 2, 6 * p, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,20,30,.35)'; g.stroke();
      g.restore();
      pillZeichnen(g, t('pill.vorher'), x + 4 * p, y + 4 * p, p);
      const bb = g.measureText(t('pill.nachher')).width + 8 * p;
      pillZeichnen(g, t('pill.nachher'), x + s - bb - 4 * p, y + 4 * p, p);
      kantenPille(g, k, x, y, s, p);
    } else {
      if (welche === 'neu' && blend < 100) bildZeichnen(g, bildVon(e, 'alt'), x, y, s);
      bildZeichnen(g, bildVon(e, welche), x, y, s, welche === 'neu' ? blend / 100 : 1);
      if (welche === 'neu') markenZeichnen(g, e, x, y, k.N, s, p);
      if (welche === 'alt' && !bildVon(e, 'alt')) {
        g.fillStyle = textFarbe2();
        g.font = Math.round(9 * p) + 'px Inter, system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(t('diff.nuralt'), x + s / 2, y + s / 2);
        g.textAlign = 'left';
      }
      pillZeichnen(g, welche === 'alt' ? t('pill.vorher') : t('pill.nachher'), x + 4 * p, y + 4 * p, p);
      if (welche === 'neu') kantenPille(g, k, x, y, s, p);
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
      // Kartenrahmen
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
      // Der Titel ist anklickbar: er zentriert seine Karte.
      k.titelFeld = { x: x - 4 * p, y: ty - 13 * p, w: tb + 8 * p, h: 18 * p };
      let tx = x + tb + 6 * p;
      const ok = massStimmt(k.e.zelle);
      if (ok != null) {
        g.fillStyle = ok ? '#12a76a' : '#c98a12';
        g.beginPath(); g.arc(tx + 3 * p, ty - 3.5 * p, 3 * p, 0, Math.PI * 2); g.fill();
        tx += 10 * p;
      }
      const d = deltaText(k.e.aaAlt, k.e.aaNeu);
      if (d) {
        g.font = '700 ' + Math.round(9.5 * p) + 'px Inter, system-ui, sans-serif';
        g.fillStyle = d.charAt(0) === '−' ? '#12a76a' : '#c98a12';
        g.fillText(d, tx, ty);
      }
      kacheln(k).forEach(ka => kachelZeichnen(g, k, ka.x, ka.y, ka.welche, p));
    });
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
      for (const ka of kacheln(k)) {
        if (wx >= ka.x && wy >= ka.y && wx < ka.x + k.N && wy < ka.y + k.N) {
          return { k: k, ka: ka, px: Math.floor(wx - ka.x), py: Math.floor(wy - ka.y) };
        }
      }
    }
    return null;
  }
  function griffNah(devX, devY) {
    if (vglModus !== 'wischen') return null;
    for (const k of LAYOUT) {
      const s = k.N * KAM.z;
      const x = dx(k.x), y = dy(k.y);
      if (devY < y || devY > y + s) continue;
      if (Math.abs(devX - (x + s * wischPos)) <= 12 * dpr()) return k;
    }
    return null;
  }
  function hoverSetzen(treffer) {
    const alt = HOVER && HOVER.region;
    HOVER = treffer;
    if ((treffer && treffer.region) !== alt) anstossen(false);
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

  async function renderKarten() {
    if (!letzterDiff) return;
    const A = await analyseHolen();
    urteilZeichnen(A);
    kennzahlenZeichnen(A);
    hintingZeichnen(A);
    layoutRechnen(A);
    leinwandMessen();
    if (fitQuelle !== letzterDiff) { fitQuelle = letzterDiff; zoomFit(false); }
    else { klemmen(ZIEL); kameraSetzen(ZIEL.x, ZIEL.y, ZIEL.z, false); }
    kopfZeichnen();
    anstossen(false);
  }

  // ---- Kopf ----------------------------------------------------------------
  function kopfZeichnen() {
    $('diff').classList.add('an');
    $('diff').classList.toggle('dunkel', dunkel);
    MODI.forEach(m => $('diff').classList.toggle('modus-' + m, vglModus === m));
    try { $('segModus').setAttribute('value', vglModus); } catch (e) {}
    try { $('segDarstellung').setAttribute('value', darstellung); } catch (e) {}
    $('vTitel').textContent = t('v.titel', { name: (letzterDiff && letzterDiff.name) || '' });
    $('scrubberZeile').hidden = !verbesserung;
    $('retinaHalter').hidden = darstellung !== 'pixel';
    legendeZeichnen();
    zoomPilleSetzen();
  }
  function renderDiff() {
    if (!letzterDiff) return;
    kopfZeichnen();
    renderKarten();
  }

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
  bei('merker', m => {
    if (!m) return;
    if (m.schluessel === 'vergleichsmodus' && MODI.indexOf(m.wert) >= 0) {
      vglModus = m.wert;
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
      anhaken($('chkRetina'), retina);
      if (letzterDiff) renderKarten();
    }
  });
  send({ type: 'merkerLaden', schluessel: 'vergleichsmodus' });
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
    modusSetzen(String((e && e.detail) || $('segModus').value || 'neben'), true);
  });
  $('segDarstellung').addEventListener('change', e => {
    const v = String((e && e.detail) || $('segDarstellung').value || 'vektor');
    if (v === darstellung) return;
    darstellungSetzen(v, true);
  });
  $('chkRetina').addEventListener('change', e => {
    retina = !!e.target.checked;
    send({ type: 'merkerSetzen', schluessel: 'retina', wert: retina });
    if (letzterDiff) renderKarten();
  });
  $('chkMarkieren').addEventListener('change', e => { markieren = !!e.target.checked; anstossen(false); });
  $('chkVerbesserung').addEventListener('change', e => {
    verbesserung = !!e.target.checked;
    $('scrubberZeile').hidden = !verbesserung;
    $('retinaHalter').hidden = darstellung !== 'pixel';
    legendeZeichnen();
    blend = verbesserung ? Number($('blendRegler').value || 100) : 100;
    anstossen(false);
  });
  const blendNehmen = e => {
    const v = Number((e && e.target && e.target.value) != null ? e.target.value : $('blendRegler').value);
    if (!isFinite(v)) return;
    blend = v;
    anstossen(false);
  };
  $('blendRegler').addEventListener('input', blendNehmen);
  $('blendRegler').addEventListener('change', blendNehmen);
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
      if (e.target.closest('fig-button, .zoompille, .bhgriff')) return;
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
        let text = t('px.koord', { x: tr.px, y: tr.py }), region = null;
        if (markenAn() && (tr.ka.welche === 'neu' || tr.ka.welche === 'wisch')) {
          region = (tr.k.e.regionen || []).filter(r =>
            tr.px >= r.x && tr.py >= r.y && tr.px < r.x + r.w && tr.py < r.y + r.h)[0] || null;
          if (region) text = regionText(region);
        }
        hoverSetzen({ region: region, text: text, cssX: d.cssX, cssY: d.cssY });
      }, 60);
    });
    const ende = e => {
      if (zieht) { zieht = false; box.classList.remove('zieht'); }
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
