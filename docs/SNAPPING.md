# Snapping — how the pixel grid is hit

Source of truth: the comments in `src/main/30-snap.js` (grid rules) and
`src/main/60-build.js` (AA oracle, quality measurement). This file only spells
them out with numbers.

Snapping runs on the **live geometry**, before `union` / `flatten`. That matters:
the outlined library variant and the optional stroke variant are produced from the
same, already-snapped vectors, so they are edge-identical.

---

## 1. Grid, phase, `rund` and `snapWert`

```js
rund(wert, r, phase = 0) → Math.round((wert - phase) / r) * r + phase
```

A stroke of weight `w` does not sit *on* the grid — its centre line is offset by
half the stroke. That offset is the **phase**:

```js
phase = (w / 2) % raster
```

*Example.* Stroke 1.5 on a 0.5 grid → `phase = 0.75 % 0.5 = 0.25`. Centre lines
therefore land on `…, 6.25, 6.75, 7.25, …`, which puts the two stroke edges
(`centre ± 0.75`) on whole and half pixels — `6.25 ± 0.75` = `5.5 / 7.0`.
With a 0.25 grid the same stroke has `phase = 0.75 % 0.25 = 0`.

```js
snapWert(wert, phase, { raster, rasterGrob })
```

If `rasterGrob` is configured, the coarse target is tried first and accepted when
the move is at most `SNAP.GROB_TOLERANZ = 0.35 px`; otherwise the fine grid wins.

*Example* with `{ raster: 0.5, rasterGrob: 1 }`:

| value | coarse target | distance | result |
|---|---|---|---|
| 6.30 | 6 | 0.30 | **6** (coarse) |
| 6.35 | 6 | 0.35 | **6** (coarse, boundary is inclusive) |
| 6.45 | 6 | 0.45 | **6.5** (fine) |

This replaces the v1 hard-coded `N === 24` special case: `rasterGrob: 1` is
exactly what "N is 24" used to mean. `raster: 0.5` with `rasterGrob: null`
reproduces `Math.round((w - p) * 2) / 2 + p` bit for bit (division by 0.5 is
exact in IEEE-754), which `test/run.mjs` re-checks against 20 000 random values.

## 2. Straight edges (`geradeKanten`)

Segments without tangents whose deviation along one axis is ≤ `SNAP.NEIGUNG =
0.08 px` count as axis-parallel and are **straightened**. Their vertices are
clustered per axis: a new cluster starts when the gap to the previous vertex
exceeds `SNAP.LUECKE = 0.15` or the cluster would span more than
`SNAP.SPANNE = 0.3`. Each cluster snaps as one, to the average of its members.

## 3. Stem pairs

Two parallel edges exactly one stroke weight apart are the two sides of a stem.
They are snapped **rigidly as a pair**: the pair's centre is snapped, both edges
follow. The stroke weight therefore stays bit-exact — a stem never becomes
1.5 px on one icon and 2 px on the next.

*Example.* Stroke 2, edges at 7.1 and 9.1 on a 0.5 grid: centre 8.1 → 8.0, edges
become 7.0 / 9.0. Rounding them separately would have given 7.0 / 9.0 here too,
but 7.1 / 9.4 (a slightly skewed stem) would have become 7.0 / 9.5 — a 2.5 px stem.

## 4. Centre protection

A line that lies on the box centre axis (`N / 2 ± 0.05`) is **never moved**.
Its counterparts — diagonals, arrow heads, tips — cannot follow it, so moving it
deforms the icon. Symmetry beats sharpness.

*Example.* `arrow` at N = 14: the shaft sits at y = 7.0 with stroke 1.5, so the
phase would want 6.75 or 7.25. It stays at 7.0; the arrow head keeps its angle.

## 5. Mirror coupling

Two clusters that mirror each other across the centre (`menu`, `pause`, `equals`)
do not round independently. One is snapped, the other takes the **mirrored**
target of its partner.

*Example.* N = 24, clusters at 5.4 and 18.6 (mirror axis 12). Independently:
5.4 → 5 and 18.6 → 19 — distances 7 and 7, still symmetric by luck. With
5.4 → 5 and 18.7 → 18.5 the icon would be lopsided. Coupling forces 5 / 19.

## 6. Joint protection

Vertices where a straight **diagonal** meets an axis-parallel edge are pinned.
Snapping the axis edge would drag the shared joint and tilt the diagonal out of
its angle — the classic "queue-down arrow head that bends".

## 7. Rhythm protection

Three or more parallel lines with equal spacing (list icons, `menu`, `align-*`)
are treated as a series:

