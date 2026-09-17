# Icon Pipeline — a Figma plugin

Builds pixel-fitted icon variants from one master component: fit to a keyline per
shape class, radius rules per size, optional pixel snapping (stem hinting with
centre protection, mirror coupling, AA oracle), `union` → `flatten`, and a content
swap into the existing variant set so **instances stay connected**.

Runs in any file (**free mode**) and on the ZDS icon board (**ZDS profile**,
detected automatically). Bilingual, English and German. No runtime dependencies.

## Install

Figma Desktop → Plugins → Development → *Import plugin from manifest…* →
pick `manifest.json`.

## Free mode vs. ZDS profile

|  | Free mode | ZDS profile |
|---|---|---|
| Detection | anything that is not the ZDS board | pages *Icons* + *Source* and the frame *ZDS Icons · Karten* |
| Selection resolves to | component, instance, variant set or a frame in master size | icon card, variant set, source |
| Shape class | from the aspect ratio (marked *guessed*), overridable via dropdown | from the grid instance or an explicit override |
| Target set | component set with the same name, current page first | the library set, tab-bar fallback included |
| After building | plugin data only | status chip, keywords → description, preview cells |

The adapter can be forced in the settings (`auto` / `zds` / `frei`).

## Icon tab

1. Select a component, instance, variant set — or, on the ZDS board, an icon card.
2. **Preview** — onion skin old vs. new, pixel view at 1× / 2× / 8×, difference
   heat map, dark background. Changes nothing.
3. **Build icon** — builds every configured size and swaps it into the set. A dry
   run shows what would change before anything is touched.

Also here: **Audit** (keyline, grid rate, structure, outdated sources), **Rebuild
all**, and the quick switches *pixel snapping* and *stroke variant*. A progress
row with a **Cancel** button appears during batch runs. With nothing selected in
free mode, the empty state offers **Create example icon**.

## Settings tab

Stored in the file, so a team shares one configuration. Fields are validated on
save and repaired where possible; every complaint points at the exact field.

- General: adapter, language, variant property
- Master: size, stroke weight, keylines per shape class
- Sizes table: `N`, stroke, grid (1 / 0.5 / 0.25), coarse grid, radius rule
  (proportional / fixed / none, lower bound), keylines, default variant
- Colour: from the source, a hex value, or a variable (local or team library)
- Writing: may a frame be converted to a component, may the stroke frame be created
- Profiles: `zds`, `generic`, `material`, `lucide`, `apple`
- Configuration **export** / **import** as JSON, and *Preview with these settings*
  without saving them

Details: [`docs/KONFIG.md`](docs/KONFIG.md).

## Report and export

The **Report** tab shows fidelity (RMS against an 8× reference), anti-aliasing
share, keyline hit and grid rate per icon and size, with a trend against the
previous build. Numbers can be downloaded as CSV.

The **SVG export** writes one file per variant (`name/name-N.svg`) with colours
replaced by `currentColor` and the root `width`/`height` removed, plus a
`manifest.json`; the UI packs it into a ZIP, optionally with a `sprite.svg`.

## Development

```
node build.mjs      # writes code.js and ui.html, checks syntax, runs the tests
node test/run.mjs   # headless tests only
```

`node test/run.mjs` needs no npm. It concatenates `src/main/*.js` itself — so it
always tests the **sources**, even when `code.js` is stale — and checks the
configuration validation, i18n completeness, the snapping regression against the
v1 formulas, and the UI ↔ main message contract.

The Figma API cannot be tested headless. After a build, restart the plugin in
Figma and try it in the ZDS file (profile `zds`) and in an empty file with a 24 px
component (profile `generic`).

### File roles

| File | Role |
|---|---|
| `src/main/00-config.js` | schema, profiles, load / save / validate |
| `src/main/05-i18n.js`, `06-i18n-zusatz.js` | dictionary de/en and `t(key, params)` |
| `src/main/10-errors.js` | `PipelineFehler`, error codes, log channel to the UI |
| `src/main/20-geometrie.js` | bounds, fit, radius rule, stroke setting, staggering |
| `src/main/30-snap.js` | pixel snapping — see [`docs/SNAPPING.md`](docs/SNAPPING.md) |
| `src/main/40-adapter.js` | ZDS and free-mode adapters |
| `src/main/50-farbe.js` | colour sources, target paint |
| `src/main/60-build.js` | build, preview, audit, quality measurement |
| `src/main/65-plan.js`, `66-bericht.js`, `67-export.js`, `68-beispiel.js` | dry run, report, SVG export, example icon |
| `src/main/70-main.js` | message handler, selection reporting |
| `gen-ui.mjs` | blueprint of the interface (figui3 inlined from `fig.css` / `fig.js`) |
| `build.mjs` | `node build.mjs` writes `code.js` and `ui.html` |
| `code.js`, `ui.html` | GENERATED, never edit by hand |
| `code.v1.js` | reference of the old, ZDS-bound state |
| `ARCHITEKTUR.md` | the binding specification (v2 and round 3) |

All `src/main/*.js` share one script scope: no `import` / `export`, no duplicate
top-level declarations, load order = file name. `test/run.mjs` enforces both.

---
---

# Icon Pipeline — Figma-Plugin

Baut aus einer Master-Komponente gerasterte Icon-Varianten in beliebigen
Zielgrößen: Fit auf Keylines je Formklasse, Radienregeln je Größe, optionales
Pixel-Snapping (Stem-Hinting mit Mitte-Schutz, Spiegel-Kopplung, AA-Orakel),
`union` → `flatten`, Inhaltstausch in bestehende Varianten-Sets — **Instanzen
bleiben verbunden**.

