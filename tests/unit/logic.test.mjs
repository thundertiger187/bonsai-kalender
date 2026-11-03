import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { tasksForMonth, generalRows, upcomingTasks, weekOf, daysLeftInMonth, doneKey, searchSpecies, cleanTree, codeMap, variantOf } from '../../docs/js/logic.js';
const DATA = JSON.parse(fs.readFileSync(new URL('../../docs/data/species.json', import.meta.url)));
const S = Object.fromEntries(DATA.species.map(s => [s.id, s]));

test('Datensatz: 50 Arten mit Quelle, Monaten 1–12 und gültigen Typen', () => {
  assert.equal(DATA.species.length, 50);
  const types = new Set(Object.keys(DATA.types));
  for (const s of DATA.species) {
    assert.match(s.source.pdf, /^https:\/\/www\.bonsai-arbeitskreis-hildesheim\.de\/get_file\.php\?id=\d+/);
    assert.ok(s.name && s.variants.length >= 1, s.id);
    assert.ok(['Laub', 'Nadel', 'Nicht winterhart', 'Indoor'].includes(s.category), s.id);
    for (const v of s.variants) for (const r of v.rows) {
      assert.ok(types.has(r.type), `${s.id}: ${r.type}`);
      for (const m of Object.keys(r.months)) assert.ok(+m >= 1 && +m <= 12);
      for (const n of r.noteRefs || []) assert.ok(s.notes[n], `${s.id} note ${n}`);
    }
  }
});

test('Fächerahorn: Umtopfen Feb/März, Pinzieren Apr–Jul mit P, Gießen-Stufen', () => {
  const s = S.faecherahorn;
  const feb = tasksForMonth(s, 2).map(t => t.type);
  assert.ok(feb.includes('umtopfen') && feb.includes('drahten'));
  assert.ok(!tasksForMonth(s, 1).some(t => t.type === 'umtopfen'));
  const may = tasksForMonth(s, 5);
  assert.deepEqual(may.find(t => t.label === 'Pinzieren').texts, ['P']);
  assert.equal(may.find(t => t.type === 'giessen').level, 'oft');
  assert.equal(tasksForMonth(s, 1).find(t => t.type === 'giessen').level, 'wenig');
  assert.deepEqual(tasksForMonth(s, 9).find(t => t.type === 'duengen').texts, ['K = kaliumbetont']);
  // sortiert nach Pflegeart
  assert.equal(may[0].type, 'giessen');
});

test('Vermehrungskürzel werden aus der Bemerkung erklärt', () => {
  const s = S.faecherahorn, row = s.variants[0].rows.find(r => r.label === 'Vermehrung');
  assert.equal(codeMap(s, row).St, 'Stecklinge');
  assert.deepEqual(tasksForMonth(s, 10).find(t => t.label === 'Vermehrung').texts, ['S = Samen']);
});

test('Fußnoten werden an die Aufgabe gehängt', () => {
  const t = tasksForMonth(S.faecherahorn, 12).find(t => t.type === 'standort');
  assert.match(t.notes[0], /^3 – Ein dauerhaftes Durchfrieren/);
});

test('Allgemeine Zeilen ohne Monatsmarkierung', () => {
  const g = generalRows(S.faecherahorn).map(r => r.label);
  assert.ok(g.includes('Besonderheiten') && g.includes('Krankheiten / Maßnahmen'));
});

test('Satsuki hat zwei Varianten, Auswahl wirkt', () => {
  const s = S['satsuki-azalee'];
  assert.deepEqual(s.variants.map(v => v.name).sort(), ['Satsuki, alt', 'Satsuki, jung']);
  assert.equal(variantOf(s, 'Satsuki, jung').name, 'Satsuki, jung');
  assert.equal(variantOf(s, 'gibt es nicht'), s.variants[0]);
  assert.ok(tasksForMonth(s, 6, 'Satsuki, jung')[0].key.startsWith(`${s.variants.findIndex(v => v.name === 'Satsuki, jung')}.`));
});

test('Vorschau: neue Arbeiten im Folgemonat (Dez → Jan)', () => {
  const up = upcomingTasks(S.faecherahorn, 1);
  assert.ok(up.some(t => t.type === 'umtopfen'));
  for (const t of upcomingTasks(S.faecherahorn, 12)) assert.ok(!tasksForMonth(S.faecherahorn, 12).some(x => x.key === t.key));
});