- If the spacing itself is snappable (`|snapWert(gap) − gap| ≤ 0.02`), the whole
  series is **moved rigidly** — centre-preserving when it sits symmetrically
  around `N / 2`.
- Otherwise the series is **pinned** completely.

*Example.* N = 24, lines at 5.33 / 10.66 / 15.99 (gap 5.33). Individually, with
a coarse grid, they become 5 / 11 / 16 — gaps 6 and 5, the rhythm tips. The rule
keeps 5.33 spacing and shifts the row as a block.

The tolerances 0.06 (equal spacing) and 0.02 (snappable) are deliberately literal
and do **not** scale with the grid.

## 8. Fill stem pairs

Filled bars (`audio-bars`, `pause`) have two *fill* edges (phase 0) at an
arbitrary distance. Rounded separately, equal bars become unequal — especially on
a coarse grid. So adjacent fill edges are paired, the width `d` is snapped with
`snapWert(d, 0, rc)`, and the pair is set rigidly. The centre-preserving variant
is only used when the base value is already on the grid
(`|basis − rund(basis, raster)| ≤ 0.01`).

## 9. Extremum hinting

Curve apexes with axis-parallel tangents (bell tops, speech-bubble crowns, arcs)
are snapped too, but the move is capped at **0.3 px** (`SNAP.MAXWEG`). Beyond
that the curve would visibly deform.

## 10. Angle tilt check (`schiefeWinkel`)

Straight segments that sit *close to* but not on a canonical angle (0 / 30 / 45 /
60 / 90°, tolerance 0.05°) are reported as a **warning only**. No auto-fix:
segment ends hang on neighbouring geometry. This complements the pixel-based
straightening (0.08 px), which by construction cannot see a long, slightly
tilted edge.

## 11. Narrow gaps (`engeLuecken`)

Distances between parallel straight edges below 1 px turn to mud at 1× zoom.
Audit rule only — relevant mostly for the 14 px size.

## 12. Grid rate (`rasterRate`)

Sharpness metric for the audit: share of straight edges that sit on the grid,
tolerance 0.01 px. Reported as `auf / gesamt`.

## 13. The AA oracle

Snapping is not applied blindly. With snapping on, `baueGroesse` builds **both**
candidates — snapped (A) and untouched (B) — exports each at 1× and 8×, and has
the UI measure them:

- **treue (fidelity)** = RMS error of the 1× rasterisation against the 8×
  reference, downsampled. Lower is better.
- **aa** = share of pixels that are neither fully on nor fully off, i.e. the
  amount of anti-aliasing.

Winner rule: B (unsnapped) only wins if `B.fehler < A.fehler − 1e-6`, or if the
two are equal within `1e-6` and `B.aa < A.aa`. **Ties go to the snapped
candidate.** The loser is discarded, including its stroke variant.

*Example.* A: fidelity 0.061, aa 18 %. B: fidelity 0.074, aa 22 % → A wins,
snapping is kept. If A came out at 0.090, B would win and the size is built
unsnapped — snapping is a proposal, not a dogma.

Measurement result and the winning flag are stored on the set as `guete` and, per
build, appended to `verlauf` (max. 12 entries) so the report can show a trend.

## 14. Diff comparison

The preview renders old and new side by side: onion skin, pixel view at 1× / 2× /
8×, and a **difference** row — `|old − new|` per pixel at the chosen rasterisation,
removed pixels in magenta, added pixels in cyan. Without an existing set only the
"new" column is drawn.

---
---

# Snapping — wie das Pixelraster getroffen wird

Quelle: die Kommentare in `src/main/30-snap.js` (Rasterregeln) und
`src/main/60-build.js` (AA-Orakel, Gütemessung). Hier stehen sie mit Zahlen.

Gerastert wird die **lebendige Geometrie**, vor `union` / `flatten`. Das ist der
Punkt: die geplättete Library-Fassung und die optionale Stroke-Fassung entstehen
aus denselben, bereits gerasteten Vektoren und sind kantenidentisch.

---

## 1. Raster, Phase, `rund` und `snapWert`

```js
rund(wert, r, phase = 0) → Math.round((wert - phase) / r) * r + phase
```

Eine Kontur mit Gewicht `w` liegt nicht *auf* dem Raster — ihre Mittellinie ist um
die halbe Strichstärke versetzt. Dieser Versatz ist die **Phase**:

```js
phase = (w / 2) % raster
```

