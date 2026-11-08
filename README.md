# Spell Legends – Deutsch-Trainer für die Schularbeit

Web-App (PWA) fürs iPhone: Der Deutsch-Stoff ist ein Regal voller Zaubertränke. Ein Trank füllt sich, wenn das Kind
eine Formel an verschiedenen Tagen weiß. Ziel: alle drei Balken über die Ziellinie (95 %). Geschrieben wird auf Papier,
die App gibt Auftrag, Bauplan und Checkliste. Kein App Store, kein Build-Schritt, keine Abhängigkeiten. Läuft offline,
sobald sie einmal geöffnet wurde. Gerüst nach Word Legends (`wl-v6`).

„Spell“ heißt Zauberspruch und buchstabieren. Die internen Kennungen bleiben `dl` (`deutschlegends.v1`, `DL1:`,
Cache `dl-…`): Sie benennen das Fach, daran hängt der Fortschritt – nie ändern.

**Stand `dl-v5`** (`dl-v2` = erste veröffentlichte Version, 07.11.2026; `dl-v3`: Regelkarten mit Formen untereinander,
Abfrage passt über die Tastatur; `dl-v4`: Tage vor dem Plan-Start zählen nie als ausgelassen, Merker `vs` im Protokoll;
`dl-v5`: klarer Tagesauftrag – Kasten „Deine Mission heute“ mit ① Runde und ② Schreiben, Rundenende „Etappe 1 von 2“,
bedingte Punkte in der Checkliste, Bericht sagt Legends HQ, was heute offen ist). Grundlage:
`auftraege/2026-11-07_deutsch-app.md` (Abschnitt 5, Entscheidung „Klarer Tagesauftrag“ vom 08.11.2026) und
`auftraege/2026-11-07_deutsch-app/bauauftrag.md`.

## Aufs iPhone

1. In **Safari** die veröffentlichte Adresse öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. Ab jetzt nur noch über das Icon starten. Der Fortschritt liegt auf dem Gerät, in der Home-Bildschirm-App.
   Wer die App löscht, löscht den Fortschritt. Sicherung: Einstellungen → „Code kopieren“ (beginnt mit `DL1:`).

## Wie gelernt wird (bauauftrag 4, lernmodell 3b und 4)

Alle Zahlen stehen in `MODELL` oben in `app.js`.