test('Wochenlogik: KW und Monatswechsel', () => {
  const w = weekOf(new Date(2026, 10, 3)); // Di 3.11.2026
  assert.equal(w.kw, 45); assert.equal(w.start.getDate(), 2); assert.equal(w.end.getDate(), 8);
  assert.deepEqual(w.months, [{ year: 2026, month: 11 }]);
  const x = weekOf(new Date(2026, 11, 31)); // Do 31.12.2026
  assert.equal(x.kw, 53);
  assert.deepEqual(x.months, [{ year: 2026, month: 12 }, { year: 2027, month: 1 }]);
  assert.equal(weekOf(new Date(2027, 0, 4)).kw, 1);
  assert.equal(daysLeftInMonth(new Date(2026, 10, 25)), 5);
});

test('Erledigt-Schlüssel je Baum, Monat und Aufgabe', () => {
  assert.equal(doneKey('t1', 2026, 3, '0.2.umtopfen'), 't1|2026-03|0.2.umtopfen');
});

test('Suche: Umlaute, botanisch, Kategorie', () => {
  assert.ok(searchSpecies(DATA.species, 'facherahorn').some(s => s.id === 'faecherahorn'));
  const pin = searchSpecies(DATA.species, 'pinus').map(s => s.id);
  for (const id of ['schwarzkiefer', 'waldkiefer', 'zirbe-arve', 'hainbuche']) assert.ok(pin.includes(id)); // Carpinus enthält „pinus“
  assert.deepEqual(searchSpecies(DATA.species, 'pinus', 'Nadel').map(s => s.id).sort(), ['schwarzkiefer', 'waldkiefer', 'zirbe-arve']);
  assert.ok(searchSpecies(DATA.species, '', 'Indoor').every(s => s.category === 'Indoor'));
  assert.equal(searchSpecies(DATA.species, 'xyz').length, 0);
});

test('Baum-Validierung', () => {
  const ids = ['ulme'];
  assert.throws(() => cleanTree({ name: ' ', speciesId: 'ulme' }, ids), /Name/);
  assert.throws(() => cleanTree({ name: 'A', speciesId: 'x' }, ids), /Art/);
  assert.throws(() => cleanTree({ name: 'A', speciesId: 'ulme', year: '20' }, ids), /Jahr/);
  const t = cleanTree({ name: ' Ulmi ', speciesId: 'ulme', year: '2019' }, ids);
  assert.equal(t.name, 'Ulmi'); assert.equal(t.year, 2019); assert.ok(t.id);
});

test('Jede Art hat in mindestens einem Monat Arbeiten', () => {
  for (const s of DATA.species) assert.ok([...Array(12)].some((_, i) => tasksForMonth(s, i + 1).length), s.id);
});

test('treeTasks/openLabel: Zählung offen/erledigt je Baum und Zeitraum', async () => {
  const { treeTasks, openLabel } = await import('../../docs/js/logic.js');
  const sp = DATA.species.find(s => s.variants.length === 1 && tasksForMonth(s, 4).length >= 2);
  const tree = { id: 't1', variant: null };
  const per = [{ year: 2026, month: 4 }];
  const a = treeTasks(sp, tree, per, {});
  assert.equal(a.total, tasksForMonth(sp, 4).length); assert.equal(a.open, a.total); assert.equal(openLabel(a), `${a.total} offen`);
  const done = { [a.items[0].key]: true };
  const b = treeTasks(sp, tree, per, done);
  assert.equal(b.done, 1); assert.equal(b.open, a.total - 1); assert.ok(b.items[0].done);
  const all = Object.fromEntries(a.items.map(i => [i.key, true]));
  assert.equal(openLabel(treeTasks(sp, tree, per, all)), 'Alles erledigt');
  assert.equal(openLabel({ total: 0, open: 0 }), 'Keine Arbeiten');
  const two = treeTasks(sp, tree, [{ year: 2026, month: 4 }, { year: 2026, month: 5 }], {});
  assert.equal(two.total, tasksForMonth(sp, 4).length + tasksForMonth(sp, 5).length);
});
