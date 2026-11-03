#!/usr/bin/env python3
"""Convert build/raw-parsed.json (geometry-based PDF parse) into the app data file app/data/species.json
and write the data-quality report (DATENQUALITAET.md + build/quality.json)."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_pdfs import classify_label, PAGE_URL, MONTHS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
raw = json.load(open(os.path.join(ROOT, 'build', 'raw-parsed.json'), encoding='utf-8'))
parse_report = {r['file']: r for r in json.load(open(os.path.join(ROOT, 'build', 'parse-report.json'), encoding='utf-8'))}

# German / botanical split of the PDF title. Values are taken from the PDF titles as printed (spelling unchanged).
NAMES = {
 'Apfel': ('Apfel', 'Malus'), 'Berberitze': ('Berberitze', 'Berberis'), 'Birke': ('Birke', 'Betula'),
 'Blauregen': ('Blauregen', 'Wisteria'), 'Bougainvillea': ('Bougainvillea (Drillingsblume)', 'Bougainvillea'),
 'Buchsbaum': ('Buchsbaum', 'Buxus'), 'chin._Ulme': ('Chinesische Ulme', 'Ulmus parvifolia'),
 'Cotoneaster': ('Cotoneaster (Zwergmispel)', 'Cotoneaster'), 'Dreispitzahorn': ('Dreispitzahorn', 'Acer buergerianum'),
 'Eibe': ('Eibe', 'Taxus'), 'Eiche': ('Eiche', 'Quercus'), 'Erle': ('Erle', 'Alnus'), 'Esche': ('Esche', 'Fraxinus excelsior'),
 'Feige': ('Feige', 'Ficus'), 'Fächerahorn': ('Fächerahorn', 'Acer palmatum'), 'Forsythie': ('Forsythie', 'Forsythia'),
 'Fuchsie': ('Fuchsie', 'Fuchsia'), 'Feldahorn': ('Feldahorn', 'Acer campestre'), 'Feuerahorn': ('Feuerahorn', 'Acer ginalla'),
 'Feuerdorn': ('Feuerdorn', 'Pyracantha'), 'Fichte': ('Fichte', 'Picea'), 'Fukientee': ('Fukientee', 'Carmona'),
 'Junischnee': ('Junischnee', 'Serissa foetida'), 'Ginkgo': ('Ginkgo (Fächerblattbaum)', 'Ginkgo biloba'),
 'Granatapfel': ('Granatapfel', 'Punica granatum'), 'Hainbuche': ('Hainbuche', 'Carpinus'), 'Hartriegel': ('Hartriegel', 'Cornus'),
 'Heckenkirsche': ('Heckenkirsche', 'Lonicera'), 'Kerbbuche': ('Kerbbuche', 'Fagus crenata'), 'Lärche': ('Lärche', 'Larix'),
 'Liguster': ('Liguster', 'Ligustrum vulgare'), 'Linde': ('Linde', 'Tilia'), 'Maulbeerbaum': ('Maulbeerbaum', 'Morus'),
 'Myrte': ('Myrte', 'Myrtus'), 'Olive': ('Olive', 'Olea'), 'Pfaffenhütchen': ('Pfaffenhütchen', 'Euonymus europea'),
 'Pfefferbaum': ('Pfefferbaum', 'Xanthoxylum'), 'Potentilla': ('Fingerkraut (Potentilla)', 'Potentilla'),
 'Rotbuche': ('Rotbuche', 'Fagus sylvatica'), 'Sageretie': ('Sageretie', 'Sageretia'), 'Satsuki': ('Satsuki-Azalee', None),
 'Schlehe': ('Schlehe', 'Prunus spinosa'), 'Schneeball': ('Schneeball', 'Viburnum'), 'Schwarzkiefer': ('Schwarzkiefer', 'Pinus thunbergii'),
 'Ulme': ('Ulme', 'Ulmus'), 'Waldkiefer': ('Waldkiefer', 'Pinus sylvestris'), 'Weißdorn': ('Weißdorn', 'Crataegus'),
 'Zelkove': ('Zelkove', 'Zelkova'), 'Zierquitte': ('Zierquitte', 'Chaenomeles'), 'Zirbe': ('Zirbe / Arve', 'Pinus cembra'),
}
CONIFERS = {'Eibe', 'Fichte', 'Lärche', 'Schwarzkiefer', 'Waldkiefer', 'Zirbe'}  # botanical fact, not care advice

def slug(s):
    s = s.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

PURPLE = '#cc99ff'
def row_type(label, color):
    t, sub = classify_label(label)
    if t == 'sonstiges' and sub == label and color == PURPLE:
        # e.g. Dreispitzahorn rows "junge Pflanzen"/"ältere Pflanzen" use the Pinzieren/Schnitt colour
        return 'schneiden', label
    return t, sub

def note_refs(remark, notes):
    refs = []
    m = re.search(r'(?:[–—-]\s*|\s)(\d)\s*$', remark or '') or re.fullmatch(r'\s*[–—-]?\s*(\d)\s*', remark or '')
    if m:
        n = m.group(1)
        for i, t in enumerate(notes):
            if re.match(r'^\*?%s\s*[–—-]' % n, t) or re.match(r'^%s\s' % n, t):
                refs.append(i)
    m2 = re.search(r'(\*+)\s*$', remark or '') or re.match(r'^(\*+)', remark or '')
    if m2:
        st = m2.group(1)
        for i, t in enumerate(notes):
            mm = re.match(r'^(\*+)', t)
            if mm and mm.group(1) == st: refs.append(i)
    for st in re.findall(r'(\*+)[A-ZÄÖÜa-z]', remark or ''):
        for i, t in enumerate(notes):
            mm = re.match(r'^(\*+)', t)
            if mm and mm.group(1) == st and i not in refs: refs.append(i)
    if re.search(r'<\s*1\s*>', remark or ''):
        refs += [i for i, t in enumerate(notes) if t.startswith('< 1 >')]
    return refs

GIESS = {'-': 'wenig', '+': 'mäßig', '++': 'oft'}

def build_species(r):
    stem = r['file'].replace('_Pflegekalender.pdf', '').replace(' Pflegekalender.pdf', '')
    de, bot = NAMES[stem]
    issues = list(r['issues'])
    notes = r['notes']
    legend, extra_hints = [], []
    buf = []
    for l in r['legend']:
        if re.match(r'^(?:[A-Z]{1,3}|/+|\+\+|\+|-)\s', l) and len(l) < 90:
            legend.append(re.sub(r'\s*-+>\s*', ' → ', l).replace('/' * 10, '////'))
        else:
            buf.append(l)
    if buf:
        # join wrapped legend-area texts into sentences
        txt = ' '.join(buf)
        if stem == 'Satsuki':
            extra_hints += ['"Satsuki, jung" = in der Aufbau- und Entwicklungsphase (in dieser Phase sind wichtig: Zuwachs, Astaufbau, Aststellung, usw.)',
                            '"Satsuki, alt" = in der Verfeinerungsphase (in dieser Phase sind wichtig: Feinverzweigung, Blüten, usw.)']
        else:
            extra_hints.append(txt)
    hints = r['hints'] + extra_hints
    for h in hints:
        if re.search(r'(kann mit|neigt zu|Torf oder)$', h):
            issues.append('Hinweis im PDF abgeschnitten: „%s“' % h)
    variants = []
    for t in r['tables']:
        rows = []
        for row in t['rows']:
            typ, sub = row_type(row['label'], row.get('labelColor'))
            months = {}
            for m, v in row['months'].items():
                texts = []
                optional = False
                for x in v['texts']:
                    if re.fullmatch(r'/{5,}', x):
                        optional = True; continue
                    texts.append(x)
                # drop texts fully contained in another text of the same cell (e.g. "S" and "S, A")
                texts = [x for x in texts if not any(x != y and len(x) <= 3 and re.search(r'(^|[ ,;/])%s([ ,;/]|$)' % re.escape(x), y) for y in texts)]
                e = {'marked': v['marked']}
                if texts: e['texts'] = texts
                if v['light']: e['light'] = sorted(set(v['light']))
                if optional: e['optional'] = True
                if typ == 'giessen':
                    lv = [GIESS[x] for x in texts if x in GIESS]
                    if lv: e['level'] = lv[0]
                months[m] = e
            refs = note_refs(row['remark'], notes)
            rr = {'type': typ, 'label': row['label'], 'remark': row['remark'], 'months': months}
            if sub: rr['sub'] = sub
            if refs: rr['noteRefs'] = refs
            rows.append(rr)
        variants.append({'name': t['variant'] if len(r['tables']) > 1 else None, 'rows': rows})
    # category (derived; basis recorded)
    alltext = ' '.join([row['remark'] for v in variants for row in v['rows']] + notes + hints)
    winter_rows = [row['remark'] for v in variants for row in v['rows'] if row['type'] == 'standort' and re.search(r'(?i)winterhart|winterquartier|kalthaus', row['remark'])]
    wtxt = ' '.join(winter_rows)
    temps = [int(a) for a in re.findall(r'(\d{2})\s*(?:[-–]\s*\d{2}\s*)?Grad', alltext)]
    category, basis = None, None
    if re.search(r'(?i)nicht winterhart', wtxt) or re.search(r'(?i)nicht winterhart', alltext):
        if re.search(r'(?i)indoor|geheizten Zimmer', alltext) or any(x >= 14 for x in temps):
            category = 'Indoor'
        else:
            category = 'Nicht winterhart'
        basis = next((x for x in winter_rows if re.search(r'(?i)nicht winterhart', x)), wtxt)
    elif stem in CONIFERS:
        category, basis = 'Nadel', 'Nadelgehölz (botanische Zuordnung)'
    else:
        category, basis = 'Laub', 'Laubgehölz; kein Hinweis „nicht winterhart“ im Kalender'
    if category == 'Indoor':
        basis = basis + ' · Temperaturangabe/Indoor-Hinweis im Kalender'
    substrate = next((h for h in hints if re.search(r'(?i)akadama|kanuma|substrat|bonsaierde|kiryu', h)), None)
    sp = {
        'id': slug(de.split(' (')[0]),
        'name': de, 'botanical': bot, 'pdfTitle': r['title'], 'category': category, 'categoryBasis': basis,
        'climateZone': r['zone'], 'substrate': substrate,
        'variants': variants, 'notes': notes, 'legend': legend, 'hints': [h for h in hints if h != substrate],
        'source': {'name': 'Bonsai-Arbeitskreis Hildesheim', 'page': PAGE_URL, 'pdf': r['url'], 'pdfFile': r['file']},
    }
    if r.get('titleSource'): sp['source']['titleNote'] = 'Titel ' + r['titleSource']
    if issues: sp['dataIssues'] = issues
    return sp

species = [build_species(r) for r in raw]
species.sort(key=lambda s: s['name'].lower().replace('ä', 'a').replace('ö', 'o').replace('ü', 'u'))
ids = [s['id'] for s in species]; assert len(ids) == len(set(ids)), ids
out = {'generated': __import__('datetime').date.today().isoformat(), 'source': {'name': 'Bonsai-Arbeitskreis Hildesheim', 'page': PAGE_URL},
       'note': 'Inhalte aus den Pflegekalender-PDFs des Bonsai-Arbeitskreises Hildesheim, maschinell strukturiert. Angaben beziehen sich laut Quelle auf USDA-Klimazone 7b.',
       'types': {'giessen': 'Gießen', 'duengen': 'Düngen', 'schneiden': 'Schneiden', 'drahten': 'Drahten', 'umtopfen': 'Umtopfen',
                 'standort': 'Standort / Winterschutz', 'pflanzenschutz': 'Pflanzenschutz', 'sonstiges': 'Sonstiges'},
       'species': species}
json.dump(out, open(os.path.join(ROOT, 'docs', 'data', 'species.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(out, open(os.path.join(ROOT, 'build', 'species.pretty.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# quality report
lines = ['# Datenqualität – Extraktion der Pflegekalender-PDFs', '',
         'Quelle: [Bonsai-Arbeitskreis Hildesheim – Pflegekalender über das Jahr](%s)' % PAGE_URL, '',
         'Stand: %s · Verfahren: Download mit curl, Textextraktion mit poppler `pdftotext -layout` (Kontrolle) und pdfplumber (Positionen von Text, farbigen Zellen und Standort-Symbolen). Alle 50 PDFs haben eine Textebene, OCR war nicht nötig.' % out['generated'], '',
         '## Ergebnis', '',
         '- PDFs verlinkt: %d · heruntergeladen: %d · strukturiert: %d' % (len(parse_report), len(raw), len(species)),
         '- Arten mit Varianten: %s' % ', '.join('%s (%s)' % (s['name'], ', '.join(v['name'] for v in s['variants'])) for s in species if len(s['variants']) > 1),
         '- Kategorien (abgeleitet): ' + ', '.join('%s %d' % (c, sum(1 for s in species if s['category'] == c)) for c in ['Laub', 'Nadel', 'Nicht winterhart', 'Indoor']), '',
         '## Methode und Grenzen', '',
         '- Monatsmarkierungen sind in den PDFs farbige Tabellenzellen. Eine Zelle zählt für einen Monat, wenn sie mehr als die Hälfte der Monatsspalte abdeckt.',
         '- Text in verbundenen Zellen (z. B. „alle 2 Jahre“, „starke Äste“) gilt für alle Monate der Zelle. Kurze Kürzel (P, K, St, -, +, ++) gelten für den Monat, in dem sie stehen.',
         '- Standort-Symbole (sonnig/halbschattig/schattig) sind Bilder; sie wurden über den Anteil dunkler Pixel klassifiziert und gelten für die farbige Zelle, in der sie stehen.',
         '- Zeilenbeschriftung „Arbeiten“ → Pflegeart: Umtopfen, Standort (inkl. Winterschutz), Pinzieren/Zupfen/Triebschnitt/Blattschnitt/Schnitt → Schneiden, Drahten, Düngen, Gießen, Krankheiten/Maßnahmen → Pflanzenschutz, Vermehrung/Besonderheiten → Sonstiges.',
         '- Freistehende Textkästen (Substrat, Hinweise mit Pfeil) sind als „Hinweise“ je Art übernommen. Die Pfeil-Zuordnung zu einer Zeile/einem Monat ist nicht ausgewertet.',
         '- Fußnoten-Verweise in „Bemerkungen“ (– 1, *, **) werden mit den Notizen verknüpft, wenn eine passende Notiz existiert.',
         '- Kategorie (Laub/Nadel/Nicht winterhart/Indoor) ist abgeleitet: „nicht winterhart“ in den Standort-Zeilen; Indoor zusätzlich bei Temperaturangabe ≥ 14 Grad oder „Indoor“/„geheizten Zimmer“. Nadel = botanische Zuordnung.',
         '- Kürzel ohne Legende im PDF (z. B. „P“, „F“, „S“ in Pinzier-Zeilen, „+“/„++“ in der Satsuki-Schnittzeile) sind unverändert übernommen.',
         '- Rechtschreibung der Quelle (z. B. „Acer ginalla“, „Euonymus europea“, „Diche Äste“) ist nicht korrigiert.', '',
         '## Je PDF', '', '| PDF | Art | Zeilen | Auffälligkeiten |', '|---|---|---|---|']
for s in species:
    pr = parse_report[s['source']['pdfFile']]
    iss = list(s.get('dataIssues', []))
    if s['source'].get('titleNote'): iss.append('Titel nicht extrahierbar (überlagerte Textebene), aus gerenderter Seite übernommen')
    if s['source']['pdfFile'] == 'Fukientee_Pflegekalender.pdf': iss.append('Ein Hinweis war als überlagerter Doppeltext gespeichert; Text aus gerenderter Seite übernommen')
    if s['source']['pdfFile'] == 'Rotbuche_Pflegekalender.pdf': iss.append('Substrat steht in der Bemerkungsspalte der Umtopfen-Zeile')
    if s['source']['pdfFile'] == 'Pfaffenhütchen_Pflegekalender.pdf': iss.append('Schraffur „////“ = „jeweilige Maßnahme auch noch möglich“ (als optional markiert)')
    if s['source']['pdfFile'] == 'Dreispitzahorn_Pflegekalender.pdf': iss.append('Zeilen „junge Pflanzen“/„ältere Pflanzen“ (Farbe Pinzieren/Schnitt) als Schneiden eingeordnet')
    lines.append('| [%s](%s) | %s | %d | %s |' % (s['source']['pdfFile'], s['source']['pdf'], s['name'], sum(len(v['rows']) for v in s['variants']), '; '.join(iss) or '–'))
failed = [f for f, r in parse_report.items() if not r['ok']]
lines += ['', '## Fehlgeschlagen', '', ('Keine.' if not failed else '\n'.join('- ' + f for f in failed))]
open(os.path.join(ROOT, 'DATENQUALITAET.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('species', len(species), 'failed', failed)
print({c: sum(1 for s in species if s['category'] == c) for c in ['Laub', 'Nadel', 'Nicht winterhart', 'Indoor']})
for s in species:
    print(s['id'], s['category'], '|', s['categoryBasis'][:70])
