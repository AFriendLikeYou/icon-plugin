// ===========================================================================
// 68-beispiel.js — Beispiel-Icon für den Leerzustand (Abschnitt 21, 28.6).
// Ein Kreis plus Querbalken im Master-Maß: genug Geometrie, damit Keyline-Fit,
// Snapping und Flatten sichtbar etwas tun. Seit Runde 4 auch im ZDS-Board —
// dort aber gesammelt im Frame „Icon Pipeline · Beispiel“ auf der Seite Source,
// nicht irgendwo zwischen den Karten.
// ===========================================================================

const BEISPIEL_NAME = 'demo-icon';
const BEISPIEL_FRAME = 'Icon Pipeline · Beispiel';

// Wo landet das Beispiel? Frei-Modus: aktuelle Seite. ZDS: eigener Frame auf
// der Seite Source (wird bei Bedarf angelegt).
function beispielHeim() {
  if (!(ADAPTER && ADAPTER.name === 'zds' && CTX.zds && CTX.zds.SRC)) return figma.currentPage;
  const SRC = CTX.zds.SRC;
  let f = SRC.children.find(c => c.type === 'FRAME' && c.name === BEISPIEL_FRAME);
  if (f) return f;
  f = figma.createFrame();
  SRC.appendChild(f);
  f.name = BEISPIEL_FRAME;
  const karten = SRC.children.find(c => c.name === ZDS_KARTEN_FRAME);
  f.x = karten ? karten.x : 100;
  f.y = karten ? karten.y + karten.height + 160 : 100;
  f.resize(640, 320);
  f.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  f.clipsContent = false;
  return f;
}

async function beispielAnlegen(snap) {
  if (!ADAPTER) return null;

  const g = CFG.master.groesse;
  const w = CFG.master.kontur;
  const heim = beispielHeim();
  const aufSeite = heim.type === 'PAGE';
  const tinte = [{ type: 'SOLID', color: { r: 0.267, g: 0.267, b: 0.267 } }];

  const comp = figma.createComponent();
  comp.name = BEISPIEL_NAME;
  comp.resize(g, g);
  comp.fills = [];
  comp.clipsContent = false;
  heim.appendChild(comp);

  if (!aufSeite) {
    // Im Sammel-Frame in einer Reihe aufreihen, damit mehrere Versuche nebeneinander liegen.
    const geschwister = heim.children.filter(c => c !== comp).length;
    comp.x = 40 + (geschwister % 6) * (g + 40);
    comp.y = 40 + Math.floor(geschwister / 6) * (g + 40);
  } else if (heim.children.length > 1) {
    // Rechts neben der Viewport-Mitte; auf einer leeren Seite schlicht bei (0,0).
    let c = null;
    try { c = figma.viewport.center; } catch (e) { c = null; }
    comp.x = c ? Math.round(c.x + g * 0.75) : 0;
    comp.y = c ? Math.round(c.y - g / 2) : 0;
  } else { comp.x = 0; comp.y = 0; }

  // Kreis auf der Circular-Keyline.
  const d = Math.max(1, Math.min(CFG.master.keylines.Circular, g));
  const ell = figma.createEllipse();
  comp.appendChild(ell);
  ell.name = 'Kreis';
  ell.resize(d, d);
  ell.x = (g - d) / 2; ell.y = (g - d) / 2;
  ell.fills = [];
  ell.strokes = tinte;
  ell.strokeWeight = w;
  try { ell.strokeAlign = 'CENTER'; } catch (e) {}

  // Waagerechte Linie durch die Mitte, 60 % der Square-Keyline, runde Kappen.
  const laenge = Math.max(1, CFG.master.keylines.Square * 0.6);
  const linie = figma.createLine();
  comp.appendChild(linie);
  linie.name = 'Balken';
  linie.resize(laenge, 0);
  linie.x = (g - laenge) / 2; linie.y = g / 2;
  linie.strokes = tinte;
  linie.strokeWeight = w;
  try { linie.strokeCap = 'ROUND'; } catch (e) {}

  // Auswählen geht nur auf der aktuellen Seite — im ZDS-Board liegt das
  // Beispiel auf „Source“, also vorher dorthin wechseln.
  let seite = comp; while (seite && seite.type !== 'PAGE') seite = seite.parent;
  if (seite && seite !== figma.currentPage) {
    try { await figma.setCurrentPageAsync(seite); } catch (e) {}
  }
  try { figma.currentPage.selection = [comp]; } catch (e) {}
  logZeile('info', t('log.beispielAngelegt', { name: BEISPIEL_NAME }), comp.id,
    { name: BEISPIEL_NAME, schwere: 'info' });

  // Gleich das Set daneben bauen — dafür ist das Beispiel da.
  let ziel = null;
  try { ziel = await ADAPTER.aufloesen(comp); } catch (e) { ziel = null; }
  if (ziel) {
    const text = await einIcon(ziel, !!snap, false);
    logZeile('ok', text, comp.id, { name: ziel.name, schwere: 'info' });
  }

  // Ein Undo-Schritt für Komponente und Set.
  try { figma.commitUndo(); } catch (e) {}
  return comp;
}
