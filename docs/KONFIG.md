# Configuration / Konfiguration

Everything the pipeline used to hard-wire (sizes, stroke weights, keylines, grid,
radii, master size, variant property, colour) lives in one configuration object.
It is stored **in the file**, not per device.

*Alles, was die Pipeline früher hart verdrahtet hatte, steckt in einem
Konfigurationsobjekt. Es liegt **im File**, nicht pro Gerät.*

---

## 1. Storage / Speicherort

| What | Where | Note |
|---|---|---|
| Configuration | `figma.root.getPluginData('icon-pipeline/konfig')`, JSON | travels with the file, shared by everyone |
| Quick switches `snap` / `stroke` / `trockenlaufEinzel` | `figma.clientStorage`, key `'icon-pipeline/schalter'` | per device, deliberately not in the file |
| Shape class override (free mode) | `src.setPluginData('icon-pipeline/klasse', …)` | on the source component |
| Build result per set | `set.setPluginData('zds', …)` | key stays `'zds'` for backwards compatibility |

Loading (`konfigLaden`): read plugin data → if empty, pick a profile by adapter
detection (ZDS board → `zds`, otherwise `generic`) → `konfigMigrieren` →
`konfigValidieren`. The validated result becomes the global `CFG`.

## 2. Schema (version 1)

### Top level

| Field | Type | Default | Effect |
|---|---|---|---|
| `version` | number | `1` | schema version, forced to 1 on validation |
| `adapter` | `'auto'｜'zds'｜'frei'` | `'auto'` | which adapter resolves the selection. `auto` = ZDS if the board is detected, else free mode |
| `sprache` | `'auto'｜'de'｜'en'` | `'auto'` | UI and log language. `auto` follows `navigator.language` |
| `variantenProperty` | string | `'Size'` | variant name is `` `${variantenProperty}=${N}` ``. Must not be empty |
| `master` | object | see below | the source component |
| `groessen` | array | see below | one entry per target size, at least one |
| `farbe` | object | see below | fill of the flattened shape |
| `schreiben` | object | see below | which mutations outside the target set are allowed |
| `snapping` | boolean | `true` | quick switch default (mirrored into clientStorage) |
| `strokeFassung` | boolean | `false` | quick switch default: also keep an unflattened stroke variant |

### `master`

| Field | Type | Default | Effect |
|---|---|---|---|
| `groesse` | number > 0 | `24` (generic) / `72` (zds) | edge length of the square source component. A source of another size is reported as `SOURCE_MASS` |
| `kontur` | number > 0 | `2` / `6` | stroke weight the source strokes are set to while normalising |
| `keylines.{Square,Circular,Wide,Tall}` | number > 0 | `{20,22,22,22}` | reference keylines of the master — hint and check only, the fit uses the per-size keylines |

### `groessen[i]`

| Field | Type | Default | Effect |
|---|---|---|---|
| `N` | integer > 0 | — | target size in px. Unique, list sorted ascending. A non-integer is rounded |
| `kontur` | number > 0 | `1.5` | stroke weight at this size, before flatten |
| `keylines.{Square,Circular,Wide,Tall}` | number > 0 | `N` | fit target per shape class — the icon is scaled until the relevant extent hits this value |
| `raster` | `1｜0.5｜0.25` | `0.5` | snapping grid. Other values are clamped to the nearest allowed one |
| `rasterGrob` | `null｜1｜0.5` | `null` | preferred coarser grid, used when the move is ≤ 0.35 px. Must be coarser than `raster`, otherwise disabled with a message |
| `radius.modus` | `'proportional'｜'fest'｜'keine'` | `'proportional'` | `proportional`: `r · (N_inst / master.groesse)`; `fest`: always `wert`; `keine`: 0 |
| `radius.wert` | number ≥ 0 | `1` | the radius for `fest` |
| `radius.min` | number ≥ 0 | `0` | results below `min` become 0 (only for `proportional` / `fest`) |
| `standard` | boolean | one entry `true` | the default variant — placed at index 0, which is what Figma inserts |
| `keylinesManuell` | boolean | `false` | UI marker: keylines were edited by hand and no longer follow `N` |

### `farbe`

