# Icon Pipeline — Architektur v2 (Generalisierung)

Stand: 2026-09-17. Dieses Dokument ist die verbindliche Spezifikation für den Umbau
von der ZDS-spezifischen Pipeline zu einem allgemein nutzbaren Figma-Plugin.
Der bisherige Code liegt in `code.js` (wird ab jetzt GENERIERT) und `gen-ui.mjs`.

## 0. Ziele

1. Das Plugin funktioniert in **jedem** Figma-File (Frei-Modus) und weiterhin
   vollständig auf dem ZDS-Board (ZDS-Profil). Beides über eine Adapter-Schicht.
2. Alle bisher hart verdrahteten Größen sind **Konfiguration**: Zielgrößen,
   Konturstärken, Keylines, Raster, Radien, Master-Größe, Variantenproperty, Farbe.
3. Zweisprachig (de/en), verständliche Fehler mit Sprung zum Knoten, robustere Vorschau.
4. Null Abhängigkeiten zur Laufzeit. Build = Node-Skript ohne npm-Pakete.

## 1. Dateistruktur

```
manifest.json          → main: code.js, ui: ui.html, permissions: ["teamlibrary"], documentAccess: "dynamic-page"
build.mjs              → baut code.js aus src/main/*.js (Konkatenation in Dateinamen-Reihenfolge) und ruft gen-ui.mjs
gen-ui.mjs             → baut ui.html (wie bisher, figui3 eingebettet)
code.js, ui.html       → GENERIERT, nie von Hand editieren
src/main/
  00-config.js         Konfig-Schema, Profile (DEFAULTS), laden/speichern/validieren/migrieren
  05-i18n.js           Wörterbuch de/en für den Hauptthread, t(key, params)
  10-errors.js         PipelineFehler (code, hinweis, nodeId), Fehlercodes
  20-geometrie.js      gb, fitten, radienRegel, konturSetzen, normalisieren, staffeln, fingerabdruck
  30-snap.js           rund, geradeKanten, rasterRate, engeLuecken, schiefeWinkel, strokeSnap   ← Paket „Snap“
  40-adapter.js        Adapter-Interface, adapterZds, adapterFrei, adapterWaehlen
  50-farbe.js          Farbquellen listen, Ziel-Paint erzeugen
  60-build.js          baueGroesse, einIcon, vorschau, audit, messeGuete
  70-main.js           showUI, Nachrichten-Handler, auswahlMelden
```

Alle `src/main/*.js` teilen sich EINEN Skript-Scope (Konkatenation, keine `import`/`export`).
Funktionsdeklarationen hoisten, `const`/`let` auf oberster Ebene müssen vor ihrer ersten
Nutzung zur LAUFZEIT stehen (Reihenfolge = Dateiname). Keine Namenskollisionen: jede Datei
prefixt interne Helfer, öffentliche Funktionen heißen wie hier spezifiziert.

## 2. Konfiguration (`00-config.js`)

```js
// Schema v1
{
  version: 1,
  adapter: 'auto' | 'zds' | 'frei',
  sprache: 'auto' | 'de' | 'en',
  master: {
    groesse: 72,                 // Kantenlänge der Source-Komponente (quadratisch)
    kontur: 6,                   // Strichstärke, auf die Source-Konturen beim Normalisieren gesetzt werden
    keylines: { Square: 56, Circular: 60, Wide: 64, Tall: 64 }   // nur Hinweis/Prüfung
  },
  variantenProperty: 'Size',     // Variantenname = `${variantenProperty}=${N}`
  groessen: [                    // sortiert aufsteigend nach N, mindestens 1 Eintrag, N eindeutig
    {
      N: 14,
      kontur: 1.5,
      keylines: { Square: 12, Circular: 13, Wide: 14, Tall: 14 },
      raster: 0.5,               // 1 | 0.5 | 0.25 — Snapping-Raster
      rasterGrob: null,          // null | 1 | 0.5 — bevorzugt gröberes Raster, wenn Weg ≤ 0.35 px (bisher: 24er → ganze Pixel)
      radius: { modus: 'proportional' | 'fest' | 'keine', wert: 1, min: 0 },
                                 // proportional: r·(N_inst/master); fest: immer `wert`; keine: 0.
                                 // min: Ergebnisse < min werden 0 (nur bei proportional/fest)
      standard: false            // genau EIN Eintrag true → Variante an Index 0 (Figma-Default beim Einfügen)
    }, …
  ],
  farbe: {
    modus: 'source' | 'hex' | 'variable',
    hex: '#444444',
    variable: { key: '', name: '', id: '' } | null,   // key für Library-Variablen (importVariableByKeyAsync), id für lokale
    sourceAngleichen: false      // true: Source-Fills/Strokes werden ebenfalls an die Farbe gebunden (ZDS-Verhalten)
  },
  snapping: true,                // Schnellschalter (Panel), spiegelt sich in clientStorage
  strokeFassung: false           // Schnellschalter
}
```

