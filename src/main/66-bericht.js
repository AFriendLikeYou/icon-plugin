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
    if (!set) { ohneSet++; zeilen.push(zeile); await tick(); continue; }

    const pd = pdLesen(set);
    zeile.veraltet = istVeraltet(set, ziel.src);
    if (zeile.veraltet) veraltetN++;

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
      const struktur = messStruktur(v, name, N, N === kleinste);

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
