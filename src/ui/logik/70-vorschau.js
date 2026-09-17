  // =========================================================================
  // Vorschau — Vektor (Überlagern/Wischen/Nebeneinander/Blinken), Pixel, Differenz
  // =========================================================================
  const FARBEN = {
    hell:  { alt: '#d3308f', neu: '#0e8a9a', weg: [211, 48, 143], dazu: [14, 138, 154], beide: [110, 110, 126] },
    dunk:  { alt: '#ff7ad0', neu: '#4fe3f0', weg: [255, 122, 208], dazu: [79, 227, 240], beide: [170, 170, 186] }
  };
  function palette() { return dunkel ? FARBEN.dunk : FARBEN.hell; }

  const MODI = ['ueberlagern', 'wischen', 'neben', 'blinken'];
  let vglModus = 'ueberlagern';
  let wischPos = 0.5;                 // 0…1, Position des Wisch-Griffs
  let blinkTimer = null, blinkPause = false;
  // Cache-Marken: Filter-, Modus- und Zoomwechsel dürfen die PNGs NICHT neu
  // analysieren — nur die vorhandenen Canvas neu skalieren.
  let pxQuelle = null, pxSig = '';
  let dfQuelle = null, dfSig = '';

  function svgLayer(svg, farbe, lage) {
    const gefaerbt = svg.replace(/fill="[^"]*"/g, 'fill="' + farbe + '"')
                        .replace(/fill:[^;"]*/g, 'fill:' + farbe);
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(gefaerbt);
    img.className = 'lage-' + lage;
    return img;
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

  async function analysiere(bytes, markieren, invertieren) {
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
        if (markieren) { d[i - 3] = 224; d[i - 2] = 60; d[i - 1] = 60; d[i] = 255; } }
      if (invertieren && a > 0) {
        d[i - 3] = 255 - d[i - 3]; d[i - 2] = 255 - d[i - 2]; d[i - 1] = 255 - d[i - 1];
      }
    }
    if (markieren || invertieren) g.putImageData(id, 0, 0);
    const belegt = voll + teil;
    return { c, aa: belegt ? Math.round(100 * teil / belegt) : 0 };
  }

  function rasterSkala() { return String($('segRaster').value) === '2' ? 2 : 1; }

  // ---- Beschriftung --------------------------------------------------------
  function massStimmt(c) {
    if (c.ist == null || c.soll == null) return null;
    return Math.abs(Number(c.ist) - Number(c.soll)) <= 0.5;
  }
  function radiusText(c) {
    if (c.radius == null) return null;
    if (typeof c.radius !== 'object') return zahl(c.radius);
    return t('radius.' + c.radius.modus) + (c.radius.modus === 'fest' ? ' ' + zahl(c.radius.wert) : '');
  }
  // Eine kompakte Zeile (mit Ellipsis) plus vollständiger Tooltip.
  function zellenInfo(c) {
    const kurz = [], voll = [];
    if (c.soll != null) {
      const k = t('zelle.keyline', {
        ist: c.ist == null ? '?' : zahl(Number(c.ist).toFixed(2)), soll: zahl(c.soll) });
      kurz.push(k); voll.push(k);
    }
    if (c.kontur != null) {
      const s = t('zelle.kontur', { k: zahl(c.kontur) });
      kurz.push(s); voll.push(s);
    }
    if (c.raster != null) {
      const s = t('zelle.raster', { r: zahl(c.raster) });
      kurz.push(s); voll.push(s);
    }
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

  // ---- Bühne: Zelle bauen --------------------------------------------------
  function schauBasis(px) {
    const schau = document.createElement('div');
    schau.className = 'schau' + (zoom >= 4 ? ' raster' : '');
    schau.style.width = px + 'px'; schau.style.height = px + 'px';
    schau.style.backgroundSize = zoom + 'px ' + zoom + 'px, ' + zoom + 'px ' + zoom + 'px, '
      + (zoom / 2) + 'px ' + (zoom / 2) + 'px, ' + (zoom / 2) + 'px ' + (zoom / 2) + 'px, auto';
    return schau;
  }
  // Pixelkoordinate unter dem Zeiger — Badge folgt dem Cursor.
  function koordenBinden(schau, N) {
    schau.addEventListener('pointermove', e => {
      const r = schau.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / Math.max(1, r.width) * N);
      const y = Math.floor((e.clientY - r.top) / Math.max(1, r.height) * N);
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      const k = $('koordAnzeige');
      k.hidden = false;
      k.textContent = t('px.koord', { x: x, y: y });
      k.style.left = (e.clientX + 14) + 'px';
      k.style.top = (e.clientY + 16) + 'px';
    });
    schau.addEventListener('pointerleave', () => { $('koordAnzeige').hidden = true; });
  }

  function wischZelle(c, px, p) {
    const schau = schauBasis(px);
    schau.classList.add('wisch');
    if (c.alt) schau.appendChild(svgLayer(c.alt, p.alt, 'alt'));
    const klipp = document.createElement('div');
    klipp.className = 'wischklipp';
    klipp.style.width = Math.round(wischPos * 100) + '%';
    if (c.neu) {
      const img = svgLayer(c.neu, p.neu, 'neu');
      img.style.width = px + 'px'; img.style.height = px + 'px';
      klipp.appendChild(img);
    }
    schau.appendChild(klipp);
    const griff = document.createElement('div');
    griff.className = 'wischgriff';
    griff.style.left = Math.round(wischPos * 100) + '%';
    schau.appendChild(griff);
    const li = document.createElement('span');
    li.className = 'wischkante links'; li.textContent = t('wisch.links');
    const re = document.createElement('span');
    re.className = 'wischkante rechts'; re.textContent = t('wisch.rechts');
    schau.appendChild(li); schau.appendChild(re);

    let zieht = false;
    const setzen = e => {
      const r = schau.getBoundingClientRect();
      wischPos = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
      wischAnwenden();
    };
    schau.addEventListener('pointerdown', e => {
      zieht = true; schau.setPointerCapture(e.pointerId); setzen(e); e.preventDefault();
    });
    schau.addEventListener('pointermove', e => { if (zieht) setzen(e); });
    const ende = e => { zieht = false; try { schau.releasePointerCapture(e.pointerId); } catch (err) {} };
    schau.addEventListener('pointerup', ende);
    schau.addEventListener('pointercancel', ende);
    return schau;
  }
  // Nur die Griffposition nachziehen — kein Neuaufbau der Zellen.
  function wischAnwenden() {
    const pr = Math.round(wischPos * 1000) / 10 + '%';
    $('zellen').querySelectorAll('.wischklipp').forEach(el => { el.style.width = pr; });
    $('zellen').querySelectorAll('.wischgriff').forEach(el => { el.style.left = pr; });
  }

  function blinkStoppen() {
    if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = null; }
    $('zellen').classList.remove('blinkNeu');
  }
  function blinkStarten() {
    blinkStoppen();
    if (vglModus !== 'blinken' || blinkPause) return;
    $('zellen').classList.add('blinkNeu');
    blinkTimer = setInterval(() => {
      $('zellen').classList.toggle('blinkNeu');
    }, 600);
  }

  function renderVektor() {
    if (!letzterDiff) return;
    const p = palette();
    const z = $('zellen');
    blinkStoppen();
    z.textContent = '';
    z.className = 'zeile' + (vglModus === 'blinken' ? ' blink' : '');
    z.classList.toggle('ohneAlt', !$('chkAlt').checked && vglModus === 'ueberlagern');
    z.classList.toggle('ohneNeu', !$('chkNeu').checked && vglModus === 'ueberlagern');
    letzterDiff.zellen.forEach(c => {
      const px = c.N * zoom;
      if (vglModus === 'neben') {
        [['alt', c.alt, p.alt, t('wisch.links')], ['neu', c.neu, p.neu, t('wisch.rechts')]].forEach(paar => {
          const zelle = document.createElement('div');
          zelle.className = 'zelle';
          const schau = schauBasis(px);
          if (paar[1]) schau.appendChild(svgLayer(paar[1], paar[2], paar[0]));
          else {
            const leer = document.createElement('div');
            leer.className = 'leer';
            leer.textContent = t('diff.nuralt');
            schau.appendChild(leer);
          }
          koordenBinden(schau, c.N);
          zelle.appendChild(schau);
          const lbl = zellenLabel(c, paar[3]);
          lbl.style.width = px + 'px';
          zelle.appendChild(lbl);
          z.appendChild(zelle);
        });
        return;
      }
      const zelle = document.createElement('div');
      zelle.className = 'zelle';
      let schau;
      if (vglModus === 'wischen' && c.alt && c.neu) {
        schau = wischZelle(c, px, p);
      } else {
        schau = schauBasis(px);
        if (c.alt) schau.appendChild(svgLayer(c.alt, p.alt, 'alt'));
        if (c.neu) schau.appendChild(svgLayer(c.neu, p.neu, 'neu'));
        koordenBinden(schau, c.N);
      }
      zelle.appendChild(schau);
      const lbl = zellenLabel(c, (!c.alt && vglModus !== 'ueberlagern') ? t('zelle.neu') : '');
      lbl.style.width = px + 'px';
      zelle.appendChild(lbl);
      z.appendChild(zelle);
    });
    if (vglModus === 'blinken') blinkStarten();
  }

  // ---- Pixelansicht --------------------------------------------------------
  function pxGroessenSetzen() {
    $('pxzellen').querySelectorAll('.pxzelle').forEach(el => {
      const N = Number(el.dataset.n) || 0;
      const b = (N * zoom) || 0;
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
    const sig = skala + '|' + (dunkel ? 1 : 0) + '|' + (zoom >= 8 ? 8 : 1);
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
      if (zoom >= 8 && c.pngNeu8) bild = (await analysiere(c.pngNeu8, false, dunkel)).c;
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

  // ---- Differenz -----------------------------------------------------------
  function dfGroessenSetzen() {
    $('dfzellen').querySelectorAll('.dfzelle').forEach(el => {
      const N = Number(el.dataset.n) || 0;
      const b = (N * zoom) || 0;
      el.querySelectorAll('canvas, .leer').forEach(c => {
        c.style.width = b + 'px'; c.style.height = b + 'px';
      });
      const l = el.querySelector('.label');
      if (l) l.style.width = b + 'px';
    });
  }
  // |alt − neu| je Pixel bei der gewählten Rasterung.
  async function renderDifferenz() {
    if (!letzterDiff) return;
    const skala = rasterSkala();
    const sig = skala + '|' + (dunkel ? 1 : 0);
    if (dfQuelle === letzterDiff && dfSig === sig) { dfGroessenSetzen(); return; }
    dfQuelle = letzterDiff; dfSig = sig;
    const p = palette();
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
          if (diff > 0.02) { farbe = p.weg; alpha = diff; anders++; }
          else if (diff < -0.02) { farbe = p.dazu; alpha = -diff; anders++; }
          else if (a > 0.02) { farbe = p.beide; alpha = a * 0.3; }
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

  function kopfZeichnen() {
    $('diff').classList.add('an');
    $('diff').classList.toggle('dunkel', dunkel);
    MODI.forEach(m => $('diff').classList.toggle('modus-' + m, vglModus === m));
    $('lagenSchalter').hidden = vglModus !== 'ueberlagern';
    $('blinkHinweis').hidden = vglModus !== 'blinken';
    try { $('segModus').setAttribute('value', vglModus); } catch (e) {}
    $('zoomWertAnzeige').textContent = zoom + '×';
    try { $('zoomRegler').value = zoom; } catch (e) {}
  }

  function renderDiff() {
    if (!letzterDiff) return;
    kopfZeichnen();
    renderVektor();
    renderPixel();
    renderDifferenz();
  }
  function zoomSetzen(w) {
    const neu = Math.max(3, Math.min(32, Math.round(w)));
    if (neu === zoom) return;
    zoom = neu;
    kopfZeichnen();
    renderVektor();
    // renderPixel/renderDifferenz bauen nur neu, wenn sich die Signatur
    // ändert (z. B. der Sprung auf das 8×-PNG ab Zoom 8) — sonst skalieren
    // sie die vorhandenen Canvas bloß neu.
    renderPixel();
    renderDifferenz();
  }
  // Fit: alle Größen passen nebeneinander in die Bühne (Lücke 16 px).
  function zoomFit() {
    if (!letzterDiff || !letzterDiff.zellen.length) return;
    const faktor = vglModus === 'neben' ? 2 : 1;
    const anzahl = letzterDiff.zellen.length * faktor;
    const summeN = letzterDiff.zellen.reduce((s, c) => s + (c.N || 0), 0) * faktor;
    const platz = Math.max(60, $('buehne').clientWidth - 6 - 16 * Math.max(0, anzahl - 1));
    zoomSetzen(Math.floor(platz / Math.max(1, summeN)));
  }

  function modusSetzen(m, melden) {
    if (MODI.indexOf(m) < 0 || m === vglModus) return;
    vglModus = m;
    blinkStoppen();
    kopfZeichnen();
    if (letzterDiff) renderVektor();
    if (melden) send({ type: 'merkerSetzen', schluessel: 'vergleichsmodus', wert: vglModus });
  }
  bei('merker', m => {
    if (!m || m.schluessel !== 'vergleichsmodus') return;
    if (MODI.indexOf(m.wert) < 0) return;
    vglModus = m.wert;
    kopfZeichnen();
    if (letzterDiff) renderVektor();
  });
  send({ type: 'merkerLaden', schluessel: 'vergleichsmodus' });

  $('segModus').addEventListener('change', e => {
    modusSetzen(String((e && e.detail) || $('segModus').value || 'ueberlagern'), true);
  });
  $('chkAlt').addEventListener('change', e => $('zellen').classList.toggle('ohneAlt', !e.target.checked));
  $('chkNeu').addEventListener('change', e => $('zellen').classList.toggle('ohneNeu', !e.target.checked));
  $('chkDunkel').addEventListener('change', e => { dunkel = !!e.target.checked; renderDiff(); });
  $('segRaster').addEventListener('change', () => { renderPixel(); renderDifferenz(); });
  $('segRaster').addEventListener('click', () => requestAnimationFrame(() => { renderPixel(); renderDifferenz(); }));
  $('zoomRegler').addEventListener('input', e => { const v = +e.target.value; if (v) zoomSetzen(v); });
  $('zoomRegler').addEventListener('change', e => { const v = +e.target.value; if (v) zoomSetzen(v); });
  $('zoomMinus').addEventListener('click', () => zoomSetzen(zoom - 1));
  $('zoomPlus').addEventListener('click', () => zoomSetzen(zoom + 1));
  $('zoomFit').addEventListener('click', zoomFit);
  $('zoomWertAnzeige').addEventListener('dblclick', () => zoomSetzen(6));

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
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomSetzen(zoom + 1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomSetzen(zoom - 1); }
    else if (e.key === '0') { e.preventDefault(); zoomFit(); }
    else if (e.key === ' ' && vglModus === 'blinken' && !blinkPause) {
      e.preventDefault(); blinkPause = true; blinkStoppen();
      $('blinkHinweis').textContent = t('blink.pausiert');
    }
  });
  document.addEventListener('keyup', e => {
    if (e.key !== ' ' || !blinkPause) return;
    blinkPause = false;
    $('blinkHinweis').textContent = t('blink.hinweis');
    if (vglModus === 'blinken') blinkStarten();
  });

  (() => {
    const el = $('buehne');
    el.addEventListener('wheel', e => {
      if (!letzterDiff || !e.ctrlKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const alt = zoom;
      const neu = Math.max(3, Math.min(32, zoom + (e.deltaY < 0 ? 1 : -1)));
      if (neu === alt) return;
      const f = neu / alt;
      const sx = (el.scrollLeft + cx) * f - cx;
      const sy = (el.scrollTop + cy) * f - cy;
      zoomSetzen(neu);
      el.scrollLeft = sx; el.scrollTop = sy;
    }, { passive: false });

    let aktiv = false, px = 0, py = 0, sx = 0, sy = 0;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.schau.wisch, fig-header, fig-button, fig-slider, fig-switch, fig-segmented-control, fig-segment, label, input, button')) return;
      aktiv = true; px = e.clientX; py = e.clientY;
      sx = el.scrollLeft; sy = el.scrollTop;
      el.classList.add('zieht'); el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!aktiv) return;
      el.scrollLeft = sx - (e.clientX - px);
      el.scrollTop  = sy - (e.clientY - py);
    });
    const ende = e => { aktiv = false; el.classList.remove('zieht');
      try { el.releasePointerCapture(e.pointerId); } catch (err) {} };
    el.addEventListener('pointerup', ende);
    el.addEventListener('pointercancel', ende);
  })();
