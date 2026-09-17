// ===========================================================================
// 60-build.js — Bauen, Vorschau, Audit.
// Aus v1: baueGroesse, einIcon, vorschau, audit, messeGuete.
// Generalisiert: Schleifen über CFG.groessen, Ziele statt Karten, Adapter für
// Set/Eltern/Stroke-Heim/Nachpflege, Farbe über 50-farbe.
// ===========================================================================

// --- Güte-Messung (läuft in der UI: 1×-Rasterung gegen 8×-Referenz) --------

const messWarte = new Map();
let messZaehler = 0;

function messeGuete(paare) {
  return new Promise(res => {
    const id = ++messZaehler;
    const timer = setTimeout(() => { if (messWarte.has(id)) { messWarte.delete(id); res(null); } }, 6000);
    messWarte.set(id, werte => { clearTimeout(timer); res(werte); });
    ui({ type: 'mess', id: id, paare: paare });
  });
}

function messwertEinloesen(id, werte) {
  const r = messWarte.get(id);
  if (r) { messWarte.delete(id); r(werte); return true; }
  return false;
}

// --- Beschreibung ----------------------------------------------------------

function setBeschreibung(name) {
  return t('set.beschreibung', {
    name: name,
    groessen: listeUnd(groessenListe()),
    prop: CFG.variantenProperty
  });
}

// --- Source prüfen ---------------------------------------------------------

function quellePruefen(ziel) {
  // Frei-Modus: ein ausgewählter Frame wird erst jetzt zur Komponente (Undo-fähig, nur beim Bauen).
  if (!ziel.src && ziel.frame && !ziel.frame.removed && ziel.frame.type === 'FRAME') {
    const comp = figma.createComponentFromNode(ziel.frame);
    ziel.src = comp; ziel.fokusNode = comp; ziel.frame = null;
    melden('info', 'FRAME_ZU_KOMPONENTE', { name: ziel.name }, comp.id);
  }
  const src = ziel.src;
  if (!src) throw new PipelineFehler('KEINE_SOURCE',
    { name: ziel.name, mass: CFG.master.groesse }, ziel.fokusNode ? ziel.fokusNode.id : null);
  const g = CFG.master.groesse;
  if (Math.abs(src.width - g) > 0.5 || Math.abs(src.height - g) > 0.5) {
    // Warnung, kein Abbruch: der Keyline-Fit ist maßunabhängig, nur Radien/Hinweise beziehen sich auf den Master.
    melden('warn', 'SOURCE_MASS', {
      name: ziel.name,
      ist: Math.round(src.width * 100) / 100 + ' × ' + Math.round(src.height * 100) / 100,
      soll: g + ' × ' + g
    }, src.id);
  }
  if (!gb(src)) throw new PipelineFehler('SOURCE_LEER', { name: ziel.name }, src.id);
}

