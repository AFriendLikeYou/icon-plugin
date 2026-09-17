// ===========================================================================
// test/stub-figma.mjs — minimaler `figma`-Stub für den Kopftest.
// Deckt nur, was 00–70 beim Laden und in den reinen Funktionen anfassen:
// showUI, ui.postMessage (sammelt), on(), root.pluginData, currentPage,
// clientStorage, loadAllPagesAsync, variables, teamLibrary.
// Alles, was echte Knoten erzeugt (createFrame, createComponent, union,
// flatten, exportAsync …), fehlt ABSICHTLICH: diese Pfade sind headless
// nicht testbar und dürfen im Test auch gar nicht erreicht werden.
// ===========================================================================

export function stubFigma(opt = {}) {
  const gesendet = [];
  const pluginDaten = Object.assign({}, opt.pluginData || {});
  const speicher = new Map();

  const seite = {
    type: 'PAGE',
    id: 'page:0',
    name: opt.seitenName || 'Page 1',
    selection: [],
    children: [],
    findAll: () => [],
    findOne: () => null,
    parent: null
  };

  const root = {
    type: 'DOCUMENT',
    id: 'doc:0',
    name: 'Stub',
    children: [seite],
    getPluginData(k) { return pluginDaten[k] || ''; },
    setPluginData(k, v) { pluginDaten[k] = String(v); },
    getPluginDataKeys() { return Object.keys(pluginDaten); },
    findAll: () => [],
    findOne: () => null
  };

  const figma = {
    // --- UI ---
    showUI() {},
    ui: {
      postMessage(m) { gesendet.push(m); },
      onmessage: null,
      resize() {},
      close() {}
    },
    on() {},
    off() {},

    // --- Dokument ---
    root,
    currentPage: seite,
    async setCurrentPageAsync(p) { figma.currentPage = p; },
    async loadAllPagesAsync() {},
    async getNodeByIdAsync() { return null; },
    getNodeById() { return null; },
    viewport: { scrollAndZoomIntoView() {}, center: { x: 0, y: 0 }, zoom: 1 },
    notify() { return { cancel() {} }; },
    commitUndo() {},
    triggerUndo() {},
    skipInvisibleInstanceChildren: false,
    mixed: Symbol('figma.mixed'),

    // --- Speicher ---
    clientStorage: {
      async getAsync(k) { return speicher.has(k) ? speicher.get(k) : undefined; },
      async setAsync(k, v) { speicher.set(k, v); },
      async deleteAsync(k) { speicher.delete(k); },
      async keysAsync() { return [...speicher.keys()]; }
    },

    // --- Variablen / Libraries ---
    variables: {
      async getLocalVariablesAsync() { return []; },
      getLocalVariables() { return []; },
      async getVariableByIdAsync() { return null; },
      async importVariableByKeyAsync() { throw new Error('stub: kein Import'); },
      async getVariableCollectionByIdAsync() { return null; },
      setBoundVariableForPaint(paint) { return paint; }
    },
    teamLibrary: {
      async getAvailableLibraryVariableCollectionsAsync() { return []; },
      async getVariablesInLibraryCollectionAsync() { return []; }
    },

    // --- Sonstiges, das beim Laden referenziert werden kann ---
    editorType: 'figma',
    fileKey: 'stub',
    currentUser: { id: 'u0', name: 'Test' }
  };

  return { figma, gesendet, pluginDaten, speicher, seite, root };
}

export const HTML_STUB = '';
