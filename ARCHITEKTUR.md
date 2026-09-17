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

---

# Runde 3 — „Bezahl-Qualität“ (2026-09-17)

Ergänzt v2. Neue Dateien: `src/main/06-i18n-zusatz.js`, `src/main/65-plan.js`, `src/main/66-bericht.js`,
`src/main/67-export.js`, `src/main/68-beispiel.js`, `test/`, `docs/`. Paketzuschnitt siehe Abschnitt 22.

## 14. Konfig-Erweiterungen (`00-config.js`)

```js
schreiben: {                       // Mutationen außerhalb des Ziel-Sets — Standard konservativ
  frameUmwandeln: false,           // FRAME im Master-Maß in Komponente wandeln (nur beim Bauen)
  strokeHeimAnlegen: true,         // Frame für Stroke-Fassungen anlegen dürfen
},
```
- `konfigValidieren` liefert `fehler` jetzt STRUKTURIERT: `[{ pfad: 'groessen.1.kontur', text }]`. `pfad` folgt den
  `data-pfad`-Attributen der UI (`master.groesse`, `groessen.<index>.keylines.Square`, `farbe.hex`, `variantenProperty`,
  `adapter`, `sprache`; Listen-Fehler wie „keine Größen“ mit `pfad: 'groessen'`). Index bezieht sich auf die
  SORTIERTE Liste.
- Neue Profile in `PROFILE`, `PROFIL_NAMEN = ['zds','generic','material','lucide','apple']`:
  - **material**: master 24 / kontur 2 / keylines {Square 18, Circular 20, Wide 20, Tall 20}; groessen 18 (1.5, {13.5,15,15,15}),
    24 (2, {18,20,20,20}, standard, grob 1), 36 (3, {27,30,30,30}, grob 1), 48 (4, {36,40,40,40}, grob 1); raster .5; radius proportional; farbe source.
  - **lucide**: master 24 / 2 / {22,22,22,22}; groessen 16 (1.5, {14.5,…}), 20 (1.5, {18.5,…}), 24 (2, {22,…}, standard, grob 1),
    32 (2.5, {29.5,…}, grob 1), 48 (4, {44,…}, grob 1); farbe source.
  - **apple**: master 28 / 2 / {21,22,22,22}; groessen 16 (1.5, {12,12.5,12.5,12.5}), 20 (1.5, {15,15.5,15.5,15.5}),
    24 (2, {18,19,19,19}, standard, grob 1), 28 (2, {21,22,22,22}, grob 1), 32 (2.5, {24,25,25,25}, grob 1); farbe source.
- `konfigProfilInfo()` → `[{ name, titel, beschreibung }]` (Texte über t: `profil.<name>.titel/.beschreibung`).

## 15. Trockenlauf (`65-plan.js`)

`async planen(ziele, snap, stroke)` → ohne jede Mutation:
```js
{ eintraege: [{ name, aktion: 'aendern'|'neu', klasse, klasseQuelle,
    varianten: { vorhanden: [N], fehlen: [N], fremd: [N] },   // fremd = im Set, nicht in Konfig (bleiben stehen)
    instanzen: number|null,      // Instanzen des Sets in geladenen Seiten (findAll INSTANCE mit mainComponent im Set) — null wenn zu teuer (> 50k Knoten)
    gesperrt: bool, warnungen: [text], nodeId }],
  zusammenfassung: { aendern, neu, fehlen, gesperrt, instanzen, strokeHeim: bool /* würde angelegt */ } }
```
UI→Main `planen { umfang: 'auswahl'|'alle', snap, stroke }` → Main→UI `plan { … , umfang }`. Danach `fertig`.
`alle` und `run` prüfen `gesperrt` (Source, Set oder Variante `locked`) → `PipelineFehler('GESPERRT', {name}, nodeId)`.

## 16. Abbruch, Undo, Fortschritt

- UI→Main `abbrechen` setzt `ABBRUCH = true`. Die Schleifen in `alle`, `audit`, `bericht`, `exportieren` prüfen das Flag
  zwischen zwei Icons, beenden sauber, melden `fazit` „abgebrochen nach i/n“ mit den Teilergebnissen. Flag vor jedem Lauf zurücksetzen.
- `progress` auch für `audit`, `bericht`, `exportieren`.
- Nach `run`: `figma.commitUndo()` und `logZeile('info', t('log.undo', { name }))`. Nach `alle`: pro Icon commitUndo (wie bisher)
  und eine Abschlusszeile `t('log.undoBatch', { n })` (Cmd+Z je Icon).

## 17. Frame-Umwandlung, Stroke-Heim