| Baustein | Umsetzung |
|---|---|
| Stufen | 0 leer · 1 = ⅓ · 2 = ⅔ · 3 = voll (sitzt) · 4–6 voll, 6 glüht |
| Pausen | nach Erreichen der Stufe 1 · 2 · 3 · 5 · 10 · 21 Tage, Stufe 6 und gewusst 45. Endspurt (Test − 3): Stufe 1 und 2 nach 1 Tag |
| Einmal pro Tag | Nur der erste Versuch des Tages bei einer fälligen Karte ändert die Stufe |
| Fehler | −1 (mindestens ⅓), morgen wieder. In der Runde: richtige Form mit markierter Stelle, einmal abschreiben, nach mindestens 5 anderen Karten noch einmal (höchstens 3×) |
| Hilfe | „Familie anzeigen“ oder Tipp: Stufe bleibt, morgen wieder |
| Blitz-Check | Jede neue Karte zuerst „Kennst du das schon?“. Einzelwissen gewusst → voll mit **Stern**, ruht bis nach dem Test (fällig 24.–28.11.) · Regel-Karte → ⅔, in 2 Tagen · Auswahl (vg, no-ka, vb-ss) → ⅓ · Einzelwissen nicht gewusst → kurzer Lernschritt (abschreiben), ⅓ · Regel/Auswahl nicht gewusst → wie Fehler |
| Verb-Check | Tabellenzeile Nennform → Mitvergangenheit · hat/ist + 2. Mittelwort, jede Form ist eine eigene Karte. An den Check-Tagen (`verbCheck.tage`) offene ÷ verbleibende Tage; höchstens 4 je Familie (fairer Anteil je Familie), `nichtZusammen` nie am selben Tag. Was nach dem letzten Check-Tag offen ist, kommt am nächsten Tag |
| Ziel-Pakete | neu am `ab`-Tag oder danach, ganz, mit Merkkarte; verpasste Tage holen nach. Wer vor dem ersten Plan-Tag öffnet, bekommt dessen Inhalt schon |
| Tagesablauf | 1 fällige A (wackeligste zuerst) · 2 neue A (Verb-Check zuerst) · 3 fällige Extra · 4 neue Extra. **A wird immer fertig**; der Deckel (20 Min., an Tagen mit ganzem Text 12) stoppt nur 3 und 4. Wiederholungen höchstens 50 (gekürzt wird nur Extra). Höchstens 3 Karten desselben Themas hintereinander |
| Mission (seit `dl-v5`, vorher „Runde fertig“) | ① Runde = A des Tages fertig, ② an Schreibtagen der Schreibauftrag des Tages selbst geprüft (Herzeigen und Ausbessern gehören nicht dazu). „Runde“ heißt nur noch die Karten-Runde. Am Testtag keine Mission |
| Extra-Regal | neue Extra-Karten in `rang`-Reihenfolge, automatisch, wenn unter dem Deckel Zeit bleibt; „+1 Paket“ = die nächsten 8, höchstens 1 pro Tag, nur nach fertiger Runde, nicht in den letzten 3 Tagen |
| Endspurt (Sa–Mo) | Karten ohne Stern, seit Test − 4 nicht gewusst: Stufe ≥ 3 einmal an Sa, So oder Mo (nach Kartennummer), Stufe ≤ 2 spätestens Mo. Sterne ruhen |
| Testtag | freiwillig aufwärmen, höchstens 10 Karten, nichts Neues |
| Nach dem Test | alles läuft weiter; Sterne werden verteilt auf Test + 7 … Test + 11 fällig (24.–28.11., fest nach dem Hash der id) |
| Verdunstet | über 7 Tage überfällig → zählt auf der Ziel-Karte eine Stufe tiefer |
| Sekunden (Schätzung) | Verbform 10 · Regel/Lücke 10 · antippen 5 · Steigerung 15 · Liste 25 · Merkkarte 30 · Fehler +15 (erwartete Fehlerquote neu 40 %, Wiederholung 15 %) |
| Halbzeit | nach etwa 10 Min.: „Halbzeit! … Kurz Pause oder weiter?“ |

## Ziel-Karte, Regal, Titel (erlebnis 3, 11a, 11b)

- Drei Balken je ⅓: **Personenbeschreibung** (½ Ziel-Karten, ½ die 4 Schreib-Tränke), **Unregelmäßige Verben**,
  **Wortarten**. Ein Balken = Mittel seiner Ziel-Karten (Stufe/3). Prozent wird abgerundet (94,9 → 94).
- Ziellinie bei 95 % (karierter Strich), darüber Gold. Alle drei drüber → Stempel **BEREIT**, später einer drunter →
  **FAST BEREIT**, 100 % → **PERFEKT**. Konfetti nur beim ersten BEREIT, neuem Titel und 100 %.
- Titel nach der großen Zahl: Zauberlehrling → Trankbrauer (25 %) → Formel-Profi (50 %) → Wortmagier (75 %) →
  **Spell Legend** bei BEREIT. Erreichte Titel bleiben (`ui.titel`).
- Regal: Bretter je Bereich (Verben nach Familien als Doppel-Phiole) und das Brett „Extra – zählt nicht für die
  Ziellinie“. Stern-Korken = im Blitz-Check gewusst. Kein XP, keine Münzen, keine Flammen.
- Nur `rolle: 'ziel'` zählt (249 Karten + 4 Schreib-Tränke). Extra und Nachschlagen nie.
- Zauberbuch, Tab Regeln: Ein Eintrag ist erst lesbar, wenn alle seine `pakete` begonnen haben (Merkkarte gelesen
  oder eine Karte im Regal); vorher nur der Titel, ausgegraut. So steht keine Antwort vor ihrem Blitz-Check im Buch.

