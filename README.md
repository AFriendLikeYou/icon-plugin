# ZDS Icon Pipeline — Figma-Plugin

Hält die ZDS-Icons automatisch auf dem Grid: Fit auf die Keylines, proportionale
Radien, optionales Pixel-Snapping (Stem-Hinting mit Mitte-Schutz und
Spiegel-Kopplung, AA-Orakel wählt die schärfere Fassung), union→flatten,
Inhaltstausch in die Library-Sets (Instanzen bleiben verbunden).

## Installation
Figma Desktop → Plugins → Development → Import plugin from manifest… → `manifest.json`

## Bedienung
1. Auf der Seite **Source** eine `Karte · …` (oder deren Source) auswählen
2. **Vorschau** — Onionskin (aktuell vs. neu) + Pixelansicht (echte 1×/2×-Rasterung), ändert nichts
3. **Icon bauen** — baut die drei Größen und tauscht sie in das Library-Set
- **Pixel-Snapping**: gerade Kanten/Scheitel aufs 0,5-px-Raster; Orakel behält die schärfere Fassung
- **Stroke-Fassung ablegen**: zusätzlich ungeplättete Fassung (kantenidentisch) auf Source

## Dateien
- `code.js` — Pipeline (Figma-Hauptthread)
- `ui.html` — GENERIERT, nie von Hand editieren
- `gen-ui.mjs` — der Bauplan: hier ändern, dann `node gen-ui.mjs`
- `fig.css` / `fig.js` — vendored @rogieking/figui3 (wird in ui.html eingebettet)

## Ausgeblendet, aber fertig
`LIBRARY_MODUS` in gen-ui.mjs (Audit über alle Icons + „Alle neu bauen" mit
Bestätigungsdialog und Auto-Audit). Auf `true` setzen und neu generieren.
