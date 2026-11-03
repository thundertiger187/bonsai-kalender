# Bonsaijahr – Bonsai-Pflegekalender

PWA, die für deine Bonsai zeigt, welche Pflegeschritte im aktuellen Monat anstehen.

**Live:** https://thundertiger187.github.io/bonsai-kalender/

## Quelle

Alle Pflegeangaben stammen aus den Pflegekalendern des **Bonsai-Arbeitskreises Hildesheim**:
https://www.bonsai-arbeitskreis-hildesheim.de/bonsaipflege/pflegekalender-ueber-das-jahr.html

Die App verlinkt je Art das Original-PDF. Die PDFs selbst liegen nicht in diesem Repository. Die Rechte an den Inhalten liegen beim Arbeitskreis; die App ist kein Angebot des Arbeitskreises. Details zur Extraktion und zu bekannten Lücken: [DATENQUALITAET.md](DATENQUALITAET.md).

## Funktionen

- **Heute:** Arbeiten des Monats (oder der Woche) je Baum, gruppiert nach Pflegeart, abhakbar je Baum und Monat. In den letzten 7 Tagen eines Monats: Vorschau auf neue Arbeiten im Folgemonat.
- **Meine Bäume:** anlegen, bearbeiten, löschen; Name, Art (ggf. Variante), Erwerbsjahr, Notizen, Foto.
- **Arten:** 50 Pflegekalender, Suche (deutsch/botanisch) und Filter (Laub, Nadel, Nicht winterhart, Indoor).
- **Jahresübersicht:** 12-Monats-Raster je Art, Monat antippen für Details; Substrat, Hinweise, Notizen, Legende, Quelle.
- Offline nutzbar, installierbar, keine Server-Daten: alles bleibt im Browser (localStorage, Fotos in IndexedDB). Export/Import als JSON.

## Aufbau

```
docs/            ausgelieferte App (GitHub Pages: main /docs), Vanilla JS ohne Build
  data/species.json   strukturierte Daten aller Arten
  js/logic.js         reine Logik (Monatsaufgaben, Woche, Suche, Validierung)
tools/           parse_pdfs.py (PDF → Rohdaten), build_data.py (→ species.json + DATENQUALITAET.md), icons.mjs
tests/unit/      node --test
tests/e2e.mjs    Playwright: Abläufe, Offline, Layout 360×640 / 390×844 / 412×915 / 1440×900, Screenshots
```

## Lokal

```
python3 -m http.server 8080 -d docs     # http://localhost:8080
npm install && npm test && npm run e2e  # Tests (Playwright mit Chrome)
```

Daten neu erzeugen: PDFs per `curl` nach `source-pdfs/` laden (URLs in `pdf-index.json`), dann `python3 tools/parse_pdfs.py && python3 tools/build_data.py` (benötigt pdfplumber).
