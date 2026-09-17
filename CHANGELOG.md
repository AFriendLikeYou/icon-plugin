# Changelog

All notable changes to the Icon Pipeline plugin. / Änderungen am Plugin.

---

## Round 3 — “paid quality” / Runde 3 — „Bezahl-Qualität“ — 2026-09-17

Adds dry runs, a quality report, a developer export and three more profiles on
top of v2. New modules: `06-i18n-zusatz.js`, `65-plan.js`, `66-bericht.js`,
`67-export.js`, `68-beispiel.js`, plus `test/` and `docs/`.

**Added**
- **Dry run** (`planen` / `plan`): before building, a dialog lists per icon what
  would change — new vs. changed set, missing and foreign variants, number of
  instances, lock state — without a single mutation. Shown before *Rebuild all*
  and, compactly, before *Build icon*; the single-icon dialog can be switched off.
- **Cancel** (`abbrechen`): the long loops (`alle`, `audit`, `bericht`,
  `exportieren`) check a flag between two icons, finish cleanly and report
  “cancelled after i/n” with partial results. Progress rows for all four.
- **Preview with unsaved settings** (`vorschauMit`): validates a configuration,
  applies it temporarily, renders the preview, restores `CFG` in `finally`, and
  marks the result *unsaved*.
- **Report tab** (`bericht`): fidelity (RMS against an 8× reference), AA share,
  keyline hit, grid rate and structure per icon and size, with key figures and a
  trend against the previous build. Sortable, CSV download, click a name to focus
  the node. The set's plugin data now keeps `guete: { [N]: { fehler, aa } }` and a
  `verlauf` of up to twelve builds (`fehler` is still written for compatibility).
- **SVG dev export** (`exportieren` / `exportDaten`): one file per variant
  (`name/name-N.svg`), colours replaced by `currentColor`, root `width`/`height`
  removed, `viewBox` kept, plus a `manifest.json`. The UI zips it without a
  library, optionally adding a `sprite.svg`.
- **Example icon** (`beispielAnlegen`): in free mode with nothing selected, the
  empty state explains master / keyline / grid and offers to create a `demo-icon`
  and build its set — in one undo step.
- **Profiles** `material`, `lucide` and `apple` next to `zds` and `generic`;
  `konfigProfilInfo()` supplies a translated title and description per profile.
- **Write permissions** `CFG.schreiben`: `frameUmwandeln` (off by default) and
  `strokeHeimAnlegen` (on). Denied cases now say so — `FRAME_NICHT_ERLAUBT`,
  `STROKEHEIM_AUS` — instead of mutating silently.
- **Configuration export / import** as JSON from the settings tab.
- **Tests and docs**: `node test/run.mjs` (no npm) covers configuration
  validation, i18n completeness, the snapping regression against the v1 formulas,
  name and colour helpers, the UI ↔ main message contract and the concatenation
  rules. `docs/SNAPPING.md` and `docs/KONFIG.md` write down the rules and the
  schema; `README.md` is English first. `node build.mjs` runs the tests and exits
  non-zero when one fails.

**Changed**
- `konfigValidieren` returns **structured** errors `[{ pfad, text }]`; the
  settings tab marks the exact field via `data-pfad`. The before/after comparison
  is gone.
- Locked sources, sets or variants abort with `GESPERRT` instead of throwing a
  Figma error.
- After `run`: an explicit `commitUndo()` and a log line saying one Cmd+Z undoes
  the icon; after `alle`, a closing line for the batch.
- New error codes: `GESPERRT`, `FRAME_NICHT_ERLAUBT`, `STROKEHEIM_AUS`,
  `ABGEBROCHEN`, `EXPORT_FEHLT`.

---

## v2 — generalisation / Generalisierung — 2026-09-17

Turns the ZDS-bound script into a plugin that works in any file. `code.js` is
generated from `src/main/*.js` from here on.

