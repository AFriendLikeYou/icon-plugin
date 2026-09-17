// Baut ui.html: figui3 (vendored) + eigenes Layout/Logik. Aufruf: node gen-ui.mjs
import fs from 'fs';
const figCss = fs.readFileSync(new URL('./fig.css', import.meta.url), 'utf8');
const figJs  = fs.readFileSync(new URL('./fig.js',  import.meta.url), 'utf8');

const css = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-size: 11px; line-height: 1.5;
    color: var(--figma-color-text, #1c1c22);
    background: var(--figma-color-bg, #fff);
    margin: 0; padding: 12px 14px 16px;
    display: flex; flex-direction: column; gap: 10px; height: 100vh;
    overflow: hidden;
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: var(--figma-color-border, #e3e3e6); border-radius: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }

  .kopf { display: flex; align-items: center; gap: 10px; }
  .marke { flex: none; display: flex; align-items: flex-end; gap: 2px; }
  .marke i { display: block; border-radius: 2px; background: var(--figma-color-bg-brand, #0d99ff); }
  .marke i:nth-child(1) { width: 7px;  height: 7px;  opacity: .45; }
  .marke i:nth-child(2) { width: 9px;  height: 9px;  opacity: .7; }
  .marke i:nth-child(3) { width: 12px; height: 12px; }
  .kopf h1 { font-size: 13px; font-weight: 700; margin: 0; }

  body > fig-tooltip { display: block; }
  #auswahl { width: 100%; min-height: 34px; justify-content: flex-start; gap: 9px; }
  #auswahl.aktiv { border-color: var(--figma-color-border-brand, #0d99ff); }
  #auswahl .name { font-weight: 600; }
  #auswahl .hinweis { color: var(--figma-color-text-secondary, #6e6e76); }
  .chip { margin-left: auto; flex: none; display: none; font-size: 9.5px; font-weight: 700;
    padding: 2px 9px; border-radius: 10px; }
  .chip.gruen { display: inline-block; background: #12a76a; color: #fff; }
  .chip.rot { display: inline-block; background: #c2402a; color: #fff; }
  .chip.blau { display: inline-block; background: var(--figma-color-bg-brand, #0d99ff);
    color: var(--figma-color-text-onbrand, #fff); }

  .reihe { display: flex; gap: 8px; }
  .reihe fig-button { flex: 1; }

  .gruppe {
    display: flex; flex-direction: column; gap: 8px;
    border: 1px solid var(--figma-color-border, #e3e3e6);
    border-radius: 8px; padding: 9px 12px 11px;
  }
  .gruppenkopf { font-size: 9px; font-weight: 700; letter-spacing: .07em;
    text-transform: uppercase; color: var(--figma-color-text-secondary, #6e6e76); }
  .optzeile { display: flex; gap: 18px; align-items: center; }
  .optzeile fig-switch { font-size: 10.5px; white-space: nowrap; }

  .fortschritt { visibility: hidden; display: flex; gap: 9px; align-items: center; height: 16px; flex: none; }
  .fortschritt.an { visibility: visible; }
  .fortschritt fig-spinner { width: 12px; height: 12px; flex: none; }
  .balkenrahmen { flex: 1; height: 4px; border-radius: 2px; overflow: hidden;
    background: var(--figma-color-bg-secondary, #f0f0f3); }
  .balken { height: 100%; width: 0%; background: var(--figma-color-bg-brand, #0d99ff);
    border-radius: 2px; transition: width .18s ease; }
  .fortschritt .zahl { font-variant-numeric: tabular-nums; font-size: 10px;
    color: var(--figma-color-text-secondary, #6e6e76); white-space: nowrap; }
  .fazit { display: none; border-radius: 6px; padding: 6px 10px; font-weight: 600; font-size: 10.5px; }
  .fazit.gruen { display: block; background: rgba(18,167,106,.1); color: #0e8a57; }
  .fazit.rot { display: block; background: rgba(194,64,42,.1); color: #c2402a; }

  #diff { display: none; border: 1px solid var(--figma-color-border, #e3e3e6);
    border-radius: 8px; padding: 10px 12px; background: var(--figma-color-bg-secondary, #fafafc);
    flex: 2 1 auto; min-height: 220px; }
  #diff.an { display: flex; flex-direction: column; }
  #diff .diffkopf { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .seklabel { margin-right: auto; font-size: 9px; font-weight: 700;
    letter-spacing: .07em; text-transform: uppercase;
    color: var(--figma-color-text-secondary, #6e6e76); }
  .chips { display: flex; gap: 14px; align-items: center; flex: none; }
  .chips fig-switch { font-size: 9.5px; white-space: nowrap; }
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block;
    margin-right: 5px; flex: none; vertical-align: 0; }
  .dot.alt { background: #d3308f; } .dot.neu { background: #0e8a9a; }
  .ctlLabel { font-size: 9.5px; color: var(--figma-color-text-secondary, #6e6e76); }
  .zoom { display: flex; align-items: center; gap: 4px; flex: none; }
  .zoom fig-slider { width: 84px; }
  .zoom fig-button { min-width: 22px; }
  .zwert { font-size: 9px; width: 20px; text-align: right; cursor: pointer;
    font-variant-numeric: tabular-nums; color: var(--figma-color-text-secondary, #6e6e76); }


  .buehne { overflow: auto; flex: 1 1 auto; min-height: 0; cursor: grab;
    user-select: none; overscroll-behavior: contain; padding-bottom: 4px; }
  .buehne.zieht { cursor: grabbing; }
  .buehne img { pointer-events: none; -webkit-user-drag: none; }
  .sektion { position: sticky; left: 0; z-index: 1; width: max-content;
    display: flex; align-items: center; gap: 12px; padding: 2px 0 7px;
    background: var(--figma-color-bg-secondary, #fafafc); }
  .sektion .klein { color: var(--figma-color-text-tertiary, #9a9aa0); font-size: 9px; }
  .trennlinie { min-width: 100%; border-top: 2px solid var(--figma-color-border, #cfcfd6);
    margin: 12px 0; }
  .zeile { display: flex; gap: 16px; align-items: flex-end; width: max-content; }
  .zelle, .pxzelle { flex: none; }
  .zelle .schau { position: relative; border-radius: 4px;
    border: 1px solid var(--figma-color-border, #e3e3e6);
    box-shadow: 0 1px 3px rgba(0,0,0,.07);
    background:
      repeating-linear-gradient(to right,  rgba(120,120,140,.28) 0 1px, transparent 1px 100%),
      repeating-linear-gradient(to bottom, rgba(120,120,140,.28) 0 1px, transparent 1px 100%),
      repeating-linear-gradient(to right,  rgba(120,120,140,.12) 0 1px, transparent 1px 100%),
      repeating-linear-gradient(to bottom, rgba(120,120,140,.12) 0 1px, transparent 1px 100%),
      #fff; }
  .zelle .schau img { position: absolute; inset: 0; width: 100%; height: 100%; mix-blend-mode: multiply; }
  .zelle .label, .pxzelle .label { font-size: 9px; color: var(--figma-color-text-secondary, #6e6e76);
    margin-top: 5px; font-variant-numeric: tabular-nums; text-align: center;
    white-space: pre-line; line-height: 1.4; }
  #zellen.ohneAlt img.lage-alt { display: none; }
  #zellen.ohneNeu img.lage-neu { display: none; }
  .pxzelle .wrap { border-radius: 4px; overflow: hidden;
    border: 1px solid var(--figma-color-border, #e3e3e6);
    box-shadow: 0 1px 3px rgba(0,0,0,.07); background: #fff; }
  .pxzelle canvas { display: block; image-rendering: pixelated; }

  .fortschritt fig-spinner { width: 14px; height: 14px; flex: none; }
  .optionen fig-tooltip { display: inline-flex; }
  #segRaster { flex: none; }
  #dlgAlle { max-width: 320px; border: none; border-radius: 10px; padding: 0; }
  #dlgAlle p { margin: 0; line-height: 1.55; color: var(--figma-color-text-secondary, #6e6e76); }
  .dlg-aktionen { display: flex; gap: 8px; justify-content: flex-end; padding: 4px 12px 12px; }
  .logblock { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 96px; }
  .logkopf { display: flex; align-items: center; justify-content: space-between;
    font-size: 9px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
    color: var(--figma-color-text-secondary, #6e6e76); padding: 0 2px 4px; }
  .logkopf fig-button { font-size: 9px; height: 18px; letter-spacing: 0; text-transform: none; }
  .log {
    flex: 1; overflow-y: auto; border-radius: 8px; padding: 8px 12px;
    border: 1px solid var(--figma-color-border, #d9d9de);
    background: var(--figma-color-bg, #fff);
    font: 10.5px/1.75 "SF Mono", ui-monospace, Menlo, monospace;
    white-space: pre-wrap; word-break: break-word;
  }
  .log div + div { border-top: 1px solid color-mix(in srgb, var(--figma-color-border, #e3e3e6) 45%, transparent); }
  .log .ok::before   { content: "\\2713 "; color: #12a76a; }
  .log .warn::before { content: "\\25B3 "; color: #c98a12; }
  .log .err::before  { content: "\\2715 "; color: #c2402a; }
  .log:empty::before { content: "Noch nichts gelaufen.";
    color: var(--figma-color-text-tertiary, #9a9aa0); font-style: italic;
    font-family: Inter, sans-serif; }
`;

// ============================================================================
// LIBRARY-MODUS (Audit + „Alle neu bauen" + Bestätigungsdialog):
// vorerst ausgeblendet. Für den späteren Einbau LIBRARY_MODUS auf true setzen
// und neu generieren (node gen-ui.mjs) — Markup, Logik und code.js-Seite
// (audit/alle/Auto-Audit) bleiben vollständig erhalten und funktionsfähig.
// ============================================================================
const LIBRARY_MODUS = false;

const libGruppe = LIBRARY_MODUS ? `
<div class="gruppe">
  <div class="gruppenkopf">Library — alle Icons</div>
  <div class="reihe">
    <fig-button id="btnAudit" variant="secondary">Audit</fig-button>
    <fig-button id="btnAlle" variant="destructiveSecondary">Alle neu bauen</fig-button>
  </div>
</div>` : '';

const libDialog = LIBRARY_MODUS ? `
${libDialog}` : '';

const markup = `
<div class="kopf">
  <div class="marke"><i></i><i></i><i></i></div>
  <h1>ZDS Icon Pipeline</h1>
</div>

<div class="gruppe">
  <div class="gruppenkopf">Icon</div>
  <fig-tooltip text="Klick: Karte im Canvas anzeigen" delay="600">
    <fig-button variant="input" id="auswahl">
      <fig-truncate class="hinweis" id="auswahlText">Karte auswählen …</fig-truncate>
      <span class="chip" id="auswahlStatus"></span>
    </fig-button>
  </fig-tooltip>
  <div class="reihe">
    <fig-button id="btnDiff" variant="secondary" disabled>Vorschau</fig-button>
    <fig-button id="btnRun" disabled>Icon bauen</fig-button>
  </div>
  <div class="optzeile">
    <fig-tooltip text="Gerade Kanten und Kurven-Scheitel aufs 0,5-px-Raster, 24er auf ganze Pixel. Das AA-Orakel behält automatisch die schärfere Fassung. Gilt fürs Durchziehen und für „Alle neu bauen"." delay="400">
      <fig-switch id="chkSnap">Pixel-Snapping</fig-switch>
    </fig-tooltip>
    <fig-tooltip text="Ungeplättete Fassung auf der Source-Seite, kantenidentisch zur Library. Wird nicht publiziert." delay="400">
      <fig-switch id="chkStroke">Stroke-Fassung ablegen</fig-switch>
    </fig-tooltip>
  </div>
</div>

${libGruppe}

<div class="fazit" id="fazit"></div>

<div class="fortschritt" id="fortschritt">
  <fig-spinner aria-label="läuft"></fig-spinner>
  <div class="balkenrahmen"><div class="balken" id="balken"></div></div>
  <div class="zahl" id="zahl"></div>
</div>

<div id="diff">
  <div class="diffkopf">
    <span class="seklabel">Vektor</span>
    <div class="chips">
      <fig-switch id="chkAlt" checked><span class="dot alt"></span>aktuell</fig-switch>
      <fig-switch id="chkNeu" checked><span class="dot neu"></span>neu</fig-switch>
    </div>
    <div class="zoom">
      <fig-button id="zoomMinus" variant="ghost" title="kleiner">−</fig-button>
      <fig-slider id="zoomRegler" min="3" max="32" step="1" value="6" text="false"></fig-slider>
      <fig-button id="zoomPlus" variant="ghost" title="größer">+</fig-button>
      <span class="zwert" id="zoomWertAnzeige" title="Doppelklick: zurück auf 6×">6×</span>
    </div>
  </div>
  <div class="buehne" id="buehne">
    <div class="zeile" id="zellen"></div>
    <div class="trennlinie"></div>
    <div class="sektion">
      <span class="seklabel" style="margin-right:0">Pixelansicht</span>
      <div class="chips">
        <span class="ctlLabel">Rasterung</span>
        <fig-segmented-control id="segRaster" value="1">
          <fig-segment value="1" selected="true">1×</fig-segment>
          <fig-segment value="2">2×</fig-segment>
        </fig-segmented-control>
      </div>
      <span class="klein">weniger AA = schärfer</span>
    </div>
    <div class="zeile" id="pxzellen"></div>
  </div>
</div>

<div class="logblock">
  <div class="logkopf"><span>Protokoll</span>
    <fig-button id="btnLeeren" variant="ghost">Leeren</fig-button>
  </div>
  <div class="log" id="log"></div>
</div>

${libDialog}
`;

const logik = `
  const $ = id => document.getElementById(id);
  const send = m => parent.postMessage({ pluginMessage: m }, '*');
  const aus = (el, on) => el.toggleAttribute('disabled', !!on);
  let beschaeftigt = false, hatAuswahl = false;
  let zoom = 6, letzterDiff = null;

  function chipLeeren() { const c = $('auswahlStatus'); c.className = 'chip'; c.textContent = ''; }
  function sperren(an) {
    beschaeftigt = an;
    if (an) chipLeeren();
    aus($('btnRun'), an || !hatAuswahl);
    aus($('btnDiff'), an || !hatAuswahl);
    if ($('btnAudit')) aus($('btnAudit'), an);
    if ($('btnAlle')) aus($('btnAlle'), an);
    $('fortschritt').classList.toggle('an', an);
    if (!an) { $('balken').style.width = '0%'; $('zahl').textContent = ''; }
  }
  function zeile(text, art) {
    const d = document.createElement('div');
    if (art) d.className = art;
    d.textContent = text;
    $('log').appendChild(d);
    $('log').scrollTop = $('log').scrollHeight;
  }
  function svgLayer(svg, farbe, lage) {
    const gefaerbt = svg.replace(/fill="[^"]*"/g, 'fill="' + farbe + '"')
                        .replace(/fill:[^;"]*/g, 'fill:' + farbe);
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(gefaerbt);
    img.className = 'lage-' + lage;
    return img;
  }

  $('auswahl').addEventListener('click', () => {
    if (hatAuswahl && !beschaeftigt) send({ type: 'fokus' });
  });
  $('btnRun').addEventListener('click', () => { if (!beschaeftigt && hatAuswahl) {
    $('fazit').className = 'fazit'; sperren(true);
    send({ type: 'run', snap: !!$('chkSnap').checked, stroke: !!$('chkStroke').checked }); } });
  $('btnDiff').addEventListener('click', () => { if (!beschaeftigt && hatAuswahl) {
    $('fazit').className = 'fazit'; sperren(true);
    send({ type: 'vorschau', snap: !!$('chkSnap').checked }); } });
  // Library-Modus (siehe LIBRARY_MODUS oben) — Bindings nur bei eingebauter Gruppe
  if ($('btnAudit')) $('btnAudit').addEventListener('click', () => { if (!beschaeftigt) {
    $('fazit').className = 'fazit'; $('log').textContent = ''; sperren(true);
    send({ type: 'audit' }); } });
  // Snapping-Schalter aktualisiert eine offene Vorschau sofort —
  // die „neu"-Ebene zeigt sonst einen veralteten Zustand.
  $('btnLeeren').addEventListener('click', () => { $('log').textContent = ''; });
  function einstellungMelden() {
    send({ type: 'einstellung', snap: !!$('chkSnap').checked, stroke: !!$('chkStroke').checked });
  }
  $('chkStroke').addEventListener('change', einstellungMelden);
  $('chkSnap').addEventListener('change', () => {
    einstellungMelden();
    if (letzterDiff && hatAuswahl && !beschaeftigt) {
      $('fazit').className = 'fazit';
      sperren(true);
      send({ type: 'vorschau', snap: !!$('chkSnap').checked });
    }
  });

  if ($('btnAlle')) {
    $('btnAlle').addEventListener('click', () => {
      if (beschaeftigt) return;
      try { $('dlgAlle').showModal(); } catch (e) { $('dlgAlle').setAttribute('open', ''); }
    });
    $('dlgAbbruch').addEventListener('click', () => $('dlgAlle').close());
    $('dlgOk').addEventListener('click', () => {
      $('dlgAlle').close();
      $('fazit').className = 'fazit'; $('log').textContent = '';
      sperren(true);
      send({ type: 'alle', snap: !!$('chkSnap').checked, stroke: !!$('chkStroke').checked });
    });
  }

  onmessage = e => {
    const m = e.data.pluginMessage; if (!m) return;
    if (m.type === 'auswahl') {
      const vorher = $('auswahlText').textContent;
      hatAuswahl = !!m.karte;
      $('auswahl').classList.toggle('aktiv', hatAuswahl);
      $('auswahlText').textContent = hatAuswahl ? m.karte : 'Karte auswählen …';
      $('auswahlText').className = hatAuswahl ? 'name' : 'hinweis';
      if (vorher !== $('auswahlText').textContent) chipLeeren();
      if (!beschaeftigt) { aus($('btnRun'), !hatAuswahl); aus($('btnDiff'), !hatAuswahl); }
    }
    if (m.type === 'log') zeile(m.text, m.art || '');
    if (m.type === 'progress') {
      $('balken').style.width = Math.round(100 * m.i / m.n) + '%';
      $('zahl').textContent = m.i + '/' + m.n + (m.name ? ' · ' + m.name : '');
    }
    if (m.type === 'fazit') {
      if (m.beiAuswahl) {
        const c = $('auswahlStatus');
        c.className = 'chip ' + (m.gut ? 'gruen' : 'rot');
        c.textContent = m.text;
      } else {
        $('fazit').className = 'fazit ' + (m.gut ? 'gruen' : 'rot');
        $('fazit').textContent = m.text;
      }
    }
    if (m.type === 'diff') {
      letzterDiff = m;
      renderDiff();
      const c = $('auswahlStatus');
      c.className = 'chip blau';
      c.textContent = 'Vorschau';
    }
    if (m.type === 'mess') {
      (async () => {
        const werte = [];
        for (const p of m.paare) {
          try {
            const r1 = await analysiere(p.px1, false);
            const fehler = await treue(p.px1, p.px8);
            werte.push({ aa: r1.aa, fehler });
          } catch (err) { werte.push({ aa: 999, fehler: 999 }); }
        }
        send({ type: 'messwert', id: m.id, werte });
      })();
    }
    if (m.type === 'einstellungen') {
      ['chkSnap', 'chkStroke'].forEach(id => {
        const an = id === 'chkSnap' ? m.snap : m.stroke;
        const el = $(id);
        el.toggleAttribute('checked', !!an);
        try { el.checked = !!an; } catch (err) {}
      });
    }
    if (m.type === 'fertig') sperren(false);
  };

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

  async function analysiere(bytes, markieren) {
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
    }
    if (markieren) g.putImageData(id, 0, 0);
    const belegt = voll + teil;
    return { c, aa: belegt ? Math.round(100 * teil / belegt) : 0 };
  }

  async function renderPixel() {
    if (!letzterDiff) return;
    const mark = false;
    const retina = String($('segRaster').value) === '2';
    const skala = retina ? 2 : 1;
    const z = $('pxzellen'); z.textContent = '';
    for (const c of letzterDiff.zellen) {
      const bytesNeu = retina && c.pngNeu2 ? c.pngNeu2 : c.pngNeu;
      const bytesAlt = retina ? c.pngAlt2 : c.pngAlt;
      const zelle = document.createElement('div'); zelle.className = 'pxzelle';
      const wrap = document.createElement('div'); wrap.className = 'wrap';
      const neu = await analysiere(bytesNeu, mark);
      neu.c.style.width = (neu.c.width * zoom / skala) + 'px';
      neu.c.style.height = (neu.c.height * zoom / skala) + 'px';
      wrap.appendChild(neu.c);
      const label = document.createElement('div'); label.className = 'label';
      label.style.width = (neu.c.width * zoom / skala) + 'px';
      let text = c.N + ' px · AA ' + neu.aa + ' %';
      if (bytesAlt) { const alt = await analysiere(bytesAlt, false);
        text += '\\naktuell ' + alt.aa + ' %'; }
      if (c.guete) {
        const d = c.guete.plain.fehler > 1e-9
          ? Math.round((1 - c.guete.snap.fehler / c.guete.plain.fehler) * 100) : 0;
        text += '\\nHinting: ' + (c.guete.mitSnap
          ? (d > 0 ? 'Fehler −' + d + ' %' : 'gleichwertig')
          : 'ohne Wirkung');
      }
      label.textContent = text;
      zelle.appendChild(wrap); zelle.appendChild(label);
      z.appendChild(zelle);
    }
  }

  function renderDiff() {
    if (!letzterDiff) return;
    const m = letzterDiff;
    $('diff').classList.add('an');
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
      if (c.alt) schau.appendChild(svgLayer(c.alt, '#d3308f', 'alt'));
      schau.appendChild(svgLayer(c.neu, '#0e8a9a', 'neu'));
      const label = document.createElement('div'); label.className = 'label';
      label.style.width = px + 'px';
      const z2 = [];
      if (c.gerastet) z2.push(c.gerastet + ' Kanten gerastet');
      if (!c.alt) z2.push('neu');
      label.textContent = c.N + ' px · ' + (c.ist == null ? '?' : c.ist.toFixed(2)) + '/' + c.soll
        + (z2.length ? '\\n' + z2.join(' · ') : '');
      zelle.appendChild(schau); zelle.appendChild(label);
      z.appendChild(zelle);
    });
    renderPixel();
  }
  function zoomSetzen(w) { zoom = Math.max(3, Math.min(32, w)); renderDiff(); }
  $('chkAlt').addEventListener('change', e => $('zellen').classList.toggle('ohneAlt', !e.target.checked));
  $('chkNeu').addEventListener('change', e => $('zellen').classList.toggle('ohneNeu', !e.target.checked));
  $('segRaster').addEventListener('change', () => renderPixel());
  $('segRaster').addEventListener('click', () => requestAnimationFrame(() => renderPixel()));
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

  send({ type: 'init' });
`;

const html = [
  '<style>', figCss, '</style>',
  '<style>', css, '</style>',
  markup,
  '<script type="module">', figJs, '</scr' + 'ipt>',
  '<script>', logik, '</scr' + 'ipt>'
].join('\n');

fs.writeFileSync(new URL('./ui.html', import.meta.url), html);
console.log('ui.html gebaut:', html.length, 'Zeichen');
