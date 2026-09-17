# figui3-Konformität der Plugin-UI

Prüfstand: `src/ui/**` (Markup, Logik, Styles, Wörter) gegen die vendorte
figui3-Fassung `fig.js` / `fig.css` im Wurzelverzeichnis.

**Quellen der Wahrheit**

1. Die vendorten Dateien selbst — was `customElements.define()` registriert,
   welche `observedAttributes` eine Klasse führt, welche `new CustomEvent(...)`
   sie feuert, welche `--fig-*`- und `--figma-color-*`-Variablen `fig.css` kennt.
   Wo Doku und Datei sich widersprechen, gilt die Datei.
2. Das Repo <https://github.com/rogie/figui3> (README, Komponentenliste).

---

## 1 · Versionsstand

| | vendored | Repo (main) |
|---|---|---|
| Datei | `fig.js` 327 195 B, `fig.css` 167 355 B (Bundle/dist) | `fig.js` 623 907 B (ESM-Quelle), `fig.css` nur `@import base.css/components.css` |
| Versionsbanner | **keiner** — weder Kopfkommentar noch `version`-Feld | Version steckt nur in den Commit-Titeln (`v9.0.x: …`) |
| Stand | Dateidatum 2026-09-09; kein `fig-input-number[size=large]` (kam mit v9.0.7) ⇒ **v9.0.4 – v9.0.6** | **v9.0.14** (2026-09-16) |

Dazwischen liegen ausschließlich Patch-Releases derselben 9.0-Linie, keine
Bruchstelle:

    v9.0.7  large number input sizing
    v9.0.8  refine playground inputs and segmented controls
    v9.0.9  refine chooser and gradient controls
    v9.0.10 add select option focus events
    v9.0.11 fix chooser image dragging
    v9.0.12 honor fig-select position and menu anchors
    v9.0.13 fix select menu anchor positioning
    v9.0.14 restore AI context prompt tuck

**Empfehlung (nicht ausgeführt):** Update auf v9.0.14 ist ratsam, aber nicht
dringend. Von den zehn Releases betrifft uns nur v9.0.8 (`fig-segmented-control`,
davon haben wir acht Stück). `fig-chooser`, `fig-select`, `fig-input-gradient`
und der Easing-Editor kommen in dieser UI nicht vor. Weil es ein reiner
Patch-Sprung innerhalb 9.0 ist, sind keine API-Änderungen zu erwarten; nach dem
Tausch reicht ein Durchklicken von Vorschau, Bericht und Einstellungen.
Achtung: `main` führt die **Quelle** (ESM mit `import "./fig-layer.js"`), nicht
das Bundle — das Update muss aus dem dist-Build kommen, nicht aus `raw.github`.

---

## 2 · Funde und Korrekturen

Alle Fundstellen beziehen sich auf den Stand **vor** der Korrektur; die
Zeilennummern sind die der damaligen Datei.

### (a) Elementnamen, die figui3 nicht registriert

| Datei:Zeile | Fund | Regel aus figui3 | Korrektur |
|---|---|---|---|
| — | **Keiner.** Alle 24 verwendeten `fig-*`-Tags stehen in der Registrierungsliste von `fig.js` (53 × `F(...)` + 3 × `O0(...)`). | `fig-dialog`, `fig-popup` und `fig-toast` sind *customized built-ins* (`O0("fig-…", …, {extends:"dialog"})`) und dürfen nur als `<dialog is="fig-…">` geschrieben werden. | Wird bereits durchgehend so gemacht (4 × `fig-dialog`, 4 × `fig-popup`, 1 × `fig-toast`). Kein Eingriff. |

Nebenbefund: `fig-chit` ist in dieser Fassung eine leere Unterklasse von
`fig-swatch` (`class O_ extends F0 {}`) — also ein **Farb**-Chit, kein
Text-Chip. Für Text-Chips gibt es in figui3 kein Element (siehe Abschnitt 4).

### (b) Falsche Attribute / Attributwerte

