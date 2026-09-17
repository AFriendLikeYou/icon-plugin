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

---

# Runde 4 — Verständlichkeit, Vorschau-UX, Lizenz, Onboarding (2026-09-17)

## 26. UI-Module

`gen-ui.mjs` ist Assembler. Quellen in `src/ui/`:
- `style/*.css` (Reihenfolge), `woerter/*.mjs` (`export default {de,en}`, spätere Dateien überschreiben frühere Schlüssel),
  `markup/*.html`, `logik/*.js` (ein Skript-Scope, Platzhalter `__WOERTER__` nur in 10-grundlagen).
- Nachrichten-Registry: `bei('typ', fn)` (10-grundlagen) — Handler in eigenen Modulen registrieren, `95-nachrichten.js` nicht anfassen.
- Test-Runner zählt `bei('…')` als UI-Empfang.

## 27. Begriffe (de / en) — verbindlich in UI, Hauptthread-Logs und Doku

| bisher | neu de | neu en | Erklärung (Tooltip/Hilfetext) |
|---|---|---|---|
| Source | Vorlage | Source | Die Master-Komponente, aus der alle Größen gebaut werden (z. B. 72 px). |
| Kontur | Strichstärke (px) | Stroke width (px) | Strichstärke der Konturen in dieser Größe. |
| Raster | Kanten rasten auf | Snap edges to | ganze Pixel (1) / halbe Pixel (0,5) / Viertelpixel (0,25). |
| Grob | Ganze Pixel bevorzugen | Prefer whole pixels | Kanten wandern auf ganze Pixel, wenn der Weg höchstens 0,35 px ist. Sonst gilt das Raster. Optionen: aus / 1 / 0,5. |
| Radius (Modus) | Eckenradien | Corner radii | proportional verkleinern / fester Wert / keine Rundung. |
| Wert | Radius (px) | Radius (px) | nur bei „fester Wert“ sichtbar |
| Min | Mindestradius (px) | Minimum radius (px) | Kleinere Radien werden eckig. Nur bei proportional/fest sichtbar. |
| Keyline | Keyline (Icon-Körper) | Keyline (icon body) | Das Maß, das der Icon-Körper im Kasten einnimmt. Skizze zeigt Formklassen. |
| Farbe: Source | Wie Vorlage | Like source | Fläche übernimmt Farbe/Variable der Vorlage. |
| Farbe: Hex | Feste Farbe | Fixed color | |
| Farbe: Variable | Design-Token | Design token | Farbvariable aus diesem File oder einer Library. |
| Source-Farbe angleichen | Vorlage an diese Farbe binden | Bind source to this color | nur bei Feste Farbe / Design-Token sichtbar |
| Treue | Rasterfehler | Raster error | Abweichung der echten Pixel vom Ideal, 0 = perfekt, unter 0,02 sehr gut, über 0,05 auffällig. |
| AA % | weiche Pixel | soft pixels | Anteil halbtransparenter Randpixel. Niedriger ist schärfer, hängt von der Form ab (Kreise haben mehr). |
| Keyline ✓ | Maß stimmt | Size ok | Icon füllt das vorgesehene Keyline-Maß. |
| verschlammt | „Zwischenraum {d} px füllt sich bei 1× zu“ | “gap of {d} px closes at 1×” | |
| schiefe Kante | „Kante bei {ist}° statt {soll}° — in der Vorlage begradigen“ | “edge at {ist}° instead of {soll}° — straighten in the source” | |
| veraltet | Vorlage geändert | source changed | Vorlage wurde nach dem letzten Bau verändert. |

## 28. Hauptthread (Paket Kern)

1. **Strukturierte Audit-Einträge.** `audit()` und `bericht()` liefern `abw` als `[{ name, N|null, code, text, hinweis?, nodeId, schwere: 'fehler'|'warnung'|'info' }]`.
   Codes: `KEYLINE_ABWEICHUNG {ist,soll}`, `STRUKTUR_KNOTEN {n}`, `STRUKTUR_TYP {typ}`, `RESTKONTUR`, `FARBE_UNGEBUNDEN`, `LUECKE_ENG {d}`,
   `KANTE_SCHIEF {ist,soll}`, `VORLAGE_GEAENDERT`, `KEINE_SOURCE`, `KEIN_SET`. Texte in 06-i18n-zusatz.js nach Abschnitt 27 (kein „verschlammt“).
   `log`-Nachrichten aus dem Audit tragen zusätzlich `name`, `N`, `schwere`. Der Handler sendet sie weiterhin einzeln als `log`.
