#!/usr/bin/env python3
"""Parse Bonsai-Arbeitskreis Hildesheim Pflegekalender PDFs into structured JSON.

Reads source-pdfs/*.pdf + pdf-index.json, writes build/raw-parsed.json and build/parse-report.json (see build_data.py for the app data).
Approach: table grid from thin black rects (lines), coloured cell fills = active months,
text per cell from word positions, Standort icons (sun/half/shade) classified by dark-pixel ratio.
"""
import json, re, sys, os, unicodedata
import pdfplumber

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'source-pdfs')
PAGE_URL = 'https://www.bonsai-arbeitskreis-hildesheim.de/bonsaipflege/pflegekalender-ueber-das-jahr.html'
MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

# Arbeiten-label -> (type, subtype)
def classify_label(label):
    l = label.lower()
    if 'umtopf' in l: return ('umtopfen', None)
    if 'standort' in l or 'überwint' in l or 'winter' in l: return ('standort', None)
    if 'blattschnitt' in l: return ('schneiden', 'Blattschnitt')
    if 'pinzier' in l: return ('schneiden', 'Pinzieren')
    if 'zupf' in l: return ('schneiden', 'Zupfen')
    if 'kerzen' in l: return ('schneiden', label)
    if 'triebschnitt' in l: return ('schneiden', 'Triebschnitt')
    if 'schnitt' in l or 'rückschnitt' in l: return ('schneiden', 'Schnitt')
    if 'draht' in l: return ('drahten', None)
    if 'düng' in l: return ('duengen', None)
    if 'gieß' in l or 'giess' in l: return ('giessen', None)
    if 'krankheit' in l or 'schädling' in l or 'maßnahm' in l: return ('pflanzenschutz', None)
    if 'vermehr' in l: return ('sonstiges', 'Vermehrung')
    if 'besonder' in l: return ('sonstiges', 'Besonderheiten')
    if 'blüte' in l: return ('sonstiges', label)
    return ('sonstiges', label)

def is_black(c):
    if c is None: return False
    if isinstance(c, (int, float)): return c == 0
    if isinstance(c, (list, tuple)):
        return all(isinstance(v, (int, float)) and v == 0 for v in c)
    return False

def is_white(c):
    if c is None: return True
    if isinstance(c, (int, float)): return c >= 0.99
    if isinstance(c, (list, tuple)):
        return all(isinstance(v, (int, float)) and v >= 0.99 for v in c)
    return False

def color_hex(c):
    if isinstance(c, (int, float)): c = (c, c, c)
    if isinstance(c, (list, tuple)) and len(c) == 3 and all(isinstance(v, (int, float)) for v in c):
        return '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in c)
    if isinstance(c, (list, tuple)) and len(c) == 1: return color_hex(c[0])
    return str(c)

def clean(s):
    s = unicodedata.normalize('NFC', s)
    s = s.replace('\u00a0', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def phrases(words, gap=4.5):
    """Group words into phrases: same line (top within 2.5) and small x-gap."""
    ws = sorted(words, key=lambda w: (round(w['top'] / 2.5), w['x0']))
    lines = []
    for w in sorted(words, key=lambda w: w['top']):
        for ln in lines:
            if abs(ln[0]['top'] - w['top']) < 2.5:
                ln.append(w); break
        else:
            lines.append([w])
    out = []
    for ln in lines:
        ln.sort(key=lambda w: w['x0'])
        cur = [ln[0]]
        for w in ln[1:]:
            if w['x0'] - cur[-1]['x1'] < gap:
                cur.append(w)
            else:
                out.append(cur); cur = [w]
        out.append(cur)
    res = []
    for ph in out:
        res.append({'text': clean(' '.join(w['text'] for w in ph)), 'x0': min(w['x0'] for w in ph),
                    'x1': max(w['x1'] for w in ph), 'top': min(w['top'] for w in ph),
                    'bottom': max(w['bottom'] for w in ph)})
    return res

def join_lines(phs):
    phs = sorted(phs, key=lambda p: (round(p['top']), p['x0']))
    return clean(' '.join(p['text'] for p in phs))

def light_class(page, im):
    img = page.crop((max(0, im['x0']), max(0, im['top']), min(page.width, im['x1']), min(page.height, im['bottom']))).to_image(resolution=200).original.convert('L')
    px = list(img.getdata())
    dark = sum(1 for v in px if v < 80) / max(1, len(px))
    if dark < 0.04: return 'sonnig', dark
    if dark < 0.13: return 'halbschattig', dark
    return 'schattig', dark

def overlap(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0))