| Datei:Zeile | Fund | Regel aus figui3 | Korrektur |
|---|---|---|---|
| `markup/20-icon.html:14` | `<dialog is="fig-popup" … position="bottom-start">` | `parsePosition()` liest `position` als **zwei durch Leerzeichen getrennte** Marken: `{top\|center\|bottom} {left\|center\|right}`. Bindestrich-Werte fallen durch und landen beim Default `"top center"` — das Menü öffnete oberhalb statt unterhalb des Chips. | `position="bottom left"` |
| `markup/20-icon.html:41` | `position="bottom-end"` (`#mehrIconMenu`) | dito | `position="bottom right"` |
| `markup/20-icon.html:98` | `position="bottom-end"` (`#mehrMenu`) | dito | `position="bottom right"` |
| `markup/20-icon.html:51,54,100,103`; `30-bericht.html:50`; `40-einstellungen.html:49,52,118`; `50-dialoge.html:7` | `<fig-switch><span>Text</span></fig-switch>` (9 ×) | `fig-checkbox` (Basis von `fig-switch` und `fig-radio`) sucht in `connectedCallback` `:scope > label`, setzt dort `for` auf die generierte Input-ID und stylt über `fig-checkbox label span`. Ein `<span>` wird **nicht** verknüpft: kein Klickziel, und auch kein `aria-label`, denn der Textknoten-Fallback greift nur bei direkten Textknoten. | `<label>` statt `<span>` |
| `logik/80-einstellungen.js:195` | `<fig-radio …><span>Standard</span></fig-radio>` | dito | `<label>` statt `<span>` |
| `markup/50-dialoge.html:26,43` | `<dialog is="fig-dialog" class="buehne-dlg">` ohne `fig-header[dialog-header]` | `fig-dialog._ensureHeader()` läuft bei jedem `connectedCallback` und **schiebt selbst einen Kopf ein**: `<fig-header dialog-header><h3>Dialog</h3><fig-tooltip><fig-button variant=ghost icon close-dialog>…`. Auf den beiden Vollbild-Bühnen (Onboarding, Paywall) saß dadurch eine fremde 40-px-Leiste mit dem Titel „Dialog“. | Leerer `<fig-header dialog-header hidden>` als erstes Kind (das ist der vorgesehene Ausstieg — geprüft wird nur die Existenz) plus `aria-labelledby="obTitel"` bzw. `"pwTitel"`, damit `_syncA11y()` einen echten Namen findet. |
| `markup/30-bericht.html:21` | `<fig-button class="fltaktiv">` + `classList.toggle('fltaktiv', …)` in `logik/90-bericht.js:161` | `fig-button` hat einen eigenen Auswahlzustand: `selected` steht in `observedAttributes`, und `fig.css` stylt `fig-button[selected]:not([selected=false])` mit `bg-selected` / `icon-brand`. | `selected`-Attribut statt Klasse; eigene `.fltaktiv`-Regel entfernt. |
| `logik/70-vorschau.js:1217` | `$('btnRetina').classList.toggle('an', retina)` | dito | `toggleAttribute('selected', …)`; `.iknopf.an`-Regel entfernt. |

Geprüft und **in Ordnung** (keine Korrektur nötig):
`fig-input-file accepts="…"` (figui3 liest tatsächlich `accepts` und reicht es
als `accept` an das interne `<input>` weiter), `fig-slider text="false"`,
`fig-input-color alpha="false"`, `fig-group collapsible open="false"`
(`get open()` wertet `"false"` korrekt als zu), `fig-tab selected="true"`,
`fig-segment disabled`, `fig-card label="…"`, `fig-checkbox label="…"` /
`indeterminate="true"` in `logik/90-bericht.js`, `fig-button variant="ghost |
secondary | destructive"` (alle drei stehen in `fig.css`), `fig-spinner
aria-label`, `fig-header dialog-header`.

### (c) Events und `e.detail`