*Beispiel.* Kontur 1,5 auf Raster 0,5 → `phase = 0,75 % 0,5 = 0,25`. Mittellinien
landen also auf `…, 6,25, 6,75, 7,25, …`, womit die beiden Konturkanten
(`Mitte ± 0,75`) auf ganzen und halben Pixeln sitzen: `6,25 ± 0,75` = `5,5 / 7,0`.
Bei Raster 0,25 hat dieselbe Kontur `phase = 0,75 % 0,25 = 0`.

```js
snapWert(wert, phase, { raster, rasterGrob })
```

Ist `rasterGrob` gesetzt, wird zuerst das grobe Ziel probiert und übernommen,
wenn der Weg höchstens `SNAP.GROB_TOLERANZ = 0,35 px` beträgt; sonst gilt das
feine Raster.

*Beispiel* mit `{ raster: 0.5, rasterGrob: 1 }`:

| Wert | grobes Ziel | Weg | Ergebnis |
|---|---|---|---|
| 6,30 | 6 | 0,30 | **6** (grob) |
| 6,35 | 6 | 0,35 | **6** (grob, Grenze zählt mit) |
| 6,45 | 6 | 0,45 | **6,5** (fein) |

Das ersetzt den hart verdrahteten `N === 24`-Sonderfall aus v1: `rasterGrob: 1`
ist genau das, was früher „N ist 24“ hieß. `raster: 0.5` mit `rasterGrob: null`
liefert bitgenau `Math.round((w − p) * 2) / 2 + p` (die Division durch 0,5 ist in
IEEE-754 exakt) — `test/run.mjs` prüft das gegen 20 000 Zufallswerte nach.

## 2. Gerade Kanten (`geradeKanten`)

Segmente ohne Tangenten, deren Abweichung entlang einer Achse ≤ `SNAP.NEIGUNG =
0,08 px` ist, gelten als achsparallel und werden **begradigt**. Ihre Vertices
werden je Achse geclustert: ein neues Cluster beginnt, wenn der Abstand zum
Vorgänger `SNAP.LUECKE = 0,15` übersteigt oder das Cluster länger als
`SNAP.SPANNE = 0,3` würde. Jedes Cluster rastet als Ganzes auf seinen Mittelwert.

## 3. Stem-Paare

Zwei parallele Kanten mit genau Konturabstand sind die beiden Seiten eines Stems.
Sie rasten **starr als Paar**: die Mitte des Paars wird gerastet, beide Kanten
folgen. Das Strichgewicht bleibt dadurch bit-genau — ein Stem wird nie auf einem
Icon 1,5 px und auf dem nächsten 2 px.

*Beispiel.* Kontur 2, Kanten bei 7,1 und 9,1 auf Raster 0,5: Mitte 8,1 → 8,0,
Kanten werden 7,0 / 9,0. Einzeln gerundet käme hier dasselbe heraus, aber
7,1 / 9,4 (leicht schiefer Stem) würde 7,0 / 9,5 — ein 2,5-px-Stem.

## 4. Mitte-Schutz

Eine Linie auf der Box-Mittelachse (`N / 2 ± 0,05`) wird **nie verschoben**. Ihre
Gegenstücke — Diagonalen, Spitzen, Pfeilköpfe — können nicht mitwandern, das Icon
würde verformt. Symmetrie schlägt Schärfe.

*Beispiel.* `arrow` bei N = 14: der Schaft liegt auf y = 7,0 bei Kontur 1,5, die
Phase wollte 6,75 oder 7,25. Er bleibt auf 7,0, die Pfeilspitze behält ihren Winkel.

## 5. Spiegel-Kopplung

Zwei Cluster, die einander an der Mitte spiegeln (`menu`, `pause`, `equals`),
runden nicht unabhängig. Eines wird gerastet, das andere übernimmt das
**gespiegelte** Ziel des Partners.

*Beispiel.* N = 24, Cluster bei 5,4 und 18,6 (Spiegelachse 12). Unabhängig:
5,4 → 5 und 18,6 → 19 — zufällig noch symmetrisch. Bei 5,4 → 5 und 18,7 → 18,5
stünde das Icon schief. Die Kopplung erzwingt 5 / 19.

## 6. Gelenk-Schutz

Vertices, an denen eine gerade **Diagonale** auf eine achsparallele Kante trifft,
werden gepinnt. Eine gerastete Achskante würde das geteilte Gelenk mitziehen und
die Diagonale aus dem Winkel kippen — die klassische verbogene
Queue-down-Pfeilspitze.

## 7. Rhythmus-Schutz

