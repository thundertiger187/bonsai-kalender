// Rendert PNG-Icons, Favicon und screens/logo.png aus docs/icons/logo.svg (Chrome headless).
import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const D = path.join(ROOT, 'docs/icons');
const svg = fs.readFileSync(path.join(D, 'logo.svg'), 'utf8');
const BG = '#E8EDDF';
// Favicon-SVG: Logo auf hellem Salbei-Quadrat
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
fs.writeFileSync(path.join(D, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${BG}"/><g transform="translate(40 34) scale(.84)">${inner}</g></svg>\n`);
const b = await chromium.launch({ channel: 'chrome' }); const p = await b.newPage();
async function shot(file, size, { scale = 1, radius = 0, bg = BG } = {}) {
  await p.setViewportSize({ width: size, height: size });
  const s = Math.round(size * scale);
  await p.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;background:${bg};border-radius:${radius * size}px;display:grid;place-items:center">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div></body></html>`);
  await p.screenshot({ path: file, omitBackground: true });
}
await shot(path.join(D, 'icon-192.png'), 192, { scale: .86, radius: .22 });
await shot(path.join(D, 'icon-512.png'), 512, { scale: .86, radius: .22 });
await shot(path.join(D, 'maskable-512.png'), 512, { scale: .66 });           // Inhalt innerhalb der 80-%-Sicherheitszone
await shot(path.join(D, 'apple-touch-icon.png'), 180, { scale: .8 });
await shot(path.join(D, 'favicon-32.png'), 32, { scale: .94, radius: .2 });
fs.mkdirSync(path.join(ROOT, 'screens'), { recursive: true });
await shot(path.join(ROOT, 'screens/logo.png'), 512, { scale: .9, bg: '#F5F2EA', radius: 0 });
await b.close(); console.log('Icons erzeugt');