| Datei:Zeile | Fund | Regel aus figui3 | Korrektur |
|---|---|---|---|
| `logik/50-lauf.js:191`, `logik/80-einstellungen.js:56,57,588` | `e.target.checked` beim `change` von `fig-switch` | `fig-checkbox` feuert `change` mit `detail: { checked, value }`. Der Host-Getter liefert zwar dasselbe, aber das Protokoll der Komponente ist `detail`. `logik/90-bericht.js` machte es bereits richtig. | Neuer Helfer `gehakt(e, id)` in `logik/10-grundlagen.js`: `e.detail.checked`, Host-Getter nur als Rückfall. |
| `logik/80-einstellungen.js:289` | `if (!e.target.checked) return` beim `fig-radio` | dito | `e.detail ? e.detail.checked : e.target.checked` |
| — | `fig-tabs`, `fig-segmented-control`, `fig-dropdown`, `fig-input-text`, `fig-input-number`, `fig-slider`: `detail` ist der **Wert selbst** (kein Objekt). Der Code liest überall `(e && e.detail) || el.value` bzw. `e.detail != null ? … : el.value`. | korrekt | keine |
| — | `fig-group` feuert `openchange` mit `detail: { open }` — `logik/60-protokoll.js:135` und `logik/80-einstellungen.js:562` lesen das richtig. | korrekt | keine |
| — | `fig-input-color` feuert `change` mit `detail: { value, hex, rgba, … }` — `logik/80-einstellungen.js:583` liest `d.hex \|\| d.value`. | korrekt | keine |
| — | Auf Events, die die Komponente **nicht** feuert, hört niemand. `fig-tooltip`, `fig-button`, `fig-popup`, `fig-dialog` und `fig-header` feuern keine eigenen CustomEvents; benutzt werden nur native `click` / `close`. | korrekt | keine |

### (d) Eigene Nachbauten, für die figui3 ein Element hat

| Datei:Zeile | Fund | Regel aus figui3 | Korrektur |
|---|---|---|---|
| `markup/20-icon.html:116` | `<div class="zoommenu" id="zoomMenu" hidden>` — absolut positioniertes Popup mit eigenem Rahmen, Radius, Grund und Schatten, über `hidden` geschaltet | Popups gehören auf `<dialog is="fig-popup" anchor="…">`; alle anderen drei Menüs der UI machen es schon so. | `<dialog is="fig-popup" id="zoomMenu" anchor="#zoomWertAnzeige" position="top right">`; in `logik/70-vorschau.js` neue `zoomMenuSetzen()` über `.open` statt `.hidden`, Außenklick wie bei `#mehrMenu`. Nebeneffekt: das Menü liegt jetzt `position: fixed` und wird nicht mehr vom `overflow: hidden` der Bühne abgeschnitten. |
| `markup/50-dialoge.html:9,19` | `<div class="dlg-aktionen">` als Dialogfuß | figui3 kennt die Dialog-Anatomie `fig-header` / `fig-content` / `fig-footer`; `fig-footer` bringt `justify-content: flex-end`, `gap: var(--spacer-2)`, Polsterung und die Trennlinie mit. | `<fig-footer>`; eigene `.dlg-aktionen`-Regel entfernt. |
| `markup/20-icon.html:38,40,97,113,115,163`; `50-dialoge.html:45`; `logik/80-einstellungen.js:197` | Unicode-Glyphen als Icons: `↶`, `⋯`, `−`, `+`, `✕` | `fig-icon name="…"` maskiert die 32 Icons aus `fig.css` (`--icon-24-*`); `fig-button[icon]` ist die Icon-Variante des Knopfes. | `↶ → reset`, `⋯ → more`, `− → minus`, `+ → add`, `✕ → close`; die Knöpfe bekommen `icon`. `#btnUndoBuehne` (Icon **und** Text) nutzt jetzt den `prepend`-Slot von `fig-button`. |
| `style/30-bericht.css:40-45` | `.iknopf` setzt eigene Maße für Icon-Knöpfe | `fig-button[icon]` setzt `width` **und** `flex-basis` auf `var(--spacer-4)` (24 px) mit höherer Spezifität als `.iknopf`. | Gegenregeln mit passender Spezifität ergänzt (`fig-button.iknopf[icon]` 24 px, `.aktionsreihe …` 28 px, `.zoompille > fig-button[icon]` 22 px, `.logaktionen fig-button[icon]` 18 px), damit die gewählten Trefferflächen erhalten bleiben. |
| `logik/60-protokoll.js:117` | `fig-header` der Log-Gruppen, Trennlinie per CSS `box-shadow: none` abgeschaltet | `fig-header` hat dafür das Attribut `borderless`. | `kopf.setAttribute('borderless', '')`; CSS-Regel entfernt. |

