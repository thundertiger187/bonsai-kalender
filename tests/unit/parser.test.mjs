// Prüft die Extraktion gegen Stichproben, die manuell an den gerenderten PDFs abgelesen wurden.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const DATA = JSON.parse(fs.readFileSync(new URL('../../docs/data/species.json', import.meta.url)));
const S = Object.fromEntries(DATA.species.map(s => [s.id, s]));
const months = (s, label, v = 0) => { const r = S[s].variants[v].rows.find(r => r.label === label); return Object.entries(r.months).filter(([, c]) => c.marked).map(([m]) => +m).sort((a, b) => a - b); };

test('Titel, botanische Namen und Overrides', () => {
  assert.equal(S.schwarzkiefer.botanical, 'Pinus thunbergii');
  assert.equal(S['zirbe-arve'].pdfTitle, 'Zirbe / Arve - Pinus cembra');
  assert.equal(S.pfaffenhuetchen.botanical, 'Euonymus europea');
});
test('Markierte Monate (Stichproben)', () => {
  assert.deepEqual(months('faecherahorn', 'Umtopfen'), [2, 3]);
  assert.deepEqual(months('faecherahorn', 'Drahten'), [2, 3, 6, 7]);
});
test('Standort-Symbole erkannt', () => {
  const r = S.faecherahorn.variants[0].rows.find(r => r.type === 'standort');
  assert.deepEqual(r.months['7'].light, ['halbschattig']);
  assert.deepEqual(r.months['4'].light, ['sonnig']);
});
test('Fukientee-Hinweis lesbar korrigiert', () => {
  assert.ok(S.fukientee.hints.includes('Bei warmer Überwinterung entsprechend mehr gießen!'));
});
test('Keine Titel-Fragmente als Hinweise', () => {
  for (const s of DATA.species) for (const h of s.hints) assert.ok(!/^[–-]\s*\S+$/.test(h), `${s.id}: ${h}`);
});
test('Kategorien plausibel', () => {
  assert.equal(S.fukientee.category, 'Indoor');
  assert.equal(S.waldkiefer.category, 'Nadel');
  assert.equal(S.hainbuche.category, 'Laub');
});
