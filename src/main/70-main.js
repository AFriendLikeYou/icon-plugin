// ===========================================================================
// 70-main.js — UI zeigen, Nachrichten beantworten, Auswahl melden.
// Reihenfolge beim Start: UI sendet `init` → Konfig laden, Adapter wählen,
// dann `konfig`, `einstellungen`, `auswahl`, `fertig`.
// ===========================================================================

let aktivesZiel = null;
let bereit = false;
let auswahlHaengt = false;
let uiSprache = null;   // von der UI beim init gemeldet (navigator.language), für Sprache "auto"

// Abbruch-Flag für die langen Schleifen (alle, audit, bericht, exportieren).
// Es wird zwischen zwei Icons geprüft — ein laufendes Icon wird fertig gebaut,
// damit kein halbes Set zurückbleibt.
let ABBRUCH = false;

function abbruchAktiv() { return ABBRUCH === true; }

figma.showUI(__html__, { width: 440, height: 700, themeColors: true });

async function initialisieren(uiSprache) {
  await konfigLaden();
  // Sprache erst jetzt bekannt — Prüfmeldungen darum ein zweites Mal erzeugen.
  spracheSetzen(CFG.sprache, uiSprache);
  const pruef = konfigValidieren(CFG);
  CFG = pruef.konfig;
  await adapterWaehlen(CFG);
  await farbeVariableAufloesen(CFG.farbe);
  bereit = true;
  return pruef;
}

function konfigSenden(pruef) {
  ui({
    type: 'konfig',
    konfig: CFG,
    fehler: pruef ? pruef.fehler : [],
    adapter: ADAPTER ? ADAPTER.name : null,
    profile: PROFIL_NAMEN,
    // Defensiv: läuft das Plugin gegen eine ältere 00-config.js, fehlt die Funktion.
    profilInfo: typeof konfigProfilInfo === 'function' ? konfigProfilInfo() : [],
    // Der Lizenzstatus hängt an jeder Konfig-Antwort, damit die UI ihn nie
    // separat nachfragen muss (Abschnitt 28.5).
    lizenz: lizenzStatus()
  });
}

// --- Merker: generischer UI-Zustand im clientStorage (Abschnitt 28.4) ------
// Werte liegen als JSON, damit auch Objekte (ersteSchritte) durchgehen.

const MERKER_PRAEFIX = 'icon-pipeline/merker/';

function merkerSchluessel(s) {
  return MERKER_PRAEFIX + String(s == null ? '' : s).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 64);
}

async function merkerSetzen(schluessel, wert) {
  try {
    await figma.clientStorage.setAsync(merkerSchluessel(schluessel),
      JSON.stringify(wert === undefined ? null : wert));
  } catch (e) {}
}

async function merkerLaden(schluessel) {
  try {
    const roh = await figma.clientStorage.getAsync(merkerSchluessel(schluessel));
    if (roh == null) return null;
    if (typeof roh !== 'string') return roh;   // älterer Stand ohne JSON
    return JSON.parse(roh);
  } catch (e) { return null; }
}

// Auswahl auflösen und melden — das Ziel wird gecacht (wie aktiveKarte in v1).
async function auswahlMelden() {
  if (!bereit || !ADAPTER) return null;
  const sel = figma.currentPage.selection[0];
  let ziel = null;
  try { ziel = sel ? await ADAPTER.aufloesen(sel) : null; } catch (e) { ziel = null; }
  aktivesZiel = ziel;
  let hatSet = false;
  if (ziel) { try { hatSet = !!(await ADAPTER.zielSet(ziel)); } catch (e) { hatSet = false; } }
  ui({
    type: 'auswahl',
    ziel: ziel ? {
      name: ziel.name, klasse: ziel.klasse, klasseQuelle: ziel.klasseQuelle,
      hatSet: hatSet, adapter: ADAPTER.name
    } : null
  });
  return ziel;
}

