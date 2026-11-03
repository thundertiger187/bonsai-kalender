#!/usr/bin/env python3
"""Vectorises tools/logo/original.jpg (user logo) to docs/icons/logo.svg with potrace (potracer)."""
import numpy as np, potrace, sys
from PIL import Image, ImageFilter
from scipy import ndimage
SRC = 'tools/logo/original.jpg'
SMALL = '--small' in sys.argv  # Variante für ≤ 48 px: feine Blatt- und Rindenlinien geschlossen, etwas kräftiger
OUT = 'docs/icons/logo-small.svg' if SMALL else 'docs/icons/logo.svg'
FILL = '#1F2A1C'
im = Image.open(SRC).convert('L')
a = np.array(im)
ys, xs = np.where(a < 110)
pad = 6
box = (xs.min() - pad, ys.min() - pad, xs.max() + pad + 1, ys.max() + pad + 1)
S = 3  # Hochskalieren für glattere Kurven
crop = im.crop(box)
crop = crop.resize((crop.width * S, crop.height * S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
m = np.array(crop) < 105
lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1))
m = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 200 * S])  # Papierflecken entfernen
# Löcher < Schwelle füllen (Papierstruktur in der Fläche), echte Blatt-/Rindenlinien bleiben
inv = ~m; lab2, n2 = ndimage.label(inv); sz2 = ndimage.sum(inv, lab2, range(1, n2 + 1))
m |= np.isin(lab2, [i + 1 for i, s in enumerate(sz2) if s < (220 if SMALL else 12) * S * S])
if SMALL: m = ndimage.binary_dilation(m, iterations=2 * S)
bmp = potrace.Bitmap(~m)  # potracer: False = Vordergrund
path = bmp.trace(turdsize=8 * S, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=(2.0 if SMALL else 0.8))
def f(v): return f'{v / S:.1f}'.rstrip('0').rstrip('.')
d = []
for c in path:
    st = c.start_point; d.append(f'M{f(st.x)} {f(st.y)}')
    for seg in c.segments:
        if seg.is_corner: d.append(f'L{f(seg.c.x)} {f(seg.c.y)}L{f(seg.end_point.x)} {f(seg.end_point.y)}')
        else: d.append(f'C{f(seg.c1.x)} {f(seg.c1.y)} {f(seg.c2.x)} {f(seg.c2.y)} {f(seg.end_point.x)} {f(seg.end_point.y)}')
    d.append('Z')
w, h = m.shape[1] / S, m.shape[0] / S
side = max(w, h); ox, oy = (side - w) / 2, (side - h) / 2
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-ox:.1f} {-oy:.1f} {side:.1f} {side:.1f}" role="img" aria-label="Bonsaijahr">'
       f'<path fill="{FILL}" fill-rule="evenodd" d="{"".join(d)}"/></svg>\n')
open(OUT, 'w').write(svg)
print('crop', box, 'paths', len(path), 'bytes', len(svg))