2. **Farbwerte nachladen.** UI→Main `farbenWerte { keys: [] }` (max. 40 je Aufruf) → `importVariableByKeyAsync` je Key, hex aus dem ersten Modus
   (Alias auflösen) → Main→UI `farbenWerteErgebnis { werte: { [key]: hex|null } }`.
3. **Export nach Namen.** `exportieren { umfang: 'alle'|'auswahl'|'namen', namen?: [] }`; `'namen'` filtert `ADAPTER.alle()` nach `name`;
   `'auswahl'` = aktuelles Ziel.
4. **Merker.** Generisch für UI-Zustand im clientStorage: UI→Main `merkerSetzen { schluessel, wert }`, `merkerLaden { schluessel }` →
   `merker { schluessel, wert }`. Präfix `icon-pipeline/merker/`. Genutzt für `onboardingGesehen`, `ersteSchritte` (Objekt), `vergleichsmodus`.
5. **Lizenz** NEU `75-lizenz.js`, Manifest `permissions: ["teamlibrary","payments"]`:
   ```js
   const LIZENZ = { modell: 'einmalzahlung', testtage: 14, debugUmgehen: true,   // debugUmgehen: Dev-Build — später false
                    kostenpflichtig: ['alle', 'bericht', 'exportieren', 'konfigImport'] };
   let LIZENZ_DEBUG = null;   // 'PAID'|'UNPAID'|'TRIAL'|null — nur wenn debugUmgehen
   function lizenzStatus() → { status: 'PAID'|'UNPAID'|'TRIAL'|'NOT_SUPPORTED'|'DEV', resttage: number|null, debug: bool, modell, kostenpflichtig }
   //  figma.payments fehlt → 'DEV' (zählt wie PAID) wenn debugUmgehen, sonst 'NOT_SUPPORTED' (zählt wie PAID — nie den Nutzer aussperren, wenn Figma keinen Status liefert)
   //  status.type 'PAID' → PAID; 'UNPAID' und getUserFirstRanSecondsAgo() < testtage·86400 → TRIAL mit resttage; sonst UNPAID
   //  LIZENZ_DEBUG überschreibt (nur debugUmgehen)
   async function lizenzPruefen(funktion)  // wirft PipelineFehler('LIZENZ_NOETIG', { funktion }) bei UNPAID und funktion ∈ kostenpflichtig
   ```
   Nachrichten: UI→Main `lizenzStatus` → `lizenz {…}`; `lizenzKaufen { grund: 'PAID_FEATURE'|'TRIAL_ENDED' }` → `initiateCheckoutAsync({ interstitial })`,
   danach erneut `lizenz`; `lizenzDebug { status }` → `LIZENZ_DEBUG` setzen und, wenn `figma.payments` vorhanden, `setPaymentStatusInDevelopment({type})`,
   dann `lizenz`. `lizenzPruefen` vor `alle`, `bericht`, `exportieren`, `konfigSpeichern` mit Feld `quelle:'import'`. `konfigSenden` liefert zusätzlich `lizenz`.
   Fehlercode `LIZENZ_NOETIG` (Text: „{funktion} gehört zur Vollversion“, Hinweis: Einmalkauf, Testphase). Kauf-Interstitial darf die UI nicht blockieren.
6. **Beispiel-Icon** darf im ZDS-Modus ebenfalls laufen (auf der Seite Source, Frame „Icon Pipeline · Beispiel“); dafür `ADAPTER.aufloesen` auf die frisch angelegte Komponente — im ZDS-Adapter zusätzlich Fallback: Komponente im Master-Maß ohne Karte → Ziel nach Frei-Regeln.

## 29. UI-1 — Einstellungen, Farbe, Onboarding, Lizenz

Dateien: `markup/10-kopf.html`, `40-einstellungen.html`, `50-dialoge.html`, `logik/30-tabs.js`, `40-auswahl.js`, `80-einstellungen.js`, NEU `85-onboarding.js`, `86-lizenz.js`,
`woerter/10-basis.mjs` (Begriffe nach 27), NEU `woerter/20-einstellungen.mjs`, `style/20-einstellungen.css`.