| Field | Type | Default | Effect |
|---|---|---|---|
| `modus` | `'source'｜'hex'｜'variable'` | `'source'` | where the fill of the flattened shape comes from |
| `hex` | `#rrggbb` | `'#444444'` | used in mode `hex`. Accepts `abc`, `#abc`, `aabbcc`; anything else falls back |
| `variable` | `{ key, name, id }｜null` | `null` | used in mode `variable`. `key` for library variables (`importVariableByKeyAsync`), `id` for local ones, `name` as last resort |
| `sourceAngleichen` | boolean | `false` | also bind the source's own fills/strokes to that colour (ZDS behaviour) |

Mode `source` copies the first SOLID paint from the source's stroke or fill,
including its `boundVariables`; fallback `#444444`.

### `schreiben` (round 3)

Mutations **outside** the target set — conservative by default.

| Field | Type | Default | Effect |
|---|---|---|---|
| `frameUmwandeln` | boolean | `false` | allow turning a selected FRAME in master size into a component while building. Off → `FRAME_NICHT_ERLAUBT` |
| `strokeHeimAnlegen` | boolean | `true` | allow creating the `Icon Pipeline · Stroke` frame. Off → stroke variant is skipped with warning `STROKEHEIM_AUS` |

## 3. Validation / Validierung

`konfigValidieren(k)` → `{ ok, fehler, konfig }`. It **repairs** rather than
rejects: sorts sizes, drops duplicate `N`, rounds non-integer `N`, clamps `raster`,
forces exactly one default size, fixes hex format, resets unknown enums.

Errors are structured:

```js
fehler: [ { pfad: 'groessen.1.kontur', text: 'Stroke for 21 must be > 0.' }, … ]
```

`pfad` matches the `data-pfad` attributes in the settings tab, so the UI can mark
the offending field. The index refers to the **sorted** list. List-level problems
("no sizes left", "no default size") use `pfad: 'groessen'`.

## 4. Profiles / Profile

`PROFIL_NAMEN = ['zds', 'generic', 'material', 'lucide', 'apple']`.
`konfigProfilInfo()` returns title and description per profile, translated.

| Profile | Adapter | Master (size / stroke / keylines S,C,W,T) | Sizes `N (stroke, coarse grid)` | Colour |
|---|---|---|---|---|
| **zds** | `zds` | 72 / 6 / 56, 60, 64, 64 | 14 (1.5), **18 (1.5)**, 24 (2, grob 1) | variable `Text/70`, source aligned |
| **generic** | `auto` | 24 / 2 / 20, 22, 22, 22 | 16 (1.5), 20 (1.5), **24 (2, grob 1)** | source |
| **material** | `auto` | 24 / 2 / 18, 20, 20, 20 | 18 (1.5), **24 (2, grob 1)**, 36 (3, grob 1), 48 (4, grob 1) | source |
| **lucide** | `auto` | 24 / 2 / 22, 22, 22, 22 | 16 (1.5), 20 (1.5), **24 (2, grob 1)**, 32 (2.5, grob 1), 48 (4, grob 1) | source |
| **apple** | `auto` | 28 / 2 / 21, 22, 22, 22 | 16 (1.5), 20 (1.5), **24 (2, grob 1)**, 28 (2, grob 1), 32 (2.5, grob 1) | source |

Bold = default variant. All profiles use `raster: 0.5` and
`radius: { modus: 'proportional', wert: 1, min: 0 }`.

Per-size keylines (Square / Circular / Wide / Tall):

| Profile | per size |
|---|---|
| zds | 14 → 12, 13, 14, 14 · 18 → 14, 15, 16, 16 · 24 → 18, 19, 20, 20 |
| generic | 16 → 14, 15, 15, 15 · 20 → 17, 18, 18, 18 · 24 → 20, 22, 22, 22 |
| material | 18 → 13.5, 15, 15, 15 · 24 → 18, 20, 20, 20 · 36 → 27, 30, 30, 30 · 48 → 36, 40, 40, 40 |
| lucide | 16 → 14.5 all · 20 → 18.5 all · 24 → 22 all · 32 → 29.5 all · 48 → 44 all |
| apple | 16 → 12, 12.5, 12.5, 12.5 · 20 → 15, 15.5, 15.5, 15.5 · 24 → 18, 19, 19, 19 · 28 → 21, 22, 22, 22 · 32 → 24, 25, 25, 25 |

## 5. Export / Import

Settings tab → **Export** downloads the current configuration as
`icon-pipeline.konfig.json`. The file is the plain schema object, e.g.:

```json
{
  "version": 1,
  "adapter": "auto",
  "sprache": "auto",
  "master": { "groesse": 24, "kontur": 2,
              "keylines": { "Square": 20, "Circular": 22, "Wide": 22, "Tall": 22 } },
  "variantenProperty": "Size",
  "groessen": [
    { "N": 24, "kontur": 2,
      "keylines": { "Square": 20, "Circular": 22, "Wide": 22, "Tall": 22 },
      "raster": 0.5, "rasterGrob": 1,
      "radius": { "modus": "proportional", "wert": 1, "min": 0 },
      "standard": true }
  ],
  "farbe": { "modus": "source", "hex": "#444444", "variable": null, "sourceAngleichen": false },
  "schreiben": { "frameUmwandeln": false, "strokeHeimAnlegen": true },
  "snapping": true,
  "strokeFassung": false
}
```

**Import** picks a file and sends it through the very same path as *Save*
(`konfigSpeichern`), so an incomplete or hand-edited file is repaired and the
repairs are listed field by field. The dev **SVG export** (report tab) is a
different thing — see `ARCHITEKTUR.md` § 20.

---
---

# Deutsch

## 1. Speicherort

| Was | Wo | Anmerkung |
|---|---|---|
| Konfiguration | `figma.root.getPluginData('icon-pipeline/konfig')`, JSON | reist mit dem File, gilt für alle |
| Schnellschalter `snap` / `stroke` / `trockenlaufEinzel` | `figma.clientStorage`, Schlüssel `'icon-pipeline/schalter'` | gerätebezogen, bewusst nicht im File |
| Klassen-Override (Frei-Modus) | `src.setPluginData('icon-pipeline/klasse', …)` | an der Source-Komponente |
| Bauergebnis je Set | `set.setPluginData('zds', …)` | Schlüssel bleibt `'zds'` (Kompatibilität) |

Laden (`konfigLaden`): pluginData lesen → leer? Profil per Adapter-Erkennung
(ZDS-Board → `zds`, sonst `generic`) → `konfigMigrieren` → `konfigValidieren`.
Das geprüfte Ergebnis wird zum globalen `CFG`.

## 2. Schema (Version 1)

### Oberste Ebene

| Feld | Typ | Default | Wirkung |
|---|---|---|---|
| `version` | Zahl | `1` | Schema-Version, wird bei der Prüfung auf 1 gesetzt |
| `adapter` | `'auto'｜'zds'｜'frei'` | `'auto'` | wer die Auswahl auflöst. `auto` = ZDS, wenn das Board erkannt wird, sonst Frei-Modus |
| `sprache` | `'auto'｜'de'｜'en'` | `'auto'` | Sprache von UI und Protokoll. `auto` folgt `navigator.language` |
| `variantenProperty` | Text | `'Size'` | Variantenname ist `` `${variantenProperty}=${N}` ``. Darf nicht leer sein |
| `master` | Objekt | s. u. | die Source-Komponente |
| `groessen` | Liste | s. u. | ein Eintrag je Zielgröße, mindestens einer |
| `farbe` | Objekt | s. u. | Füllung der geplätteten Fläche |
| `schreiben` | Objekt | s. u. | welche Mutationen außerhalb des Ziel-Sets erlaubt sind |
| `snapping` | Bool | `true` | Vorbelegung des Schnellschalters (spiegelt sich in clientStorage) |
| `strokeFassung` | Bool | `false` | Vorbelegung: zusätzlich eine ungeplättete Stroke-Fassung ablegen |

### `master`

| Feld | Typ | Default | Wirkung |
|---|---|---|---|
| `groesse` | Zahl > 0 | `24` (generic) / `72` (zds) | Kantenlänge der quadratischen Source. Andere Maße melden `SOURCE_MASS` |
| `kontur` | Zahl > 0 | `2` / `6` | Strichstärke, auf die Source-Konturen beim Normalisieren gesetzt werden |
| `keylines.{Square,Circular,Wide,Tall}` | Zahl > 0 | `{20,22,22,22}` | Referenz-Keylines des Masters — nur Hinweis und Prüfung; gefittet wird gegen die Keylines der Größe |

### `groessen[i]`