- `quellePruefen`: Frame nur wandeln, wenn `CFG.schreiben.frameUmwandeln`; sonst `PipelineFehler('FRAME_NICHT_ERLAUBT', {name}, frame.id)`
  mit Hinweis auf Einstellungen → Schreiben.
- `strokeHeim` nur anlegen, wenn `CFG.schreiben.strokeHeimAnlegen`; sonst Stroke-Fassung überspringen mit `melden('warn','STROKEHEIM_AUS')`.

## 18. Vorschau mit ungespeicherter Konfig

UI→Main `vorschauMit { konfig, snap }`: Main validiert `konfig` (nicht speichern!), setzt `CFG` temporär, löst Ziel auf,
ruft `vorschau`, stellt `CFG` in `finally` zurück, antwortet `diff { …, temporaer: true }`. Farbvariable ggf. neu auflösen und danach Cache leeren.

## 19. Qualitätsbericht (`66-bericht.js`)

- pluginData `'zds'` am Set erweitern: `guete: { [N]: { fehler, aa } }` (statt nur `fehler`) und `verlauf: [{ zeit, guete }]`
  (max. 12 Einträge, ältester fällt raus). `fehler` weiterhin schreiben (Kompatibilität).
- `async bericht(ziele)` → `{ zeilen: [{ name, hatSet, veraltet, nodeId, groessen: { [N]: { treue, aa, treueVorher, keylineIst,
  keylineSoll, keylineOk, raster: { auf, gesamt }, struktur: [text] } } }], zusammenfassung: { icons, ohneSet, veraltet,
  treueMittel, treueMittelVorher, keylineOk, keylineGesamt }, zeit }`.
  treue/aa aus pluginData (letzter Bau), keyline/raster/struktur live gemessen (wie audit). UI→Main `bericht` → Main→UI `bericht {…}`.

## 20. Dev-Export (`67-export.js`)

UI→Main `exportieren { umfang: 'auswahl'|'alle' }` → Main→UI `exportDaten { dateien: [{ pfad, inhalt }], fehlend: [name] }`.
- Pro Set und Variante: `exportAsync({ format: 'SVG_STRING', svgOutlineText: true, svgIdAttribute: false })`, dann
  `fill="#xxxxxx"` und `fill:#xxxxxx` → `currentColor`, `stroke="#…"` ebenso; `width`/`height`-Attribute am Wurzelelement entfernen, `viewBox` behalten.
- `pfad` = `<name>/<name>-<N>.svg` (Name kleingeschrieben, Leerzeichen → `-`). Zusätzlich `manifest.json` mit
  `[{ name, groessen: [N], keywords, beschreibung }]`.
- Die UI packt das in ein ZIP (Store-Methode, CRC32, ohne Bibliothek) und bietet `<a download="icons.zip">` an;
  optional `sprite.svg` (`<symbol id="<name>-<N>" viewBox…>`), Schalter in der UI.

## 21. Beispiel-Icon (`68-beispiel.js`)

UI→Main `beispielAnlegen` (nur Frei-Modus): legt auf der aktuellen Seite eine Komponente `demo-icon` im Master-Maß an
(Ellipse zentriert, Durchmesser = keylines.Circular, Kontur = master.kontur, plus eine waagerechte Linie durch die Mitte
mit Länge keylines.Square·0.6), wählt sie aus, baut per `einIcon` das Set daneben und meldet `log.beispielAngelegt`.
Alles innerhalb eines Undo-Schritts.

## 22. Protokoll-Ergänzungen (Übersicht)

| UI → Main | Main → UI |
|---|---|
| `planen {umfang, snap, stroke}` | `plan {eintraege, zusammenfassung, umfang}` |
| `abbrechen` | — (Fazit „abgebrochen“) |
| `vorschauMit {konfig, snap}` | `diff {…, temporaer: true}` |
| `bericht` | `bericht {zeilen, zusammenfassung, zeit}` |
| `exportieren {umfang}` | `exportDaten {dateien, fehlend}` |
| `beispielAnlegen` | `log`, `auswahl`, `fertig` |
| `konfigSpeichern {konfig}` (unverändert; Import = dasselbe) | `konfig {konfig, fehler:[{pfad,text}], adapter, profile, profilInfo}` |

Neue Fehlercodes: `GESPERRT`, `FRAME_NICHT_ERLAUBT`, `STROKEHEIM_AUS`, `ABGEBROCHEN`, `EXPORT_FEHLT`.

## 23. UI (Runde 3)

- **Trockenlauf-Dialog** vor „Alle neu bauen“ UND vor „Icon bauen“ (bei Einzelbau kompakt): Liste aus `plan` (Name, Aktion, fehlende/fremde
  Varianten, Instanzen, Schloss-Symbol bei gesperrt), Zusammenfassung, Buttons Abbrechen / Bauen. Ein Schalter „Trockenlauf beim Einzelbau
  überspringen“ (clientStorage über `einstellung`, Feld `trockenlaufEinzel`).
