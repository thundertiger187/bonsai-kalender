import { chromium } from 'playwright'; import fs from 'node:fs';
const svg = fs.readFileSync('docs/icons/logo.svg', 'utf8'), small = fs.readFileSync('docs/icons/logo-small.svg', 'utf8');
const b = await chromium.launch({ channel: 'chrome' }); const p = await b.newPage({ viewport: { width: 1100, height: 560 } });
const orig = 'data:image/jpeg;base64,' + fs.readFileSync('tools/logo/original.jpg').toString('base64');
const s = n => svg.replace('<svg ', `<svg width="${n}" height="${n}" `);
await p.setContent(`<body style="margin:0;display:flex;gap:20px;align-items:center;padding:20px;background:#F5F2EA;font:12px sans-serif">
<div style="width:520px;height:520px;background:url(${orig}) center/cover;overflow:hidden"><img src="${orig}" style="width:768px;margin:-310px 0 0 -120px;opacity:0"></div>
<div>${s(520)}</div><div style="display:flex;flex-direction:column;gap:10px">${s(64)}${s(34)}${s(24)}${s(16)}</div><div style="display:flex;flex-direction:column;gap:10px">${small.replace('<svg ','<svg width="64" height="64" ')}${small.replace('<svg ','<svg width="34" height="34" ')}${small.replace('<svg ','<svg width="24" height="24" ')}${small.replace('<svg ','<svg width="16" height="16" ')}</div></body>`);
await p.screenshot({ path: process.argv[2] || '/tmp/logo_cmp.png' }); await b.close();
