// ===========================================================================
// 66-bericht.js — Qualitätsbericht (Abschnitt 19).
// Zwei Quellen: was beim letzten Bau gemessen wurde (pluginData am Set) und
// was sich JETZT am Set messen lässt (Keyline, Raster, Struktur — dieselben
// Helfer wie im Audit). Der Bericht ändert nichts.
// ===========================================================================

// Mehr Verlaufseinträge braucht der Trendpfeil nicht; der älteste fällt raus.
const VERLAUF_MAX = 12;

// pluginData des Sets lesen — Schlüssel bleibt 'zds' (Kompatibilität).
// Form: { quelle, snap, zeit, fehler: {N: f}, guete: {N: {fehler, aa}}, verlauf: [{zeit, guete}] }
function pdLesen(set) {
  try {
    const s = (set && set.getPluginData) ? set.getPluginData(PD_SCHLUESSEL) : '';
    const o = JSON.parse(s || '{}');
    return (o && typeof o === 'object') ? o : {};
  } catch (e) { return {}; }
}

// Hat sich die Source seit dem letzten Bau geändert?
function istVeraltet(set, src) {
  const d = pdLesen(set);
  if (!d.quelle || !src) return false;
  try { return d.quelle !== fingerabdruck(src); } catch (e) { return false; }
}

// Treue eines Verlaufseintrags für eine Größe (alt: Zahl, neu: {fehler, aa}).
function berichtTreueVon(eintrag, N) {
  if (!eintrag) return null;
  const w = eintrag[N];
  if (w == null) return null;
  if (typeof w === 'number') return w;
  return typeof w.fehler === 'number' ? w.fehler : null;
}

async function bericht(ziele) {
  const zeilen = [];
  const abw = [];   // strukturierte Befunde wie im Audit (Abschnitt 28.1)
  const kleinste = CFG.groessen.length ? CFG.groessen[0].N : null;
  let icons = 0, ohneSet = 0, veraltetN = 0, keylineOk = 0, keylineGesamt = 0;
  let tSum = 0, tN = 0, tvSum = 0, tvN = 0;
  let geprueft = 0, abgebrochen = false;

  for (const ziel of ziele) {
    if (abbruchAktiv()) { abgebrochen = true; break; }
    geprueft++;
    ui({ type: 'progress', i: geprueft, n: ziele.length, name: ziel.name });

    const name = ziel.name;
    const kl = ziel.klasse;
    let set = null;
    try { set = await ADAPTER.zielSet(ziel); } catch (e) { set = null; }

    const zeile = {
      name: name, hatSet: !!set, veraltet: false,
      nodeId: (ziel.fokusNode && ziel.fokusNode.id) || (ziel.src && ziel.src.id) || null,
      groessen: {}
    };
    icons++;
    if (!ziel.src) abw.push(abwEintrag('KEINE_SOURCE', name, null, { mass: CFG.master.groesse }, zeile.nodeId));
    if (!set) {
      ohneSet++;
      abw.push(abwEintrag('KEIN_SET', name, null, null, zeile.nodeId));
      zeilen.push(zeile); await tick(); continue;
    }

    const pd = pdLesen(set);
    zeile.veraltet = istVeraltet(set, ziel.src);
    if (zeile.veraltet) {
      veraltetN++;
      abw.push(abwEintrag('VORLAGE_GEAENDERT', name, null, null, set.id));
    }

    // Vorletzter Verlaufseintrag = Stand vor dem letzten Bau.
    const verlauf = Array.isArray(pd.verlauf) ? pd.verlauf : [];
    const vorige = verlauf.length >= 2 ? (verlauf[verlauf.length - 2].guete || {}) : {};

    for (const g of CFG.groessen) {
      const N = g.N;
      const v = set.children.find(c => c.name === variantenName(N));
      if (!v) continue;

      const gd = (pd.guete && pd.guete[N]) || null;
      const treue = gd && typeof gd.fehler === 'number'
        ? gd.fehler
        : ((pd.fehler && typeof pd.fehler[N] === 'number') ? pd.fehler[N] : null);
      const aa = gd && typeof gd.aa === 'number' ? gd.aa : null;
      const treueVorher = berichtTreueVon(vorige, N);

      const k = messKeyline(v, g, kl);
      const rr = messRaster(v, g);
      const funde = messStruktur(v, name, N, N === kleinste);
      funde.forEach(z => abw.push(z));
      // Der Bericht zeigt je Zelle nur die Sätze; die Codes stehen in `abw`.
      const struktur = funde.map(z => z.text);
      if (k && !k.ok) abw.push(abwEintrag('KEYLINE_ABWEICHUNG', name, N,
        { ist: k.ist.toFixed(3), soll: k.soll, klasse: kl }, v.id));

      zeile.groessen[N] = {
        treue: treue, aa: aa, treueVorher: treueVorher,
        keylineIst: k ? k.ist : null,
        keylineSoll: k ? k.soll : keylineVon(g, kl),
        keylineOk: k ? k.ok : false,
        raster: rr || { auf: 0, gesamt: 0 },
        struktur: struktur
      };

      if (k) { keylineGesamt++; if (k.ok) keylineOk++; }
      if (typeof treue === 'number') { tSum += treue; tN++; }
      if (typeof treueVorher === 'number') { tvSum += treueVorher; tvN++; }
    }

    zeilen.push(zeile);
    await tick();
  }

  return {
    zeilen: zeilen,
    abw: abw,
    zusammenfassung: {
      icons: icons, ohneSet: ohneSet, veraltet: veraltetN,
      treueMittel: tN ? tSum / tN : null,
      treueMittelVorher: tvN ? tvSum / tvN : null,
      keylineOk: keylineOk, keylineGesamt: keylineGesamt
    },
    zeit: Date.now(),
    geprueft: geprueft, n: ziele.length, abgebrochen: abgebrochen
  };
}

