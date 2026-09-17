// Baut ui.html: figui3 (vendored) + eigenes Layout/Logik. Aufruf: node gen-ui.mjs
// GENERIERT ui.html — ui.html nie von Hand editieren.
//
// Aufbau dieser Datei:
//   1. css       — eigene Styles (figui3-CSS wird davor eingebettet)
//   2. WOERTER   — Wörterbuch de/en, wird als JSON in die Logik geschrieben
//   3. markup    — statisches Markup; sichtbare Texte stehen NICHT im Markup,
//                  sondern werden über data-t / data-t-text / data-t-ph aus t() gesetzt
//   4. logik     — das UI-Skript (klassisch, läuft vor dem figui3-Modul)
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
    margin: 0; padding: 10px 14px 14px;
    display: flex; flex-direction: column; gap: 9px; height: 100vh;
    overflow: hidden;
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: var(--figma-color-border, #e3e3e6); border-radius: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }

  .kopf { display: flex; align-items: center; gap: 10px; flex: none; }
  .marke { flex: none; display: flex; align-items: flex-end; gap: 2px; }
  .marke i { display: block; border-radius: 2px; background: var(--figma-color-bg-brand, #0d99ff); }
  .marke i:nth-child(1) { width: 7px;  height: 7px;  opacity: .45; }
  .marke i:nth-child(2) { width: 9px;  height: 9px;  opacity: .7; }
  .marke i:nth-child(3) { width: 12px; height: 12px; }
  .kopf h1 { font-size: 13px; font-weight: 700; margin: 0; }
  .kopf .kopfchip { margin-left: auto; }

  body > fig-tabs { flex: none; }
  .panel { display: flex; flex-direction: column; gap: 9px; flex: 1 1 auto; min-height: 0; }
  .panel[hidden] { display: none; }
  #panelCfg { overflow-y: auto; padding-right: 2px; gap: 12px; }

  body > fig-tooltip { display: block; }
  .auswahlzeile { display: flex; flex-direction: column; gap: 6px; }
  #auswahl { width: 100%; min-height: 34px; justify-content: flex-start; gap: 9px; }
  #auswahl.aktiv { border-color: var(--figma-color-border-brand, #0d99ff); }
  #auswahl .name { font-weight: 600; }
  #auswahl .hinweis { color: var(--figma-color-text-secondary, #6e6e76); }
  .chip { flex: none; display: none; font-size: 9.5px; font-weight: 700;
    padding: 2px 9px; border-radius: 10px; white-space: nowrap; }
  .chip.gruen { display: inline-block; background: #12a76a; color: #fff; }
  .chip.rot { display: inline-block; background: #c2402a; color: #fff; }
  .chip.blau { display: inline-block; background: var(--figma-color-bg-brand, #0d99ff);
    color: var(--figma-color-text-onbrand, #fff); }
  .chip.grau { display: inline-block; background: var(--figma-color-bg-secondary, #f0f0f3);
    color: var(--figma-color-text-secondary, #6e6e76); }
  .chip.geraten { display: inline-block; background: rgba(201,138,18,.16); color: #8a6208; }
  #auswahl .fueller { margin-left: auto; }
  .klassenzeile { display: flex; align-items: center; gap: 8px; }
  .klassenzeile fig-dropdown { flex: 1; }

  .reihe { display: flex; gap: 8px; }
  .reihe fig-button { flex: 1; }

  .gruppe {
    display: flex; flex-direction: column; gap: 8px;
    border: 1px solid var(--figma-color-border, #e3e3e6);
    border-radius: 8px; padding: 9px 12px 11px; flex: none;
  }
  .gruppenkopf { font-size: 9px; font-weight: 700; letter-spacing: .07em;
    text-transform: uppercase; color: var(--figma-color-text-secondary, #6e6e76); }
  .optzeile { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .optzeile fig-switch { font-size: 10.5px; white-space: nowrap; }

  .fortschritt { visibility: hidden; display: flex; gap: 9px; align-items: center; height: 16px; flex: none; }
  .fortschritt.an { visibility: visible; }
  .fortschritt fig-spinner { width: 14px; height: 14px; flex: none; }
  .balkenrahmen { flex: 1; height: 4px; border-radius: 2px; overflow: hidden;
    background: var(--figma-color-bg-secondary, #f0f0f3); }
  .balken { height: 100%; width: 0%; background: var(--figma-color-bg-brand, #0d99ff);
    border-radius: 2px; transition: width .18s ease; }
  .fortschritt .zahl { font-variant-numeric: tabular-nums; font-size: 10px;
    color: var(--figma-color-text-secondary, #6e6e76); white-space: nowrap; }
  .fazit { display: none; border-radius: 6px; padding: 6px 10px; font-weight: 600; font-size: 10.5px; flex: none; }
  .fazit.gruen { display: block; background: rgba(18,167,106,.1); color: #0e8a57; }
  .fazit.rot { display: block; background: rgba(194,64,42,.1); color: #c2402a; }

  #diff { display: none; border: 1px solid var(--figma-color-border, #e3e3e6);
    border-radius: 8px; padding: 10px 12px; background: var(--figma-color-bg-secondary, #fafafc);
    flex: 2 1 auto; min-height: 220px; }
  #diff.an { display: flex; flex-direction: column; }
  #diff .diffkopf { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  .seklabel { margin-right: auto; font-size: 9px; font-weight: 700;
    letter-spacing: .07em; text-transform: uppercase;
    color: var(--figma-color-text-secondary, #6e6e76); }
  .chips { display: flex; gap: 14px; align-items: center; flex: none; }
  .chips fig-switch { font-size: 9.5px; white-space: nowrap; }
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block;
    margin-right: 5px; flex: none; vertical-align: 0; }
  .dot.alt { background: #d3308f; } .dot.neu { background: #0e8a9a; }
  .dot.weg { background: #d3308f; } .dot.dazu { background: #0e8a9a; }
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
  .zelle, .pxzelle, .dfzelle { flex: none; }
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
  .zelle .label, .pxzelle .label, .dfzelle .label {
    font-size: 9px; color: var(--figma-color-text-secondary, #6e6e76);
    margin-top: 5px; font-variant-numeric: tabular-nums; text-align: center;
    white-space: pre-line; line-height: 1.4; }
  #zellen.ohneAlt img.lage-alt { display: none; }
  #zellen.ohneNeu img.lage-neu { display: none; }
  .pxzelle .wrap, .dfzelle .wrap { border-radius: 4px; overflow: hidden;
    border: 1px solid var(--figma-color-border, #e3e3e6);
    box-shadow: 0 1px 3px rgba(0,0,0,.07); background: #fff; }
  .pxzelle canvas, .dfzelle canvas { display: block; image-rendering: pixelated; }
  .dfzelle .leer { display: flex; align-items: center; justify-content: center;
    color: var(--figma-color-text-tertiary, #9a9aa0); font-size: 9px; }

  /* dunkler Grund: Bühne, Zellen und Onionskin-Mischung umstellen */
  #diff.dunkel .buehne { background: #1e1e1e; }
  #diff.dunkel .sektion { background: #1e1e1e; }
  #diff.dunkel .seklabel, #diff.dunkel .ctlLabel, #diff.dunkel .sektion .klein,
  #diff.dunkel .zelle .label, #diff.dunkel .pxzelle .label, #diff.dunkel .dfzelle .label { color: #b9b9c2; }
  #diff.dunkel .zelle .schau {
    border-color: #3a3a42;
    background:
      repeating-linear-gradient(to right,  rgba(200,200,220,.26) 0 1px, transparent 1px 100%),
      repeating-linear-gradient(to bottom, rgba(200,200,220,.26) 0 1px, transparent 1px 100%),
      repeating-linear-gradient(to right,  rgba(200,200,220,.11) 0 1px, transparent 1px 100%),
      repeating-linear-gradient(to bottom, rgba(200,200,220,.11) 0 1px, transparent 1px 100%),
      #1e1e1e; }
  #diff.dunkel .zelle .schau img { mix-blend-mode: screen; }
  #diff.dunkel .pxzelle .wrap, #diff.dunkel .dfzelle .wrap { background: #1e1e1e; border-color: #3a3a42; }
  #diff.dunkel .dot.alt, #diff.dunkel .dot.weg { background: #ff7ad0; }
  #diff.dunkel .dot.neu, #diff.dunkel .dot.dazu { background: #4fe3f0; }

  .optionen fig-tooltip { display: inline-flex; }
  #segRaster { flex: none; }
  dialog[is="fig-dialog"] { max-width: 330px; border: none; border-radius: 10px; padding: 0; }
  dialog[is="fig-dialog"] p { margin: 0; line-height: 1.55; color: var(--figma-color-text-secondary, #6e6e76); }
  .dlg-text { padding: 4px 12px 8px; }
  .dlg-aktionen { display: flex; gap: 8px; justify-content: flex-end; padding: 4px 12px 12px; }
  .dlg-wahl { display: flex; flex-direction: column; gap: 6px; padding: 8px 12px 4px; }

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
  .log > div + div { border-top: 1px solid color-mix(in srgb, var(--figma-color-border, #e3e3e6) 45%, transparent); }
  .log .ok > .txt::before   { content: "\\2713 "; color: #12a76a; }
  .log .warn > .txt::before { content: "\\25B3 "; color: #c98a12; }
  .log .err > .txt::before  { content: "\\2715 "; color: #c2402a; }
  .log .hinw { color: var(--figma-color-text-tertiary, #9a9aa0); padding-left: 14px; }
  .log .zeigen { color: var(--figma-color-text-brand, #0d99ff); cursor: pointer;
    text-decoration: underline; margin-left: 6px; font-family: Inter, sans-serif; }
  .log .leermeldung { color: var(--figma-color-text-tertiary, #9a9aa0); font-style: italic;
    font-family: Inter, sans-serif; border: none; }

  /* ---- Einstellungen ---------------------------------------------------- */
  .cfgblock { display: flex; flex-direction: column; gap: 8px;
    border: 1px solid var(--figma-color-border, #e3e3e6); border-radius: 8px;
    padding: 9px 12px 12px; flex: none; }
  .feld { display: flex; align-items: center; gap: 8px; }
  .feld > .fname { flex: none; width: 108px; color: var(--figma-color-text-secondary, #6e6e76); }
  .feld > fig-dropdown, .feld > fig-input-text, .feld > fig-input-number { flex: 1; min-width: 0; }
  .vier { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 8px; }
  .vier .feld > .fname { width: 62px; }
  .groessekarte { border: 1px solid var(--figma-color-border, #e3e3e6); border-radius: 7px;
    padding: 7px 9px 9px; display: flex; flex-direction: column; gap: 6px;
    background: var(--figma-color-bg, #fff); }
  .gkopf { display: flex; align-items: center; gap: 8px; }
  .gkopf .gtitel { font-weight: 700; font-variant-numeric: tabular-nums; }
  .gkopf .rechts { margin-left: auto; display: flex; align-items: center; gap: 6px; }
  .gkopf fig-radio { font-size: 9.5px; white-space: nowrap; }
  .gzeilen { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 8px; }
  .gzeilen .feld > .fname { width: 54px; }
  .keyauf { align-self: flex-start; font-size: 9.5px; }
  .keyblock[hidden] { display: none; }
  .keyblock { border-top: 1px dashed var(--figma-color-border, #e3e3e6); padding-top: 6px; }
  .keyzeile { display: flex; align-items: center; gap: 6px; }
  .keyviz { display: flex; gap: 12px; align-items: flex-start; margin: 2px 0 8px; }
  .keyviz svg { flex: none; border-radius: 4px; border: 1px solid var(--figma-color-border, #e3e3e6); background: #fff; }
  .keyviz .legende { display: flex; flex-direction: column; gap: 3px; font-size: 9.5px;
    color: var(--figma-color-text-secondary, #6e6e76); font-variant-numeric: tabular-nums; }
  .keyviz .legende span { display: flex; align-items: center; gap: 6px; }
  .keyviz .legende i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; flex: none; }
  .keyviz .legende i.rund { border-radius: 50%; }
  .keyzeile .keykurz { font-size: 9.5px; color: var(--figma-color-text-secondary, #6e6e76); font-variant-numeric: tabular-nums; }
  .keyhinweis { font-size: 9.5px; color: var(--figma-color-text-secondary, #6e6e76); margin: 2px 0 6px; line-height: 1.4; }
  .keyprop { font-size: 9.5px; align-self: flex-start; }
  fig-input-number.unplausibel { outline: 1px solid #c98a12; border-radius: 4px; }
  .ungueltig { outline: 1px solid #c98a12; outline-offset: 1px; border-radius: 4px; }
  .fehlerbox { border-radius: 6px; padding: 7px 10px; font-size: 10px;
    background: rgba(201,138,18,.12); color: #8a6208; }
  .fehlerbox ul { margin: 4px 0 0; padding-left: 16px; }
  .cfgaktionen { display: flex; gap: 8px; padding-bottom: 4px; }
  .cfgaktionen fig-button { flex: 1; }
  .varsuche { margin-bottom: 4px; }
  .varliste { max-height: 190px; overflow-y: auto; border-radius: 6px;
    border: 1px solid var(--figma-color-border, #e3e3e6); padding: 4px; }
  .varzeile { display: flex; align-items: center; gap: 7px; padding: 3px 5px;
    border-radius: 4px; cursor: pointer; }
  .varzeile:hover { background: var(--figma-color-bg-secondary, #f0f0f3); }
  .varzeile.gewaehlt { background: var(--figma-color-bg-brand-tertiary, rgba(13,153,255,.14)); }
  .varzeile .vname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .varzeile .vkoll { flex: none; color: var(--figma-color-text-tertiary, #9a9aa0); font-size: 9px; }
  .varleer { padding: 6px; color: var(--figma-color-text-tertiary, #9a9aa0); font-style: italic; }
  .gewaehltzeile { display: flex; align-items: center; gap: 7px; margin-top: 6px; }
  .platte { width: 12px; height: 12px; border-radius: 3px; flex: none;
    border: 1px solid var(--figma-color-border, #e3e3e6); }
  fig-group.kollektion { margin-bottom: 0; }
`;

// ===========================================================================
// Wörterbuch. Platzhalter im Format {name}.
// ===========================================================================
const WOERTER = {
  de: {
    'titel': 'Icon Pipeline',
    'tab.icon': 'Icon',
    'tab.cfg': 'Einstellungen',
    'adapter.zds': 'ZDS',
    'adapter.frei': 'Frei',

    'gruppe.icon': 'Icon',
    'auswahl.leer': 'Icon auswählen …',
    'auswahl.tip': 'Klick: im Canvas zeigen',
    'btn.vorschau': 'Vorschau',
    'btn.bauen': 'Icon bauen',
    'tip.snap': 'Gerade Kanten und Kurven-Scheitel aufs eingestellte Raster. Das AA-Orakel behält automatisch die schärfere Fassung. Gilt fürs Durchziehen und für „Alle neu bauen“.',
    'chk.snap': 'Pixel-Snapping',
    'tip.stroke': 'Ungeplättete Fassung neben der Source, kantenidentisch zum Ergebnis. Wird nicht publiziert.',
    'chk.stroke': 'Stroke-Fassung ablegen',
    'klasse.label': 'Klasse',
    'klasse.geraten': 'geraten',

    'gruppe.library': 'Library — alle Icons',
    'btn.audit': 'Audit',
    'btn.alle': 'Alle neu bauen',
    'dlg.alle.titel': 'Alle Icons neu bauen?',
    'dlg.alle.text': 'Jedes Icon wird neu durchgezogen. Bestehende Varianten werden überschrieben. Das kann eine Weile dauern.',
    'btn.abbrechen': 'Abbrechen',
    'btn.alleOk': 'Alle neu bauen',

    'diff.vektor': 'Vektor',
    'diff.aktuell': 'aktuell',
    'diff.neu': 'neu',
    'diff.dunkel': 'dunkler Grund',
    'diff.pixel': 'Pixelansicht',
    'diff.rasterung': 'Rasterung',
    'diff.schaerfe': 'weniger AA = schärfer',
    'diff.differenz': 'Differenz',
    'diff.weg': 'nur alt',
    'diff.dazu': 'nur neu',
    'diff.nuralt': 'kein bestehendes Set',
    'zoom.kleiner': 'kleiner',
    'zoom.groesser': 'größer',
    'zoom.zurueck': 'Doppelklick: zurück auf 6×',

    'zelle.keyline': 'Keyline {ist}/{soll}',
    'zelle.masse': 'Kontur {k} · Raster {r}',
    'zelle.gerastet': '{n} Kanten gerastet',
    'zelle.radius': 'Radius {v}',
    'zelle.neu': 'neu',
    'pixel.aa': 'AA {aa} %',
    'pixel.alt': 'aktuell {aa} %',
    'pixel.hint': 'Hinting: {v}',
    'hint.fehler': 'Fehler −{d} %',
    'hint.gleich': 'gleichwertig',
    'hint.ohne': 'ohne Wirkung',

    'log.titel': 'Protokoll',
    'btn.leeren': 'Leeren',
    'log.leer': 'Noch nichts gelaufen.',
    'log.zeigen': 'zeigen',

    'cfg.allgemein': 'Allgemein',
    'cfg.adapter': 'Adapter',
    'cfg.sprache': 'Sprache',
    'cfg.variantenProperty': 'Variantenproperty',
    'opt.auto': 'automatisch',
    'opt.zds': 'ZDS',
    'opt.frei': 'Frei',
    'opt.de': 'Deutsch',
    'opt.en': 'Englisch',

    'cfg.master': 'Master',
    'cfg.masterGroesse': 'Größe',
    'cfg.masterKontur': 'Kontur',
    'cfg.keylines': 'Keylines',

    'cfg.groessen': 'Größen',
    'cfg.N': 'N (px)',
    'cfg.kontur': 'Kontur',
    'cfg.raster': 'Raster',
    'cfg.rasterGrob': 'Grob',
    'cfg.radiusModus': 'Radius',
    'cfg.radiusWert': 'Wert',
    'cfg.radiusMin': 'Min',
    'cfg.standard': 'Standard',
    'cfg.entfernen': 'Größe entfernen',
    'cfg.keylinesAuf': 'Keylines',
    'cfg.keylinesProp': 'proportional neu berechnen',
    'cfg.keylinesLegende': 'Kasten {N} px · Pixelraster · Formklassen: Square, Circular, Wide, Tall',
    'cfg.keylinesHinweis': 'Die Keyline ist die Größe des Icon-Körpers im {N}-px-Kasten. Sie folgt N automatisch, bis du sie von Hand änderst.',
    'cfg.keylineUnplausibel': 'Keyline {wert} passt nicht zu N = {N} (erwartet zwischen {min} und {N}).',
    'btn.groesseHinzu': 'Größe hinzufügen',
    'opt.aus': 'aus',
    'radius.proportional': 'proportional',
    'radius.fest': 'fest',
    'radius.keine': 'keine',

    'cfg.farbe': 'Farbe',
    'farbe.source': 'Source',
    'farbe.hex': 'Hex',
    'farbe.variable': 'Variable',
    'farbe.suche': 'Variable suchen …',
    'farbe.lokal': 'Lokale Variablen',
    'farbe.leer': 'Keine Farbvariablen gefunden.',
    'farbe.laden': 'Variablen werden geladen …',
    'farbe.angleichen': 'Source-Farbe angleichen',
    'farbe.gewaehlt': 'Gewählt',
    'farbe.unaufloesbar': 'Variable nicht auflösbar.',

    'btn.speichern': 'Speichern',
    'btn.zuruecksetzen': 'Zurücksetzen',
    'dlg.reset.titel': 'Einstellungen zurücksetzen',
    'dlg.reset.text': 'Auf welches Profil soll zurückgesetzt werden? Die aktuelle Konfiguration wird ersetzt.',
    'profil.zds': 'ZDS-Profil (72 px Source, 14/18/24)',
    'profil.generic': 'Allgemein (24 px Source, 16/20/24)',
    'btn.resetOk': 'Zurücksetzen',
    'fehler.kopf': 'Angepasst beim Prüfen:',
    'hinweis.korrigiert': 'Wert wurde beim Prüfen korrigiert',
    'toast.gespeichert': 'Einstellungen gespeichert'
  },
  en: {
    'titel': 'Icon Pipeline',
    'tab.icon': 'Icon',
    'tab.cfg': 'Settings',
    'adapter.zds': 'ZDS',
    'adapter.frei': 'Free',

    'gruppe.icon': 'Icon',
    'auswahl.leer': 'Select an icon …',
    'auswahl.tip': 'Click: reveal on canvas',
    'btn.vorschau': 'Preview',
    'btn.bauen': 'Build icon',
    'tip.snap': 'Snaps straight edges and curve extrema to the configured grid. The AA oracle keeps whichever version is sharper. Applies to single builds and to “Rebuild all”.',
    'chk.snap': 'Pixel snapping',
    'tip.stroke': 'Unflattened version next to the source, edge-identical to the result. Not published.',
    'chk.stroke': 'Keep stroke version',
    'klasse.label': 'Class',
    'klasse.geraten': 'guessed',

    'gruppe.library': 'Library — all icons',
    'btn.audit': 'Audit',
    'btn.alle': 'Rebuild all',
    'dlg.alle.titel': 'Rebuild all icons?',
    'dlg.alle.text': 'Every icon is rebuilt. Existing variants are overwritten. This may take a while.',
    'btn.abbrechen': 'Cancel',
    'btn.alleOk': 'Rebuild all',

    'diff.vektor': 'Vector',
    'diff.aktuell': 'current',
    'diff.neu': 'new',
    'diff.dunkel': 'dark background',
    'diff.pixel': 'Pixel view',
    'diff.rasterung': 'Rasterization',
    'diff.schaerfe': 'less AA = sharper',
    'diff.differenz': 'Difference',
    'diff.weg': 'old only',
    'diff.dazu': 'new only',
    'diff.nuralt': 'no existing set',
    'zoom.kleiner': 'smaller',
    'zoom.groesser': 'larger',
    'zoom.zurueck': 'Double click: back to 6×',

    'zelle.keyline': 'keyline {ist}/{soll}',
    'zelle.masse': 'stroke {k} · grid {r}',
    'zelle.gerastet': '{n} edges snapped',
    'zelle.radius': 'radius {v}',
    'zelle.neu': 'new',
    'pixel.aa': 'AA {aa} %',
    'pixel.alt': 'current {aa} %',
    'pixel.hint': 'Hinting: {v}',
    'hint.fehler': 'error −{d} %',
    'hint.gleich': 'equivalent',
    'hint.ohne': 'no effect',

    'log.titel': 'Log',
    'btn.leeren': 'Clear',
    'log.leer': 'Nothing has run yet.',
    'log.zeigen': 'show',

    'cfg.allgemein': 'General',
    'cfg.adapter': 'Adapter',
    'cfg.sprache': 'Language',
    'cfg.variantenProperty': 'Variant property',
    'opt.auto': 'automatic',
    'opt.zds': 'ZDS',
    'opt.frei': 'Free',
    'opt.de': 'German',
    'opt.en': 'English',

    'cfg.master': 'Master',
    'cfg.masterGroesse': 'Size',
    'cfg.masterKontur': 'Stroke',
    'cfg.keylines': 'Keylines',

    'cfg.groessen': 'Sizes',
    'cfg.N': 'N (px)',
    'cfg.kontur': 'Stroke',
    'cfg.raster': 'Grid',
    'cfg.rasterGrob': 'Coarse',
    'cfg.radiusModus': 'Radius',
    'cfg.radiusWert': 'Value',
    'cfg.radiusMin': 'Min',
    'cfg.standard': 'Default',
    'cfg.entfernen': 'Remove size',
    'cfg.keylinesAuf': 'Keylines',
    'cfg.keylinesProp': 'recompute proportionally',
    'cfg.keylinesLegende': 'Box {N} px · pixel grid · shape classes: Square, Circular, Wide, Tall',
    'cfg.keylinesHinweis': 'The keyline is the size of the icon body inside the {N} px box. It follows N automatically until you edit it by hand.',
    'cfg.keylineUnplausibel': 'Keyline {wert} does not fit N = {N} (expected between {min} and {N}).',
    'btn.groesseHinzu': 'Add size',
    'opt.aus': 'off',
    'radius.proportional': 'proportional',
    'radius.fest': 'fixed',
    'radius.keine': 'none',

    'cfg.farbe': 'Color',
    'farbe.source': 'Source',
    'farbe.hex': 'Hex',
    'farbe.variable': 'Variable',
    'farbe.suche': 'Search variable …',
    'farbe.lokal': 'Local variables',
    'farbe.leer': 'No color variables found.',
    'farbe.laden': 'Loading variables …',
    'farbe.angleichen': 'Match source color',
    'farbe.gewaehlt': 'Selected',
    'farbe.unaufloesbar': 'Variable cannot be resolved.',

    'btn.speichern': 'Save',
    'btn.zuruecksetzen': 'Reset',
    'dlg.reset.titel': 'Reset settings',
    'dlg.reset.text': 'Which profile should be restored? The current configuration is replaced.',
    'profil.zds': 'ZDS profile (72 px source, 14/18/24)',
    'profil.generic': 'Generic (24 px source, 16/20/24)',
    'btn.resetOk': 'Reset',
    'fehler.kopf': 'Adjusted while checking:',
    'hinweis.korrigiert': 'value was corrected while checking',
    'toast.gespeichert': 'Settings saved'
  }
};

const markup = `
<div class="kopf">
  <div class="marke"><i></i><i></i><i></i></div>
  <h1 data-t="titel"></h1>
  <span class="chip grau kopfchip" id="adapterChip"></span>
</div>

<fig-tabs id="tabs" value="icon">
  <fig-tab value="icon" selected="true"><span data-t="tab.icon"></span></fig-tab>
  <fig-tab value="cfg"><span data-t="tab.cfg"></span></fig-tab>
</fig-tabs>

<div class="panel" id="panelIcon">

  <div class="gruppe">
    <div class="gruppenkopf" data-t="gruppe.icon"></div>
    <div class="auswahlzeile">
      <fig-tooltip data-t-text="auswahl.tip" delay="600">
        <fig-button variant="input" id="auswahl">
          <fig-truncate class="hinweis" id="auswahlText"></fig-truncate>
          <span class="fueller"></span>
          <span class="chip grau" id="klasseChip"></span>
          <span class="chip" id="auswahlStatus"></span>
        </fig-button>
      </fig-tooltip>
      <div class="klassenzeile" id="klassenzeile" hidden>
        <span class="ctlLabel" data-t="klasse.label"></span>
        <fig-dropdown id="klasseSel">
          <option value="Square">Square</option>
          <option value="Circular">Circular</option>
          <option value="Wide">Wide</option>
          <option value="Tall">Tall</option>
        </fig-dropdown>
        <span class="chip geraten" id="klasseGeraten" hidden></span>
      </div>
    </div>
    <div class="reihe">
      <fig-button id="btnDiff" variant="secondary" disabled data-t="btn.vorschau"></fig-button>
      <fig-button id="btnRun" disabled data-t="btn.bauen"></fig-button>
    </div>
    <div class="optzeile">
      <fig-tooltip data-t-text="tip.snap" delay="400">
        <fig-switch id="chkSnap"><span data-t="chk.snap"></span></fig-switch>
      </fig-tooltip>
      <fig-tooltip data-t-text="tip.stroke" delay="400">
        <fig-switch id="chkStroke"><span data-t="chk.stroke"></span></fig-switch>
      </fig-tooltip>
    </div>
  </div>

  <div class="gruppe">
    <div class="gruppenkopf" data-t="gruppe.library"></div>
    <div class="reihe">
      <fig-button id="btnAudit" variant="secondary" data-t="btn.audit"></fig-button>
      <fig-button id="btnAlle" variant="destructiveSecondary" data-t="btn.alle"></fig-button>
    </div>
  </div>

  <div class="fazit" id="fazit"></div>

  <div class="fortschritt" id="fortschritt">
    <fig-spinner aria-label="…"></fig-spinner>
    <div class="balkenrahmen"><div class="balken" id="balken"></div></div>
    <div class="zahl" id="zahl"></div>
  </div>

  <div id="diff">
    <div class="diffkopf">
      <span class="seklabel" data-t="diff.vektor"></span>
      <div class="chips">
        <fig-switch id="chkAlt" checked><span class="dot alt"></span><span data-t="diff.aktuell"></span></fig-switch>
        <fig-switch id="chkNeu" checked><span class="dot neu"></span><span data-t="diff.neu"></span></fig-switch>
        <fig-switch id="chkDunkel"><span data-t="diff.dunkel"></span></fig-switch>
      </div>
      <div class="zoom">
        <fig-button id="zoomMinus" variant="ghost" data-t-title="zoom.kleiner">−</fig-button>
        <fig-slider id="zoomRegler" min="3" max="32" step="1" value="6" text="false"></fig-slider>
        <fig-button id="zoomPlus" variant="ghost" data-t-title="zoom.groesser">+</fig-button>
        <span class="zwert" id="zoomWertAnzeige" data-t-title="zoom.zurueck">6×</span>
      </div>
    </div>
    <div class="buehne" id="buehne">
      <div class="zeile" id="zellen"></div>
      <div class="trennlinie"></div>
      <div class="sektion">
        <span class="seklabel" style="margin-right:0" data-t="diff.pixel"></span>
        <div class="chips">
          <span class="ctlLabel" data-t="diff.rasterung"></span>
          <fig-segmented-control id="segRaster" value="1">
            <fig-segment value="1" selected="true">1×</fig-segment>
            <fig-segment value="2">2×</fig-segment>
          </fig-segmented-control>
        </div>
        <span class="klein" data-t="diff.schaerfe"></span>
      </div>
      <div class="zeile" id="pxzellen"></div>
      <div class="trennlinie"></div>
      <div class="sektion">
        <span class="seklabel" style="margin-right:0" data-t="diff.differenz"></span>
        <div class="chips">
          <span class="ctlLabel"><span class="dot weg"></span><span data-t="diff.weg"></span></span>
          <span class="ctlLabel"><span class="dot dazu"></span><span data-t="diff.dazu"></span></span>
        </div>
      </div>
      <div class="zeile" id="dfzellen"></div>
    </div>
  </div>

  <div class="logblock">
    <div class="logkopf"><span data-t="log.titel"></span>
      <fig-button id="btnLeeren" variant="ghost" data-t="btn.leeren"></fig-button>
    </div>
    <div class="log" id="log"></div>
  </div>
</div>

<div class="panel" id="panelCfg" hidden>
  <div class="fehlerbox" id="cfgFehler" hidden>
    <div data-t="fehler.kopf"></div>
    <ul id="cfgFehlerListe"></ul>
  </div>

  <div class="cfgblock">
    <div class="gruppenkopf" data-t="cfg.allgemein"></div>
    <div class="feld">
      <span class="fname" data-t="cfg.adapter"></span>
      <fig-dropdown id="selAdapter" data-pfad="adapter">
        <option value="auto" data-t="opt.auto"></option>
        <option value="zds" data-t="opt.zds"></option>
        <option value="frei" data-t="opt.frei"></option>
      </fig-dropdown>
    </div>
    <div class="feld">
      <span class="fname" data-t="cfg.sprache"></span>
      <fig-dropdown id="selSprache" data-pfad="sprache">
        <option value="auto" data-t="opt.auto"></option>
        <option value="de" data-t="opt.de"></option>
        <option value="en" data-t="opt.en"></option>
      </fig-dropdown>
    </div>
    <div class="feld">
      <span class="fname" data-t="cfg.variantenProperty"></span>
      <fig-input-text id="inpVarProp" data-pfad="variantenProperty"></fig-input-text>
    </div>
  </div>

  <div class="cfgblock">
    <div class="gruppenkopf" data-t="cfg.master"></div>
    <div class="vier">
      <div class="feld">
        <span class="fname" data-t="cfg.masterGroesse"></span>
        <fig-input-number id="inpMasterGroesse" min="1" step="1" data-pfad="master.groesse"></fig-input-number>
      </div>
      <div class="feld">
        <span class="fname" data-t="cfg.masterKontur"></span>
        <fig-input-number id="inpMasterKontur" min="0.1" step="0.5" data-pfad="master.kontur"></fig-input-number>
      </div>
    </div>
    <div class="gruppenkopf" data-t="cfg.keylines"></div>
    <div id="masterKeyViz"></div>
    <div class="vier" id="masterKeylines"></div>
  </div>

  <div class="cfgblock">
    <div class="gruppenkopf" data-t="cfg.groessen"></div>
    <div id="groessen" style="display:flex;flex-direction:column;gap:8px"></div>
    <fig-button id="btnGroesseHinzu" variant="secondary" data-t="btn.groesseHinzu"></fig-button>
  </div>

  <div class="cfgblock">
    <div class="gruppenkopf" data-t="cfg.farbe"></div>
    <fig-segmented-control id="segFarbe" value="source" data-pfad="farbe.modus">
      <fig-segment value="source" selected="true"><span data-t="farbe.source"></span></fig-segment>
      <fig-segment value="hex"><span data-t="farbe.hex"></span></fig-segment>
      <fig-segment value="variable"><span data-t="farbe.variable"></span></fig-segment>
    </fig-segmented-control>
    <div id="farbeHex" hidden>
      <fig-input-color id="inpHex" alpha="false" data-pfad="farbe.hex"></fig-input-color>
    </div>
    <div id="farbeVariable" hidden>
      <fig-input-text id="varSuche" type="search" class="varsuche" data-t-ph="farbe.suche"></fig-input-text>
      <div class="varliste" id="varListe"></div>
      <div class="gewaehltzeile" id="varGewaehlt" hidden>
        <span class="ctlLabel" data-t="farbe.gewaehlt"></span>
        <span class="platte" id="varPlatte"></span>
        <span id="varName"></span>
      </div>
    </div>
    <fig-switch id="chkAngleichen" data-pfad="farbe.sourceAngleichen"><span data-t="farbe.angleichen"></span></fig-switch>
  </div>

  <div class="cfgaktionen">
    <fig-button id="btnZuruecksetzen" variant="secondary" data-t="btn.zuruecksetzen"></fig-button>
    <fig-button id="btnSpeichern" data-t="btn.speichern"></fig-button>
  </div>
</div>

<dialog is="fig-dialog" modal id="dlgAlle">
  <fig-header dialog-header><h3 data-t="dlg.alle.titel"></h3></fig-header>
  <div class="dlg-text"><p data-t="dlg.alle.text"></p></div>
  <div class="dlg-aktionen">
    <fig-button id="dlgAbbruch" variant="secondary" data-t="btn.abbrechen"></fig-button>
    <fig-button id="dlgOk" variant="destructive" data-t="btn.alleOk"></fig-button>
  </div>
</dialog>

<dialog is="fig-dialog" modal id="dlgReset">
  <fig-header dialog-header><h3 data-t="dlg.reset.titel"></h3></fig-header>
  <div class="dlg-text"><p data-t="dlg.reset.text"></p></div>
  <div class="dlg-wahl">
    <fig-radio name="profil" value="zds" id="profZds" checked><span data-t="profil.zds"></span></fig-radio>
    <fig-radio name="profil" value="generic" id="profGeneric"><span data-t="profil.generic"></span></fig-radio>
  </div>
  <div class="dlg-aktionen">
    <fig-button id="resetAbbruch" variant="secondary" data-t="btn.abbrechen"></fig-button>
    <fig-button id="resetOk" variant="destructive" data-t="btn.resetOk"></fig-button>
  </div>
</dialog>

<dialog is="fig-toast" id="toast" duration="2600"><span id="toastText"></span></dialog>
`;

const logik = `
  // =========================================================================
  // Grundlagen
  // =========================================================================
  const $ = id => document.getElementById(id);
  const send = m => parent.postMessage({ pluginMessage: m }, '*');
  const aus = (el, on) => { if (el) el.toggleAttribute('disabled', !!on); };
  const kopie = o => JSON.parse(JSON.stringify(o));

  const T = ${JSON.stringify(WOERTER)};
  const KLASSEN = ['Square', 'Circular', 'Wide', 'Tall'];
  const RASTER_WERTE = [1, 0.5, 0.25];

  function navSprache() {
    const s = (navigator.language || 'en').toLowerCase();
    return s.indexOf('de') === 0 ? 'de' : 'en';
  }
  let SPR = navSprache();
  function t(key, params) {
    const tab = T[SPR] || T.en;
    let s = tab[key];
    if (s == null) s = (T.en[key] == null ? key : T.en[key]);
    if (params) Object.keys(params).forEach(k => {
      s = s.split('{' + k + '}').join(String(params[k]));
    });
    return s;
  }
  // Zahl in der jeweiligen Sprache (Dezimaltrennzeichen).
  function zahl(v) {
    if (v == null || v === '') return '?';
    const s = String(v);
    return SPR === 'de' ? s.replace('.', ',') : s;
  }

  // Werte an figui3-Elemente: immer über Attribute, das Modul lädt erst nach
  // diesem Skript und liest beim Upgrade die Attribute.
  function wert(el, v) {
    if (!el) return;
    el.setAttribute('value', v == null ? '' : String(v));
    try { el.value = v; } catch (e) {}
  }
  function anhaken(el, an) {
    if (!el) return;
    el.toggleAttribute('checked', !!an);
    try { el.checked = !!an; } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .split('&').join('&amp;').split('<').join('&lt;')
      .split('>').join('&gt;').split('"').join('&quot;');
  }

  let beschaeftigt = false, hatAuswahl = false;
  let ziel = null;                 // letztes Ziel-Objekt aus 'auswahl'
  let zoom = 6, letzterDiff = null, dunkel = false;
  let logListe = [];
  let KONFIG = null, cfgLokal = null, adapterAktiv = '', konfigFehler = [];
  let farben = null, farbenAngefragt = false, farbSuche = '';
  let gesendeteKonfig = null, korrigiert = {};
  let keylinesOffen = {};

  // =========================================================================
  // Sprache / Texte
  // =========================================================================
  function effektiveSprache() {
    const s = KONFIG && KONFIG.sprache;
    if (!s || s === 'auto') return navSprache();
    return s === 'de' ? 'de' : 'en';
  }
  function texteSetzen() {
    document.querySelectorAll('[data-t]').forEach(el => {
      el.textContent = t(el.getAttribute('data-t'));
    });
    document.querySelectorAll('[data-t-text]').forEach(el => {
      el.setAttribute('text', t(el.getAttribute('data-t-text')));
    });
    document.querySelectorAll('[data-t-ph]').forEach(el => {
      el.setAttribute('placeholder', t(el.getAttribute('data-t-ph')));
    });
    document.querySelectorAll('[data-t-title]').forEach(el => {
      el.setAttribute('title', t(el.getAttribute('data-t-title')));
    });
    // Dropdowns spiegeln ihre <option>-Kinder in ein internes <select> —
    // nach Textwechsel neu einlesen lassen.
    document.querySelectorAll('fig-dropdown').forEach(d => {
      try { if (typeof d.slotChange === 'function') d.slotChange(); } catch (e) {}
    });
    auswahlZeichnen();
    protokollZeichnen();
    adapterChipSetzen();
    if (cfgLokal) { masterZeichnen(); groessenZeichnen(); farbeZeichnen(); }
    fehlerZeichnen();
    if (letzterDiff) renderDiff();
  }
  function spracheAbgleichen() {
    const neu = effektiveSprache();
    if (neu === SPR) return false;
    SPR = neu;
    texteSetzen();
    return true;
  }

  // =========================================================================
  // Tabs
  // =========================================================================
  $('tabs').addEventListener('change', e => {
    const v = (e && e.detail) || $('tabs').value || 'icon';
    $('panelIcon').hidden = v !== 'icon';
    $('panelCfg').hidden = v !== 'cfg';
    if (v === 'cfg') {
      if (!KONFIG) send({ type: 'konfigLaden' });
      if (cfgLokal && cfgLokal.farbe && cfgLokal.farbe.modus === 'variable') farbenAnfordern();
    }
  });

  // =========================================================================
  // Kopf / Auswahl
  // =========================================================================
  function adapterChipSetzen() {
    const c = $('adapterChip');
    if (!adapterAktiv) { c.textContent = ''; c.className = 'chip kopfchip'; return; }
    c.className = 'chip grau kopfchip';
    c.textContent = adapterAktiv === 'zds' ? t('adapter.zds') : t('adapter.frei');
  }
  function chipLeeren() { const c = $('auswahlStatus'); c.className = 'chip'; c.textContent = ''; }

  function auswahlZeichnen() {
    const txt = $('auswahlText');
    txt.textContent = hatAuswahl && ziel ? ziel.name : t('auswahl.leer');
    txt.className = hatAuswahl ? 'name' : 'hinweis';
    $('auswahl').classList.toggle('aktiv', hatAuswahl);

    const frei = !!(ziel && ziel.adapter === 'frei');
    const kchip = $('klasseChip');
    if (hatAuswahl && ziel && ziel.klasse && !frei) {
      kchip.className = 'chip grau';
      kchip.textContent = ziel.klasse + (ziel.klasseQuelle === 'heuristik' ? ' · ' + t('klasse.geraten') : '');
    } else { kchip.className = 'chip'; kchip.textContent = ''; }

    // Frei-Modus: Klasse ist änderbar.
    $('klassenzeile').hidden = !(hatAuswahl && frei);
    if (hatAuswahl && frei) {
      wert($('klasseSel'), ziel.klasse || 'Square');
      const g = $('klasseGeraten');
      g.hidden = ziel.klasseQuelle !== 'heuristik';
      g.textContent = t('klasse.geraten');
    }
  }

  $('auswahl').addEventListener('click', () => {
    if (hatAuswahl && !beschaeftigt) send({ type: 'fokus' });
  });
  $('klasseSel').addEventListener('change', e => {
    const k = (e && e.detail) || $('klasseSel').value;
    if (!k || !hatAuswahl || beschaeftigt) return;
    if (ziel && ziel.klasse === k) return;
    send({ type: 'klasseSetzen', klasse: k });
  });

  // =========================================================================
  // Laufsteuerung
  // =========================================================================
  function sperren(an) {
    beschaeftigt = an;
    if (an) chipLeeren();
    aus($('btnRun'), an || !hatAuswahl);
    aus($('btnDiff'), an || !hatAuswahl);
    aus($('btnAudit'), an);
    aus($('btnAlle'), an);
    $('fortschritt').classList.toggle('an', an);
    if (!an) { $('balken').style.width = '0%'; $('zahl').textContent = ''; }
  }
  $('btnRun').addEventListener('click', () => { if (!beschaeftigt && hatAuswahl) {
    $('fazit').className = 'fazit'; sperren(true);
    send({ type: 'run', snap: !!$('chkSnap').checked, stroke: !!$('chkStroke').checked }); } });
  $('btnDiff').addEventListener('click', () => { if (!beschaeftigt && hatAuswahl) {
    $('fazit').className = 'fazit'; sperren(true);
    send({ type: 'vorschau', snap: !!$('chkSnap').checked }); } });
  $('btnAudit').addEventListener('click', () => { if (!beschaeftigt) {
    $('fazit').className = 'fazit'; logLeeren(); sperren(true);
    send({ type: 'audit' }); } });
  $('btnLeeren').addEventListener('click', logLeeren);

  function einstellungMelden() {
    send({ type: 'einstellung', snap: !!$('chkSnap').checked, stroke: !!$('chkStroke').checked });
  }
  $('chkStroke').addEventListener('change', einstellungMelden);
  // Snapping-Schalter aktualisiert eine offene Vorschau sofort —
  // die „neu“-Ebene zeigt sonst einen veralteten Zustand.
  $('chkSnap').addEventListener('change', () => {
    einstellungMelden();
    if (letzterDiff && hatAuswahl && !beschaeftigt) {
      $('fazit').className = 'fazit';
      sperren(true);
      send({ type: 'vorschau', snap: !!$('chkSnap').checked });
    }
  });

  function dialogAuf(id) {
    const d = $(id);
    try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
  }
  function dialogZu(id) {
    const d = $(id);
    try { d.close(); } catch (e) { d.removeAttribute('open'); }
  }
  $('btnAlle').addEventListener('click', () => { if (!beschaeftigt) dialogAuf('dlgAlle'); });
  $('dlgAbbruch').addEventListener('click', () => dialogZu('dlgAlle'));
  $('dlgOk').addEventListener('click', () => {
    dialogZu('dlgAlle');
    $('fazit').className = 'fazit'; logLeeren();
    sperren(true);
    send({ type: 'alle', snap: !!$('chkSnap').checked, stroke: !!$('chkStroke').checked });
  });

  // =========================================================================
  // Protokoll
  // =========================================================================
  function logLeeren() { logListe = []; protokollZeichnen(); }
  function protokollZeichnen() {
    const box = $('log');
    box.textContent = '';
    if (!logListe.length) {
      const d = document.createElement('div');
      d.className = 'leermeldung';
      d.textContent = t('log.leer');
      box.appendChild(d);
      return;
    }
    logListe.forEach(e => {
      const d = document.createElement('div');
      if (e.art) d.className = e.art;
      const txt = document.createElement('span');
      txt.className = 'txt';
      txt.textContent = e.text;
      d.appendChild(txt);
      if (e.nodeId) {
        const a = document.createElement('span');
        a.className = 'zeigen';
        a.textContent = t('log.zeigen');
        a.addEventListener('click', () => send({ type: 'fokus', nodeId: e.nodeId }));
        d.appendChild(a);
      }
      if (e.hinweis) {
        const h = document.createElement('div');
        h.className = 'hinw';
        h.textContent = e.hinweis;
        d.appendChild(h);
      }
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  }

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
        text += '\\n' + t('pixel.alt', { aa: alt.aa });
      }
      if (c.guete) {
        const d = c.guete.plain.fehler > 1e-9
          ? Math.round((1 - c.guete.snap.fehler / c.guete.plain.fehler) * 100) : 0;
        text += '\\n' + t('pixel.hint', { v: c.guete.mitSnap
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
    if (zwei.length) s += '\\n' + zwei.join(' · ');
    if (drei.length) s += '\\n' + drei.join(' · ');
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

  // =========================================================================
  // Einstellungen — lokale Kopie der Konfig
  // =========================================================================
  function toast(text) {
    $('toastText').textContent = text;
    const el = $('toast');
    try { el.showToast(); } catch (e) { try { el.setAttribute('open', ''); } catch (err) {} }
  }

  // Pfade, die die Validierung im Hauptthread verändert hat, inline markieren.
  function pfadeVergleichen(a, b, praefix, raus) {
    if (a === b) return;
    const beideObjekte = a && b && typeof a === 'object' && typeof b === 'object';
    if (!beideObjekte) {
      if (String(a) !== String(b)) raus[praefix] = true;
      return;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
      const n = Math.max((a || []).length, (b || []).length);
      for (let i = 0; i < n; i++) pfadeVergleichen((a || [])[i], (b || [])[i], praefix + '.' + i, raus);
      return;
    }
    const keys = {};
    Object.keys(a).forEach(k => { keys[k] = true; });
    Object.keys(b).forEach(k => { keys[k] = true; });
    Object.keys(keys).forEach(k => pfadeVergleichen(a[k], b[k], praefix ? praefix + '.' + k : k, raus));
  }
  function korrekturenMarkieren() {
    document.querySelectorAll('[data-pfad]').forEach(el => {
      const p = el.getAttribute('data-pfad');
      const an = !!korrigiert[p];
      el.classList.toggle('ungueltig', an);
      if (an) el.setAttribute('title', t('hinweis.korrigiert'));
      else el.removeAttribute('title');
    });
  }
  function fehlerZeichnen() {
    const box = $('cfgFehler'), liste = $('cfgFehlerListe');
    const f = konfigFehler || [];
    liste.textContent = '';
    box.hidden = !f.length;
    f.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      liste.appendChild(li);
    });
  }

  function allgemeinZeichnen() {
    wert($('selAdapter'), cfgLokal.adapter);
    wert($('selSprache'), cfgLokal.sprache);
    wert($('inpVarProp'), cfgLokal.variantenProperty);
  }
  function masterZeichnen() {
    wert($('inpMasterGroesse'), cfgLokal.master.groesse);
    wert($('inpMasterKontur'), cfgLokal.master.kontur);
    const box = $('masterKeylines');
    box.textContent = '';
    $('masterKeyViz').innerHTML = keylineViz(cfgLokal.master.groesse, cfgLokal.master.keylines);
    KLASSEN.forEach(kl => {
      const feld = document.createElement('div');
      feld.className = 'feld';
      feld.innerHTML = '<span class="fname">' + esc(kl) + '</span>'
        + '<fig-input-number min="0.1" step="0.5" data-pfad="master.keylines.' + kl + '"'
        + ' value="' + esc(cfgLokal.master.keylines[kl]) + '"></fig-input-number>';
      const inp = feld.querySelector('fig-input-number');
      inp.addEventListener('change', e => {
        const v = parseFloat(e.detail != null ? e.detail : inp.value);
        if (isFinite(v)) { cfgLokal.master.keylines[kl] = v;
          $('masterKeyViz').innerHTML = keylineViz(cfgLokal.master.groesse, cfgLokal.master.keylines); }
      });
      box.appendChild(feld);
    });
    korrekturenMarkieren();
  }

  function optionen(werte, aktiv, beschriften) {
    return werte.map(v => '<option value="' + esc(v) + '"'
      + (String(v) === String(aktiv) ? ' selected' : '') + '>'
      + esc(beschriften ? beschriften(v) : v) + '</option>').join('');
  }

  function groessenZeichnen() {
    const box = $('groessen');
    box.textContent = '';
    cfgLokal.groessen.forEach((g, i) => {
      const karte = document.createElement('div');
      karte.className = 'groessekarte';
      const pf = 'groessen.' + i;
      karte.innerHTML =
        '<div class="gkopf">'
        + '<span class="gtitel">' + esc(zahl(g.N)) + ' px</span>'
        + '<div class="rechts">'
        + '<fig-radio name="std" class="rStd" value="' + i + '" data-pfad="' + pf + '.standard"'
        + (g.standard ? ' checked' : '') + '><span>' + esc(t('cfg.standard')) + '</span></fig-radio>'
        + '<fig-button class="bWeg" variant="ghost" title="' + esc(t('cfg.entfernen')) + '"'
        + (cfgLokal.groessen.length < 2 ? ' disabled' : '') + '>✕</fig-button>'
        + '</div></div>'
        + '<div class="gzeilen">'
        + '<div class="feld"><span class="fname">' + esc(t('cfg.N')) + '</span>'
        + '<fig-input-number class="fN" min="1" step="1" data-pfad="' + pf + '.N" value="' + esc(g.N) + '"></fig-input-number></div>'
        + '<div class="feld"><span class="fname">' + esc(t('cfg.kontur')) + '</span>'
        + '<fig-input-number class="fKontur" min="0.1" step="0.25" data-pfad="' + pf + '.kontur" value="' + esc(g.kontur) + '"></fig-input-number></div>'
        + '<div class="feld"><span class="fname">' + esc(t('cfg.raster')) + '</span>'
        + '<fig-dropdown class="fRaster" data-pfad="' + pf + '.raster" value="' + esc(g.raster) + '">'
        + optionen(RASTER_WERTE, g.raster, v => zahl(v)) + '</fig-dropdown></div>'
        + '<div class="feld"><span class="fname">' + esc(t('cfg.rasterGrob')) + '</span>'
        + '<fig-dropdown class="fGrob" data-pfad="' + pf + '.rasterGrob" value="' + esc(g.rasterGrob == null ? '' : g.rasterGrob) + '">'
        + '<option value=""' + (g.rasterGrob == null ? ' selected' : '') + '>' + esc(t('opt.aus')) + '</option>'
        + optionen([1, 0.5], g.rasterGrob == null ? '' : g.rasterGrob, v => zahl(v)) + '</fig-dropdown></div>'
        + '<div class="feld"><span class="fname">' + esc(t('cfg.radiusModus')) + '</span>'
        + '<fig-dropdown class="fRadModus" data-pfad="' + pf + '.radius.modus" value="' + esc(g.radius.modus) + '">'
        + optionen(['proportional', 'fest', 'keine'], g.radius.modus, v => t('radius.' + v)) + '</fig-dropdown></div>'
        + '<div class="feld"><span class="fname">' + esc(t('cfg.radiusWert')) + '</span>'
        + '<fig-input-number class="fRadWert" min="0" step="0.5" data-pfad="' + pf + '.radius.wert" value="' + esc(g.radius.wert) + '"></fig-input-number></div>'
        + '<div class="feld"><span class="fname">' + esc(t('cfg.radiusMin')) + '</span>'
        + '<fig-input-number class="fRadMin" min="0" step="0.5" data-pfad="' + pf + '.radius.min" value="' + esc(g.radius.min) + '"></fig-input-number></div>'
        + '</div>'
        + '<div class="keyzeile"><fig-button class="keyauf" variant="ghost">' + esc(t('cfg.keylinesAuf')) + ' ▾</fig-button>'
        + '<span class="keykurz">' + esc(keylinesKurz(g)) + '</span></div>'
        + '<div class="keyblock"' + (keylinesOffen[i] ? '' : ' hidden') + '>'
        + '<div class="keyhinweis">' + esc(t('cfg.keylinesHinweis', { N: zahl(g.N) })) + '</div>'
        + '<div class="keyvizhalter">' + keylineViz(g.N, g.keylines) + '</div>'
        + '<div class="vier">'
        + KLASSEN.map(kl => '<div class="feld"><span class="fname">' + esc(kl) + '</span>'
            + '<fig-input-number class="fKey' + (keylinePlausibel(g, g.keylines[kl]) ? '' : ' unplausibel') + '" data-kl="' + kl + '" min="0.1" step="0.5" data-pfad="' + pf + '.keylines.' + kl + '"'
            + (keylinePlausibel(g, g.keylines[kl]) ? '' : ' title="' + esc(t('cfg.keylineUnplausibel', { wert: zahl(g.keylines[kl]), N: zahl(g.N), min: zahl(g.N / 2) })) + '"')
            + ' value="' + esc(g.keylines[kl]) + '"></fig-input-number></div>').join('')
        + '</div>'
        + '<fig-button class="keyprop" variant="ghost">' + esc(t('cfg.keylinesProp')) + '</fig-button>'
        + '</div>';

      const zahlBinden = (sel, setzen) => {
        const el = karte.querySelector(sel);
        if (!el) return;
        el.addEventListener('change', e => {
          const v = parseFloat(e.detail != null ? e.detail : el.value);
          if (isFinite(v)) { setzen(v); }
        });
      };
      zahlBinden('.fN', v => {
        const alt = g.N, neuN = Math.round(v);
        if (!(neuN > 0) || neuN === alt) return;
        g.N = neuN;
        if (!g.keylinesManuell && alt > 0) keylinesSkalieren(g, neuN / alt);
        keylinesOffen[i] = true;            // zeigen, was sich geändert hat
        groessenZeichnen();
      });
      zahlBinden('.fKontur', v => { g.kontur = v; });
      zahlBinden('.fRadWert', v => { g.radius.wert = v; });
      zahlBinden('.fRadMin', v => { g.radius.min = v; });
      karte.querySelectorAll('.fKey').forEach(el => {
        el.addEventListener('change', e => {
          const v = parseFloat(e.detail != null ? e.detail : el.value);
          if (isFinite(v)) { g.keylines[el.getAttribute('data-kl')] = v; g.keylinesManuell = true;
            const h = karte.querySelector('.keyvizhalter'); if (h) h.innerHTML = keylineViz(g.N, g.keylines);
            const kz = karte.querySelector('.keykurz'); if (kz) kz.textContent = keylinesKurz(g); }
        });
      });
      karte.querySelector('.keyprop').addEventListener('click', () => {
        // Bezug: die nächstkleinere Zeile, sonst die nächstgrößere
        const andere = cfgLokal.groessen.filter(x => x !== g && x.N > 0);
        if (!andere.length) return;
        const kleiner = andere.filter(x => x.N < g.N).sort((a, b) => b.N - a.N)[0];
        const bezug = kleiner || andere.sort((a, b) => a.N - b.N)[0];
        KLASSEN.forEach(kl => { g.keylines[kl] = Math.round(bezug.keylines[kl] * (g.N / bezug.N) * 2) / 2; });
        g.keylinesManuell = false;
        keylinesOffen[i] = true;
        groessenZeichnen();
      });
      karte.querySelector('.fRaster').addEventListener('change', e => {
        const v = parseFloat((e && e.detail) || karte.querySelector('.fRaster').value);
        if (isFinite(v)) g.raster = v;
      });
      karte.querySelector('.fGrob').addEventListener('change', e => {
        const s = (e && e.detail != null) ? e.detail : karte.querySelector('.fGrob').value;
        g.rasterGrob = (s === '' || s == null) ? null : parseFloat(s);
      });
      karte.querySelector('.fRadModus').addEventListener('change', e => {
        const s = (e && e.detail) || karte.querySelector('.fRadModus').value;
        if (s) g.radius.modus = s;
      });
      karte.querySelector('.rStd').addEventListener('change', e => {
        if (!e.target.checked) return;
        cfgLokal.groessen.forEach(x => { x.standard = false; });
        g.standard = true;
        groessenZeichnen();
      });
      karte.querySelector('.bWeg').addEventListener('click', () => {
        if (cfgLokal.groessen.length < 2) return;
        cfgLokal.groessen.splice(i, 1);
        keylinesOffen = {};
        if (!cfgLokal.groessen.some(x => x.standard)) {
          cfgLokal.groessen[cfgLokal.groessen.length - 1].standard = true;
        }
        groessenZeichnen();
      });
      const auf = karte.querySelector('.keyauf');
      auf.addEventListener('click', () => {
        const kb = karte.querySelector('.keyblock');
        keylinesOffen[i] = kb.hidden;
        kb.hidden = !kb.hidden;
      });
      box.appendChild(karte);
    });
    korrekturenMarkieren();
  }

  const KEY_FARBEN = { Square: '#d3308f', Circular: '#0e8a9a', Wide: '#c98a12', Tall: '#5b5bd6' };
  // Skizze: Kasten N×N mit Pixelraster, darüber die vier Keyline-Formen.
  // Wide/Tall werden 3:2 bzw. 2:3 gezeichnet — nur die lange Seite ist die Keyline.
  function keylineSvg(N, keylines, px) {
    px = px || 132;
    const S = px / N, c = px / 2;
    const linie = (x1, y1, x2, y2, op) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#8a8a96" stroke-opacity="' + op + '" stroke-width="1"/>';
    let raster = '';
    if (N <= 64) for (let i = 1; i < N; i++) raster += linie(i * S, 0, i * S, px, 0.16) + linie(0, i * S, px, i * S, 0.16);
    else for (let i = 4; i < N; i += 4) raster += linie(i * S, 0, i * S, px, 0.16) + linie(0, i * S, px, i * S, 0.16);
    const mitte = linie(c, 0, c, px, 0.35) + linie(0, c, px, c, 0.35);
    const form = (kl, k) => {
      if (!(k > 0)) return '';
      const f = KEY_FARBEN[kl], a = 'fill="' + f + '" fill-opacity="0.08" stroke="' + f + '" stroke-width="1.25"';
      const w = k * S;
      if (kl === 'Circular') return '<circle cx="' + c + '" cy="' + c + '" r="' + (w / 2) + '" ' + a + '/>';
      if (kl === 'Square')   return '<rect x="' + (c - w / 2) + '" y="' + (c - w / 2) + '" width="' + w + '" height="' + w + '" ' + a + '/>';
      if (kl === 'Wide')     return '<rect x="' + (c - w / 2) + '" y="' + (c - w / 3) + '" width="' + w + '" height="' + (w * 2 / 3) + '" ' + a + ' stroke-dasharray="3 2"/>';
      return '<rect x="' + (c - w / 3) + '" y="' + (c - w / 2) + '" width="' + (w * 2 / 3) + '" height="' + w + '" ' + a + ' stroke-dasharray="3 2"/>';
    };
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 ' + px + ' ' + px + '">'
      + raster + mitte + ['Wide', 'Tall', 'Square', 'Circular'].map(kl => form(kl, keylines[kl])).join('') + '</svg>';
  }
  function keylineViz(N, keylines) {
    const leg = KLASSEN.map(kl => '<span><i class="' + (kl === 'Circular' ? 'rund' : '') + '" style="background:' + KEY_FARBEN[kl] + '"></i>'
      + esc(kl) + ' ' + zahl(keylines[kl]) + '</span>').join('');
    return '<div class="keyviz">' + keylineSvg(N, keylines) + '<div class="legende">' + leg
      + '<span style="margin-top:4px">' + esc(t('cfg.keylinesLegende', { N: zahl(N) })) + '</span></div></div>';
  }
  function keylinesSkalieren(g, f) {
    KLASSEN.forEach(kl => { g.keylines[kl] = Math.round(g.keylines[kl] * f * 2) / 2; });
  }
  function keylinesKurz(g) {
    return KLASSEN.map(kl => kl.slice(0, 1) + ' ' + zahl(g.keylines[kl])).join(' · ');
  }
  // Plausibel: Icon-Körper zwischen halber und voller Kastengröße.
  function keylinePlausibel(g, wert) {
    return isFinite(wert) && wert >= g.N / 2 - 1e-9 && wert <= g.N + 1e-9;
  }

  // Vorschlag für eine neue Zeile: N + 4 (bzw. + 6 ab 24 px), Kontur wie die
  // letzte, Keylines proportional (auf 0,5 gerundet), Raster wie die letzte.
  $('btnGroesseHinzu').addEventListener('click', () => {
    if (!cfgLokal) return;
    const gs = cfgLokal.groessen;
    const letzte = gs[gs.length - 1];
    const schritt = letzte && letzte.N >= 24 ? 6 : 4;
    const N = letzte ? letzte.N + schritt : 24;
    const neu = letzte ? kopie(letzte) : {
      N: 24, kontur: 2, keylines: { Square: 20, Circular: 22, Wide: 22, Tall: 22 },
      raster: 0.5, rasterGrob: null, radius: { modus: 'proportional', wert: 1, min: 0 }, standard: false
    };
    neu.N = N;
    neu.standard = false;
    neu.keylinesManuell = false;
    if (letzte) {
      const f = N / letzte.N;
      KLASSEN.forEach(kl => {
        neu.keylines[kl] = Math.round(letzte.keylines[kl] * f * 2) / 2;
      });
    }
    gs.push(neu);
    gs.sort((a, b) => a.N - b.N);
    groessenZeichnen();
  });

  $('selAdapter').addEventListener('change', e => {
    const v = (e && e.detail) || $('selAdapter').value;
    if (v && cfgLokal) cfgLokal.adapter = v;
  });
  $('selSprache').addEventListener('change', e => {
    const v = (e && e.detail) || $('selSprache').value;
    if (!v || !cfgLokal) return;
    cfgLokal.sprache = v;
    // Sofort umschalten, ohne aufs Speichern zu warten.
    const neu = v === 'auto' ? navSprache() : (v === 'de' ? 'de' : 'en');
    if (neu !== SPR) { SPR = neu; texteSetzen(); }
  });
  $('inpVarProp').addEventListener('change', e => {
    const v = (e && e.detail != null) ? e.detail : $('inpVarProp').value;
    if (cfgLokal) cfgLokal.variantenProperty = String(v || '').trim();
  });
  $('inpMasterGroesse').addEventListener('change', e => {
    const v = parseFloat(e.detail != null ? e.detail : $('inpMasterGroesse').value);
    if (isFinite(v) && cfgLokal) { cfgLokal.master.groesse = v;
      $('masterKeyViz').innerHTML = keylineViz(cfgLokal.master.groesse, cfgLokal.master.keylines); }
  });
  $('inpMasterKontur').addEventListener('change', e => {
    const v = parseFloat(e.detail != null ? e.detail : $('inpMasterKontur').value);
    if (isFinite(v) && cfgLokal) cfgLokal.master.kontur = v;
  });

  // ---- Farbe ---------------------------------------------------------------
  function farbenAnfordern() {
    if (farbenAngefragt || farben) return;
    farbenAngefragt = true;
    send({ type: 'farbenListen' });
  }
  function farbeZeichnen() {
    const f = cfgLokal.farbe;
    wert($('segFarbe'), f.modus);
    $('farbeHex').hidden = f.modus !== 'hex';
    $('farbeVariable').hidden = f.modus !== 'variable';
    wert($('inpHex'), f.hex || '#444444');
    anhaken($('chkAngleichen'), f.sourceAngleichen);
    varListeZeichnen();
    gewaehlteVariableZeichnen(null);
    korrekturenMarkieren();
  }
  function gewaehlteVariableZeichnen(geprueft) {
    const f = cfgLokal.farbe;
    const zeile = $('varGewaehlt');
    if (f.modus !== 'variable' || !f.variable) { zeile.hidden = true; return; }
    zeile.hidden = false;
    const hex = geprueft && geprueft.ok ? geprueft.hex : variableHex(f.variable);
    $('varPlatte').style.background = hex || 'transparent';
    let name = (geprueft && geprueft.ok && geprueft.name) || f.variable.name || f.variable.key || '';
    if (geprueft && !geprueft.ok) name = t('farbe.unaufloesbar');
    $('varName').textContent = name + (hex ? ' · ' + hex : '');
  }
  function variableHex(v) {
    if (!farben || !v) return '';
    const treffer = (farben.lokal || []).filter(x => (v.id && x.id === v.id) || (v.key && x.key === v.key));
    return treffer.length ? treffer[0].hex : '';
  }
  function passt(name, koll) {
    if (!farbSuche) return true;
    const s = farbSuche.toLowerCase();
    return String(name || '').toLowerCase().indexOf(s) >= 0
        || String(koll || '').toLowerCase().indexOf(s) >= 0;
  }
  function variableWaehlen(v) {
    cfgLokal.farbe.variable = { key: v.key || '', name: v.name || '', id: v.id || '' };
    cfgLokal.farbe.modus = 'variable';
    varListeZeichnen();
    gewaehlteVariableZeichnen(null);
    send({ type: 'farbePruefen', farbe: kopie(cfgLokal.farbe) });
  }
  function varZeile(v, mitSwatch, koll) {
    const gew = cfgLokal.farbe.variable
      && ((v.id && cfgLokal.farbe.variable.id === v.id) || (v.key && cfgLokal.farbe.variable.key === v.key));
    const d = document.createElement('div');
    d.className = 'varzeile' + (gew ? ' gewaehlt' : '');
    if (mitSwatch) {
      const s = document.createElement('fig-swatch');
      s.setAttribute('background', v.hex || '#d9d9d9');
      s.setAttribute('size', 'small');
      d.appendChild(s);
    }
    const n = document.createElement('span');
    n.className = 'vname';
    n.textContent = v.name || v.key || '';
    d.appendChild(n);
    if (koll) {
      const k = document.createElement('span');
      k.className = 'vkoll';
      k.textContent = koll;
      d.appendChild(k);
    }
    d.addEventListener('click', () => variableWaehlen(v));
    return d;
  }
  function varListeZeichnen() {
    const box = $('varListe');
    box.textContent = '';
    if (!farben) {
      const d = document.createElement('div');
      d.className = 'varleer';
      d.textContent = t('farbe.laden');
      box.appendChild(d);
      return;
    }
    let etwas = false;
    const lokal = (farben.lokal || []).filter(v => passt(v.name, v.kollektion));
    if (lokal.length) {
      etwas = true;
      const kopf = document.createElement('div');
      kopf.className = 'gruppenkopf';
      kopf.style.padding = '4px 5px 2px';
      kopf.textContent = t('farbe.lokal');
      box.appendChild(kopf);
      lokal.forEach(v => box.appendChild(varZeile(v, true, v.kollektion)));
    }
    (farben.bibliotheken || []).forEach(b => {
      const vars = (b.variablen || []).filter(v => passt(v.name, b.kollektion));
      if (!vars.length) return;
      etwas = true;
      const g = document.createElement('fig-group');
      g.className = 'kollektion';
      g.setAttribute('collapsible', '');
      g.setAttribute('name', (b.bibliothek ? b.bibliothek + ' · ' : '') + b.kollektion);
      if (farbSuche) g.setAttribute('open', 'true');
      vars.forEach(v => g.appendChild(varZeile(
        { key: v.key, name: v.name, id: '' }, false, '')));
      box.appendChild(g);
    });
    if (!etwas) {
      const d = document.createElement('div');
      d.className = 'varleer';
      d.textContent = t('farbe.leer');
      box.appendChild(d);
    }
  }
  $('segFarbe').addEventListener('change', e => {
    const v = (e && e.detail) || $('segFarbe').value;
    if (!v || !cfgLokal) return;
    cfgLokal.farbe.modus = v;
    if (v === 'variable') farbenAnfordern();
    farbeZeichnen();
  });
  $('inpHex').addEventListener('change', e => {
    const d = e && e.detail;
    const v = (d && (d.hex || d.value)) || $('inpHex').getAttribute('value');
    if (v && cfgLokal) cfgLokal.farbe.hex = String(v).slice(0, 7).toLowerCase();
  });
  $('chkAngleichen').addEventListener('change', e => {
    if (cfgLokal) cfgLokal.farbe.sourceAngleichen = !!e.target.checked;
  });
  $('varSuche').addEventListener('input', e => {
    farbSuche = String((e && e.detail != null) ? e.detail : $('varSuche').value || '');
    varListeZeichnen();
  });

  // ---- Speichern / Zurücksetzen -------------------------------------------
  $('btnSpeichern').addEventListener('click', () => {
    if (!cfgLokal) return;
    cfgLokal.groessen.sort((a, b) => a.N - b.N);
    gesendeteKonfig = kopie(cfgLokal);
    send({ type: 'konfigSpeichern', konfig: kopie(cfgLokal) });
  });
  $('btnZuruecksetzen').addEventListener('click', () => dialogAuf('dlgReset'));
  $('resetAbbruch').addEventListener('click', () => dialogZu('dlgReset'));
  $('resetOk').addEventListener('click', () => {
    dialogZu('dlgReset');
    const profil = $('profGeneric').checked ? 'generic' : 'zds';
    gesendeteKonfig = null;
    korrigiert = {};
    send({ type: 'konfigZuruecksetzen', profil: profil });
  });
  // Genau ein Profil-Radio.
  $('profZds').addEventListener('change', e => { if (e.target.checked) anhaken($('profGeneric'), false); });
  $('profGeneric').addEventListener('change', e => { if (e.target.checked) anhaken($('profZds'), false); });

  function konfigUebernehmen(m) {
    KONFIG = m.konfig || {};
    konfigFehler = m.fehler || [];
    adapterAktiv = m.adapter || KONFIG.adapter || '';
    korrigiert = {};
    // Kam diese Konfig als Antwort auf ein Speichern, sind die geänderten
    // Felder genau die, die die Validierung repariert hat.
    const warSpeichern = !!gesendeteKonfig;
    if (gesendeteKonfig) {
      pfadeVergleichen(gesendeteKonfig, m.konfig, '', korrigiert);
      gesendeteKonfig = null;
    }
    cfgLokal = kopie(m.konfig || {});
    keylinesOffen = {};
    if (!spracheAbgleichen()) {
      adapterChipSetzen();
      allgemeinZeichnen();
      masterZeichnen();
      groessenZeichnen();
      farbeZeichnen();
      fehlerZeichnen();
      auswahlZeichnen();
    } else {
      allgemeinZeichnen();
    }
    korrekturenMarkieren();
    if (cfgLokal.farbe && cfgLokal.farbe.modus === 'variable') farbenAnfordern();
    if (warSpeichern) toast(t('toast.gespeichert'));
  }

  // =========================================================================
  // Nachrichten vom Hauptthread
  // =========================================================================
  onmessage = e => {
    const m = e.data.pluginMessage; if (!m) return;

    if (m.type === 'auswahl') {
      const vorher = ziel ? ziel.name : null;
      ziel = m.ziel || null;
      hatAuswahl = !!ziel;
      if (!ziel || vorher !== ziel.name) chipLeeren();
      auswahlZeichnen();
      if (!beschaeftigt) { aus($('btnRun'), !hatAuswahl); aus($('btnDiff'), !hatAuswahl); }
    }

    if (m.type === 'log') {
      logListe.push({ art: m.art || '', text: m.text || '', hinweis: m.hinweis || '', nodeId: m.nodeId || null });
      protokollZeichnen();
    }

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
      c.textContent = t('btn.vorschau');
    }

    if (m.type === 'mess') {
      (async () => {
        const werte = [];
        for (const p of m.paare) {
          try {
            const r1 = await analysiere(p.px1, false, false);
            const fehler = await treue(p.px1, p.px8);
            werte.push({ aa: r1.aa, fehler });
          } catch (err) { werte.push({ aa: 999, fehler: 999 }); }
        }
        send({ type: 'messwert', id: m.id, werte });
      })();
    }

    if (m.type === 'einstellungen') {
      anhaken($('chkSnap'), m.snap);
      anhaken($('chkStroke'), m.stroke);
    }

    if (m.type === 'konfig') konfigUebernehmen(m);

    if (m.type === 'farben') {
      farben = m;
      farbenAngefragt = false;
      varListeZeichnen();
      gewaehlteVariableZeichnen(null);
    }

    if (m.type === 'farbeGeprueft') gewaehlteVariableZeichnen(m);

    if (m.type === 'fertig') sperren(false);
  };

  // =========================================================================
  // Start
  // =========================================================================
  texteSetzen();
  send({ type: 'init', sprache: SPR });
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
