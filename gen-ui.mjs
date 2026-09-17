// Baut ui.html aus src/ui/** — figui3 (vendored fig.css/fig.js) + eigene Module.
// Aufruf: node gen-ui.mjs   (wird von build.mjs aufgerufen). Keine Abhängigkeiten.
//   src/ui/style/*.css      → ein <style>-Block (Dateinamen-Reihenfolge)
//   src/ui/woerter/*.mjs    → export default { de:{}, en:{} }, tief gemischt (spätere Dateien überschreiben)
//   src/ui/markup/*.html    → Body-Markup (Reihenfolge)
//   src/ui/logik/*.js       → EIN klassisches <script> (Reihenfolge); Platzhalter __WOERTER__ = JSON des Wörterbuchs
//   src/ui/inhalte/*.mjs    → export default …, je Datei ein Schlüssel (Dateiname ohne .mjs);
//                             Platzhalter __INHALTE__ = JSON davon (siehe docs/INHALTE.md)
import fs from 'fs';
import path from 'path';
const hier = path.dirname(new URL(import.meta.url).pathname);
const lese = (ordner, ext) => fs.readdirSync(path.join(hier, 'src/ui', ordner)).filter(f => f.endsWith(ext)).sort()
  .map(f => ({ f, text: fs.readFileSync(path.join(hier, 'src/ui', ordner, f), 'utf8') }));

const figCss = fs.readFileSync(path.join(hier, 'fig.css'), 'utf8');
const figJs  = fs.readFileSync(path.join(hier, 'fig.js'),  'utf8');
const css    = lese('style', '.css').map(x => '/* ' + x.f + ' */\n' + x.text).join('\n');
const markup = lese('markup', '.html').map(x => '<!-- ' + x.f + ' -->\n' + x.text).join('\n');

const WOERTER = { de: {}, en: {} };
for (const f of fs.readdirSync(path.join(hier, 'src/ui/woerter')).filter(f => f.endsWith('.mjs')).sort()) {
  const mod = await import(path.join(hier, 'src/ui/woerter', f));
  for (const sp of ['de', 'en']) Object.assign(WOERTER[sp], (mod.default || {})[sp] || {});
}
const fehltEn = Object.keys(WOERTER.de).filter(k => !(k in WOERTER.en));
const fehltDe = Object.keys(WOERTER.en).filter(k => !(k in WOERTER.de));
if (fehltEn.length || fehltDe.length) { console.error('Wörterbuch unvollständig — fehlt in en:', fehltEn, 'fehlt in de:', fehltDe); process.exit(1); }

// Inhalte (Texte und Grafiken, vom Nutzer pflegbar): je Datei ein Schlüssel.
const INHALTE = {};
const inhalteDir = path.join(hier, 'src/ui/inhalte');
if (fs.existsSync(inhalteDir)) {
  for (const f of fs.readdirSync(inhalteDir).filter(f => f.endsWith('.mjs')).sort()) {
    const mod = await import(path.join(inhalteDir, f));
    INHALTE[f.slice(0, -4)] = mod.default;
  }
}
// `<` in Daten würde das umschließende <script> beenden — deshalb escapen.
const alsSkript = o => JSON.stringify(o).split('<').join('\\u003c');

const logik = lese('logik', '.js').map(x => '  // ===== ' + x.f + ' =====\n' + x.text).join('\n')
  .replace('__WOERTER__', alsSkript(WOERTER))
  .replace('__INHALTE__', alsSkript(INHALTE));
if (/__WOERTER__/.test(logik)) { console.error('Platzhalter __WOERTER__ mehrfach'); process.exit(1); }
if (/__INHALTE__/.test(logik)) { console.error('Platzhalter __INHALTE__ mehrfach'); process.exit(1); }

const html = [
  '<style>', figCss, '</style>',
  '<style>', css, '</style>',
  markup,
  '<script type="module">', figJs, '</scr' + 'ipt>',
  '<script>', logik, '</scr' + 'ipt>'
].join('\n');
fs.writeFileSync(path.join(hier, 'ui.html'), html);
console.log('ui.html gebaut:', html.length, 'Zeichen —', lese('logik', '.js').length, 'Logik-Module,',
  Object.keys(WOERTER.de).length, 'Wörter,', Object.keys(INHALTE).length, 'Inhalte-Dateien');