// --- Eine Größe bauen ------------------------------------------------------
// Ephemer. Bei aktivem Snapping entscheidet das AA-Orakel: beide Kandidaten
// (mit/ohne Snap) werden echt gerastert, der schärfere gewinnt.
async function baueGroesse(ziel, N, snap, strokeAuch) {
  const g = groesseCfg(N);
  const src = ziel.src;
  const kl = ziel.klasse;
  const achse = achseVon(kl);
  const soll = keylineVon(g, kl);
  const flaeche = ADAPTER.arbeitsFlaeche(ziel);
  const rc = { raster: g.raster, rasterGrob: g.rasterGrob };
  const srcPaint = CFG.farbe.modus === 'source' ? farbeSourcePaint(src) : null;

  async function bauKandidat(mitSnap) {
    const box = figma.createFrame(); flaeche.appendChild(box);
    box.name = '__fit'; box.x = -4000; box.y = -4000;
    box.resize(N, N); box.fills = []; box.clipsContent = false;
    const inst = src.createInstance(); box.appendChild(inst);
    konturSetzen(inst, g.kontur);
    const ist = fitten(box, inst, src, N, soll, achse);
    // Nur einmal melden: bei aktivem Snapping laufen zwei Kandidaten durch.
    if (ist == null && !mitSnap) melden('warn', 'FIT_FEHLT', { name: ziel.name, N: N }, src.id);
    const fSkal = inst.width / CFG.master.groesse;
    const det = inst.detachInstance();
    let runde = 0;
    while (runde++ < 12) {
      const a = det.findAll(n => n.type === 'INSTANCE' && !n.removed);
      if (!a.length) break;
      let ch = false;
      a.forEach(n => { try { if (!n.removed) { n.detachInstance(); ch = true; } } catch (e) {} });
      if (!ch) break;
    }
    await radienRegel(det, fSkal, g.radius);

    let gerastet = 0, geschuetzt = 0;
    if (mitSnap) { const r = await strokeSnap(box, N, rc); gerastet = r.bewegt; geschuetzt = r.geschuetzt; }

    // Ungeplättete Fassung sichern, bevor union/flatten die Kontur frisst.
    let strokeComp = null;
    if (strokeAuch) {
      strokeComp = figma.createComponent(); flaeche.appendChild(strokeComp);
      strokeComp.name = variantenName(N); strokeComp.resize(N, N);
      strokeComp.fills = []; strokeComp.clipsContent = true;
      const klon = det.clone();
      for (const kind of klon.children.slice()) {
        const cx = kind.x, cy = kind.y;
        strokeComp.appendChild(kind); kind.x = det.x + cx; kind.y = det.y + cy;
      }
      klon.remove();
    }

    let flat;
    try { const u = figma.union(det.children.slice(), det); flat = figma.flatten([u], det); }
    catch (e) {
      if (!mitSnap) melden('warn', 'UNION_FALLBACK', { name: ziel.name, N: N }, src.id);
      flat = figma.flatten(det.children.slice(), det);
    }
    flat.name = 'Stroke'; flat.strokes = [];
    flat.fills = [farbeZielPaint(srcPaint)];

    const fAbs = flat.absoluteBoundingBox, bAbs = box.absoluteBoundingBox;
    const fx = fAbs.x - bAbs.x, fy = fAbs.y - bAbs.y;
    box.appendChild(flat); flat.x = fx; flat.y = fy;
    det.remove();
    return { box: box, flat: flat, ist: ist, gerastet: gerastet, geschuetzt: geschuetzt, strokeComp: strokeComp };
  }

  if (!snap) return await bauKandidat(false);

  const A = await bauKandidat(true);   // mit Snapping
  const B = await bauKandidat(false);  // ohne
  let werte = null;
  try {
    A.box.clipsContent = true; B.box.clipsContent = true;
    const ex = async K2 => ({
      px1: await K2.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } }),
      px8: await K2.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 8 } })
    });
    werte = await messeGuete([await ex(A), await ex(B)]);
    A.box.clipsContent = false; B.box.clipsContent = false;
  } catch (e) {}
  let sieger = A, verlierer = B;
  if (werte && werte.length === 2) {
    const wa = werte[0], wb = werte[1];
    if (wb.fehler < wa.fehler - 1e-6 ||
        (Math.abs(wb.fehler - wa.fehler) <= 1e-6 && wb.aa < wa.aa)) { sieger = B; verlierer = A; }
  }
  if (verlierer.strokeComp) { try { verlierer.strokeComp.remove(); } catch (e) {} }
  verlierer.box.remove();
  if (werte && werte.length === 2) sieger.aaInfo = { snap: werte[0], plain: werte[1], mitSnap: sieger === A };
  return sieger;
}