Profile (`PROFILE.zds`, `PROFILE.generic`):

- **zds**: adapter 'zds', master 72/6/{56,60,64,64}, groessen 14 (1.5, {12,13,14,14}, raster .5, grob null),
  18 (1.5, {14,15,16,16}, .5, null, standard true), 24 (2, {18,19,20,20}, .5, grob 1); alle radius proportional/min 0;
  farbe variable key `c03b6366f45ff8c719530cff7a2150965e4200fd` name `Text/70`, sourceAngleichen true.
- **generic**: adapter 'auto', master 24/2/{20,22,22,22}, groessen 16 (1.5, {14,15,15,15}, .5), 20 (1.5, {17,18,18,18}, .5),
  24 (2, {20,22,22,22}, .5, grob 1, standard true); radius proportional min 0; farbe modus 'source'.

API:
- `konfigDefaults(profil)` → tiefe Kopie.
- `async konfigLaden()` → liest `figma.root.getPluginData('icon-pipeline/konfig')`; leer → Profil per
  Adapter-Erkennung (ZDS-Board erkannt → zds, sonst generic). Danach `konfigMigrieren`, `konfigValidieren`.
- `konfigValidieren(k)` → `{ ok, fehler: [string], konfig }` (repariert, was reparierbar ist: sortiert Größen,
  erzwingt genau einen Standard, clampt raster auf {1,.5,.25}, hex-Format, N ganzzahlig > 0, kontur > 0).
- `async konfigSpeichern(k)` → validiert, schreibt pluginData ans Dokument, setzt globales `CFG`.
- `groesseCfg(N)` → Eintrag aus `CFG.groessen` oder wirft `PipelineFehler('GROESSE_UNBEKANNT')`.
- `variantenName(N)` → `${CFG.variantenProperty}=${N}`.
- Globale: `let CFG = null;` (wird in 70-main beim init gesetzt). Schnellschalter snapping/strokeFassung
  zusätzlich in `figma.clientStorage` unter `'icon-pipeline/schalter'` (gerätebezogen, wie bisher).

## 3. Sprache (`05-i18n.js`)

`const SPRACHEN = { de: {…}, en: {…} }`, `let SPRACHE = 'en'`, `t(key, params)` mit `{name}`-Platzhaltern.
UI meldet bei `init` die effektive Sprache (aus Konfig oder `navigator.language`). Hauptthread übersetzt
seine eigenen Texte (Logs, Fazit, Beschreibungen der Sets), die UI ihre eigenen. Set-Beschreibung
(`set.description`) immer in der eingestellten Sprache.

## 4. Fehler (`10-errors.js`)