| Feld | Typ | Default | Wirkung |
|---|---|---|---|
| `N` | ganze Zahl > 0 | — | Zielgröße in px. Eindeutig, Liste aufsteigend sortiert. Nicht-ganzzahlig wird gerundet |
| `kontur` | Zahl > 0 | `1.5` | Strichstärke bei dieser Größe, vor dem Flatten |
| `keylines.{…}` | Zahl > 0 | `N` | Fit-Ziel je Formklasse — skaliert wird, bis das maßgebliche Maß diesen Wert trifft |
| `raster` | `1｜0,5｜0,25` | `0.5` | Snapping-Raster. Andere Werte werden auf den nächsten erlaubten geklemmt |
| `rasterGrob` | `null｜1｜0,5` | `null` | bevorzugtes gröberes Raster, greift bei einem Weg ≤ 0,35 px. Muss gröber als `raster` sein, sonst abgeschaltet mit Meldung |
| `radius.modus` | `'proportional'｜'fest'｜'keine'` | `'proportional'` | `proportional`: `r · (N_inst / master.groesse)`; `fest`: immer `wert`; `keine`: 0 |
| `radius.wert` | Zahl ≥ 0 | `1` | der Radius für `fest` |
| `radius.min` | Zahl ≥ 0 | `0` | Ergebnisse unter `min` werden 0 (nur bei `proportional` / `fest`) |
| `standard` | Bool | genau einer `true` | die Standardvariante — landet auf Index 0, den Figma beim Einfügen nimmt |
| `keylinesManuell` | Bool | `false` | UI-Merker: Keylines von Hand gesetzt, folgen `N` nicht mehr |

### `farbe`

| Feld | Typ | Default | Wirkung |
|---|---|---|---|
| `modus` | `'source'｜'hex'｜'variable'` | `'source'` | woher die Füllung der geplätteten Fläche kommt |
| `hex` | `#rrggbb` | `'#444444'` | für Modus `hex`. Akzeptiert `abc`, `#abc`, `aabbcc`; alles andere fällt zurück |
| `variable` | `{ key, name, id }｜null` | `null` | für Modus `variable`. `key` für Library-Variablen (`importVariableByKeyAsync`), `id` für lokale, `name` als letzter Versuch |
| `sourceAngleichen` | Bool | `false` | auch die Fills/Strokes der Source an diese Farbe binden (ZDS-Verhalten) |

Modus `source` kopiert den ersten SOLID-Paint aus Stroke oder Fill der Source
inklusive `boundVariables`; Rückfall `#444444`.

### `schreiben` (Runde 3)

Mutationen **außerhalb** des Ziel-Sets — Standard konservativ.

| Feld | Typ | Default | Wirkung |
|---|---|---|---|
| `frameUmwandeln` | Bool | `false` | erlaubt, einen ausgewählten FRAME im Master-Maß beim Bauen in eine Komponente zu wandeln. Aus → `FRAME_NICHT_ERLAUBT` |
| `strokeHeimAnlegen` | Bool | `true` | erlaubt, den Frame `Icon Pipeline · Stroke` anzulegen. Aus → Stroke-Fassung wird übersprungen, Warnung `STROKEHEIM_AUS` |

## 3. Validierung

`konfigValidieren(k)` → `{ ok, fehler, konfig }`. Sie **repariert**, statt
abzulehnen: sortiert Größen, verwirft doppelte `N`, rundet nicht-ganzzahlige `N`,
klemmt `raster`, erzwingt genau eine Standardgröße, korrigiert das Hex-Format,
setzt unbekannte Aufzählungswerte zurück.

Fehler sind strukturiert:

```js
fehler: [ { pfad: 'groessen.1.kontur', text: 'Kontur für 21 muss > 0 sein.' }, … ]
```

`pfad` entspricht den `data-pfad`-Attributen im Einstellungs-Tab, damit die UI das
betroffene Feld markieren kann. Der Index bezieht sich auf die **sortierte**
Liste. Listenweite Probleme („keine Größen“, „keine Standardgröße“) bekommen
`pfad: 'groessen'`.

## 4. Profile

Siehe die Tabellen im englischen Teil — `PROFIL_NAMEN` ist
`['zds', 'generic', 'material', 'lucide', 'apple']`, `konfigProfilInfo()` liefert
Titel und Beschreibung je Profil in der eingestellten Sprache.

## 5. Export / Import

Einstellungen → **Export** lädt die aktuelle Konfiguration als
`icon-pipeline.konfig.json` herunter; das ist genau das Schema-Objekt (Beispiel
oben). **Import** wählt eine Datei und schickt sie über denselben Weg wie
„Speichern“ (`konfigSpeichern`) — eine unvollständige oder handgeschriebene Datei
wird also repariert, und die Reparaturen erscheinen feldweise. Der
**SVG-Dev-Export** im Bericht-Tab ist etwas anderes, siehe `ARCHITEKTUR.md` § 20.