// Protokollzeile einer Größe zusammensetzen (Wortlaut wie v1).
function bauZeile(b, N, soll, snap, vorher) {
  let s = t('bau.mass', {
    N: N,
    ist: b.ist == null ? t('bau.ohneFit') : b.ist.toFixed(3),
    soll: soll
  });
  if (snap && b.gerastet) s += t('bau.gerastet', { n: b.gerastet });
  if (snap && b.geschuetzt) s += t('bau.geschuetzt', { n: b.geschuetzt });
  if (b.aaInfo) {
    const w = b.aaInfo.mitSnap ? b.aaInfo.snap : b.aaInfo.plain;
    const gg = b.aaInfo.mitSnap ? b.aaInfo.plain : b.aaInfo.snap;
    const delta = gg.fehler > 1e-9 ? Math.round((1 - w.fehler / gg.fehler) * 100) : 0;
    s += t('bau.aa', { aa: w.aa, w: w.fehler.toFixed(3), g: gg.fehler.toFixed(3) });
    const vor = vorher[N];
    if (vor != null) s += t('bau.trend', {
      vor: vor.toFixed(3),
      pfeil: w.fehler < vor - 0.0005 ? '↓' : (w.fehler > vor + 0.0005 ? '↑' : '=')
    });
    s += b.aaInfo.mitSnap
      ? (delta > 0 ? t('bau.hinting', { delta: delta }) : t('bau.gleichwertig'))
      : t('bau.snapOhneWirkung');
  }
  return s;
}

// --- Ein Icon vollständig bauen -------------------------------------------