// --- Übersicht: Startseite der UI -----------------------------------------
// Liste aller Icons im File, bewusst billig: keine PNG-Exporte, keine
// Güte-Messung — nur was ADAPTER.alle() und das Set ohne Rendern hergeben.
// Fortschritt melden wir erst ab UEBERSICHT_PROGRESS_AB Icons, sonst flackert
// die Zeile bei kleinen Files sinnlos auf.
const UEBERSICHT_PROGRESS_AB = 50;

async function uebersicht(ziele) {
  const eintraege = [];
  let ohneSet = 0, veraltetN = 0;
  let geprueft = 0, abgebrochen = false;
  const melde = ziele.length > UEBERSICHT_PROGRESS_AB;

  for (const ziel of ziele) {
    if (abbruchAktiv()) { abgebrochen = true; break; }
    geprueft++;
    if (melde) ui({ type: 'progress', i: geprueft, n: ziele.length, name: ziel.name });

    let set = null;
    try { set = await ADAPTER.zielSet(ziel); } catch (e) { set = null; }

    const groessen = [];
    if (set) {
      for (const g of CFG.groessen) {
        if (set.children.some(c => c.name === variantenName(g.N))) groessen.push(g.N);
      }
    }

    const veraltet = set ? istVeraltet(set, ziel.src) : false;
    if (!set) ohneSet++;
    if (veraltet) veraltetN++;

    eintraege.push({
      name: ziel.name,
      hatSet: !!set,
      veraltet: veraltet,
      groessen: groessen,
      klasse: ziel.klasse,
      nodeId: (ziel.fokusNode && ziel.fokusNode.id) || (ziel.src && ziel.src.id) || null,
      setNodeId: set ? set.id : null
    });
    await tick();
  }

  return {
    eintraege: eintraege,
    zusammenfassung: { icons: eintraege.length, ohneSet: ohneSet, veraltet: veraltetN },
    geprueft: geprueft, n: ziele.length, abgebrochen: abgebrochen
  };
}
