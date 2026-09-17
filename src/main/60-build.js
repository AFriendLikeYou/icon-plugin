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
  // Das ist eine Mutation außerhalb des Ziel-Sets — sie braucht die Erlaubnis aus CFG.schreiben.
  if (!ziel.src && ziel.frame && !ziel.frame.removed && ziel.frame.type === 'FRAME') {
    if (!(CFG.schreiben && CFG.schreiben.frameUmwandeln))
      throw new PipelineFehler('FRAME_NICHT_ERLAUBT', { name: ziel.name }, ziel.frame.id);
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
  // Stroke-Fassungen brauchen eine Ablage; ohne Schreiberlaubnis gar nicht erst bauen.
  if (strokeAuch && !(CFG.schreiben && CFG.schreiben.strokeHeimAnlegen) && !strokeHeimVorhanden(ziel)) {
    melden('warn', 'STROKEHEIM_AUS', { name: name }, ziel.fokusNode ? ziel.fokusNode.id : null);
    strokeAuch = false;
  }
  // Sperren VOR der ersten Mutation prüfen — quellePruefen wandelt Frames um
  // und normalisieren() fasst die Source an.
  let set = await ADAPTER.zielSet(ziel);
  gesperrtPruefen(ziel, set);

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

  const neu = !set;
  // Nur echte Karten melden „Karte ohne Set“ — ein karteloses Ziel im ZDS-Board
  // (Beispiel-Icon) folgt den Frei-Regeln und braucht den Hinweis nicht.
  if (neu && ADAPTER.name === 'zds' && ziel.karte)
    melden('info', 'KARTE_OHNE_SET', { name: name }, ziel.fokusNode ? ziel.fokusNode.id : null);

  const pdAlt = set ? pdLesen(set) : {};
  const vorher = pdAlt.fehler || {};

  const fehlerNeu = {}, gueteNeu = {};
  const frisch = [], ergebnisse = [], strokeComps = [];
  let ergaenzt = false;

  for (const g of CFG.groessen) {
    const N = g.N;
    const b = await baueGroesse(ziel, N, snap, strokeAuch);
    if (b.aaInfo) {
      const w = b.aaInfo.mitSnap ? b.aaInfo.snap : b.aaInfo.plain;
      fehlerNeu[N] = w.fehler;
      gueteNeu[N] = { fehler: w.fehler, aa: w.aa };
    }
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
  const heim = (strokeAuch && strokeComps.length === CFG.groessen.length) ? ADAPTER.strokeHeim(ziel) : null;
  if (!heim && strokeComps.length) {
    // Keine Ablage (Schreiben verboten) — die gesicherten Fassungen wieder wegräumen.
    strokeComps.forEach(q => { try { q.remove(); } catch (e) {} });
    if (strokeAuch) melden('warn', 'STROKEHEIM_AUS', { name: name }, ziel.fokusNode ? ziel.fokusNode.id : null);
    strokeAuch = false;
  }
  if (heim) {
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
    // guete ergänzt fehler um die AA-Quote; verlauf trägt die letzten Bauten (max. VERLAUF_MAX).
    const gueteGesamt = Object.assign({}, pdAlt.guete || {}, gueteNeu);
    const verlauf = Array.isArray(pdAlt.verlauf) ? pdAlt.verlauf.slice() : [];
    verlauf.push({ zeit: Date.now(), guete: gueteGesamt });
    while (verlauf.length > VERLAUF_MAX) verlauf.shift();
    set.setPluginData(PD_SCHLUESSEL, JSON.stringify({
      quelle: fingerabdruck(src), snap: !!snap, zeit: Date.now(),
      fehler: Object.assign({}, vorher, fehlerNeu),   // Kompatibilität mit v1/v2
      guete: gueteGesamt,
      verlauf: verlauf
    }));
  } catch (e) {}

  await ADAPTER.nachBuild(ziel, set, { neu: neu, snap: !!snap, strokeAuch: !!strokeAuch });

  return t('bau.kopf', { name: name, klasse: kl, liste: ergebnisse.join(' · ') })
    + hinweis
    + (strokeAuch ? t('bau.strokeAbgelegt') : '')
    + (neu ? t('bau.neuesSet') : '');
}

// --- Vorschau: baut ephemer, ändert nichts --------------------------------

// ohneNormalisieren: bei der Vorschau mit ungespeicherter Konfig darf die Source
// nicht mit einer fremden master.kontur überschrieben werden.
async function vorschau(ziel, snap, ohneNormalisieren) {
  const set = await ADAPTER.zielSet(ziel);
  gesperrtPruefen(ziel, set);
  quellePruefen(ziel);
  const src = ziel.src;
  await farbeVariableAufloesen(CFG.farbe);
  if (!ohneNormalisieren) normalisieren(src);
  const kl = ziel.klasse;
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

// --- Strukturierte Befunde (Abschnitt 28.1) -------------------------------
// Audit und Bericht liefern keine fertigen Sätze mehr, sondern Einträge mit
// Code, Schwere, Icon-Name und Größe. Der Text kommt aus dem Wörterbuch; die
// UI kann nach Code, Icon und Schwere gruppieren und filtern.

const ABW_SCHWERE = {
  KEYLINE_ABWEICHUNG: 'warnung',
  STRUKTUR_KNOTEN: 'warnung',
  STRUKTUR_TYP: 'warnung',
  RESTKONTUR: 'warnung',
  FARBE_UNGEBUNDEN: 'warnung',
  LUECKE_ENG: 'info',
  KANTE_SCHIEF: 'warnung',
  VORLAGE_GEAENDERT: 'info',
  KEINE_SOURCE: 'fehler',
  KEIN_SET: 'fehler'
};

// name/N stehen sowohl als Platzhalter im Text als auch als eigene Felder.
function abwEintrag(code, name, N, params, nodeId) {
  const p = Object.assign({ name: name, N: N == null ? '' : N }, params || {});
  return {
    code: code,
    name: name == null ? null : name,
    N: N == null ? null : N,
    schwere: ABW_SCHWERE[code] || 'warnung',
    text: t('fehler.' + code, p),
    hinweis: t('hinweis.' + code, p),
    nodeId: nodeId || null
  };
}

// Einen Befund ins Protokoll schreiben — mit name/N/schwere für die Gruppierung.
function abwLog(z) {
  logZeile(artVonSchwere(z.schwere), z.text, z.nodeId,
    { name: z.name, N: z.N, schwere: z.schwere, code: z.code, hinweis: z.hinweis });
}

// schiefeWinkel() liefert fertige Strings ('12.34° (soll 30°)') — für den
// strukturierten Eintrag brauchen wir ist und soll getrennt.
function abwWinkelTeile(wert) {
  const m = /^([\d.,]+)°.*?(\d+)°/.exec(String(wert));
  return m ? { ist: m[1], soll: m[2] } : { ist: String(wert), soll: '—' };
}

// --- Gemeinsame Messungen (Audit und Bericht) -----------------------------
// Live gemessen wird an der gebauten Variante, nicht an der Source. Audit und
// Bericht teilen sich diese drei Helfer, damit beide dasselbe Maß nehmen.

// Ablage für Stroke-Fassungen bereits vorhanden? (ohne sie anzulegen)
function strokeHeimVorhanden(ziel) {
  try { return ADAPTER.strokeHeimDa ? !!ADAPTER.strokeHeimDa(ziel) : false; } catch (e) { return false; }
}

// Keyline: gemessenes Maß auf der Klassenachse gegen das Soll der Größe.
function messKeyline(v, g, kl) {
  const m = gb(v);
  if (!m) return null;
  const ist = massAuf(m, achseVon(kl));
  const soll = keylineVon(g, kl);
  return { ist: ist, soll: soll, ok: Math.abs(ist - soll) < 0.05 };
}

// Rasterlage der geraden Kanten — nur sinnvoll, wenn die Variante ein Vektor ist.
function messRaster(v, g) {
  const kind = v.children[0];
  if (!kind || kind.type !== 'VECTOR') return null;
  return rasterRate(kind, g.raster);
}

// Struktur: genau ein Vektor, keine Restkontur, Farbe gebunden, keine engen Lücken.
// `kleinste` schaltet die Lückenprüfung zu (nur bei der kleinsten Größe aussagekräftig).
// Liefert strukturierte Einträge (Abschnitt 28.1); der Bericht nimmt daraus .text.
function messStruktur(v, name, N, kleinste) {
  const funde = [];
  const id = v && v.id;
  if (v.children.length !== 1)
    funde.push(abwEintrag('STRUKTUR_KNOTEN', name, N, { n: v.children.length }, id));
  const kind = v.children[0];
  if (!kind) return funde;
  if (kind.type !== 'VECTOR')
    funde.push(abwEintrag('STRUKTUR_TYP', name, N, { typ: kind.type }, id));
  if ((kind.strokes || []).length)
    funde.push(abwEintrag('RESTKONTUR', name, N, null, id));
  if (CFG.farbe.modus === 'variable') {
    const fb = kind.fills && kind.fills[0] && kind.fills[0].boundVariables;
    if (!(fb && fb.color)) funde.push(abwEintrag('FARBE_UNGEBUNDEN', name, N, null, id));
  }
  if (kleinste && kind.type === 'VECTOR')
    engeLuecken(kind).forEach(l =>
      funde.push(abwEintrag('LUECKE_ENG', name, N, { d: l.toFixed(2) }, id)));
  return funde;
}

// --- Audit -----------------------------------------------------------------
// Abbrechbar: das Flag wird zwischen zwei Icons geprüft, Teilergebnisse bleiben gültig.

async function audit() {
  let treffer = 0, gesamt = 0, rasterAuf = 0, rasterGesamt = 0, veraltet = 0;
  const abw = [];
  const ziele = await ADAPTER.alle();
  const kleinste = CFG.groessen.length ? CFG.groessen[0].N : null;
  let geprueft = 0, abgebrochen = false;

  for (const ziel of ziele) {
    if (abbruchAktiv()) { abgebrochen = true; break; }
    geprueft++;
    ui({ type: 'progress', i: geprueft, n: ziele.length, name: ziel.name });
    const name = ziel.name;
    const src = ziel.src;
    const zielId = (ziel.fokusNode && ziel.fokusNode.id) || (src && src.id) || null;
    if (!src) {
      abw.push(abwEintrag('KEINE_SOURCE', name, null, { mass: CFG.master.groesse }, zielId));
      continue;
    }
    const kl = ziel.klasse;

    schiefeWinkel(src).forEach(w => {
      const teile = abwWinkelTeile(w);
      abw.push(abwEintrag('KANTE_SCHIEF', name, null, teile, src.id));
    });

    const set = await ADAPTER.zielSet(ziel);
    if (!set) { abw.push(abwEintrag('KEIN_SET', name, null, null, zielId)); continue; }

    if (istVeraltet(set, src)) {
      veraltet++;
      abw.push(abwEintrag('VORLAGE_GEAENDERT', name, null, null, set.id));
    }

    for (const g of CFG.groessen) {
      const N = g.N;
      const v = set.children.find(c => c.name === variantenName(N));
      if (!v) continue;

      const k = messKeyline(v, g, kl);
      if (k) {
        gesamt++;
        if (k.ok) treffer++;
        else abw.push(abwEintrag('KEYLINE_ABWEICHUNG', name, N,
          { ist: k.ist.toFixed(3), soll: k.soll, klasse: kl }, v.id));
      }

      messStruktur(v, name, N, N === kleinste).forEach(z => abw.push(z));

      const rr = messRaster(v, g);
      if (rr) { rasterAuf += rr.auf; rasterGesamt += rr.gesamt; }
    }
    await tick();
  }
  return {
    treffer: treffer, gesamt: gesamt, abw: abw,
    rasterAuf: rasterAuf, rasterGesamt: rasterGesamt, veraltet: veraltet,
    geprueft: geprueft, n: ziele.length, abgebrochen: abgebrochen
  };
}
