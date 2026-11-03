// Erzeugt ein Testfoto (tests/fixtures/baum.jpg) für die E2E-Tests.
import { chromium } from 'playwright'; import fs from 'node:fs';
const svg = fs.readFileSync('docs/icons/logo.svg', 'utf8').replace('<svg ', '<svg width="560" height="560" ');
const b = await chromium.launch({ channel: 'chrome' }); const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.setContent(`<body style="margin:0;height:600px;background:radial-gradient(circle at 60% 30%,#dfe6d3,#a9b79a 60%,#6f7d63);display:grid;place-items:center;overflow:hidden"><div style="filter:drop-shadow(0 18px 18px rgba(0,0,0,.25));margin-top:40px">${svg}</div></body>`);
await p.screenshot({ path: 'tests/fixtures/baum.jpg', type: 'jpeg', quality: 85 }); await b.close();