```js
class PipelineFehler extends Error { constructor(code, params = {}, nodeId = null) }
// message = t('fehler.' + code, params); .hinweis = t('hinweis.' + code, params); .code; .nodeId
```
Codes (alle mit de/en-Text + Hinweis): `KEIN_ZIEL` (nichts Passendes ausgewählt), `KEINE_SOURCE`,
`SOURCE_LEER` (keine Vektoren), `SOURCE_MASS` (Source nicht master.groesse × master.groesse, params ist/soll),
`FIT_FEHLT` (Bisektion ohne Ergebnis), `VARIANTE_FEHLT`, `FARBE_UNAUFLOESBAR` (Variable nicht importierbar),
`UNION_FALLBACK` (Warnung, flatten ohne union), `KLASSE_GERATEN` (Info, Heuristik statt Grid/Override),
`SEITEN_FEHLEN` (zds), `KARTE_OHNE_SET` (zds, Info: Set wird neu angelegt), `GROESSE_UNBEKANNT`,
`SET_HAT_FREMDE_VARIANTE` (Warnung: Set enthält Größe, die nicht in der Konfig steht — wird NICHT gelöscht),
`FRAME_ZU_KOMPONENTE` (Info, frei-Modus: Frame wurde in Komponente umgewandelt), `KONFIG_UNGUELTIG`.
Log-Nachricht an UI: `{ type:'log', art:'ok'|'warn'|'err'|'info', text, hinweis?, code?, nodeId? }`.
Der Handler in 70-main fängt `PipelineFehler` und sendet text+hinweis+nodeId; sonstige Fehler → `err` mit `e.message`.

## 5. Geometrie (`20-geometrie.js`)

Aus code.js übernehmen: `gb`, `fitten`, `konturSetzen`, `staffeln`, `fingerabdruck`. Änderungen:
- `normalisieren(src)` — Konturen auf `CFG.master.kontur`; Farbbindung nur wenn `CFG.farbe.sourceAngleichen`
  und `farbeZielPaint()` eine Variable liefert.
- `async radienRegel(root, f, regel)` ersetzt `radienSkalieren`. `regel` = `groesseCfg(N).radius`.
  Wirkt auf uniformen cornerRadius, Per-Ecke-Radien und Vertex-Radien im vectorNetwork (wie bisher).
  Nur Radien > 0 anfassen; `modus:'keine'` setzt sie 0; `min` anwenden.
- `staffeln(cs)` — sortiert nach N (aus Variantennamen geparst), Standard-Variante an Index 0,
  Breite/Höhe des Sets aus der Summe berechnen (nicht fest 120×56).

## 6. Snapping (`30-snap.js`) — Paket „Snap“

Übernimmt `geradeKanten`, `rasterRate`, `engeLuecken`, `schiefeWinkel`, `strokeSnap` aus code.js
(Zeilen 162–612) und parametrisiert das Raster:

- `rund(wert, r, phase = 0)` → `Math.round((wert - phase) / r) * r + phase`.
- `snapWert(wert, phase, rc)` mit `rc = { raster, rasterGrob }`: erst grob, wenn `rasterGrob` gesetzt und
  `|grob − wert| ≤ SNAP.GROB_TOLERANZ` (0.35), sonst `rund(wert, raster, phase)`.
- Phase einer Kontur mit Gewicht w: `(w / 2) % rc.raster`.
- Alle festen `Math.round(x * 2) / 2` und alle `N === 24`-Sonderfälle (Rhythmus-Schutz, Fill-Stem-Paare)
  laufen über `rund`/`snapWert` mit `rc`. Mitte-Schutz (N/2), Spiegel-Kopplung, Gelenk-Schutz, Rhythmus-
  Schutz bleiben inhaltlich unverändert.
- Signaturen: `async strokeSnap(box, N, rc)` → `{ bewegt, geschuetzt }`; `rasterRate(flat, raster)` →
  `{ auf, gesamt }` (Toleranz 0.01); `engeLuecken(flat)`; `schiefeWinkel(root)`; `geradeKanten(netz, V, achse)`.
- Keine Referenz auf `CFG`, `GROESSEN`, `STROKE` oder `KEY` — alles über Parameter. Reine Funktionen bis auf die Figma-Knoten.

## 7. Adapter (`40-adapter.js`)