// selectionchange kann schnell feuern; Auflösung ist async → entprellen.
function auswahlAnstossen() {
  if (auswahlHaengt) return;
  auswahlHaengt = true;
  setTimeout(() => { auswahlHaengt = false; auswahlMelden(); }, 0);
}

// Aktuelles Ziel neu auflösen; null → PipelineFehler KEIN_ZIEL.
async function zielVerlangen() {
  const ziel = await auswahlMelden();
  if (!ziel) throw new PipelineFehler('KEIN_ZIEL');
  return ziel;
}

// Ziel ohne Nebenwirkung auflösen (für die temporäre Vorschau: die Auswahlzeile
// soll nicht mit einer ungespeicherten Konfig überschrieben werden).
async function zielStill() {
  const sel = figma.currentPage.selection[0];
  let ziel = null;
  try { ziel = sel ? await ADAPTER.aufloesen(sel) : null; } catch (e) { ziel = null; }
  if (!ziel) throw new PipelineFehler('KEIN_ZIEL');
  return ziel;
}

// Umfang 'alle' → alle Ziele des Adapters, 'namen' → die genannten,
// sonst das aktuell ausgewählte.
async function zieleFuer(umfang, namen) {
  if (umfang === 'alle') return await ADAPTER.alle();
  if (umfang === 'namen') return (await zieleNachNamen(namen)).ziele;
  return [await zielVerlangen()];
}

// Namen auf Ziele abbilden — in der Reihenfolge der Anfrage, Unbekanntes
// kommt als `fehlend` zurück (die UI hat die Namen aus dem Bericht).
async function zieleNachNamen(namen) {
  const gesucht = (Array.isArray(namen) ? namen : []).map(n => String(n));
  const alle = await ADAPTER.alle();
  const ziele = [], fehlend = [];
  for (const n of gesucht) {
    const z = alle.find(x => x.name === n);
    if (z) { if (ziele.indexOf(z) < 0) ziele.push(z); }
    else fehlend.push(n);
  }
  return { ziele: ziele, fehlend: fehlend };
}

async function fokussieren(node) {
  if (!node) return;
  try {
    let seite = node;
    while (seite && seite.type !== 'PAGE') seite = seite.parent;
    if (seite && seite !== figma.currentPage) await figma.setCurrentPageAsync(seite);
    figma.viewport.scrollAndZoomIntoView([node]);
  } catch (e) {}
}

function fazitAbgebrochen(i, n) {
  melden('warn', 'ABGEBROCHEN', { i: i, n: n });
  ui({ type: 'fazit', gut: false, text: t('fazit.abgebrochen2', { i: i, n: n }) });
}

