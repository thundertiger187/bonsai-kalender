// E2E + Layout-Prüfung + Screenshots. Aufruf: node tests/e2e.mjs [BASIS_URL]
// Ohne URL wird docs/ lokal mit python3 -m http.server ausgeliefert.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCREENS = path.join(ROOT, 'screens'); fs.mkdirSync(SCREENS, { recursive: true });
let base = process.argv[2], server;
if (!base) { server = spawn('python3', ['-m', 'http.server', '18755', '--bind', '127.0.0.1', '-d', 'docs'], { cwd: ROOT, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 900)); base = 'http://127.0.0.1:18755/'; }
const NOW = '2026-11-03T10:00:00+01:00';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = []; const ok = (n, x = '') => { results.push(n); console.log(`✓ ${n}${x ? ' – ' + x : ''}`); };
const shot = async (page, name, full = false) => { await page.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); scrollTo(0, 0); }); await page.mouse.move(1, 1); await page.waitForTimeout(80); return page.screenshot({ path: path.join(SCREENS, name), fullPage: full }); };

async function newPage(vp, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, locale: 'de-DE', timezoneId: 'Europe/Berlin', ...ctxOpts });
  await ctx.addInitScript(n => { window.__BONSAI_NOW = n; }, NOW);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  return { ctx, page, errors };
}
async function addTree(page, { name, species, variant, year, notes, photo }) {
  await page.goto(base + '#/baeume'); await page.waitForSelector('main .pagehead');
  await page.goto(base + '#/baum/neu'); await page.waitForSelector('#treeform');
  await page.fill('#f-name', name);
  await page.selectOption('#f-species', species);
  if (variant) await page.selectOption('#f-variant', variant);
  if (year) await page.fill('#f-year', String(year));
  if (notes) await page.fill('#f-notes', notes);
  if (photo) { await page.setInputFiles('#f-photo', photo); await page.waitForSelector('#photoprev:not([hidden]) img'); }
}