Drei oder mehr parallele Linien mit gleichem Abstand (Listen-Icons, `menu`,
`align-*`) werden als Reihe behandelt:

- Ist der Abstand selbst rasterbar (`|snapWert(g) − g| ≤ 0,02`), wird die ganze
  Reihe **starr verschoben** — zentrumserhaltend, wenn sie symmetrisch um `N / 2`
  liegt.
- Sonst wird die Reihe komplett **gepinnt**.

*Beispiel.* N = 24, Linien bei 5,33 / 10,66 / 15,99 (Abstand 5,33). Einzeln
gerundet, mit Vorliebe fürs grobe Raster, werden daraus 5 / 11 / 16 — Abstände 6
und 5, die Reihe kippt. Die Regel hält 5,33 und verschiebt die Reihe als Block.

Die Toleranzen 0,06 (gleicher Abstand) und 0,02 (rasterbar) skalieren bewusst
**nicht** mit dem Raster.

## 8. Fill-Stem-Paare

Flächen-Balken (`audio-bars`, `pause`) haben zwei *Füll*kanten (Phase 0) in
beliebigem Abstand. Einzeln gerundet werden gleiche Balken ungleich, vor allem
bei grobem Raster. Deshalb: benachbarte Füllkanten als Paar, Breite `d` mit
`snapWert(d, 0, rc)` mitrunden, Paar starr setzen. Die zentrumserhaltende
Variante greift nur, wenn die Basis schon auf dem Raster liegt
(`|basis − rund(basis, raster)| ≤ 0,01`).

## 9. Extrema-Hinting

Kurven-Scheitel mit achsparallelen Tangenten (Glockenkuppeln, Sprechblasen-
Oberkanten, Bögen) rasten ebenfalls, aber mit einer Wegbegrenzung von
**0,3 px** (`SNAP.MAXWEG`). Darüber hinaus würde sich die Kurve sichtbar verformen.

## 10. Winkel-Kipp-Prüfung (`schiefeWinkel`)

Gerade Segmente, die *knapp neben* einem kanonischen Winkel liegen (0 / 30 / 45 /
60 / 90°, Toleranz 0,05°), werden **nur gemeldet**, nicht korrigiert:
Segmentenden hängen an Nachbargeometrie. Das ergänzt die pixelbasierte
Begradigung (0,08 px), die lange, leicht gekippte Kanten prinzipbedingt nicht
erkennt.

## 11. Enge Lücken (`engeLuecken`)

Abstände paralleler gerader Kanten unter 1 px verschlammen bei 1×. Reine
Audit-Regel, vor allem für die 14er relevant.

## 12. Rasterrate (`rasterRate`)

Schärfe-Metrik fürs Audit: Anteil der geraden Kanten, die auf dem Raster liegen,
Toleranz 0,01 px. Wird als `auf / gesamt` ausgewiesen.

## 13. Das AA-Orakel

Gerastert wird nicht blind. Bei aktivem Snapping baut `baueGroesse` **beide**
Kandidaten — gerastet (A) und unangetastet (B) —, exportiert jeden in 1× und 8×
und lässt die UI messen:

- **Treue** = RMS-Fehler der 1×-Rasterung gegen die 8×-Referenz. Kleiner ist besser.
- **aa** = Anteil der Pixel, die weder ganz an noch ganz aus sind, also die Menge
  an Kantenglättung.

Sieger-Regel: B (ohne Snap) gewinnt nur, wenn `B.fehler < A.fehler − 1e-6`, oder
wenn beide innerhalb `1e-6` gleich sind und `B.aa < A.aa`. **Gleichstand geht an
den gerasteten Kandidaten.** Der Verlierer wird verworfen, samt Stroke-Fassung.

*Beispiel.* A: Treue 0,061, aa 18 %. B: Treue 0,074, aa 22 % → A gewinnt, das
Snapping bleibt. Käme A auf 0,090, gewänne B und die Größe würde ungerastet
gebaut — Snapping ist ein Vorschlag, kein Dogma.

Messergebnis und Siegerflag landen als `guete` am Set und werden je Bau an
`verlauf` angehängt (max. 12 Einträge), damit der Bericht einen Trend zeigen kann.

## 14. Verlaufs-Vergleich

Die Vorschau stellt alt und neu nebeneinander: Onionskin, Pixelansicht in
1× / 2× / 8× und eine **Differenz**-Zeile — `|alt − neu|` pro Pixel bei der
gewählten Rasterung, entfernte Pixel magenta, hinzugekommene türkis. Ohne
bestehendes Set wird nur die Spalte „neu“ gezeichnet.
