// ===========================================================================
// 70-main.js — UI zeigen, Nachrichten beantworten, Auswahl melden.
// Reihenfolge beim Start: UI sendet `init` → Konfig laden, Adapter wählen,
// dann `konfig`, `einstellungen`, `auswahl`, `fertig`.
// ===========================================================================

let aktivesZiel = null;
let bereit = false;
let auswahlHaengt = false;
let uiSprache = null;   // von der UI beim init gemeldet (navigator.language), für Sprache "auto"

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
    profile: PROFIL_NAMEN
  });
}

// Auswahl auflösen und melden — das Ziel wird gecacht (wie aktiveKarte in v1).
async function auswahlMelden() {
  if (!bereit || !ADAPTER) return null;
  const sel = figma.currentPage.selection[0];
  let ziel = null;
  try { ziel = sel ? await ADAPTER.aufloesen(sel) : null; } catch (e) { ziel = null; }
  aktivesZiel = ziel;
  let hatSet = false;
  if (ziel) { try { hatSet = !!ADAPTER.zielSet(ziel); } catch (e) { hatSet = false; } }
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

async function fokussieren(node) {
  if (!node) return;
  try {
    let seite = node;
    while (seite && seite.type !== 'PAGE') seite = seite.parent;
    if (seite && seite !== figma.currentPage) await figma.setCurrentPageAsync(seite);
    figma.viewport.scrollAndZoomIntoView([node]);
  } catch (e) {}
}

figma.ui.onmessage = async m => {
  // Messwerte kommen mitten im Bau zurück — nie durch den Try/Fertig-Block.
  if (m.type === 'messwert') { messwertEinloesen(m.id, m.werte); return; }

  try {
    if (m.type === 'init') {
      uiSprache = m.sprache || null;
      const pruef = await initialisieren(uiSprache);
      konfigSenden(pruef);
      const sch = await schalterLaden();
      ui({ type: 'einstellungen', snap: sch.snap, stroke: sch.stroke });
      await auswahlMelden();
      figma.on('selectionchange', auswahlAnstossen);
      ui({ type: 'fertig' });
      return;
    }

    if (!bereit) await initialisieren(null);

    if (m.type === 'einstellung') {
      await schalterSpeichern(m.snap, m.stroke);
      return; // kein 'fertig' — darf einen laufenden Batch nicht entsperren
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
      ui(Object.assign({ type: 'farben' }, await farbenListen()));
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
        logZeile('ok', t('log.klasseGesetzt', { name: ziel.name, klasse: m.klasse }), ziel.src.id);
      }
      await auswahlMelden();
      ui({ type: 'fertig' });
      return;
    }

    if (m.type === 'run') {
      const ziel = await zielVerlangen();
      const text = await einIcon(ziel, !!m.snap, !!m.stroke);
      logZeile('ok', text, ziel.fokusNode ? ziel.fokusNode.id : null);
      ui({ type: 'fazit', gut: true, text: t('fazit.neuGebaut'), beiAuswahl: true });
    }

    if (m.type === 'vorschau') {
      const ziel = await zielVerlangen();
      const d = await vorschau(ziel, !!m.snap);
      ui(Object.assign({ type: 'diff', snap: !!m.snap }, d));
    }

    if (m.type === 'audit') {
      const r = await audit();
      r.abw.forEach(z => logZeile('warn', z));
      ui({
        type: 'fazit', gut: r.abw.length === 0,
        text: t('fazit.audit', {
          treffer: r.treffer, gesamt: r.gesamt, rAuf: r.rasterAuf, rGesamt: r.rasterGesamt,
          veraltet: r.veraltet ? t('fazit.veraltet', { n: r.veraltet }) : ''
        })
      });
    }

    if (m.type === 'alle') {
      const ziele = await ADAPTER.alle();
      let ok = 0;
      for (let i = 0; i < ziele.length; i++) {
        ui({ type: 'progress', i: i + 1, n: ziele.length, name: ziele[i].name });
        try {
          const text = await einIcon(ziele[i], !!m.snap, !!m.stroke);
          ok++; logZeile('ok', text, ziele[i].fokusNode ? ziele[i].fokusNode.id : null);
        } catch (e) {
          ui(fehlerLog(e));
        }
        try { figma.commitUndo(); } catch (e) {}
        await tick();
      }
      logZeile('info', t('audit.laeuft'));
      const r = await audit();
      r.abw.forEach(z => logZeile('warn', z));
      ui({
        type: 'fazit', gut: ok === ziele.length && r.abw.length === 0,
        text: t('fazit.alle', {
          ok: ok, n: ziele.length, treffer: r.treffer, gesamt: r.gesamt,
          rAuf: r.rasterAuf, rGesamt: r.rasterGesamt,
          veraltet: r.veraltet ? t('fazit.veraltet', { n: r.veraltet }) : ''
        })
      });
    }
  } catch (e) {
    ui(fehlerLog(e));
    ui({ type: 'fazit', gut: false, text: t('fazit.abgebrochen', { grund: (e && e.message) || String(e) }) });
  }
  ui({ type: 'fertig' });
};
