import { MONTHS, MONTHS_SHORT, TYPE_LABEL, LIGHT_LABEL, tasksForMonth, generalRows, upcomingTasks, weekOf, daysLeftInMonth,
  doneKey, searchSpecies, cleanTree, variantOf, rowActive, rowLabel, treeTasks, openLabel } from './logic.js';
import * as store from './store.js';

const view = document.getElementById('view');
const CATS = ['Laub', 'Nadel', 'Nicht winterhart', 'Indoor'];
let DATA, SPECIES = {}, photoUrls = {};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const tc = type => `style="--tc:var(--t-${type})"`;
const today = () => window.__BONSAI_NOW ? new Date(window.__BONSAI_NOW) : new Date();
const catTag = c => `<span class="tag cat-${esc(c.split(' ')[0])}">${esc(c)}</span>`;
const speciesLine = (sp, variant) => `${esc(sp.name)}${variant ? ` · ${esc(variant)}` : ''}`;

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t); setTimeout(() => t.remove(), 2600);
}

async function photoUrl(treeId) {
  if (photoUrls[treeId]) return photoUrls[treeId];
  try { const b = await store.getPhoto(treeId); if (b) return (photoUrls[treeId] = URL.createObjectURL(b)); } catch {}
  return null;
}
const dropPhotoUrl = id => { if (photoUrls[id]) { URL.revokeObjectURL(photoUrls[id]); delete photoUrls[id]; } };
async function fillPhotos() {
  for (const el of view.querySelectorAll('[data-photo]')) {
    const u = await photoUrl(el.dataset.photo);
    if (u) el.innerHTML = `<img src="${u}" alt="">`;
  }
}

// ---------- Aufgaben-Darstellung ----------
function taskDetail(t) {
  const parts = [];
  const lights = t.light.map(l => `<span class="light-chip">${icon('standort')}${esc(LIGHT_LABEL[l] || l)}</span>`).join('');
  if (t.texts.length) parts.push(esc(t.texts.join(' · ')));
  return `${lights || parts.length ? `<div class="det">${lights}${parts.join('')}</div>` : ''}${t.remark ? `<div class="rem">${esc(t.remark)}</div>` : ''}${t.notes.map(n => `<div class="fn">${esc(n)}</div>`).join('')}`;
}
function taskTitle(t) {
  if (t.type === 'standort' && /winter/i.test(t.remark) && !/standort/i.test(t.label)) return esc(t.label);
  return esc(t.label);
}
function taskItem(t, { tree, year, month, showMonth, done } = {}) {
  const key = tree ? doneKey(tree.id, year, month, t.key) : null;
  const isDone = key && done[key];
  return `<li class="task${isDone ? ' done' : ''}" data-type="${t.type}">
    <span class="ticon" ${tc(t.type)} title="${esc(TYPE_LABEL[t.type])}">${icon(t.type)}</span>
    <div><div class="ttl">${taskTitle(t)}${t.optional ? '<span class="opt">auch noch möglich</span>' : ''}${showMonth ? `<span class="mon">${MONTHS[month - 1]}</span>` : ''}</div>${taskDetail(t)}</div>
    ${key ? `<button class="tick" data-done="${esc(key)}" aria-pressed="${isDone ? 'true' : 'false'}" aria-label="${esc(t.label)} erledigt">${icon('check')}</button>` : ''}
  </li>`;
}

// ---------- Baumzeile mit aufklappbaren Pflegeschritten ----------
const openRows = new Set();   // in dieser Sitzung aufgeklappte Bäume (beim Start alle zu)
const avatar = t => `<span class="avatar" data-photo="${t.id}"><span class="ini">${esc((t.name.trim()[0] || '?').toUpperCase())}</span></span>`;
function treeRow(tree, sp, periods, done, { upcoming = '', actions = '', sub = '', label = '' } = {}) {
  const s = treeTasks(sp, tree, periods, done), open = openRows.has(tree.id), pid = `tp-${tree.id}`;
  const items = s.items.map(i => taskItem(i.task, { tree, year: i.year, month: i.month, showMonth: periods.length > 1, done }));
  return `<li class="trow${open ? ' open' : ''}" data-tree="${tree.id}">
    <button class="trow-head" type="button" aria-expanded="${open}" aria-controls="${pid}" data-row="${tree.id}">
      ${avatar(tree)}
      <span class="t"><span class="name">${esc(tree.name)}</span><span class="species">${speciesLine(sp, tree.variant)}${sub}</span></span>
      <span class="count${s.total && !s.open ? ' ok' : ''}${!s.total ? ' none' : ''}">${s.total && !s.open ? icon('check') : ''}${openLabel(s)}</span>
      ${icon('down', 'chev')}
    </button>
    <div class="trow-panel" id="${pid}" role="region" aria-label="Pflegeschritte ${esc(tree.name)}"${open ? '' : ' inert'}><div class="trow-inner">
      ${label ? `<div class="trow-label">Pflegeschritte im ${label}</div>` : ''}
      ${items.length ? `<ul class="tasks">${items.join('')}</ul>` : `<p class="empty-tasks">Für ${periods.map(p => MONTHS[p.month - 1]).join(' / ')} sind im Pflegekalender keine Arbeiten markiert.</p>`}
      ${upcoming}
      ${actions ? `<div class="trow-actions">${actions}</div>` : ''}
    </div></div>
  </li>`;
}