## Deine Mission heute (seit `dl-v5`)

Anlass: Am 08.11.2026 hielt sich das Kind nach der Karten-Runde für fertig („Runde geschafft!“, großer Knopf „Fertig“, der
Schreibauftrag stand unter dem Falz). Texte von `motivation-spiel`, Entscheidungen der Projektleitung. Logik: `missionHeute()`.

| Stelle | Verhalten |
|---|---|
| Startseite, unten in der Ziel-Karte | Kasten **Deine Mission heute**: `○ ① Runde · 12 fällig · 8 neu · ca. 15 Min.` (am 1. Tag statt der Zahlen „Blitz-Check: Welche Verben kannst du schon?“), `○ ② Schreiben auf Papier · „Einleitung“ · ca. 6 Min.` Offene Zeilen sind antippbar, erledigte zeigen ✓ in Lime (nie ✕ oder Rot). Start führt zum nächsten offenen Schritt (① sonst ②). Zeile ② und Knopf nach Stand des Schreibauftrags (`schreibStand()`): nicht begonnen „· ca. 6 Min.“ und [Jetzt schreiben] · begonnen „· angefangen“ und [Weiterschreiben] · geschrieben, nicht geprüft „· noch selbst prüfen“ und [Selbst prüfen]; Antippen führt zum richtigen Schritt. Klein darunter: „Sind beide ✓, ist deine Mission geschafft. Reihenfolge, wie du magst.“ bzw. „Noch ②/①, dann …“. Ohne Schreibauftrag heute eine Zeile ohne Nummer (`○ Runde · …`). Gezählt wird wie früher in der Start-Zeile (mit dem Extra, das unter den Deckel passt); ✓ hängt nur an A |
| Startseite ganz fertig | **Mission geschafft ✓** mit den ✓-Zeilen, dann wie bisher „Morgen bereit“, „+1 Paket“, Freies Üben. Passt noch Extra unter den Deckel (schneller als geschätzt), steht dort „Extra: N Tränke“ statt „+1 Paket“ mit „Freiwillig, ca. N Min. Extra zählt nicht für die Ziellinie.“ Nichts fällig und nichts gemacht: wie bisher „Für heute erledigt ✓“ |
| Unter dem Kasten (ohne Nummer, ohne ○) | „Herzeigen: „Einleitung“ · dein Blatt für Mama oder Papa, 1 Min.“ · „Ausbessern: „Einleitung“ · ca. 3 Min.“ · freiwillig ein weiterer Schreibauftrag, wenn heute schon einer geprüft ist (zum Aufholen, wie bisher) |
| Rundenende, ② offen | **Etappe 1 von 2 geschafft!**, gleich darunter `✓ ① Runde · ○ ② Schreiben auf Papier` und „Jetzt noch ②: …“ mit [Jetzt schreiben] (bzw. [Weiterschreiben], [Selbst prüfen] wie auf der Startseite) [Pause], unten „Pause“ statt „Fertig“ |
| Rundenende, alles fertig | **Mission geschafft!** (nur wenn die Mission mit dieser Runde fertig wurde), sonst wie bisher. Kein Konfetti für die Mission. Freies Üben, Extra-Paket, Testtag und abgebrochene Runde wie bisher |
| Nach „Fertig geprüft“ | unter „… zu einem Drittel voll!“: „**Mission geschafft ✓** Für heute ist alles drin.“ bzw. „Noch ① Runde, dann ist deine Mission geschafft.“ |
| Testtag | wie bisher: „Aufwärmen · N fällig · ca. N Min.“, kein Kasten |
| Plan-Karte | Text unverändert; Vorlese-Texte der Tage: „Mission geschafft“, „angefangen, Mission noch offen“ (Word und Geo seit wl-v8/gl-v4 gleich) |
| Ziel-Karte, erster Tag | „N % · Los geht’s!“ mit der echten Zahl (vorher fest „0 %“, auch wenn der Schreib-Trank schon 1 % brachte) |

