// ===========================================================================
// 06-i18n-zusatz.js — Texte der Runde 3 (Trockenlauf, Abbruch, Bericht,
// Export, Beispiel-Icon) und der Runde 4 (Audit-Codes, Lizenz, Begriffe).
// Liegt bewusst in einer eigenen Datei: 05-i18n.js gehört Paket A1.
// Beide Sprachen vollständig, gleiche Platzhalter.
//
// Runde 4, Abschnitt 27: Im Deutschen heißt die Master-Komponente „Vorlage“,
// nicht mehr „Source“. Die betroffenen Schlüssel aus 05-i18n.js werden hier
// überschrieben (05 selbst bleibt unangetastet); im Englischen bleibt „source“.
// ===========================================================================

Object.assign(SPRACHEN.de, {
  'log.rueckgaengig': 'Letzter Schritt zurückgenommen.',
  'log.rueckgaengigFehlt': 'Rückgängig nicht möglich — bitte Cmd+Z in Figma nutzen.',
  // --- Trockenlauf ---
  'plan.keineSource': 'keine Vorlage gefunden',
  'plan.frameWandeln': 'Frame wird beim Bauen in eine Komponente umgewandelt',
  'plan.frameNichtErlaubt': 'Frame wird nicht umgewandelt — Einstellungen → Schreiben',
  'plan.gesperrt': 'gesperrt — Bauen nicht möglich',
  'plan.neuesSet': 'Set wird neu angelegt',
  'plan.fehlendeVarianten': '{n} Varianten werden ergänzt',
  'plan.fremdeVarianten': '{n} fremde Varianten bleiben stehen',
  'plan.sourceMass': 'Vorlage misst {ist} statt {soll}',
  'plan.strokeHeimAus': 'Stroke-Fassung wird übersprungen — Einstellungen → Schreiben',
  'plan.strokeHeimNeu': 'Ablage für Stroke-Fassungen wird angelegt',
  'plan.instanzenUnbekannt': 'Instanzen nicht gezählt — zu viele Knoten im File',
  'log.planFertig': 'Trockenlauf: {n} Ziele geprüft, nichts geändert.',

  // --- Abbruch ---
  'log.abbruchAngefordert': 'Abbruch angefordert — der laufende Schritt wird noch beendet.',

  // --- Bericht ---
  'log.berichtLaeuft': 'Bericht wird erstellt …',
  'fazit.bericht': 'Bericht: {icons} Icons · Treue Ø {treue} · Keyline {ok}/{gesamt}{ohneSet}',
  'fazit.berichtOhneSet': ' · ohne Set: {n}',
  'bericht.keinBau': 'noch nie gebaut',

  // --- Export ---
  'log.exportLaeuft': 'SVG-Export wird vorbereitet …',
  'fazit.export': 'Export: {dateien} Dateien aus {icons} Icons{fehlend}',
  'fazit.exportFehlend': ' · ohne Set: {n}',

  // --- Beispiel-Icon ---
  'beispiel.nurFrei': 'Ein Beispiel-Icon lässt sich nur im Frei-Modus anlegen.',
  'beispiel.name': 'demo-icon',

  // === Runde 4 ============================================================
  // --- Begriffe (Abschnitt 27): „Source“ → „Vorlage“, Schlüssel aus 05 ---
  'fehler.KEINE_SOURCE': '{name}: keine Vorlage gefunden.',
  'hinweis.KEINE_SOURCE': 'Erwartet wird eine Komponente mit {mass} × {mass} px.',
  'fehler.SOURCE_LEER': '{name}: die Vorlage enthält keine Vektoren.',
  'hinweis.SOURCE_LEER': 'Ohne zeichnende Ebenen lässt sich keine Keyline messen.',
  'fehler.SOURCE_MASS': '{name}: Vorlage misst {ist}, erwartet {soll}.',
  'hinweis.SOURCE_MASS': 'Die Master-Größe steht in den Einstellungen unter „Master“. Setze die Vorlage auf dieses Maß oder passe die Konfiguration an.',
  'fehler.GESPERRT': '{name}: Vorlage, Set oder Variante ist gesperrt.',
  'konfig.farbVariable': 'Keine Farbvariable gewählt — Modus „Wie Vorlage“ gesetzt.',
  'bau.sourceMisst': ' — Vorlage misst {ist} statt {soll}',
  'audit.keineSource': '{name}: keine Vorlage',
  'audit.schiefeKante': '{name}: Kante {wert} — in der Vorlage begradigen',
  'audit.veraltet': '{name}: Vorlage geändert seit dem letzten Bau — neu bauen',
  'audit.luecke': '{name}/{N}: Zwischenraum {wert} px füllt sich bei 1× zu',
  'profil.generic.beschreibung': 'Neutraler Start für ein beliebiges File: 24-px-Master, Größen 16/20/24, Farbe aus der Vorlage.',

  // --- Strukturierte Audit-Befunde (Abschnitt 28.1) ---
  'fehler.KEYLINE_ABWEICHUNG': '{name} · {N} px: Maß {ist} statt {soll}.',
  'hinweis.KEYLINE_ABWEICHUNG': 'Der Icon-Körper füllt das vorgesehene Keyline-Maß nicht. Keyline dieser Größe prüfen oder das Icon neu bauen.',
  'fehler.STRUKTUR_KNOTEN': '{name} · {N} px: {n} Knoten statt einem.',
  'hinweis.STRUKTUR_KNOTEN': 'Eine Variante soll genau einen geflatteten Pfad enthalten. Icon neu bauen.',
  'fehler.STRUKTUR_TYP': '{name} · {N} px: {typ} statt VECTOR.',
  'hinweis.STRUKTUR_TYP': 'Nur ein Vektor lässt sich rastern und messen. Icon neu bauen.',
  'fehler.RESTKONTUR': '{name} · {N} px: Restkontur vorhanden.',
  'hinweis.RESTKONTUR': 'Nach dem Plätten bleibt nur eine Fläche übrig — hier hängt noch eine Kontur daran. Icon neu bauen.',
  'fehler.FARBE_UNGEBUNDEN': '{name} · {N} px: Farbe nicht an das Design-Token gebunden.',
  'hinweis.FARBE_UNGEBUNDEN': 'Einstellungen → Farbe prüfen und das Icon neu bauen.',
  'fehler.LUECKE_ENG': '{name} · {N} px: Zwischenraum {d} px füllt sich bei 1× zu.',
  'hinweis.LUECKE_ENG': 'In der Vorlage den Abstand vergrößern — sonst verschwindet die Trennung in der kleinsten Größe.',
  'fehler.KANTE_SCHIEF': '{name}: Kante bei {ist}° statt {soll}° — in der Vorlage begradigen.',
  'hinweis.KANTE_SCHIEF': 'Fast gerade Kanten rastern schlecht und flimmern. In der Vorlage auf den vollen Winkel bringen.',
  'fehler.VORLAGE_GEAENDERT': '{name}: Vorlage geändert seit dem letzten Bau.',
  'hinweis.VORLAGE_GEAENDERT': 'Icon neu bauen, damit das Set wieder zur Vorlage passt.',
  'fehler.KEIN_SET': '{name}: kein Varianten-Set vorhanden.',
  'hinweis.KEIN_SET': 'Icon einmal bauen — danach liegt das Set neben der Vorlage.',

  // --- Lizenz (Abschnitt 28.5) ---
  'fehler.LIZENZ_NOETIG': '{funktion} gehört zur Vollversion.',
  'hinweis.LIZENZ_NOETIG': 'Einmalkauf, kein Abo. Die Testphase läuft {tage} Tage ab dem ersten Start.',
  'lizenz.funktion.alle': 'Alle Icons bauen',
  'lizenz.funktion.bericht': 'Der Qualitätsbericht',
  'lizenz.funktion.exportieren': 'Der SVG-Export',
  'lizenz.funktion.konfigImport': 'Der Konfig-Import',
  'lizenz.kaufFehler': 'Der Kauf ließ sich nicht öffnen: {grund}',
  'lizenz.keinKauf': 'Diese Figma-Version kennt keine Plugin-Zahlungen — es bleibt alles freigeschaltet.',
  'lizenz.debugGesetzt': 'Entwicklermodus: Lizenzstatus auf {status} gesetzt.',

  // --- Übersicht (Startseite der UI) ---
  'log.uebersichtLaeuft': 'Übersicht wird geladen …'
});

