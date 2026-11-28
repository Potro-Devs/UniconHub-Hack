#!/usr/bin/env node
/**
 * Regenera `public/favicon.ico` a partir de la mascota real (`<Mascot />` del encabezado del login).
 *
 * La mascota se dibuja con HTML/CSS (no hay SVG ni imagen), así que el ícono se obtiene
 * fotografiándola en Chrome sin interfaz, con fondo transparente y a la resolución exacta de cada
 * tamaño (16, 32, 48 y 256 px) para que quede nítida. Después se empaqueta en un .ico con PNG.
 *
 * Uso (con la app corriendo, p. ej. `npm run dev`):
 *   npm run favicon
 *   npm run favicon -- --url http://localhost:3000/login --out public/favicon.ico
 * Variable opcional: CHROME_PATH (ruta de Chrome/Chromium/Edge si no se encuentra sola).
 *
 * Si cambias la mascota y regeneras el ícono, sube también `?v=` en `index.html`.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 32, 48, 256];
/** Raíz de la mascota del encabezado del login (primer hijo de la marca). */
const MASCOT_SELECTOR = '.welcome-header .brand-link';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, i, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[i + 1]]] : pairs), []),
);
const url = args.url ?? 'http://localhost:5173/login';
const out = path.resolve(FRONTEND, args.out ?? 'public/favicon.ico');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('No encontré Chrome. Define CHROME_PATH con la ruta del navegador.');
  return found;
}

/** Empaqueta PNG cuadrados en un .ico (entradas PNG, formato ICONDIR estándar). */
function packIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map(({ data }) => data)]);
}

async function main() {
  const profile = mkdtempSync(path.join(tmpdir(), 'axi-favicon-'));
  const chrome = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    // Chrome escribe el puerto elegido en DevToolsActivePort.
    let port;
    for (let i = 0; i < 100 && !port; i += 1) {
      const file = path.join(profile, 'DevToolsActivePort');
      if (existsSync(file)) port = readFileSync(file, 'utf8').split('\n')[0].trim();
      else await sleep(100);
    }
    if (!port) throw new Error('Chrome no abrió el puerto de depuración.');

    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      pending.set(++id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'Error en la página');
      return r.result.value;
    };

    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 300, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url });
    await sleep(2500);

    // Aísla la mascota: todo lo demás invisible y sin fondo; la mascota, fija arriba a la izquierda.
    const box = await evaluate(`(() => {
      const brand = document.querySelector(${JSON.stringify(MASCOT_SELECTOR)});
      if (!brand || !brand.firstElementChild) throw new Error('No encontré la mascota en ${url} (selector ${MASCOT_SELECTOR}).');
      const mascot = brand.firstElementChild;
      const css = document.createElement('style');
      css.textContent = 'html, body, #root, .welcome-page { background: transparent !important; }'
        + ' body * { visibility: hidden !important; animation: none !important; transition: none !important; }'
        + ' [data-axi-icon], [data-axi-icon] * { visibility: visible !important; }';
      document.head.append(css);
      mascot.setAttribute('data-axi-icon', '');
      Object.assign(mascot.style, { position: 'fixed', left: '20px', top: '20px', margin: '0' });
      const r = mascot.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    })()`);

    const side = Math.max(box.w, box.h) * 1.08; // 4 % de margen por lado
    const clip = { x: box.x + box.w / 2 - side / 2, y: box.y + box.h / 2 - side / 2, width: side, height: side, scale: 1 };
    const pngs = [];
    for (const size of SIZES) {
      await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 300, deviceScaleFactor: size / side, mobile: false });
      await sleep(250);
      const shot = await send('Page.captureScreenshot', { format: 'png', clip });
      const data = Buffer.from(shot.data, 'base64');
      const width = data.readUInt32BE(16);
      if (width !== size) throw new Error(`La captura de ${size} px salió de ${width} px.`);
      pngs.push({ size, data });
    }
    ws.close();

    writeFileSync(out, packIco(pngs));
    console.log(`Listo: ${path.relative(process.cwd(), out)} (${SIZES.join(', ')} px). Si cambió, sube ?v= en index.html.`);
  } finally {
    // En Windows, Chrome tarda en soltar los archivos del perfil: esperar su salida y reintentar.
    const exited = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill();
    await Promise.race([exited, sleep(3000)]);
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      console.warn(`Aviso: no pude borrar el perfil temporal de Chrome (${profile}); puedes borrarlo a mano.`);
    }
  }
}

main().catch((error) => {
  console.error(`No se pudo generar el ícono: ${error.message}`);
  process.exitCode = 1;
});