async function einIcon(ziel, snap, strokeAuch) {
  const name = ziel.name;
  quellePruefen(ziel);
  const src = ziel.src;

  await farbeVariableAufloesen(CFG.farbe);
  normalisieren(src);

  if (ziel.klasseQuelle === 'heuristik')
    melden('info', 'KLASSE_GERATEN', { name: name, klasse: ziel.klasse }, src.id);

  const kl = ziel.klasse;
  const achse = achseVon(kl);
  const istMaster = massAuf(gb(src), achse);
  const sollMaster = CFG.master.keylines[kl];
  const hinweis = (istMaster != null && Math.abs(istMaster - sollMaster) > 0.15)
    ? t('bau.sourceMisst', { ist: istMaster.toFixed(2), soll: sollMaster }) : '';

  let set = ADAPTER.zielSet(ziel);
  const neu = !set;
  if (neu && ADAPTER.name === 'zds') melden('info', 'KARTE_OHNE_SET', { name: name }, ziel.fokusNode ? ziel.fokusNode.id : null);

  let vorher = {};
  try {
    const pd = set ? JSON.parse(set.getPluginData(PD_SCHLUESSEL) || '{}') : {};
    vorher = pd.fehler || {};
  } catch (e) { vorher = {}; }

  const fehlerNeu = {};
  const frisch = [], ergebnisse = [], strokeComps = [];
  let ergaenzt = false;

  for (const g of CFG.groessen) {
    const N = g.N;
    const b = await baueGroesse(ziel, N, snap, strokeAuch);
    if (b.aaInfo) fehlerNeu[N] = (b.aaInfo.mitSnap ? b.aaInfo.snap : b.aaInfo.plain).fehler;
    if (b.strokeComp) strokeComps.push(b.strokeComp);
    ergebnisse.push(bauZeile(b, N, keylineVon(g, kl), snap, vorher));

    const fx = b.flat.x, fy = b.flat.y;
    if (set) {
      let v = set.children.find(c => c.name === variantenName(N));
      if (!v) {
        // Fehlende Variante ergänzen statt abzubrechen (v1 warf hier).
        v = figma.createComponent();
        v.name = variantenName(N); v.resize(N, N); v.fills = []; v.clipsContent = true;
        set.appendChild(v);
        ergaenzt = true;
        melden('info', 'VARIANTE_FEHLT', { name: name, variante: variantenName(N) }, set.id);
      } else {
        v.children.slice().forEach(c => c.remove());
      }
      v.appendChild(b.flat); b.flat.x = fx; b.flat.y = fy;
    } else {
      const comp = figma.createComponent();
      ADAPTER.arbeitsFlaeche(ziel).appendChild(comp);
      comp.name = variantenName(N); comp.resize(N, N); comp.fills = []; comp.clipsContent = true;
      comp.appendChild(b.flat); b.flat.x = fx; b.flat.y = fy;
      frisch.push(comp);
    }
    b.box.remove();
  }

  if (neu) {
    const eltern = ADAPTER.zielEltern(ziel);
    set = figma.combineAsVariants(frisch, eltern.node);
    set.name = name;
    staffeln(set);
    set.description = setBeschreibung(name);
    set.x = eltern.x; set.y = eltern.y;
  } else {
    if (ergaenzt) staffeln(set); else standardNachVorn(set);
    // Fremde Varianten bleiben unangetastet — nur melden.
    set.children.forEach(c => {
      const n = variantenN(c.name);
      if (n != null && !CFG.groessen.some(g => g.N === n))
        melden('warn', 'SET_HAT_FREMDE_VARIANTE', { name: name, variante: c.name }, c.id);
    });
  }

  // Stroke-Fassungen ablegen — kantenidentisch zur geflatteten Library.
  if (strokeAuch && strokeComps.length === CFG.groessen.length) {
    const heim = ADAPTER.strokeHeim(ziel);
    // Erst umziehen — combineAsVariants verlangt dieselbe Seite wie der Parent.
    strokeComps.forEach(q => heim.appendChild(q));
    const sName = '.' + name + ' · stroke';
    let sSet = heim.children.find(c => c.type === 'COMPONENT_SET' && c.name === sName);
    if (sSet) {
      // Inhalt tauschen — vorhandene Instanzen bleiben verbunden.
      for (let i = 0; i < CFG.groessen.length; i++) {
        const v = sSet.children.find(c => c.name === variantenName(CFG.groessen[i].N));
        const q = strokeComps[i];
        if (v && q) {
          v.children.slice().forEach(c => c.remove());
          q.children.slice().forEach(c => { const cx = c.x, cy = c.y; v.appendChild(c); c.x = cx; c.y = cy; });
          q.remove();
        }
      }
    } else {
      const anzahl = heim.children.filter(c => c.type === 'COMPONENT_SET').length;
      sSet = figma.combineAsVariants(strokeComps, heim);
      sSet.name = sName; staffeln(sSet);
      sSet.x = 40 + (anzahl % 8) * 150; sSet.y = 50 + Math.floor(anzahl / 8) * 90;
      if (sSet.x + 190 > heim.width || sSet.y + 140 > heim.height)
        heim.resizeWithoutConstraints(Math.max(heim.width, sSet.x + 190), Math.max(heim.height, sSet.y + 140));
    }
  }

  // Zentrale Nachpflege: Export-Settings + Fingerabdruck fürs Audit.
  set.children.forEach(v => { try { v.exportSettings = [{ format: 'SVG' }]; } catch (e) {} });
  try {
    set.setPluginData(PD_SCHLUESSEL, JSON.stringify({
      quelle: fingerabdruck(src), snap: !!snap, zeit: Date.now(),
      fehler: Object.assign({}, vorher, fehlerNeu)
    }));
  } catch (e) {}

  await ADAPTER.nachBuild(ziel, set, { neu: neu, snap: !!snap, strokeAuch: !!strokeAuch });

  return t('bau.kopf', { name: name, klasse: kl, liste: ergebnisse.join(' · ') })
    + hinweis
    + (strokeAuch ? t('bau.strokeAbgelegt') : '')
    + (neu ? t('bau.neuesSet') : '');
}

// --- Vorschau: baut ephemer, ändert nichts --------------------------------

