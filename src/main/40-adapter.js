// ===========================================================================
// 40-adapter.js — Adapter-Schicht.
// Ein Adapter beantwortet vier Fragen: Was ist ausgewählt (Ziel)? Wo liegt das
// bestehende Set? Wohin kommt ein neues? Und was ist danach zu pflegen?
// 60-build kennt nur noch „Ziele“, keine ZDS-Karten mehr.
//
// Ziel = { name, src, klasse, klasseQuelle, karte, fokusNode }
// ===========================================================================

// Laufzeit-Kontext: Adapter-Referenzen + aufgelöste Farbvariable.
let CTX = { farbVariable: null, farbSchluessel: null, zds: null, frei: null };
let ADAPTER = null;

const ZDS_KARTEN_FRAME = 'ZDS Icons · Karten';
const ZDS_STROKE_HEIM = 'ZDS Icons · Stroke-Fassungen (optimiert)';
const FREI_STROKE_HEIM = 'Icon Pipeline · Stroke';

// Quadratisch und (±0.5) auf Master-Maß?
function hatMasterMass(node) {
  const g = CFG.master.groesse;
  return Math.abs(node.width - g) <= 0.5 && Math.abs(node.height - g) <= 0.5;
}

function seiteVon(node) {
  let n = node;
  while (n && n.type !== 'PAGE') n = n.parent;
  return n || null;
}

// ---------------------------------------------------------------- ZDS -----

function zdsKarteZu(node) {
  let n = node;
  while (n && n.type !== 'PAGE') { if (/^Karte · /.test(n.name)) return n; n = n.parent; }
  return null;
}

function zdsIconName(karte) {
  return karte.name.replace(/^Karte · /, '').replace(/ \(verschlankt\)$/, '');
}

async function zdsSourceZu(karte) {
  const z1 = karte.children.find(c => c.name === '01 · source');
  if (!z1) return null;
  const comp = z1.children.find(c => c.type === 'COMPONENT');
  if (comp) return comp;
  const inst = z1.children.find(c => c.type === 'INSTANCE' && c.name !== 'grid');
  if (inst) return await inst.getMainComponentAsync();
  return null;
}

// Klasse zuerst aus der Grid-Instanz (verlässlich), sonst aus dem Seitenverhältnis.
async function zdsKlasseZu(karte, src) {
  const z1 = karte.children.find(c => c.name === '01 · source');
  const g = z1 && z1.children.find(c => c.name === 'grid');
  if (g && g.type === 'INSTANCE') {
    const mc = await g.getMainComponentAsync();
    if (mc) {
      const k = mc.name.replace('GuideType=', '');
      if (KLASSEN.indexOf(k) >= 0) return { klasse: k, quelle: 'grid' };
      if (k === 'Keylines') return { klasse: 'Square', quelle: 'grid' };
    }
  }
  return klasseRaten(src);
}

// Seitenverhältnis → Klasse (identisch zu v1).
function klasseRaten(src) {
  const m = src ? gb(src) : null;
  const r = m ? m.w / m.h : 1;
  return { klasse: r >= 1.2 ? 'Wide' : (r <= 0.833 ? 'Tall' : 'Square'), quelle: 'heuristik' };
}

function zdsLibrarySet(name) {
  const c = CTX.zds;
  const s = c.IC.findAll(n => n.type === 'COMPONENT_SET' && n.name === name)[0];
  if (s) return s;
  // Tab-Bar-Fallback: dort liegen die zurückgestellten Sets mit Punkt-Präfix.
  return c.TB ? (c.TB.findAll(n => n.type === 'COMPONENT_SET' && n.name === '.' + name)[0] || null) : null;
}

function zdsKarten() {
  const c = CTX.zds;
  const karten = [];
  [c.K, c.TB].filter(Boolean).forEach(s =>
    s.children.filter(x => /^Karte · /.test(x.name)).forEach(x => karten.push(x)));
  return karten;
}

// Preview-Zellen der Karte mit Instanzen der frisch gebauten Varianten füllen.
function zdsPreviewFuellen(karte, name, set) {
  const z2 = karte.children.find(c => c.name === '02 · library auf dem Grid');
  if (!z2) return;
  for (const g of CFG.groessen) {
    const N = g.N;
    const grid = z2.children.find(c => c.name === 'grid' && Math.round(c.width) === N);
    if (!grid) continue;
    const da = z2.children.find(c => c.type === 'INSTANCE' && c.name !== 'grid' && Math.round(c.width) === N);
    if (da) continue;
    const v = set.children.find(c => c.name === variantenName(N));
    if (!v) continue;
    const i = v.createInstance(); z2.appendChild(i); i.name = name; i.x = grid.x; i.y = grid.y;
  }
}

