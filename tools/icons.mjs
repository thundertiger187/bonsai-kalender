// Rendert PNG-Icons, Favicon und screens/logo.png aus docs/icons/logo.svg / logo-small.svg (Chrome headless).
// logo-small.svg (geschlossene Feinlinien) wird für Größen ≤ 48 px genutzt.
import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const D = path.join(ROOT, 'docs/icons');
const full = fs.readFileSync(path.join(D, 'logo.svg'), 'utf8');
const small = fs.readFileSync(path.join(D, 'logo-small.svg'), 'utf8');
const BG = '#E6DCCB';   // Papierton, heller als die Vorlage
// Favicon-SVG: kleines Logo auf Papierton-Quadrat
const vb = small.match(/viewBox="([^"]+)"/)[1];
const inner = small.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
fs.writeFileSync(path.join(D, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="104" fill="${BG}"/><svg x="26" y="26" width="460" height="460" viewBox="${vb}">${inner}</svg></svg>\n`);
const b = await chromium.launch({ channel: 'chrome' }); const p = await b.newPage();
async function shot(file, size, { scale = 1, radius = 0, bg = BG, svg = full } = {}) {
  await p.setViewportSize({ width: size, height: size });
  const s = Math.round(size * scale);
  await p.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;background:${bg};border-radius:${radius * size}px;display:grid;place-items:center">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div></body></html>`);
  await p.screenshot({ path: file, omitBackground: true });
}
await shot(path.join(D, 'icon-192.png'), 192, { scale: .84, radius: .22 });
await shot(path.join(D, 'icon-512.png'), 512, { scale: .84, radius: .22 });
await shot(path.join(D, 'maskable-512.png'), 512, { scale: .62 });           // Motiv innerhalb des 80-%-Sicherheitskreises
await shot(path.join(D, 'apple-touch-icon.png'), 180, { scale: .82 });
await shot(path.join(D, 'favicon-32.png'), 32, { scale: .92, radius: .2, svg: small });
fs.mkdirSync(path.join(ROOT, 'screens'), { recursive: true });
await shot(path.join(ROOT, 'screens/logo.png'), 512, { scale: .9, bg: 'transparent' });
await b.close(); console.log('Icons erzeugt');