async function vorschau(ziel, snap) {
  quellePruefen(ziel);
  const src = ziel.src;
  await farbeVariableAufloesen(CFG.farbe);
  normalisieren(src);
  const kl = ziel.klasse;
  const set = ADAPTER.zielSet(ziel);
  const zellen = [];

  for (const g of CFG.groessen) {
    const N = g.N;
    const b = await baueGroesse(ziel, N, snap, false);
    b.box.clipsContent = true;
    const neuSvg = await b.box.exportAsync({ format: 'SVG_STRING' });
    const pngNeu  = await b.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } });
    const pngNeu2 = await b.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
    const pngNeu8 = await b.box.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 8 } });
    let altSvg = null, pngAlt = null, pngAlt2 = null, pngAlt8 = null;
    if (set) {
      const v = set.children.find(c => c.name === variantenName(N));
      if (v) {
        altSvg  = await v.exportAsync({ format: 'SVG_STRING' });
        pngAlt  = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } });
        pngAlt2 = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
        pngAlt8 = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 8 } });
      }
    }
    b.box.remove();
    zellen.push({
      N: N, kontur: g.kontur, raster: g.raster, radius: g.radius,
      alt: altSvg, neu: neuSvg,
      pngNeu: pngNeu, pngNeu2: pngNeu2, pngNeu8: pngNeu8,
      pngAlt: pngAlt, pngAlt2: pngAlt2, pngAlt8: pngAlt8,
      ist: b.ist, soll: keylineVon(g, kl), gerastet: b.gerastet, guete: b.aaInfo || null
    });
  }
  return { name: ziel.name, klasse: kl, kl: kl, zellen: zellen };
}

// --- Audit -----------------------------------------------------------------

async function audit() {
  let treffer = 0, gesamt = 0, rasterAuf = 0, rasterGesamt = 0, veraltet = 0;
  const abw = [];
  const ziele = await ADAPTER.alle();
  const kleinste = CFG.groessen.length ? CFG.groessen[0].N : null;
  const farbeGebunden = CFG.farbe.modus === 'variable';

  for (const ziel of ziele) {
    const name = ziel.name;
    const src = ziel.src;
    if (!src) { abw.push(t('audit.keineSource', { name: name })); continue; }
    const kl = ziel.klasse;
    const achse = achseVon(kl);

    schiefeWinkel(src).forEach(w => abw.push(t('audit.schiefeKante', { name: name, wert: w })));

    const set = ADAPTER.zielSet(ziel);
    if (!set) { abw.push(t('audit.keinSet', { name: name })); continue; }

    const pd = set.getPluginData ? set.getPluginData(PD_SCHLUESSEL) : '';
    if (pd) {
      try {
        const d = JSON.parse(pd);
        if (d.quelle && d.quelle !== fingerabdruck(src)) {
          veraltet++; abw.push(t('audit.veraltet', { name: name }));
        }
      } catch (e) {}
    }

    for (const g of CFG.groessen) {
      const N = g.N;
      const v = set.children.find(c => c.name === variantenName(N));
      if (!v) continue;

      // Keyline
      const m = gb(v); if (!m) continue;
      const ist = massAuf(m, achse);
      const soll = keylineVon(g, kl);
      gesamt++;
      if (Math.abs(ist - soll) < 0.05) treffer++;
      else abw.push(t('audit.keyline', { name: name, klasse: kl, N: N, ist: ist.toFixed(3), soll: soll }));

      // Struktur: genau ein Vektor, keine Kontur, Farbe gebunden
      if (v.children.length !== 1) abw.push(t('audit.knoten', { name: name, N: N, n: v.children.length }));
      const kind = v.children[0];
      if (!kind) continue;
      if (kind.type !== 'VECTOR') abw.push(t('audit.typ', { name: name, N: N, typ: kind.type }));
      if ((kind.strokes || []).length) abw.push(t('audit.restkontur', { name: name, N: N }));
      if (farbeGebunden) {
        const fb = kind.fills && kind.fills[0] && kind.fills[0].boundVariables;
        if (!(fb && fb.color)) abw.push(t('audit.farbe', { name: name, N: N }));
      }
      const rr = kind.type === 'VECTOR' ? rasterRate(kind, g.raster) : null;
      if (rr) { rasterAuf += rr.auf; rasterGesamt += rr.gesamt; }
      if (N === kleinste && kind.type === 'VECTOR')
        engeLuecken(kind).forEach(l => abw.push(t('audit.luecke', { name: name, N: N, wert: l.toFixed(2) })));
    }
  }
  return { treffer: treffer, gesamt: gesamt, abw: abw, rasterAuf: rasterAuf, rasterGesamt: rasterGesamt, veraltet: veraltet };
}
