/**
 * Genera output/pitch/Axi-pitch-PotroDevs.zip: un solo HTML que se abre con doble clic en
 * Chrome o Edge, sin servidor, sin backend y sin internet (las fuentes usan respaldo del
 * sistema si no hay conexión). Uso, desde la raíz: npm run pitch:zip
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'output', 'pitch');
const buildDir = path.join(outDir, 'build');
const packageDir = path.join(outDir, 'Axi-pitch-PotroDevs');
const zipFile = path.join(outDir, 'Axi-pitch-PotroDevs.zip');

execFileSync(process.execPath, [path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.pitch.config.js'],
  { cwd: path.join(root, 'frontend'), stdio: 'inherit' });

// Incrusta el JS y el CSS generados dentro del HTML.
let html = fs.readFileSync(path.join(buildDir, 'pitch.html'), 'utf8');
const assets = path.join(buildDir, 'assets');
let jsFile = null;
html = html
  .replace(/<script type="module" crossorigin src="\.\/assets\/([^"]+)"><\/script>\s*/, (_, file) => { jsFile = file; return ''; })
  .replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/([^"]+)">/, (_, file) => `<style>${fs.readFileSync(path.join(assets, file), 'utf8')}</style>`);
if (!jsFile) throw new Error('No se encontró el script compilado en pitch.html.');
const js = fs.readFileSync(path.join(assets, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script');
// Funciones de reemplazo para que los "$" del código no se interpreten como patrones.
html = html.replace('</body>', () => `<script type="module">${js}</script>\n</body>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('Quedó una referencia a assets externos.');

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });
fs.writeFileSync(path.join(packageDir, 'Axi-pitch.html'), html);
fs.copyFileSync(path.join(root, 'docs', 'pitch-guion.md'), path.join(packageDir, 'guion-del-pitch.md'));
fs.writeFileSync(path.join(packageDir, 'LEEME.txt'), [
  'Axi · Pitch · PotroDevs',
  'Raúl Treviño Licona · Lizbeth Ocampo Blanco · Osvaldo Estrada Lara',
  '',
  'CÓMO VERLO',
  '1. Descomprime este .zip en cualquier carpeta.',
  '2. Abre "Axi-pitch.html" con Google Chrome o Microsoft Edge (doble clic o arrastrándolo a la ventana).',
  '   No necesita instalar nada, ni servidor, ni internet.',
  '3. Pulsa "Reproducir presentación". Duración: 2:48.',
  '',
  'CONTROLES',
  '- Espacio: reproducir / pausar      - Flechas ← →: escena anterior / siguiente',
  '- M o botón "Sonido": música y efectos (empiezan apagados)',
  '- C o "Modo limpio": oculta los controles para presentar o grabar; Esc los muestra',
  '- Botón ⛶: pantalla completa      - "Guion y notas": texto para narrar cada escena',
  '',
  'PARA GRABAR EL VIDEO',
  'Pantalla completa → Modo limpio → activa Sonido → reproduce y narra con "guion-del-pitch.md".',
  '',
  'Nota: las capturas son del prototipo con datos ficticios. Sin internet, las letras usan',
  'la fuente del sistema; con internet se ven con la tipografía original.',
  '',
].join('\r\n'));

fs.rmSync(zipFile, { force: true });
if (process.platform === 'win32') {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${packageDir}' -DestinationPath '${zipFile}' -Force`], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', zipFile, path.basename(packageDir)], { cwd: outDir, stdio: 'inherit' });
}
fs.rmSync(buildDir, { recursive: true, force: true });
const size = (fs.statSync(zipFile).size / 1024 / 1024).toFixed(1);
console.log(`Listo: ${path.relative(root, zipFile)} (${size} MB)`);