**Added**
- **Configuration** instead of hard-wired constants: target sizes, stroke weights,
  keylines, grid and coarse grid, radius rules, master size, variant property and
  colour. Stored in the file under `icon-pipeline/konfig`, edited in a new
  **Settings** tab, with profiles `zds` and `generic`.
- **Adapter layer** (`40-adapter.js`): `adapterZds` keeps the board behaviour
  (cards, grid class, library set, status chip, keywords, preview cells);
  `adapterFrei` resolves components, instances, variant sets and frames in any
  file, guesses the shape class from the aspect ratio and lets it be overridden.
- **Bilingual** de/en (`05-i18n.js`), including set descriptions; language switch
  without a restart.
- **Errors with codes** (`10-errors.js`): `PipelineFehler` carries a text, a hint
  and a node id, so the log offers a *show* link. What used to fail silently —
  token, fit, `union`, guessed class — is now reported.
- **Colour freedom** (`50-farbe.js`): from the source, a hex value, or a variable
  (local or team library), with a picker grouped by collection.
- Preview extended: 8× PNG as the sharpest zoom step, difference heat map, dark
  background, captions with stroke / grid / radius. Audit and *Rebuild all* are
  always available.
- Missing variants are added to an existing set instead of aborting; variants
  whose `N` is not configured are reported (`SET_HAT_FREMDE_VARIANTE`) and left
  untouched.

**Changed**
- Snapping is parameterised: the fixed 0.5 grid and the `N === 24` special case
  became `rc = { raster, rasterGrob }`. Proven bit-identical to v1 —
  see the regression note in `30-snap.js` and `docs/SNAPPING.md`.
- Build is a Node script without npm: `node build.mjs` concatenates
  `src/main/*.js` into `code.js` and calls `gen-ui.mjs` for `ui.html`.
- The set's plugin data key stays `'zds'` so existing sets keep working.

---

## v1 — ZDS-bound / ZDS-gebunden — 2026-09-09

The original single-file script (`code.v1.js`, kept as a reference).

- Built the sizes 14 / 18 / 24 from the 72 px source of the ZDS icon board, with
  hard-wired stroke weights, keylines per shape class and radius scaling.
- Pixel snapping v2 (“stem hinting”): straightening, rigid stem pairs, centre
  protection, mirror coupling, joint protection, rhythm protection, fill stem
  pairs, extremum hinting — with the AA oracle deciding per size whether the
  snapped or the untouched candidate ships.
- `union` → `flatten`, colour bound to the library variable `Text/70`, content
  swapped into the existing variant set so instances stayed connected.
- Audit over all cards, onion-skin and pixel preview, optional stroke variant.

## Runde 4 — 2026-09-17

- Begriffe vereinheitlicht (Vorlage, Strichstärke, Kanten rasten auf, Ganze Pixel bevorzugen, Eckenradien, Rasterfehler, weiche Pixel, Maß stimmt); Hilfetexte und Tooltips an jedem Feld
- Startseite im Icon-Tab: Liste aller Icons im File mit Status-Chips, Suche, Checkliste „Erste Schritte“
- Onboarding als Slideshow (4 Schritte, Illustrationen, Dots, Pfeiltasten), erneut über „?“ im Kopf
- Lizenz (Einmalkauf): Testphase 14 Tage, kostenpflichtig sind Batch-Bau, Bericht, Export, Konfig-Import; Paywall-Screen; Entwicklermodus zum Umschalten des Status
- Bericht: Legende, Kacheln als Filter, Zeilenauswahl, Export „Ausgewählte“
- Protokoll: Gruppen je Icon, Filter, Suche, Kopieren, verständliche Texte; strukturierte Audit-Meldungen mit Codes
- Vorschau: Vergleichsmodi Überlagern / Wischen / Nebeneinander / Blinken, Fit-Zoom, kompakte Beschriftung, Statuspunkt
- Design-Token-Liste mit Farbfeldern, Library-Werte werden nachgeladen
- Beispiel-Icon auch im ZDS-Modus; UI in Module geteilt (src/ui), Handler-Registry

## Runde 5 — 2026-09-17