1. **Größen-Karte** neu beschriften nach 27; jedes Feld mit `fig-tooltip` und einer kurzen Hilfezeile (9,5 px, sekundär) unter dem Feld; „Radius (px)“ nur bei
   „fester Wert“, „Mindestradius“ nicht bei „keine Rundung“; „Ganze Pixel bevorzugen“ als fig-dropdown aus/1/0,5 mit Hilfetext; Keyline-Bereich mit Skizze bleibt.
2. **Farbe**: Segment „Wie Vorlage / Feste Farbe / Design-Token“, darunter je Modus ein Satz Erklärung; „Vorlage an diese Farbe binden“ nur bei Feste Farbe/Design-Token.
   Token-Liste: jede Zeile mit `fig-swatch`; für Library-Variablen ohne hex beim Aufklappen einer Kollektion `farbenWerte` in 40er-Paketen anfordern,
   Ergebnis in die Zeilen schreiben (Registry `bei('farbenWerteErgebnis', …)`); während des Ladens `fig-shimmer`/Skeleton-Swatch.
3. **Onboarding** (`85-onboarding.js`): beim ersten Start (`merkerLaden onboardingGesehen` → fehlt) ein `<dialog is="fig-dialog">` mit 4 Schritten,
   Schrittzähler „1/4“, Zurück/Weiter/Überspringen, am Ende „Los geht’s“ + Merker setzen: (1) Was das Plugin tut, mit Keyline-Skizze 72→24/18/14;
   (2) Erkannter Modus (ZDS-Board / Frei) + Profilwahl; (3) Ablauf: auswählen → Vorschau → Bauen, mit Hinweis Trockenlauf; (4) Einstellungen, Bericht, Export,
   Testphase/Lizenz. Kopfzeile bekommt einen „?“-Button (fig-button ghost) → Rundgang erneut. Leerzustand zusätzlich mit Checkliste „Erste Schritte“
   (3 Punkte: Icon auswählen · Vorschau ansehen · Icon bauen; Häkchen aus Merker `ersteSchritte`, gesetzt aus den Handlern für `auswahl`, `diff`, `fazit`).
4. **Lizenz** (`86-lizenz.js`): Kopf-Chip zeigt Status („Testphase · 12 Tage“, „Vollversion“, „Kostenlos“); Paywall-Dialog bei `log` mit `code==='LIZENZ_NOETIG'`
   (Registry): Titel, welche Funktion, was in der Vollversion steckt, Buttons „Kaufen“ → `lizenzKaufen`, „Später“. Einstellungen-Block „Lizenz“ mit Status,
   Kaufen-Button, und — nur wenn `lizenz.debug` — fig-segmented-control PAID/TRIAL/UNPAID → `lizenzDebug` (Hinweis „Entwicklermodus, nur lokal“).
   `bei('lizenz', …)`, beim Start `lizenzStatus` senden.

## 30. UI-2 — Bericht, Protokoll, Vorschau, Export-Auswahl

Dateien: `markup/20-icon.html`, `30-bericht.html`, `logik/50-lauf.js`, `60-protokoll.js`, `70-vorschau.js`, `90-bericht.js`, `92-export.js`,
NEU `woerter/30-bericht.mjs` (darf Basis-Schlüssel für Bericht/Protokoll/Vorschau überschreiben), `style/30-bericht.css`.

1. **Bericht**: Spaltenköpfe mit `fig-tooltip` und einer Legende-Zeile unter den Kacheln (Rasterfehler / weiche Pixel / Maß stimmt, je ein Satz).
   Werte umbenennen nach 27. Kacheln sind Filter (fig-button variant ghost mit aktivem Zustand): Alle / ohne Set / Vorlage geändert / Maß-Fehler / schlechteste 10 %;
   aktive Kachel hebt sich ab; Zähler in der Tabellen-Überschrift „12 von 76“. Zeilen mit Checkbox (fig-checkbox) für die Auswahl, Kopfzeile „alle sichtbaren“;
   Export-Umfang: Alle / Ausgewählte (n) / Aktuelles Icon → `exportieren { umfang:'namen', namen }` bzw. `'auswahl'`/`'alle'`. „Ausgewählte“ deaktiviert bei 0.
