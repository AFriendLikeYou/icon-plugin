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
  const MODI = ['neben', 'wischen'];
  const W_LUECKE = 4;        // Weltabstand zwischen Vorher- und Nachher-Kachel
  const W_KARTE = 12;        // Weltabstand zwischen den Größenkarten
  const W_POLSTER = 3;       // Kartenrahmen um die Kacheln
  const VEK_AUFL = 16;       // Auflösungsfaktor der Vektor-Bitmaps
  const SICHT_MIN = 64;      // so viel Inhalt bleibt immer im Viewport (Gerätepixel)

  let vglModus = 'neben';
  let darstellung = 'pixel';           // pixel | vektor
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
  let pxQuelle = null, pxSig = '';
  let dfQuelle = null, dfSig = '';

  function dpr() { return Math.max(1, window.devicePixelRatio || 1); }
  function akzentRgb() { return dunkel ? [78, 166, 255] : [13, 153, 255]; }
  function akzent() { const f = akzentRgb(); return 'rgb(' + f[0] + ',' + f[1] + ',' + f[2] + ')'; }
  function umrissFarbe() { return dunkel ? '#ffffff' : '#1c1c22'; }
  function grundFarbe() { return dunkel ? '#17171a' : '#fafafc'; }
  function kachelGrund() { return dunkel ? '#1e1e1e' : '#ffffff'; }
  function rahmenFarbe() { return dunkel ? '#3a3a42' : '#e3e3e6'; }
  function textFarbe() { return dunkel ? '#e8e8ee' : '#1c1c22'; }
  function textFarbe2() { return dunkel ? '#a9a9b4' : '#6e6e76'; }
  // Die Detailansichten sind DOM und rechnen in CSS-Pixeln.
  function domZoom() { return Math.max(2, Math.min(24, Math.round(KAM.z / dpr()))); }

  function svgText(svg, farbe) {
    return svg.replace(/fill="[^"]*"/g, 'fill="' + farbe + '"')
              .replace(/fill:[^;"]*/g, 'fill:' + farbe);
  }
  function svgLayer(svg, farbe, lage) {
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText(svg, farbe));
    img.className = 'lage-' + lage;
    return img;
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

  function rasterSkala() { return String($('segRaster').value) === '2' ? 2 : 1; }

  // ---- Änderungsregionen ---------------------------------------------------
  // |alpha_alt − alpha_neu| > 24 ergibt eine Maske auf dem 1×-Raster;
  // zusammenhängende Bereiche (8er-Nachbarschaft) werden zu Regionen. Regionen
  // unter 2 Pixeln fallen weg, höchstens 20 je Kachel — sonst wäre die Kachel
  // ein Gitter; bei mehr bleiben die größten.
  const MARK_SCHWELLE = 24, MARK_MIN = 2, MARK_MAX = 20;
  function regionenFinden(A, B) {
    const w = Math.min(A.w, B.w), h = Math.min(A.h, B.h);
    const maske = new Uint8Array(w * h);
    let treffer = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = A.data[((y * A.w) + x) * 4 + 3];
      const b = B.data[((y * B.w) + x) * 4 + 3];
      if (Math.abs(a - b) > MARK_SCHWELLE) { maske[y * w + x] = 1; treffer++; }
    }
    if (!treffer) return { regionen: [], pixel: 0 };
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
    return { regionen: regionen.slice(0, MARK_MAX), pixel: treffer };
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
    const sig = (dunkel ? 'd' : 'h');
    if (anaQuelle === letzterDiff && anaSig === sig) return ANA;
    anaQuelle = letzterDiff; anaSig = sig;
    ANA = [];
    for (const c of (letzterDiff ? letzterDiff.zellen : [])) {
      const e = { N: c.N, zelle: c, bildAlt: null, bildNeu: null, vekAlt: null, vekNeu: null,
        aaAlt: null, aaNeu: null, regionen: [], andersPixel: 0 };
      if (c.pngNeu) { const r = await analysiere(c.pngNeu, false, dunkel); e.bildNeu = r.c; e.aaNeu = r.aa; }
      if (c.pngAlt) { const r = await analysiere(c.pngAlt, false, dunkel); e.bildAlt = r.c; e.aaAlt = r.aa; }
      if (c.neu) e.vekNeu = await svgCanvas(c.neu, umrissFarbe(), c.N);
      if (c.alt) e.vekAlt = await svgCanvas(c.alt, umrissFarbe(), c.N);
      if (c.pngAlt && c.pngNeu) {
        const A = await bitmapDaten(c.pngAlt);
        const B = await bitmapDaten(c.pngNeu);
        const d = regionenFinden(A, B);
        e.regionen = d.regionen; e.andersPixel = d.pixel;
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
  function fehlerText(v) { return v == null ? null : zahl(v.toFixed(3)); }
  function deltaText(alt, neu) {
    if (alt == null || neu == null || !(alt > 0)) return null;
    const d = Math.round((neu - alt) / alt * 100);
    if (!isFinite(d) || d === 0) return null;
    return (d < 0 ? '−' : '+') + Math.abs(d) + ' %';
  }
  function radiusText(c) {
    if (c.radius == null) return null;
    if (typeof c.radius !== 'object') return zahl(c.radius);
    return t('radius.' + c.radius.modus) + (c.radius.modus === 'fest' ? ' ' + zahl(c.radius.wert) : '');
  }
  function zellenInfo(c) {
    const kurz = [], voll = [];
    if (c.soll != null) {
      const k = t('zelle.keyline', {
        ist: c.ist == null ? '?' : zahl(Number(c.ist).toFixed(2)), soll: zahl(c.soll) });
      kurz.push(k); voll.push(k);
    }
    if (c.kontur != null) { const s = t('zelle.kontur', { k: zahl(c.kontur) }); kurz.push(s); voll.push(s); }
    if (c.raster != null) { const s = t('zelle.raster', { r: zahl(c.raster) }); kurz.push(s); voll.push(s); }
    const r = radiusText(c);
    if (r) voll.push(t('zelle.radius', { v: r }));
    if (c.gerastet) voll.push(t('zelle.gerastet', { n: c.gerastet }));
    if (!c.alt) voll.push(t('zelle.neu'));
    const ok = massStimmt(c);
    if (ok != null) voll.push(ok ? t('zelle.massOk') : t('zelle.massAb'));
    return { kurz: kurz.join(' · '), voll: voll.join('\n') };
  }
  function zellenLabel(c, zusatz) {
    const info = zellenInfo(c);
    const el = document.createElement('div');
    el.className = 'label';
    const z1 = document.createElement('div');
    z1.className = 'l1';
    const ok = massStimmt(c);
    if (ok != null) {
      const p = document.createElement('span');
      p.className = 'statuspunkt ' + (ok ? 'gut' : 'ab');
      p.title = ok ? t('zelle.massOk') : t('zelle.massAb');
      z1.appendChild(p);
    }
    const gr = document.createElement('span');
    gr.className = 'lgroesse';
    gr.textContent = zahl(c.N) + ' px' + (zusatz ? ' · ' + zusatz : '');
    z1.appendChild(gr);
    el.appendChild(z1);
    const z2 = document.createElement('div');
    z2.className = 'l2';
    z2.textContent = info.kurz;
    z2.title = info.voll;
    el.appendChild(z2);
    el.title = info.voll;
    return el;
  }

  // ---- Urteil-Zeile --------------------------------------------------------
  function pille(text, art) {
    const s = document.createElement('span');
    s.className = 'upill' + (art ? ' ' + art : '');
    s.textContent = text;
    return s;
  }
  function urteilZeichnen(A) {
    const karte = $('urteil'), txt = $('urteilText'), pillen = $('urteilPills');
    pillen.textContent = '';
    if (!A.length) { karte.className = 'urteil'; txt.textContent = ''; return; }
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

    let art = 'neutral';
    if (!mitAlt) txt.textContent = t('urt.neu');
    else if (aaAlt != null && aaNeu != null && aaNeu < aaAlt - 0.5) { txt.textContent = t('urt.besser'); art = 'gut'; }
    else if (aaAlt != null && aaNeu != null && aaNeu > aaAlt + 0.5) { txt.textContent = t('urt.schlechter'); art = 'warn'; }
    else txt.textContent = t('urt.gleich');
    if (massGes && !massAlle) art = 'warn';
    karte.className = 'urteil ' + art;

    if (aaAlt != null && aaNeu != null && mitAlt) {
      const d = deltaText(aaAlt, aaNeu);
      pillen.appendChild(pille(t('urt.aa', { alt: aaAlt, neu: aaNeu }) + (d ? ' (' + d + ')' : ''),
        d && d.charAt(0) === '−' ? 'gut' : ''));
    } else if (feNeu != null) {
      pillen.appendChild(pille(t('urt.fehler', { v: fehlerText(feNeu) })));
    } else if (aaNeu != null) {
      pillen.appendChild(pille(t('urt.aaNur', { neu: aaNeu })));
    }
    if (feAlt != null && feNeu != null) {
      const d = deltaText(feAlt, feNeu);
      pillen.appendChild(pille(t('urt.fehlerVgl', { alt: fehlerText(feAlt), neu: fehlerText(feNeu) })
        + (d ? ' (' + d + ')' : ''), d && d.charAt(0) === '−' ? 'gut' : ''));
    }
    if (massGes) pillen.appendChild(pille(
      massAlle ? t('urt.mass', { n: massOk, m: massGes }) : t('urt.massAb', { n: massGes - massOk, m: massGes }),
      massAlle ? 'gut' : 'warn'));
    if (gerastet && pillen.childNodes.length < 3) pillen.appendChild(pille(t('urt.gerastet', { n: gerastet })));
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
      { label: t('fuss.fehler'), tip: t('ber.tipTreue'), wert: e => {
        const fe = fehlerText(e.fehlerNeu), feA = fehlerText(e.fehlerAlt);
        return fe == null ? t('ber.keineDaten') : (feA ? feA + ' → ' + fe : fe);
      } },
      { label: t('fuss.aa'), tip: t('ber.tipAa'), wert: e =>
        e.aaNeu == null ? t('ber.keineDaten')
          : (e.aaAlt != null ? e.aaAlt + ' % → ' + e.aaNeu + ' %' : e.aaNeu + ' %') },
      { label: t('fuss.keyline'), tip: t('ber.tipMass'), wert: e => {
        const c = e.zelle, ok = massStimmt(c);
        return c.soll == null ? t('ber.keineDaten')
          : zahl(c.ist == null ? '?' : Number(c.ist).toFixed(2)) + ' / ' + zahl(c.soll)
            + (ok == null ? '' : ok ? ' ✓' : ' △');
      } }
    ];
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

  // ---- Layout in Weltkoordinaten -----------------------------------------
  function layoutRechnen(A) {
    LAYOUT = [];
    let x = 0, maxN = 1;
    A.forEach((e, i) => {
      const N = e.N || 1;
      if (N > maxN) maxN = N;
      const breite = vglModus === 'neben' ? 2 * N + W_LUECKE : N;
      LAYOUT.push({ e: e, i: i, N: N, x: x, y: -N / 2, breite: breite });
      x += breite + W_KARTE;
    });
    const rand = W_POLSTER + 1;
    WELT = { x0: -rand, y0: -maxN / 2 - rand, x1: Math.max(0, x - W_KARTE) + rand, y1: maxN / 2 + rand };
  }
  function kacheln(k) {
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
    sprungAktiv();
    kameraSetzen(k.x + k.breite / 2 - vpBreite() / 2 / ZIEL.z,
      k.y + k.N / 2 - vpHoehe() / 2 / ZIEL.z, ZIEL.z, mitLerp !== false);
  }
  function aufKarteZoomen(i, mitLerp) {
    const k = LAYOUT[Math.max(0, Math.min(LAYOUT.length - 1, i))];
    if (!k) return;
    aktiveKarte = k.i;
    sprungAktiv();
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
  function bildZeichnen(g, bild, x, y, s, alpha) {
    if (!bild) return;
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.imageSmoothingEnabled = darstellung === 'vektor';
    g.drawImage(bild, x, y, s, s);
    g.restore();
  }
  function markenZeichnen(g, regionen, x, y, N, s, p) {
    if (!markieren || !regionen || !regionen.length) return;
    const e = s / N;
    const f = akzentRgb();
    g.save();
    g.fillStyle = 'rgba(' + f[0] + ',' + f[1] + ',' + f[2] + ',0.12)';
    g.strokeStyle = akzent();
    g.lineWidth = p;
    regionen.forEach(r => {
      const rx = x + r.x * e, ry = y + r.y * e, rw = r.w * e, rh = r.h * e;
      g.fillRect(rx, ry, rw, rh);
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
  function kachelZeichnen(g, k, kx, ky, welche, p) {
    const s = k.N * KAM.z;
    const x = dx(kx), y = dy(ky);
    if (x > vpBreite() || y > vpHoehe() || x + s < 0 || y + s < 0) return;
    g.fillStyle = kachelGrund();
    g.fillRect(x, y, s, s);
    const e = k.e;
    if (welche === 'wisch') {
      bildZeichnen(g, bildVon(e, 'alt'), x, y, s);
      const w = Math.max(0, Math.min(s, s * wischPos));
      g.save();
      g.beginPath(); g.rect(x, y, w, s); g.clip();
      if (blend < 100) bildZeichnen(g, bildVon(e, 'alt'), x, y, s);
      bildZeichnen(g, bildVon(e, 'neu'), x, y, s, blend / 100);
      markenZeichnen(g, e.regionen, x, y, k.N, s, p);
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
    } else {
      if (welche === 'neu' && blend < 100) bildZeichnen(g, bildVon(e, 'alt'), x, y, s);
      bildZeichnen(g, bildVon(e, welche), x, y, s, welche === 'neu' ? blend / 100 : 1);
      if (welche === 'neu') markenZeichnen(g, e.regionen, x, y, k.N, s, p);
      if (welche === 'alt' && !bildVon(e, 'alt')) {
        g.fillStyle = textFarbe2();
        g.font = Math.round(9 * p) + 'px Inter, system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(t('diff.nuralt'), x + s / 2, y + s / 2);
        g.textAlign = 'left';
      }
      pillZeichnen(g, welche === 'alt' ? t('pill.vorher') : t('pill.nachher'), x + 4 * p, y + 4 * p, p);
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
      let tx = x + g.measureText(titel).width + 6 * p;
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
  function sprungAktiv() {
    $('sprungleiste').querySelectorAll('.sprung').forEach((b, k) => b.classList.toggle('an', k === aktiveKarte));
  }
  function sprungleisteZeichnen(A) {
    const box = $('sprungleiste');
    box.textContent = '';
    box.hidden = A.length < 2;
    if (A.length < 2) return;
    A.forEach((e, i) => {
      const b = document.createElement('fig-button');
      b.setAttribute('variant', 'ghost');
      b.className = 'sprung' + (i === aktiveKarte ? ' an' : '');
      b.textContent = zahl(e.N) + ' px';
      b.addEventListener('click', () => karteMittig(i, true));
      box.appendChild(b);
    });
  }
  function zoomPilleSetzen() {
    $('zoomWertAnzeige').textContent = Math.round(ZIEL.z * 100) + ' %';
  }

  async function renderKarten() {
    if (!letzterDiff) return;
    const A = await analyseHolen();
    urteilZeichnen(A);
    kennzahlenZeichnen(A);
    layoutRechnen(A);
    sprungleisteZeichnen(A);
    leinwandMessen();
    if (fitQuelle !== letzterDiff) { fitQuelle = letzterDiff; zoomFit(false); }
    else { klemmen(ZIEL); kameraSetzen(ZIEL.x, ZIEL.y, ZIEL.z, false); }
    kopfZeichnen();
    anstossen(false);
  }

  // ---- Details: Vektor-Umriss (Onionskin in Grau/Schwarz) -----------------
  function renderVektor() {
    if (!letzterDiff) return;
    const zz = domZoom();
    const alt = dunkel ? '#7e7e8c' : '#a6a6b0', neu = umrissFarbe();
    const z = $('zellen');
    z.textContent = '';
    letzterDiff.zellen.forEach(c => {
      const px = c.N * zz;
      const zelle = document.createElement('div');
      zelle.className = 'zelle';
      const schau = document.createElement('div');
      schau.className = 'schau' + (zz >= 6 ? ' raster' : '');
      schau.style.width = px + 'px'; schau.style.height = px + 'px';
      schau.style.backgroundSize = zz + 'px ' + zz + 'px, ' + zz + 'px ' + zz + 'px, '
        + (zz / 2) + 'px ' + (zz / 2) + 'px, ' + (zz / 2) + 'px ' + (zz / 2) + 'px, auto';
      if (c.alt) schau.appendChild(svgLayer(c.alt, alt, 'alt'));
      if (c.neu) schau.appendChild(svgLayer(c.neu, neu, 'neu'));
      zelle.appendChild(schau);
      const lbl = zellenLabel(c, c.alt ? '' : t('zelle.neu'));
      lbl.style.width = px + 'px';
      zelle.appendChild(lbl);
      z.appendChild(zelle);
    });
  }

  // ---- Details: Pixelansicht ----------------------------------------------
  function pxGroessenSetzen() {
    const zz = domZoom();
    $('pxzellen').querySelectorAll('.pxzelle').forEach(el => {
      const N = Number(el.dataset.n) || 0;
      const b = (N * zz) || 0;
      el.querySelectorAll('canvas').forEach(c => {
        c.style.width = (b || c.width) + 'px';
        c.style.height = (b || c.height) + 'px';
      });
      const l = el.querySelector('.label');
      if (l) l.style.width = (b || '') + (b ? 'px' : '');
    });
  }
  async function renderPixel() {
    if (!letzterDiff) return;
    const skala = rasterSkala();
    const zz = domZoom();
    const sig = skala + '|' + (dunkel ? 1 : 0) + '|' + (zz >= 8 ? 8 : 1);
    // Gleiche Daten, gleiche Rasterung: nur skalieren, nicht neu analysieren.
    if (pxQuelle === letzterDiff && pxSig === sig) { pxGroessenSetzen(); return; }
    pxQuelle = letzterDiff; pxSig = sig;
    const z = $('pxzellen'); z.textContent = '';
    for (const c of letzterDiff.zellen) {
      const bytesNeu = skala === 2 && c.pngNeu2 ? c.pngNeu2 : c.pngNeu;
      const bytesAlt = skala === 2 ? c.pngAlt2 : c.pngAlt;
      if (!bytesNeu) continue;
      const zelle = document.createElement('div'); zelle.className = 'pxzelle';
      zelle.dataset.n = String(c.N || 0);
      const wrap = document.createElement('div'); wrap.className = 'wrap';
      // Weiche Pixel werden immer auf der gewählten Rasterung gemessen;
      // angezeigt wird ab Zoom 8 das 8×-PNG (schärfste Stufe).
      const mess = await analysiere(bytesNeu, false, dunkel);
      let bild = mess.c;
      if (zz >= 8 && c.pngNeu8) bild = (await analysiere(c.pngNeu8, false, dunkel)).c;
      wrap.appendChild(bild);
      let text = t('pixel.aa', { aa: mess.aa });
      if (bytesAlt) {
        const alt = await analysiere(bytesAlt, false, false);
        text += ' · ' + t('pixel.alt', { aa: alt.aa });
      }
      if (c.guete) {
        const d = c.guete.plain.fehler > 1e-9
          ? Math.round((1 - c.guete.snap.fehler / c.guete.plain.fehler) * 100) : 0;
        text += ' · ' + t('pixel.hint', { v: c.guete.mitSnap
          ? (d > 0 ? t('hint.fehler', { d: d }) : t('hint.gleich'))
          : t('hint.ohne') });
      }
      zelle.appendChild(wrap);
      zelle.appendChild(zellenLabel(c, text));
      z.appendChild(zelle);
    }
    pxGroessenSetzen();
  }

  // ---- Details: Differenz --------------------------------------------------
  function dfGroessenSetzen() {
    const zz = domZoom();
    $('dfzellen').querySelectorAll('.dfzelle').forEach(el => {
      const N = Number(el.dataset.n) || 0;
      const b = (N * zz) || 0;
      el.querySelectorAll('canvas, .leer').forEach(c => {
        c.style.width = b + 'px'; c.style.height = b + 'px';
      });
      const l = el.querySelector('.label');
      if (l) l.style.width = b + 'px';
    });
  }
  // |alt − neu| je Pixel bei der gewählten Rasterung, neutral eingefärbt:
  // weg = Grau, dazu = Akzent, unverändert = sehr blasses Grau.
  async function renderDifferenz() {
    if (!letzterDiff) return;
    const skala = rasterSkala();
    const sig = skala + '|' + (dunkel ? 1 : 0);
    if (dfQuelle === letzterDiff && dfSig === sig) { dfGroessenSetzen(); return; }
    dfQuelle = letzterDiff; dfSig = sig;
    const weg = dunkel ? [150, 150, 165] : [110, 110, 126];
    const dazu = akzentRgb();
    const beide = dunkel ? [90, 90, 102] : [190, 190, 200];
    const z = $('dfzellen'); z.textContent = '';
    for (const c of letzterDiff.zellen) {
      const bytesNeu = skala === 2 && c.pngNeu2 ? c.pngNeu2 : c.pngNeu;
      const bytesAlt = skala === 2 ? c.pngAlt2 : c.pngAlt;
      if (!bytesNeu) continue;
      const zelle = document.createElement('div'); zelle.className = 'dfzelle';
      zelle.dataset.n = String(c.N || 0);
      const wrap = document.createElement('div'); wrap.className = 'wrap';
      let zusatz;
      if (!bytesAlt) {
        const leer = document.createElement('div');
        leer.className = 'leer';
        leer.textContent = t('diff.nuralt');
        wrap.appendChild(leer);
        zusatz = t('diff.nurNeu');
      } else {
        const A = await bitmapDaten(bytesAlt);
        const B = await bitmapDaten(bytesNeu);
        const w = Math.min(A.w, B.w), h = Math.min(A.h, B.h);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d');
        const bild = g.createImageData(w, h);
        const d = bild.data;
        let anders = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const a = A.data[((y * A.w) + x) * 4 + 3] / 255;
          const b = B.data[((y * B.w) + x) * 4 + 3] / 255;
          const i = ((y * w) + x) * 4;
          const diff = a - b;
          let farbe, alpha;
          if (diff > 0.02) { farbe = weg; alpha = diff; anders++; }
          else if (diff < -0.02) { farbe = dazu; alpha = -diff; anders++; }
          else if (a > 0.02) { farbe = beide; alpha = a * 0.3; }
          else { continue; }
          d[i] = farbe[0]; d[i + 1] = farbe[1]; d[i + 2] = farbe[2];
          d[i + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
        }
        g.putImageData(bild, 0, 0);
        wrap.appendChild(cv);
        zusatz = anders + ' px';
      }
      zelle.appendChild(wrap);
      zelle.appendChild(zellenLabel(c, zusatz));
      z.appendChild(zelle);
    }
    dfGroessenSetzen();
  }

  function detailsOffen() { return $('grpDetails').hasAttribute('data-offen'); }
  function renderDetails() {
    if (!letzterDiff || !detailsOffen()) return;
    renderVektor();
    renderPixel();
    renderDifferenz();
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
    zoomPilleSetzen();
  }
  function renderDiff() {
    if (!letzterDiff) return;
    kopfZeichnen();
    renderKarten();
    renderDetails();
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
  });
  send({ type: 'merkerLaden', schluessel: 'vergleichsmodus' });
  send({ type: 'merkerLaden', schluessel: 'buehneHoehe' });

  function hoeheSetzen(h, melden) {
    buehneHoehe = Math.max(200, Math.min(600, Math.round(h)));
    $('buehne').style.height = buehneHoehe + 'px';
    if (leinwandMessen()) { klemmen(ZIEL); anstossen(false); }
    if (melden) send({ type: 'merkerSetzen', schluessel: 'buehneHoehe', wert: buehneHoehe });
  }
  hoeheSetzen(buehneHoehe);

  // ---- Bedienung -----------------------------------------------------------
  $('segModus').addEventListener('change', e => {
    modusSetzen(String((e && e.detail) || $('segModus').value || 'neben'), true);
  });
  $('segDarstellung').addEventListener('change', e => {
    const v = String((e && e.detail) || $('segDarstellung').value || 'pixel');
    if (v === darstellung) return;
    darstellung = v === 'vektor' ? 'vektor' : 'pixel';
    kopfZeichnen();
    anstossen(false);
  });
  $('chkMarkieren').addEventListener('change', e => { markieren = !!e.target.checked; anstossen(false); });
  $('chkVerbesserung').addEventListener('change', e => {
    verbesserung = !!e.target.checked;
    $('scrubberZeile').hidden = !verbesserung;
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
  $('segRaster').addEventListener('change', () => { renderPixel(); renderDifferenz(); });
  $('segRaster').addEventListener('click', () => requestAnimationFrame(() => { renderPixel(); renderDifferenz(); }));
  $('grpDetails').addEventListener('openchange', ev => {
    const auf = !!(ev && ev.detail && ev.detail.open);
    if (auf) { $('grpDetails').setAttribute('data-offen', ''); renderDetails(); }
    else $('grpDetails').removeAttribute('data-offen');
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
      const tr = kachelUnter(d.x, d.y);
      if (tr) { aktiveKarte = tr.k.i; sprungAktiv(); anstossen(false); }
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
        if (markieren && (tr.ka.welche === 'neu' || tr.ka.welche === 'wisch')) {
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
