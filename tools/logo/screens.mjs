// screens/10_logo_header.png (Header + Info, 390×844 und Desktop) und screens/11_icon_preview.png
import { chromium } from 'playwright'; import { spawn } from 'node:child_process'; import path from 'node:path'; import fs from 'node:fs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const srv = spawn('python3', ['-m', 'http.server', '18756', '--bind', '127.0.0.1', '-d', 'docs'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900)); const base = 'http://127.0.0.1:18756/';
const b = await chromium.launch({ channel: 'chrome' });
const grab = async (w, h, hash) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.goto(base + hash); await p.waitForTimeout(600); const buf = await p.screenshot(); await p.close(); return buf.toString('base64'); };
const shots = [await grab(390, 844, '#/'), await grab(390, 844, '#/info'), await grab(1280, 800, '#/info')];
const p = await b.newPage({ viewport: { width: 1900, height: 900 } });
await p.setContent(`<body style="margin:0;padding:20px;background:#ccc;display:flex;gap:20px;align-items:flex-start">${shots.map((s, i) => `<img src="data:image/png;base64,${s}" style="height:${i < 2 ? 844 : 600}px;box-shadow:0 2px 8px #0003">`).join('')}</body>`);
await p.screenshot({ path: path.join(ROOT, 'screens/10_logo_header.png'), fullPage: true });
const u = f => `data:image/${f.endsWith('svg') ? 'svg+xml' : 'png'};base64,` + fs.readFileSync(path.join(ROOT, 'docs/icons', f)).toString('base64');
await p.setContent(`<body style="margin:0;padding:30px;background:#fff;font:14px sans-serif;display:flex;gap:40px;align-items:flex-end">
<figure><img src="${u('icon-192.png')}"><figcaption>icon-192.png</figcaption></figure>
<figure><img src="${u('maskable-512.png')}" width="256" style="border-radius:50%"><figcaption>maskable (Kreis-Maske)</figcaption></figure>
<figure><img src="${u('maskable-512.png')}" width="256" style="border-radius:22%"><figcaption>maskable (Squircle)</figcaption></figure>
<figure><img src="${u('apple-touch-icon.png')}"><figcaption>apple-touch-icon</figcaption></figure>
<figure><img src="${u('favicon-32.png')}"> <img src="${u('favicon.svg')}" width="16"><figcaption>favicon 32 / 16</figcaption></figure></body>`);
await p.setViewportSize({ width: 1000, height: 330 }); await p.waitForTimeout(500); await p.screenshot({ path: path.join(ROOT, 'screens/11_icon_preview.png'), fullPage: true });
await b.close(); srv.kill();