2. **Protokoll**: Einträge gruppiert nach Icon (`name` aus der Nachricht; ohne Namen → Gruppe „Allgemein“), Gruppe zeigt Zähler ✕/△/i, aufklappbar
   (fig-group collapsible), Filter-Chips Fehler/Warnungen/Hinweise/OK, Suchfeld, „Kopieren“ (Text in Zwischenablage) und „Leeren“. Schrift: Inter statt Mono,
   Icon-Name fett, Größe als Chip „14 px“, Hinweiszeile sekundär, „zeigen“-Link rechts. Neue Einträge scrollen nur mit, wenn der Nutzer unten ist.
3. **Vorschau** (Vorbilder: Wipe-Regler wie in Bildbearbeitungs-Vergleichen, Figmas Vergleichsdialog „Side by side | Overlay“ mit Fit-Zoom):
   Vergleichsmodus als fig-segmented-control „Überlagern | Wischen | Nebeneinander | Blinken“ (Merker `vergleichsmodus`);
   Wischen = senkrechter Regler mit Griff über der Zelle, links aktuell / rechts neu, Labels an den Rändern; Blinken = 600-ms-Wechsel, Leertaste hält;
   Nebeneinander = zwei Zellen je Größe mit Labels. Zoom: Buttons −/+, „Fit“ (alle Größen passen nebeneinander in die Bühne), Ctrl+Wheel, Tastatur +/−/0.
   Beschriftung je Zelle zweizeilig: „14 px“ fett, darunter EINE kompakte Zeile „Keyline 12/12 · 1,5 px · Raster 0,5“ mit Ellipsis und Tooltip mit allen Werten;
   Status-Punkt grün/orange (Maß stimmt / abweichend). Pixelansicht und Differenz behalten, unter den Vektorzellen als aufklappbare Gruppen (fig-group).
   Zellen-Hintergrund: Raster nur bei Zoom ≥ 4 zeichnen. Hover über Zelle zeigt Pixelkoordinate.
4. **Fortschritt**: Text „Baue 3/76 · arrow-left“, Abbrechen daneben, Restzeit-Schätzung ab 5 Icons.

## 31. Protokoll-Ergänzungen Runde 4

| UI → Main | Main → UI |
|---|---|
| `farbenWerte {keys}` | `farbenWerteErgebnis {werte}` |
| `merkerSetzen {schluessel, wert}`, `merkerLaden {schluessel}` | `merker {schluessel, wert}` |
| `lizenzStatus`, `lizenzKaufen {grund}`, `lizenzDebug {status}` | `lizenz {status, resttage, debug, modell, kostenpflichtig}` |
| `exportieren {umfang, namen?}` (erweitert) | `log {…, name?, N?, schwere?}` (erweitert) |
| `konfigSpeichern {konfig, quelle?}` (erweitert) | `konfig {…, lizenz}` (erweitert) |

Neue Fehlercodes: `LIZENZ_NOETIG`, Audit-Codes aus 28.1.

## 32. Paketzuschnitt Runde 4

| Paket | Dateien |
|---|---|
| Kern | `src/main/60-build.js`, `66-bericht.js`, `67-export.js`, `68-beispiel.js`, `70-main.js`, `40-adapter.js`, `50-farbe.js`, `06-i18n-zusatz.js`, `10-errors.js` (Codes), NEU `75-lizenz.js`, `manifest.json` |
| UI-1 | siehe 29 |
| UI-2 | siehe 30 |
| Fable | Integration, `test/run.mjs` anpassen, Doku-Nachzug |

---

# Runde 5 — Vorschau als Herzstück, Umfang-Umschalter, Rückgängig, Onboarding-Polish (2026-09-17)

Vorbilder (Mobbin): Customer.io Asset Optimizer (View type Before | After | Side-by-side, Kennzahlenliste mit
hervorgehobener Verbesserung „−44 %“), Magnific/Leonardo/ElevenLabs (eine große Fläche, Wisch-Trenner als Standard,
kleine Pills „Before/After“ in den Ecken, Zoom unten rechts), Figma „Compare changes“ (Side by side | Overlay, Fit).

## 33. Vorschau — Zielbild

Eine Vorschau beantwortet drei Fragen in dieser Reihenfolge: **Was hat sich geändert? Ist es besser geworden? Stimmt das Maß?**

Aufbau von oben nach unten (Icon-Tab, unterhalb der Aktionen):

1. **Kopfzeile der Vorschau**: links Titel „Vorschau · {name}“ (12 px, fett); rechts eine Zoom-Gruppe: `−` `+` `Fit` und Prozent/Faktor
   (`fig-button ghost`, kompakt), daneben ein kleiner Umschalter für den Hintergrund hell/dunkel (Icon-Button, kein Text).