// ---------- Start ----------
function renderStart(params) {
  const now = today();
  const prefs = store.getPrefs();
  const mode = params.get('modus') || prefs.mode || 'monat';
  let year = now.getFullYear(), month = now.getMonth() + 1;
  const off = Number(params.get('m') || 0);
  if (mode === 'monat' && off) { const d = new Date(year, month - 1 + off, 1); year = d.getFullYear(); month = d.getMonth() + 1; }
  const trees = store.getTrees().filter(t => SPECIES[t.speciesId]);
  const done = store.getDone();
  const isCurrent = off === 0;
  const wk = weekOf(now);
  const periods = mode === 'woche' ? wk.months : [{ year, month }];
  const fmt = d => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const head = `<div class="pagehead">
      <div class="eyebrow">${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · KW ${wk.kw}</div>
      <h1>${mode === 'woche' ? `Diese Woche` : isCurrent ? `Im ${MONTHS[month - 1]}` : `${MONTHS[month - 1]} ${year}`}</h1>
      ${mode === 'woche' ? `<div class="sub">${fmt(wk.start)} – ${fmt(wk.end)}</div>` : ''}
    </div>
    <div class="monthbar">
      <div class="seg" role="group" aria-label="Zeitraum">
        <button data-mode="monat" aria-pressed="${mode === 'monat'}">Monat</button>
        <button data-mode="woche" aria-pressed="${mode === 'woche'}">Woche</button>
      </div>
      ${mode === 'monat' ? `<div class="monthnav">
        <a class="btn icon ghost" href="#/?m=${off - 1}" aria-label="Vorheriger Monat">${icon('left')}</a>
        <span class="label">${MONTHS_SHORT[month - 1]} ${year}</span>
        <a class="btn icon ghost" href="#/?m=${off + 1}" aria-label="Nächster Monat">${icon('right')}</a>
      </div>` : ''}
    </div>
    ${mode === 'woche' ? `<p class="notice">Die Pflegekalender geben Arbeiten je Monat an, nicht je Woche. Angezeigt sind die Arbeiten ${periods.length > 1 ? `für ${MONTHS[periods[0].month - 1]} und ${MONTHS[periods[1].month - 1]}, weil die Woche beide Monate berührt` : `für ${MONTHS[periods[0].month - 1]}`}.</p>` : ''}
    ${!isCurrent && mode === 'monat' ? `<p class="notice">Vorschau – du siehst nicht den aktuellen Monat. <a href="#/?m=0">Zurück zu ${MONTHS[now.getMonth()]}</a></p>` : ''}`;
  if (!trees.length) {
    return head + `<section class="card welcome">
      <img src="icons/logo.svg" alt="">
      <h2>Noch keine Bäume angelegt</h2>
      <p class="muted">Lege deine Bäume mit ihrer Art an. Dann siehst du hier, welche Pflegeschritte laut Pflegekalender in diesem Monat anstehen.</p>
      <div class="actions"><a class="btn primary" href="#/baum/neu">${icon('plus')}Baum anlegen</a><a class="btn" href="#/arten">Arten ansehen</a></div>
    </section>`;
  }
  const rows = `<ul class="trows">${trees.map(tree => {
    const sp = SPECIES[tree.speciesId];
    let upcoming = '';
    if (isCurrent && daysLeftInMonth(now) < 7) {
      const up = upcomingTasks(sp, now.getMonth() + 1, tree.variant);
      if (up.length) upcoming = `<div class="upcoming"><b>Ab ${MONTHS[now.getMonth() + 1 > 11 ? 0 : now.getMonth() + 1]} neu:</b> ${up.map(t => esc(t.label)).join(', ')}</div>`;
    }
    return treeRow(tree, sp, periods, done, { upcoming, actions: `<a class="btn small ghost" href="#/baum/${tree.id}">Baum öffnen${icon('right')}</a>` });
  }).join('')}</ul>`;
  return head + rows + `<p class="small muted">Pflegeschritte nach den Pflegekalendern des <a href="#/info">Bonsai-Arbeitskreises Hildesheim</a> (USDA-Klimazone 7b).</p>`;
}

