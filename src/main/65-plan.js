// ===========================================================================
// 65-plan.js — Trockenlauf (Abschnitt 15) und Sperr-Prüfung.
// `planen` fasst zusammen, was ein Bau ändern WÜRDE, und fasst dabei nichts an:
// keine Komponente, kein Frame, kein pluginData. Alles, was 60-build mutiert,
// steht hier nur als Aussage.
// ===========================================================================

// Ab dieser Knotenzahl im File wird nicht mehr nach Instanzen gesucht — das
// Zählen kostet sonst mehr Zeit als der ganze Bau.
const PLAN_KNOTEN_GRENZE = 50000;

// --- Sperren ---------------------------------------------------------------
// Gesperrt ist ein Ziel, wenn die Source, das Set oder eine Variante `locked` ist.
// (Figma vererbt `locked` nicht nach unten; wir prüfen die drei Ebenen einzeln.)
function gesperrtInfo(ziel, set) {
  const kandidaten = [];
  if (ziel && ziel.src) kandidaten.push(ziel.src);
  if (ziel && ziel.frame) kandidaten.push(ziel.frame);
  if (set) {
    kandidaten.push(set);
    try { set.children.forEach(c => kandidaten.push(c)); } catch (e) {}
  }
  for (const k of kandidaten) {
    let l = false;
    try { l = !!k.locked; } catch (e) { l = false; }
    if (l) return { gesperrt: true, nodeId: k.id || null };
  }
  return { gesperrt: false, nodeId: null };
}

function gesperrtPruefen(ziel, set) {
  const g = gesperrtInfo(ziel, set);
  if (g.gesperrt) throw new PipelineFehler('GESPERRT', { name: ziel.name }, g.nodeId);
}

// --- Instanzen zählen ------------------------------------------------------
// Ergebnis: Map(KomponentenId → Anzahl Instanzen) oder null, wenn das File zu
// groß ist bzw. eine Seite sich nicht durchsuchen lässt.
async function planInstanzenIndex() {
  try { await figma.loadAllPagesAsync(); } catch (e) {}
  const karte = new Map();
  let knoten = 0;
  for (const seite of figma.root.children) {
    let alle;
    try {
      try { await seite.loadAsync(); } catch (e) {}
      alle = seite.findAllWithCriteria ? seite.findAllWithCriteria({ types: ['INSTANCE'] })
                                       : seite.findAll(n => n.type === 'INSTANCE');
    } catch (e) { return null; }
    knoten += alle.length;                       // hier: Instanzen, nicht alle Knoten
    if (knoten > PLAN_KNOTEN_GRENZE) return null;
    for (const n of alle) {
      let mc = null;
      try { mc = await n.getMainComponentAsync(); } catch (e) { mc = null; }
      if (!mc) continue;
      karte.set(mc.id, (karte.get(mc.id) || 0) + 1);
    }
  }
  return karte;
}

// Instanzen eines Sets = Summe über seine Varianten.
function planInstanzenVon(karte, set) {
  if (!karte) return null;
  if (!set) return 0;
  let n = 0;
  try { set.children.forEach(c => { n += karte.get(c.id) || 0; }); } catch (e) {}
  return n;
}

// --- Trockenlauf -----------------------------------------------------------

async function planen(ziele, snap, stroke) {
  const karte = await planInstanzenIndex();
  const eintraege = [];
  const zus = {
    aendern: 0, neu: 0, fehlen: 0, gesperrt: 0,
    instanzen: karte ? 0 : null, strokeHeim: false
  };
  const mg = CFG.master.groesse;
  const darfHeim = !!(CFG.schreiben && CFG.schreiben.strokeHeimAnlegen);

  for (const ziel of ziele) {
    if (abbruchAktiv()) break;
    const warnungen = [];

    let set = null;
    try { set = await ADAPTER.zielSet(ziel); } catch (e) { set = null; }

    // Source-Lage
    if (!ziel.src) {
      if (ziel.frame) warnungen.push(t((CFG.schreiben && CFG.schreiben.frameUmwandeln)
        ? 'plan.frameWandeln' : 'plan.frameNichtErlaubt'));
      else warnungen.push(t('plan.keineSource'));
    } else if (Math.abs(ziel.src.width - mg) > 0.5 || Math.abs(ziel.src.height - mg) > 0.5) {
      warnungen.push(t('plan.sourceMass', {
        ist: Math.round(ziel.src.width * 100) / 100 + ' × ' + Math.round(ziel.src.height * 100) / 100,
        soll: mg + ' × ' + mg
      }));
    }

    // Varianten
    const vorhanden = [], fehlen = [], fremd = [];
    if (set) {
      CFG.groessen.forEach(g => {
        const da = set.children.some(c => c.name === variantenName(g.N));
        (da ? vorhanden : fehlen).push(g.N);
      });
      set.children.forEach(c => {
        const n = variantenN(c.name);
        if (n != null && !CFG.groessen.some(g => g.N === n)) fremd.push(n);
      });
    } else {
      CFG.groessen.forEach(g => fehlen.push(g.N));
    }

    const aktion = set ? 'aendern' : 'neu';
    if (set) {
      if (fehlen.length) warnungen.push(t('plan.fehlendeVarianten', { n: fehlen.length }));
      if (fremd.length) warnungen.push(t('plan.fremdeVarianten', { n: fremd.length }));
    } else {
      warnungen.push(t('plan.neuesSet'));
    }

    // Stroke-Fassungen
    if (stroke) {
      const heimDa = strokeHeimVorhanden(ziel);
      if (!heimDa && !darfHeim) warnungen.push(t('plan.strokeHeimAus'));
      if (!heimDa && darfHeim && !zus.strokeHeim) {
        zus.strokeHeim = true;
        warnungen.push(t('plan.strokeHeimNeu'));
      }
    }

    const sp = gesperrtInfo(ziel, set);
    if (sp.gesperrt) warnungen.push(t('plan.gesperrt'));

    const instanzen = planInstanzenVon(karte, set);
    if (instanzen == null) warnungen.push(t('plan.instanzenUnbekannt'));

    eintraege.push({
      name: ziel.name,
      aktion: aktion,
      klasse: ziel.klasse,
      klasseQuelle: ziel.klasseQuelle,
      varianten: { vorhanden: vorhanden, fehlen: fehlen, fremd: fremd },
      instanzen: instanzen,
      gesperrt: sp.gesperrt,
      warnungen: warnungen,
      nodeId: (ziel.fokusNode && ziel.fokusNode.id) || (ziel.src && ziel.src.id) || (set && set.id) || null
    });

    if (aktion === 'neu') zus.neu++; else { zus.aendern++; zus.fehlen += fehlen.length; }
    if (sp.gesperrt) zus.gesperrt++;
    if (zus.instanzen != null && instanzen != null) zus.instanzen += instanzen;
  }

  return { eintraege: eintraege, zusammenfassung: zus };
}