2. **Urteil-Zeile** (eine Karte, `fig-card`, volle Breite): ein Satz in Klartext plus bis zu drei Kennzahlen als Pills:
   „Schärfer: Rasterfehler 0,021 → 0,012 (−43 %)“ · „Maß stimmt in 3 von 3 Größen“ · „7 Kanten gerastet“.
   Grün wenn besser, neutral wenn gleich, orange wenn schlechter oder Maß-Abweichung. Ohne bestehendes Set: „Neu — noch kein Vergleich“.
3. **Größenkarten** nebeneinander (horizontal scrollbar, gleiche Höhe), je Größe EINE Karte:
   - Kopf: „14 px“ (11 px, semibold) + Statuspunkt + kleines Delta „−43 %“ rechts.
   - Bühne: **Vorher | Nachher** als Standard, zwei gleich große Kacheln nebeneinander mit Pills „Vorher“ / „Nachher“ (9,5 px, uppercase,
     sekundär) oben links in der Kachel. Darstellung = echte Rasterung (PNG 1×, pixelig hochskaliert), NICHT der Vektor-Onionskin.
     Kein Magenta/Türkis. Änderungen werden auf Wunsch (Schalter „Änderungen markieren“, Standard an) in der Nachher-Kachel durch
     einen 1-px-Rahmen in der Akzentfarbe um jeden veränderten Pixel-Block gezeigt (aus der Differenz berechnet, zusammenhängende Bereiche
     als Rechtecke zusammengefasst).
   - Zweiter Modus **Wischen**: eine Kachel, senkrechter Trenner mit Griff, links Vorher / rechts Nachher, Pills an den Rändern.
     Moduswahl als `fig-segmented-control` „Nebeneinander | Wischen“ in der Kopfzeile der Vorschau — nur diese zwei. Überlagern und Blinken entfallen.
   - Fuß: drei Zeilen Kennzahlen, tabellarisch, Label links sekundär, Wert rechts tabular: „Rasterfehler 0,021 → 0,012“, „Weiche Pixel 79 % → 61 %“,
     „Keyline 12,00 / 12 ✓“. Tooltip auf jedem Label mit dem Erklärsatz aus Abschnitt 27.
4. **Details** (eine `fig-group collapsible`, Standard zu): Vektor-Ansicht (bisheriger Onionskin, aber in Grau/Schwarz statt Farbe: Vorher grau 40 %,
   Nachher schwarz), Pixelraster 1×/2×, Differenz-Heatmap. Alles, was heute an der Oberfläche ist, wandert hierhin.

Visuelle Hierarchie: genau drei Textgrößen (12 fett / 11 / 9,5 sekundär), Karten mit 1-px-Rahmen und 8-px-Radius, Innenabstand 12, Abstände zwischen
Karten 12, Kachel-Hintergrund weiß bzw. #1e1e1e mit 1-px-Rahmen, Pixelraster nur ab Zoom ≥ 6 und nur als sehr dezente Linien (8 % Deckung).
Kein Text in den Kacheln außer den Pills. Hover über eine Kachel zeigt Koordinate rechts unten in der Kachel als kleine Pill.

Zoom: Fit ist Standard (alle Größenkarten passen nebeneinander, mindestens Zoom 3), −/+ in Stufen 3, 4, 6, 8, 12, 16, Ctrl+Wheel, Tasten +/−/0 (0 = Fit).
Zoom gilt für alle Karten gleich. Wenn nur eine Größe konfiguriert ist, nimmt die Karte die volle Breite.

## 34. Umfang-Umschalter statt zwei Gruppen

Im Icon-Tab ersetzt EIN `fig-segmented-control` „Dieses Icon | Ganze Library“ die bisherigen Gruppen „Icon“ und „Library“:
- **Dieses Icon**: Auswahlzeile, Buttons „Vorschau“ (secondary) und „Icon bauen“ (primary), Schnellschalter.
- **Ganze Library**: Zusammenfassung „76 Icons · 0 ohne Set · 2 Vorlage geändert“ (aus `uebersicht`), Buttons „Prüfen“ (= audit, secondary) und
  „Alle bauen“ (primary, mit Trockenlauf), Schnellschalter. Die Vorschau-Fläche zeigt hier die Startseiten-Liste (Abschnitt 29) — sie ist damit die
  Library-Ansicht, und der Leerzustand bei fehlender Auswahl im Modus „Dieses Icon“ zeigt nur einen kurzen Hinweis + Beispiel-Button.