```js
// Interface — jedes Adapter-Objekt:
{
  name: 'zds' | 'frei',
  async erkennen(),                 // true, wenn das Profil zum File passt (zds: Seiten Icons+Source und Frame 'ZDS Icons · Karten')
  async kontext(),                  // lädt Seiten/Knoten, setzt adapter-interne Referenzen
  async aufloesen(selectionNode),   // → Ziel | null
  //   Ziel = { name, src: COMPONENT, klasse: 'Square'|'Circular'|'Wide'|'Tall', klasseQuelle: 'grid'|'override'|'heuristik',
  //            karte: SceneNode|null, fokusNode: SceneNode }
  zielSet(ziel),                    // → COMPONENT_SET | null (bestehendes Set)
  zielEltern(ziel),                 // → Node, unter dem ein NEUES Set angelegt wird, plus Position { x, y }
  strokeHeim(ziel),                 // → FRAME für Stroke-Fassungen
  async alle(),                     // → [Ziel] für Audit / Alle bauen
  async nachBuild(ziel, set, info)  // Status-Chip, Keywords, Preview-Zellen (zds); Frei: nichts
}
let ADAPTER = null;
async function adapterWaehlen(cfg)  // 'auto' → zds wenn erkennen(), sonst frei
```

**adapterZds** = heutiges Verhalten (kontext, karteZu, sourceZu, klasseZu über Grid-Instanz, librarySet
inkl. Tab-Bar-Fallback, previewFuellen, Status-Chip published, Keywords → Beschreibung, strokeHeim auf Source).

**adapterFrei**:
- `aufloesen`: vom Selektionsknoten aufwärts. INSTANCE → `getMainComponentAsync`. COMPONENT mit
  `width ≈ height ≈ CFG.master.groesse` (±0.5) → Source. COMPONENT/COMPONENT_SET, dessen Name/Variante nach
  Schema `${prop}=N` aussieht → Ziel-Set; Source dazu über Namen suchen (COMPONENT mit Master-Maß, dessen
  bereinigter Name gleich ist; Suche zuerst auf der aktuellen Seite, dann alle Seiten). FRAME mit Master-Maß →
  `figma.createComponentFromNode(frame)` + Info `FRAME_ZU_KOMPONENTE`. Sonst null.
- Namensbereinigung: führenden `.` entfernen, Klammerzusatz am Ende entfernen (`(72px source)` u. ä.), trimmen.
- `klasse`: `src.getPluginData('icon-pipeline/klasse')` → 'override'; sonst Heuristik aus gb-Verhältnis
  (≥1.2 Wide, ≤0.833 Tall, sonst Square) → 'heuristik'. Nachricht `klasseSetzen` schreibt das pluginData.
- `zielSet`: COMPONENT_SET mit exakt dem Namen; aktuelle Seite zuerst, dann alle geladenen Seiten.
- `zielEltern`: Elternknoten der Source (PAGE/FRAME/SECTION); Position rechts neben der Source (+40 px).
- `strokeHeim`: Frame `Icon Pipeline · Stroke` auf der Seite der Source (anlegen falls fehlt).
- `alle()`: alle COMPONENTs der AKTUELLEN Seite mit Master-Maß, die nicht Variante eines Sets sind.
- `nachBuild`: nur pluginData (Fingerabdruck, Fehlerwerte) — das macht 60-build sowieso zentral.

## 8. Farbe (`50-farbe.js`)

- `async farbenListen()` → `{ lokal: [{ id, key, name, kollektion, hex }], bibliotheken: [{ kollektionKey, kollektion, bibliothek, variablen: [{ key, name }] }] }`.
  Lokal: `figma.variables.getLocalVariablesAsync('COLOR')`, hex aus dem ersten Modus (`valuesByMode`), Alias
  auflösen. Bibliotheken: `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` +
  `getVariablesInLibraryCollectionAsync(key)` gefiltert auf COLOR — ohne Werte (Import erst bei Auswahl).
- `async farbeVariableAufloesen(cfgFarbe)` → Variable | null. Reihenfolge: `key` → importVariableByKeyAsync;
  dann `id` → getVariableByIdAsync; dann Name unter lokalen Variablen. Ergebnis in `CTX.farbVariable` cachen.
- `farbeZielPaint(srcPaint)` → Paint für die geflattete Fläche: modus 'variable' → SOLID grau + Bindung;
  'hex' → SOLID aus hex; 'source' → Kopie des ersten SOLID-Paints aus Stroke oder Fill der Source
  (inkl. `boundVariables`), Fallback `#444444`.