## Schreiben auf Papier (bauauftrag 6)

Auftrag (Person wählen) → Bauplan, Satzanfänge, Wortspeicher → „Nimm ein Blatt und deine Füllfeder“ (ruhiger
Bildschirm, keine Uhr; nur die Probe zählt die Minuten mit) → Checkliste selbst abhaken (alles → Trank ⅓) → Herzeigen
bei Mama oder Papa: je Teil drei Fragen (Ja / Noch nicht), „Passt – ich unterschreibe das Blatt“ → ⅔, „Morgen
nochmal“ → bleibt ⅓, am nächsten Tag Ausbessern (ca. 3 Min.). Voll = zweites „Passt“ an einem anderen Tag in einem
ganzen Text, bei dem der Wortspeicher beim Schreiben zu war. Wortspeicher: 1a–1d offen, ganzer Text nur zum
Überarbeiten, Probe zu. Kein Foto, kein Text im Handy; an den Server gehen nur Zahlen.

**Bedingte Punkte** (seit `dl-v5`, fachdidaktik 08.11.2026): Ein Checklisten-Punkt, der mit „wenn es passt:“ beginnt
(Hautfarbe, Brille und Schmuck, was die Person in der Hand oder unter dem Arm hält), braucht ✓ oder „passt hier nicht“;
beides schließt sich aus. Er steht etwas heller da, unter der Anleitung: „„Wenn es passt“ heißt: wenn deine Person das
hat oder man es sieht. Sonst tipp auf „passt hier nicht“.“ Pflichtpunkte brauchen wie bisher ✓. „Fertig geprüft“ geht
erst, wenn alles entschieden ist (`checklisteFertig()`). Kein Pflichtpunkt beginnt mit „wenn es passt:“. Der Satz
„Noch nicht alles abgehakt? …“ unter dem Knopf bleibt danach stehen und wird nur ausgeblendet (`.unsichtbar`): Sonst
rutschte die Liste ganz unten beim letzten Antippen um gut 50 px, und der nächste Tipp ginge daneben.

## Stoff (`stoff.js`, Format 2)

Format im Dateikopf, Datenvertrag in bauauftrag.md Abschnitt 3. `prep()`-Teil in `app.js` liest ihn: Verben werden zu
je zwei Karten (`<id>-prae`, `<id>-perf`), Regel-Karten ziehen bei jeder Abfrage ein anderes Beispiel aus ihrem Pool,
`varianten` wechseln bei Wiederholungen durch. Bis zu 6 Eingabefelder bzw. Lücken. Fehlerhafte Einträge lässt die App
weg und nennt sie in der Konsole (`DL.stoff().fehler`). **ids nie ändern oder wiederverwenden.**

```bash
node apps/deutsch-legends/tools/stoff-pruefen.mjs            # Fehler und Übersicht
node apps/deutsch-legends/tools/stoff-pruefen.mjs --merken   # vor dem Veröffentlichen: ids ins Register tools/ids.txt
```

## Antworten prüfen (stoff.md 7)