// ---------- Bäume ----------
function renderTrees() {
  const trees = store.getTrees();
  const now = today(), done = store.getDone(), periods = [{ year: now.getFullYear(), month: now.getMonth() + 1 }];
  const list = trees.length ? `<ul class="trows">${trees.map(t => {
    const sp = SPECIES[t.speciesId];
    if (!sp) return `<li class="trow"><a class="trow-head" href="#/baum/${t.id}">${avatar(t)}<span class="t"><span class="name">${esc(t.name)}</span><span class="species">Art nicht mehr vorhanden</span></span>${icon('right', 'chev')}</a></li>`;
    return treeRow(t, sp, periods, done, { sub: t.year ? ` · seit ${t.year}` : '', label: MONTHS[now.getMonth()],
      actions: `<a class="btn small ghost" href="#/baum/${t.id}">Pflegejahr${icon('right')}</a><a class="btn small" href="#/baum/${t.id}/bearbeiten">Bearbeiten</a>` });
  }).join('')}</ul>` : `<section class="card"><p class="muted">Du hast noch keine Bäume angelegt.</p><a class="btn primary" href="#/baum/neu">${icon('plus')}Ersten Baum anlegen</a></section>`;
  return `<div class="pagehead between"><div><h1>Meine Bäume</h1><div class="sub">${trees.length} ${trees.length === 1 ? 'Baum' : 'Bäume'} · lokal auf diesem Gerät gespeichert</div></div>
    ${trees.length ? `<a class="btn primary" href="#/baum/neu" aria-label="Baum anlegen">${icon('plus')}<span>Neu</span></a>` : ''}</div>${list}`;
}