Der gewählte Umfang wird als Merker `umfang` gespeichert. Damit entfällt die Startseite als eigener Zustand: Startseite = Modus „Ganze Library“.

## 35. Rückgängig

- Main: Nachricht UI→Main `rueckgaengig` → `figma.triggerUndo()`; Antwort `undoStand { schritte }` und `fertig`. `fazit` trägt nach Bau
  `undoMoeglich: true`, `undoName?` (Einzelbau) bzw. `undoSchritte` (Batch). (Bereits umgesetzt in 70-main.)
- UI: Nach einem Bau erscheint neben dem Fazit ein Button „Rückgängig“ (`fig-button secondary`, Icon ↶). Einzelbau: ein Klick nimmt das Icon zurück,
  Button verschwindet. Batch: Button zeigt „Rückgängig (12)“, jeder Klick nimmt ein Icon zurück und zählt herunter; Tooltip erklärt „ein Schritt = ein Icon“.
  `bei('undoStand', …)` aktualisiert den Zähler; bei 0 ausblenden. Zusätzlich im Protokoll-Kopf ein ↶-Icon-Button mit derselben Funktion.

## 36. Onboarding-Polish

- Höchstens 12 Wörter je Headline, höchstens 2 Sätze Text je Slide. Slides: (1) „Aus einer Vorlage alle Größen“ mit Skizze 72 → 24/18/14,
  (2) „Dein File, dein Modus“ (erkannter Modus + Profilwahl als Karten), (3) „Auswählen, ansehen, bauen“ (drei Schritte als nummerierte Mini-Karten,
  Rückgängig erwähnen), (4) „Vollversion“: Testphase, was sie enthält, Hinweis „Kauf läuft über dein Figma-Konto — kein Lizenzschlüssel nötig“.
- Bildbühne feste Höhe (200 px), Illustrationen in einer Akzentfarbe + Grau, gleiche Strichstärke wie unsere Icons (2 px), Gitter dezent.
- Dots klickbar, aktiver Dot länglich (16 px), Fortschrittstext „2 von 4“. Buttons: „Weiter“ primär rechts, „Zurück“ ghost links, „Überspringen“ ghost oben rechts.
  Letzter Slide: „Los geht’s“. Übergang 180 ms. Pfeiltasten und Esc wie bisher.
- Der Paywall-Screen teilt Bühne und Typografie. Kein Rabattcode.

## 37. Lizenz — Ablauf für den Nutzer (Text für Einstellungen und Slide 4)

Mit Figma Payments gibt es keinen Lizenzschlüssel. Der Kauf läuft im Figma-Checkout, der Status hängt am Figma-Konto und gilt auf allen Geräten.
Einstellungen → Lizenz zeigt: Status (Testphase mit Resttagen / Vollversion / abgelaufen), Button „Vollversion kaufen“ (→ `lizenzKaufen`),
Button „Status aktualisieren“ (→ `lizenzStatus`, für den Fall, dass ein Kauf auf einem anderen Gerät noch nicht angezeigt wird), und den Satz
„Gekauft wird über dein Figma-Konto. Ein Lizenzschlüssel ist nicht nötig.“ Der Entwickler-Umschalter bleibt nur im Debug-Build sichtbar.

## 38. Protokoll-Ergänzungen Runde 5

| UI → Main | Main → UI |
|---|---|
| `rueckgaengig` | `undoStand {schritte}`; `fazit {…, undoMoeglich?, undoName?, undoSchritte?}` |
| `merkerSetzen {schluessel:'umfang'}` | — |

## 39. Runde 6 — Vorschau final, flache Hierarchie, Inhalte pflegbar (2026-09-17)

Vorbilder (Mobbin): Figma/Framer/Jitter/Rive-Eigenschaftenpanels — flache Abschnitte mit 1-px-Trennern, Titel 11 px halbfett,
Label links / Wert rechts, Icon-Buttons 24 px, keine verschachtelten Kästen; Canvas mit schwebender Zoom-Pille unten rechts und
Undo/Redo-Pille unten links (Slite, Figma).