| Regel | Umsetzung |
|---|---|
| Genau | Groß/klein, ä/ö/ü und ß zählen. Vereinheitlicht werden nur Unicode-Form, Leerzeichen, typografische Zeichen, Satzzeichen am Ende |
| Kein „Fast!“ bei getippten Formen | Band „Schau genau“ mit markierter Stelle (Fehler, −1); „So geht’s“ bei leer, „Weiß nicht“ oder ganz daneben; „Fast!“ nur bei Ordnen, wenn genau zwei Nachbarn vertauscht sind (zählt trotzdem als Fehler) |
| Fehlerarten | `gross`, `umlaut`, `ss`, `einfachS` (richtig ist ein einfaches s: las, Häuser), `am` (Meiststufe ohne „am“), `alswie-…`, `feld` (vertauscht), `liste`; Verben: `hilfsverb`, `ohneHilfsverb`, `person` (habe/bin), `verbGross`, `schwach`, `misch`, `ohne-ge`, `partizip-o`, `i-kurz`, `ei-ie`, `h`, `andere` (andere Bedeutung, nicht gelöst). Texte: `fallen` und `tipps` in `stoff.js`, sonst Standard in `app.js` |
| Verben | Fürwort (ich/er/sie/es) wird entfernt; „backte/buk“ zählt; `alt` (österreichisch) voll richtig mit „Stimmt auch. Auf deinem Blatt steht …“ |
| Listen | Reihenfolge egal, getrennt durch Beistrich, Leerzeichen oder „und“; jedes genau einmal |
| Eingabe | `autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false"`, ß-Knopf über der Tastatur, Enter springt ins nächste Feld, hat/ist als Knöpfe; als/wie im Blitz-Check als Knöpfe, danach getippt |
| Tastatur offen (seit `dl-v3`) | Die Abfrage ist so hoch wie der sichtbare Bereich über der Tastatur (`--vvh`, `body.kb`). Kopf, Band und Felder rücken zusammen. Passt eine Tipp-Karte trotzdem nicht, setzt `passend()` nur während der Frage diese Stufen: `.eng` (doppelter Hinweis `.qhint.zusatz` weg, Frage kleiner) · `.enger` (auch das Band weg) · `.scrollt` (Auftrag und Hinweis an den Anfang der Karte, der Rest scrollt). Wichtige Hinweise (Verb, Ausgangssatz, Kategorie, Auftrag) bleiben **immer** stehen; ein neuer Hinweis, der nur die Feldnamen wiederholt, bekommt die Klasse `zusatz`. Ab 5 Feldern hat das Formular bei offener Tastatur 3 Spalten (`sehrviele`). Nach dem Prüfen klappen Felder ein, die nichts mehr brauchen (`felderEinklappen()`, nie das Feld mit dem Cursor), damit die Rückmeldung Platz hat; die Zeile über der Karte fällt weg (`.rm`). Ein angetipptes Feld klappt immer auf. Die Tastatur bleibt die ganze Runde offen |
| Regeltexte | `regelHTML()`: festes Leerzeichen vor „ – “ und nicht trennender Bindestrich am Anfang einer Endung (-er, -sten), damit „sinken – sank“ und „-sten“ nicht auseinanderbrechen. Formen untereinander als `<table class="gtable formen">` mit dem Fachbegriff als `<br><i>…</i>` |

## Termin, Plan-Karte, Eltern-Verbindung

- `stoff.js` → `test` gilt als „von Mama/Papa“ (gesperrt in den Einstellungen), `eingetragen` = Starttag des Plans.
- `legends-status.js` und `legends-sync.js` sind Kopien aus `apps/legends-hq/shared/` – **hier nie von Hand ändern**
  (dort ändern, dann `node tools/verteilen.mjs` in `apps/legends-hq`).
- `berichtEingabe()`: Regeln `MODELL.ampel` (Pausen wie oben, `vorwissen 0.62`, `minGelb 25`, `minRot 30` …), Ziel =
  nur Rolle `ziel`, `fortschritt` (Prozent, bereit, perfekt, Balken, Schreib-Zahlen, Check-Quote). Offen heute =
  fällige und neue A plus 1 für den Schreibauftrag; am Testtag nichts. Den Termin meldet die App nur, wenn die geladene
  `legends-status.js` `vorwissen` kennt – sonst zeigte eine alte Kopie zu Unrecht Rot.
- Seit `dl-v5` meldet `fortschritt.schreiben` zusätzlich den Stand von heute: `offen` (0/1, Schreibauftrag heute noch
  offen, steckt schon in `heute.neu`), `erledigt` (0/1, heute einer selbst geprüft) und `herzeigen` (Texte, die aufs
  Herzeigen warten). Legends HQ zeigt damit „Heute: … · Runde ✓ · Schreibauftrag auf Papier noch offen“ und „Zum
  Herzeigen: 1 Text …“, die Abendnachricht nennt, was fehlt.