function speciesOptions(sel) {
  return CATS.map(c => {
    const xs = DATA.species.filter(s => s.category === c);
    return xs.length ? `<optgroup label="${esc(c)}">${xs.map(s => `<option value="${s.id}"${s.id === sel ? ' selected' : ''}>${esc(s.name)}${s.botanical ? ` (${esc(s.botanical)})` : ''}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
function variantField(sp, val) {
  if (!sp || sp.variants.length < 2) return '';
  return `<div class="field"><label class="f" for="f-variant">Variante <span class="hint">– die Quelle hat dafür getrennte Kalender</span></label>
    <select id="f-variant" name="variant">${sp.variants.map(v => `<option${v.name === val ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>`;
}
function renderTreeForm(id) {
  const t = id ? store.getTrees().find(x => x.id === id) : null;
  if (id && !t) return notFound();
  const pre = new URLSearchParams(location.hash.split('?')[1] || '').get('art');
  const spId = t?.speciesId || (SPECIES[pre] ? pre : '');
  return `<div class="pagehead"><h1>${t ? 'Baum bearbeiten' : 'Baum anlegen'}</h1></div>
  <form class="card form" id="treeform" data-id="${t?.id || ''}" novalidate>
    <div class="field"><label class="f" for="f-name">Name oder Spitzname</label>
      <input type="text" id="f-name" name="name" required maxlength="80" value="${esc(t?.name || '')}" placeholder="z. B. Kleiner Ahorn" autocomplete="off"></div>
    <div class="field"><label class="f" for="f-species">Art</label>
      <select id="f-species" name="speciesId" required><option value="">Art wählen …</option>${speciesOptions(spId)}</select></div>
    <div id="variantwrap">${variantField(SPECIES[spId], t?.variant)}</div>
    <div class="field"><label class="f" for="f-year">Erwerbsjahr <span class="hint">(optional)</span></label>
      <input type="number" id="f-year" name="year" inputmode="numeric" min="1900" max="2100" value="${esc(t?.year ?? '')}" placeholder="${today().getFullYear()}"></div>
    <div class="field"><label class="f" for="f-notes">Notizen <span class="hint">(optional)</span></label>
      <textarea id="f-notes" name="notes" maxlength="2000" placeholder="Herkunft, Substrat, letzte Arbeiten …">${esc(t?.notes || '')}</textarea></div>
    <div class="field"><label class="f" for="f-photo">Foto <span class="hint">(optional, bleibt auf dem Gerät)</span></label>
      <input class="sr-only" type="file" id="f-photo" name="photo" accept="image/*">
      <label class="btn" for="f-photo" id="photopick">${t?.hasPhoto ? 'Foto ersetzen' : 'Foto wählen'}</label>
      <div class="photo-prev" id="photoprev" ${t?.hasPhoto ? '' : 'hidden'}><span class="avatar" style="width:84px;height:84px" data-photo="${t?.id || ''}"></span>
        <button type="button" class="btn ghost small" id="photodel">Foto entfernen</button></div></div>
    <p class="err" id="formerr" role="alert" hidden></p>
    <div class="actions">
      ${t ? `<button type="button" class="btn danger" id="treedel">Löschen</button>` : ''}
      <div class="r"><a class="btn" href="${t ? `#/baum/${t.id}` : '#/baeume'}">Abbrechen</a><button class="btn primary" type="submit">Speichern</button></div>
    </div>
  </form>`;
}

function yearGrid(sp, variantName, sel, base) {
  const v = variantOf(sp, variantName);
  const now = today().getMonth() + 1;
  const rows = v.rows.filter(r => Object.keys(r.months).some(m => rowActive(r, m)));
  const head = MONTHS_SHORT.map((m, i) => `<th scope="col"><button class="${i + 1 === now ? 'now' : ''}" data-month="${i + 1}" aria-pressed="${sel === i + 1}" aria-label="${MONTHS[i]}" title="${MONTHS[i]}">${m.slice(0, window.innerWidth < 600 ? 1 : 3)}</button></th>`).join('');
  const body = rows.map(r => `<tr ${tc(r.type)}><th class="rl" scope="row"><span>${icon(r.type)}${esc(rowLabel(v, r))}</span></th>${
    Array.from({ length: 12 }, (_, i) => {
      const c = r.months[String(i + 1)] || {};
      const short = (c.texts || []).filter(t => t.length <= 3).join(' ');
      const cls = ['c', c.marked ? 'on' : (c.texts?.length ? 'txt' : ''), c.optional ? 'opt' : '', sel === i + 1 ? 'sel' : ''].filter(Boolean).join(' ');
      const tip = [MONTHS[i], ...(c.texts || []), ...(c.light || [])].join(' · ');
      return `<td class="${cls}" data-month="${i + 1}" title="${esc(tip)}">${window.innerWidth >= 480 && short ? esc(short) : ''}<span class="sr-only">${c.marked || c.texts?.length ? esc(tip) : ''}</span></td>`;
    }).join('')}</tr>`).join('');
  return `<div class="gridwrap"><table class="yeargrid" data-base="${esc(base)}"><colgroup><col class="rlc"></colgroup><thead><tr><th class="rl"><span class="sr-only">Arbeit</span></th>${head}</tr></thead><tbody>${body}</tbody></table></div>
  <div class="legend-line"><span><i></i>markiert</span><span><i class="txt"></i>nur Textangabe</span>${v.rows.some(r => Object.values(r.months).some(c => c.optional)) ? '<span><i class="opt"></i>auch noch möglich</span>' : ''}<span>Monat antippen für Details</span></div>`;
}
function monthDetail(sp, variantName, m) {
  const ts = tasksForMonth(sp, m, variantName);
  return `<section class="card monthdetail" id="monthdetail" aria-live="polite"><h3>${MONTHS[m - 1]}</h3>
    ${ts.length ? `<ul class="tasks">${ts.map(t => taskItem(t)).join('')}</ul>` : '<p class="muted">Keine Arbeiten markiert.</p>'}</section>`;
}
function sourceBlock(sp) {
  return `<p class="source">Quelle: <a href="${esc(sp.source.page)}" target="_blank" rel="noopener">Bonsai-Arbeitskreis Hildesheim</a> · 
    <a href="${esc(sp.source.pdf)}" target="_blank" rel="noopener">Pflegekalender ${esc(sp.name)} (PDF)${icon('ext')}</a><br>
    Inhalte stammen aus diesem PDF und wurden für die App maschinell in Monatsschritte übertragen. Im Zweifel gilt das PDF.</p>`;
}
function speciesInfo(sp, variantName) {
  const gen = generalRows(sp, variantName);
  const blocks = [];
  if (sp.substrate) blocks.push(`<h3>Substrat</h3><p>${esc(sp.substrate)}</p>`);
  if (gen.length) blocks.push(`<h3>Allgemein</h3><ul>${gen.map(r => `<li><b>${esc(r.label)}:</b> ${esc(r.remark)}</li>`).join('')}</ul>`);
  if (sp.hints.length) blocks.push(`<h3>Hinweise</h3><ul>${sp.hints.map(h => `<li>${esc(h)}</li>`).join('')}</ul>`);
  if (sp.notes.length) blocks.push(`<h3>Notizen</h3><ul>${sp.notes.map(h => `<li>${esc(h)}</li>`).join('')}</ul>`);
  if (sp.legend.length) blocks.push(`<h3>Legende</h3><ul>${sp.legend.map(h => `<li>${esc(h)}</li>`).join('')}</ul>`);
  return blocks.map(b => `<section class="card info-block">${b}</section>`).join('');
}

function renderTree(id, params) {
  const t = store.getTrees().find(x => x.id === id); if (!t) return notFound();
  const sp = SPECIES[t.speciesId];
  const sel = Number(params.get('monat')) || today().getMonth() + 1;
  return `${t.hasPhoto ? `<div data-photo="${t.id}" class="heroph"></div>` : ''}
  <div class="pagehead between"><div><h1>${esc(t.name)}</h1><div class="sub">${sp ? `<a href="#/art/${sp.id}">${speciesLine(sp, t.variant)}</a>${sp.botanical ? ` · <span class="bot">${esc(sp.botanical)}</span>` : ''}` : 'Art nicht gefunden'}</div></div>
    <a class="btn" href="#/baum/${t.id}/bearbeiten">Bearbeiten</a></div>
  ${(t.year || t.notes) ? `<section class="card"><dl class="facts">${t.year ? `<dt>Erworben</dt><dd>${t.year}</dd>` : ''}${t.notes ? `<dt>Notizen</dt><dd style="white-space:pre-line">${esc(t.notes)}</dd>` : ''}</dl></section>` : ''}
  ${sp ? `<section class="card"><h2 style="margin-bottom:.6rem">Pflegejahr</h2>${yearGrid(sp, t.variant, sel, `#/baum/${t.id}`)}</section>${monthDetail(sp, t.variant, sel)}${sourceBlock(sp)}` : ''}`;
}

// ---------- Arten ----------
function renderSpeciesList(params) {
  const q = params.get('q') || '', cat = params.get('kat') || '';
  const m = today().getMonth() + 1;
  return `<div class="pagehead"><h1>Arten</h1><div class="sub">${DATA.species.length} Pflegekalender des Bonsai-Arbeitskreises Hildesheim</div></div>
    <div class="search">${icon('search')}<input type="search" id="q" placeholder="Art suchen, deutsch oder botanisch" value="${esc(q)}" aria-label="Art suchen" autocomplete="off"></div>
    <div class="chips" role="group" aria-label="Kategorie">${['', ...CATS].map(c => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === cat}">${c || 'Alle'}</button>`).join('')}</div>
    <div id="speciesresults">${speciesResults(q, cat, m)}</div>`;
}
function speciesResults(q, cat, m) {
  const xs = searchSpecies(DATA.species, q, cat);
  return `<p class="count">${xs.length} ${xs.length === 1 ? 'Art' : 'Arten'}</p>` + (xs.length ? `<ul class="list">${xs.map(s => {
    const n = tasksForMonth(s, m).length;
    return `<li><a href="#/art/${s.id}"><span class="t"><span class="n">${esc(s.name)}</span> ${catTag(s.category)}<br><span class="s">${s.botanical ? `<span class="bot">${esc(s.botanical)}</span> · ` : ''}${n} ${n === 1 ? 'Arbeit' : 'Arbeiten'} im ${MONTHS[m - 1]}</span></span>${icon('right', 'go')}</a></li>`;
  }).join('')}</ul>` : '<p class="muted">Keine Art gefunden.</p>');
}
function renderSpecies(id, params) {
  const sp = SPECIES[id]; if (!sp) return notFound();
  const variant = params.get('variante') || sp.variants[0].name;
  const sel = Number(params.get('monat')) || today().getMonth() + 1;
  const base = `#/art/${sp.id}${sp.variants.length > 1 ? `?variante=${encodeURIComponent(variant)}&` : '?'}`;
  return `<div class="pagehead"><div class="eyebrow">Jahresübersicht</div><h1>${esc(sp.name)}</h1>
    <div class="sub">${sp.botanical ? `<span class="bot">${esc(sp.botanical)}</span> · ` : ''}${catTag(sp.category)}${sp.climateZone ? ` · USDA-Klimazone ${esc(sp.climateZone)}` : ''}</div></div>
    ${sp.variants.length > 1 ? `<div class="chips variants" role="group" aria-label="Variante">${sp.variants.map(v => `<a class="chip" href="#/art/${sp.id}?variante=${encodeURIComponent(v.name)}&monat=${sel}" aria-pressed="${v.name === variant}">${esc(v.name)}</a>`).join('')}</div>` : ''}
    <section class="card">${yearGrid(sp, variant, sel, base)}</section>
    ${monthDetail(sp, variant, sel)}
    ${speciesInfo(sp, variant)}
    <p class="small muted">Kategorie „${esc(sp.category)}“ abgeleitet aus: ${esc(sp.categoryBasis)}</p>
    ${sourceBlock(sp)}
    <p><a class="btn" href="#/baum/neu?art=${sp.id}">${icon('plus')}Baum dieser Art anlegen</a></p>`;
}

// ---------- Info ----------
function renderInfo() {
  return `<div class="pagehead infohead"><img src="icons/logo.svg" alt="" width="96" height="96"><h1>Info</h1></div>
  <section class="card prose"><h2>Quelle</h2>
    <p>Alle Pflegeangaben stammen aus den Pflegekalendern des <b>Bonsai-Arbeitskreises Hildesheim</b>:<br>
    <a href="${esc(DATA.source.page)}" target="_blank" rel="noopener">Pflegekalender über das Jahr ${icon('ext')}</a></p>
    <p>Jede Art verlinkt ihr Original-PDF. Die App übernimmt die Inhalte, ergänzt keine eigenen Pflegeempfehlungen und ist kein Angebot des Arbeitskreises.</p>
  </section>
  <section class="card prose"><h2>Wie die Daten entstanden sind</h2>
    <ul>
      <li>${DATA.species.length} PDFs wurden maschinell ausgelesen: farbige Monatszellen, Texte in den Zellen, Bemerkungen, Notizen, Hinweise und die Standort-Symbole (sonnig, halbschattig, schattig).</li>
      <li>Die Kalender geben Monate an, keine Wochen. Die Wochenansicht zeigt deshalb die Arbeiten des Monats, in dem die Woche liegt.</li>
      <li>Laut Quelle beziehen sich die Angaben auf USDA-Klimazone 7b.</li>
      <li>Die Kategorie (Laub, Nadel, Nicht winterhart, Indoor) ist aus den Kalendertexten abgeleitet und nicht Teil der Quelle.</li>
      <li>Kürzel ohne Erklärung im PDF sind unverändert übernommen. Bei Unklarheiten gilt das PDF.</li>
    </ul>
  </section>
  <section class="card prose"><h2>Deine Daten</h2>
    <p>Bäume, Fotos und Häkchen bleiben auf diesem Gerät (Browser-Speicher). Es gibt keinen Server und kein Konto. Wenn du die Website-Daten löschst, sind sie weg.</p>
    <div class="row" style="flex-wrap:wrap"><button class="btn" id="export">Bäume exportieren</button><label class="btn" for="import">Bäume importieren</label><input type="file" id="import" accept="application/json" hidden></div>
    <p class="small muted" style="margin-top:.6rem">Export und Import umfassen Bäume und Häkchen, keine Fotos.</p>
  </section>
  <section class="card prose" id="install"><h2>Installieren</h2>
    ${installHtml()}
    <p class="small muted">Schriften: Fraunces und Inter (SIL Open Font License). Version 1.2.1.</p>
  </section>`;
}
// ---------- Installation (PWA) ----------
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (location.hash.startsWith('#/info')) route(); });
addEventListener('appinstalled', () => { installEvt = null; if (location.hash.startsWith('#/info')) route(); });
function installHtml() {
  if (isStandalone()) return '<p>Bonsaijahr läuft als installierte App.</p>';
  const btn = installEvt ? '<div class="row"><button class="btn primary" data-install>App installieren</button></div>' : '';
  const steps = isIOS()
    ? '<ol><li>In <b>Safari</b> öffnen.</li><li>Teilen-Symbol antippen.</li><li><b>„Zum Home-Bildschirm“</b> wählen.</li></ol>'
    : '<ol><li>Ein altes Bonsaijahr-Symbol auf dem Startbildschirm zuerst entfernen (lange drücken → Entfernen).</li><li>Seite in <b>Chrome</b> öffnen und einmal neu laden.</li><li>Menü <b>⋮</b> → <b>„App installieren“</b> (bzw. „Zum Startbildschirm hinzufügen“ → „Installieren“, nicht „Verknüpfung erstellen“).</li></ol>';
  return `${btn}${installEvt ? '<p class="small muted">Oder von Hand:</p>' : ''}${steps}<p>Danach öffnet sich Bonsaijahr ohne Adresszeile und funktioniert auch offline.</p>`;
}
const notFound = () => `<div class="pagehead"><h1>Nicht gefunden</h1></div><p><a href="#/">Zur Startseite</a></p>`;

// ---------- Router ----------
async function route() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || '');
  const seg = path.split('/').filter(Boolean);
  let html, nav = 'heute', title = 'Heute';
  if (!seg.length) html = renderStart(params);
  else if (seg[0] === 'baeume') { html = renderTrees(); nav = 'baeume'; title = 'Meine Bäume'; }
  else if (seg[0] === 'baum' && seg[1] === 'neu') { html = renderTreeForm(null); nav = 'baeume'; title = 'Baum anlegen'; }
  else if (seg[0] === 'baum' && seg[2] === 'bearbeiten') { html = renderTreeForm(seg[1]); nav = 'baeume'; title = 'Baum bearbeiten'; }
  else if (seg[0] === 'baum') { html = renderTree(seg[1], params); nav = 'baeume'; title = 'Baum'; }
  else if (seg[0] === 'arten') { html = renderSpeciesList(params); nav = 'arten'; title = 'Arten'; }
  else if (seg[0] === 'art') { html = renderSpecies(seg[1], params); nav = 'arten'; title = SPECIES[seg[1]]?.name || 'Art'; }
  else if (seg[0] === 'info') { html = renderInfo(); nav = 'info'; title = 'Info'; }
  else html = notFound();
  const sameView = view.dataset.path === path;
  view.innerHTML = html; view.dataset.path = path;
  document.title = `${title} – Bonsaijahr`;
  document.querySelectorAll('[data-nav]').forEach(a => a.dataset.nav === nav ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  if (!sameView) window.scrollTo(0, 0);
  await fillPhotos();
  const hero = view.querySelector('.heroph img'); if (hero) hero.className = 'hero-photo';
}