1. **Modi**: nur „Vorher/Nachher“ (bisher Wischen) und „Überlagern“. Nebeneinander entfällt.
2. **Vergleichsbasis**: `zellen[].ohne/pngOhne*/gueteOhne/mitSnap` liefert der Hauptthread bei aktivem Snapping. UI-Umschalter „Vergleich mit:
   ohne Snapping | Library-Stand“ (nur wenn `ohne` vorhanden; sonst nur Library). Standard: ohne Snapping. Die Vorher-Pille trägt die Basis
   („Vorher · ohne Snapping“). Urteil und Kennzahlen rechnen gegen die gewählte Basis (`gueteOhne` bzw. `gueteAlt`).
3. **Vektor scharf**: SVG je Zoom-Stufe 2^k (bis 64) × dpr lazy rastern und 1:1 zeichnen; Cache je Zelle/Stufe/Quelle.
4. **Punkte & Kanten** (ersetzt „Änderungen markieren“): SVG-Pfade von Vorher und Nachher parsen (absolute M/L/H/V/C/S/Q/Z), Ankerpunkte
   extrahieren, nächste Nachbarn ≤ 1,5 px matchen. Darstellung: Vorher-Kontur dünn gestrichelt orange, Nachher-Kontur 1 px dunkel/hell;
   verschobene Punkte: hohler oranger Ring (alt) → gefüllter blauer Punkt (neu) mit Verbindungslinie; Hover: „Punkt um 0,25 px nach rechts
   gerastet“. Punkte mit Verschiebung < 0,01 px nicht markieren. Farbflächen-Differenz (orange/blau) bleibt als Schalter „Flächen“ wählbar.
5. **Regler** „Vorher · Nachher“ immer sichtbar, wenn eine Vergleichsbasis existiert; in Überlagern beschriftet als „Gewichtung“.
6. **Begriffe mit ?**: Rasterfehler, Weiche Kanten (Anti-Aliasing) [statt „Weiche Pixel“], Keyline (Icon-Körper) je mit kleinem „?“
   und fig-tooltip: Rasterfehler = „Wie stark die gerenderten Pixel vom idealen, scharfen Bild abweichen. 0 = perfekt; unter 0,02 sehr gut.“
   Weiche Kanten = „Anteil halbtransparenter Randpixel. Weniger = schärfer; runde Formen haben naturgemäß mehr.“
7. **Flache Hierarchie**: keine verschachtelten Kästen im Icon-Tab. Abschnitte: (a) Umfang-Segment; (b) Titelzeile „mail · Wide“ mit Klassen-Chip
   und Status-Chip; (c) Aktionsreihe: primär „Icon bauen“ / sekundär „Vorschau“ / Icon-Button ↶ Rückgängig (immer sichtbar, disabled ohne
   Stapel) / „⋯“; (d) Schnellschalter-Zeile 9,5 px; (e) Bühne mit SCHWEBENDEN Overlays: oben links Modus- und Darstellungs-Segment (klein),
   oben rechts Icon-Buttons (Fit, Grund, Retina, ⋯), unten links Undo-Pille, unten rechts Zoom-Pille; (f) darunter Urteil-Zeile, Kennzahlen,
   Legende, Hinting — als flache Zeilen mit Trennern. Abstände 8/12, Titel 11 px halbfett, Werte tabular.
8. **Onboarding**: Slide 1 als Welcome-Hero (volle Bildbühne 240 px mit Gitter + großer Marke, Headline „Willkommen bei Icon Pipeline“,
   Subline, primär „Rundgang starten“, sekundär „Direkt loslegen“). Slides 2–4 wie bisher.
9. **Inhalte pflegbar**: `src/ui/inhalte/onboarding.mjs` (`export default [{ id, titel:{de,en}, text:{de,en}, svg }]`),
   `src/ui/inhalte/lizenz.mjs` (`export default { svg, titel:{de,en}, text:{de,en} }`), `src/ui/inhalte/welcome.mjs`. gen-ui.mjs lädt sie und
   stellt sie der Logik als `__INHALTE__` (JSON) bereit. `docs/INHALTE.md` erklärt, wie Texte und SVGs geändert werden (nur diese Dateien, dann `node build.mjs`).
10. **Lizenz-Grafik** in der Einstellungs-Karte aus `inhalte/lizenz.mjs` (Schloss/Schlüssel-Skizze in Akzent + Grau, 2 px).
