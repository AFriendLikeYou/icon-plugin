# Inhalte pflegen — Texte und Grafiken ohne Code

Alle Texte und Grafiken, die dem Nutzer etwas erklären (Welcome-Screen,
Onboarding-Slides, Lizenz-Karte), stehen in **`src/ui/inhalte/`**. Das ist der
einzige Ort, an dem sie geändert werden müssen — die Logik in `src/ui/logik/`
liest sie nur aus.

```
src/ui/inhalte/
  welcome.mjs      erster Onboarding-Screen (Hero)
  lizenz.mjs       Karte „Lizenz“ in den Einstellungen
  onboarding.mjs   Onboarding-Slides 2 bis 4
```

## So geht es

1. Datei in `src/ui/inhalte/` bearbeiten (nur diese Dateien).
2. `node build.mjs` — baut `code.js` und `ui.html` neu.
   (Nur die UI genügt: `node gen-ui.mjs`.)
3. Plugin in Figma neu laden.

`gen-ui.mjs` lädt jede `.mjs` aus dem Ordner und legt sie unter dem Dateinamen
(ohne Endung) in ein Objekt, das der Logik als `INHALTE` zur Verfügung steht.
Eine neue Datei anzulegen ist also möglich, wird aber erst benutzt, wenn die
Logik sie abfragt.

## Zweisprachige Felder

Jeder Text ist ein Objekt mit `de` und `en`:

```js
titel: { de: 'Willkommen bei Icon Pipeline', en: 'Welcome to Icon Pipeline' }
```

Die UI nimmt die Sprache aus den Einstellungen (`automatisch` folgt Figma).
Fehlt `de`, wird `en` genommen. Platzhalter in geschweiften Klammern werden
ersetzt — derzeit nur `{modus}` (der erkannte Modus, „ZDS“ oder „Frei“).

## Grafiken

Grafiken sind vollständige `<svg>`-Zeichenketten in Backticks. Hausstil:

- **eine Akzentfarbe** `#0d99ff` plus **Grau** `#8a8a96`, keine dritte Farbe;
- **Strichstärke 2**, `fill="none"` — wie unsere Icons;
- Gitter sehr dezent (weiß, 7 % Deckung, 16-px-Raster);
- `viewBox` setzen und `width="100%" height="100%"`, damit die Grafik mit der
  Bildbühne skaliert. Die Bühne ist 200 px hoch, beim Welcome-Screen 240 px.
- Kein `<script>`, keine externen Verweise (Bilder, Fonts). Die Datei landet
  inline in `ui.html`. Ein `<style>` **innerhalb** des `<svg>` ist erlaubt —
  so ist die Welcome-Grafik animiert (siehe unten).

## Die einzelnen Dateien

### `welcome.mjs` — Hero des ersten Screens

| Feld | Bedeutung |
|---|---|
| `animiert` | `true` → `svg` (animierte Fassung), `false` → `svgStatisch` |
| `svg` | Bildbühne, 240 px hoch, randlos (dunkler Grund, Gitter) — animiert |
| `svgStatisch` | dieselbe Szene ohne Animation (Endzustand) |
| `titel` | Headline, höchstens 12 Wörter |
| `text` | Subline, höchstens zwei Sätze |
| `primaer` | Beschriftung der primären Schaltfläche (führt in den Rundgang) |
| `sekundaer` | Beschriftung der sekundären Schaltfläche (schließt den Rundgang) |

#### Animierte Welcome-Grafik

Die Grafik zeigt: links die **Vorlage** (großer Kasten mit Icon-Umriss), rechts
die drei **Zielgrößen** im Verhältnis 24 / 18 / 14 (dreifach gezeichnet, also
72 / 54 / 42 Einheiten der `viewBox`). Die Vorlage „zerfällt“, die drei Kästen
fliegen nacheinander nach rechts, rasten mit leichtem Überschwingen ein, und
direkt danach blitzen kurz Rasterlinien auf.

- **Technik:** CSS-Keyframes in einem `<style>` **innerhalb** des `<svg>` —
  kein SMIL, keine externen Verweise. Inline-SVG teilt das Dokument, das
  `<style>` wirkt also wie ein normales Stylesheet und verschwindet mit der
  Grafik, sobald der Slide wechselt.