Geprüft, aber bewusst **nicht** umgestellt — siehe Abschnitt 4:
Text-Chips, Pillen, Label-Feld-Zeilen (`.feld`/`.gfeld` statt `fig-field`),
Gruppenköpfe (`.gruppenkopf` statt `fig-separator[label]`), Karten
(`.ikarte`/`.profilkarte`/`.eskarte`/`.groessekarte` statt `fig-card`),
Fortschrittsbalken, Punkt-Navigation, der Keyline-Aufklapper
(`.keyauf`/`.keyblock` statt `fig-group collapsible`).

### (e) CSS, das figui3-Interna überschreibt

| Datei:Zeile | Fund | Regel aus figui3 | Korrektur |
|---|---|---|---|
| `style/10-basis.css:84` | `dialog[is="fig-dialog"] { max-width: 330px; border: none; border-radius: 10px; padding: 0 }` | `fig.css` setzt für Dialoge bereits `border: 0`, `padding: 0` und `border-radius: var(--dialog-radius)`; die Breite steuert `--dialog-max-width`. | `dialog[is="fig-dialog"] { --dialog-max-width: 330px }`, `.breit { --dialog-max-width: 400px }` |
| `style/10-basis.css:92` | `fig-group.logblock > fig-header { padding: 2px 10px; min-height: 22px; display: flex; align-items: center; gap: 8px }` | `fig-header` ist selbst schon `display:flex; align-items:center; gap: var(--spacer-2)` und bezieht seine Höhe aus `--fig-header-height`. `min-height` lief ins Leere, der Rest war Doppelung. | `{ --fig-header-height: 22px; padding: 2px 10px }` |
| `style/30-bericht.css:163` | `fig-group.hintgruppe > fig-header { padding; min-height }` | dito | `--fig-header-height: 22px` |
| `style/30-bericht.css:181` | `fig-group.loggruppe > fig-header { padding; box-shadow: none; display; align-items; gap; min-height }` | dito, Trennlinie über `borderless` | `{ --fig-header-height: 28px; padding: 6px 10px }` + `borderless`-Attribut in der Logik |
| `style/30-bericht.css:27,48,89` | `dialog.klassemenu`, `dialog.mehrmenu`, `.zoommenu` bauen Rahmen, Radius, Grund und Schatten selbst und erzwingen `display: flex` samt `:not([open]) { display: none }` | `dialog[is=fig-popup]` liefert `--fig-popup-radius`, `--fig-popup-bg-color`, `--fig-popup-shadow` (= `--figma-elevation-400-menu-panel`) und schaltet über `&[open]:not([open=false])` selbst sichtbar. Der `display:flex`-Dauerzustand zwang erst zur Gegenregel. | Nur noch Innenleben: `dialog.klassemenu { padding; max-width }` und `dialog.klassemenu[open]:not([open=false]) { display: flex; … }`. Rahmen/Schatten/Radius kommen aus figui3. |
| `style/10-basis.css:12` | `::-webkit-scrollbar-thumb { background: var(--figma-color-border) }` | figui3 nimmt dafür `--figma-color-bg-tertiary`. | Token getauscht (die Breite von 8 px bleibt bewusst, siehe Abschnitt 4). |
| `style/10-basis.css:112,114` | `font-family: Inter, sans-serif`, `font: … Inter, "Inter var", system-ui` | figui3 setzt `--font-family` (Inter mit vollständiger System-Kette). | `var(--font-family)` |

### (f) Theming: harte Farben statt `--figma-color-*`

Alle Statusfarben lagen als Hexwerte im CSS und blieben damit im dunklen
Figma-Theme unverändert. Ersetzt (der alte Wert bleibt als `var()`-Rückfall
stehen):

