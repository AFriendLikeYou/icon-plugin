// ===========================================================================
// 05-i18n.js — Wörterbuch für den Hauptthread (de/en) und t(key, params).
// Die UI übersetzt ihre eigenen Strings; hier steht nur, was der Hauptthread
// erzeugt: Logs, Fazit, Fehler/Hinweise, Set-Beschreibungen, Konfig-Meldungen.
// ===========================================================================

let SPRACHE = 'en';

const SPRACHEN = {
  de: {
    // --- Fehler ---
    'fehler.KEIN_ZIEL': 'Nichts Passendes ausgewählt.',
    'hinweis.KEIN_ZIEL': 'Wähle eine Icon-Karte, ein Varianten-Set oder eine Master-Komponente aus.',
    'fehler.KEINE_SOURCE': '{name}: keine Source-Komponente gefunden.',
    'hinweis.KEINE_SOURCE': 'Erwartet wird eine Komponente mit {mass} × {mass} px.',
    'fehler.SOURCE_LEER': '{name}: die Source enthält keine Vektoren.',
    'hinweis.SOURCE_LEER': 'Ohne zeichnende Ebenen lässt sich keine Keyline messen.',
    'fehler.SOURCE_MASS': '{name}: Source misst {ist}, erwartet {soll}.',
    'hinweis.SOURCE_MASS': 'Die Master-Größe steht in den Einstellungen unter „Master“. Setze die Source auf dieses Maß oder passe die Konfiguration an.',
    'fehler.FIT_FEHLT': '{name} / {N}: die Keyline ließ sich nicht einpassen.',
    'hinweis.FIT_FEHLT': 'Die Bisektion fand kein Maß — meist sind die Renderbounds leer (unsichtbare oder leere Ebenen).',
    'fehler.VARIANTE_FEHLT': '{name}: Variante {variante} fehlte im Set und wurde ergänzt.',
    'hinweis.VARIANTE_FEHLT': 'Die neue Variante hat noch keine Instanzen im File.',
    'fehler.FARBE_UNAUFLOESBAR': 'Die eingestellte Farbvariable ließ sich nicht auflösen.',
    'hinweis.FARBE_UNAUFLOESBAR': 'Bibliothek nicht verfügbar oder Variable gelöscht. Es wird ein einfaches Grau gesetzt.',
    'fehler.UNION_FALLBACK': '{name} / {N}: union nicht möglich, es wurde direkt geflattet.',
    'hinweis.UNION_FALLBACK': 'Überlappende Konturen können dadurch als Kanten sichtbar bleiben.',
    'fehler.KLASSE_GERATEN': '{name}: Klasse {klasse} geraten.',
    'hinweis.KLASSE_GERATEN': 'Aus dem Seitenverhältnis abgeleitet. Über die Auswahlzeile lässt sich die Klasse festlegen.',
    'fehler.SEITEN_FEHLEN': 'Seiten „Icons“/„Source“ nicht gefunden — falsches File?',
    'hinweis.SEITEN_FEHLEN': 'Das ZDS-Profil erwartet dieses Board. Stelle in den Einstellungen auf „Frei“ um.',
    'fehler.KARTE_OHNE_SET': '{name}: noch kein Library-Set — es wird neu angelegt.',
    'hinweis.KARTE_OHNE_SET': 'Danach einsortieren und Suchbegriffe in die Beschreibung ergänzen.',
    'fehler.GROESSE_UNBEKANNT': 'Größe {N} steht nicht in der Konfiguration.',
    'hinweis.GROESSE_UNBEKANNT': 'Ergänze sie in den Einstellungen unter „Größen“.',
    'fehler.SET_HAT_FREMDE_VARIANTE': '{name}: Variante {variante} steht nicht in der Konfiguration.',
    'hinweis.SET_HAT_FREMDE_VARIANTE': 'Sie bleibt unangetastet — weder gebaut noch gelöscht.',
    'fehler.FRAME_ZU_KOMPONENTE': '{name}: Frame wurde in eine Komponente umgewandelt.',
    'hinweis.FRAME_ZU_KOMPONENTE': 'Nur Komponenten lassen sich instanziieren und damit einpassen.',
    'fehler.KONFIG_UNGUELTIG': 'Die Konfiguration konnte nicht gespeichert werden: {grund}',
    'fehler.BIBLIOTHEK_UNZUGAENGLICH': 'Team-Libraries nicht abfragbar: {grund}',
    'hinweis.BIBLIOTHEK_UNZUGAENGLICH': 'Braucht die Manifest-Berechtigung „teamlibrary“ und ein Figma-Konto mit Zugriff auf die Library. Bei Development-Plugins nach Manifest-Änderungen das Plugin über „Import plugin from manifest“ neu importieren.',
    'fehler.KEINE_BIBLIOTHEKEN': 'Keine Variablen-Kollektionen aus Libraries gefunden ({lokal} lokale Farbvariablen).',
    'hinweis.KEINE_BIBLIOTHEKEN': 'Figma liefert nur Kollektionen aus Libraries, die in diesem File unter Assets → Libraries aktiviert sind. Library aktivieren, dann „Aktualisieren“.',
    'hinweis.KONFIG_UNGUELTIG': 'Prüfe die markierten Felder im Tab „Einstellungen“.',
    'fehler.GESPERRT': '{name}: Source, Set oder Variante ist gesperrt.',
    'hinweis.GESPERRT': 'Im Ebenen-Panel das Schloss entfernen (Schlosssymbol anklicken) und den Lauf wiederholen.',
    'fehler.FRAME_NICHT_ERLAUBT': '{name}: Frame wird nicht automatisch in eine Komponente umgewandelt.',
    'hinweis.FRAME_NICHT_ERLAUBT': 'Einstellungen → Schreiben → „Frame umwandeln“ einschalten oder den Frame selbst mit Cmd+Alt+K zur Komponente machen.',
    'fehler.STROKEHEIM_AUS': '{name}: Stroke-Fassung übersprungen — es darf kein Ablage-Frame angelegt werden.',
    'hinweis.STROKEHEIM_AUS': 'Einstellungen → Schreiben → „Stroke-Ablage anlegen“ einschalten.',
    'fehler.ABGEBROCHEN': 'Lauf abgebrochen nach {i}/{n}.',
    'hinweis.ABGEBROCHEN': 'Die Teilergebnisse stehen im Protokoll; Cmd+Z nimmt jeden gebauten Schritt einzeln zurück.',
    'fehler.EXPORT_FEHLT': '{name} hat kein Set — nichts zu exportieren.',
    'hinweis.EXPORT_FEHLT': 'Erst bauen, dann exportieren.',

    // --- Konfig-Prüfung ---
    'konfig.adapter': 'Adapter unbekannt — auf Standard zurückgesetzt.',
    'konfig.sprache': 'Sprache unbekannt — auf Standard zurückgesetzt.',
    'konfig.variantenProperty': 'Variantenproperty darf nicht leer sein.',
    'konfig.masterGroesse': 'Master-Größe muss eine Zahl > 0 sein.',
    'konfig.masterKontur': 'Master-Kontur muss eine Zahl > 0 sein.',
    'konfig.groesseN': 'Größe „{wert}“ ist keine Zahl > 0 — Zeile verworfen.',
    'konfig.groesseNGerundet': 'Größe „{wert}“ ist keine ganze Zahl — auf {N} gerundet.',
    'konfig.groesseDoppelt': 'Größe {N} kommt mehrfach vor — Dublette verworfen.',
    'konfig.keineGroessen': 'Keine gültige Größe übrig — Standardgrößen eingesetzt.',
    'konfig.kontur': 'Kontur für {N} muss > 0 sein.',
    'konfig.keyline': 'Keyline für {klasse} muss eine Zahl > 0 sein — Standard gesetzt.',
    'konfig.keylineUnplausibel': 'Keyline {wert} für {N} px liegt außerhalb von {min}…{N}.',
    'konfig.raster': 'Raster für {N} muss 1, 0,5 oder 0,25 sein.',
    'konfig.rasterGrob': 'Grobes Raster für {N} muss gröber als das Raster sein — abgeschaltet.',
    'konfig.radiusModus': 'Radius-Modus für {N} unbekannt — „proportional“ gesetzt.',
    'konfig.radiusWert': 'Radius-Wert für {N} muss eine Zahl ≥ 0 sein — 1 gesetzt.',
    'konfig.radiusMin': 'Radius-Minimum für {N} muss eine Zahl ≥ 0 sein — 0 gesetzt.',
    'konfig.mehrereStandard': 'Mehrere Standardgrößen — nur die erste bleibt.',
    'konfig.keinStandard': 'Keine Standardgröße gesetzt — die größte wurde gewählt.',
    'konfig.farbModus': 'Farbmodus unbekannt — auf Standard zurückgesetzt.',
    'konfig.farbHex': 'Hex-Farbe ungültig — #444444 gesetzt.',
    'konfig.farbVariable': 'Keine Farbvariable gewählt — Modus „Source“ gesetzt.',

    // --- Bau-Protokoll ---
    'und': 'und',
    'bau.kopf': '{name} ({klasse}) → {liste}',
    'bau.mass': '{N}: {ist}/{soll}',
    'bau.ohneFit': '???',
    'bau.gerastet': ' ({n} Kanten gerastet)',
    'bau.geschuetzt': ' · {n} Knoten formgeschützt',
    'bau.aa': ' · AA {aa}% · Fehler {w} vs {g}',
    'bau.trend': ' · zuvor {vor} {pfeil}',
    'bau.hinting': ' → Hinting −{delta}%',
    'bau.gleichwertig': ' → gleichwertig',
    'bau.snapOhneWirkung': ' — Snapping ohne Wirkung, Fit-Geometrie behalten',
    'bau.sourceMisst': ' — Source misst {ist} statt {soll}',
    'bau.strokeAbgelegt': ' · Stroke-Fassung abgelegt',
    'bau.neuesSet': ' — NEUES Set, bitte einsortieren + Suchbegriffe in die Beschreibung',

    // --- Set-Beschreibung ---
    'set.beschreibung': 'Icon {name} in {groessen} px. Größe über die Property {prop}. Geflattet — ein Pfad, keine Kontur.',
    'set.suchbegriffe': '{basis}\n\nSuchbegriffe: {kw}',

    // --- Audit ---
    'audit.keineSource': '{name}: keine Source',
    'audit.keinSet': '{name}: kein Library-Set',
    'audit.schiefeKante': '{name}: schiefe Kante {wert} — in der Source begradigen',
    'audit.veraltet': '{name}: Source geändert seit letztem Build — neu durchziehen',
    'audit.keyline': '{name} {klasse}/{N}: {ist} statt {soll}',
    'audit.knoten': '{name}/{N}: {n} Knoten statt 1',
    'audit.typ': '{name}/{N}: {typ} statt VECTOR',
    'audit.restkontur': '{name}/{N}: Restkontur vorhanden',
    'audit.farbe': '{name}/{N}: Farbe nicht an die Variable gebunden',
    'audit.luecke': '{name}/{N}: Zwischenraum {wert} px — verschlammt bei 1×',
    'audit.laeuft': 'Audit läuft …',

    // --- Fazit / Status ---
    'fazit.neuGebaut': 'neu gebaut',
    'fazit.audit': 'Audit: {treffer}/{gesamt} auf der Keyline · gerade Kanten auf dem Raster: {rAuf}/{rGesamt}{veraltet}',
    'fazit.veraltet': ' · VERALTET: {n}',
    'fazit.alle': '{ok}/{n} gebaut · Keyline {treffer}/{gesamt} · Raster {rAuf}/{rGesamt}{veraltet}',
    'fazit.abgebrochen': 'Abgebrochen: {grund}',
    'fazit.abgebrochen2': 'Abgebrochen nach {i}/{n} — Teilergebnisse stehen im Protokoll.',
    'log.fehler': 'Fehler: {grund}',
    'log.klasseGesetzt': '{name}: Klasse auf {klasse} gesetzt.',
    'log.konfigGespeichert': 'Konfiguration gespeichert.',
    'log.konfigZurueck': 'Konfiguration auf Profil „{profil}“ zurückgesetzt.',
    'log.undo': 'Cmd+Z nimmt „{name}“ zurück.',
    'log.undoBatch': '{n} Icons gebaut — Cmd+Z nimmt je ein Icon zurück.',
    'log.beispielAngelegt': 'Beispiel-Icon „{name}“ angelegt und gebaut.',

    // --- Profile ---
    'profil.zds.titel': 'ZEIT Design System',
    'profil.zds.beschreibung': 'Das ZDS-Board: 72-px-Master, Größen 14/18/24, Farbe an die Variable Text/70 gebunden.',
    'profil.generic.titel': 'Allgemein',
    'profil.generic.beschreibung': 'Neutraler Start für ein beliebiges File: 24-px-Master, Größen 16/20/24, Farbe aus der Source.',
    'profil.material.titel': 'Material Design',
    'profil.material.beschreibung': 'Material Design Icons: 24-px-Master, Größen 18/24/36/48, Keyline 18 im Quadrat.',
    'profil.lucide.titel': 'Lucide / Feather',
    'profil.lucide.beschreibung': 'Lucide- und Feather-Stil: 24-px-Master, randnahe Keyline 22, Größen 16/20/24/32/48.',
    'profil.apple.titel': 'Apple SF-nah',
    'profil.apple.beschreibung': 'An SF Symbols angelehnte Staffel: 28-px-Master, Größen 16/20/24/28/32.'
  },

  en: {
    'fehler.KEIN_ZIEL': 'Nothing suitable selected.',
    'hinweis.KEIN_ZIEL': 'Select an icon card, a variant set or a master component.',
    'fehler.KEINE_SOURCE': '{name}: no source component found.',
    'hinweis.KEINE_SOURCE': 'A component of {mass} × {mass} px is expected.',
    'fehler.SOURCE_LEER': '{name}: the source contains no vectors.',
    'hinweis.SOURCE_LEER': 'Without drawing layers there is no keyline to measure.',
    'fehler.SOURCE_MASS': '{name}: source measures {ist}, expected {soll}.',
    'hinweis.SOURCE_MASS': 'The master size lives in Settings under “Master”. Resize the source or adjust the configuration.',
    'fehler.FIT_FEHLT': '{name} / {N}: could not fit the keyline.',
    'hinweis.FIT_FEHLT': 'The bisection found no size — usually the render bounds are empty (hidden or empty layers).',
    'fehler.VARIANTE_FEHLT': '{name}: variant {variante} was missing from the set and has been added.',
    'hinweis.VARIANTE_FEHLT': 'The new variant has no instances in the file yet.',
    'fehler.FARBE_UNAUFLOESBAR': 'The configured colour variable could not be resolved.',
    'hinweis.FARBE_UNAUFLOESBAR': 'Library unavailable or variable deleted. A plain grey is used instead.',
    'fehler.UNION_FALLBACK': '{name} / {N}: union failed, flattened directly.',
    'hinweis.UNION_FALLBACK': 'Overlapping strokes may remain visible as edges.',
    'fehler.KLASSE_GERATEN': '{name}: class {klasse} was guessed.',
    'hinweis.KLASSE_GERATEN': 'Derived from the aspect ratio. You can set the class in the selection row.',
    'fehler.SEITEN_FEHLEN': 'Pages “Icons”/“Source” not found — wrong file?',
    'hinweis.SEITEN_FEHLEN': 'The ZDS profile expects that board. Switch to “Free” in the settings.',
    'fehler.KARTE_OHNE_SET': '{name}: no library set yet — a new one will be created.',
    'hinweis.KARTE_OHNE_SET': 'Afterwards file it away and add keywords to the description.',
    'fehler.GROESSE_UNBEKANNT': 'Size {N} is not in the configuration.',
    'hinweis.GROESSE_UNBEKANNT': 'Add it in Settings under “Sizes”.',
    'fehler.SET_HAT_FREMDE_VARIANTE': '{name}: variant {variante} is not in the configuration.',
    'hinweis.SET_HAT_FREMDE_VARIANTE': 'It is left alone — neither built nor deleted.',
    'fehler.FRAME_ZU_KOMPONENTE': '{name}: frame was converted into a component.',
    'hinweis.FRAME_ZU_KOMPONENTE': 'Only components can be instantiated and therefore fitted.',
    'fehler.KONFIG_UNGUELTIG': 'The configuration could not be saved: {grund}',
    'fehler.BIBLIOTHEK_UNZUGAENGLICH': 'Team libraries cannot be queried: {grund}',
    'hinweis.BIBLIOTHEK_UNZUGAENGLICH': 'Requires the manifest permission “teamlibrary” and a Figma account with access to the library. For development plugins, re-import the plugin via “Import plugin from manifest” after manifest changes.',
    'fehler.KEINE_BIBLIOTHEKEN': 'No variable collections from libraries found ({lokal} local color variables).',
    'hinweis.KEINE_BIBLIOTHEKEN': 'Figma only returns collections from libraries enabled in this file under Assets → Libraries. Enable the library, then “Refresh”.',
    'hinweis.KONFIG_UNGUELTIG': 'Check the highlighted fields in the “Settings” tab.',
    'fehler.GESPERRT': '{name}: source, set or variant is locked.',
    'hinweis.GESPERRT': 'Remove the lock in the layers panel (click the padlock) and run again.',
    'fehler.FRAME_NICHT_ERLAUBT': '{name}: the frame is not converted into a component automatically.',
    'hinweis.FRAME_NICHT_ERLAUBT': 'Enable Settings → Writing → “Convert frame”, or turn the frame into a component yourself with Cmd+Alt+K.',
    'fehler.STROKEHEIM_AUS': '{name}: stroke version skipped — creating a storage frame is not allowed.',
    'hinweis.STROKEHEIM_AUS': 'Enable Settings → Writing → “Create stroke storage”.',
    'fehler.ABGEBROCHEN': 'Run aborted after {i}/{n}.',
    'hinweis.ABGEBROCHEN': 'Partial results are in the log; Cmd+Z undoes each built step individually.',
    'fehler.EXPORT_FEHLT': '{name} has no set — nothing to export.',
    'hinweis.EXPORT_FEHLT': 'Build it first, then export.',

    'konfig.adapter': 'Unknown adapter — reset to default.',
    'konfig.sprache': 'Unknown language — reset to default.',
    'konfig.variantenProperty': 'The variant property must not be empty.',
    'konfig.masterGroesse': 'Master size must be a number > 0.',
    'konfig.masterKontur': 'Master stroke must be a number > 0.',
    'konfig.groesseN': 'Size “{wert}” is not a number > 0 — row dropped.',
    'konfig.groesseNGerundet': 'Size “{wert}” is not a whole number — rounded to {N}.',
    'konfig.groesseDoppelt': 'Size {N} appears more than once — duplicate dropped.',
    'konfig.keineGroessen': 'No valid size left — default sizes inserted.',
    'konfig.kontur': 'Stroke for {N} must be > 0.',
    'konfig.keyline': 'Keyline for {klasse} must be a number > 0 — default used.',
    'konfig.keylineUnplausibel': 'Keyline {wert} for {N} px is outside {min}…{N}.',
    'konfig.raster': 'Grid for {N} must be 1, 0.5 or 0.25.',
    'konfig.rasterGrob': 'Coarse grid for {N} must be coarser than the grid — disabled.',
    'konfig.radiusModus': 'Unknown radius mode for {N} — set to “proportional”.',
    'konfig.radiusWert': 'Radius value for {N} must be a number ≥ 0 — set to 1.',
    'konfig.radiusMin': 'Radius minimum for {N} must be a number ≥ 0 — set to 0.',
    'konfig.mehrereStandard': 'Several default sizes — only the first one kept.',
    'konfig.keinStandard': 'No default size set — the largest one was chosen.',
    'konfig.farbModus': 'Unknown colour mode — reset to default.',
    'konfig.farbHex': 'Invalid hex colour — set to #444444.',
    'konfig.farbVariable': 'No colour variable selected — mode set to “source”.',

    'und': 'and',
    'bau.kopf': '{name} ({klasse}) → {liste}',
    'bau.mass': '{N}: {ist}/{soll}',
    'bau.ohneFit': '???',
    'bau.gerastet': ' ({n} edges snapped)',
    'bau.geschuetzt': ' · {n} nodes shape-protected',
    'bau.aa': ' · AA {aa}% · error {w} vs {g}',
    'bau.trend': ' · previously {vor} {pfeil}',
    'bau.hinting': ' → hinting −{delta}%',
    'bau.gleichwertig': ' → equivalent',
    'bau.snapOhneWirkung': ' — snapping had no effect, kept the fit geometry',
    'bau.sourceMisst': ' — source measures {ist} instead of {soll}',
    'bau.strokeAbgelegt': ' · stroke version stored',
    'bau.neuesSet': ' — NEW set, please file it and add keywords to the description',

    'set.beschreibung': 'Icon {name} at {groessen} px. Size via the {prop} property. Flattened — one path, no stroke.',
    'set.suchbegriffe': '{basis}\n\nKeywords: {kw}',

    'audit.keineSource': '{name}: no source',
    'audit.keinSet': '{name}: no library set',
    'audit.schiefeKante': '{name}: skewed edge {wert} — straighten it in the source',
    'audit.veraltet': '{name}: source changed since the last build — rebuild it',
    'audit.keyline': '{name} {klasse}/{N}: {ist} instead of {soll}',
    'audit.knoten': '{name}/{N}: {n} nodes instead of 1',
    'audit.typ': '{name}/{N}: {typ} instead of VECTOR',
    'audit.restkontur': '{name}/{N}: leftover stroke',
    'audit.farbe': '{name}/{N}: colour not bound to the variable',
    'audit.luecke': '{name}/{N}: gap of {wert} px — muddy at 1×',
    'audit.laeuft': 'Audit running …',

    'fazit.neuGebaut': 'rebuilt',
    'fazit.audit': 'Audit: {treffer}/{gesamt} on the keyline · straight edges on the grid: {rAuf}/{rGesamt}{veraltet}',
    'fazit.veraltet': ' · OUTDATED: {n}',
    'fazit.alle': '{ok}/{n} built · keyline {treffer}/{gesamt} · grid {rAuf}/{rGesamt}{veraltet}',
    'fazit.abgebrochen': 'Aborted: {grund}',
    'fazit.abgebrochen2': 'Aborted after {i}/{n} — partial results are in the log.',
    'log.fehler': 'Error: {grund}',
    'log.klasseGesetzt': '{name}: class set to {klasse}.',
    'log.konfigGespeichert': 'Configuration saved.',
    'log.konfigZurueck': 'Configuration reset to profile “{profil}”.',
    'log.undo': 'Cmd+Z undoes “{name}”.',
    'log.undoBatch': 'Built {n} icons — Cmd+Z undoes one icon at a time.',
    'log.beispielAngelegt': 'Example icon “{name}” created and built.',

    'profil.zds.titel': 'ZEIT Design System',
    'profil.zds.beschreibung': 'The ZDS board: 72 px master, sizes 14/18/24, colour bound to the Text/70 variable.',
    'profil.generic.titel': 'Generic',
    'profil.generic.beschreibung': 'A neutral start for any file: 24 px master, sizes 16/20/24, colour taken from the source.',
    'profil.material.titel': 'Material Design',
    'profil.material.beschreibung': 'Material Design Icons: 24 px master, sizes 18/24/36/48, square keyline of 18.',
    'profil.lucide.titel': 'Lucide / Feather',
    'profil.lucide.beschreibung': 'Lucide and Feather style: 24 px master, edge-to-edge keyline of 22, sizes 16/20/24/32/48.',
    'profil.apple.titel': 'Apple SF-like',
    'profil.apple.beschreibung': 'A scale close to SF Symbols: 28 px master, sizes 16/20/24/28/32.'
  }
};

function t(key, params) {
  const buch = SPRACHEN[SPRACHE] || SPRACHEN.en;
  let s = buch[key];
  if (s === undefined) s = SPRACHEN.en[key];
  if (s === undefined) return key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (ganz, name) =>
    (params[name] === undefined || params[name] === null) ? ganz : String(params[name]));
}

// 'auto' → Browsersprache der UI, sonst die eingestellte Sprache.
function spracheSetzen(cfgSprache, uiSprache) {
  let s = cfgSprache;
  if (s !== 'de' && s !== 'en') s = /^de/i.test(String(uiSprache || '')) ? 'de' : 'en';
  SPRACHE = s;
  return s;
}

// „14, 18 und 24“
function listeUnd(werte) {
  const a = werte.map(String);
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' ' + t('und') + ' ' + a[a.length - 1];
}
