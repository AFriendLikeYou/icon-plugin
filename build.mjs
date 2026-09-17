// Baut code.js aus src/main/*.js (Konkatenation in Dateinamen-Reihenfolge) und ui.html via gen-ui.mjs.
// Aufruf: node build.mjs        Keine Abhängigkeiten.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const hier = path.dirname(new URL(import.meta.url).pathname);
const srcDir = path.join(hier, 'src', 'main');
const dateien = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
if (!dateien.length) { console.error('src/main ist leer'); process.exit(1); }

const teile = dateien.map(f => {
  const quelle = fs.readFileSync(path.join(srcDir, f), 'utf8');
  if (/^\s*(import|export)\s/m.test(quelle)) { console.error(f + ': import/export nicht erlaubt (Konkatenation)'); process.exit(1); }
  return '// ===== ' + f + ' =====\n' + quelle.trim() + '\n';
});
const kopf = '// GENERIERT von build.mjs aus src/main/*.js — nicht von Hand editieren.\n\n';
fs.writeFileSync(path.join(hier, 'code.js'), kopf + teile.join('\n'));
execFileSync(process.execPath, ['--check', path.join(hier, 'code.js')], { stdio: 'inherit' });
console.log('code.js gebaut aus', dateien.join(', '));
execFileSync(process.execPath, [path.join(hier, 'gen-ui.mjs')], { stdio: 'inherit' });
