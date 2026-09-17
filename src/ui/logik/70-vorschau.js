  // =========================================================================
  // Vorschau — Vektor, Pixel, Differenz
  // =========================================================================
  const FARBEN = {
    hell:  { alt: '#d3308f', neu: '#0e8a9a', weg: [211, 48, 143], dazu: [14, 138, 154], beide: [110, 110, 126] },
    dunk:  { alt: '#ff7ad0', neu: '#4fe3f0', weg: [255, 122, 208], dazu: [79, 227, 240], beide: [170, 170, 186] }
  };
  function palette() { return dunkel ? FARBEN.dunk : FARBEN.hell; }

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
  // Treue: RMS-Abweichung der echten 1×-Rasterung von der idealen
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

  async function renderPixel() {
    if (!letzterDiff) return;
    const skala = rasterSkala();
    const z = $('pxzellen'); z.textContent = '';
    for (const c of letzterDiff.zellen) {
      const bytesNeu = skala === 2 && c.pngNeu2 ? c.pngNeu2 : c.pngNeu;
      const bytesAlt = skala === 2 ? c.pngAlt2 : c.pngAlt;
      if (!bytesNeu) continue;
      const zelle = document.createElement('div'); zelle.className = 'pxzelle';
      const wrap = document.createElement('div'); wrap.className = 'wrap';
      // AA wird immer auf der gewählten Rasterung gemessen; angezeigt wird ab
      // Zoom 8 das 8×-PNG (schärfste Stufe), sonst das hochskalierte Raster.
      const mess = await analysiere(bytesNeu, false, dunkel);
      let bild = mess.c;
      if (zoom >= 8 && c.pngNeu8) bild = (await analysiere(c.pngNeu8, false, dunkel)).c;
      const breite = (c.N || 0) * zoom;
      bild.style.width = (breite || bild.width) + 'px';
      bild.style.height = (breite || bild.height) + 'px';
      wrap.appendChild(bild);
      const label = document.createElement('div'); label.className = 'label';
      label.style.width = (breite || bild.width) + 'px';
      let text = zahl(c.N) + ' px · ' + t('pixel.aa', { aa: mess.aa });
      if (bytesAlt) {
        const alt = await analysiere(bytesAlt, false, false);
        text += '\n' + t('pixel.alt', { aa: alt.aa });
      }
      if (c.guete) {
        const d = c.guete.plain.fehler > 1e-9
          ? Math.round((1 - c.guete.snap.fehler / c.guete.plain.fehler) * 100) : 0;
        text += '\n' + t('pixel.hint', { v: c.guete.mitSnap
          ? (d > 0 ? t('hint.fehler', { d: d }) : t('hint.gleich'))
          : t('hint.ohne') });
      }
      label.textContent = text;
      zelle.appendChild(wrap); zelle.appendChild(label);
      z.appendChild(zelle);
    }
  }

  // |alt − neu| je Pixel bei der gewählten Rasterung.
  async function renderDifferenz() {
    if (!letzterDiff) return;
    const skala = rasterSkala();
    const p = palette();
    const z = $('dfzellen'); z.textContent = '';
    for (const c of letzterDiff.zellen) {
      const bytesNeu = skala === 2 && c.pngNeu2 ? c.pngNeu2 : c.pngNeu;
      const bytesAlt = skala === 2 ? c.pngAlt2 : c.pngAlt;
      if (!bytesNeu) continue;
      const zelle = document.createElement('div'); zelle.className = 'dfzelle';
      const wrap = document.createElement('div'); wrap.className = 'wrap';
      const breite = (c.N || 0) * zoom;
      const label = document.createElement('div'); label.className = 'label';
      label.style.width = breite + 'px';
      if (!bytesAlt) {
        const leer = document.createElement('div');
        leer.className = 'leer';
        leer.style.width = breite + 'px';
        leer.style.height = breite + 'px';
        leer.textContent = t('diff.nuralt');
        wrap.appendChild(leer);
        label.textContent = zahl(c.N) + ' px · ' + t('zelle.neu');
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
        cv.style.width = (breite || w) + 'px';
        cv.style.height = (breite || h) + 'px';
        wrap.appendChild(cv);
        label.textContent = zahl(c.N) + ' px · ' + anders + ' px';
      }
      zelle.appendChild(wrap); zelle.appendChild(label);
      z.appendChild(zelle);
    }
  }

  function zellenLabel(c) {
    const teile = [];
    teile.push(zahl(c.N) + ' px');
    if (c.soll != null) teile.push(t('zelle.keyline', {
      ist: c.ist == null ? '?' : zahl(c.ist.toFixed(2)), soll: zahl(c.soll) }));
    const zwei = [];
    if (c.kontur != null || c.raster != null) zwei.push(t('zelle.masse', {
      k: zahl(c.kontur == null ? '?' : c.kontur), r: zahl(c.raster == null ? '?' : c.raster) }));
    if (c.radius != null) zwei.push(t('zelle.radius', {
      v: (typeof c.radius === 'object')
        ? (t('radius.' + c.radius.modus) + (c.radius.modus === 'fest' ? ' ' + zahl(c.radius.wert) : ''))
        : zahl(c.radius) }));
    const drei = [];
    if (c.gerastet) drei.push(t('zelle.gerastet', { n: c.gerastet }));
    if (!c.alt) drei.push(t('zelle.neu'));
    let s = teile.join(' · ');
    if (zwei.length) s += '\n' + zwei.join(' · ');
    if (drei.length) s += '\n' + drei.join(' · ');
    return s;
  }

  function renderDiff() {
    if (!letzterDiff) return;
    const m = letzterDiff;
    const p = palette();
    $('diff').classList.add('an');
    $('diff').classList.toggle('dunkel', dunkel);
    $('zoomWertAnzeige').textContent = zoom + '×';
    try { $('zoomRegler').value = zoom; } catch (e) {}
    const z = $('zellen'); z.textContent = '';
    m.zellen.forEach(c => {
      const zelle = document.createElement('div'); zelle.className = 'zelle';
      const schau = document.createElement('div'); schau.className = 'schau';
      const px = c.N * zoom;
      schau.style.width = px + 'px'; schau.style.height = px + 'px';
      schau.style.backgroundSize = zoom + 'px ' + zoom + 'px, ' + zoom + 'px ' + zoom + 'px, '
        + (zoom / 2) + 'px ' + (zoom / 2) + 'px, ' + (zoom / 2) + 'px ' + (zoom / 2) + 'px, auto';
      if (c.alt) schau.appendChild(svgLayer(c.alt, p.alt, 'alt'));
      if (c.neu) schau.appendChild(svgLayer(c.neu, p.neu, 'neu'));
      const label = document.createElement('div'); label.className = 'label';
      label.style.width = px + 'px';
      label.textContent = zellenLabel(c);
      zelle.appendChild(schau); zelle.appendChild(label);
      z.appendChild(zelle);
    });
    renderPixel();
    renderDifferenz();
  }
  function zoomSetzen(w) { zoom = Math.max(3, Math.min(32, w)); renderDiff(); }

  $('chkAlt').addEventListener('change', e => $('zellen').classList.toggle('ohneAlt', !e.target.checked));
  $('chkNeu').addEventListener('change', e => $('zellen').classList.toggle('ohneNeu', !e.target.checked));
  $('chkDunkel').addEventListener('change', e => { dunkel = !!e.target.checked; renderDiff(); });
  $('segRaster').addEventListener('change', () => { renderPixel(); renderDifferenz(); });
  $('segRaster').addEventListener('click', () => requestAnimationFrame(() => { renderPixel(); renderDifferenz(); }));
  $('zoomRegler').addEventListener('input', e => { const v = +e.target.value; if (v) zoomSetzen(v); });
  $('zoomRegler').addEventListener('change', e => { const v = +e.target.value; if (v) zoomSetzen(v); });
  $('zoomMinus').addEventListener('click', () => zoomSetzen(zoom - 1));
  $('zoomPlus').addEventListener('click', () => zoomSetzen(zoom + 1));
  $('zoomWertAnzeige').addEventListener('dblclick', () => zoomSetzen(6));

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
      if (e.target.closest('fig-button, fig-slider, fig-switch, fig-segmented-control, fig-segment, label, input, button')) return;
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

