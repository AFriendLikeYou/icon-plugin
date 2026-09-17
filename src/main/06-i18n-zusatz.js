// ===========================================================================
// 06-i18n-zusatz.js — Texte der Runde 3 (Trockenlauf, Abbruch, Bericht,
// Export, Beispiel-Icon). Liegt bewusst in einer eigenen Datei: 05-i18n.js
// gehört Paket A1. Beide Sprachen vollständig, gleiche Platzhalter.
// ===========================================================================

Object.assign(SPRACHEN.de, {
  // --- Trockenlauf ---
  'plan.keineSource': 'keine Source gefunden',
  'plan.frameWandeln': 'Frame wird beim Bauen in eine Komponente umgewandelt',
  'plan.frameNichtErlaubt': 'Frame wird nicht umgewandelt — Einstellungen → Schreiben',
  'plan.gesperrt': 'gesperrt — Bauen nicht möglich',
  'plan.neuesSet': 'Set wird neu angelegt',
  'plan.fehlendeVarianten': '{n} Varianten werden ergänzt',
  'plan.fremdeVarianten': '{n} fremde Varianten bleiben stehen',
  'plan.sourceMass': 'Source misst {ist} statt {soll}',
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
  'beispiel.name': 'demo-icon'
});

Object.assign(SPRACHEN.en, {
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
  'beispiel.name': 'demo-icon'
});