- Vorschau als Canvas-Viewport mit Kamera: Figma-Gesten (Rad = Pan, Ctrl/Cmd+Rad und Pinch = Zoom um den Cursor, Leertaste+Drag, Shift+0/1/2, Doppelklick), Zoompille mit Menü, ziehbare Bühnenhöhe
- Vorher | Nachher als echte Rasterung, Modi Nebeneinander und Wischen, Darstellung Pixel | Vektor, Retina-scharf
- Änderungs-Highlighting pixelgenau als Regionen mit Akzentrahmen und Hover-Erklärung; Überblend-Regler Vorher → Nachher
- Urteil-Zeile in Klartext („Schärfer: Rasterfehler 0,021 → 0,012“), Kennzahlen-Tabelle je Größe, Details (Vektor, Pixel, Differenz) zugeklappt
- Umfang-Umschalter „Dieses Icon | Ganze Library“ ersetzt zwei Gruppen; Library-Ansicht = Icon-Liste
- Rückgängig-Button nach jedem Bau (Batch zählt je Icon herunter), Hauptthread nutzt figma.triggerUndo
- Onboarding gekürzt, Illustrationen in Akzent + Grau, Slide 4 erklärt Kauf über das Figma-Konto (kein Lizenzschlüssel)
- Lizenz-Block: „Status aktualisieren“; Rasterfehler der bestehenden Variante wird mitgemessen (gueteAlt)

## Runde 5b — 2026-09-17

- Vorschau kompakt: Werkzeugleiste eine Zeile, Bühne wächst mit dem Panel, Urteil und Kennzahlen unter der Bühne, Protokoll zugeklappt
- Dritter Vergleichsmodus „Überlagern“: farbige Onionskin (unverändert grau, entfernt orange, hinzugekommen blau), Legende, Zeile „Veränderte Pixel“
- Zahlenformat zentral (3 Nachkommastellen, Prozent ganzzahlig, Gleichstand als „unverändert“)

## Runde 5c — 2026-09-17

- Vorschau: Vektor als Standard, Retina-Schalter in der Pixel-Darstellung, farbiger Differenz-Layer (entfernt orange, hinzugekommen blau) in allen Modi, Legende mit drei Farbfeldern
- Details-Gruppe entfernt (alles oben sichtbar); neue Gruppe „Hinting“ mit gerasteten Kanten, geschützten Knoten, Orakel-Entscheidung, Raster, Phase, Strichstärke, Radiusregel
- Hauptthread liefert je Vorschau-Zelle geschuetzt, grob und gueteAlt

## Runde 6 — 2026-09-17

- Vorschau: Modi nur „Vorher/Nachher“ (Wischen) und „Überlagern“; Vergleichsbasis „ohne Snapping | Library-Stand“; Vektor je Zoomstufe scharf gerastert; „Punkte & Kanten“ zeigt verschobene Ankerpunkte (SVG-Pfadparser) statt Regionen-Rahmen; Flächen-Differenz als Schalter; Regler immer sichtbar
- Live-Snapping: Schalter tauscht in der offenen Vorschau nur die Nachher-Quelle, Kamera bleibt; Pille „Snapping an/aus“
- Vorschau spurlos: Klon der Vorlage, ephemere Knoten mit Aufräumen bei Fehler, Schließen und Start
- Radiusregel „fester Wert“ rundet auch scharfe Ecken (Vektor-Ecken nach Grad, Linienenden bleiben)
- Flache Hierarchie im Icon-Tab (Figma-Muster): Titelzeile mit Klassen-Chip (Frei-Modus klickbar), Aktionsreihe mit ↶ immer sichtbar, schwebende Overlays auf der Bühne, Trenner statt Kästen
- Begriffe mit „?“-Erklärung; „Weiche Kanten (Anti-Aliasing)“
- Onboarding: Welcome-Hero als Slide 1; Inhalte pflegbar in src/ui/inhalte (welcome, onboarding, lizenz) — Anleitung docs/INHALTE.md; Lizenz-Karte mit Grafik