| alt | neu |
|---|---|
| `#12a76a` (Fläche) | `var(--figma-color-bg-success, #12a76a)` |
| `#12a76a` (Symbol/Punkt) | `var(--figma-color-icon-success, #12a76a)` |
| `#0e8a57` | `var(--figma-color-text-success, #0e8a57)` |
| `rgba(18,167,106,.1 … .14)` | `var(--figma-color-bg-success-tertiary, …)` |
| `#c2402a` (Fläche) | `var(--figma-color-bg-danger, #c2402a)` |
| `#c2402a` (Text) | `var(--figma-color-text-danger, #c2402a)` |
| `#c2402a` (Symbol) | `var(--figma-color-icon-danger, #c2402a)` |
| `#c2402a` (Umriss) | `var(--figma-color-border-danger-strong, #c2402a)` |
| `rgba(194,64,42,.1 … .12)` | `var(--figma-color-bg-danger-tertiary, …)` |
| `#c98a12` (Symbol) | `var(--figma-color-icon-warning, #c98a12)` |
| `#c98a12` (Umriss) | `var(--figma-color-border-warning-strong, #c98a12)` |
| `#8a6208` | `var(--figma-color-text-warning, #8a6208)` |
| `rgba(201,138,18,.12 … .16)` | `var(--figma-color-bg-warning-tertiary, …)` |
| `#fff` auf Grün/Rot | `var(--figma-color-text-onsuccess/-ondanger, #fff)` |
| `#fff` hinter der Keyline-Skizze | `var(--figma-color-bg, #fff)` |

Betroffene Stellen: `.chip.gruen/.rot/.geraten`, `.chip.lizchip.voll/.test/.aus`,
`.fazit.gruen/.rot`, `.log .ok/.warn/.err::before`, `.logzeile.*::before`,
`.lgchip.err/.warn`, `.upill.gut/.warn`, `.urteilzeile.gut/.warn`,
`table.kztab th.gut/.warn`, `.trend.gut/.schlecht`, `.btabelle .keyja/.keynein`,
`.fehlerbox`, `.warnliste`, `.ungueltig`, `.warnung`, `li.warnung`,
`fig-input-number.unplausibel`, `.eszeile.fertig .haken`, `.bh-hinweis .punkt`,
`.keyviz svg`.

---

## 3 · Verwendete figui3-Elemente und die Verträge, auf die wir uns verlassen

| Element | Attribute, die wir setzen | Events, auf die wir hören | Sonstiges |
|---|---|---|---|
| `fig-button` (62 ×) | `variant` (`ghost`/`secondary`/`destructive`), `disabled`, `selected`, `icon`, `title`, `hidden` | `click` (nativ) | Slots `prepend` / Default; `variant` und `icon` wirken rein über `fig.css`, `disabled`/`selected` über `observedAttributes` |
| `fig-icon` (9 ×) | `name` (`reset`, `more`, `minus`, `add`, `close`), `size="small"` | — | Namen müssen in der `--icon-24-*`-Liste von `fig.css` stehen (32 Stück) |
| `fig-tooltip` (27 ×) | `text`, `delay` | — | umschließt das Zielelement; `text` wird von `20-sprache.js` über `data-t-text` gesetzt |
| `fig-tabs` / `fig-tab` | `value` bzw. `value` + `selected` | `change` → `detail` = Wert | `tabWechseln()` spiegelt `value` von Hand auf die Kinder |
| `fig-segmented-control` / `fig-segment` (8 / 22 ×) | `value`, `aria-label`; am Segment `value`, `selected`, `disabled` | `change` → `detail` = Wert | Programmatisches Setzen läuft über `setAttribute('value', …)` |
| `fig-switch` / `fig-checkbox` / `fig-radio` | `checked`, `indeterminate`, `label`, `name`, `value`, `data-pfad` | `change` → `detail = { checked, value }` | Beschriftung als `<label>`-Kind **oder** `label`-Attribut, nie als `<span>` |
| `fig-dropdown` (5 ×) | `value`, `data-pfad`; `<option>`-Kinder | `change` → `detail` = Wert | Nach Sprachwechsel ruft `texteSetzen()` `slotChange()` auf, damit das interne `<select>` neu einliest |
| `fig-input-text` (4 ×) | `value`, `type="search"`, `placeholder` | `input` / `change` → `detail` = Wert | |
| `fig-input-number` (8 ×) | `value`, `min`, `step`, `data-pfad`, `title` | `change` → `detail` = Wert | |
| `fig-input-color` | `value`, `alpha="false"` | `change` → `detail = { value, hex, rgba, … }` | |
| `fig-input-file` | `accepts`, `label` | `change`; gelesen wird `el.files` | `accepts` (mit s) ist der figui3-Name |
| `fig-slider` | `min`, `max`, `step`, `value`, `text="false"` | `change` → `detail` = Wert | |
| `fig-group` (4 ×) | `collapsible`, `open` (`"true"`/`"false"`), `name` | `openchange` → `detail = { open }` | Mit eigenem `<fig-header>`-Kind erzeugt figui3 keinen eigenen Kopf |
| `fig-header` (7 ×) | `dialog-header`, `borderless`, `hidden` | — | Reine CSS-Hülle; Höhe über `--fig-header-height` |
| `fig-footer` (2 ×) | — | — | Reine CSS-Hülle |
| `fig-card` (7 ×) | `label` | — | Als Kennzahlen-Kachel und als Container für Lizenz-/Hinweiskarte |
| `fig-swatch` / `fig-skeleton` / `fig-shimmer` | `background`, `size` | — | Farbliste und ihr Ladezustand |
| `fig-spinner` | `aria-label` | — | |
| `<dialog is="fig-dialog">` (4 ×) | `modal`, `aria-labelledby` | `close` (nativ) | Steuerung über `showModal()` / `close()`; braucht ein `fig-header[dialog-header]`, sonst baut figui3 selbst einen Kopf |
| `<dialog is="fig-popup">` (4 ×) | `anchor` (CSS-Selektor), `position` (zwei Marken, leerzeichengetrennt) | — | Steuerung über `.open`; Außenklick behandeln wir selbst (kein `closedby`) |
| `<dialog is="fig-toast">` | `duration` | — | Anzeige über `showToast()` |