figma.ui.onmessage = async m => {
  // Messwerte kommen mitten im Bau zurück — nie durch den Try/Fertig-Block.
  if (m.type === 'messwert') { messwertEinloesen(m.id, m.werte); return; }

  // Abbruch muss ankommen, WÄHREND eine Schleife läuft — also kein 'fertig'
  // und keine Initialisierung, nur das Flag setzen.
  if (m.type === 'abbrechen') {
    ABBRUCH = true;
    logZeile('info', t('log.abbruchAngefordert'));
    return;
  }

  try {
    if (m.type === 'init') {
      uiSprache = m.sprache || null;
      const pruef = await initialisieren(uiSprache);
      konfigSenden(pruef);
      const sch = await schalterLaden();
      ui({ type: 'einstellungen', snap: sch.snap, stroke: sch.stroke, trockenlaufEinzel: sch.trockenlaufEinzel });
      await auswahlMelden();
      figma.on('selectionchange', auswahlAnstossen);
      ui({ type: 'fertig' });
      return;
    }

    if (!bereit) await initialisieren(null);

    if (m.type === 'einstellung') {
      await schalterSpeichern(m.snap, m.stroke, m.trockenlaufEinzel);
      return; // kein 'fertig' — darf einen laufenden Batch nicht entsperren
    }

    // --- Merker: Zustandsablage der UI, antwortet ohne 'fertig' -----------
    if (m.type === 'merkerSetzen') {
      await merkerSetzen(m.schluessel, m.wert);
      return;
    }

    if (m.type === 'merkerLaden') {
      const wert = await merkerLaden(m.schluessel);
      ui({ type: 'merker', schluessel: m.schluessel, wert: wert });
      return;
    }

    // --- Lizenz -----------------------------------------------------------
    if (m.type === 'lizenzStatus') { lizenzSenden(); return; }

    if (m.type === 'lizenzKaufen') {
      await lizenzKaufen(m.grund);
      lizenzSenden();
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'lizenzDebug') {
      await lizenzDebugSetzen(m.status);
      lizenzSenden();
      return;
    }

    if (m.type === 'fokus') {
      let node = null;
      if (m.nodeId) { try { node = await figma.getNodeByIdAsync(m.nodeId); } catch (e) { node = null; } }
      if (!node && aktivesZiel) node = aktivesZiel.fokusNode || aktivesZiel.src;
      await fokussieren(node);
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'konfigLaden') {
      const pruef = konfigValidieren(CFG);
      konfigSenden(pruef);
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'konfigSpeichern') {
      // Eine importierte Konfig ist eine Vollversions-Funktion; das normale
      // Speichern aus dem Formular bleibt frei.
      if (m.quelle === 'import') await lizenzPruefen('konfigImport');
      const pruef = await konfigSpeichern(m.konfig);
      spracheSetzen(CFG.sprache, m.sprache || uiSprache);
      await adapterWaehlen(CFG);
      CTX.farbVariable = null; CTX.farbSchluessel = null;
      await farbeVariableAufloesen(CFG.farbe);
      konfigSenden(pruef);
      logZeile('ok', t('log.konfigGespeichert'));
      await auswahlMelden();
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'konfigZuruecksetzen') {
      const profil = PROFIL_NAMEN.indexOf(m.profil) >= 0 ? m.profil : 'generic';
      const pruef = await konfigSpeichern(konfigDefaults(profil));
      spracheSetzen(CFG.sprache, m.sprache || uiSprache);
      await adapterWaehlen(CFG);
      CTX.farbVariable = null; CTX.farbSchluessel = null;
      await farbeVariableAufloesen(CFG.farbe);
      konfigSenden(pruef);
      logZeile('ok', t('log.konfigZurueck', { profil: profil }));
      await auswahlMelden();
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'farbenListen') {
      const fl = await farbenListen();
      ui(Object.assign({ type: 'farben' }, fl));
      const dg = fl.diagnose || {};
      if (dg.bibFehler) melden('warn', 'BIBLIOTHEK_UNZUGAENGLICH', { grund: dg.bibFehler });
      else if (!dg.kollektionen) melden('info', 'KEINE_BIBLIOTHEKEN', { lokal: fl.lokal.length });
      (dg.kollektionsFehler || []).forEach(z => logZeile('warn', z));
      ui({ type: 'fertig' });
      return;
    }

    // Werte einzelner Library-Variablen nachladen (max. 40 je Aufruf).
    if (m.type === 'farbenWerte') {
      const werte = await farbenWerte(m.keys);
      ui({ type: 'farbenWerteErgebnis', werte: werte });
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'farbePruefen') {
      const r = await farbePruefen(m.farbe);
      ui({ type: 'farbeGeprueft', ok: r.ok, hex: r.hex, name: r.name });
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'klasseSetzen') {
      const ziel = await zielVerlangen();
      if (KLASSEN.indexOf(m.klasse) >= 0 && ziel.src) {
        try { ziel.src.setPluginData(KLASSE_SCHLUESSEL, m.klasse); } catch (e) {}
        logZeile('ok', t('log.klasseGesetzt', { name: ziel.name, klasse: m.klasse }), ziel.src.id,
          { name: ziel.name, schwere: 'info' });
      }
      await auswahlMelden();
      ui({ type: 'fertig' });
      return;
    }

    // --- Trockenlauf: ändert nichts, beantwortet nur „was würde passieren“ ---
    if (m.type === 'planen') {
      ABBRUCH = false;
      const umfang = m.umfang === 'alle' ? 'alle' : 'auswahl';
      const ziele = await zieleFuer(umfang);
      const p = await planen(ziele, !!m.snap, !!m.stroke);
      ui({ type: 'plan', eintraege: p.eintraege, zusammenfassung: p.zusammenfassung, umfang: umfang });
      logZeile('info', t('log.planFertig', { n: p.eintraege.length }));
    }

    if (m.type === 'run') {
      ABBRUCH = false;
      const ziel = await zielVerlangen();
      const text = await einIcon(ziel, !!m.snap, !!m.stroke);
      logZeile('ok', text, ziel.fokusNode ? ziel.fokusNode.id : null,
        { name: ziel.name, schwere: 'info' });
      try { figma.commitUndo(); } catch (e) {}
      logZeile('info', t('log.undo', { name: ziel.name }), null, { name: ziel.name, schwere: 'info' });
      ui({ type: 'fazit', gut: true, text: t('fazit.neuGebaut'), beiAuswahl: true });
    }

    if (m.type === 'vorschau') {
      const ziel = await zielVerlangen();
      const d = await vorschau(ziel, !!m.snap);
      ui(Object.assign({ type: 'diff', snap: !!m.snap }, d));
    }

    // --- Vorschau mit ungespeicherter Konfig: CFG temporär, immer zurück ---
    if (m.type === 'vorschauMit') {
      const pruef = konfigValidieren(m.konfig);
      const merkCfg = CFG;
      try {
        CFG = pruef.konfig;
        CTX.farbVariable = null; CTX.farbSchluessel = null;
        await farbeVariableAufloesen(CFG.farbe);
        const ziel = await zielStill();
        const d = await vorschau(ziel, !!m.snap, true);   // Source nicht normalisieren (ungespeicherte Konfig)
        ui(Object.assign({ type: 'diff', snap: !!m.snap, temporaer: true }, d));
      } finally {
        CFG = merkCfg;
        CTX.farbVariable = null; CTX.farbSchluessel = null;
        await farbeVariableAufloesen(CFG.farbe);
      }
    }

    if (m.type === 'audit') {
      ABBRUCH = false;
      const r = await audit();
      r.abw.forEach(abwLog);
      if (r.abgebrochen) fazitAbgebrochen(r.geprueft, r.n);
      else ui({
        type: 'fazit', gut: r.abw.length === 0,
        text: t('fazit.audit', {
          treffer: r.treffer, gesamt: r.gesamt, rAuf: r.rasterAuf, rGesamt: r.rasterGesamt,
          veraltet: r.veraltet ? t('fazit.veraltet', { n: r.veraltet }) : ''
        })
      });
    }

    if (m.type === 'alle') {
      ABBRUCH = false;
      await lizenzPruefen('alle');
      const ziele = await ADAPTER.alle();
      let ok = 0, i = 0, abgebrochen = false;
      for (; i < ziele.length; i++) {
        if (abbruchAktiv()) { abgebrochen = true; break; }
        ui({ type: 'progress', i: i + 1, n: ziele.length, name: ziele[i].name });
        try {
          const text = await einIcon(ziele[i], !!m.snap, !!m.stroke);
          ok++; logZeile('ok', text, ziele[i].fokusNode ? ziele[i].fokusNode.id : null,
            { name: ziele[i].name, schwere: 'info' });
        } catch (e) {
          ui(fehlerLog(e));
        }
        try { figma.commitUndo(); } catch (e) {}
        await tick();
      }
      // Ein Undo-Schritt je Icon — das gehört ins Protokoll, sonst sucht man danach.
      if (i) logZeile('info', t('log.undoBatch', { n: i }));

      if (abgebrochen) {
        fazitAbgebrochen(i, ziele.length);
      } else {
        logZeile('info', t('audit.laeuft'));
        const r = await audit();
        r.abw.forEach(abwLog);
        if (r.abgebrochen) fazitAbgebrochen(r.geprueft, r.n);
        else ui({
          type: 'fazit', gut: ok === ziele.length && r.abw.length === 0,
          text: t('fazit.alle', {
            ok: ok, n: ziele.length, treffer: r.treffer, gesamt: r.gesamt,
            rAuf: r.rasterAuf, rGesamt: r.rasterGesamt,
            veraltet: r.veraltet ? t('fazit.veraltet', { n: r.veraltet }) : ''
          })
        });
      }
    }

    // --- Qualitätsbericht -------------------------------------------------
    if (m.type === 'bericht') {
      ABBRUCH = false;
      await lizenzPruefen('bericht');
      logZeile('info', t('log.berichtLaeuft'));
      const ziele = await ADAPTER.alle();
      const b = await bericht(ziele);
      ui({ type: 'bericht', zeilen: b.zeilen, abw: b.abw, zusammenfassung: b.zusammenfassung, zeit: b.zeit });
      b.abw.forEach(abwLog);
      const z = b.zusammenfassung;
      if (b.abgebrochen) fazitAbgebrochen(b.geprueft, b.n);
      else ui({
        type: 'fazit', gut: z.keylineOk === z.keylineGesamt && !z.ohneSet,
        text: t('fazit.bericht', {
          icons: z.icons,
          treue: z.treueMittel == null ? '—' : z.treueMittel.toFixed(3),
          ok: z.keylineOk, gesamt: z.keylineGesamt,
          ohneSet: z.ohneSet ? t('fazit.berichtOhneSet', { n: z.ohneSet }) : ''
        })
      });
    }

    // --- SVG-Export (die UI packt daraus das ZIP) -------------------------
    if (m.type === 'exportieren') {
      ABBRUCH = false;
      await lizenzPruefen('exportieren');
      logZeile('info', t('log.exportLaeuft'));
      const umfang = ['alle', 'namen'].indexOf(m.umfang) >= 0 ? m.umfang : 'auswahl';
      let ziele, unbekannt = [];
      if (umfang === 'namen') {
        const r = await zieleNachNamen(m.namen);
        ziele = r.ziele; unbekannt = r.fehlend;
        unbekannt.forEach(n => melden('warn', 'EXPORT_FEHLT', { name: n }));
      } else {
        ziele = await zieleFuer(umfang);
      }
      const e = await exportieren(ziele);
      e.fehlend = unbekannt.concat(e.fehlend);
      ui({ type: 'exportDaten', dateien: e.dateien, fehlend: e.fehlend, umfang: umfang });
      if (e.abgebrochen) fazitAbgebrochen(e.geprueft, e.n);
      else ui({
        type: 'fazit', gut: e.fehlend.length === 0,
        text: t('fazit.export', {
          dateien: e.dateien.length, icons: e.icons,
          fehlend: e.fehlend.length ? t('fazit.exportFehlend', { n: e.fehlend.length }) : ''
        })
      });
    }

    // --- Übersicht: Startseite der UI, Liste aller Icons im File ----------
    if (m.type === 'uebersicht') {
      ABBRUCH = false;
      const ziele = await ADAPTER.alle();
      const u = await uebersicht(ziele);
      ui({
        type: 'uebersicht', eintraege: u.eintraege, zusammenfassung: u.zusammenfassung,
        adapter: ADAPTER ? ADAPTER.name : null
      });
      if (u.abgebrochen) fazitAbgebrochen(u.geprueft, u.n);
    }

    // --- Beispiel-Icon für den Leerzustand --------------------------------
    if (m.type === 'beispielAnlegen') {
      ABBRUCH = false;
      await beispielAnlegen(!!m.snap);
      await auswahlMelden();
    }
  } catch (e) {
    ui(fehlerLog(e));
    ui({ type: 'fazit', gut: false, text: t('fazit.abgebrochen', { grund: (e && e.message) || String(e) }) });
  }
  ui({ type: 'fertig' });
};