def parse_pdf(path, meta, log):
    pdf = pdfplumber.open(path)
    page = pdf.pages[0].dedupe_chars()
    words = page.extract_words(x_tolerance=1.5, y_tolerance=2, keep_blank_chars=False, use_text_flow=False)
    rects = page.rects
    thin = [r for r in rects if is_black(r.get('non_stroking_color')) and r.get('fill', True)]
    issues = []

    # Title
    pk = [w for w in words if 'Pflegekalender' in w['text']]
    title = ''
    if pk:
        h = pk[0]['bottom'] - pk[0]['top']
        tw = [w for w in words if abs(w['top'] - pk[0]['top']) < h * 0.6 and (w['bottom'] - w['top']) > h * 0.7]
        title = clean(' '.join(w['text'] for w in sorted(tw, key=lambda w: w['x0'])))
    if 'Pflegekalender' not in title:
        # fallback: line containing Pflegekalender
        cand = [p for p in phrases(words, gap=12) if 'Pflegekalender' in p['text']]
        title = cand[0]['text'] if cand else ''
    title = re.sub(r'\s*Pflegekalender\s*', '', title).strip()

    # header rows (one per table)
    jan_words = [w for w in words if w['text'] == 'Januar' and any(v['text'] == 'Dezember' and abs(v['top'] - w['top']) < 3 for v in words)]
    tables = []
    jan_words.sort(key=lambda w: w['top'])
    for ti, jw in enumerate(jan_words):
        htop, hbot = jw['top'] - 4, jw['bottom'] + 4
        next_top = jan_words[ti + 1]['top'] - 10 if ti + 1 < len(jan_words) else page.height
        hdr = {w['text']: w for w in words if abs(w['top'] - jw['top']) < 3}
        missing = [m for m in MONTHS if m not in hdr]
        if missing:
            issues.append('Kopfzeile: Monate nicht gefunden: %s' % missing)
        # vertical lines in header band
        vx = sorted(set(round((r['x0'] + r['x1']) / 2, 1) for r in thin
                        if (r['x1'] - r['x0']) < 1.5 and r['bottom'] - r['top'] > 4
                        and overlap(r['top'], r['bottom'], htop, hbot) > 2))
        # Determine month column edges using header word centers
        centers = [((hdr[m]['x0'] + hdr[m]['x1']) / 2) if m in hdr else None for m in MONTHS]
        edges = []
        for i in range(12):
            c = centers[i]
            if c is None: edges.append(None); continue
            left = max([x for x in vx if x < hdr[MONTHS[i]]['x0'] + 0.5] or [c - 17])
            right = min([x for x in vx if x > hdr[MONTHS[i]]['x1'] - 0.5] or [c + 17])
            edges.append((left, right))
        if None in edges:
            issues.append('Monatsspalten unvollständig'); continue
        jan_left = edges[0][0]
        arb = [w for w in words if w['text'].startswith('Arbeiten') and abs(w['top'] - jw['top']) < 3]
        bem = [w for w in words if w['text'].startswith('Bemerkung') and abs(w['top'] - jw['top']) < 3]
        baum = [w for w in words if w['text'].startswith('Baumsorte') and abs(w['top'] - jw['top']) < 3]
        # column borders left of January
        left_v = [x for x in vx if x < jan_left - 1]
        # expected: [x_start?, baum|arb, arb|bem] -> take the two largest below jan_left
        arb_c = (arb[0]['x0'] + arb[0]['x1']) / 2 if arb else 130
        bem_c = (bem[0]['x0'] + bem[0]['x1']) / 2 if bem else 250
        arb_l = max([x for x in left_v if x < arb[0]['x0']] or [85]) if arb else 85
        arb_r = min([x for x in left_v if x > arb_c] or [bem_c - 60])
        # label rects in Arbeiten column below header
        lab_rects = [r for r in rects if not is_black(r.get('non_stroking_color')) and not is_white(r.get('non_stroking_color'))
                     and r['x0'] < arb_c < r['x1'] and r['x1'] < bem_c and r['top'] >= hbot - 3 and r['top'] < next_top
                     and r['bottom'] - r['top'] > 5]
        if not lab_rects:
            issues.append('Keine Zeilen-Labels gefunden'); continue
        grid_top = min(r['top'] for r in lab_rects)
        grid_bot = max(r['bottom'] for r in lab_rects)
        # horizontal boundaries crossing Bemerkungen column
        hy = sorted(set(round((r['top'] + r['bottom']) / 2, 1) for r in thin
                        if (r['bottom'] - r['top']) < 1.5 and r['x1'] - r['x0'] > 4 and r['x0'] < bem_c < r['x1']
                        and grid_top - 2 <= (r['top'] + r['bottom']) / 2 <= grid_bot + 2))
        # merge near-duplicates
        ys = []
        for y in hy:
            if not ys or y - ys[-1] > 3: ys.append(y)
        if not ys or ys[0] > grid_top + 3: ys.insert(0, grid_top)
        if ys[-1] < grid_bot - 3: ys.append(grid_bot)
        # labels: group words in Arbeiten column by label rect
        arb_words = [w for w in words if arb_l - 1 <= w['x0'] and w['x1'] <= arb_r + 2 and grid_top - 1 <= w['top'] <= grid_bot]
        # build label blocks: merge vertically adjacent label rects with same colour where only one has text
        lab_rects.sort(key=lambda r: r['top'])
        blocks = []
        for r in lab_rects:
            txt = [w for w in arb_words if r['top'] - 1 <= (w['top'] + w['bottom']) / 2 <= r['bottom'] + 1]
            col = color_hex(r.get('non_stroking_color'))
            if blocks and blocks[-1]['color'] == col and abs(blocks[-1]['bottom'] - r['top']) < 2 and (not txt or not blocks[-1]['words']):
                blocks[-1]['bottom'] = r['bottom']; blocks[-1]['words'] += txt
            elif blocks and abs(blocks[-1]['top'] - r['top']) < 1 and abs(blocks[-1]['bottom'] - r['bottom']) < 1:
                blocks[-1]['words'] += [w for w in txt if w not in blocks[-1]['words']]
            else:
                blocks.append({'top': r['top'], 'bottom': r['bottom'], 'color': col, 'words': txt})
        # Baumsorte (variant label) words left of arbeiten column
        baum_words = [w for w in words if w['x1'] <= arb_l + 1 and grid_top <= w['top'] <= grid_bot]
        vchars = [c for c in page.chars if c['x1'] <= arb_l + 1 and grid_top <= c['top'] <= grid_bot and c['text'].strip()]
        # rotated text (reads bottom-to-top): sort by top descending
        variant = ''.join(c['text'] for c in sorted(vchars, key=lambda c: -c['top']))
        variant = re.sub(r',(?=\S)', ', ', variant)
        month_words = [w for w in words if w['x0'] >= jan_left - 2 and w['top'] >= grid_top - 1 and w['bottom'] <= grid_bot + 1]
        bem_l = arb_r; bem_r = jan_left
        bem_words = [w for w in words if w['x0'] >= bem_l - 1 and w['x1'] <= bem_r + 3 and grid_top - 1 <= w['top'] <= grid_bot]
        cells = [r for r in rects if not is_black(r.get('non_stroking_color')) and not is_white(r.get('non_stroking_color'))
                 and r['x1'] > jan_left + 2 and r['x0'] < edges[11][1] - 2 and r['bottom'] - r['top'] > 4
                 and grid_top - 1 <= (r['top'] + r['bottom']) / 2 <= grid_bot + 1]
        icons = [im for im in page.images if (im['x1'] - im['x0']) < 70 and (im['bottom'] - im['top']) < 20
                 and im['x0'] >= jan_left - 2 and grid_top - 2 <= (im['top'] + im['bottom']) / 2 <= grid_bot + 2]
        rows = []
        for i in range(len(ys) - 1):
            y0, y1 = ys[i], ys[i + 1]
            if y1 - y0 < 4: continue
            yc = (y0 + y1) / 2
            blk = next((b for b in blocks if b['top'] - 1 <= yc <= b['bottom'] + 1), None)
            if not blk:
                issues.append('Zeile ohne Label bei y=%.0f' % yc); continue
            own = [w for w in arb_words if y0 - 0.5 <= (w['top'] + w['bottom']) / 2 <= y1 + 0.5]
            src_words = own if own else blk['words']
            label = clean(' '.join(w['text'] for w in sorted(src_words, key=lambda w: (round(w['top']), w['x0']))))
            label_color = blk['color']
            inrow = lambda w: y0 - 1 <= (w['top'] + w['bottom']) / 2 <= y1 + 1
            row_phr = phrases([w for w in words if inrow(w) and w['x0'] >= bem_l - 1 and w['x0'] < edges[11][1]])
            remark_ph = [p for p in row_phr if p['x0'] < jan_left - 2]
            remark = join_lines(remark_ph)
            rcells = [c for c in cells if y0 - 1 <= (c['top'] + c['bottom']) / 2 <= y1 + 1]
            months = {}
            def cov(c):
                ms = []
                for mi, (l, r) in enumerate(edges):
                    if overlap(c['x0'], c['x1'], l, r) > 0.5 * (r - l): ms.append(mi)
                return ms
            for c in rcells:
                for mi in cov(c):
                    months.setdefault(mi, {'marked': True, 'texts': [], 'light': [], 'color': color_hex(c.get('non_stroking_color'))})
            mphr = [p for p in row_phr if p['x0'] >= jan_left - 2]
            # merge multi-line phrases inside the same coloured cell
            merged, used = [], set()
            for i, ph in enumerate(mphr):
                if i in used: continue
                cont = next((c for c in rcells if c['x0'] - 1 <= ph['x0'] and ph['x1'] <= c['x1'] + 1), None)
                grp = [ph]
                if cont:
                    for j in range(i + 1, len(mphr)):
                        q = mphr[j]
                        if j not in used and cont['x0'] - 1 <= q['x0'] and q['x1'] <= cont['x1'] + 1 and abs(q['top'] - ph['top']) > 2 and len(q['text']) > 3 and len(ph['text']) > 3:
                            grp.append(q); used.add(j)
                grp.sort(key=lambda q: q['top'])
                merged.append({'text': clean(' '.join(q['text'] for q in grp)), 'x0': min(q['x0'] for q in grp), 'x1': max(q['x1'] for q in grp),
                               'top': grp[0]['top'], 'bottom': grp[-1]['bottom']})
            for ph in merged:
                pc = (ph['x0'] + ph['x1']) / 2
                width = ph['x1'] - ph['x0']
                container = next((c for c in rcells if c['x0'] - 1 <= ph['x0'] and ph['x1'] <= c['x1'] + 1), None)
                colw = edges[0][1] - edges[0][0]
                if container and (width > 0.75 * colw or len(ph['text']) > 3) and len(cov(container)) > 1:
                    targets = cov(container)
                elif width > colw * 1.05:
                    targets = [mi for mi, (l, r) in enumerate(edges) if overlap(ph['x0'], ph['x1'], l, r) > 0.3 * (r - l)]
                else:
                    targets = [mi for mi, (l, r) in enumerate(edges) if l - 1 <= pc <= r + 1][:1]
                if not targets:
                    targets = [min(range(12), key=lambda mi: abs((edges[mi][0] + edges[mi][1]) / 2 - pc))]
                for mi in targets:
                    m = months.setdefault(mi, {'marked': False, 'texts': [], 'light': [], 'color': None})
                    if ph['text'] not in m['texts']: m['texts'].append(ph['text'])
            ricons = [im for im in icons if y0 - 1 <= (im['top'] + im['bottom']) / 2 <= y1 + 1]
            for im in ricons:
                cls, dark = light_class(page, im)
                ic = (im['x0'] + im['x1']) / 2
                mi = next((k for k, (l, r) in enumerate(edges) if l - 0.5 <= ic <= r + 0.5), None)
                if mi is None: continue
                m = months.setdefault(mi, {'marked': False, 'texts': [], 'light': [], 'color': None})
                m['light'].append(cls)
                m['_iconcell'] = next((c for c in rcells if c['x0'] - 1 <= ic <= c['x1'] + 1), None)
            # propagate light within same coloured cell if cell has exactly one icon type
            for c in rcells:
                ms = cov(c)
                lights = set(l for mi in ms for l in months.get(mi, {}).get('light', []))
                if len(lights) == 1:
                    for mi in ms:
                        if not months[mi]['light']:
                            months[mi]['light'] = list(lights); months[mi]['lightInherited'] = True
            for m in months.values(): m.pop('_iconcell', None)
            if rows and remark and rows[-1]['remark']:
                prev_last = rows[-1]['remark'].split()[-1]
                if remark.split()[0] == prev_last and len(remark.split()) > 1 and re.fullmatch(r'[\d:;.,]+', prev_last):
                    remark = remark[len(prev_last):].strip()
            rows.append({'label': label, 'labelColor': label_color, 'remark': remark, 'months': {str(k + 1): v for k, v in sorted(months.items())},
                         'y': [round(y0, 1), round(y1, 1)]})
        tables.append({'variant': variant, 'rows': rows, 'bbox': [jan_left, grid_top, edges[11][1], grid_bot],
                       'leftcol': arb_l})
    # outside-grid texts: legend, notes, floating hints
    def in_any_table(w):
        for t in tables:
            x0, y0, x1, y1 = t['bbox']
            if t['leftcol'] - 40 <= w['x0'] and w['x1'] <= x1 + 2 and y0 - 14 <= w['top'] <= y1 + 1: return True
        return False
    rest = [w for w in words if w['top'] > 135 and not in_any_table(w)]
    phs = phrases(rest, gap=5)
    leg = next((p for p in phs if p['text'].startswith('Legende')), None)
    notz = next((p for p in phs if p['text'].startswith('Notizen')), None)
    legend, notes, hints, zone = [], [], [], None
    legend_light = {'Sonnig', 'Halbschattig', 'Schattig'}
    # group phrases into text lines within regions
    tparts = [clean(x) for x in re.split(r'[–-]', title)] + [title]
    others = []
    for p in sorted(phs, key=lambda p: (p['top'], p['x0'])):
        t = p['text']
        if t.startswith('Legende') or t.startswith('Notizen'): continue
        if 'USDA' in t or t.startswith('Die folgenden Angaben') or t.startswith('sich auf die') or t.startswith('auf die USDA'):
            continue
        if 'Pflegekalender' in t or t in tparts or re.search(r'(?i)hier geht es zum baumportrait', t):
            continue
        if notz and p['top'] > notz['top'] - 2 and p['x0'] >= notz['x0'] - 5:
            notes.append(p)
        else:
            others.append(p)
    ztxt = ' '.join(w['text'] for w in words)
    mz = re.search(r'USDA-?\s*Klimazone\s*([0-9]+[ab]?)', ztxt)
    zone = mz.group(1) if mz else None

    def lines_of(phs, gap_y=3.5):
        # merge phrases on same line; then build line strings
        lines = []
        for p in sorted(phs, key=lambda p: (p['top'], p['x0'])):
            if lines and abs(lines[-1][0]['top'] - p['top']) < 2.5:
                lines[-1].append(p)
            else:
                lines.append([p])
        return [clean(' '.join(q['text'] for q in sorted(l, key=lambda q: q['x0']))) for l in lines]

    def cluster_hints(phs):
        # cluster floating boxes: phrases close vertically and overlapping horizontally
        cl = []
        for p in sorted(phs, key=lambda p: (p['top'], p['x0'])):
            for c in cl:
                if p['top'] - c['bottom'] < 6 and overlap(p['x0'], p['x1'], c['x0'] - 10, c['x1'] + 10) > 0:
                    c['items'].append(p); c['bottom'] = max(c['bottom'], p['bottom']); c['x0'] = min(c['x0'], p['x0']); c['x1'] = max(c['x1'], p['x1']); break
            else:
                cl.append({'items': [p], 'top': p['top'], 'bottom': p['bottom'], 'x0': p['x0'], 'x1': p['x1']})
        return [clean(' '.join(lines_of(c['items']))) for c in cl]

    def cluster_boxes(phs):
        cl = []
        for p in sorted(phs, key=lambda p: (p['top'], p['x0'])):
            for c in cl:
                if p['top'] - c['bottom'] < 6 and overlap(p['x0'], p['x1'], c['x0'] - 10, c['x1'] + 10) > 0:
                    c['items'].append(p); c['bottom'] = max(c['bottom'], p['bottom']); c['x0'] = min(c['x0'], p['x0']); c['x1'] = max(c['x1'], p['x1']); break
            else:
                cl.append({'items': [p], 'top': p['top'], 'bottom': p['bottom'], 'x0': p['x0'], 'x1': p['x1']})
        return cl
    legend_x1 = (notz['x0'] - 5) if notz else page.width / 2
    for box in cluster_boxes(others):
        if leg and box['top'] > leg['top'] - 2 and box['x1'] < legend_x1:
            legend.extend(box['items'])
        else:
            hints.append(box)
    raw_notes = lines_of(notes)
    note_lines = []
    for l in raw_notes:
        if note_lines and not re.search(r'[.!?)]\s*$', note_lines[-1]) and not re.match(r'^(\d|\*|<)', l):
            prev = note_lines[-1]
            note_lines[-1] = (prev[:-1] + l) if prev.endswith('-') and l[:1].islower() else prev + ' ' + l
        else:
            note_lines.append(l)
    # merge note continuation lines: a new note starts with a digit-dash or after blank; keep as lines
    legend_lines = []
    for l in lines_of(legend):
        if any(l.startswith(x) for x in legend_light): continue
        if legend_lines and re.fullmatch(r'[A-Z]{1,3}|/+', legend_lines[-1]) and not re.fullmatch(r'[A-Z]{1,3}|/+', l):
            legend_lines[-1] = legend_lines[-1] + ' ' + l
        else:
            legend_lines.append(l)
    hint_texts = [clean(' '.join(lines_of(b['items']))) for b in hints]
    hint_texts = [h for h in hint_texts if h and not re.fullmatch(r'[\W\d]*', h)]
    norm = lambda x: re.sub(r'^[\s–—-]+|[\s–—-]+$', '', x)
    tnorm = set(norm(x) for x in tparts) | {norm(title)}
    hint_texts = [h for h in hint_texts if norm(h) not in tnorm and norm(h) != norm(title.replace('–', '-'))]
    hint_texts = [HINT_FIXES.get((os.path.basename(path), h), h) for h in hint_texts]
    return {'title': title, 'zone': zone, 'tables': tables, 'notes': note_lines, 'legend': legend_lines,
            'hints': hint_texts, 'issues': issues}