---

## 4 · Bewusst eigenes Markup

| Stelle | Warum kein figui3-Element |
|---|---|
| **Bühne** (`#buehne`, `<canvas>`, `.ovl`-Werkzeugleisten, `.vptip`, `.bhgriff`) | Der Vergleich wird auf ein `<canvas>` gezeichnet; figui3 hat dafür nichts. Die schwebenden Leisten sind absolut positionierte Container — sie *enthalten* figui3-Knöpfe und -Segmentschalter, sind aber selbst kein Bauteil. |
| **Bühnenfarben** (`#1e1e1e` dunkler Grund, `#f5a623`/`#ffb84d` Differenz-Orange, `#0d99ff` Differenz-Blau, `#3a3a44`/`#d9d9de` „beide“, `#b9b9c2` Beschriftung auf Dunkel, `KEY_FARBEN` der Keyline-Skizze) | Das sind Daten-Farben, keine Oberflächen-Farben: sie müssen in hell **und** dunkel gleich bleiben, sonst ändert sich die Aussage des Bildes. Bewusst außerhalb der `--figma-color-*`-Kaskade. |
| **Onboarding-/Paywall-Bühne** (`.bh-bild` mit `#221f2b`, `#2f2a3d`, `#1d1b25`, `#3a3350`, `#262233`, `#cfc9e6`, `#e7e3f4`) | Illustration, kein UI-Chrom — ein fester dunkler Bildgrund, unabhängig vom Figma-Theme. |
| **Kennzahlen-Tabelle** (`table.kztab`) und **Bericht-Tabelle** (`table.btabelle`) | figui3 kennt keine Tabelle. Beide brauchen klebende Kopfzeile, Zebra, Zahlensatz (`tabular-nums`) und sortierbare Spalten — das ist echtes `<table>`-Gebiet. Die Zellen enthalten figui3-Teile (`fig-checkbox`, `fig-tooltip`). |
| **Pfad-Parser-Overlays** (`.upill`, `.vlegende .legfeld`, `.hilfezeichen`, `.kzname`) | Legende und Urteil beschreiben das Bild auf der Bühne und tragen dessen Farben. `fig-chit` ist in figui3 ein Farb-Swatch (leere Unterklasse von `fig-swatch`), kein Text-Chip — für Text-Pillen gibt es schlicht kein Element. |
| **Text-Chips** (`.chip` in Kopf, Titelzeile, Startliste, Plan, Protokoll) | Gleicher Grund: kein Text-Chip in figui3. Die Farben laufen jetzt aber über `--figma-color-bg-success/-danger/-warning-tertiary`. |
| **Fortschrittsbalken** (`.balkenrahmen`/`.balken`) | figui3 hat nur `fig-spinner`, keine Fortschrittsanzeige. Der Spinner daneben *ist* `fig-spinner`. |
| **Punkt-Navigation** (`.bh-dots` mit nativen `<button>`) | Kein Pendant in figui3. |
| **Karten** (`.ikarte`, `.profilkarte`, `.eskarte`, `.groessekarte`, `.varzeile`) | `fig-card` ist eine **Medien**-Karte (`src`, `aspect-ratio`, `fit`, generierte `fig-card-label`-Kinder). Als reiner Listeneintrag müsste man mehr wegkonfigurieren, als man gewinnt. Wo es passt (Kennzahlen-Kacheln, Lizenzkarte, Paywall-Hinweis) nutzen wir `fig-card` bereits. |
| **Label-Feld-Zeilen** (`.feld`, `.gfeld`) statt `fig-field` | `fig-field` ist ein vierspaltiges Grid (`chevron label input pad`) mit fester Label/Input-Quote. Unsere Einstellungen brauchen eine feste Labelbreite (108 / 62 / 54 px), darunter eine Hilfezeile und in der Größen-Karte eine vertikale Anordnung. Das ist mit `--fig-field-*` nicht sauber erreichbar. **Offen** als möglicher Folgeschritt. |
| **Gruppenköpfe** (`.gruppenkopf`, 9 px Versalien) statt `fig-separator[label]` / `fig-group[name]` | Die Köpfe sind Teil des eigenen Satzrhythmus (siehe unten). Ein Wechsel auf `fig-separator` änderte die Typografie aller Einstellungsblöcke. **Offen.** |
| **Keyline-Aufklapper** (`.keyauf` + `.keyblock`) statt `fig-group collapsible` | Der Auslöser trägt eine Kurzfassung der Werte neben sich (`.keykurz`), die bei `fig-group` in den Kopf wandern müsste. Umbau lohnt nur zusammen mit einem Redesign der Größen-Karte. **Offen.** |
| **Satzrhythmus** (`body { font-size: 11px }`, Stufen 9 / 9,5 / 10 / 10,5 / 12 / 13 px, Radien 6–11 px, Scrollbalken 8 px) | Die Oberfläche ist absichtlich dichter als der figui3-Standard (`--body-medium-fontSize`, `--radius-medium` = 5 px, Scrollbalken `--spacer-1` = 4 px), weil auf 400 px Breite drei Tabs, eine Bühne und das Protokoll gleichzeitig sichtbar bleiben sollen. Dokumentiert in den Kopfkommentaren von `style/20-einstellungen.css` und `style/30-bericht.css`. |
| **Eigene Außenklick-Behandlung der Popups** statt `closedby="any"` | `fig-popup` könnte über `closedby` selbst schließen; unsere Handler unterscheiden zusätzlich zwischen Auslöser und Menü, damit ein zweiter Klick auf den Auslöser das Menü zuklappt statt es sofort wieder zu öffnen. |

---

## 5 · Prüfschritte nach der Korrektur

    node gen-ui.mjs          → ui.html gebaut, 14 Logik-Module, 338 Wörter
    new Function(<letztes <script> aus ui.html>)   → fehlerfrei
    $('id')-Abgleich          → 174 genutzte IDs, alle vorhanden
                                (dynamische aus startseiteAufbauen() ausgenommen)
    fig-Tag-Abgleich          → 21 verschiedene fig-*-Tags, alle registriert
    node test/run.mjs         → 58 bestanden, 0 fehlgeschlagen

Nicht angefasst: `src/main/**`, `build.mjs`, `test/**`, `manifest.json`.
Das Nachrichtenprotokoll zwischen UI und Hauptthread ist unverändert.

## Vendored figui3

`fig.js` / `fig.css` = `@rogieking/figui3@9.0.14` dist-Bundle (unpkg, 2026-09-17). Update: `curl -sL https://unpkg.com/@rogieking/figui3@<version>/dist/fig.js -o fig.js` (ebenso fig.css), dann `node build.mjs` — das dist-Bundle ist selbständig (keine Imports), die Quelle unter `main` ist es nicht.