- **An/Aus:** alle Keyframes hängen an der Klasse `.an`. Die Logik setzt sie am
  Container (`#obBild`), solange der Onboarding-Dialog offen ist, und entfernt
  sie beim Schließen — geschlossener Dialog = keine laufende Animation.
- **Ruhezustand = Endzustand:** ohne `.an` (und bei
  `prefers-reduced-motion: reduce`) sieht man die drei eingerasteten Kästen und
  die blasse Vorlage. Nichts bleibt unsichtbar, wenn die Animation aus ist.
- **Loop:** 6 s. `0–75 %` Bewegung (4,5 s), `75–100 %` Pause (1,5 s). Die
  Prozentwerte in den Keyframes sind also Sechzigstel-Sekunden × 100/6:
  Kasten A löst sich bei 10 % (0,6 s), B bei 20 %, C bei 30 %; jeder rastet
  8,33 % (0,5 s) später ein.

**Ändern:**

| Wunsch | Stelle |
|---|---|
| Tempo | die drei `6s` in `.an .ipw-*` gemeinsam ändern (Prozentwerte bleiben) |
| längere Pause | Bewegung früher beenden: die `70 %`/`75 %`-Keyframes nach vorne ziehen |
| anderer Staffel-Abstand | Startprozente 10 / 20 / 30 in `ipwKastenA/B/C` |
| stärkeres Überschwingen | `scale(1.07)` und der Versatz in den `18,33/28,33/38,33 %`-Keyframes |
| Flugbahn | `translate(…)` in den `0 %`/`75 %`/`100 %`-Keyframes — das ist der Weg von der Vorlage zum Landeplatz, also *Mitte Vorlage minus Mitte Zielkasten* |
| Farben | `--ipw-akzent` / `--ipw-grau` im `<style>` |
| Raster-Blitz | `ipwRasterA/B/C` (Deckung `.8`) und die `<path>`-Linien in den `ipw-raster-*`-Gruppen |

**Gegen ein statisches SVG tauschen:** `animiert: false` setzen und
`node gen-ui.mjs` laufen lassen — dann wird `svgStatisch` gezeigt. Wer ein
eigenes statisches Motiv will, ersetzt einfach `svgStatisch` (normale
`<svg>`-Zeichenkette nach den Regeln oben, kein `<style>` nötig).

### `onboarding.mjs` — Slides 2 bis 4

Ein Array; die Reihenfolge im Array ist die Reihenfolge der Slides. Slides
hinzufügen oder entfernen ist erlaubt — Zähler („2 von 4“) und Punkte richten
sich automatisch danach.

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | technischer Name, frei wählbar |
| `titel` | ja | höchstens 12 Wörter, `{modus}` erlaubt |
| `text` | ja | höchstens zwei Sätze |
| `svg` | ja | Grafik der Bildbühne |
| `textZds` / `textFrei` | nein | ersetzen `text` je erkanntem Modus |
| `svgZds` / `svgFrei` | nein | ersetzen `svg` je erkanntem Modus |
| `extra` | nein | `'profile'` hängt die Profilkarten an, `'lizenz'` den Satz zum Kauf über das Figma-Konto |

### `lizenz.mjs` — Karte in den Einstellungen

| Feld | Bedeutung |
|---|---|
| `svg` | Skizze links in der Karte (64 × 48, Schloss und Schlüssel, nur Konturen — sie sitzt auf hellem wie dunklem Grund) |
| `titel` | Überschrift in der Karte |
| `text` | ein Satz darunter |

Status, Resttage, Kauf-Knopf und der Entwickler-Umschalter kommen weiter aus
dem Wörterbuch (`src/ui/woerter/20-einstellungen.mjs`, Schlüssel `liz.*`) —
sie hängen an der Logik und gehören nicht in die Inhalte.

## Was NICHT hierher gehört

Beschriftungen von Schaltflächen, Feldnamen, Tooltips, Fehlermeldungen und
Statustexte stehen im Wörterbuch `src/ui/woerter/*.mjs`. Regel: steht der Text
in einem Satzbau, der etwas erklärt (Slide, Karte), gehört er in die Inhalte;
ist es ein Label an einem Bedienelement, gehört er ins Wörterbuch. Das
Wörterbuch wird beim Bauen geprüft — fehlt ein Schlüssel in einer Sprache,
bricht `gen-ui.mjs` ab.
