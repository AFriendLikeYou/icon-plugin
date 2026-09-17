# Icon Pipeline — Figma-Plugin

Baut aus einer Master-Komponente (z. B. 72 px) gerasterte Icon-Varianten in
beliebigen Zielgrößen: Fit auf Keylines, Radienregeln je Größe, optionales
Pixel-Snapping (Stem-Hinting mit Mitte-Schutz, Spiegel-Kopplung, AA-Orakel),
union→flatten, Inhaltstausch in bestehende Varianten-Sets (Instanzen bleiben verbunden).

Läuft in jedem File (**Frei-Modus**) und auf dem ZDS-Icon-Board (**ZDS-Profil**,
automatisch erkannt). Zweisprachig de/en.

## Installation
Figma Desktop → Plugins → Development → Import plugin from manifest… → `manifest.json`

## Bedienung
**Tab Icon**
1. Komponente, Instanz, Varianten-Set oder (ZDS) Karte auswählen
2. **Vorschau** — Onionskin aktuell/neu, Pixelansicht 1×/2×/8×, Differenz-Heatmap, dunkler Grund; ändert nichts
3. **Icon bauen** — baut alle konfigurierten Größen und tauscht sie ins Set
- **Audit** prüft alle Icons (Keyline, Raster, Struktur, veraltete Sources), **Alle neu bauen** mit Rückfrage
- Schnellschalter: Pixel-Snapping, Stroke-Fassung zusätzlich ablegen

**Tab Einstellungen** (gespeichert im File)
- Adapter (auto/zds/frei), Sprache, Variantenproperty
- Master: Größe, Kontur, Keylines je Formklasse
- Größen-Tabelle: N, Kontur, Raster (1 / 0,5 / 0,25), grobes Raster, Radius-Regel
  (proportional / fest / keine, Untergrenze), Keylines, Standardvariante
- Farbe: aus der Source, Hex oder Variable (lokal und Team-Library)
- Zurücksetzen auf Profil `zds` oder `generic`

## Dateien
- `src/main/*.js` — Hauptthread, Module in Ladereihenfolge (siehe ARCHITEKTUR.md)
- `gen-ui.mjs` — Bauplan der Oberfläche (figui3 eingebettet aus `fig.css`/`fig.js`)
- `build.mjs` — `node build.mjs` schreibt `code.js` und `ui.html`
- `code.js`, `ui.html` — GENERIERT, nie von Hand editieren
- `code.v1.js` — Referenz des alten, ZDS-gebundenen Stands
- `ARCHITEKTUR.md` — Spezifikation v2 (Konfigschema, Adapter, Protokoll)

## Entwickeln
```
node build.mjs      # baut und prüft Syntax
```
Figma-API lässt sich nicht headless testen: nach dem Bau in Figma das Plugin neu starten.