- `async farbePruefen(auswahl)` → `{ ok, hex, name }` für die UI (`farbeGeprueft`).

## 9. Build (`60-build.js`)

Übernimmt `baueGroesse`, `einIcon`, `vorschau`, `audit`, `messeGuete` mit diesen Änderungen:
- Schleifen über `CFG.groessen` statt `GROESSEN`; `g.kontur` statt `STROKE[N]`; `g.keylines[klasse]` statt `KEY`;
  `strokeSnap(box, N, { raster: g.raster, rasterGrob: g.rasterGrob })`; `radienRegel(det, f, g.radius)`;
  Faktor `f = inst.width / CFG.master.groesse`.
- Variante fehlt im bestehenden Set → neue COMPONENT anlegen und `set.appendChild(comp)` (nicht werfen).
  Set hat Variante, deren N nicht in der Konfig steht → Warnung `SET_HAT_FREMDE_VARIANTE`, nicht löschen.
- Fläche: `flat.fills = [farbeZielPaint(srcPaint)]`.
- Ziel statt Karte: `einIcon(ziel, snap, strokeAuch)`; `set = ADAPTER.zielSet(ziel)`; neues Set unter
  `ADAPTER.zielEltern(ziel)`; Stroke-Fassungen in `ADAPTER.strokeHeim(ziel)`; am Ende `ADAPTER.nachBuild`.
- Prüfung `SOURCE_MASS` vor dem Bau; `SOURCE_LEER` wenn gb(src) null; `FIT_FEHLT` wenn fitten null (statt '???').
- `vorschau` liefert zusätzlich je Zelle `pngNeu8` (SCALE 8) und, wenn vorhanden, `pngAlt8`, dazu `kontur`,
  `raster`, `radius` der Größe für die Beschriftung. Ohne bestehendes Set: `alt`-Felder null, kein Fehler.
- `audit` läuft über `ADAPTER.alle()`, misst Keylines und `rasterRate(kind, g.raster)`; Farbprüfung nur
  im Modus 'variable'.
- pluginData-Schlüssel bleibt `'zds'` (Kompatibilität mit bestehenden Sets).

## 10. Nachrichtenprotokoll (UI ↔ Hauptthread)

UI → Main:
| type | Felder |
|---|---|
| `init` | `sprache` (effektiv, 'de'/'en') |
| `run` | `snap`, `stroke` |
| `vorschau` | `snap` |
| `audit` | — |
| `alle` | `snap`, `stroke` |
| `fokus` | `nodeId?` (ohne → aktuelles Ziel) |
| `einstellung` | `snap`, `stroke` (Schnellschalter → clientStorage) |
| `konfigLaden` | — |
| `konfigSpeichern` | `konfig` |
| `konfigZuruecksetzen` | `profil`: 'zds' \| 'generic' |
| `farbenListen` | — |
| `farbePruefen` | `farbe` (Teilobjekt wie CFG.farbe) |
| `klasseSetzen` | `klasse` (nur Frei-Modus; schreibt pluginData an der Source, meldet `auswahl` neu) |
| `messwert` | `id`, `werte` |

Main → UI:
| type | Felder |
|---|---|
| `auswahl` | `ziel`: null \| `{ name, klasse, klasseQuelle, hatSet, adapter }` |
| `log` | `art`, `text`, `hinweis?`, `code?`, `nodeId?` |
| `progress` | `i`, `n`, `name` |
| `fazit` | `gut`, `text`, `beiAuswahl?` |
| `diff` | `name`, `klasse`, `snap`, `zellen: [{ N, kontur, raster, alt, neu, pngNeu, pngNeu2, pngNeu8, pngAlt, pngAlt2, pngAlt8, ist, soll, gerastet, guete }]` |
| `mess` | `id`, `paare` (unverändert) |
| `einstellungen` | `snap`, `stroke` |
| `konfig` | `konfig`, `fehler: [string]`, `adapter` (effektiv gewählt), `profile: ['zds','generic']` |
| `farben` | wie `farbenListen()` |
| `farbeGeprueft` | `ok`, `hex`, `name` |
| `fertig` | — |

