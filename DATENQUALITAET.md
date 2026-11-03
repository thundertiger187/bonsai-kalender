# Datenqualität – Extraktion der Pflegekalender-PDFs

Quelle: [Bonsai-Arbeitskreis Hildesheim – Pflegekalender über das Jahr](https://www.bonsai-arbeitskreis-hildesheim.de/bonsaipflege/pflegekalender-ueber-das-jahr.html)

Stand: 2026-11-03 · Verfahren: Download mit curl, Textextraktion mit poppler `pdftotext -layout` (Kontrolle) und pdfplumber (Positionen von Text, farbigen Zellen und Standort-Symbolen). Alle 50 PDFs haben eine Textebene, OCR war nicht nötig.

## Ergebnis

- PDFs verlinkt: 50 · heruntergeladen: 50 · strukturiert: 50
- Arten mit Varianten: Satsuki-Azalee (Satsuki, alt, Satsuki, jung)
- Kategorien (abgeleitet): Laub 29, Nadel 6, Nicht winterhart 9, Indoor 6

## Methode und Grenzen

- Monatsmarkierungen sind in den PDFs farbige Tabellenzellen. Eine Zelle zählt für einen Monat, wenn sie mehr als die Hälfte der Monatsspalte abdeckt.
- Text in verbundenen Zellen (z. B. „alle 2 Jahre“, „starke Äste“) gilt für alle Monate der Zelle. Kurze Kürzel (P, K, St, -, +, ++) gelten für den Monat, in dem sie stehen.
- Standort-Symbole (sonnig/halbschattig/schattig) sind Bilder; sie wurden über den Anteil dunkler Pixel klassifiziert und gelten für die farbige Zelle, in der sie stehen.
- Zeilenbeschriftung „Arbeiten“ → Pflegeart: Umtopfen, Standort (inkl. Winterschutz), Pinzieren/Zupfen/Triebschnitt/Blattschnitt/Schnitt → Schneiden, Drahten, Düngen, Gießen, Krankheiten/Maßnahmen → Pflanzenschutz, Vermehrung/Besonderheiten → Sonstiges.
- Freistehende Textkästen (Substrat, Hinweise mit Pfeil) sind als „Hinweise“ je Art übernommen. Die Pfeil-Zuordnung zu einer Zeile/einem Monat ist nicht ausgewertet.
- Fußnoten-Verweise in „Bemerkungen“ (– 1, *, **) werden mit den Notizen verknüpft, wenn eine passende Notiz existiert.
- Kategorie (Laub/Nadel/Nicht winterhart/Indoor) ist abgeleitet: „nicht winterhart“ in den Standort-Zeilen; Indoor zusätzlich bei Temperaturangabe ≥ 14 Grad oder „Indoor“/„geheizten Zimmer“. Nadel = botanische Zuordnung.
- Kürzel ohne Legende im PDF (z. B. „P“, „F“, „S“ in Pinzier-Zeilen, „+“/„++“ in der Satsuki-Schnittzeile) sind unverändert übernommen.
- Rechtschreibung der Quelle (z. B. „Acer ginalla“, „Euonymus europea“, „Diche Äste“) ist nicht korrigiert.

## Je PDF

| PDF | Art | Zeilen | Auffälligkeiten |
|---|---|---|---|
| [Apfel_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=22896124&vnr=154824) | Apfel | 11 | – |
| [Berberitze_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=22942017&vnr=259448) | Berberitze | 11 | – |
| [Birke_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=22942044&vnr=480678) | Birke | 11 | – |
| [Blauregen_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=22942054&vnr=268799) | Blauregen | 11 | – |
| [Bougainvillea_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=22942055&vnr=269470) | Bougainvillea (Drillingsblume) | 11 | – |
| [Buchsbaum_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=22942056&vnr=528928) | Buchsbaum | 11 | – |
| [chin._Ulme_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23092199&vnr=427687) | Chinesische Ulme | 11 | – |
| [Cotoneaster_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23092195&vnr=516504) | Cotoneaster (Zwergmispel) | 9 | – |
| [Dreispitzahorn_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23092203&vnr=894325) | Dreispitzahorn | 10 | Zeilen „junge Pflanzen“/„ältere Pflanzen“ (Farbe Pinzieren/Schnitt) als Schneiden eingeordnet |
| [Eibe_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23092202&vnr=863053) | Eibe | 10 | – |
| [Eiche_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23092211&vnr=716986) | Eiche | 11 | – |
| [Erle_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23092210&vnr=653997) | Erle | 11 | – |
| [Esche_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23092213&vnr=208396) | Esche | 11 | – |
| [Fächerahorn_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=26283865&vnr=774662) | Fächerahorn | 11 | – |
| [Feige_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23093990&vnr=533927) | Feige | 11 | – |
| [Feldahorn_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23093995&vnr=188204) | Feldahorn | 11 | – |
| [Feuerahorn_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23094000&vnr=783396) | Feuerahorn | 11 | – |
| [Feuerdorn_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23094006&vnr=912766) | Feuerdorn | 11 | – |
| [Fichte_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23094005&vnr=944770) | Fichte | 11 | – |
| [Potentilla_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23100608&vnr=450135) | Fingerkraut (Potentilla) | 9 | – |
| [Forsythie_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=26283866&vnr=710365) | Forsythie | 11 | – |
| [Fuchsie_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=26283867&vnr=181119) | Fuchsie | 9 | – |
| [Fukientee_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23094008&vnr=702961) | Fukientee | 11 | Ein Hinweis war als überlagerter Doppeltext gespeichert; Text aus gerenderter Seite übernommen |
| [Ginkgo_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=26283875&vnr=159687) | Ginkgo (Fächerblattbaum) | 12 | – |
| [Granatapfel_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23097786&vnr=918264) | Granatapfel | 11 | – |
| [Hainbuche_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23097781&vnr=887982) | Hainbuche | 9 | – |
| [Hartriegel_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23097785&vnr=530072) | Hartriegel | 11 | Hinweis im PDF abgeschnitten: „Mischung aus Akadama, Bims und Lavagranulat im Verhältnis 1:1:1 – dazu eine Hand voll Torf oder“ |
| [Heckenkirsche_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23097783&vnr=642809) | Heckenkirsche | 11 | – |
| [Junischnee_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23097788&vnr=578491) | Junischnee | 11 | – |
| [Kerbbuche_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23097789&vnr=345960) | Kerbbuche | 11 | Hinweis im PDF abgeschnitten: „Nicht über die Blätter gießen, neigt zu“ |
| [Lärche_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23097787&vnr=975942) | Lärche | 9 | – |
| [Liguster_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23097794&vnr=722827) | Liguster | 11 | – |
| [Linde_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23097795&vnr=640750) | Linde | 11 | – |
| [Maulbeerbaum_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23100606&vnr=937155) | Maulbeerbaum | 11 | – |
| [Myrte_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23100604&vnr=981367) | Myrte | 9 | – |
| [Olive_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23100605&vnr=610746) | Olive | 10 | – |
| [Pfaffenhütchen_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23100609&vnr=693418) | Pfaffenhütchen | 11 | Titel nicht extrahierbar (überlagerte Textebene), aus gerenderter Seite übernommen; Schraffur „////“ = „jeweilige Maßnahme auch noch möglich“ (als optional markiert) |
| [Pfefferbaum_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23100607&vnr=471075) | Pfefferbaum | 10 | – |
| [Rotbuche_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23104586&vnr=985164) | Rotbuche | 9 | Substrat steht in der Bemerkungsspalte der Umtopfen-Zeile |
| [Sageretie_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23104590&vnr=277148) | Sageretie | 11 | – |
| [Satsuki_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23104584&vnr=696834) | Satsuki-Azalee | 18 | – |
| [Schlehe_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23104589&vnr=100892) | Schlehe | 9 | – |
| [Schneeball_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23104593&vnr=247583) | Schneeball | 11 | – |
| [Schwarzkiefer_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=31273512&vnr=335164) | Schwarzkiefer | 14 | Titel nicht extrahierbar (überlagerte Textebene), aus gerenderter Seite übernommen |
| [Ulme_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23106855&vnr=262247) | Ulme | 11 | – |
| [Waldkiefer_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=31273479&vnr=647542) | Waldkiefer | 14 | Titel nicht extrahierbar (überlagerte Textebene), aus gerenderter Seite übernommen |
| [Weißdorn_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23106853&vnr=855887) | Weißdorn | 9 | Hinweis im PDF abgeschnitten: „Gelegentlich auftretender Blattlausbefall kann mit“ |
| [Zelkove_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23106854&vnr=564155) | Zelkove | 11 | – |
| [Zierquitte_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=23104592&vnr=705715) | Zierquitte | 11 | – |
| [Zirbe_Pflegekalender.pdf](https://www.bonsai-arbeitskreis-hildesheim.de/get_file.php?id=31273511&vnr=160062) | Zirbe / Arve | 11 | Titel nicht extrahierbar (überlagerte Textebene), aus gerenderter Seite übernommen |

## Fehlgeschlagen

Keine.