- Früher Start: Wer vor dem ersten Plan-Tag (`PLAN_START`, 08.11.2026) öffnet, bekommt dessen Inhalt schon – freiwillig.
  `vorStartTage()` (vor jedem Bericht) merkt sich solche Tage im Protokoll (`vs = 1`) und setzt sie, sobald sie vorbei
  sind, auf nichts offen (`o = 0`, „nichts fällig“) bzw. auf fertig, wenn dort geübt wurde. Gemessen wird am Merker,
  nie am heutigen `PLAN_START`: Rückt der mit neuem Stoff nach hinten, bleiben echte Plan-Tage, wie sie waren. Ohne
  Merker (Protokolle aus `dl-v1` bis `dl-v3`) gilt nur die Zeit vor dem 08.11.2026 (`VORSTART_ALT`). Bis `dl-v3`
  zählte der Einrichtungstag (07.11.) am nächsten Tag als ausgelassen, Ampel „Aufholen“. Bekannt: Legends HQ zeigt
  das noch, solange der letzte Bericht vom Tag vor dem Start ist (Server rechnet den Berichtstag als offen).
- Plan-Karte: Im Plan Lime, Aufholen Sonne, Notfallplan Orange; `pause` (kein Termin) und `unbekannt` grau.
- Melden nach dem Start, beim Zurückholen (höchstens alle 10 Minuten) und am Ende jeder Runde und jedes
  Schreibauftrags; Sichern (verschlüsselt) am Ende jeder Runde.

## Speicher (`localStorage['deutschlegends.v1']`)

`settings` (name, testDate, testSince, sfx) · `k` (Karte: lv, due, last, ok, bad, since; dazu s = Stern seit, gw =
zuletzt gewusst, c = Blitz-Check 1/0, v = nächste Variante, b = letztes Pool-Beispiel) · `regel` (Paket → Tag der
Merkkarte) · `papier` (nur Altstand dl-v1) · `stats` (xp bleibt aus dl-v1, wird nicht mehr gezeigt) · `day` (date,
newCount, extra) · `ui` (hideInstall, onboarded, ziellinie, titel, bereit, perfekt) · `schreiben` (`a` je Auftrag:
person, start, fertig, haken, passtNicht, selbst, herz, aus, ausN, rate, dauer · `t` je Schreib-Trank: lv, passt) · `log` · `plaene`.
`haken` und `passtNicht` hängen am Index der Checkliste: Die Zahl der Punkte je Teil darf sich nie ändern.
Neue Felder nur über `fresh()` und `upgrade()`; ein unlesbarer Stand wird als `deutschlegends.v1.kaputt` beiseitegelegt.
Update dl-v1 → dl-v2: alle Felder bleiben, `ui.ziellinie` fehlt → der Ziellinien-Bildschirm kommt einmal. Update dl-v2 → dl-v3: Speicher unverändert. Update dl-v3 → dl-v4: Speicher unverändert; nur im `log` werden Tage vor
dem 08.11.2026 berichtigt (`o = 0`, mit Üben `f = 1`). Neu im `log`: `vs = 1` = Tag vor dem Plan-Start (früher Start).
Update dl-v4 → dl-v5: Speicher nur erweitert. `passtNicht` (Liste parallel zu `haken`) entsteht beim ersten Öffnen von
„Selbst prüfen“; fehlt es, gilt überall „nein“. Alte `haken` bleiben; ein früher nicht abgehakter bedingter Punkt braucht
jetzt ✓ oder „passt hier nicht“. Getestet mit einem echten dl-v3-Stand (Runde fertig, Schreibauftrag angefangen, 4 von 5 ✓):
kein Feld verloren.

## Offline und Updates

Wie Word Legends seit `wl-v5`: App-Dateien mit Internet frisch vom Server (höchstens 2,5 s warten), sonst aus dem
Cache. Neue `VERSION` (in `sw.js` **und** `app.js`, Stand `dl-v5`) wird beim Öffnen und beim Zurückholen erkannt; die
App lädt neu, sobald sie auf der Startseite ist, nie mitten in einer Runde. Der Service Worker löscht nur eigene Caches
(`dl-…`). Die laufende Version steht unten in den Einstellungen („Version 5“).