Reihenfolge beim Start: UI sendet `init` → Main lädt Konfig, wählt Adapter, sendet `konfig`, `einstellungen`,
`auswahl`, `fertig`.

## 11. UI (`gen-ui.mjs`)

- Kopf: Marke, Titel „Icon Pipeline“, Chip mit Adapter (ZDS / Frei). `fig-tabs`: **Icon** | **Einstellungen**.
- Tab Icon: wie heute (Auswahl, Vorschau, Bauen, Schnellschalter Snapping/Stroke-Fassung, Library-Gruppe
  Audit/Alle bauen jetzt IMMER sichtbar, Fazit, Fortschritt, Diff, Protokoll). Auswahlzeile zeigt Klasse
  als Chip; im Frei-Modus ist die Klasse per Dropdown änderbar (`klasseSetzen`), bei `klasseQuelle:'heuristik'`
  als „geraten“ markiert.
- Tab Einstellungen (alles bindet an eine lokale Kopie der Konfig; „Speichern“ sendet `konfigSpeichern`,
  „Zurücksetzen“ öffnet Dialog mit Profilwahl):
  1. Allgemein: Adapter (auto/zds/frei), Sprache (auto/de/en), Variantenproperty.
  2. Master: Größe, Kontur, Keylines ×4.
  3. Größen-Tabelle: je Zeile N, Kontur, Raster (Select 1 / 0,5 / 0,25), Grob (Select aus / 1 / 0,5),
     Radius (Modus + Wert + Min), Keylines ×4 (aufklappbar), Standard (Radio), Entfernen. Button „Größe hinzufügen“
     schlägt N und Keylines proportional zur letzten Zeile vor.
  4. Farbe: Segment source / hex / variable. hex → `fig-input-color`. variable → Suchfeld + Liste mit
     `fig-swatch`, gruppiert nach Kollektion; Bibliotheks-Kollektionen als aufklappbare Gruppen, Variablen ohne
     Swatch bis zur Auswahl (`farbePruefen` liefert hex). Schalter „Source-Farbe angleichen“.
  Ungültige Eingaben werden inline markiert (Fehlerliste aus `konfig.fehler`).
- Protokoll: Einträge mit `hinweis` bekommen eine zweite, hellere Zeile; Einträge mit `nodeId` einen Link
  „zeigen“ → `fokus { nodeId }`.
- Vorschau: bestehende Onionskin- und Pixelansicht plus (a) Schalter „dunkler Grund“ (Bühne und Pixelzellen
  auf `#1e1e1e`, Icon-Farben invertiert), (b) Zeile „Differenz“: Canvas je Größe, |alt − neu| pro Pixel bei
  gewählter Rasterung, entfernt = magenta, hinzugekommen = türkis, (c) 8×-PNG als schärfste Zoomstufe im
  Pixel-Panel statt hochskaliertem 1×, (d) Beschriftung mit Kontur/Raster/Radius. Ohne `alt`: nur „neu“.
- Sprache: `const T = { de: {…}, en: {…} }`, `t(key)`; alle sichtbaren Strings darüber. Wechsel ohne Neustart.
- `LIBRARY_MODUS`-Schalter entfällt (Gruppe immer da).

## 12. Nicht-Ziele dieser Runde

Kein SVG-Batch-Export, kein Scaffold-Button, keine Algorithmus-Änderungen (Extrema-Phasen-Suche folgt später),
keine Per-Ecke-Radiensteuerung, keine Speicherung der Konfig außerhalb des Files.

## 13. Bauen & Prüfen

`node build.mjs` → schreibt code.js und ui.html. Jedes Paket muss `node --check code.js` bestehen und darf
keine `import`/`export`-Anweisungen in `src/main/*.js` enthalten. Figma-API kann nicht headless getestet werden;
manuell testen im ZDS-File (Profil zds) und in einem leeren File mit einer 24er-Komponente (Profil generic).
