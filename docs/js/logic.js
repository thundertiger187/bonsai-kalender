// Reine Logik ohne DOM – wird von der App und den Unit-Tests genutzt.
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const TYPE_ORDER = ['giessen', 'duengen', 'schneiden', 'drahten', 'umtopfen', 'standort', 'pflanzenschutz', 'sonstiges'];
export const TYPE_LABEL = { giessen: 'Gießen', duengen: 'Düngen', schneiden: 'Schneiden', drahten: 'Drahten', umtopfen: 'Umtopfen', standort: 'Standort / Winterschutz', pflanzenschutz: 'Pflanzenschutz', sonstiges: 'Sonstiges' };
export const LIGHT_LABEL = { sonnig: 'sonnig', halbschattig: 'halbschattig', schattig: 'schattig' };
export const LEVEL_SYMBOL = { wenig: '−', 'mäßig': '+', oft: '++' };

export const pad2 = n => String(n).padStart(2, '0');
export const monthKey = (year, month) => `${year}-${pad2(month)}`;

/** Codes like "K → kaliumbetont" (legend) and "S = Samen; St = Stecklinge" (row remarks). */
export function codeMap(species, row) {
  const map = {};
  for (const l of species.legend || []) {
    const m = l.match(/^([A-Z]{1,3})\s*(?:→|=|-+>)?\s*(.+)$/);
    if (m) map[m[1]] = m[2].trim();
  }
  for (const part of (row?.remark || '').split(/[;,]/)) {
    const m = part.trim().match(/^([A-Z][a-z]?)\s*=\s*(.+)$/);
    if (m) map[m[1]] = m[2].trim();
  }
  return map;
}

export function variantOf(species, variantName) {
  const vs = species.variants;
  return vs.find(v => v.name && v.name === variantName) || vs[0];
}

/** Remarks that only explain symbols already expanded in the task text are left out. */
function remarkFor(row, cell, codes) {
  const r = (row.remark || '').trim();
  if (row.type === 'giessen' && cell.level && /^Gießmenge\s*-\s*\(wenig\)/i.test(r)) return '';
  if (Object.keys(codes).length && /^([A-Z][a-z]?\s*=\s*[^;,=]+[;,]?\s*)+$/.test(r)) return '';
  return r;
}

/** Label for display; repeated labels within one calendar get their season from the marked months. */
export function rowLabel(v, row) {
  const same = v.rows.filter(r => r.label === row.label);
  if (same.length < 2) return row.label;
  const ms = Object.keys(row.months).filter(m => rowActive(row, m)).map(Number);
  if (ms.length && ms.every(m => [11, 12, 1, 2, 3].includes(m))) return `${row.label} (Winter)`;
  if (ms.length && ms.every(m => m >= 3 && m <= 10)) return `${row.label} (Saison)`;
  return row.label;
}

/** A row counts for a month if its cell is coloured or carries text. */
export const rowActive = (row, month) => {
  const c = row.months[String(month)];
  return !!c && (c.marked || (c.texts && c.texts.length > 0));
};

/** Care steps for one species (variant) in one month, ordered by care type. */
export function tasksForMonth(species, month, variantName) {
  const v = variantOf(species, variantName);
  const vIdx = species.variants.indexOf(v);
  const out = [];
  v.rows.forEach((row, i) => {
    if (!rowActive(row, month)) return;
    const c = row.months[String(month)];
    const codes = codeMap(species, row);
    const texts = (c.texts || []).map(t => {
      if (row.type === 'giessen' && c.level) return `${c.level} gießen (${LEVEL_SYMBOL[c.level]})`;
      const parts = t.split(/\s*,\s*/);
      const exp = parts.map(p => codes[p] ? `${p} = ${codes[p]}` : null);
      return exp.every(Boolean) ? exp.join(', ') : t;
    });
    out.push({
      key: `${vIdx}.${i}.${row.type}`,
      type: row.type, sub: row.sub || null, label: rowLabel(v, row),
      texts, light: c.light || [], level: c.level || null, optional: !!c.optional,
      remark: remarkFor(row, c, codes), notes: (row.noteRefs || []).map(n => species.notes[n]).filter(Boolean),
    });
  });
  out.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  return out;
}

/** Rows without any monthly marking: general information per care type. */
export function generalRows(species, variantName) {
  const v = variantOf(species, variantName);
  return v.rows.filter(r => !Object.keys(r.months).some(m => rowActive(r, m)) && (r.remark || '').trim());
}

/** Tasks that start next month (not active in the current month). */
export function upcomingTasks(species, month, variantName) {
  const next = month % 12 + 1;
  const now = new Set(tasksForMonth(species, month, variantName).map(t => t.key));
  return tasksForMonth(species, next, variantName).filter(t => !now.has(t.key));
}

/** ISO week (Mon–Sun) containing `date`; returns the days and the months it touches. */
export function weekOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = Montag
  const start = new Date(d); start.setDate(d.getDate() - dow);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const months = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(start); x.setDate(start.getDate() + i);
    const k = { year: x.getFullYear(), month: x.getMonth() + 1 };
    if (!months.some(m => m.year === k.year && m.month === k.month)) months.push(k);
  }
  // ISO-Kalenderwoche
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 3 - dow);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const kw = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return { start, end, months, kw };
}

export const daysLeftInMonth = date => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() - date.getDate();

export const doneKey = (treeId, year, month, taskKey) => `${treeId}|${monthKey(year, month)}|${taskKey}`;

export function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
}

export function searchSpecies(list, query, category) {
  const q = normalize(query).trim();
  return list.filter(s => (!category || s.category === category) &&
    (!q || normalize(`${s.name} ${s.botanical || ''} ${s.pdfTitle}`).includes(q)));
}

/** Validates and cleans a tree record from the form or an import. */
export function cleanTree(t, speciesIds) {
  const name = String(t.name || '').trim().slice(0, 80);
  if (!name) throw new Error('Name fehlt');
  if (!speciesIds.includes(t.speciesId)) throw new Error('Art fehlt');
  const y = t.year === '' || t.year == null ? null : Number(t.year);
  if (y !== null && (!Number.isInteger(y) || y < 1900 || y > 2100)) throw new Error('Jahr ungültig');
  return { id: t.id || `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, speciesId: t.speciesId,
    variant: t.variant || null, notes: String(t.notes || '').slice(0, 2000), year: y, hasPhoto: !!t.hasPhoto, created: t.created || new Date().toISOString() };
}

// Aufgaben eines Baums für einen oder mehrere Monate inkl. Erledigt-Zählung (für die Baumzeilen).
export function treeTasks(species, tree, periods, done = {}) {
  const items = []; let n = 0;
  for (const p of periods) for (const t of tasksForMonth(species, p.month, tree.variant)) {
    const key = doneKey(tree.id, p.year, p.month, t.key), isDone = !!done[key];
    if (isDone) n++;
    items.push({ task: t, year: p.year, month: p.month, key, done: isDone });
  }
  return { items, total: items.length, done: n, open: items.length - n };
}
export const openLabel = s => !s.total ? 'Keine Arbeiten' : s.open === 0 ? 'Alles erledigt' : `${s.open} offen`;