- **Abbrechen**-Button in der Fortschrittszeile → `abbrechen`.
- **Leerzustand** (Frei-Modus, keine Auswahl): drei kurze Erklärzeilen (Master, Keyline, Raster/Snapping) + Button „Beispiel-Icon anlegen“.
- **Einstellungen**: Block „Schreiben“ (zwei Schalter), Profil-Chooser mit Titel/Beschreibung aus `profilInfo`, Konfig **Export** (JSON-Download
  `icon-pipeline.konfig.json`) und **Import** (Datei wählen → `konfigSpeichern`), Button „Vorschau mit diesen Einstellungen“ → `vorschauMit`
  (nur aktiv bei Auswahl; Ergebnis im Icon-Tab anzeigen und dorthin wechseln, Chip „ungespeichert“).
  Strukturierte Fehler: `pfad` → Feld markieren (`data-pfad`), Text als Tooltip; Vorher/Nachher-Vergleich entfällt.
- **Tab „Bericht“** (dritter Tab): Kennzahlen-Kacheln (Icons, ohne Set, veraltet, Treue-Mittel mit Trendpfeil, Keyline ok/gesamt),
  Tabelle Icon × Größe mit Treue (3 Nachkommastellen, Farbskala grün→rot 0…0,15), AA %, Keyline-Häkchen; Klick auf Namen → `fokus`;
  Sortierung nach Spalte; Buttons „Bericht erstellen“, „CSV“ (Download), „SVG-Export“ (Umfang alle/Auswahl, Sprite-Schalter).
- **Sprache**: Englisch ist Standard, wenn `navigator.language` nicht mit `de` beginnt (bereits so). Alle neuen Strings de + en.

## 24. Tests & Doku (`test/`, `docs/`)

- `test/stub-figma.mjs`: minimaler `figma`-Stub (showUI, ui.postMessage sammelt, root.pluginData, currentPage, clientStorage, variables, loadAllPagesAsync).
- `test/run.mjs` (Aufruf `node test/run.mjs`, kein npm): lädt `code.js` per `new Function` mit Stub und prüft:
  Konfig-Validierung (gültig/kaputt/Profile alle valide), `fehler[].pfad` gesetzt, i18n-Vollständigkeit (jeder Schlüssel in de UND en,
  gleiche Platzhalter; alle `FEHLER_CODES` haben fehler.+hinweis.), `rund`/`snapWert`-Regression (aus scratchpad-Test übernehmen),
  Namensbereinigung, Hex/RGB, **Protokoll-Vertrag**: jeder `m.type === '…'` in `70-main.js` kommt als `type: '…'` in `gen-ui.mjs` vor und
  jeder `type: '…'` den Main sendet wird in der UI-`onmessage` behandelt (Regex über beide Dateien).
- `docs/SNAPPING.md`: die Rasterregeln (Stem-Paare, Phase, Mitte-Schutz, Spiegel-Kopplung, Gelenk-Schutz, Rhythmus, Fill-Stem, Extrema, Orakel)
  in Englisch, danach Deutsch, aus den Codekommentaren von `30-snap.js` und `60-build.js`. `docs/KONFIG.md`: Schema mit jedem Feld.
- `README.md`: Englisch zuerst, deutscher Abschnitt darunter. `CHANGELOG.md`: v1, v2, Runde 3.
- `build.mjs` ruft am Ende `node test/run.mjs` auf (Fehler → Exit ≠ 0).

## 25. Paketzuschnitt Runde 3 (disjunkte Dateien)

| Paket | Dateien |
|---|---|
| A1 Konfig | `00-config.js`, `05-i18n.js` (Profile, schreiben, strukturierte Fehler, profilInfo, Texte für 14/17), `10-errors.js` (neue Codes) |
| A2 Kern | `60-build.js`, `70-main.js`, `40-adapter.js`, NEU `06-i18n-zusatz.js` (eigene Texte via Object.assign auf SPRACHEN.de/en), `65-plan.js`, `66-bericht.js`, `67-export.js`, `68-beispiel.js` |
| B UI | `gen-ui.mjs` |
| C Tests+Doku | `test/`, `docs/`, `README.md`, `CHANGELOG.md`, `build.mjs` (nur Testaufruf anhängen) |

A2 darf `00-config.js`/`05-i18n.js` NICHT anfassen und verlässt sich auf die in 14 spezifizierten Namen
(`CFG.schreiben.frameUmwandeln`, `CFG.schreiben.strokeHeimAnlegen`, `konfigProfilInfo()`, `fehler[].pfad`).