Läuft in jedem File (**Frei-Modus**) und auf dem ZDS-Icon-Board (**ZDS-Profil**,
automatisch erkannt). Zweisprachig de/en, ohne Laufzeit-Abhängigkeiten.

## Installation

Figma Desktop → Plugins → Development → *Import plugin from manifest…* →
`manifest.json` wählen.

## Frei-Modus und ZDS-Profil

|  | Frei-Modus | ZDS-Profil |
|---|---|---|
| Erkennung | alles, was nicht das ZDS-Board ist | Seiten *Icons* + *Source* und Frame *ZDS Icons · Karten* |
| Auswahl löst auf zu | Komponente, Instanz, Varianten-Set oder Frame im Master-Maß | Icon-Karte, Varianten-Set, Source |
| Formklasse | aus dem Seitenverhältnis (als *geraten* markiert), per Dropdown änderbar | aus der Grid-Instanz oder einem Override |
| Ziel-Set | Component-Set gleichen Namens, aktuelle Seite zuerst | das Library-Set inkl. Tab-Bar-Fallback |
| Nach dem Bauen | nur pluginData | Status-Chip, Keywords → Beschreibung, Preview-Zellen |

Der Adapter lässt sich in den Einstellungen erzwingen (`auto` / `zds` / `frei`).

## Tab Icon

1. Komponente, Instanz, Varianten-Set — oder auf dem ZDS-Board eine Icon-Karte auswählen.
2. **Vorschau** — Onionskin alt/neu, Pixelansicht 1× / 2× / 8×, Differenz-Heatmap,
   dunkler Grund. Ändert nichts.
3. **Icon bauen** — baut alle konfigurierten Größen und tauscht sie ins Set. Ein
   Trockenlauf zeigt vorher, was passieren würde.

Außerdem: **Audit** (Keyline, Rasterrate, Struktur, veraltete Sources), **Alle neu
bauen** und die Schnellschalter *Pixel-Snapping* und *Stroke-Fassung*. Während
eines Batches steht in der Fortschrittszeile ein **Abbrechen**-Knopf. Ohne
Auswahl bietet der Leerzustand im Frei-Modus **Beispiel-Icon anlegen** an.

## Tab Einstellungen

Wird im File gespeichert, ein Team teilt sich also eine Konfiguration. Eingaben
werden beim Speichern geprüft und, wo möglich, repariert; jede Meldung zeigt auf
ihr Feld.

- Allgemein: Adapter, Sprache, Variantenproperty
- Master: Größe, Kontur, Keylines je Formklasse
- Größen-Tabelle: `N`, Kontur, Raster (1 / 0,5 / 0,25), grobes Raster, Radius-Regel
  (proportional / fest / keine, Untergrenze), Keylines, Standardvariante
- Farbe: aus der Source, Hex oder Variable (lokal und Team-Library)
- Schreiben: darf ein Frame zur Komponente werden, darf der Stroke-Frame entstehen
- Profile: `zds`, `generic`, `material`, `lucide`, `apple`
- Konfig-**Export** / **Import** als JSON und „Vorschau mit diesen Einstellungen“
  ohne zu speichern

Einzelheiten: [`docs/KONFIG.md`](docs/KONFIG.md).

## Bericht und Export

Der Tab **Bericht** zeigt Treue (RMS gegen eine 8×-Referenz), AA-Anteil,
Keyline-Treffer und Rasterrate je Icon und Größe, mit Trend gegenüber dem
vorherigen Bau. Die Zahlen lassen sich als CSV herunterladen.

Der **SVG-Export** schreibt je Variante eine Datei (`name/name-N.svg`), ersetzt
Farben durch `currentColor`, entfernt `width`/`height` an der Wurzel und legt eine
`manifest.json` dazu; die UI packt das als ZIP, auf Wunsch mit `sprite.svg`.

## Entwickeln

```
node build.mjs      # schreibt code.js und ui.html, prüft Syntax, fährt die Tests
node test/run.mjs   # nur die Tests
```

`node test/run.mjs` braucht kein npm. Der Runner konkateniert `src/main/*.js`
selbst — er testet also immer den **Quellstand**, auch wenn `code.js` veraltet ist
— und prüft Konfig-Validierung, i18n-Vollständigkeit, die Snapping-Regression
gegen die v1-Formeln und den Nachrichtenvertrag UI ↔ Main.

Die Figma-API lässt sich nicht headless testen. Nach dem Bau das Plugin in Figma
neu starten und im ZDS-File (Profil `zds`) sowie in einem leeren File mit einer
24er-Komponente (Profil `generic`) ausprobieren.

## Dateien

- `src/main/*.js` — Hauptthread, Module in Ladereihenfolge (siehe `ARCHITEKTUR.md`)
- `gen-ui.mjs` — Bauplan der Oberfläche (figui3 eingebettet aus `fig.css` / `fig.js`)
- `build.mjs` — `node build.mjs` schreibt `code.js` und `ui.html`
- `test/` — Kopftest ohne npm, `docs/` — Snapping- und Konfig-Doku
- `code.js`, `ui.html` — GENERIERT, nie von Hand editieren
- `code.v1.js` — Referenz des alten, ZDS-gebundenen Stands
- `ARCHITEKTUR.md` — Spezifikation v2 und Runde 3
