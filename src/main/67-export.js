// ===========================================================================
// 67-export.js — Dev-Export (Abschnitt 20).
// Liefert fertige Dateiinhalte an die UI; das ZIP baut die UI. Der Export
// ändert nichts im File und exportiert nur, was schon gebaut ist.
// ===========================================================================

const EXPORT_UMLAUTE = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'å': 'a', 'æ': 'ae', 'ø': 'o' };

// 'Pfeil Links (24)' → 'pfeil-links-24'
function exportDateiname(name) {
  let s = String(name == null ? '' : name).toLowerCase().trim();
  s = s.replace(/[äöüßåæø]/g, z => EXPORT_UMLAUTE[z] || z);
  s = s.replace(/[\s/\\]+/g, '-').replace(/[^a-z0-9._-]/g, '-').replace(/-{2,}/g, '-');
  s = s.replace(/^[-.]+/, '').replace(/[-.]+$/, '');
  return s || 'icon';
}

// Hex-Farben zu currentColor, Maße am Wurzel-<svg> raus, viewBox bleibt.
// Bewusst textuell: Figma liefert flaches, vorhersagbares SVG.
function exportSvgAufbereiten(svg) {
  let s = String(svg == null ? '' : svg);
  s = s.replace(/(fill|stroke)="#[0-9a-fA-F]{3,8}"/g, '$1="currentColor"');
  s = s.replace(/(fill|stroke)\s*:\s*#[0-9a-fA-F]{3,8}/g, '$1:currentColor');
  // Nur das Wurzelelement anfassen — <use width> in Symbolen bleibt unberührt.
  s = s.replace(/<svg\b[^>]*>/, tag => tag.replace(/\s(?:width|height)="[^"]*"/g, ''));
  return s;
}

// Suchbegriffe und Beschreibung: im ZDS-Board steht die Wahrheit in der Zelle
// 'meta · keywords' der Karte, sonst in der Set-Beschreibung.
function exportMeta(ziel, set) {
  let beschreibung = '';
  try { beschreibung = String(set.description || ''); } catch (e) { beschreibung = ''; }

  let roh = '';
  const karte = ziel && ziel.karte;
  if (karte && karte.children) {
    const mk = karte.children.find(c => c.name === 'meta · keywords');
    const txt = mk && mk.children && mk.children[1] ? mk.children[1].characters : null;
    if (txt && !/\{keywords/.test(txt)) roh = txt;
  }
  if (!roh) {
    const m = /(?:Suchbegriffe|Keywords):\s*([^\n]+)/.exec(beschreibung);
    if (m) roh = m[1];
  }
  // Der Suchbegriff-Block gehört nicht in die Beschreibung.
  beschreibung = beschreibung.replace(/\n*(?:Suchbegriffe|Keywords):[^\n]*/, '').trim();

  const keywords = roh
    ? roh.split(/[,;·|]/).map(x => x.trim()).filter(Boolean)
    : [];
  return { keywords: keywords, beschreibung: beschreibung };
}

async function exportieren(ziele) {
  const dateien = [], fehlend = [], manifest = [];
  let geprueft = 0, abgebrochen = false;

  for (const ziel of ziele) {
    if (abbruchAktiv()) { abgebrochen = true; break; }
    geprueft++;
    ui({ type: 'progress', i: geprueft, n: ziele.length, name: ziel.name });

    let set = null;
    try { set = await ADAPTER.zielSet(ziel); } catch (e) { set = null; }
    if (!set) {
      fehlend.push(ziel.name);
      melden('warn', 'EXPORT_FEHLT', { name: ziel.name },
        (ziel.fokusNode && ziel.fokusNode.id) || (ziel.src && ziel.src.id) || null);
      await tick();
      continue;
    }

    const basis = exportDateiname(ziel.name);
    const groessen = [];
    for (const g of CFG.groessen) {
      const v = set.children.find(c => c.name === variantenName(g.N));
      if (!v) continue;
      let svg = null;
      try {
        svg = await v.exportAsync({ format: 'SVG_STRING', svgOutlineText: true, svgIdAttribute: false });
      } catch (e) { svg = null; }
      if (svg == null) continue;
      dateien.push({ pfad: basis + '/' + basis + '-' + g.N + '.svg', inhalt: exportSvgAufbereiten(svg) });
      groessen.push(g.N);
    }

    const meta = exportMeta(ziel, set);
    manifest.push({
      name: ziel.name, groessen: groessen,
      keywords: meta.keywords, beschreibung: meta.beschreibung
    });
    await tick();
  }

  dateien.push({ pfad: 'manifest.json', inhalt: JSON.stringify(manifest, null, 2) });

  return {
    dateien: dateien, fehlend: fehlend, icons: manifest.length,
    geprueft: geprueft, n: ziele.length, abgebrochen: abgebrochen
  };
}