try {
  // ---------- Hauptablauf auf 390×844 ----------
  const { ctx, page, errors } = await newPage({ width: 390, height: 844 });
  await page.goto(base);
  await page.waitForSelector('.welcome');
  ok('Start ohne Bäume zeigt Einstieg');

  // Formular-Validierung
  await page.goto(base + '#/baum/neu'); await page.click('button[type=submit]');
  assert.match(await page.textContent('#formerr'), /Namen/);
  ok('Formular verlangt Namen');

  await addTree(page, { name: 'Kleiner Ahorn', species: 'faecherahorn', year: 2019, notes: 'Aus Importware, 2023 umgetopft.', photo: path.join(ROOT, 'tests/fixtures/baum.jpg') });
  await shot(page, '03_baum_anlegen.png');
  await page.click('button[type=submit]');
  await page.waitForSelector('.yeargrid');
  assert.match(await page.textContent('h1'), /Kleiner Ahorn/);
  assert.ok(await page.locator('.hero-photo').count() === 1, 'Foto sichtbar');
  ok('Baum angelegt (mit Foto aus IndexedDB)');

  await addTree(page, { name: 'Satsuki am Fenster', species: 'satsuki-azalee', variant: 'Satsuki, jung', year: 2022 }); await page.click('button[type=submit]'); await page.waitForSelector('.yeargrid');
  await addTree(page, { name: 'Waldkiefer vom Hang', species: 'waldkiefer', year: 2015 }); await page.click('button[type=submit]'); await page.waitForSelector('.yeargrid');
  await addTree(page, { name: 'Fukientee', species: 'fukientee' }); await page.click('button[type=submit]'); await page.waitForSelector('.yeargrid');
  ok('Vier Bäume angelegt');

  // Bearbeiten
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsaijahr.trees')).find(t => t.name === 'Fukientee').id);
  await page.goto(base + `#/baum/${id}/bearbeiten`); await page.fill('#f-name', 'Fukientee Carmona'); await page.click('button[type=submit]');
  await page.waitForSelector('h1:has-text("Fukientee Carmona")');
  ok('Baum bearbeitet');

  // Start: Baumzeilen, standardmäßig zugeklappt
  await page.goto(base + '#/');
  await page.waitForSelector('.trow');
  assert.equal(await page.locator('.trow').count(), 4);
  assert.match(await page.textContent('h1'), /November/);
  assert.equal(await page.locator('.trow.open').count(), 0);
  assert.equal(await page.locator('.trow-head[aria-expanded=true]').count(), 0);
  const ahorn = page.locator('.trow', { hasText: 'Kleiner Ahorn' });
  assert.equal(await ahorn.locator('.trow-panel').evaluate(e => Math.round(e.getBoundingClientRect().height)), 0);
  assert.ok(await ahorn.locator('.trow-panel').evaluate(e => e.inert));
  const total = await ahorn.locator('.task').count();
  assert.equal((await ahorn.locator('.count').textContent()).trim(), `${total} offen`);
  ok('Baumzeilen zugeklappt mit Zähler', `${total} offen`);
  await shot(page, '20_heute_zeilen.png');
  // Aufklappen
  await ahorn.locator('.trow-head').click(); await page.waitForTimeout(400);
  assert.equal(await ahorn.locator('.trow-head').getAttribute('aria-expanded'), 'true');
  assert.ok(await ahorn.locator('.trow-panel').evaluate(e => e.getBoundingClientRect().height > 80 && !e.inert));
  const types = await ahorn.locator('.task').evaluateAll(xs => xs.map(x => x.dataset.type));
  assert.ok(types.includes('giessen') && types.includes('standort'), types.join());
  assert.match(await ahorn.locator('.task[data-type=giessen]').textContent(), /wenig gießen/);
  assert.equal(await ahorn.locator('.task .ticon svg').count(), total);
  ok('Aufklappen zeigt Pflegeschritte mit Symbolen', types.join(', '));
  // Mehrere gleichzeitig offen
  const kiefer = page.locator('.trow', { hasText: 'Waldkiefer' });
  await kiefer.locator('.trow-head').click(); await page.waitForTimeout(400);
  assert.equal(await page.locator('.trow.open').count(), 2);
  // Abhaken im Dropdown: Zähler sinkt, Zeile bleibt offen
  await ahorn.locator('.tick').first().click();
  await page.waitForFunction(() => document.querySelector('.trow[data-tree] .tick[aria-pressed=true]'));
  assert.equal((await ahorn.locator('.count').textContent()).trim(), `${total - 1} offen`);
  assert.equal(await ahorn.locator('.trow-head').getAttribute('aria-expanded'), 'true');
  ok('Abhaken im Dropdown, Zähler aktualisiert, Zeile bleibt offen');
  await kiefer.locator('.trow-head').click(); await page.waitForTimeout(400);
  await shot(page, '21_heute_aufgeklappt.png');
  // Zuklappen
  await ahorn.locator('.trow-head').click(); await page.waitForTimeout(400);
  assert.equal(await ahorn.locator('.trow-head').getAttribute('aria-expanded'), 'false');
  assert.equal(await ahorn.locator('.trow-panel').evaluate(e => Math.round(e.getBoundingClientRect().height)), 0);
  ok('Zuklappen');
  // Tastatur
  await ahorn.locator('.trow-head').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(350);
  assert.equal(await ahorn.locator('.trow-head').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Space'); await page.waitForTimeout(350);
  assert.equal(await ahorn.locator('.trow-head').getAttribute('aria-expanded'), 'false');
  ok('Auf- und Zuklappen per Tastatur');
  await page.reload(); await page.waitForSelector('.trow');
  assert.equal(await page.locator('.trow.open').count(), 0);
  await ahorn.locator('.trow-head').click(); await page.waitForTimeout(350);
  assert.equal(await ahorn.locator('.tick[aria-pressed=true]').count(), 1);
  assert.match(await ahorn.locator('.count').textContent(), new RegExp(`${total - 1} offen`));
  ok('Abhaken bleibt nach Neuladen erhalten, Zeilen nach Neuladen zu');
  await shot(page, '01_start_monat.png');
  // Monatsnavigation
  await page.click('[aria-label="Nächster Monat"]');
  await page.waitForSelector('h1:has-text("Dezember 2026")');
  await page.locator('.trow', { hasText: 'Kleiner Ahorn' }).locator('.trow-head').click(); await page.waitForTimeout(350);
  assert.equal(await page.locator('.trow', { hasText: 'Kleiner Ahorn' }).locator('.tick[aria-pressed=true]').count(), 0);
  ok('Monatsnavigation, Häkchen gelten je Monat');
  // Woche
  await page.goto(base + '#/'); await page.click('[data-mode=woche]');
  await page.waitForSelector('h1:has-text("Diese Woche")');
  assert.match(await page.textContent('.notice'), /je Monat/);
  ok('Wochenansicht mit Hinweis');
  await page.click('[data-mode=monat]');

  // Meine Bäume: Zeilen, aufgeklappt Monatsschritte + Bearbeiten
  await page.goto(base + '#/baeume'); await page.waitForSelector('.trows');
  assert.equal(await page.locator('.trow').count(), 4);
  assert.equal(await page.locator('.trow.open').count(), 0);
  await shot(page, '02_meine_baeume.png');
  const mrow = page.locator('.trow', { hasText: 'Kleiner Ahorn' });
  await mrow.locator('.trow-head').click(); await page.waitForTimeout(400);
  assert.match(await mrow.locator('.trow-label').textContent(), /November/);
  assert.ok(await mrow.locator('.task').count() > 0);
  assert.equal(await mrow.locator('.tick[aria-pressed=true]').count(), 1);
  await shot(page, '22_meine_baeume_zeilen.png');
  await mrow.locator('a:has-text("Bearbeiten")').click(); await page.waitForSelector('#treeform');
  ok('Meine Bäume: Zeilen, Monatsschritte im Dropdown, Bearbeiten');

  // Jahresübersicht
  await page.goto(base + '#/art/faecherahorn'); await page.waitForSelector('.yeargrid');
  assert.equal(await page.locator('.yeargrid thead button').count(), 12);
  await page.click('.yeargrid thead button[data-month="4"]');
  await page.waitForSelector('#monthdetail h3:has-text("April")');
  assert.match(await page.textContent('#monthdetail'), /Pinzieren/);
  assert.match(await page.textContent('.source'), /Bonsai-Arbeitskreis Hildesheim/);
  const pdf = await page.getAttribute('.source a[href*="get_file.php"]', 'href');
  assert.match(pdf, /get_file\.php\?id=26283865/);
  await page.evaluate(() => scrollTo(0, 0));
  await shot(page, '04_jahresuebersicht.png');
  ok('Jahresübersicht, Monat antippen, Quelle mit PDF-Link');
  // Variante Satsuki
  await page.goto(base + '#/art/satsuki-azalee'); await page.click('.variants a:has-text("Satsuki, jung")');
  await page.waitForSelector('.variants a[aria-pressed=true]:has-text("jung")');
  ok('Varianten-Umschaltung Satsuki');

  // Arten
  await page.goto(base + '#/arten'); await page.waitForSelector('.list');
  assert.equal(await page.locator('.list li').count(), 50);
  await shot(page, '05_arten.png');
  await page.fill('#q', 'kiefer');
  await page.waitForFunction(() => document.querySelectorAll('#speciesresults li').length === 2);
  await page.fill('#q', ''); await page.click('[data-cat=Indoor]');
  const nIndoor = await page.locator('#speciesresults li').count(); assert.ok(nIndoor > 0 && nIndoor < 50);
  ok('Arten-Suche und Filter', `Indoor: ${nIndoor}`);

  // Info
  await page.goto(base + '#/info'); await page.waitForSelector('h2:has-text("Quelle")');
  assert.ok(await page.locator('a[href*="pflegekalender-ueber-das-jahr"]').count() >= 1);
  await shot(page, '06_info_quelle.png');
  ok('Info mit Quellenangabe');

  // Export
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const exp = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); assert.equal(exp.trees.length, 4);
  ok('Export JSON');

  // Löschen
  page.once('dialog', d => d.accept());
  const wid = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsaijahr.trees')).find(t => t.name.startsWith('Waldkiefer')).id);
  await page.goto(base + `#/baum/${wid}/bearbeiten`); await page.click('#treedel');
  await page.waitForSelector('.trows'); assert.equal(await page.locator('.trow').count(), 3);
  ok('Baum gelöscht');

  // Offline
  await page.goto(base + '#/');
  await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  await page.reload(); await page.waitForSelector('.trow');
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('.trow');
  await page.goto(base + '#/art/zierquitte'); await page.waitForSelector('.yeargrid');
  const ff = await page.evaluate(() => document.fonts.check('16px Inter'));
  ok('Offline: Start und Art laden aus dem Cache', `Schrift geladen: ${ff}`);
  await ctx.setOffline(false);
  assert.deepEqual(errors, []);
  ok('Keine JS-Fehler');
  const state = await ctx.storageState({ indexedDB: true });
  await ctx.close();

  // ---------- Desktop ----------
  {
    const { ctx, page } = await newPage({ width: 1440, height: 900 }, { storageState: state, deviceScaleFactor: 1 });
    // Fotos liegen in IndexedDB (Blobs) und werden nicht über storageState übertragen – Foto hier erneut setzen
    await page.goto(base); const aid = await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('bonsaijahr.trees')); return t.find(x => x.name === 'Kleiner Ahorn').id; });
    await page.goto(base + `#/baum/${aid}/bearbeiten`); await page.setInputFiles('#f-photo', path.join(ROOT, 'tests/fixtures/baum.jpg'));
    await page.waitForSelector('#photoprev:not([hidden]) img'); await page.click('button[type=submit]'); await page.waitForSelector('.hero-photo');
    await page.goto(base + '#/'); await page.waitForSelector('.trow .avatar img'); await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); await page.locator('.trow-head').first().click(); await page.waitForTimeout(300);
    await shot(page, '07_desktop.png');
    await ctx.close();
  }

  // ---------- Layout ----------
  const ROUTES = ['#/', '#/?modus=woche', '#/baeume', '#/baum/neu', '#/art/faecherahorn', '#/art/satsuki-azalee', '#/art/pfaffenhuetchen', '#/arten', '#/info', 'TREE'];
  const VPS = [[360, 640], [390, 844], [412, 915], [1440, 900]];
  const problems = [];
  for (const [w, h] of VPS) {
    const { ctx, page } = await newPage({ width: w, height: h }, { storageState: state });
    const tid = await (async () => { await page.goto(base); return page.evaluate(() => JSON.parse(localStorage.getItem('bonsaijahr.trees'))[0].id); })();
    for (const r0 of ROUTES) {
      const r = r0 === 'TREE' ? `#/baum/${tid}` : r0;
      await page.goto(base + r); await page.waitForSelector('main .pagehead'); await page.waitForTimeout(120);
      for (const expand of (r0 === '#/' || r0 === '#/baeume' || r0 === '#/?modus=woche') ? [false, true] : [false]) {
      if (expand) { for (const h of await page.locator('.trow-head').all()) if (await h.getAttribute('aria-expanded') === 'false') await h.click(); await page.waitForTimeout(400); }
      const bad = await page.evaluate(() => {
        const out = [], vw = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth > vw + 1) out.push(`horizontaler Überlauf ${document.documentElement.scrollWidth}>${vw}`);
        for (const e of document.querySelectorAll('main *, .nav a')) {
          const b = e.getBoundingClientRect(); if (!b.width || getComputedStyle(e).position === 'absolute' || e.closest('.sr-only')) continue;
          if (b.right > vw + 1 || b.left < -1) out.push(`${e.tagName}.${e.className?.baseVal ?? e.className} ragt raus (${Math.round(b.left)}–${Math.round(b.right)})`);
        }
        const groups = ['.task > *', '.trow-head > *', '.trow-actions > *', '.nav > a', '.monthbar > *', '.pagehead.between > *', '.form .actions > *, .form .actions .r > *', '.list a > *', '.chips > *', '.yeargrid thead th'];
        for (const g of groups) for (const parent of new Set([...document.querySelectorAll(g)].map(e => e.parentElement))) {
          const kids = [...parent.children].filter(k => k.matches(g) && k.getBoundingClientRect().width);
          for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
            const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
            const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (ox > 1 && oy > 1) out.push(`Überlappung in ${g}: ${kids[i].className || kids[i].tagName} ∩ ${kids[j].className || kids[j].tagName}`);
          }
        }
        for (const e of document.querySelectorAll('.btn, .chip, .seg button, .nav a span, .yeargrid .rl span:not(.sr-only)')) if (e.scrollWidth > e.clientWidth + 1) out.push(`Text abgeschnitten: ${e.textContent.trim().slice(0, 30)}`);
        return [...new Set(out)];
      });
      if (bad.length) problems.push(`${w}×${h} ${r}${expand ? ' (aufgeklappt)' : ''}: ${bad.slice(0, 6).join(' | ')}`);
      }
      await page.evaluate(() => scrollTo(0, 0));
      if (w === 360 && r0 === '#/art/faecherahorn') await shot(page, 'layout_360_jahresuebersicht.png');
      if (w === 360 && r0 === '#/') await shot(page, 'layout_360_start.png');
      if (w === 390 && r0 === 'TREE') await shot(page, 'layout_390_baum.png');
      if (w === 360 && r0 === '#/?modus=woche') await shot(page, 'layout_360_woche.png');
    }
    // Mobil: letzter Inhalt nicht unter der Navigationsleiste
    if (w < 760) {
      await page.goto(base + '#/info'); await page.waitForSelector('h2'); await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(100);
      const hidden = await page.evaluate(() => { const nav = document.querySelector('.nav').getBoundingClientRect(); const last = [...document.querySelectorAll('main > *')].pop().getBoundingClientRect(); return last.bottom > nav.top + 1 ? [Math.round(last.bottom), Math.round(nav.top), innerHeight, scrollY, document.body.scrollHeight] : false; });
      if (hidden) problems.push(`${w}×${h}: letzter Inhalt unter der Navigationsleiste ${hidden}`);
    }
    await ctx.close();
  }
  if (problems.length) { console.log('Layout-Probleme:\n' + problems.join('\n')); process.exitCode = 1; }
  else ok('Layout ohne Überlauf/Überlappung', VPS.map(v => v.join('×')).join(', ') + ` · ${ROUTES.length} Ansichten`);
} catch (e) {
  console.error('✗', e); process.exitCode = 1;
} finally {
  await browser.close(); server?.kill();
  console.log(`${results.length} Prüfungen bestanden${process.exitCode ? ', FEHLER siehe oben' : ''}`);
}