HINT_FIXES = {
    # Two overlapping text objects in the PDF interleave on extraction; text as visible on the rendered page.
    ('Fukientee_Pflegekalender.pdf', 'Bei Bweair mwaerm Üebre Ürwbienrtwerinutnegru enngt sepnrtescphrenchde nd mehr mehr ggiieeßßeenn!!'):
        'Bei warmer Überwinterung entsprechend mehr gießen!',
}

TITLE_OVERRIDES = {
    # Title text in these PDFs is not extractable (overlapping/hidden text layer); read from the rendered page.
    'Pfaffenhütchen_Pflegekalender.pdf': 'Euonymus europea – Pfaffenhütchen',
    'Schwarzkiefer_Pflegekalender.pdf': 'Schwarzkiefer - Pinus thunbergii',
    'Waldkiefer_Pflegekalender.pdf': 'Waldkiefer - Pinus sylvestris',
    'Zirbe_Pflegekalender.pdf': 'Zirbe / Arve - Pinus cembra',
}

def split_title(title, fallback):
    t = title.replace('–', '-').replace('—', '-')
    parts = [clean(p) for p in re.split(r'\s+-\s+', t) if clean(p)]
    return parts

def main():
    idx = json.load(open(os.path.join(ROOT, 'pdf-index.json'), encoding='utf-8'))
    out, report = [], []
    for ent in idx:
        path = os.path.join(SRC, ent['file'])
        log = []
        try:
            r = parse_pdf(path, ent, log)
            ok = bool(r['tables']) and all(t['rows'] for t in r['tables'])
            report.append({'file': ent['file'], 'url': ent['url'], 'ok': ok, 'title': r['title'],
                           'tables': len(r['tables']), 'rows': sum(len(t['rows']) for t in r['tables']),
                           'issues': r['issues']})
            r['file'] = ent['file']; r['url'] = ent['url']
            if ent['file'] in TITLE_OVERRIDES:
                r['titleExtracted'] = r['title']; r['title'] = TITLE_OVERRIDES[ent['file']]; r['titleSource'] = 'manuell aus gerenderter PDF-Seite'
            out.append(r)
        except Exception as e:
            report.append({'file': ent['file'], 'url': ent['url'], 'ok': False, 'issues': ['Exception: %r' % e]})
    json.dump(out, open(os.path.join(ROOT, 'build', 'raw-parsed.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(ROOT, 'build', 'parse-report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('parsed', sum(1 for r in report if r['ok']), 'of', len(report))
    for r in report:
        if not r['ok'] or r['issues']: print(r)

if __name__ == '__main__':
    main()