## Dateien

- `index.html` – Gerüst, iOS-Meta-Tags · `styles.css` – Design (Farb-Tokens oben: Violett `#8E2A93`, Tränke `--t0…--t3`)
- `stoff.js` – der Stoff · `app.js` – Lernlogik und Oberfläche (ein IIFE in Abschnitten)
- `legends-status.js`, `legends-sync.js` – Kopien aus `apps/legends-hq/shared/`
- `sw.js` – Offline-Cache · `manifest.webmanifest`, `icons/` – App-Icon (Quelle `icons/icon-source.html`)
- `tools/devserver.py` – Test-Server ohne Cache · `tools/stoff-pruefen.mjs` – Prüfung von `stoff.js`

## Lokal testen

```bash
# im Projektordner (oder über .claude/launch.json „deutsch-legends“, Port 8770)
python3 apps/deutsch-legends/tools/devserver.py 8770
```

Auf localhost ist der Offline-Cache aus (mit `?sw` trotzdem testen). Browser-Konsole:

| Befehl | Wofür |
|---|---|
| `DL.shiftDays(1)` | einen Tag weiter (nur in diesem Tab) |
| `DL.tag()` | Tagesmenge wie auf der Startseite: Mission (`○/✓ Runde · ○/✓ Schreiben`), fällig/neu A und Extra, Verben, Minuten, Deckel, Schreibauftrag, Herzeigen, Ausbessern, Zielstand |
| `DL.autoRunde({ p, vw, schreiben, seed })` | Simulation: spielt die Tagesrunde ohne Oberfläche (p = richtig bei Wiederholungen, vw = im Blitz-Check gewusst), Schreibauftrag mit „Passt“ |
| `DL.check(id, eingabe, variante)` | Antwort prüfen; id einer Karte oder eines Pool-Beispiels; eingabe = Text oder Liste je Feld/Lücke, Verb Vergangenheit `['hat', 'gegangen']` oder `'ist gegangen'` |
| `DL.ueben(['id', …], art)` | bestimmte Karten gleich üben (`art` 'check' = wie beim ersten Mal); auch `'vcheck:v-bieten'` (Verb-Check) und `'regel:v'` (Regelkarte eines Pakets) |
| `DL.ziel()` · `DL.prognose()` · `DL.stoff()` | Zielstand · „Bereit frühestens …“ · geladener Stoff und Fehler darin |
| `DL.bericht()` · `DL.urteil()` · `DL.eingabe()` | Lagebericht, Ampel, Eingabe dafür |
| `DL.melden()` · `DL.sync` | melden und sichern (nur mit Verbindung) · Verbindungszustand |

Tastatur nachstellen (Chrome, Fenster 393 × 852 = iPhone 16): in der Konsole
`Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 462 })`,
`document.documentElement.style.setProperty('--st', '59px')`, `dispatchEvent(new Event('resize'))`. 462 = Safari mit
Tastatur, 503 = Home-Bildschirm-App mit Tastatur, 852 = Tastatur zu. Echt testen: iOS-Simulator (siehe
`wissen/plattform.md`).

Lernstand aus einem Sicherungs-Code: `node werkzeuge/lernstand.mjs datei.txt` (Format 2 folgt, SOLL).

## Icons neu erzeugen

```bash
cd apps/deutsch-legends/icons
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --hide-scrollbars --window-size=1024,1024 --virtual-time-budget=3000 --screenshot=$PWD/i.png "file://$PWD/icon-source.html"
"$CH" --headless=new --hide-scrollbars --window-size=1024,1024 --virtual-time-budget=3000 --screenshot=$PWD/m.png "file://$PWD/icon-source.html?s=0.6"
magick i.png -resize 180x180 apple-touch-icon.png && magick i.png -resize 192x192 icon-192.png
magick i.png -resize 512x512 icon-512.png && magick m.png -resize 512x512 icon-maskable-512.png && rm i.png m.png
```