// ---------- Events ----------
view.addEventListener('click', async e => {
  if (e.target.closest('[data-install]') && installEvt) { const ev = installEvt; installEvt = null; ev.prompt(); try { await ev.userChoice; } catch {} await route(); return; }
  const tick = e.target.closest('[data-done]');
  if (tick) {
    const on = tick.getAttribute('aria-pressed') !== 'true';
    store.setDone(tick.dataset.done, on);
    const y = window.scrollY; await route(); window.scrollTo(0, y); return;
  }
  const row = e.target.closest('[data-row]');
  if (row) {
    const li = row.closest('.trow'), open = !li.classList.contains('open');
    li.classList.toggle('open', open); row.setAttribute('aria-expanded', open);
    li.querySelector('.trow-panel').inert = !open;
    open ? openRows.add(row.dataset.row) : openRows.delete(row.dataset.row);
    return;
  }
  const mode = e.target.closest('[data-mode]');
  if (mode) { store.setPref('mode', mode.dataset.mode); location.hash = '#/'; route(); return; }
  const cat = e.target.closest('[data-cat]');
  if (cat) {
    view.querySelectorAll('[data-cat]').forEach(b => b.setAttribute('aria-pressed', b === cat));
    updateSpeciesResults(); return;
  }
  const mcell = e.target.closest('.yeargrid [data-month]');
  if (mcell) {
    const base = mcell.closest('.yeargrid').dataset.base;
    const y = window.scrollY;
    history.replaceState(null, '', `${base}${base.includes('?') ? (base.endsWith('?') || base.endsWith('&') ? '' : '&') : '?'}monat=${mcell.dataset.month}`);
    await route(); window.scrollTo(0, y);
    document.getElementById('monthdetail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  if (e.target.id === 'treedel') {
    const id = view.querySelector('#treeform').dataset.id;
    const t = store.getTrees().find(x => x.id === id);
    if (confirm(`„${t.name}“ löschen? Notizen, Foto und Häkchen dieses Baums werden entfernt.`)) { await store.deleteTree(id); dropPhotoUrl(id); location.hash = '#/baeume'; toast('Baum gelöscht'); }
  }
  if (e.target.id === 'photodel') { pendingPhoto = 'delete'; view.querySelector('#photoprev').hidden = true; view.querySelector('#f-photo').value = ''; }
  if (e.target.id === 'export') {
    const blob = new Blob([JSON.stringify({ app: 'bonsaijahr', version: 1, exported: new Date().toISOString(), trees: store.getTrees(), done: store.getDone() }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bonsaijahr-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
});
let pendingPhoto = null;
function updateSpeciesResults() {
  const q = view.querySelector('#q')?.value || '';
  const cat = view.querySelector('[data-cat][aria-pressed="true"]')?.dataset.cat || '';
  view.querySelector('#speciesresults').innerHTML = speciesResults(q, cat, today().getMonth() + 1);
  const p = new URLSearchParams(); if (q) p.set('q', q); if (cat) p.set('kat', cat);
  history.replaceState(null, '', `#/arten${p.toString() ? '?' + p : ''}`);
}
view.addEventListener('input', e => {
  if (e.target.id === 'q') updateSpeciesResults();
  const err = e.target.closest('#treeform')?.querySelector('#formerr'); if (err) err.hidden = true;
});
view.addEventListener('change', async e => {
  const ferr = e.target.closest('#treeform')?.querySelector('#formerr'); if (ferr) ferr.hidden = true;
  if (e.target.id === 'f-species') {
    view.querySelector('#variantwrap').innerHTML = variantField(SPECIES[e.target.value], null);
  }
  if (e.target.id === 'f-photo' && e.target.files[0]) {
    try {
      pendingPhoto = await store.shrinkImage(e.target.files[0]);
      const prev = view.querySelector('#photoprev'); prev.hidden = false;
      prev.querySelector('.avatar').innerHTML = `<img src="${URL.createObjectURL(pendingPhoto)}" alt="Vorschau">`;
    } catch { pendingPhoto = null; toast('Bild konnte nicht gelesen werden'); }
  }
  if (e.target.id === 'import' && e.target.files[0]) {
    try {
      const d = JSON.parse(await e.target.files[0].text());
      const ids = DATA.species.map(s => s.id);
      const incoming = (d.trees || []).map(t => cleanTree({ ...t, hasPhoto: false }, ids));
      const existing = store.getTrees(); const byId = new Map(existing.map(t => [t.id, t]));
      for (const t of incoming) byId.set(t.id, { ...t, hasPhoto: byId.get(t.id)?.hasPhoto || false });
      store.saveTrees([...byId.values()]);
      const done = store.getDone(); Object.assign(done, d.done || {}); localStorage.setItem('bonsaijahr.done', JSON.stringify(done));
      toast(`${incoming.length} Bäume importiert`);
    } catch (err) { toast('Import fehlgeschlagen: ' + err.message); }
  }
});
view.addEventListener('submit', async e => {
  if (e.target.id !== 'treeform') return;
  e.preventDefault();
  const f = e.target, fd = new FormData(f), err = f.querySelector('#formerr');
  const old = store.getTrees().find(x => x.id === f.dataset.id);
  try {
    const tree = cleanTree({ ...old, name: fd.get('name'), speciesId: fd.get('speciesId'), variant: fd.get('variant') || null,
      year: fd.get('year'), notes: fd.get('notes'), hasPhoto: old?.hasPhoto }, DATA.species.map(s => s.id));
    if (SPECIES[tree.speciesId].variants.length > 1 && !tree.variant) tree.variant = SPECIES[tree.speciesId].variants[0].name;
    if (SPECIES[tree.speciesId].variants.length < 2) tree.variant = null;
    if (pendingPhoto === 'delete') { await store.deletePhoto(tree.id).catch(() => {}); tree.hasPhoto = false; dropPhotoUrl(tree.id); }
    else if (pendingPhoto) { try { await store.putPhoto(tree.id, pendingPhoto); tree.hasPhoto = true; dropPhotoUrl(tree.id); } catch { toast('Foto konnte nicht gespeichert werden'); } }
    pendingPhoto = null;
    store.upsertTree(tree);
    location.hash = `#/baum/${tree.id}`;
    toast(old ? 'Gespeichert' : 'Baum angelegt');
  } catch (ex) {
    err.hidden = false;
    err.textContent = ex.message === 'Name fehlt' ? 'Bitte einen Namen eingeben.' : ex.message === 'Art fehlt' ? 'Bitte eine Art wählen.' : 'Erwerbsjahr bitte als Jahreszahl (1900–2100).';
    f.querySelector(ex.message === 'Art fehlt' ? '#f-species' : ex.message === 'Name fehlt' ? '#f-name' : '#f-year').focus();
  }
});
window.addEventListener('hashchange', () => { pendingPhoto = null; route(); });
let lastW = innerWidth;
window.addEventListener('resize', () => { if ((innerWidth < 600) !== (lastW < 600) || (innerWidth < 480) !== (lastW < 480)) { lastW = innerWidth; if (view.querySelector('.yeargrid')) route(); } lastW = innerWidth; });

async function init() {
  try {
    const r = await fetch('data/species.json'); DATA = await r.json();
  } catch { view.innerHTML = '<p class="loading">Daten konnten nicht geladen werden. Bitte einmal online öffnen.</p>'; return; }
  for (const s of DATA.species) SPECIES[s.id] = s;
  route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}
init();