const adapterZds = {
  name: 'zds',

  async erkennen() {
    const IC = figma.root.children.find(p => p.name === 'Icons');
    const SRC = figma.root.children.find(p => p.name === 'Source');
    if (!IC || !SRC) return false;
    try { await SRC.loadAsync(); } catch (e) { return false; }
    return !!SRC.children.find(c => c.name === ZDS_KARTEN_FRAME);
  },

  async kontext() {
    await figma.loadAllPagesAsync();
    const IC = figma.root.children.find(p => p.name === 'Icons');
    const SRC = figma.root.children.find(p => p.name === 'Source');
    if (!IC || !SRC) throw new PipelineFehler('SEITEN_FEHLEN');
    await IC.loadAsync(); await SRC.loadAsync();
    const K = SRC.children.find(c => c.name === ZDS_KARTEN_FRAME);
    const TB = SRC.children.find(c => /^Tab-Bar · zurückgestellt/.test(c.name));
    const STATUS = SRC.findAll(n => n.type === 'COMPONENT_SET' && n.name === '.Icon status')[0] || null;
    CTX.zds = { IC: IC, SRC: SRC, K: K, TB: TB, STATUS: STATUS };
    return CTX.zds;
  },

  async aufloesen(sel) {
    if (!sel || !CTX.zds) return null;
    let karte = zdsKarteZu(sel);
    if (!karte) {
      // Auswahl im Library-Set → zugehörige Karte über den Namen finden.
      let n = sel;
      while (n && n.type !== 'PAGE' && n.type !== 'COMPONENT_SET') n = n.parent;
      if (n && n.type === 'COMPONENT_SET' && CTX.zds.K)
        karte = CTX.zds.K.children.find(c => c.name === 'Karte · ' + n.name)
             || CTX.zds.K.children.find(c => c.name === 'Karte · ' + n.name.replace(/^\./, ''))
             || null;
    }
    if (karte) return await zdsZiel(karte);

    // Runde 4: Eine Komponente im Master-Maß ohne Karte ist kein Fehler mehr —
    // sie wird nach den Frei-Regeln behandelt (Beispiel-Icon auf der Seite
    // Source, lose Vorlagen). Die Frei-Helfer liegen im selben Scope.
    let n = sel;
    while (n && n.type !== 'PAGE' && n.type !== 'DOCUMENT') {
      if (n.type === 'COMPONENT' && hatMasterMass(n) &&
          !(n.parent && n.parent.type === 'COMPONENT_SET')) return freiZielAusSource(n);
      n = n.parent;
    }
    return null;
  },

  // Async wie im Frei-Adapter — das Interface ist fuer beide gleich.
  // Ziele ohne Karte (Beispiel-Icon, lose Vorlagen) folgen den Frei-Regeln:
  // ihr Set gehört neben die Vorlage, nicht in die Library-Seite.
  async zielSet(ziel) {
    if (!ziel.karte) return await adapterFrei.zielSet(ziel);
    return zdsLibrarySet(ziel.name);
  },

  zielEltern(ziel) {
    if (!ziel.karte) return adapterFrei.zielEltern(ziel);
    return { node: CTX.zds.IC, x: 80, y: 120 };
  },

  arbeitsFlaeche(ziel) {
    if (!ziel.karte) return adapterFrei.arbeitsFlaeche(ziel);
    return CTX.zds.IC;
  },

  // Gibt es die Ablage schon? (Trockenlauf — nichts anlegen.)
  strokeHeimDa(ziel) {
    return !!(CTX.zds && CTX.zds.SRC && CTX.zds.SRC.children.find(c => c.name === ZDS_STROKE_HEIM));
  },

  // Ablage für ungeplättete, optimierte Fassungen — wird nie publiziert.
  // Neu anlegen nur, wenn CFG.schreiben.strokeHeimAnlegen es erlaubt; sonst null.
  strokeHeim(ziel) {
    const SRC = CTX.zds.SRC;
    let h = SRC.children.find(c => c.name === ZDS_STROKE_HEIM);
    if (h) return h;
    if (!(CFG.schreiben && CFG.schreiben.strokeHeimAnlegen)) return null;
    h = figma.createFrame(); SRC.appendChild(h);
    h.name = ZDS_STROKE_HEIM;
    const alt = SRC.children.find(c => /Arbeitsdateien \(versteckt\)/.test(c.name));
    h.x = alt ? alt.x : 100; h.y = alt ? alt.y + alt.height + 80 : 100;
    h.resize(1250, 240);
    h.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    return h;
  },

  async alle() {
    const ziele = [];
    for (const karte of zdsKarten()) ziele.push(await zdsZiel(karte));
    return ziele;
  },

  async nachBuild(ziel, set, info) {
    const karte = ziel.karte;
    if (!karte) return;
    zdsPreviewFuellen(karte, ziel.name, set);
    // Suchbegriffe aus der Karte in die Set-Beschreibung spiegeln.
    const mk = karte.children.find(c => c.name === 'meta · keywords');
    const kw = mk && mk.children[1] ? mk.children[1].characters : null;
    if (kw && !/\{keywords/.test(kw))
      set.description = t('set.suchbegriffe', { basis: setBeschreibung(ziel.name), kw: kw });
    // Status-Chip der Karte auf „published“.
    if (CTX.zds.STATUS) {
      const chip = karte.children.find(c => c.name === 'status' && c.type === 'INSTANCE');
      const pub = CTX.zds.STATUS.children.find(c => c.name === 'status=published');
      if (chip && pub) { try { chip.swapComponent(pub); } catch (e) {} }
    }
  }
};

async function zdsZiel(karte) {
  const name = zdsIconName(karte);
  const src = await zdsSourceZu(karte);
  const kl = src ? await zdsKlasseZu(karte, src) : { klasse: 'Square', quelle: 'heuristik' };
  return {
    name: name, src: src, klasse: kl.klasse, klasseQuelle: kl.quelle,
    karte: karte, fokusNode: karte
  };
}

// --------------------------------------------------------------- Frei -----

// '.Name (72px source)' → 'Name'
function freiNameBereinigen(name) {
  return String(name == null ? '' : name)
    .replace(/^\.+/, '')
    .replace(/\s*\([^()]*\)\s*$/, '')
    .trim();
}

function freiKlasse(src) {
  let ov = '';
  try { ov = src.getPluginData(KLASSE_SCHLUESSEL) || ''; } catch (e) {}
  if (KLASSEN.indexOf(ov) >= 0) return { klasse: ov, quelle: 'override' };
  return klasseRaten(src);
}

function freiZielAusSource(src, name) {
  const kl = freiKlasse(src);
  return {
    name: name || freiNameBereinigen(src.name),
    src: src, klasse: kl.klasse, klasseQuelle: kl.quelle,
    karte: null, fokusNode: src
  };
}

// Source über den Namen suchen: aktuelle Seite zuerst, dann alle Seiten.
async function freiSourceSuchen(name) {
  const passt = n => n.type === 'COMPONENT' && hatMasterMass(n) && freiNameBereinigen(n.name) === name;
  const hier = figma.currentPage.findAll(passt)[0];
  if (hier) return hier;
  await figma.loadAllPagesAsync();
  for (const p of figma.root.children) {
    if (p === figma.currentPage) continue;
    try { await p.loadAsync(); } catch (e) { continue; }
    const f = p.findAll(passt)[0];
    if (f) return f;
  }
  return null;
}

// Ein einzelner Knoten → Ziel oder null.
async function freiZielAusKnoten(node) {
  if (!node) return null;

  // 1) Variante eines Sets → über das Set gehen.
  if (node.type === 'COMPONENT' && istVariantenName(node.name) &&
      node.parent && node.parent.type === 'COMPONENT_SET') {
    return await freiZielAusSet(node.parent);
  }

  // 2) Varianten-Set.
  if (node.type === 'COMPONENT_SET') return await freiZielAusSet(node);

  // 3) Master-Komponente = Source.
  if (node.type === 'COMPONENT' && hatMasterMass(node)) return freiZielAusSource(node);

  // 4) Frame im Master-Maß → Ziel ohne src; die Umwandlung in eine Komponente
  //    passiert erst beim Bauen (quellePruefen), nie bei der bloßen Auswahl.
  if (node.type === 'FRAME' && hatMasterMass(node)) {
    const name = freiNameBereinigen(node.name);
    const kl = klasseRaten(node);
    return { name: name, src: null, frame: node, klasse: kl.klasse, klasseQuelle: kl.quelle,
      karte: null, fokusNode: node };
  }

  return null;
}

async function freiZielAusSet(set) {
  const hatVarianten = set.children.some(c => istVariantenName(c.name));
  if (!hatVarianten) return null;
  const name = freiNameBereinigen(set.name);
  const src = await freiSourceSuchen(name);
  if (!src) return null;
  return freiZielAusSource(src, name);
}

const adapterFrei = {
  name: 'frei',

  async erkennen() { return true; },

  async kontext() { CTX.frei = { seite: figma.currentPage.id }; return CTX.frei; },

  // Vom Selektionsknoten aufwärts, Instanzen über getMainComponentAsync.
  async aufloesen(sel) {
    let n = sel;
    while (n && n.type !== 'PAGE' && n.type !== 'DOCUMENT') {
      if (n.type === 'INSTANCE') {
        let mc = null;
        try { mc = await n.getMainComponentAsync(); } catch (e) { mc = null; }
        if (mc) { const z = await freiZielAusKnoten(mc); if (z) return z; }
      }
      const z = await freiZielAusKnoten(n);
      if (z) return z;
      n = n.parent;
    }
    return null;
  },

  // Async: erst die aktuelle Seite, dann — nach dem Laden — alle übrigen.
  // (v2 suchte nur auf bereits geladenen Seiten und übersah Sets auf anderen.)
  async zielSet(ziel) {
    const passt = n => n.type === 'COMPONENT_SET' && freiNameBereinigen(n.name) === ziel.name;
    const hier = figma.currentPage.findAll(passt)[0];
    if (hier) return hier;
    try { await figma.loadAllPagesAsync(); } catch (e) {}
    for (const p of figma.root.children) {
      if (p === figma.currentPage) continue;
      try { await p.loadAsync(); } catch (e) { continue; }
      let f = null;
      try { f = p.findAll(passt)[0]; } catch (e) { f = null; }
      if (f) return f;
    }
    return null;
  },

  zielEltern(ziel) {
    let p = ziel.src.parent;
    while (p && ['PAGE', 'FRAME', 'SECTION'].indexOf(p.type) < 0) p = p.parent;
    if (!p) p = figma.currentPage;
    return { node: p, x: ziel.src.x + ziel.src.width + 40, y: ziel.src.y };
  },

  arbeitsFlaeche(ziel) { return seiteVon(ziel.src) || figma.currentPage; },

  strokeHeimDa(ziel) {
    const seite = (ziel && ziel.src ? seiteVon(ziel.src) : null) || figma.currentPage;
    return !!seite.children.find(c => c.type === 'FRAME' && c.name === FREI_STROKE_HEIM);
  },

  strokeHeim(ziel) {
    const seite = seiteVon(ziel.src) || figma.currentPage;
    let h = seite.children.find(c => c.type === 'FRAME' && c.name === FREI_STROKE_HEIM);
    if (h) return h;
    if (!(CFG.schreiben && CFG.schreiben.strokeHeimAnlegen)) return null;
    h = figma.createFrame(); seite.appendChild(h);
    h.name = FREI_STROKE_HEIM;
    h.x = ziel.src.x; h.y = ziel.src.y + ziel.src.height + 120;
    h.resize(1250, 240);
    h.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    return h;
  },

  // Alle Master-Komponenten der aktuellen Seite, die nicht Variante eines Sets sind.
  async alle() {
    const comps = figma.currentPage.findAll(n =>
      n.type === 'COMPONENT' && hatMasterMass(n) &&
      !(n.parent && n.parent.type === 'COMPONENT_SET'));
    return comps.map(c => freiZielAusSource(c));
  },

  async nachBuild(ziel, set, info) { /* pluginData macht 60-build zentral */ }
};

// -------------------------------------------------------------- Wahl ------

async function adapterWaehlen(cfg) {
  const wunsch = (cfg && cfg.adapter) || 'auto';
  let gewaehlt = adapterFrei;
  if (wunsch === 'zds') gewaehlt = adapterZds;
  else if (wunsch === 'frei') gewaehlt = adapterFrei;
  else {
    let ok = false;
    try { ok = await adapterZds.erkennen(); } catch (e) { ok = false; }
    gewaehlt = ok ? adapterZds : adapterFrei;
  }
  ADAPTER = gewaehlt;
  await ADAPTER.kontext();
  return ADAPTER;
}
