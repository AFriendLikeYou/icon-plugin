// ===========================================================================
// 68-beispiel.js — Beispiel-Icon für den Leerzustand (Abschnitt 21).
// Ein Kreis plus Querbalken im Master-Maß: genug Geometrie, damit Keyline-Fit,
// Snapping und Flatten sichtbar etwas tun. Nur im Frei-Modus — im ZDS-Board
// gehören neue Icons auf eine Karte, nicht irgendwohin auf die Seite.
// ===========================================================================

const BEISPIEL_NAME = 'demo-icon';

async function beispielAnlegen(snap) {
  if (!ADAPTER || ADAPTER.name !== 'frei') {
    logZeile('warn', t('beispiel.nurFrei'));
    return null;
  }

  const g = CFG.master.groesse;
  const w = CFG.master.kontur;
  const seite = figma.currentPage;
  const tinte = [{ type: 'SOLID', color: { r: 0.267, g: 0.267, b: 0.267 } }];

  const comp = figma.createComponent();
  comp.name = BEISPIEL_NAME;
  comp.resize(g, g);
  comp.fills = [];
  comp.clipsContent = false;
  seite.appendChild(comp);

  // Rechts neben der Viewport-Mitte; auf einer leeren Seite schlicht bei (0,0).
  if (seite.children.length > 1) {
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

  figma.currentPage.selection = [comp];
  logZeile('info', t('log.beispielAngelegt', { name: BEISPIEL_NAME }), comp.id);

  // Gleich das Set daneben bauen — dafür ist das Beispiel da.
  let ziel = null;
  try { ziel = await ADAPTER.aufloesen(comp); } catch (e) { ziel = null; }
  if (ziel) {
    const text = await einIcon(ziel, !!snap, false);
    logZeile('ok', text, comp.id);
  }

  // Ein Undo-Schritt für Komponente und Set.
  try { figma.commitUndo(); } catch (e) {}
  return comp;
}