Object.assign(SPRACHEN.en, {
  'log.rueckgaengig': 'Last step undone.',
  'log.rueckgaengigFehlt': 'Undo not available — please use Cmd+Z in Figma.',
  // --- dry run ---
  'plan.keineSource': 'no source found',
  'plan.frameWandeln': 'frame will be converted to a component when building',
  'plan.frameNichtErlaubt': 'frame will not be converted — Settings → Writing',
  'plan.gesperrt': 'locked — cannot build',
  'plan.neuesSet': 'set will be created',
  'plan.fehlendeVarianten': '{n} variants will be added',
  'plan.fremdeVarianten': '{n} foreign variants will be left untouched',
  'plan.sourceMass': 'source measures {ist} instead of {soll}',
  'plan.strokeHeimAus': 'stroke version will be skipped — Settings → Writing',
  'plan.strokeHeimNeu': 'a frame for stroke versions will be created',
  'plan.instanzenUnbekannt': 'instances not counted — too many nodes in this file',
  'log.planFertig': 'Dry run: {n} targets checked, nothing changed.',

  // --- abort ---
  'log.abbruchAngefordert': 'Abort requested — the current step will still finish.',

  // --- report ---
  'log.berichtLaeuft': 'Building the report …',
  'fazit.bericht': 'Report: {icons} icons · fidelity avg {treue} · keyline {ok}/{gesamt}{ohneSet}',
  'fazit.berichtOhneSet': ' · without set: {n}',
  'bericht.keinBau': 'never built',

  // --- export ---
  'log.exportLaeuft': 'Preparing the SVG export …',
  'fazit.export': 'Export: {dateien} files from {icons} icons{fehlend}',
  'fazit.exportFehlend': ' · without set: {n}',

  // --- demo icon ---
  'beispiel.nurFrei': 'A demo icon can only be created in free mode.',
  'beispiel.name': 'demo-icon',

  // === round 4 ============================================================
  // --- structured audit findings (section 28.1) ---
  'fehler.KEYLINE_ABWEICHUNG': '{name} · {N} px: size {ist} instead of {soll}.',
  'hinweis.KEYLINE_ABWEICHUNG': 'The icon body does not fill the intended keyline. Check the keyline of this size or rebuild the icon.',
  'fehler.STRUKTUR_KNOTEN': '{name} · {N} px: {n} nodes instead of one.',
  'hinweis.STRUKTUR_KNOTEN': 'A variant should hold exactly one flattened path. Rebuild the icon.',
  'fehler.STRUKTUR_TYP': '{name} · {N} px: {typ} instead of VECTOR.',
  'hinweis.STRUKTUR_TYP': 'Only a vector can be rasterised and measured. Rebuild the icon.',
  'fehler.RESTKONTUR': '{name} · {N} px: a stroke is left over.',
  'hinweis.RESTKONTUR': 'After flattening only a filled shape should remain. Rebuild the icon.',
  'fehler.FARBE_UNGEBUNDEN': '{name} · {N} px: colour not bound to the design token.',
  'hinweis.FARBE_UNGEBUNDEN': 'Check Settings → Colour and rebuild the icon.',
  'fehler.LUECKE_ENG': '{name} · {N} px: gap of {d} px closes at 1×.',
  'hinweis.LUECKE_ENG': 'Widen the gap in the source — otherwise the separation disappears at the smallest size.',
  'fehler.KANTE_SCHIEF': '{name}: edge at {ist}° instead of {soll}° — straighten in the source.',
  'hinweis.KANTE_SCHIEF': 'Almost straight edges snap badly and shimmer. Bring them to the full angle in the source.',
  'fehler.VORLAGE_GEAENDERT': '{name}: source changed since the last build.',
  'hinweis.VORLAGE_GEAENDERT': 'Rebuild the icon so that the set matches the source again.',
  'fehler.KEIN_SET': '{name}: no variant set yet.',
  'hinweis.KEIN_SET': 'Build the icon once — the set then sits next to the source.',

  // --- licence (section 28.5) ---
  'fehler.LIZENZ_NOETIG': '{funktion} is part of the full version.',
  'hinweis.LIZENZ_NOETIG': 'One-time purchase, no subscription. The trial runs for {tage} days from the first start.',
  'lizenz.funktion.alle': 'Building all icons',
  'lizenz.funktion.bericht': 'The quality report',
  'lizenz.funktion.exportieren': 'The SVG export',
  'lizenz.funktion.konfigImport': 'Importing a configuration',
  'lizenz.kaufFehler': 'The purchase could not be opened: {grund}',
  'lizenz.keinKauf': 'This Figma version has no plugin payments — everything stays unlocked.',
  'lizenz.debugGesetzt': 'Developer mode: licence status set to {status}.',

  // --- overview (UI start page) ---
  'log.uebersichtLaeuft': 'Loading the overview …'
});
