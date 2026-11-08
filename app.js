/* Spell Legends – Deutsch-Trainer für die Schularbeit
   Vanilla JS, keine Abhängigkeiten. Fortschritt liegt in localStorage ('deutschlegends.v1').
   Lernmodell: auftraege/2026-11-07_deutsch-app/lernmodell.md und bauauftrag.md (Abschnitt 4), Ziellinie bei 95 %
   (erlebnis.md 11a). Gerüst nach Word Legends wl-v6: Update-Mechanismus, Speicher, Plan-Karte, Eltern-Verbindung.
   Abschnitte: Konstanten · Stoff vorbereiten · Antworten prüfen · Datum · Speicher · Karteikasten-Logik · Verb-Check ·
   Tagesplan · Ziel-Karte · Ton · UI-Helfer · Screens · Abfrage-Runde · Schreiben auf Papier · Sicherung ·
   Lagebericht und Eltern-Verbindung · Aktionen · Konsole (DL) · Start */
(() => {
'use strict';

// ================================================================
// Konstanten: Name, Kürzel, Version
// APP_ID, STORE_KEY und CODE_PREFIX bleiben „dl“, auch wenn die App „Spell Legends“ heißt (Lernauftrag, Abschnitt 5):
// Sie benennen das Fach. Daran hängen Fortschritt, Sicherung und Lagebericht – nie mehr ändern.
// ================================================================
const APP_NAME = 'Spell Legends';
const APP_ID = 'dl';                    // Legends HQ: Lagebericht und Sicherung (/^[a-z]{2,8}$/)
const STORE_KEY = 'deutschlegends.v1';  // Speicher des Fortschritts – nie ändern
const CODE_PREFIX = 'DL1:';             // Sicherungs-Code (werkzeuge/lernstand.mjs kennt ihn)
const VERSION = 'dl-v5';                // wie VERSION in sw.js – immer beide zusammen hochzählen
const DAY_KEY = 'dl.dayOffset';         // sessionStorage: Zeitsprung zum Testen (DL.shiftDays)

// ================================================================
// Lernmodell (lernforschung, lernmodell.md 3b und 4; bauauftrag.md 4). Alle Regeln hängen an diesen Zahlen.
// ================================================================
const MODELL = {
  stufen: ['leer', '⅓', '⅔', 'voll', 'voll', 'voll', 'glüht'],   // Index = Stufe; 3 = voll („sitzt“)
  pausen: [0, 1, 2, 3, 5, 10, 21],   // Tage Pause nach Erreichen der Stufe
  maxPause: 45,         // Stufe 6 und wieder gewusst
  sicherAb: 3,          // ab hier voll (100 % auf dem Balken), darunter Drittel
  fehlerMinus: 1,       // Fehler: eine Stufe zurück (mindestens ⅓), morgen wieder
  endspurt: 3,          // ab Test − 3 (Sa 14.): Stufe 1 und 2 schon nach 1 Tag, Gelerntes kommt noch einmal dran
  gewusstAb: 4,         // Endspurt: was ab Test − 4 (Fr 13.) gewusst wurde, kommt nicht extra
  sternRuht: 7,         // Stern-Tränke (im Blitz-Check gewusst) ruhen bis Test + 7 (24.11.) …
  sternTage: 5,         // … und werden verteilt auf 5 Tage fällig (24.–28.11.)
  checkRegelPause: 2,   // Blitz-Check, Regel-Karte gewusst: ⅔, wieder in 2 Tagen (im Endspurt 1)
  deckel: 20,           // Minuten am Tag – stoppt nur das Extra-Regal, A wird immer fertig
  deckelKurz: 12,       // an Tagen mit einem ganzen Text (Do 12., Sa 14.)
  wdhLimit: 50,         // höchstens so viele Wiederholungen am Tag; gekürzt wird nur Extra
  testtagLimit: 10,     // Testtag: freiwillig aufwärmen, nur Gerutschtes, nichts Neues
  extraPaket: 8,        // „+1 Paket“ = die nächsten 8 Extra-Karten …
  extraProTag: 1,       // … höchstens einmal am Tag, nur nach fertiger Runde …
  extraSperre: 3,       // … und nicht in den letzten 3 Tagen vor dem Test (dann auch kein automatisches Extra)
  verblasst: 7,         // über 7 Tage überfällig → zählt auf der Ziel-Karte eine Stufe tiefer („verdunstet“)
  nochmalAbstand: 5,    // Fehler in der Runde: nach mindestens 5 anderen Karten noch einmal …
  nochmalMax: 3,        // … bis einmal richtig, höchstens 3 Mal
  halbzeit: 600,        // nach etwa 10 Minuten in der Runde: „Halbzeit!“
  themaFolge: 3,        // höchstens 3 Karten desselben Themas hintereinander
  // Sekunden je Aufgabe, bis gemessen wird (Deckel und „ca. N Min.“)
  sek: { verb: 10, tippen: 10, antippen: 5, steigerung: 15, liste: 25, merkkarte: 30, fehler: 15 },
  // nur für die Schätzung: erwarteter Anteil Fehler (lernmodell 2: 85 % richtig, Vorwissen 62 %)
  fehlerQuote: { wdh: 0.15, neu: 0.4 },
  // Regeln für die Ampel (legends-status.js simuliere), lernmodell 6.2 und bauauftrag 7
  ampel: {
    pausen: [0, 1, 2, 3, 5, 10, 21], maxStufe: 6, maxPause: 45, sicherAb: 3, fehlerMinus: 1, neuProTag: 0,
    vorlauf: 3, wdhLimit: 50, paket: 1, sekNeu: 33, sekWdh: 9, sekFehler: 24,
    vorwissen: 0.62, gekonntStufe: 3, sekVortest: 10, minGelb: 25, minRot: 30
  }
};
const MAX_STUFE = MODELL.pausen.length - 1;
const ZIELLINIE = 95;   // Prozent je Balken; alle drei drüber = BEREIT
const MAX_FELDER = 6;   // Eingabefelder je Aufgabe (vb-pers: Personalform-Tabelle mit 6, vb-zeit: 5 Lücken)
// Titel nach der großen Zahl; „Spell Legend“ gibt es bei BEREIT. Erreichte Titel bleiben (S.ui.titel).
const TITEL = ['Zauberlehrling', 'Trankbrauer', 'Formel-Profi', 'Wortmagier', 'Spell Legend'];
const TITEL_AB = [0, 25, 50, 75];
// Blitz-Check: Klassen (bauauftrag 1 und 4). Wer zwei Antworten zur Wahl hat, kann raten → nur ⅓.
const AUSWAHL_STANDARD = ['vg', 'no-ka', 'vb-ss'];

// Rückmeldung je Fehlerart – gilt, solange stoff.js (tipps) oder die Karte selbst nichts anderes sagt
const TIPPS_STANDARD = {
  gross: 'Groß oder klein? Hauptwörter groß, Zeitwörter und Wiewörter klein. Am Satzanfang groß.',
  umlaut: 'Die Pünktchen zählen: a – ä, o – ö, u – ü.',
  ss: 'Kurz gesprochen → ss (biss). Lang gesprochen oder nach ei, ie → ß (aß, hieß).',
  einfachS: 'Hier schreibt man ein einfaches s.',
  hilfsverb: 'Bewegst du dich von einem Ort zum anderen oder verändert sich etwas, nimmst du ist. Fast alle anderen Zeitwörter: hat.',
  ohneHilfsverb: 'Zur Vergangenheit gehört hat oder ist.',
  person: 'Hier ist die er-Form gefragt: er ist gegangen.',
  feld: 'Vertauscht! Schau, welche Form in welches Feld gehört.',
  andere: 'Diese Form gibt es auch, aber mit einer anderen Bedeutung.',
  liste: 'Zähl alle auf, jedes genau einmal. Die Reihenfolge ist egal.',
  'alswie-als': 'Nach der Mehrstufe kommt als: größer als.',
  'alswie-wie': 'Nach so und der Grundstufe kommt wie: so groß wie.',
  am: 'Zur Meiststufe gehört am: am größten.',
  schwach: 'Achtung, starkes Verb! Der Selbstlaut ändert sich.',
  verbGross: 'Zeitwörter schreibt man klein.',
  wort: ''
};
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Gemeinsame Bausteine von Legends HQ (legends-status.js, legends-sync.js). Fehlen sie, z. B. nach einem halben
// Update ohne Netz, läuft die App trotzdem – nur ohne Plan-Karte und Eltern-Verbindung.
const STATUS = window.LegendsStatus || null;
const SYNC = window.LegendsSync || null;
if (SYNC) SYNC.configure({ app: APP_ID });

const $ = s => document.querySelector(s);
const app = $('#app');

// ================================================================
// Stoff vorbereiten (stoff.js Format 2, Datenvertrag: bauauftrag.md Abschnitt 3)
// Fehlerhafte Einträge fallen weg und stehen in der Konsole (DL.stoff()) – die App startet trotzdem.
// Kleine Abweichungen vom Vertrag werden hier abgefangen, damit die Lernlogik nichts davon merkt.
// ================================================================
const STOFF = window.STOFF || {};
const STOFF_FEHLER = [];
const BEREICHE = (Array.isArray(STOFF.bereiche) ? STOFF.bereiche : []).filter(b => b && b.id);
const BEREICH = Object.create(null);
BEREICHE.forEach((b, i) => { b.index = i; b.titel = b.titel || b.id; b.kurz = b.kurz || b.titel; BEREICH[b.id] = b; });
const ROLLEN = ['ziel', 'extra', 'nachschlagen'];
const PAKETE = (Array.isArray(STOFF.pakete) ? STOFF.pakete : []).filter(p => {
  if (p && p.id && BEREICH[p.bereich]) return true;
  STOFF_FEHLER.push(`Paket ${p && p.id}: Bereich „${p && p.bereich}“ fehlt`);
  return false;
});
const PAKET = Object.create(null);
PAKETE.forEach((p, i) => {
  p.index = i;
  p.titel = p.titel || p.id;
  if (!ROLLEN.includes(p.rolle)) p.rolle = 'ziel';   // ohne Angabe: zählt fürs Ziel
  if (p.ab != null && !isDay(p.ab)) { STOFF_FEHLER.push(`Paket ${p.id}: ab „${p.ab}“ ist kein Tag`); p.ab = ''; }
  p.thema = p.thema || p.id;
  p.karten = [];
  PAKET[p.id] = p;
});
const FAMILIEN = STOFF.familien && typeof STOFF.familien === 'object' ? STOFF.familien : {};
// Merksatz gleich dem Titel („e – a – e“) nicht doppelt zeigen
for (const f in FAMILIEN) { const x = FAMILIEN[f]; if (x && x.merk && x.merk === x.titel) x.merk = ''; }
const FALLEN = STOFF.fallen && typeof STOFF.fallen === 'object' ? STOFF.fallen : {};
const TIPPS = { ...TIPPS_STANDARD, ...(STOFF.tipps || {}) };

// Verben: ein Paket im Bereich „verben“ (stoff.js), sonst ein eigenes. Je Verb zwei Karten (Mitvergangenheit, Vergangenheit).
const VERBEN = (Array.isArray(STOFF.verben) ? STOFF.verben : []).filter(v => {
  const ok = v && typeof v.id === 'string' && v.inf && Array.isArray(v.prae) && v.prae.length && Array.isArray(v.perf) && v.perf.length;
  if (!ok) STOFF_FEHLER.push(`Verb ${v && v.id}: inf, prae oder perf fehlt`);
  return ok;
});
let VPAKET = PAKETE.find(p => p.bereich === 'verben') || null;
if (!VPAKET && VERBEN.length) {
  const b = BEREICH.verben || BEREICHE[0];
  if (b) {
    VPAKET = { id: 'v', bereich: b.id, titel: 'Unregelmäßige Verben', rolle: 'ziel', thema: 'v', karten: [], index: PAKETE.length, virtuell: true };
    PAKETE.push(VPAKET);
    PAKET.v = VPAKET;
  }
}
const VERB = Object.create(null);   // Verb-id → Eintrag aus stoff.js

const KARTEN = [];
const BY_ID = Object.create(null);
function addKarte(c) {
  if (!c || typeof c.id !== 'string' || !c.id) throw new Error('id fehlt');
  if (BY_ID[c.id]) throw new Error('id doppelt');
  c.n = KARTEN.length;
  KARTEN.push(c);
  BY_ID[c.id] = c;
  c.p.karten.push(c);
}
if (VPAKET) for (const v of VERBEN) {
  try {
    VERB[v.id] = v;
    v.muster = v.muster || 'einzeln';
    for (const form of ['prae', 'perf']) addKarte(verbKarte(v, form));
  } catch (e) { STOFF_FEHLER.push(`Verb ${v.id}: ${e.message}`); }
}
for (const raw of Array.isArray(STOFF.karten) ? STOFF.karten : []) {
  try {
    const c = Object.assign({}, raw);
    if (!c.id) throw new Error('id fehlt');
    c.p = PAKET[c.paket];
    if (!c.p) throw new Error(`Paket „${c.paket}“ fehlt`);
    prepKarte(c);
    addKarte(c);
  } catch (e) { STOFF_FEHLER.push(`Karte ${raw && raw.id}: ${e.message}`); }
}
// Reihenfolge im Extra-Regal: nach rang (lernmodell 2), sonst wie in stoff.js. C (nachschlagen) steht nicht darin.
const EXTRA_FOLGE = PAKETE.filter(p => p.rolle === 'extra' && p.karten.length)
  .sort((a, b) => ((a.rang == null ? 999 : a.rang) - (b.rang == null ? 999 : b.rang)) || (a.index - b.index));
// Schreiben (bauauftrag 6)
const SCHREIBEN = STOFF.schreiben && typeof STOFF.schreiben === 'object' ? STOFF.schreiben : {};
const TRAENKE = (Array.isArray(SCHREIBEN.traenke) ? SCHREIBEN.traenke : []).filter(t => t && t.id);
const TRANK = Object.create(null);
TRAENKE.forEach(t => { t.titel = t.titel || t.id; TRANK[t.id] = t; });
const AUFTRAEGE = (Array.isArray(SCHREIBEN.auftraege) ? SCHREIBEN.auftraege : []).filter(a => {
  const ok = a && a.id && isDay(a.ab) && Array.isArray(a.traenke) && a.traenke.length && a.traenke.every(t => TRANK[t]);
  if (!ok) STOFF_FEHLER.push(`Schreibauftrag ${a && a.id}: ab oder traenke fehlen`);
  return ok;
}).sort((a, b) => cmp(a.ab, b.ab));
const AUFTRAG = Object.create(null);
AUFTRAEGE.forEach((a, i) => { a.index = i; a.titel = a.titel || a.id; AUFTRAG[a.id] = a; });
// Tage mit einem ganzen Text: kürzerer Deckel fürs Extra (Do 12., Sa 14.)
const KURZTAGE = new Set(AUFTRAEGE.filter(a => a.ganz).map(a => a.ab));
const VC = STOFF.verbCheck && typeof STOFF.verbCheck === 'object' ? STOFF.verbCheck : {};
const VC_TAGE = (Array.isArray(VC.tage) ? VC.tage : []).filter(isDay).sort();
const VC_PRO_FAMILIE = Number(VC.proFamilie) > 0 ? Number(VC.proFamilie) : 4;
const VC_NICHT = Object.create(null);   // Verb-id → Set der Verben, die nie am selben Tag neu kommen
for (const g of Array.isArray(VC.nichtZusammen) ? VC.nichtZusammen : []) {
  if (!Array.isArray(g)) continue;
  for (const a of g) for (const b of g) if (a !== b) (VC_NICHT[a] = VC_NICHT[a] || new Set()).add(b);
}
// Erster Tag des Plans (früher Start: wer davor öffnet, bekommt schon den Inhalt dieses Tages)
const PLAN_START = [...VC_TAGE, ...PAKETE.filter(p => p.rolle === 'ziel' && p.ab).map(p => p.ab), ...AUFTRAEGE.map(a => a.ab)].sort()[0] || '';
if (STOFF_FEHLER.length) console.warn('stoff.js – diese Einträge fehlen in der App:', STOFF_FEHLER);

// ---------- Karten vorbereiten ----------
function verbKarte(v, form) {
  const c = { id: `${v.id}-${form}`, paket: VPAKET.id, p: VPAKET, verb: v, form, typ: 'verb' };
  if (form === 'prae') {
    c.views = [{ typ: 'verb', form, verbId: v.id, eingabe: 'tippen', wort: v.inf, felder: [
      { label: 'Mitvergangenheit', antworten: v.prae.map(String), wahl: null, verbForm: 'prae' }] }];
    c.label = `${v.inf}: ${v.prae.join(' / ')}`;
  } else {
    c.views = [{ typ: 'verb', form, verbId: v.id, eingabe: 'tippen', wort: v.inf, felder: [
      { label: 'hat oder ist', antworten: [...new Set(v.perf.map(f => hvTeil(f)))], wahl: ['hat', 'ist'], verbForm: 'hv' },
      { label: '2. Mittelwort', antworten: [...new Set(v.perf.map(f => ppTeil(f)))], wahl: null, verbForm: 'pp' }] }];
    c.label = `${v.inf}: ${v.perf.join(' / ')}`;
  }
  c.kurz = v.inf;
  finishKarte(c);
  c.thema = 'v:' + v.muster;   // gemischt: höchstens 3 derselben Familie hintereinander
  return c;
}
function hvTeil(f) { return String(f).trim().split(/\s+/)[0]; }
function ppTeil(f) { return String(f).trim().split(/\s+/).slice(1).join(' '); }

function prepKarte(c) {
  if (c.pool != null && !c.typ) c.typ = 'regel';
  if (c.typ === 'regel' || c.pool != null) {
    c.typ = 'regel';
    const pool = STOFF.pools && STOFF.pools[c.pool];
    if (!Array.isArray(pool) || !pool.length) throw new Error(`Pool „${c.pool}“ fehlt oder ist leer`);
    c.pool = [];
    for (const x of pool) {
      try { const v = prepView(x); v.id = x.id || ''; c.pool.push(v); }
      catch (e) { STOFF_FEHLER.push(`Pool ${c.paket}/${x && x.id}: ${e.message}`); }
    }
    if (!c.pool.length) throw new Error('kein gültiges Beispiel im Pool');
    c.views = null;
  } else {
    c.views = [prepView(c)];
    for (const x of Array.isArray(c.varianten) ? c.varianten : []) {
      try { c.views.push(prepView(Object.assign({ tipp: c.tipp, hilfe: c.hilfe, tipps: c.tipps }, x))); }
      catch (e) { STOFF_FEHLER.push(`Variante von ${c.id}: ${e.message}`); }
    }
  }
  finishKarte(c);
}
function finishKarte(c) {
  c.bereich = c.p.bereich;
  c.rolle = c.p.rolle;
  c.rank = hash(c.id);
  c.thema = c.thema || c.p.thema;
  // Klasse im Blitz-Check: Paket-Angabe, sonst Regel-Karte → regel, sonst einzel (vg, no-ka, vb-ss: auswahl)
  c.klasse = ['einzel', 'regel', 'auswahl'].includes(c.p.check) ? c.p.check
    : AUSWAHL_STANDARD.includes(c.p.id) ? 'auswahl' : c.typ === 'regel' ? 'regel' : 'einzel';
  const v0 = c.views ? c.views[0] : c.pool[0];
  if (!c.kurz) c.kurz = ohneStern(c.typ === 'regel' ? `${c.p.titel} ${regelNummer(c)}` : kurzText(v0));
  if (!c.label) c.label = c.typ === 'regel' ? `${c.p.titel} (Regel ${regelNummer(c)})` : autoLabel(v0);
  c.label = ohneStern(String(c.label)).slice(0, 60);
  c.bereichKurz = BEREICH[c.bereich].kurz;
}
function regelNummer(c) { const m = String(c.id).match(/-r(\d+)$/); return m ? m[1] : ''; }

// Eine Darstellung (Karte, Variante oder Pool-Beispiel) prüfbar machen
function prepView(x) {
  const v = { typ: x.typ, frage: x.frage || '', tipp: x.tipp || '', hilfe: x.hilfe || '', tipps: x.tipps || null, quelle: x.quelle || '' };
  const liste = (y, was) => { if (!Array.isArray(y) || !y.length) throw new Error(was + ' fehlt'); return y; };
  const texte = y => [].concat(y == null ? [] : y).filter(a => a != null && a !== '').map(String);
  if (x.typ === 'tippen') {
    v.eingabe = 'tippen';
    if (x.wort == null) throw new Error('wort fehlt');
    v.wort = String(x.wort);
    v.hinweis = x.hinweis || '';
    v.diktat = !!x.diktat;
    if (liste(x.felder, 'felder').length > MAX_FELDER) throw new Error(`höchstens ${MAX_FELDER} Felder`);
    v.felder = x.felder.map(f => {
      const antworten = texte(f && f.antwort);
      if (!antworten.length) throw new Error('antwort fehlt');
      const wahl = Array.isArray(f.wahl) && f.wahl.length ? f.wahl.map(String) : null;
      if (wahl && !antworten.every(a => wahl.includes(a))) throw new Error(`„${antworten[0]}“ steht nicht in wahl`);
      return {
        label: f.label || '', antworten, wahl, liste: !!f.liste,
        alt: texte(f.alt), altHinweis: f.altHinweis || '', andere: texte(f.andere), andereHinweis: f.andereHinweis || ''
      };
    });
  } else if (x.typ === 'luecke') {
    if (typeof x.satz !== 'string') throw new Error('satz fehlt');
    const luecken = [];
    v.teile = x.satz.split(/(\[[^\]]*\])/).filter(s => s !== '').map(s => {
      const m = s.match(/^\[([^\]]*)\]$/);
      if (!m) return s;
      const g = { antworten: m[1].split('|').map(a => a.trim()).filter(Boolean) };
      if (!g.antworten.length) throw new Error('leere Lücke');
      luecken.push(g);
      return g;
    });
    if (!luecken.length) throw new Error('keine Lücke [ ] im Satz');
    if (luecken.length > MAX_FELDER) throw new Error(`höchstens ${MAX_FELDER} Lücken`);
    const h = Array.isArray(x.hinweise) ? x.hinweise : [];
    v.hinweis = x.hinweis || '';
    v.eingabe = 'tippen';
    v.felder = luecken.map((g, i) => ({
      label: h[i] || (luecken.length > 1 ? `Lücke ${i + 1}` : ''), antworten: g.antworten, wahl: null, liste: false,
      alt: [], altHinweis: '', andere: [], andereHinweis: ''
    }));
    // Knöpfe zum Antippen nur bei genau einer Lücke (als/wie); ob angetippt oder getippt wird, entscheidet die Runde
    if (Array.isArray(x.optionen) && x.optionen.length) {
      if (luecken.length !== 1) STOFF_FEHLER.push(`Lücke „${x.satz.slice(0, 30)}…“: optionen gehen nur bei genau einer Lücke – wird getippt`);
      else if (!luecken[0].antworten.every(a => x.optionen.includes(a))) throw new Error('Antwort steht nicht in optionen');
      else v.optionen = x.optionen.map(String);
    }
  } else if (x.typ === 'wahl') {
    v.optionen = liste(x.optionen, 'optionen').map(String);
    v.antworten = texte(x.antwort);
    if (!v.antworten.length) throw new Error('antwort fehlt');
    if (!v.antworten.every(a => v.optionen.includes(a))) throw new Error('antwort steht nicht in optionen');
    v.mehrere = !!x.mehrere;
    v.fest = !!x.fest;
    v.text = x.text || '';
    v.eingabe = v.mehrere ? 'mehrfach' : 'wahl';
    if (x.dann) {
      const d = x.dann;
      const dOpt = liste(d.optionen, 'dann.optionen').map(String);
      const dAnt = texte(d.antwort);
      if (!dAnt.length || !dAnt.every(a => dOpt.includes(a))) throw new Error('dann.antwort steht nicht in dann.optionen');
      if (v.mehrere) throw new Error('dann geht nicht mit mehrere');
      v.dann = { frage: d.frage || '', optionen: dOpt, antworten: dAnt, fest: !!d.fest };
    }
  } else if (x.typ === 'zuordnen') {
    v.eingabe = 'zuordnen';
    v.optionen = liste(x.optionen, 'optionen').map(String);
    v.titel = x.titel || '';
    v.items = liste(x.paare, 'paare').map(p => {
      if (!Array.isArray(p) || p.length < 2) throw new Error('paare: [Wort, Gruppe]');
      if (!v.optionen.includes(String(p[1]))) throw new Error(`„${p[1]}“ steht nicht in optionen`);
      return { wort: String(p[0]), antwort: String(p[1]) };
    });
  } else if (x.typ === 'ordnen') {
    v.eingabe = 'ordnen';
    v.teile = liste(x.teile, 'teile').map(String);
    if (v.teile.length < 2) throw new Error('mindestens 2 teile');
    if (new Set(v.teile).size !== v.teile.length) throw new Error('teile doppelt');
  } else if (x.typ === 'markieren') {
    v.eingabe = 'markieren';
    if (typeof x.satz !== 'string' || !x.satz.trim()) throw new Error('satz fehlt');
    if (!x.gruppen || typeof x.gruppen !== 'object') throw new Error('gruppen fehlen');
    v.satz = x.satz;
    v.gruppenNamen = Object.keys(x.gruppen);
    v.tokens = x.satz.split(/\s+/).filter(Boolean).map(w => ({ text: w, wort: w.replace(/^[„"'(]+|[.,!?;:“"')]+$/g, '') }));
    // Wort → Gruppe; ein Eintrag mit Leerzeichen („am lautesten“) verlangt jedes seiner Wörter
    v.soll = v.tokens.map(() => '');
    for (const g of v.gruppenNamen) {
      for (const eintrag of texte(x.gruppen[g])) {
        for (const w of eintrag.split(/\s+/)) {
          let hit = false;
          v.tokens.forEach((t, i) => { if (t.wort === w) { v.soll[i] = g; hit = true; } });
          if (!hit) throw new Error(`„${w}“ steht nicht im Satz`);
        }
      }
    }
  } else {
    throw new Error(`unbekannter typ „${x.typ}“`);
  }
  return v;
}
function ohneStern(s) { return String(s).replace(/\*/g, ''); }
// Kurzer Text für Regal, Rundenende und Kartendetail
function kurzText(v) {
  if (v.typ === 'tippen' || v.typ === 'verb') return v.wort;
  if (v.typ === 'luecke') return v.teile.map(x => (typeof x === 'string' ? x : '…')).join('');
  if (v.typ === 'wahl') return v.text || v.frage || v.antworten[0];
  if (v.typ === 'zuordnen') return v.titel || v.items.map(it => it.wort).join(', ');
  if (v.typ === 'ordnen') return v.frage || v.teile.join(' → ');
  if (v.typ === 'markieren') return v.satz;
  return '';
}
// Bezeichnung für Lagebericht („wackelig“) und Lernstand – nur Stoff, nie etwas über das Kind
function autoLabel(v) {
  if (v.typ === 'tippen') return `${v.wort}: ${v.felder.map(f => f.antworten[0]).join(' · ')}`;
  if (v.typ === 'luecke') return v.teile.map(x => (typeof x === 'string' ? x : x.antworten[0])).join('');
  if (v.typ === 'wahl') return `${v.text || v.frage || ''} → ${v.antworten.join(', ')}`;
  if (v.typ === 'zuordnen') return v.items.map(it => `${it.wort} → ${it.antwort}`).join(', ');
  if (v.typ === 'ordnen') return v.teile.join(' → ');
  if (v.typ === 'markieren') return v.satz;
  return '';
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function isDay(x) { return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x); }

// ================================================================
// Antworten prüfen (stoff.md Abschnitt 7)
// In Deutsch zählt jeder Buchstabe: Groß/klein, ä/ö/ü und ß müssen genau stimmen. Es gibt darum kein „Fast!“ –
// der eine Buchstabe ist das Lernziel. Vereinheitlicht wird nur, was nichts mit Rechtschreibung zu tun hat:
// Unicode-Form, Leerzeichen, typografische Zeichen und Satzzeichen am Ende.
// Ergebnis je Feld: { ok, leer, eingabe, richtig, art, note }. art: '' · 'alt' (auch richtig, mit Hinweis) ·
// 'andere' (andere Bedeutung, nicht gelöst) · eine Fehlerart (gross, umlaut, ss, hilfsverb …) · 'wort'.
// ================================================================
function normDE(s) {
  return String(s == null ? '' : s).normalize('NFC')
    .replace(/[‘’‚ʼ`´]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^"+/, '')
    .replace(/[.,!;:"]+$/, '')
    .trim();
}
// Fragezeichen am Ende zählt nicht (stoff.md 7.3: Frage beim Fall mit oder ohne Fragezeichen)
function normFrage(s) { return normDE(s).replace(/\?+$/, '').trim(); }
function gleich(a, b) { return normFrage(a) === normFrage(b); }

// Abstand mit Vertauschung (Damerau) – nur um bei mehreren erlaubten Antworten die nächstliegende zu zeigen
function dist(a, b) {
  const m = a.length, n = b.length;
  const d = [];
  for (let i = 0; i <= m; i++) { d.push(new Array(n + 1).fill(0)); d[i][0] = i; }
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}
function naechste(n, antworten) {
  let best = Infinity, richtig = antworten[0];
  for (const a of antworten) { const d = dist(n, normFrage(a)); if (d < best) { best = d; richtig = a; } }
  return richtig;
}
const ohnePunkte = s => s.normalize('NFD').replace(/̈/g, '').normalize('NFC');
const ohneUmlautSchreibung = s => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue');
const sLaut = s => s.replace(/ß/g, 's').replace(/ss/g, 's');
// s-Laute der Reihe nach: 's' einfach · 'S' ss · 'ß'
function sFolge(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === 'ß') out.push('ß');
    else if (s[i] === 's') { if (s[i + 1] === 's') { out.push('S'); i++; } else out.push('s'); }
  }
  return out;
}
// Nur der s-Laut ist anders: Steht in der richtigen Form an der ersten abweichenden Stelle ein einfaches s
// (las, genas, gelesen, Häuser), passt die ss/ß-Regel nicht – dann eigener Hinweis 'einfachS'.
function sLautArt(n, a) {
  const x = sFolge(n), y = sFolge(a);
  const k = y.findIndex((t, i) => t !== x[i]);
  return k >= 0 && y[k] === 's' ? 'einfachS' : '';
}
const HV_ER = ['hat', 'ist'];
const HV_ANDERE = ['habe', 'hast', 'haben', 'habt', 'bin', 'bist', 'sind', 'seid', 'hatte', 'war'];
const HILFSVERB = new Set([...HV_ER, ...HV_ANDERE]);

// Welche Art Fehler? Nur wenn es genau diese eine Abweichung ist – sonst 'wort' (keine Extra-Rückmeldung).
function fehlerArt(n, a, andereFelder) {
  if (andereFelder && andereFelder.some(x => gleich(x, n))) return 'feld';
  if (n.toLowerCase() === a.toLowerCase()) return 'gross';
  const nl = n.toLowerCase(), al = a.toLowerCase();
  if (ohnePunkte(nl) === ohnePunkte(al) || ohneUmlautSchreibung(nl) === ohneUmlautSchreibung(al)) return 'umlaut';
  if (sLaut(nl) === sLaut(al)) return sLautArt(nl, al) || 'ss';
  if ((nl === 'als' && al === 'wie') || (nl === 'wie' && al === 'als')) return 'alswie-' + al;
  if (/^am /.test(a) && n === a.slice(3)) return 'am';   // Meiststufe ohne „am“ (stoff.md 7.3)
  const wn = n.split(' '), wa = a.split(' ');
  if (wa.length >= 2 && HILFSVERB.has(wa[0].toLowerCase())) {
    if (wn.join(' ') === wa.slice(1).join(' ')) return 'ohneHilfsverb';
    if (wn.length === wa.length && wn.slice(1).join(' ') === wa.slice(1).join(' ') && wn[0] !== wa[0]) {
      return HV_ANDERE.includes(wn[0].toLowerCase()) ? 'person' : 'hilfsverb';
    }
  }
  return 'wort';
}

// Ein Textfeld (tippen, Lücke). andereFelder: Antworten der übrigen Felder (erkennt Vertauschen).
function pruefeFeld(eingabe, f, andereFelder) {
  const n = normDE(eingabe);
  if (!n) return { ok: false, leer: true, eingabe: '', richtig: f.antworten[0], art: '' };
  if (f.liste) return pruefeListe(n, f);
  const hit = f.antworten.find(a => gleich(a, n));
  if (hit != null) return { ok: true, eingabe: n, richtig: hit, art: '' };
  const alt = (f.alt || []).find(a => gleich(a, n));
  if (alt != null) return { ok: true, eingabe: n, richtig: alt, art: 'alt', note: f.altHinweis || `Stimmt auch. Auf deinem Blatt steht: ${f.antworten[0]}.` };
  const and = (f.andere || []).find(a => gleich(a, n));
  if (and != null) return { ok: false, eingabe: n, richtig: f.antworten[0], art: 'andere', note: f.andereHinweis || '' };
  const richtig = naechste(normFrage(n), f.antworten);
  return { ok: false, eingabe: n, richtig, art: fehlerArt(normFrage(n), normFrage(richtig), andereFelder) };
}
// Aufzählung: Reihenfolge egal, getrennt durch Beistrich, Leerzeichen oder „und“. Jedes genau richtig, keines
// fehlt, keines doppelt, nichts dazu (stoff.md 7.1.5).
function listeTeile(s) { return normDE(s).split(/\s*(?:,|;|\bund\b|\s)\s*/).map(x => x.trim()).filter(Boolean); }
function pruefeListe(n, f) {
  const soll = listeTeile(f.antworten[0]);
  const ist = listeTeile(n);
  const fehlt = soll.filter(x => !ist.includes(x));
  const zuviel = ist.filter(x => !soll.includes(x));
  const doppelt = ist.length !== new Set(ist).size;
  const ok = !fehlt.length && !zuviel.length && !doppelt;
  return { ok, eingabe: n, richtig: soll.join(', '), art: ok ? '' : 'liste', liste: { soll, fehlt, zuviel: zuviel.length, doppelt } };
}

// ---------- Verben (stoff.md 7.2) ----------
// Typische Fehler bei einer Verbform erkennen; die Rückmeldung dazu kommt aus fallen (stoff.js) oder tipps
function verbFehler(n, a, v, feld) {
  if (n.toLowerCase() === a.toLowerCase()) return 'verbGross';
  const nl = n.toLowerCase(), al = a.toLowerCase(), f = v.fallen || [];
  if (ohnePunkte(nl) === ohnePunkte(al) || ohneUmlautSchreibung(nl) === ohneUmlautSchreibung(al)) return 'umlaut';
  if (sLaut(nl) === sLaut(al)) return sLautArt(nl, al) || (f.includes('ss-ß') ? 'ss-ß' : 'ss');
  const stamm = v.inf.replace(/e?n$/, '');
  if (feld === 'prae' && (nl === stamm + 'te' || nl === stamm + 'ete')) return f.includes('misch') ? 'misch' : 'schwach';
  if (feld === 'pp' && /^(ge)?\S+t$/.test(nl) && (nl === 'ge' + stamm + 't' || nl === stamm + 't' || nl === 'ge' + stamm + 'et')) return f.includes('misch') ? 'misch' : 'schwach';
  if (feld === 'pp' && nl === 'ge' + al) return 'ohne-ge';
  if (feld === 'pp' && f.includes('partizip-o') && nl.length === al.length && [...al].every((ch, i) => ch === nl[i] || (ch === 'o' && nl[i] === 'a'))) return 'partizip-o';
  if (nl.replace(/ie/g, 'i') === al && al.includes('i')) return f.includes('i-kurz') ? 'i-kurz' : 'wort';
  if (nl.replace(/ei/g, 'ie') === al || nl.replace(/ie/g, 'ei') === al) return f.includes('ei-ie') ? 'ei-ie' : f.includes('ei-i') ? 'ei-i' : 'wort';
  if (nl.replace(/h/g, '') === al.replace(/h/g, '')) return 'h';
  return 'wort';
}
function verbFormen(v) {
  const auf = (list, quelle) => (list || []).map(f => ({ hv: hvTeil(f), pp: ppTeil(f), quelle }));
  return [...auf(v.perf, 'blatt'), ...auf(v.alt && v.alt.perf, 'alt'), ...auf(v.andere && v.andere.perf, 'andere')];
}
function bedeutung(v) {
  const note = v.andere && v.andere.note ? String(v.andere.note).replace(/^andere Bedeutung:\s*/i, '') : '';
  return (FALLEN.bedeutung || TIPPS.andere).replace(/\.$/, '') + (note ? ` (${note}).` : '.');
}
function pruefeVerbPrae(v, eingabe) {
  let n = normDE(eingabe).replace(/^(ich|er|sie|es)\s+/i, '');   // Fürwort vor der Form zählt nicht
  if (!n) return { ok: false, leer: true, eingabe: '', richtig: v.prae[0], art: '' };
  const teile = n.split(/\s*\/\s*/).filter(Boolean);
  if (teile.length > 1 && teile.every(t => v.prae.includes(t))) return { ok: true, eingabe: n, richtig: v.prae.join('/'), art: '' };
  if (v.prae.includes(n)) return { ok: true, eingabe: n, richtig: n, art: '' };
  if (v.andere && (v.andere.prae || []).includes(n)) return { ok: false, eingabe: n, richtig: v.prae[0], art: 'andere', note: bedeutung(v) + ` Gesucht ist: ${v.prae[0]}.` };
  const formen = verbFormen(v).filter(f => f.quelle !== 'andere');
  if (formen.some(f => f.pp === n || `${f.hv} ${f.pp}` === n)) return { ok: false, eingabe: n, richtig: v.prae[0], art: 'feld' };
  const richtig = naechste(n, v.prae);
  return { ok: false, eingabe: n, richtig, art: verbFehler(n, richtig, v, 'prae') };
}
// Vergangenheit: hat/ist und 2. Mittelwort. Gibt zwei Feld-Ergebnisse zurück (Hilfsverb, Mittelwort).
function pruefeVerbPerf(v, hvEingabe, ppEingabe) {
  let hv = normDE(hvEingabe), pp = normDE(ppEingabe).replace(/^(ich|er|sie|es)\s+/i, '');   // Fürwort zählt nicht
  // alles in einem Feld („ist gegangen“, so prüft DL.check) oder das Hilfsverb noch einmal vor dem Mittelwort:
  // abtrennen. Steht im Feld ein anderes Hilfsverb als auf dem Knopf, bleibt es stehen (dann stimmt es nicht).
  const w0 = pp.split(' ')[0];
  if (pp.includes(' ') && HILFSVERB.has(w0.toLowerCase()) && (!hv || w0 === hv)) { hv = w0; pp = pp.split(' ').slice(1).join(' '); }
  const formen = verbFormen(v);
  const blatt = formen.filter(f => f.quelle === 'blatt');
  const gueltig = formen.filter(f => f.quelle !== 'andere');
  const hvArt = !hv ? 'ohneHilfsverb' : HV_ANDERE.includes(hv.toLowerCase()) ? 'person' : 'hilfsverb';
  const hvFeld = (ok, richtig) => ({ ok, leer: !hv, eingabe: hv, richtig, art: ok ? '' : hvArt });
  if (!pp) {
    const ok = gueltig.some(f => f.hv === hv);
    return [hvFeld(ok, ok ? hv : blatt[0].hv), { ok: false, leer: true, eingabe: '', richtig: blatt[0].pp, art: '' }];
  }
  const exakt = formen.find(f => f.hv === hv && f.pp === pp);
  if (exakt && exakt.quelle === 'blatt') return [hvFeld(true, hv), { ok: true, eingabe: pp, richtig: pp, art: '' }];
  if (exakt && exakt.quelle === 'alt') {
    return [hvFeld(true, hv), { ok: true, eingabe: pp, richtig: pp, art: 'alt', note: `Stimmt auch. Auf deinem Blatt steht: ${v.perf[0]}.` }];
  }
  if (exakt && exakt.quelle === 'andere') {
    const note = bedeutung(v) + ` Gesucht ist: ${v.perf[0]}.`;
    // Das Hilfsverb ist nur falsch, wenn es nicht zur Form vom Blatt passt (hängen: „hat“ stimmt, gehängt nicht)
    const hvOk = gueltig.some(f => f.hv === hv);
    return [{ ok: hvOk, leer: false, eingabe: hv, richtig: hvOk ? hv : blatt[0].hv, art: hvOk ? '' : 'andere' }, { ok: false, eingabe: pp, richtig: blatt[0].pp, art: 'andere', note }];
  }
  // Mittelwort stimmt, Hilfsverb nicht (falsch, fehlt, oder habe/bin statt hat/ist)
  const ppPasst = gueltig.filter(f => f.pp === pp);
  if (ppPasst.length) return [hvFeld(false, ppPasst[0].hv), { ok: true, eingabe: pp, richtig: pp, art: '' }];
  // Mitvergangenheit ins Feld der Vergangenheit geschrieben
  if (v.prae.includes(pp)) {
    const ok = gueltig.some(f => f.hv === hv);
    return [hvFeld(ok, ok ? hv : blatt[0].hv), { ok: false, eingabe: pp, richtig: blatt[0].pp, art: 'feld' }];
  }
  const passend = gueltig.filter(f => f.hv === hv);
  const richtig = naechste(pp, (passend.length ? passend : blatt).map(f => f.pp));
  const hvRichtig = passend.length ? hv : (blatt.find(f => f.pp === richtig) || blatt[0]).hv;
  return [hvFeld(passend.length > 0, hvRichtig), { ok: false, eingabe: pp, richtig, art: verbFehler(pp, richtig, v, 'pp') }];
}

// Eine Darstellung prüfen → { res: 'ok' | 'teil' | 'falsch', felder: [...], fast? }.
// eingabe: Liste – je Feld/Lücke ein Text; wahl: angetippte Option(en); dann: [Schritt 1, Schritt 2];
// zuordnen: Gruppe je Wort; ordnen: Teile in der eingegebenen Reihenfolge; markieren: Gruppe je Wort ('' = keine).
function pruefeView(v, eingabe) {
  const vals = [].concat(eingabe == null ? [] : eingabe);
  let felder, fast = false;
  if (v.typ === 'verb' && v.form === 'prae') felder = [pruefeVerbPrae(VERB_VON(v), vals[0])];
  else if (v.typ === 'verb') felder = pruefeVerbPerf(VERB_VON(v), vals[0], vals[1]);
  else if (v.eingabe === 'tippen') {
    felder = v.felder.map((f, i) => {
      if (f.wahl) {
        const n = normDE(vals[i]);
        return { ok: f.antworten.includes(n), leer: !n, eingabe: n, richtig: f.antworten[0], art: n ? 'wahl' : '' };
      }
      const andere = v.felder.filter((_, k) => k !== i).flatMap(x => x.antworten);
      return pruefeFeld(vals[i], f, andere);
    });
  } else if (v.eingabe === 'wahl') {
    const ok1 = v.antworten.includes(String(vals[0] == null ? '' : vals[0]));
    felder = [{ ok: ok1, leer: vals[0] == null || vals[0] === '', eingabe: String(vals[0] || ''), richtig: ok1 ? String(vals[0]) : v.antworten[0], art: '' }];
    if (v.dann) {
      const ok2 = v.dann.antworten.includes(String(vals[1] == null ? '' : vals[1]));
      felder.push({ ok: ok2, leer: vals[1] == null || vals[1] === '', eingabe: String(vals[1] || ''), richtig: ok2 ? String(vals[1]) : v.dann.antworten[0], art: '' });
    }
  } else if (v.eingabe === 'mehrfach') {
    const ist = new Set(vals.map(String));
    felder = v.optionen.map(o => {
      const soll = v.antworten.includes(o), hat = ist.has(o);
      return { ok: soll === hat, eingabe: hat ? o : '', richtig: soll ? o : '', art: '', option: o, soll, hat };
    });
  } else if (v.eingabe === 'zuordnen') {
    felder = v.items.map((it, i) => ({ ok: normDE(vals[i]) === normDE(it.antwort), eingabe: String(vals[i] || ''), richtig: it.antwort, art: '' }));
  } else if (v.eingabe === 'ordnen') {
    felder = v.teile.map((t, i) => ({ ok: vals[i] === t, eingabe: String(vals[i] || ''), richtig: t, art: '' }));
    // „Fast!“ nur, wenn genau zwei Nachbarn vertauscht sind (zählt trotzdem als Fehler, erlebnis 11d)
    const falsch = felder.map((f, i) => (f.ok ? -1 : i)).filter(i => i >= 0);
    fast = falsch.length === 2 && falsch[1] === falsch[0] + 1 && vals[falsch[0]] === v.teile[falsch[1]] && vals[falsch[1]] === v.teile[falsch[0]];
  } else if (v.eingabe === 'markieren') {
    felder = v.tokens.map((t, i) => ({ ok: (vals[i] || '') === v.soll[i], eingabe: vals[i] || '', richtig: v.soll[i], art: '', wort: t.wort }));
  } else felder = [];
  const n = felder.filter(f => f.ok).length;
  return { res: felder.length && n === felder.length ? 'ok' : n > 0 ? 'teil' : 'falsch', felder, fast };
}
function VERB_VON(v) { return VERB[v.verbId] || VERBEN.find(x => x.inf === v.wort); }

// Markiert in der richtigen Form, was in der Eingabe fehlte oder falsch war (Groß/klein zählt).
// Ein überzähliger Buchstabe markiert die Stelle, an der er stand. Die falsche Eingabe selbst wird nie gezeigt.
function diffMark(input, target) {
  const a = [...normDE(input)], b = [...String(target)], m = a.length, n = b.length;
  if (m === n) return b.map((ch, k) => (a[k] === ch ? esc(ch) : `<mark>${esc(ch)}</mark>`)).join('');
  const L = [];
  for (let i = 0; i <= m; i++) L.push(new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const keep = new Array(n).fill(false), extra = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { keep[j] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { extra[j] = true; i++; }
    else j++;
  }
  if (i < m && n) extra[n - 1] = true;
  return b.map((ch, k) => ((keep[k] && !extra[k]) || ch === ' ') ? esc(ch) : `<mark>${esc(ch)}</mark>`).join('');
}

// ================================================================
// Datum (lokale Tage, keine Uhrzeiten)
// ================================================================
let dayOffset = 0;   // nur zum Testen: sessionStorage 'dl.dayOffset'
try { dayOffset = parseInt(sessionStorage.getItem(DAY_KEY) || '0', 10) || 0; } catch (e) { /* egal */ }

function fmt(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function today() { return fmt(new Date(Date.now() + dayOffset * 864e5)); }
function addDays(ds, n) {
  const [y, m, d] = ds.split('-').map(Number);
  return fmt(new Date(y, m - 1, d + n, 12));
}
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}
function inDays(n) {
  if (n <= 0) return 'heute';
  if (n === 1) return 'morgen';
  return `in ${n} Tagen`;
}
function weekdayOf(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d, 12).getDay(); }
function dateLabel(ds) { const [, m, d] = ds.split('-').map(Number); return `${WEEKDAYS[weekdayOf(ds)]}, ${d}. ${MONTHS[m - 1]}`; }
function dateShort(ds) { const [, m, d] = ds.split('-').map(Number); return `${DAY_SHORT[weekdayOf(ds)]}, ${d}.${m}.`; }
function dayMonth(ds) { const [, m, d] = ds.split('-').map(Number); return `${d}.${m}.`; }
function clock() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// ================================================================
// Speicher
// ================================================================
// k = Karten: id → { lv, due, last, ok, bad, since } (Stufe, fällig am, zuletzt geübt, richtig, falsch, gesammelt seit),
//     dazu nur wenn nötig: s (Stern-Trank seit: im Blitz-Check gewusst) · gw (zuletzt gewusst, für den Endspurt) ·
//     c (Blitz-Check: 1 gewusst, 0 nicht) · v (nächste Variante) · b (letztes Beispiel einer Regel-Karte)
// regel = Paket-id → Tag, an dem die Merkkarte zum ersten Mal kam · papier = Papier-Karten von dl-v1 (nur Altstand)
// schreiben = Schreibaufträge auf Papier: a (je Auftrag) und t (je Schreib-Trank), siehe „Schreiben“ weiter unten
// ui.titel = höchster erreichter Titel (bleibt) · ui.bereit / ui.perfekt = Tag des ersten BEREIT / PERFEKT
// log = Tagesprotokoll für Plan-Karte und Lagebericht { 'JJJJ-MM-TT': { a, r, n, s, f, o, k } }, höchstens 90 Tage.
// plaene = eingefrorener Plan je Termin, legt LegendsStatus.bericht() selbst ab (schnittstelle.md §5).
function fresh() {
  return {
    v: 1,
    settings: { name: '', testDate: '', testSince: '', sfx: true },
    k: {},
    regel: {},
    papier: {},
    stats: { xp: 0, streak: 0, best: 0, lastDay: '', answers: 0, right: 0, sessions: 0 },
    day: { date: '', newCount: 0, extra: 0 },
    ui: { hideInstall: false, onboarded: false, ziellinie: false, titel: 0, bereit: '', perfekt: '' },
    schreiben: { a: {}, t: {} },
    log: {},
    plaene: {}
  };
}
// Jedes Feld einzeln aufzählen – was hier fehlt, ist beim nächsten Start weg
function upgrade(s) {
  const d = fresh();
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const sw = obj(s.schreiben);
  const out = {
    v: 1,
    settings: { ...d.settings, ...obj(s.settings) },
    k: obj(s.k),
    regel: obj(s.regel),
    papier: obj(s.papier),
    stats: { ...d.stats, ...obj(s.stats) },
    day: { ...d.day, ...obj(s.day) },
    ui: { ...d.ui, ...obj(s.ui) },
    schreiben: { a: obj(sw.a), t: obj(sw.t) },
    log: obj(s.log),
    plaene: obj(s.plaene)
  };
  // Ein vergangener oder offizieller Termin ist kein eigener Termin mehr
  const t = out.settings.testDate;
  if (t && (!isDay(t) || t < today() || (TEST && t === TEST.datum))) { out.settings.testDate = ''; out.settings.testSince = ''; }
  return out;
}
function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    if (raw) return upgrade(JSON.parse(raw));
  } catch (e) {
    // Frisch starten – aber den unlesbaren Stand vorher beiseitelegen, sonst überschreibt ihn das nächste save()
    try { if (raw) localStorage.setItem(STORE_KEY + '.kaputt', raw); } catch (e2) { /* egal */ }
  }
  return fresh();
}
const TEST = STOFF.test && isDay(STOFF.test.datum) ? STOFF.test : null;   // offizieller Termin (vor load: upgrade braucht ihn)
let S = load();
if (STATUS) STATUS.kuerzen(S.log, today());   // Protokoll: höchstens 90 Tage
let saveWarned = false;
let saveCount = 0;   // zählt jede Änderung – Plan-Karte und Lagebericht rechnen nur neu, wenn sich etwas getan hat
function save() {
  saveCount++;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) {
    if (!saveWarned) { saveWarned = true; toast('Speichern klappt gerade nicht. Ist privates Surfen an?'); }
  }
}

// ---------- Tagesprotokoll (S.log) ----------
// Jede Aufgabe zählt ihre Sekunden genau einmal: vom Anzeigen bis zur Antwort (legends-status.js nimmt höchstens
// 60 je Aufgabe – wer das Handy weglegt, übt nicht). Danach läuft die Uhr neu, z. B. fürs Ausbessern.
let taskStart = 0;
function taskSec() {
  const now = Date.now();
  const s = taskStart ? (now - taskStart) / 1000 : 0;
  taskStart = now;
  return s;
}
function logAnswer(right) { const s = taskSec(); if (STATUS) STATUS.zaehleAntwort(S.log, today(), right, s); return s; }
function logNew() { const s = taskSec(); if (STATUS) STATUS.zaehleNeu(S.log, today(), s); return s; }
function logTime() { const s = taskSec(); if (STATUS) STATUS.zaehleZeit(S.log, today(), s); return s; }
// Sekunden, die heute schon in der App geübt wurden (für den Deckel)
function heuteSek() { const e = S.log[today()]; return e && e.s ? e.s : 0; }

// ================================================================
// Testtermin
// Der offizielle Termin steht in stoff.js (STOFF.test, eingetragen von Mama und Papa über /stoff) und geht immer
// vor – das Kind kann ihn nicht verschieben. Einen eigenen Termin gibt es nur, wenn kein offizieller ansteht.
// ================================================================
function officialTest() { return TEST && TEST.datum >= today() ? TEST.datum : ''; }
function ownTest() {
  const t = S.settings.testDate;
  return !officialTest() && isDay(t) && t >= today() ? t : '';
}
function testDate() { return officialTest() || ownTest(); }
function testIn() { const t = testDate(); return t ? daysBetween(today(), t) : null; }
// Endspurt: die letzten Tage vor dem Test (Sa–Mo). Testtag: Tag des Tests.
function istEndspurt() { const d = testIn(); return d != null && d >= 1 && d <= MODELL.endspurt; }
function istTesttag() { return testIn() === 0; }
function testVorbei() { return !!TEST && today() > TEST.datum; }
// Für den Lagebericht: { datum, titel, quelle, seit }
function nextTest() {
  const off = officialTest();
  if (off) {
    const t = { datum: off, titel: TEST.titel || 'Deutsch-Schularbeit', quelle: 'eltern' };
    if (isDay(TEST.eingetragen)) t.seit = TEST.eingetragen;
    return t;
  }
  const own = ownTest();
  if (!own) return null;
  const t = { datum: own, titel: 'Deutsch-Test', quelle: 'selbst' };   // kein Name im Bericht
  if (isDay(S.settings.testSince)) t.seit = S.settings.testSince;
  return t;
}
// Ziel (100 %, Ziellinie, Ampel) = alle A-Karten (Rolle „ziel“) und die Schreib-Tränke. Extra und Nachschlagen nie.
function imZiel(c) { return c.rolle === 'ziel'; }
// Früher Start: Wer vor dem ersten Plan-Tag öffnet, bekommt dessen Inhalt schon heute. Wer früher anfängt, darf.
function planTag() { const t = today(); return PLAN_START && t < PLAN_START ? PLAN_START : t; }
// Vor dem ersten Plan-Tag ist nichts Pflicht. Ein vergangener Tag davor zählt darum nie als ausgelassen (nichts
// offen), und wer dort schon geübt hat, hat seine Runde (fertig). Bis dl-v3 stand der Inhalt des frühen Starts als
// „offen“ im Protokoll: Am Tag nach dem Einrichten (So 08.11.2026) zeigten die Plan-Karte und Legends HQ den
// Einrichtungstag als ausgelassen, die Ampel „Aufholen“. Läuft vor jedem Bericht.
// Welcher Tag „vor dem Start“ war, steht im Tag selbst (vs = 1, gesetzt, solange heute < PLAN_START) – nie am
// heutigen PLAN_START gemessen: Rückt der mit neuem Stoff nach hinten, blieben echte Plan-Tage sonst nicht, wie sie
// waren. Ohne Merker (dl-v1 bis dl-v3) gilt alles vor dem ersten Plan-Tag überhaupt (VORSTART_ALT).
const VORSTART_ALT = '2026-11-08';
function vorStartTage() {
  const t = today();
  for (const [d, x] of Object.entries(S.log)) {
    if (d >= t || !x || typeof x !== 'object' || !(x.vs === 1 || d < VORSTART_ALT)) continue;
    x.o = 0;
    if ((x.a || 0) + (x.n || 0) > 0) x.f = 1;
  }
  if (STATUS && PLAN_START && t < PLAN_START) STATUS.eintrag(S.log, t).vs = 1;
}

// ================================================================
// Karteikasten-Logik (lernmodell 3b, bauauftrag 4)
// ================================================================
// Stern-Tränke ruhen bis nach dem Test: fällig verteilt auf Test + 7 … Test + 11 (24.–28.11.), fest nach dem Hash
// der id – so bekommt kein Tag alle Sterne auf einmal (Entscheidung der Projektleitung, 07.11.). Nach dem Test
// mindestens die Pause von Stufe 3.
function sternFaellig(c) {
  const nach = addDays(today(), MODELL.pausen[3]);
  const t = TEST ? addDays(TEST.datum, MODELL.sternRuht + (c ? c.rank % MODELL.sternTage : 0)) : '';
  return t && t > nach ? t : nach;
}
// Endspurt (lernmodell 3b): Was seit Test − 4 nicht gewusst wurde, kommt vor dem Test noch einmal dran –
// voll (Stufe ≥ 3) einmal an Sa, So oder Mo (verteilt nach Kartennummer), Stufe 1–2 spätestens am Mo.
// Stern-Tränke ruhen. Am Testtag und danach gilt der normale Plan.
function effDue(c) {
  const st = S.k[c.id], t = testDate();
  if (!t || st.s || c.rolle === 'nachschlagen') return st.due;
  const tage = daysBetween(today(), t);
  if (tage < 1) return st.due;
  if (st.gw && st.gw >= addDays(t, -MODELL.gewusstAb)) return st.due;
  const cap = st.lv >= MODELL.sicherAb ? addDays(t, -MODELL.endspurt + (c.n % MODELL.endspurt)) : addDays(t, -1);
  return st.due < cap ? st.due : cap;
}
// Eine Karte ist dran, wenn ihre Pause vorbei ist – höchstens einmal pro Tag
function isDue(c) { const st = S.k[c.id]; return !!st && st.lv >= 1 && st.last !== today() && effDue(c) <= today(); }
function reviewsToday() {
  const t = today();
  let n = 0;
  for (const c of KARTEN) { const st = S.k[c.id]; if (st && st.last === t && st.since !== t) n++; }
  return n;
}
// Die wackeligsten zuerst: niedrigste Stufe, dann am längsten fällig
function urgency(a, b) { return (S.k[a.id].lv - S.k[b.id].lv) || cmp(effDue(a), effDue(b)) || (a.rank - b.rank); }
function pause(lv) { return istEndspurt() && lv <= 2 ? 1 : (MODELL.pausen[lv] || 1); }

// Neu ins Regal. info: { check: Blitz-Check?, gewusst, stern }
function collect(c, lv, info = {}) {
  const t = today();
  const st = { lv, due: info.stern ? sternFaellig(c) : addDays(t, lv === 2 ? (istEndspurt() ? 1 : MODELL.checkRegelPause) : 1), last: t, ok: info.gewusst ? 1 : 0, bad: 0, since: t };
  if (info.gewusst) st.gw = t;
  if (info.stern) st.s = t;
  if (info.check) st.c = info.gewusst ? 1 : 0;
  S.k[c.id] = st;
  if (S.day.date !== t) S.day = { date: t, newCount: 0, extra: 0 };
  S.day.newCount = (S.day.newCount || 0) + 1;
}
// Nur der erste Versuch des Tages bei einer fälligen Karte ändert die Stufe. res: ok · bleibt · falsch
function review(c, res) {
  const st = S.k[c.id], t = today(), from = st.lv;
  if (res === 'ok') {
    st.lv = Math.min(MAX_STUFE, from + 1);
    st.due = addDays(t, from >= MAX_STUFE ? MODELL.maxPause : pause(st.lv));
    st.gw = t;
  } else if (res === 'bleibt') {
    st.due = addDays(t, 1);
  } else {
    st.lv = Math.max(1, from - MODELL.fehlerMinus);
    st.due = addDays(t, 1);
    delete st.s;   // der Stern-Korken löst sich, der Trank geht den normalen Weg
  }
  st.last = t;
  return { from, to: st.lv };
}

// Serie (nur noch intern für das Lob „N Tage am Stück“ – kein Flammen-Zähler, erlebnis 7)
function refreshStreak() {
  const last = S.stats.lastDay;
  if (!last || !S.stats.streak || daysBetween(last, today()) <= 1) return;
  S.stats.streak = 0;
  save();
}
function markDay() {
  const t = today();
  if (S.stats.lastDay === t) return false;
  S.stats.streak = S.stats.lastDay && daysBetween(S.stats.lastDay, t) === 1 ? S.stats.streak + 1 : 1;
  S.stats.best = Math.max(S.stats.best, S.stats.streak);
  S.stats.lastDay = t;
  return true;
}

// ================================================================
// Verb-Check (lernmodell 3b): jedes Verb einmal als Tabellenzeile, verteilt auf die Check-Tage.
// Je Check-Tag: offene Verben ÷ verbleibende Check-Tage (aufgerundet), nichtZusammen nie am selben Tag, höchstens
// proFamilie je Familie. Nach dem letzten Check-Tag kommt alles Offene am nächsten Tag (A geht vor).
// ================================================================
function verbKarten(v) { return [BY_ID[v.id + '-prae'], BY_ID[v.id + '-perf']].filter(Boolean); }
function verbOffen(v) { return verbKarten(v).some(c => !S.k[c.id]); }
function verbHeuteGeprueft(v) { const t = today(); return verbKarten(v).every(c => S.k[c.id] && S.k[c.id].since === t && S.k[c.id].c != null); }
function checkTage() {
  const t = today();
  return VC_TAGE.length && t < VC_TAGE[0] ? [t, ...VC_TAGE] : VC_TAGE;   // früher Start: heute zählt dazu
}
function verbHeute() {
  const t = today();
  if (!VERBEN.length || istTesttag()) return [];
  const offen = VERBEN.filter(verbOffen);
  if (!offen.length) return [];
  const tage = checkTage();
  const gemacht = VERBEN.filter(v => !verbOffen(v) && verbHeuteGeprueft(v));
  let quote, streng = true;
  if (!tage.length) { quote = offen.length; streng = false; }
  else if (tage.includes(t)) quote = Math.ceil((offen.length + gemacht.length) / tage.filter(d => d >= t).length) - gemacht.length;
  else if (t > tage[tage.length - 1]) { quote = offen.length; streng = false; }   // verpasste Check-Tage: alles Offene
  else quote = 0;   // kein Check-Tag (Do 12.)
  if (quote <= 0) return [];
  const famZahl = Object.create(null);
  const heute = new Set();
  for (const v of gemacht) { famZahl[v.muster] = (famZahl[v.muster] || 0) + 1; heute.add(v.id); }
  const fams = Object.create(null);
  for (const v of offen) (fams[v.muster] = fams[v.muster] || []).push(v);
  // Verben mit einem Partner aus nichtZusammen zuerst: So verteilen sich die Paare früh auf verschiedene Tage und
  // bleiben nicht zusammen bis zum letzten Check-Tag übrig
  for (const f in fams) fams[f].sort((a, b) => (VC_NICHT[b.id] ? 1 : 0) - (VC_NICHT[a.id] ? 1 : 0));
  // Fairer Anteil je Familie für heute: (offen + heute schon geprüft) ÷ verbleibende Check-Tage. Gezogen wird immer
  // aus der Familie, die am weitesten hinter ihrem Anteil liegt. Reihum (je Familie eins) bekämen große Familien nur
  // etwa 2 am Tag, und am letzten Check-Tag blieben mehr als proFamilie übrig.
  const tageRest = Math.max(1, tage.filter(d => d >= t).length);
  const soll = Object.create(null);
  for (const f in fams) soll[f] = (fams[f].length + (famZahl[f] || 0)) / (tage.includes(t) ? tageRest : 1);
  const kollidiert = v => [...heute].some(id => VC_NICHT[v.id] && VC_NICHT[v.id].has(id));
  const out = [];
  while (out.length < quote) {
    const order = Object.keys(fams).filter(f => fams[f].length)
      .sort((a, b) => ((soll[b] - (famZahl[b] || 0)) - (soll[a] - (famZahl[a] || 0))) || (fams[b].length - fams[a].length) || cmp(a, b));
    let dazu = false;
    for (const f of order) {
      if (streng && (famZahl[f] || 0) >= VC_PRO_FAMILIE) continue;
      const i = fams[f].findIndex(v => !kollidiert(v));
      if (i < 0) continue;
      const v = fams[f].splice(i, 1)[0];
      out.push(v);
      heute.add(v.id);
      famZahl[f] = (famZahl[f] || 0) + 1;
      dazu = true;
      break;   // nach jedem Verb neu sortieren
    }
    if (!dazu) break;
  }
  return out;
}

// ================================================================
// Tagesplan (bauauftrag 4): 1 fällige A (wackeligste zuerst) · 2 neue A (Verb-Check zuerst) · 3 fällige Extra ·
// 4 neue Extra. A wird immer fertig. Der Deckel stoppt nur 3 und 4; Wiederholungen höchstens 50 (nur Extra gekürzt).
// ================================================================
function neuePaketeA() {
  if (istTesttag()) return [];
  const pt = planTag();
  return PAKETE.filter(p => p.rolle === 'ziel' && p !== VPAKET && (!p.ab || p.ab <= pt))
    .sort((a, b) => cmp(a.ab || '', b.ab || '') || (a.index - b.index))
    .map(p => ({ p, karten: p.karten.filter(c => !S.k[c.id]) }))
    .filter(x => x.karten.length);
}
function extraOffeneKarten() { return EXTRA_FOLGE.flatMap(p => p.karten.filter(c => !S.k[c.id])); }
// Neues Extra nur bis Test − 4; danach Endspurt und Testtag, nach dem Test wieder
function extraNeuErlaubt() { const d = testIn(); return d == null || d > MODELL.extraSperre; }
function deckelHeute() { return KURZTAGE.has(today()) ? MODELL.deckelKurz : MODELL.deckel; }
// geschätzte Sekunden für eine Karte (neu: mit Blitz-Check und Lernschritt)
function sekKarte(c, neu) {
  const v = c.views ? c.views[0] : c.pool[0];
  let s;
  if (c.typ === 'verb') s = MODELL.sek.verb;
  else if (v.eingabe === 'tippen') s = v.felder.some(f => f.liste) ? MODELL.sek.liste : /^st(-|$)/.test(c.p.id) ? MODELL.sek.steigerung : MODELL.sek.tippen;
  else s = MODELL.sek.antippen;
  return s + (neu ? MODELL.fehlerQuote.neu : MODELL.fehlerQuote.wdh) * MODELL.sek.fehler;
}
const summe = (list, f) => list.reduce((a, x) => a + f(x), 0);
function tagesPlan() {
  const plan = { testtag: istTesttag(), aDue: [], verben: [], pakete: [], aNeu: [], eDue: [], eNeu: [], merk: [], sekA: 0, sek: 0 };
  const wdhSchon = reviewsToday();
  if (plan.testtag) {
    // Testtag: nur Gerutschtes zum Aufwärmen, A zuerst, höchstens 10
    const due = KARTEN.filter(c => c.rolle !== 'nachschlagen' && isDue(c))
      .sort((a, b) => ((a.rolle === 'ziel' ? 0 : 1) - (b.rolle === 'ziel' ? 0 : 1)) || urgency(a, b));
    plan.aDue = due.slice(0, Math.max(0, MODELL.testtagLimit - wdhSchon));
    plan.sekA = plan.sek = summe(plan.aDue, c => sekKarte(c, false));
    return plan;
  }
  plan.aDue = KARTEN.filter(c => c.rolle === 'ziel' && isDue(c)).sort(urgency);
  plan.verben = verbHeute();
  plan.pakete = neuePaketeA();
  plan.aNeu = [...plan.verben.flatMap(v => verbKarten(v).filter(c => !S.k[c.id])), ...plan.pakete.flatMap(x => x.karten)];
  if (plan.verben.length && VPAKET && VPAKET.regel && !S.regel[VPAKET.id]) plan.merk.push(VPAKET);
  for (const x of plan.pakete) if (x.p.regel && !S.regel[x.p.id]) plan.merk.push(x.p);
  plan.sekA = summe(plan.aDue, c => sekKarte(c, false)) + summe(plan.aNeu, c => sekKarte(c, true)) + plan.merk.length * MODELL.sek.merkkarte;
  // Extra: was unter den Deckel passt – zuerst fällige (wackeligste zuerst), dann neue in rang-Reihenfolge
  let rest = deckelHeute() * 60 - heuteSek() - plan.sekA;
  const eDue = KARTEN.filter(c => c.rolle === 'extra' && isDue(c)).sort(urgency)
    .slice(0, Math.max(0, MODELL.wdhLimit - wdhSchon - plan.aDue.length));
  for (const c of eDue) { const s = sekKarte(c, false); if (s > rest) break; plan.eDue.push(c); rest -= s; }
  if (plan.eDue.length === eDue.length && extraNeuErlaubt()) {
    for (const c of extraOffeneKarten()) {
      const merk = c.p.regel && !S.regel[c.p.id] && !plan.merk.includes(c.p);
      const s = sekKarte(c, true) + (merk ? MODELL.sek.merkkarte : 0);
      if (s > rest) break;
      plan.eNeu.push(c);
      if (merk) plan.merk.push(c.p);
      rest -= s;
    }
  }
  plan.sek = plan.sekA + summe(plan.eDue, c => sekKarte(c, false)) + summe(plan.eNeu, c => sekKarte(c, true))
    + plan.merk.filter(p => p.rolle === 'extra').length * MODELL.sek.merkkarte;
  return plan;
}
function aOffen(plan) { return plan.aDue.length + plan.aNeu.length; }
function minuten(sek) { return Math.max(1, Math.round(sek / 60)); }

// ================================================================
// Ziel-Karte (erlebnis 3 und 11a): 3 Balken je ⅓, Ziellinie bei 95 %, BEREIT wenn alle drei drüber.
// Ein Balken = Mittel seiner Ziel-Karten (Stufe/3, höchstens voll). Über MODELL.verblasst Tage überfällig zählt
// eine Stufe tiefer („verdunstet“). Personenbeschreibung: ½ Karten, ½ Schreib-Tränke (bereiche[].papier).
// Prozent wird abgerundet: 94,9 % ist 94 % und noch nicht über der Linie.
// ================================================================
function stufeZiel(c) {
  const st = S.k[c.id];
  if (!st) return 0;
  return daysBetween(st.due, today()) > MODELL.verblasst ? Math.max(0, st.lv - 1) : st.lv;
}
function pct(x) { return x >= 1 ? 100 : Math.max(0, Math.floor(x * 100 + 1e-9)); }
function trankStufe(id) { const t = S.schreiben.t[id]; return t ? Math.max(0, Math.min(3, t.lv || 0)) : 0; }
function zielStand() {
  const A = MODELL.sicherAb;
  const bereiche = BEREICHE.map(b => {
    const list = KARTEN.filter(c => c.rolle === 'ziel' && c.bereich === b.id);
    const stufen = new Array(A + 1).fill(0);   // 0 = leer … A = voll
    let wk = 0, verblasst = 0, sterne = 0;
    for (const c of list) {
      const lv = Math.min(stufeZiel(c), A);
      stufen[lv]++;
      wk += lv / A;
      const st = S.k[c.id];
      if (st && stufeZiel(c) < st.lv) verblasst++;
      if (st && st.s) sterne++;
    }
    wk = list.length ? wk / list.length : 0;
    const papier = Number(b.papier) > 0 && TRAENKE.length ? Math.min(1, Number(b.papier)) : 0;
    const tw = papier ? summe(TRAENKE, t => trankStufe(t.id) / 3) / TRAENKE.length : 0;
    const wert = papier ? (list.length ? (1 - papier) * wk + papier * tw : tw) : wk;
    return { b, list, gesamt: list.length + (papier ? TRAENKE.length : 0), wert, prozent: pct(wert), stufen, verblasst, sterne, papier, traenke: tw };
  }).filter(x => x.gesamt);
  const gew = x => (x.b.gewicht != null ? Math.max(0, Number(x.b.gewicht) || 0) : 1);
  const summeG = summe(bereiche, gew);
  const wert = summeG ? summe(bereiche, x => x.wert * gew(x)) / summeG : 0;
  const bereit = bereiche.length > 0 && bereiche.every(x => x.prozent >= ZIELLINIE);
  const perfekt = bereiche.length > 0 && bereiche.every(x => x.prozent >= 100);
  return { wert, prozent: pct(wert), bereiche, bereit, perfekt };
}
function titelIndex(z) {
  if (z.bereit) return 4;
  let i = 0;
  TITEL_AB.forEach((ab, k) => { if (z.prozent >= ab) i = k; });
  return i;
}
// Titel und BEREIT/PERFEKT festhalten (erreichte Titel bleiben). Gibt zurück, was heute neu ist (für Konfetti).
function meilensteine(z) {
  const neu = {};
  const ti = titelIndex(z);
  if (ti > (S.ui.titel || 0)) { S.ui.titel = ti; neu.titel = TITEL[ti]; }
  if (z.bereit && !S.ui.bereit) { S.ui.bereit = today(); neu.bereit = true; }
  if (z.perfekt && !S.ui.perfekt) { S.ui.perfekt = today(); neu.perfekt = true; }
  return neu;
}
// Wie viele Ziel-Tränke morgen dran sind (können morgen steigen)
function morgenBereit() {
  const m = addDays(today(), 1);
  let n = 0;
  for (const c of KARTEN) if (c.rolle === 'ziel' && S.k[c.id] && S.k[c.id].lv >= 1 && effDue(c) <= m) n++;
  return n;
}
// Prognose für „Bereit frühestens …“: ab jetzt jede Antwort richtig, neue Karten im Blitz-Check noch nicht gekonnt
// (eher vorsichtig). Schreib-Tränke: „Passt“ an den Tagen der Schreibaufträge. Liefert { tag, prozent } (tag = '' →
// bis zum Test nicht über der Linie, prozent = Stand am Testtag).
function prognose() {
  const tt = testDate();
  if (!tt) return null;
  const t0 = today(), A = MODELL.sicherAb;
  const end = (d) => daysBetween(d, tt) >= 1 && daysBetween(d, tt) <= MODELL.endspurt;
  const weiter = (d, lv) => addDays(d, end(d) && lv <= 2 ? 1 : (MODELL.pausen[lv] || 1));
  // Für jede Ziel-Karte: an welchen Tagen sie welche Stufe erreicht
  const lastCheck = checkTage().filter(d => d >= t0).pop() || t0;
  const wege = new Map();
  for (const c of KARTEN) {
    if (c.rolle !== 'ziel') continue;
    const st = S.k[c.id];
    let lv, d;
    if (st) { lv = Math.min(stufeZiel(c), A); d = effDue(c) < t0 ? t0 : effDue(c); if (st.last === t0) d = d <= t0 ? addDays(t0, 1) : d; }
    else {
      d = c.typ === 'verb' ? lastCheck : (c.p.ab && c.p.ab > t0 ? c.p.ab : t0);
      if (d < planTag() && !st) d = t0;
      lv = 0;
    }
    const weg = [[t0, lv]];
    if (lv === 0) { lv = 1; weg.push([d, 1]); d = addDays(d, 1); }
    let guard = 0;
    while (lv < A && guard++ < 6) { lv++; weg.push([d, lv]); d = weiter(d, lv); }
    wege.set(c, weg);
  }
  const lvAm = (weg, d) => { let lv = 0; for (const [x, l] of weg) if (x <= d) lv = l; return lv; };
  // Tränke: ⅔ am Tag des Teil-Auftrags, voll beim nächsten ganzen Text (Wortspeicher zu) an einem späteren Tag
  const trWeg = TRAENKE.map(tr => {
    const st = S.schreiben.t[tr.id] || { lv: 0, passt: [] };
    const weg = [[t0, Math.min(3, st.lv || 0)]];
    let zwei = (st.lv || 0) >= 2 ? t0 : '';
    if (!zwei) {
      const teil = AUFTRAEGE.find(a => !a.ganz && a.traenke.includes(tr.id));
      zwei = teil ? (teil.ab > t0 ? teil.ab : t0) : '';
      if (zwei) weg.push([zwei, 2]);
    }
    if ((st.lv || 0) < 3 && zwei) {
      const ganz = AUFTRAEGE.find(a => a.ganz && a.wortspeicher !== 'offen' && a.traenke.includes(tr.id) && a.ab > ((st.passt || []).length ? '' : zwei) && a.ab >= t0);
      if (ganz) weg.push([ganz.ab > zwei ? ganz.ab : addDays(zwei, 1), 3]);
    }
    return weg;
  });
  const stand = d => {
    const bars = BEREICHE.map(b => {
      const list = KARTEN.filter(c => c.rolle === 'ziel' && c.bereich === b.id);
      const wk = list.length ? summe(list, c => lvAm(wege.get(c), d) / A) / list.length : 0;
      const papier = Number(b.papier) > 0 && TRAENKE.length ? Math.min(1, Number(b.papier)) : 0;
      const tw = papier ? summe(trWeg, w => lvAm(w, d) / 3) / TRAENKE.length : 0;
      return { n: list.length + (papier ? TRAENKE.length : 0), wert: papier ? (list.length ? (1 - papier) * wk + papier * tw : tw) : wk };
    }).filter(x => x.n);
    return { bereit: bars.length && bars.every(x => pct(x.wert) >= ZIELLINIE), prozent: pct(summe(bars, x => x.wert) / Math.max(1, bars.length)) };
  };
  for (let d = t0; d <= tt; d = addDays(d, 1)) if (stand(d).bereit) return { tag: d, prozent: stand(d).prozent };
  return { tag: '', prozent: stand(tt).prozent };
}

// ================================================================
// Ton (abschaltbar): Blubbern beim Steigen, „Plopp“ wenn voll, „Pling“ beim Stern-Trank
// ================================================================
let actx = null;
function sfx(kind) {
  if (!S.settings.sfx) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const seq = {
      ok: [[660, 0], [990, 0.09]],
      bad: [[247, 0], [196, 0.12]],
      tap: [[520, 0]],
      blub: [[392, 0], [523, 0.06], [659, 0.12]],
      plopp: [[880, 0], [1320, 0.05]],
      pling: [[1568, 0], [2093, 0.08]],
      level: [[523, 0], [659, 0.09], [784, 0.18], [1046, 0.27]]
    }[kind] || [];
    for (const [f, d] of seq) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === 'bad' ? 'square' : kind === 'pling' ? 'sine' : 'triangle';
      o.frequency.value = f;
      const peak = kind === 'bad' ? 0.04 : 0.15;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(peak, t + d + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + (kind === 'pling' ? 0.4 : 0.18));
      o.connect(g).connect(actx.destination);
      o.start(t + d);
      o.stop(t + d + 0.45);
    }
  } catch (e) { /* kein Ton */ }
}
// iPhone hat keine Vibration-API; ein unsichtbarer Schalter (iOS 18+) löst ein kurzes Haptik-Feedback aus
function haptic() {
  if (!S.settings.sfx) return;
  try {
    if (navigator.vibrate) {
      if (!navigator.userActivation || navigator.userActivation.hasBeenActive) navigator.vibrate(18);
      return;
    }
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch (e) { /* egal */ }
}
// Vorlesen (Diktat-Karten). iPhone-Stimmen sprechen meist Bundesdeutsch (plattform.md).
function vorlesen(text) {
  try {
    if (!window.speechSynthesis) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const stimmen = speechSynthesis.getVoices();
    const v = stimmen.find(x => /^de[-_]AT/i.test(x.lang)) || stimmen.find(x => /^de/i.test(x.lang));
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'de-DE';
    u.rate = 0.85;
    speechSynthesis.speak(u);
    return true;
  } catch (e) { return false; }
}

// ================================================================
// Kleine UI-Helfer
// ================================================================
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Text aus stoff.js: escapen, *so* wird fett
function fmtText(s) { return esc(s == null ? '' : s).replace(/\*([^*]+)\*/g, '<b>$1</b>'); }
function restartAnim(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function shake(el) { restartAnim(el, 'shake'); }
function topbar(title, back = 'home') {
  return `<header class="topbar">
    <button class="icon-btn" type="button" data-act="${back}" aria-label="Zurück">‹</button>
    <h1 class="outline">${title}</h1>
  </header>`;
}
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
// Einfaches Bottom-Sheet. buttons: [{ label, value, cls }]
function sheet(html, buttons) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}
      <div class="sheet-btns">${(buttons || []).map((b, i) => `<button class="btn ${b.cls || ''}" type="button" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    const close = val => { wrap.remove(); resolve(val); };
    wrap.addEventListener('click', e => {
      if (e.target === wrap) return close(null);
      const b = e.target.closest('[data-i]');
      if (b) return close(buttons[+b.dataset.i].value);
      const t = e.target.closest('[data-act="trank"]');
      if (t) { close(null); trankDetail(t.dataset.id); }
    });
    document.body.appendChild(wrap);
    const first = wrap.querySelector('textarea, input');
    if (first) first.focus();
  });
}
let fxToken = 0;
function stopFx() {
  fxToken++;
  const cv = $('#fx');
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const token = ++fxToken;
  const cv = $('#fx'), ctx = cv.getContext('2d');
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#B6F23A', '#FFD23F', '#49B9FF', '#4ED98A', '#FF93DC', '#FF9A2B', '#FFFFFF'];
  const P = Array.from({ length: 110 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.3,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 12 - 5,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35,
    w: 7 + Math.random() * 7, h: 10 + Math.random() * 8,
    c: colors[Math.floor(Math.random() * colors.length)]
  }));
  let last = performance.now();
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#2A0E33';
  const frame = now => {
    if (token !== fxToken) return;
    const k = Math.min(2, (now - last) / 16.7);
    last = now;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of P) {
      p.vy += 0.38 * k; p.vx *= 0.995; p.x += p.vx * k; p.y += p.vy * k; p.r += p.vr * k;
      if (p.y > H + 30) continue;
      alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(frame);
}
// Regeltexte (Merkkarte, Zauberbuch): kein Zeilenumbruch vor „–“ (sinken – sank) und keiner nach dem Bindestrich einer
// Endung (-er, -sten, -te)
function regelHTML(h) {
  return String(h || '').replace(/ – /g, '\u00a0– ').replace(/(^|[\s>(„])-(?=[a-zäöüß])/g, '$1\u2011');
}
// Sichtbare Höhe über der Tastatur (iPhone) für das Layout der Abfrage
function syncViewport() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : innerHeight;
  document.documentElement.style.setProperty('--vvh', h + 'px');
  document.body.classList.toggle('kb', !!vv && innerHeight - vv.height > 120);
  if (screen === 'session') passend();
}
if (window.visualViewport) visualViewport.addEventListener('resize', syncViewport);
addEventListener('resize', syncViewport);

// ---------- Tränke ----------
// Ein Fläschchen: Füllstand in Dritteln (Farbe und Höhe zeigen dasselbe – auch bei Farbenblindheit), ab Stufe 6
// glüht er, Stern-Korken = im Blitz-Check gewusst. Feder am Etikett = Schreib-Trank.
function trankHTML(lv, opt = {}) {
  const f = Math.max(0, Math.min(3, lv | 0));
  const cls = ['trank', 'f' + f, lv >= MAX_STUFE ? 'glueht' : '', opt.stern ? 'stern' : '', opt.gross ? 'gross' : '', opt.feder ? 'feder' : '', opt.neu ? 'neu' : ''];
  return `<span class="${cls.filter(Boolean).join(' ')}" aria-hidden="true"><i></i></span>`;
}
function karteStufe(c) { const st = S.k[c.id]; return st ? stufeZiel(c) : 0; }
function karteTrank(c, opt = {}) { const st = S.k[c.id]; return trankHTML(karteStufe(c), { stern: !!(st && st.s), ...opt }); }
// Verb als Doppel-Phiole: links Mitvergangenheit, rechts Vergangenheit
function verbPhiole(v) {
  const [a, b] = verbKarten(v);
  return `<span class="dphiole">${a ? karteTrank(a) : ''}${b ? karteTrank(b) : ''}</span>`;
}
// „Personenbeschreibung ist …“, „Unregelmäßige Verben sind …“
function istSind(titel) { return /en$/.test(titel) ? 'sind' : 'ist'; }
function stufeText(lv) { return lv <= 0 ? 'leer' : lv >= MAX_STUFE ? 'glüht' : MODELL.stufen[Math.min(lv, MAX_STUFE)]; }
function fuellText(lv) { return ['leer', 'ein Drittel', 'zwei Drittel', 'voll'][Math.max(0, Math.min(3, lv))] + (lv >= MAX_STUFE ? ', er glüht' : ''); }

// ================================================================
// Screens
// ================================================================
let screen = '';
let updateReady = false;   // neue Version im Hintergrund geladen – beim nächsten Mal auf der Startseite neu laden

// ---------- Erster Start (erlebnis 3 und 11a) ----------
function welcome() {
  screen = 'welcome';
  stopFx();
  app.innerHTML = `
  <section class="screen welcome">
    <div class="logo-traenke" aria-hidden="true">${trankHTML(1, { gross: true })}${trankHTML(3, { gross: true, stern: true })}${trankHTML(2, { gross: true })}</div>
    <h1 class="outline hero">Willkommen bei ${esc(APP_NAME)}!</h1>
    <p class="lead">Spell heißt auf Englisch Zauberspruch – und buchstabieren.</p>
    <ul class="rules">
      <li><span>🧪</span><p><b>Jede Formel ist ein Zaubertrank.</b> Er füllt sich, wenn du sie an verschiedenen Tagen weißt. Voll heißt: sitzt.</p></li>
      <li><span>✍️</span><p><b>Du schreibst selbst</b>, wie in der Schularbeit: Groß und klein, ä, ö, ü und ß zählen.</p></li>
      <li><span>📄</span><p><b>Geschrieben wird auf Papier</b>, mit deiner Füllfeder. Die App gibt dir den Plan dazu.</p></li>
    </ul>
    <form class="panel name-form" id="welcome-form">
      <label for="nm">Wie heißt du?</label>
      <input id="nm" type="text" maxlength="20" placeholder="Dein Name (bleibt am Handy)" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" value="${esc(S.settings.name)}">
      <button class="btn go big" type="submit">Weiter</button>
    </form>
  </section>`;
  $('#welcome-form').addEventListener('submit', e => {
    e.preventDefault();
    S.settings.name = $('#nm').value.trim().slice(0, 20);
    S.ui.onboarded = true;
    save();
    $('#nm').blur();
    ziellinieScreen();
  });
}
function ziellinieScreen() {
  screen = 'ziellinie';
  stopFx();
  const t = TEST ? `die ${esc(TEST.titel || 'Deutsch-Schularbeit')} am ${esc(dateLabel(TEST.datum))}` : 'deine nächste Schularbeit';
  app.innerHTML = `
  <section class="screen welcome">
    <h1 class="outline hero">Deine Ziellinie</h1>
    <div class="panel prose">
      <p><b>Dein Ziel: ${t}.</b></p>
      <div class="zdemo" aria-hidden="true"><span class="zbar"><i style="width:97%" class="over"></i><b class="zlinie"></b></span></div>
      <p>In Englisch hieß es: alle Balken voll. Hier gibt es viel mehr Tränke, und jeden Tag verdunsten ein paar ein bisschen. Das passiert jedem Kopf.</p>
      <p>Darum hat jeder Balken eine <b>Ziellinie</b>. Sind alle drei drüber, bist du <b>bereit</b> für die Schularbeit. 100 % ist der Bonus.</p>
      <p>Ein Trank füllt sich, wenn du eine Formel an verschiedenen Tagen weißt. Voll heißt: sitzt.</p>
    </div>
    <button class="btn go big" type="button" data-act="ziellinieOk">Los geht’s</button>
  </section>`;
}

// ---------- Start ----------
function isStandalone() { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

function home() {
  if (updateReady) { location.reload(); return; }
  screen = 'home';
  stopFx();
  SES = null;
  SW = null;
  document.body.classList.remove('in-session');
  refreshStreak();
  const z = zielStand();
  if (Object.keys(meilensteine(z)).length) save();   // still festhalten, gefeiert wird am Rundenende
  const plan = tagesPlan();
  const name = S.settings.name;
  const installHint = (!isStandalone() && isIOS() && !S.ui.hideInstall) ? `
    <div class="panel install">
      <p><b>Als App aufs iPhone:</b> unten auf <span class="share">⬆︎</span> Teilen tippen, dann „Zum Home-Bildschirm“. So bleibt dein Fortschritt sicher gespeichert.</p>
      <button class="link" type="button" data-act="hideInstall">Ausblenden</button>
    </div>` : '';
  app.innerHTML = `
  <section class="screen home">
    <header class="home-top">
      <h1 class="outline hello">${name ? `Hi ${esc(name)}!` : 'Hi!'}</h1>
      <button class="icon-btn" type="button" data-act="settings" aria-label="Einstellungen">⚙︎</button>
    </header>
    ${zielHTML(z, plan)}
    ${schreibPanelHTML(plan)}
    ${planSlot()}
    ${installHint}
    <button class="panel regal-kachel" type="button" data-act="regal">${regalVorschauHTML()}</button>
    <div class="two">
      <button class="btn" type="button" data-act="zauberbuch">📖 Zauberbuch</button>
      <button class="btn" type="button" data-act="about">❓ So geht’s</button>
    </div>
  </section>`;
}

// ---------- Ziel-Karte: große Zahl, Stempel, 3 Balken mit Ziellinie, Countdown, Start ----------
function balkenHTML(x, tippbar = true) {
  const p = x.prozent, ueber = p >= ZIELLINIE;
  const rechts = ueber ? '<span class="zrest ok">bereit</span>' : `<span class="zrest">noch ${ZIELLINIE - p} %</span>`;
  const tag = tippbar ? 'button' : 'div';
  return `<${tag} class="zrow ${ueber ? 'over' : ''}" ${tippbar ? `type="button" data-act="bereich" data-id="${esc(x.b.id)}"` : ''} aria-label="${esc(x.b.titel)}: ${p} Prozent">
      <span class="zlabel">${esc(x.b.titel)}</span><span class="zpct">${p} %</span>
      <span class="zbar"><i style="width:${p}%"></i><b class="zlinie" aria-hidden="true"></b></span>${rechts}
    </${tag}>`;
}
function stempelHTML(z) {
  if (z.perfekt) return '<span class="stempel perfekt">PERFEKT</span>';
  if (z.bereit) return '<span class="stempel bereit">BEREIT</span>';
  if (S.ui.bereit) return '<span class="stempel fast">FAST BEREIT</span>';
  return '';
}
function countdownHTML() {
  const t = testDate();
  if (!t) return '';
  const d = daysBetween(today(), t);
  return `<div class="countdown" aria-label="${d === 0 ? 'heute' : d + (d === 1 ? ' Tag' : ' Tage')}"><b>${d === 0 ? '!' : d}</b><span>${d === 0 ? 'heute' : d === 1 ? 'Tag' : 'Tage'}</span></div>`;
}
function zielSatz(z, plan) {
  const d = testIn();
  if (!testDate()) return testVorbei() ? 'Schularbeit geschafft. Das Regal bleibt deins.' : 'Füll deine Tränke – jeden Tag ein bisschen.';
  if (d === 0) return z.bereit ? `Heute ist die Schularbeit. Du bist bereit (${z.prozent} %). Wenn du magst: 5 Minuten aufwärmen.`
    : `Heute ist die Schularbeit. ${z.prozent} % sitzen sicher. 5 Minuten aufwärmen holt noch ein paar.`;
  if (z.perfekt) return 'Alle Tränke voll, perfekt! Das ist selten, weil jeden Tag ein paar verdunsten.';
  if (z.bereit) return 'BEREIT! Alle drei Balken sind über der Ziellinie. Jeden Tag deine Runde, dann bleibst du bereit.';
  const drunter = z.bereiche.filter(x => x.prozent < ZIELLINIE);
  if (S.ui.bereit && drunter.length === 1) return `${drunter[0].b.titel} ${istSind(drunter[0].b.titel)} knapp unter die Linie gerutscht (${drunter[0].prozent} %). Deine nächste Runde holt das.`;
  if (d === 1) return 'Morgen ist die Schularbeit. Heute deine Runde, dann früh schlafen. Im Schlaf festigt sich, was du geübt hast.';
  if (!KARTEN.some(c => S.k[c.id])) return '0 % · Los geht’s!';
  if (drunter.length === 1) return `Noch 1 Balken: ${drunter[0].b.titel}, noch ${ZIELLINIE - drunter[0].prozent} %.`;
  const pr = prognose();
  if (pr && pr.tag) return `Ziel: alle drei Balken über die Ziellinie. Bereit frühestens ${dateShort(pr.tag)}`;   // dateShort endet mit Punkt
  if (pr) return `Bis ${WEEKDAYS[weekdayOf(testDate())]} schaffst du ca. ${pr.prozent} %, wenn du jeden Tag deine Runde machst.`;
  return 'Ziel: alle drei Balken über die Ziellinie.';
}
function zielHTML(z, plan) {
  if (!KARTEN.length) return '<div class="panel ziel"><p class="mission-line">Hier kommt bald dein Stoff.</p></div>';
  const t = nextTest();
  const titelOben = t ? esc(t.titel) : 'Dein Ziel';
  const titelUnten = t ? esc(dateLabel(t.datum)) : 'Alles aus deinem Stoff';
  const titel = TITEL[Math.max(S.ui.titel || 0, titelIndex(z))];
  // Neues gibt es im Endspurt nur, wenn Tage ausgelassen wurden (A geht vor) – dann den Satz weglassen
  const endspurt = istEndspurt() ? `<p class="endspurt"><b>Endspurt</b> Ab jetzt kommt alles noch einmal dran.${plan.aNeu.length ? '' : ' Neues gibt’s keins mehr.'}</p>` : '';
  const klein = z.bereit && !z.perfekt && z.prozent < 100
    ? `<p class="fineprint">Die letzten ${100 - z.prozent} %: Ein paar Tränke sind verdunstet. Deine nächste Runde holt sie zurück.</p>` : '';
  return `<div class="panel ziel" id="ziel">
    <div class="ziel-head">
      <div class="ziel-txt"><div class="eyebrow">${titelOben}</div><h2 class="ziel-titel">${titelUnten}</h2></div>
      ${countdownHTML()}
    </div>
    <div class="ziel-zahlrow">
      <div class="ziel-zahl" aria-label="${z.prozent} Prozent geschafft"><b>${z.prozent}</b><span>%</span></div>
      <div class="ziel-zahltxt"><b>geschafft</b><small>${esc(titel)}${S.ui.perfekt ? ' · Abzeichen Perfekt' : ''}</small></div>
      ${stempelHTML(z)}
    </div>
    <div class="zrows">${z.bereiche.map(x => balkenHTML(x)).join('')}</div>
    <p class="ziel-sub">${esc(zielSatz(z, plan))}</p>
    ${klein}
    ${endspurt}
    ${startHTML(plan)}
  </div>`;
}
// ---------- Deine Mission heute (Projektleitung, 08.11.2026: „Klarer Tagesauftrag“) ----------
// Mission = der ganze Tag: ① die Runde (Karten, A des Tages) und an Schreibtagen ② ein Schreibauftrag auf Papier.
// Reihenfolge, wie das Kind mag. Herzeigen und Ausbessern gehören nicht dazu (sie stehen unter dem Kasten). Offenes
// zeigt ○, nie ✕ oder Rot. Am Testtag gibt es keine Mission: Aufwärmen ist freiwillig, die Startseite bleibt wie
// bisher. Dieselbe Rechnung meldet der Lagebericht (heuteOffen, fortschritt.schreiben).
function missionHeute(plan = tagesPlan(), si = schreibInfo()) {
  const e = S.log[today()] || {};
  const rundeOffen = aOffen(plan) > 0;   // Extra unter dem Deckel gehört nicht zur Mission
  return {
    rundeOffen,
    schreibTag: si.pflichtOffen || si.heuteGeprueft.length > 0,   // gibt es heute ein ②?
    schreibOffen: si.pflichtOffen,
    fertig: !rundeOffen && !si.pflichtOffen,
    getan: (e.a || 0) + (e.n || 0) > 0 || si.heuteGeprueft.length > 0   // heute schon etwas dafür gemacht
  };
}
// „① Runde · 12 fällig · 8 neu · ca. 15 Min.“ (am 1. Tag statt der Zahlen der Blitz-Check). Gezählt wird, was der
// Start-Knopf wirklich bringt, also mit dem Extra, das heute unter den Deckel passt.
function rundeText(plan, nummer) {
  const faellig = plan.aDue.length + plan.eDue.length;
  const neu = plan.aNeu.length + plan.eNeu.length;
  const teile = [`<b>${nummer ? '① ' : ''}Runde</b>`];
  if (!KARTEN.some(c => S.k[c.id]) && plan.verben.length) teile.push('Blitz-Check: Welche Verben kannst du schon?');
  else {
    if (faellig) teile.push(`${faellig} fällig`);
    if (neu) teile.push(`${neu} neu`);
  }
  teile.push(`ca. ${minuten(plan.sek)} Min.`);
  return teile.join(' · ');
}
// Eine Zeile im Kasten: offen = antippbar (führt zu dem Schritt), erledigt = nur ✓
function missionZeile(offen, html, act, id) {
  const haken = `<span class="mhaken" role="img" aria-label="${offen ? 'offen' : 'erledigt'}">${offen ? '○' : '✓'}</span>`;
  return offen
    ? `<button class="mzeile" type="button" data-act="${act}"${id ? ` data-id="${esc(id)}"` : ''}>${haken}<span class="mtext">${html}</span></button>`
    : `<div class="mzeile ok">${haken}<span class="mtext">${html}</span></div>`;
}
// Unter der Ziel-Karte: Kasten „Deine Mission heute“ mit ① und ②, Start führt zum nächsten offenen Schritt.
// Ganz fertig: „Mission geschafft ✓“, dann wie bisher „Morgen bereit“, Extra-Paket und Freies Üben.
function startHTML(plan) {
  if (plan.testtag) return testtagStartHTML(plan);
  const si = schreibInfo();
  const m = missionHeute(plan, si);
  const zwei = m.schreibTag;   // ohne Schreibauftrag heute: eine Zeile ohne Nummer
  const runde = missionZeile(m.rundeOffen, m.rundeOffen ? rundeText(plan, zwei) : `<b>${zwei ? '① ' : ''}Runde</b>`, 'start');
  const schreiben = !zwei ? '' : missionZeile(m.schreibOffen,
    m.schreibOffen ? `<b>② Schreiben auf Papier</b> · „${esc(kurzTitel(si.offen))}“ · ca. ${esc(si.offen.minuten || 6)} Min.` : '<b>② Schreiben auf Papier</b>',
    'schreiben', m.schreibOffen ? si.offen.id : '');
  if (m.fertig) {
    // Nichts fällig und nichts gemacht (z. B. nach dem Test): wie bisher „Für heute erledigt“, ohne Mission
    if (!m.getan) return `<p class="mission-done">Für heute erledigt ✓</p>${nachMissionHTML(plan)}`;
    return `<div class="mission fertig" role="group" aria-label="Deine Mission heute">
      <p class="mission-done">Mission geschafft ✓</p>
      <div class="mzeilen">${runde}${schreiben}</div>
    </div>${nachMissionHTML(plan)}`;
  }
  const knopf = m.rundeOffen
    ? '<button class="btn go big start" type="button" data-act="start">Start</button>'
    : `<button class="btn go big start" type="button" data-act="schreiben" data-id="${esc(si.offen.id)}">Jetzt schreiben</button>`;
  const klein = !zwei ? ''
    : m.rundeOffen && m.schreibOffen ? 'Sind beide ✓, ist deine Mission geschafft. Reihenfolge, wie du magst.'
    : m.rundeOffen ? 'Noch ①, dann ist deine Mission für heute geschafft.'
    : 'Noch ②, dann ist deine Mission für heute geschafft.';
  return `<div class="mission" role="group" aria-labelledby="mission-titel">
    <div class="eyebrow" id="mission-titel">Deine Mission heute</div>
    <div class="mzeilen">${runde}${schreiben}</div>
    ${knopf}
    ${klein ? `<p class="fineprint">${klein}</p>` : ''}
  </div>`;
}
// Testtag wie bisher: Aufwärmen ist freiwillig, keine Mission, kein Schreibauftrag
function testtagStartHTML(plan) {
  const faellig = plan.aDue.length;
  if (!faellig) return `<p class="mission-done">Für heute erledigt ✓</p>${nachMissionHTML(plan)}`;
  return `<button class="btn go big start" type="button" data-act="start">Aufwärmen</button>
    <p class="mission-line"><b>${faellig}</b> fällig · ca. ${minuten(plan.sek)} Min.</p>`;
}
// Nach der Mission wie bisher: „Morgen bereit“, Extra-Paket, Freies Üben. Passt heute noch Extra unter den Deckel
// (das Kind war schneller als geschätzt), steht es hier zum Weitermachen – freiwillig, die Mission ist geschafft.
function nachMissionHTML(plan) {
  const morgen = morgenBereit();
  const extraAuto = plan.testtag ? 0 : plan.eDue.length + plan.eNeu.length;
  const extra = !extraAuto && extraPaketMoeglich();
  const got = KARTEN.some(c => S.k[c.id]);
  return `${morgen ? `<p class="mission-line">Morgen bereit: <b>${morgen}</b></p>` : ''}
    ${KURZTAGE.has(today()) ? '<p class="fineprint center">Langer Tag, stark durchgezogen. Für heute ist Schluss.</p>' : `
    <div class="two">
      ${extraAuto ? `<button class="btn" type="button" data-act="start">Extra: ${extraAuto} ${extraAuto === 1 ? 'Trank' : 'Tränke'}</button>` : ''}
      ${extra ? `<button class="btn" type="button" data-act="extra">+1 Paket: ${Math.min(MODELL.extraPaket, extraOffeneKarten().length)} Extra</button>` : ''}
      ${got ? '<button class="btn" type="button" data-act="ueben">Freies Üben</button>' : ''}
    </div>
    ${extraAuto ? `<p class="fineprint">Noch Zeit für Extra, ca. ${minuten(plan.sek)} Min. Extra zählt nicht für die Ziellinie.</p>` : ''}
    ${extra ? '<p class="fineprint">Ein Paket kostet heute ca. 3 Min., an den 3 Tagen danach je ca. 1 Min. Extra zählt nicht für die Ziellinie.</p>' : ''}
    ${got ? '<p class="fineprint">Freies Üben füllt nichts. Gewusst zählt morgen, wenn der Trank wieder dran ist.</p>' : ''}`}`;
}
// „+1 Paket“: nur nach fertiger Runde, höchstens einmal am Tag, nicht in den letzten Tagen vor dem Test
function extraPaketMoeglich() {
  if (!extraNeuErlaubt() || !extraOffeneKarten().length) return false;
  if ((S.day.date === today() ? S.day.extra || 0 : 0) >= MODELL.extraProTag) return false;
  const plan = tagesPlan();
  return aOffen(plan) === 0 && !schreibInfo().pflichtOffen && !plan.testtag;
}
// Tippen auf einen Balken: Stand, Tränke des Bereichs, bei der Personenbeschreibung die Schreibaufträge
function bereichSheet(id) {
  const x = zielStand().bereiche.find(y => y.b.id === id);
  if (!x) return;
  const plan = tagesPlan();
  const heute = new Set([...plan.aDue, ...plan.aNeu].map(c => c.id));
  const s = x.stufen;
  const zahlen = `voll ${s[3]} · ⅔ ${s[2]} · ⅓ ${s[1]} · leer ${s[0]}${heute.size ? ` · heute dran ${x.list.filter(c => heute.has(c.id)).length}` : ''}`;
  let schreib = '';
  if (x.papier) {
    schreib = `<h3 class="sheet-sub">Schreib-Tränke (die Hälfte des Balkens)</h3><div class="sw-liste">${TRAENKE.map(tr => {
      const lv = trankStufe(tr.id);
      return `<div class="sw-zeile">${trankHTML(lv, { feder: true })}<span><b>${esc(tr.titel)}</b><small>${esc(trankZustand(tr))}</small></span></div>`;
    }).join('')}</div>`;
  }
  sheet(`<h2 class="sheet-title">${esc(x.b.titel)}</h2>
    ${balkenHTML(x, false)}
    <p class="zteile">${x.prozent} % geschafft · ${esc(zahlen)}</p>
    ${x.sterne ? `<p class="zteile">⭐ ${x.sterne} Stern-Tränke ruhen bis nach der Schularbeit.</p>` : ''}
    ${x.verblasst ? `<p class="fineprint">${x.verblasst} ${x.verblasst === 1 ? 'Trank ist' : 'Tränke sind'} ein bisschen verdunstet. Eine Runde, und ${x.verblasst === 1 ? 'er ist' : 'sie sind'} wieder voll.</p>` : ''}
    ${schreib}
    <div class="regal-brett mini">${brettInhalt(x.b.id)}</div>
    <p class="fineprint">Puffer: Über der Ziellinie verdunsten jeden Tag ein paar Tränke ein bisschen. Deine Runde holt sie zurück.</p>`,
    [{ label: 'Schließen', value: null, cls: 'go' }]);
}

// ---------- Plan-Karte: dieselbe Ampel, die Mama und Papa sehen – im Ton fürs Kind, ohne Rot, ohne Minuten ----------
// Mit Testdatum rechnet die Prognose (legends-status.js) ein paar Zehntelsekunden. Darum: Ergebnis merken,
// solange sich weder der Tag noch der Speicherstand ändert, und sonst erst die Startseite zeigen, dann füllen.
let PLAN = null;   // { key, bericht, urteil }
function planKey() { return today() + '|' + saveCount; }
function planNow() {
  if (PLAN && PLAN.key === planKey()) return PLAN;
  const bericht = STATUS.bericht(berichtEingabe());
  save();   // bericht() trägt fertig, offen und sicher von heute ins Protokoll ein und friert den Plan je Termin ein
  PLAN = { key: planKey(), bericht, urteil: STATUS.urteil(bericht, today()) };
  return PLAN;
}
// Nie darf die Startseite an der Plan-Karte hängen: Jeder Fehler hier lässt nur die Karte weg.
function planSlot() {
  if (!STATUS || !KARTEN.length) return '';
  try {
    if (PLAN && PLAN.key === planKey()) return planHTML(PLAN);
    setTimeout(() => {
      const el = $('#plan');
      if (!el) return;
      try { el.outerHTML = planHTML(planNow()); }
      catch (e) { el.remove(); console.warn('Plan-Karte:', e); }
    }, 30);
    return PLAN ? planHTML(PLAN) : '<div class="panel plan wait" id="plan" aria-hidden="true"></div>';
  } catch (e) {
    console.warn('Plan-Karte:', e);
    return '';
  }
}
// Vorlese-Texte der Tage (Mission = der ganze Tag, Projektleitung 08.11.2026). Der Text der Karte bleibt.
const DAY_STATE = { fertig: 'Mission geschafft', teil: 'angefangen, Mission noch offen', aus: 'nicht geübt', frei: 'nichts fällig', offen: 'noch offen' };
// Stufen der Ampel → Ton der Karte: grün Lime, gelb Sonne, rot = „Notfallplan“ in Orange (nie Rot),
// ohne Test (pause) oder ohne Meldung (unbekannt) neutral grau
const PLAN_TON = { gruen: 'ok', gelb: 'catch', rot: 'sos' };
function planHTML(p) {
  const b = p.bericht, u = p.urteil;
  const tone = PLAN_TON[u.stufe] || 'neutral';
  const t = today(), e = S.log[t] || {};
  const todayState = e.f ? 'fertig' : (e.a || 0) + (e.n || 0) > 0 ? 'teil' : b.heute.faellig + b.heute.neu > 0 ? 'offen' : 'frei';
  const days = b.tage.slice(-6).map(x => ({ d: x.d, s: x.s })).concat({ d: t, s: todayState, today: true });
  const dots = days.map(x => {
    const wd = weekdayOf(x.d);
    const name = x.today ? 'heute' : DAY_SHORT[wd];
    return `<li class="pday ${x.s}${x.today ? ' today' : ''}" aria-label="${x.today ? 'Heute' : WEEKDAYS[wd]}: ${DAY_STATE[x.s] || ''}"><i aria-hidden="true"></i><span aria-hidden="true">${name}</span></li>`;
  }).join('');
  return `<div class="panel plan ${tone}" id="plan">
    <div class="plan-head"><span class="eyebrow">Dein Plan</span><span class="plan-stamp">${esc(u.kind.titel)}</span></div>
    <p class="plan-text">${esc(u.kind.text)}</p>
    <ol class="plan-days" aria-label="Die letzten 7 Tage">${dots}</ol>
    <p class="fineprint">Das sehen Mama und Papa auch.</p>
  </div>`;
}

// ---------- Trank-Regal (erlebnis 2 und 11b) ----------
function regalZahlen() {
  let erarbeitet = 0, sterne = 0;
  for (const c of KARTEN) {
    const st = S.k[c.id];
    if (!st || c.rolle === 'nachschlagen' || stufeZiel(c) < MODELL.sicherAb) continue;
    if (st.s) sterne++; else erarbeitet++;
  }
  return { erarbeitet, sterne };
}
function regalVorschauHTML() {
  const { erarbeitet, sterne } = regalZahlen();
  const proben = KARTEN.filter(c => c.rolle === 'ziel' && S.k[c.id]).slice(-7);
  const glas = proben.length ? proben.map(c => karteTrank(c)).join('') : trankHTML(0) + trankHTML(0) + trankHTML(0);
  return `<span class="rv-traenke">${glas}</span><span class="rv-txt"><b>Dein Trank-Regal</b><small>${erarbeitet} erarbeitet · ${sterne} Sterne</small></span><span class="rv-pfeil" aria-hidden="true">›</span>`;
}
function ritem(c, label) {
  return `<button class="ritem" type="button" data-act="trank" data-id="${esc(c.id)}" aria-label="${esc(label || c.kurz)}: ${esc(fuellText(karteStufe(c)))}">${karteTrank(c)}${label ? `<small>${esc(label)}</small>` : ''}</button>`;
}
// Inhalt eines Bretts: Verben nach Familien, sonst nach Paketen
function brettInhalt(bereichId, rolle = 'ziel') {
  if (VPAKET && bereichId === VPAKET.bereich && rolle === 'ziel') {
    const fams = Object.create(null);
    for (const v of VERBEN) (fams[v.muster] = fams[v.muster] || []).push(v);
    const reihe = [...Object.keys(FAMILIEN).filter(f => fams[f]), ...Object.keys(fams).filter(f => !FAMILIEN[f])];
    const andere = PAKETE.filter(p => p.bereich === bereichId && p !== VPAKET && p.rolle === rolle && p.karten.length);
    return reihe.map(f => {
      const fam = FAMILIEN[f] || { titel: f };
      const voll = fams[f].every(v => verbKarten(v).every(c => karteStufe(c) >= MODELL.sicherAb));
      return `<div class="fam"><div class="fam-kopf"><b>${esc(fam.titel || f)}</b>${voll ? '<span class="fam-voll">komplett ✓</span>' : ''}${fam.merk ? `<small>${esc(fam.merk)}</small>` : ''}</div>
        <div class="ritems">${fams[f].map(v => `<button class="ritem verb" type="button" data-act="trank" data-id="${esc(v.id + '-prae')}" aria-label="${esc(v.inf)}">${verbPhiole(v)}<small>${esc(v.inf)}</small></button>`).join('')}</div></div>`;
    }).join('') + andere.map(paketReihe).join('');
  }
  return PAKETE.filter(p => p.bereich === bereichId && p.rolle === rolle && p.karten.length).map(paketReihe).join('');
}
function paketReihe(p) {
  const kurz = p.karten.length <= 16;
  // Diktat-Karten verraten mit dem Etikett die Schreibweise – erst zeigen, wenn der Trank im Regal ist
  // Lange Etiketten (Fragen von Antipp-Karten) wären abgeschnitten nur verwirrend – dann ohne Etikett
  const etikett = c => (!kurz || c.typ === 'regel' || c.kurz.length > 18 || (c.views && c.views[0].diktat && !S.k[c.id]) ? '' : c.kurz);
  return `<div class="fam"><div class="fam-kopf"><b>${esc(p.titel)}</b></div>
    <div class="ritems">${p.karten.map(c => ritem(c, etikett(c))).join('')}</div></div>`;
}
function regalScreen() {
  screen = 'regal';
  stopFx();
  const { erarbeitet, sterne } = regalZahlen();
  const bretter = BEREICHE.filter(b => KARTEN.some(c => c.bereich === b.id && c.rolle === 'ziel') || (Number(b.papier) > 0 && TRAENKE.length)).map(b => {
    const papier = Number(b.papier) > 0 && TRAENKE.length;
    const schreib = papier ? `<div class="fam"><div class="fam-kopf"><b>Schreib-Tränke</b><small>auf Papier geschrieben, selbst geprüft, hergezeigt</small></div>
      <div class="ritems">${TRAENKE.map(tr => `<button class="ritem schreib" type="button" data-act="schreibtrank" data-id="${esc(tr.id)}">${trankHTML(trankStufe(tr.id), { feder: true, gross: true })}<small>${esc(tr.titel)}</small></button>`).join('')}</div></div>` : '';
    return `<section class="brett"><h2 class="brett-titel outline">${esc(b.titel)}</h2><div class="regal-brett">${schreib}${brettInhalt(b.id)}</div></section>`;
  }).join('');
  const extra = EXTRA_FOLGE.length ? `<section class="brett extra"><h2 class="brett-titel outline">Extra</h2>
    <p class="brett-sub">Zählt nicht für die Ziellinie. Kommt dran, wenn Zeit ist, oder mit „+1 Paket“.</p>
    <div class="regal-brett">${EXTRA_FOLGE.map(paketReihe).join('')}</div>
    ${extraPaketMoeglich() ? `<button class="btn" type="button" data-act="extra">+1 Paket: ${Math.min(MODELL.extraPaket, extraOffeneKarten().length)} Extra-Tränke</button>` : ''}</section>` : '';
  app.innerHTML = `
  <section class="screen regal">
    ${topbar('Trank-Regal')}
    <p class="regal-zahlen"><b>${erarbeitet}</b> erarbeitet · <b>${sterne}</b> Sterne <small>Beide zählen gleich.</small></p>
    ${bretter}
    ${extra}
  </section>`;
}
function trankZustand(tr) {
  const lv = trankStufe(tr.id);
  const a = AUFTRAEGE.filter(x => x.traenke.includes(tr.id));
  const wartet = a.some(x => { const st = S.schreiben.a[x.id]; return st && st.selbst && herzOffen(st); });
  if (lv >= 3) return 'voll: zweimal „Passt“, einmal im ganzen Text';
  if (lv === 2) return 'zwei Drittel: „Passt“ ✓ · im ganzen Text füllst du ihn auf';
  if (lv === 1) return wartet ? 'ein Drittel: wartet aufs Herzeigen' : 'ein Drittel: selbst geprüft';
  return a.length ? `noch leer · Schreibauftrag ab ${dateShort(a[0].ab)}` : 'noch leer';
}
// Tippen auf einen Trank
function trankDetail(id) {
  const c = BY_ID[id];
  if (!c) return;
  const st = S.k[id];
  if (c.typ === 'verb') return verbDetail(c.verb);
  const lv = karteStufe(c);
  let zeile;
  if (!st) zeile = c.rolle === 'nachschlagen' ? 'Zum Nachschlagen. Im freien Üben kannst du ihn ausprobieren.' : c.rolle === 'extra' ? 'Noch leer. Kommt aus dem Extra-Regal, wenn Zeit ist.' : `Noch leer. Kommt ${c.p.ab && c.p.ab > today() ? 'ab ' + dateShort(c.p.ab) : 'bald'} als neuer Trank.`;
  else if (st.s) zeile = `Stern-Trank: Im Blitz-Check am ${dayMonth(st.s)} gewusst. Ruht bis nach der Schularbeit. In der Probe kann er drankommen.`;
  else zeile = `${fuellText(lv)} · ${kartenZustand(c)}`;
  sheet(`<div class="tdetail">${karteTrank(c, { gross: true })}<div><h2 class="sheet-title">${esc(c.typ === 'regel' ? c.p.titel : c.kurz)}</h2><p class="zteile">${esc(zeile)}</p></div></div>
    ${st ? loesungHTML(c) : ''}
    ${st ? `<p class="detail-stats">✓ ${st.ok} · ✗ ${st.bad}${verdunstet(c) ? ' · ein bisschen verdunstet' : ''}</p>` : ''}`,
    [{ label: 'Schließen', value: null, cls: 'go' }]);
}
function verdunstet(c) { const st = S.k[c.id]; return !!st && stufeZiel(c) < st.lv; }
function verbDetail(v) {
  const [a, b] = verbKarten(v);
  const fam = FAMILIEN[v.muster] || {};
  const zeile = (c, was) => {
    const st = c && S.k[c.id];
    if (!st) return `<p class="zteile">${trankHTML(0)} ${was}: noch leer – kommt im Verb-Check</p>`;
    return `<p class="zteile">${karteTrank(c)} ${was}: ${esc(st.s ? 'Stern-Trank, ruht bis nach der Schularbeit' : fuellText(karteStufe(c)) + ' · ' + kartenZustand(c))}</p>`;
  };
  const bekannt = a && b && S.k[a.id] && S.k[b.id];
  sheet(`<h2 class="sheet-title">${esc(v.inf)}</h2>
    ${bekannt ? `<p class="verbreihe">${esc(v.inf)} – ${esc(v.prae.join(' / '))} – ${esc(v.perf.join(' / '))}</p>` : ''}
    ${zeile(a, 'Mitvergangenheit')}${zeile(b, 'Vergangenheit')}
    ${fam.titel ? `<p class="tip">Familie ${esc(fam.titel)}${fam.merk ? ': ' + esc(fam.merk) : ''}</p>` : ''}
    ${bekannt && v.tipp ? `<p class="tip">${fmtText(v.tipp)}</p>` : ''}`,
    [{ label: 'Schließen', value: null, cls: 'go' }]);
}
function kartenZustand(c) {
  const st = S.k[c.id];
  if (!st) return 'noch nicht im Regal';
  if (isDue(c)) return 'heute dran';
  if (st.last === today() && effDue(c) <= today()) return 'heute schon geübt';
  return `wieder dran ${inDays(daysBetween(today(), effDue(c)))}`;
}
// Lösung einer Karte (Trank-Detail). Noch nie gesehene Karten zeigen keine Lösung – sonst wäre der Blitz-Check nichts wert.
function loesungHTML(c) {
  const v = c.views ? c.views[0] : null;
  if (!v) return `<p class="fineprint">Regel-Trank: Jedes Mal kommt ein anderes Beispiel.</p>${c.p.regel ? `<div class="rulebody mini">${regelHTML(c.p.regel)}</div>` : ''}`;
  let h = '';
  if (v.eingabe === 'tippen' && v.typ !== 'luecke') h = `<div class="fz-list">${v.felder.map(f => `<div class="fz ok"><span class="fl">${esc(f.label)}</span><span class="fv">${esc(f.antworten[0])}</span></div>`).join('')}</div>`;
  else if (v.typ === 'luecke') h = `<p class="satz">${satzHTML(v, v.felder.map(f => f.antworten[0]))}</p>`;
  else if (v.typ === 'wahl') h = `<p class="answer-line">→ <b>${esc(v.antworten.join(' / '))}</b>${v.dann ? ` · <b>${esc(v.dann.antworten.join(' / '))}</b>` : ''}</p>`;
  else if (v.typ === 'zuordnen') h = `<ul class="zlist">${v.items.map(it => `<li><b>${esc(it.wort)}</b> → ${esc(it.antwort)}</li>`).join('')}</ul>`;
  else if (v.typ === 'ordnen') h = `<ol class="olist">${v.teile.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
  else if (v.typ === 'markieren') h = `<p class="satz">${markSatzHTML(v, v.soll)}</p>`;
  if (v.tipp) h += `<p class="tip">${fmtText(v.tipp)}</p>`;
  return h;
}

// ---------- Zauberbuch: Regeln, Familien, Wortspeicher, Mustertext, Personen ----------
function wortspeicherHTML() {
  const ws = Array.isArray(SCHREIBEN.wortspeicher) ? SCHREIBEN.wortspeicher : [];
  if (!ws.length) return '<p class="fineprint">Der Wortspeicher kommt noch.</p>';
  const coll = new Intl.Collator('de', { sensitivity: 'base' });
  return ws.map(k => `<div class="ws-kat"><b>${esc(k.kategorie)}</b><p>${(Array.isArray(k.woerter) ? k.woerter.slice().sort(coll.compare) : []).map(esc).join(' · ')}</p></div>`).join('');
}
function mustertextHTML() {
  const m = SCHREIBEN.mustertext;
  if (!m || !Array.isArray(m.absaetze)) return '<p class="fineprint">Der Mustertext kommt noch.</p>';
  return `<div class="muster"><h3>${esc(m.titel || '')}</h3>${m.absaetze.map(a => `<p>${fmtText(a)}</p>`).join('')}</div>`;
}
function personenHTML() {
  const ps = Array.isArray(SCHREIBEN.personen) ? SCHREIBEN.personen : [];
  return ps.map(p => `<div class="ws-kat"><b>${esc(p.name || p.id)}</b><ul>${(p.steckbrief || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('') || '<p class="fineprint">Noch keine Personen.</p>';
}
// Ein Paket hat begonnen, wenn seine Merkkarte gelesen (S.regel) oder eine seiner Karten im Regal ist
function paketBegonnen(p) { return !!S.regel[p.id] || p.karten.some(c => S.k[c.id]); }
// Zauberbuch-Eintrag lesbar: ohne pakete immer, sonst erst, wenn alle genannten (bekannten) Pakete begonnen haben
function zbOffen(r) {
  const ids = Array.isArray(r.pakete) ? r.pakete : [];
  return ids.every(id => !PAKET[id] || paketBegonnen(PAKET[id]));
}
function zauberbuchScreen(tab = 'regeln') {
  screen = 'zauberbuch';
  stopFx();
  const tabs = [['regeln', 'Regeln'], ['familien', 'Familien'], ['wortspeicher', 'Wortspeicher'], ['muster', 'Mustertext'], ['personen', 'Personen']];
  let body = '';
  if (tab === 'regeln') {
    const zb = Array.isArray(STOFF.zauberbuch) && STOFF.zauberbuch.length ? STOFF.zauberbuch
      : PAKETE.filter(p => p.regel).map(p => ({ id: p.id, titel: p.titel, html: p.regel, pakete: [p.id] }));
    // Gesperrt, bis alle Pakete des Eintrags begonnen haben – sonst stünden Antworten von Karten vor ihrem
    // Blitz-Check im Buch (und gewusst heißt Stern bis nach dem Test). Gesperrt = nur der Titel, kein Inhalt im DOM.
    body = zb.map(r => zbOffen(r)
      ? `<details class="panel zb"><summary>${esc(r.titel || r.id)}</summary><div class="rulebody">${regelHTML(r.html)}</div></details>`
      : `<div class="panel zb gesperrt" aria-disabled="true"><p class="zb-titel">${esc(r.titel || r.id)}</p><p class="fineprint">Kommt dran, sobald du damit anfängst.</p></div>`).join('');
  } else if (tab === 'familien') {
    const fams = Object.create(null);
    for (const v of VERBEN) (fams[v.muster] = fams[v.muster] || []).push(v);
    body = Object.keys(fams).sort((a, b) => Object.keys(FAMILIEN).indexOf(a) - Object.keys(FAMILIEN).indexOf(b)).map(f => {
      const fam = FAMILIEN[f] || { titel: f };
      return `<div class="panel zb-fam"><h3>${esc(fam.titel || f)}</h3>${fam.merk ? `<p class="fineprint">${esc(fam.merk)}</p>` : ''}
        <ul class="vliste">${fams[f].map(v => {
          const bekannt = verbKarten(v).every(c => S.k[c.id]);
          return `<li>${bekannt ? `<b>${esc(v.inf)}</b> – ${esc(v.prae.join(' / '))} – ${esc(v.perf.join(' / '))}` : `<b>${esc(v.inf)}</b> <small>kommt im Verb-Check</small>`}</li>`;
        }).join('')}</ul></div>`;
    }).join('');
  } else if (tab === 'wortspeicher') body = `<div class="panel">${wortspeicherHTML()}</div>`;
  else if (tab === 'muster') body = `<div class="panel">${mustertextHTML()}<p class="fineprint">Ein Beispiel. Dein Text darf anders sein.</p></div>`;
  else body = `<div class="panel">${personenHTML()}<p class="fineprint">Erfundene Personen zum Beschreiben.</p></div>`;
  app.innerHTML = `
  <section class="screen zauberbuch">
    ${topbar('Zauberbuch')}
    <div class="chips">${tabs.map(([k, l]) => `<button class="chipbtn ${tab === k ? 'on' : ''}" type="button" data-act="zbTab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${body}
  </section>`;
}

// ---------- Einstellungen ----------
function toggleHTML(key, title, help) {
  return `<label class="toggle">
    <span><b>${title}</b>${help ? `<small>${help}</small>` : ''}</span>
    <input type="checkbox" data-set="${key}" ${S.settings[key] ? 'checked' : ''}>
    <i aria-hidden="true"></i>
  </label>`;
}
function settings() {
  screen = 'settings';
  stopFx();
  const s = S.settings;
  const off = officialTest();
  app.innerHTML = `
  <section class="screen settings">
    ${topbar('Einstellungen')}
    <div class="panel form">
      <label class="field"><b>Name</b>
        <input id="set-name" type="text" maxlength="20" value="${esc(s.name)}" autocomplete="off" autocorrect="off" spellcheck="false">
        <small>Bleibt am Handy. Mama und Papa bekommen nur Zahlen, keinen Namen.</small></label>
      ${off ? `<div class="field"><b>Testdatum</b>
        <span class="daterow"><input id="set-test" type="date" value="${esc(off)}" disabled aria-describedby="set-test-hint"></span>
        <small id="set-test-hint"><b class="lockline">🔒 Termin von Mama/Papa</b>${esc(TEST.titel || 'Schularbeit')} am ${esc(dateLabel(off))}. Bis dahin verteilt die App alles so, dass es sich ausgeht.</small></div>`
      : `<label class="field"><b>Testdatum</b>
        <span class="daterow"><input id="set-test" type="date" value="${esc(s.testDate)}">${s.testDate ? '<button class="link" type="button" data-act="clearTest">löschen</button>' : ''}</span>
        <small>Mit Datum verteilt die App alles rechtzeitig und holt vor dem Test noch einmal heraus, was wackelt.</small></label>`}
      ${toggleHTML('sfx', 'Töne & Vibration', '')}
    </div>
    <button class="btn big" type="button" data-act="about">So funktioniert’s</button>
    <div class="panel form">
      <div class="field"><b>Fortschritt sichern</b>
        <small>Der Code enthält den ganzen Fortschritt. Damit kannst du alles wiederherstellen, z. B. auf einem neuen Handy.</small></div>
      <div class="two"><button class="btn" type="button" data-act="exportCode">Code kopieren</button><button class="btn" type="button" data-act="importCode">Code einfügen</button></div>
    </div>
    <div class="panel form hq">${hqPanelHTML()}</div>
    <button class="btn danger big" type="button" data-act="reset">Fortschritt löschen</button>
    <p class="fineprint center">${esc(APP_NAME)} · ${KARTEN.length} Karten · Version ${esc(VERSION.replace(/^dl-v/, ''))}<span id="set-ver"></span></p>
  </section>`;
  // Version des Offline-Caches (dl-v2 → „Version 2“): Ist sie anders als die der App, kommt gerade ein Update an
  if (window.caches) caches.keys().then(keys => {
    const v = keys.find(k => /^dl-v\d+$/.test(k));
    const el = $('#set-ver');
    if (v && el && v !== VERSION) el.textContent = ` · Offline-Kopie ${v.slice(4)}`;
  }).catch(() => {});
  $('#set-name').addEventListener('change', e => { S.settings.name = e.target.value.trim().slice(0, 20); save(); });
  $('#set-test').addEventListener('change', e => {
    if (officialTest()) return;   // offizieller Termin: nicht verschiebbar
    const v = e.target.value;
    if (v && daysBetween(today(), v) < 0) { toast('Das Datum liegt in der Vergangenheit.'); e.target.value = S.settings.testDate; return; }
    S.settings.testDate = v;
    S.settings.testSince = v ? today() : '';
    save();
    settings();
    if (v) toast(`Test ${inDays(daysBetween(today(), v))} – alles klar!`);
  });
  const hqForm = $('#hq-form');
  if (hqForm) hqForm.addEventListener('submit', e => { e.preventDefault(); hqConnect(); });
  app.querySelectorAll('[data-set]').forEach(el => el.addEventListener('change', () => {
    S.settings[el.dataset.set] = el.checked;
    save();
    if (el.checked && el.dataset.set === 'sfx') { sfx('ok'); haptic(); }
  }));
}

function about() {
  screen = 'about';
  stopFx();
  const kid = S.settings.name ? esc(S.settings.name) : 'Ihr Kind';
  const p = MODELL.pausen.slice(1).join(', ');
  app.innerHTML = `
  <section class="screen about">
    ${topbar('So funktioniert’s', 'home')}
    <div class="panel prose">
      <h2>Kurz gesagt</h2>
      <ul>
        <li><b>Jeden Tag eine Mission:</b> ① die Runde mit deinen Tränken, ② an Schreibtagen ein Schreibauftrag auf Papier. Dazwischen darfst du Pause machen.</li>
        <li><b>Ein Trank steigt höchstens einmal am Tag</b> – und nur, wenn er dran ist. Viel auf einmal bringt nichts, jeden Tag ein bisschen schon.</li>
        <li><b>Blitz-Check:</b> Was du schon kannst, kommt gleich als Stern-Trank ins Regal und ruht bis nach der Schularbeit.</li>
        <li><b>Ziellinie:</b> Sind alle drei Balken über der Linie, bist du bereit. 100 % ist der Bonus.</li>
        <li><b>Fehler sind okay.</b> Du schreibst die richtige Form einmal ab, und der Trank kommt morgen wieder.</li>
      </ul>
    </div>
    <div class="panel prose">
      <h2>Für Eltern: die Methode dahinter</h2>
      <p><b>Abrufen statt Anschauen.</b> Jede Aufgabe verlangt, dass ${kid} die Antwort selbst aus dem Gedächtnis holt (Testing-Effekt).</p>
      <p><b>Verteilte Wiederholung.</b> Stufen mit Pausen von ${esc(p)} Tagen. Nur der erste Versuch des Tages zählt. Im Endspurt (die letzten 3 Tage) kommt noch einmal dran, was seit dem Freitag davor nicht gewusst wurde.</p>
      <p><b>Blitz-Check.</b> Neue Karten werden zuerst abgefragt. Einzelwissen, das sitzt, ruht bis eine Woche nach der Schularbeit; Regeln brauchen noch einen Tag, Antworten zum Antippen zählen nur ein Drittel.</p>
      <p><b>Rechtschreibung genau.</b> Groß- und Kleinschreibung, Umlaute und ß zählen wie in der Schularbeit; Autokorrektur und automatische Großschreibung sind aus. Nach einem Fehler wird die richtige Form einmal abgeschrieben.</p>
      <p><b>Schreiben auf Papier.</b> Die App gibt Auftrag, Bauplan, Wortspeicher und Checkliste. ${kid} schreibt mit der Hand, prüft selbst und zeigt das Blatt dann Ihnen: Zuerst sagen, was gefällt, dann höchstens eine Sache. „Passt“ und Unterschrift füllen den Schreib-Trank. Kein Foto, kein Text im Handy.</p>
      <p><b>Plan-Karte.</b> Auf der Startseite steht, ob ${kid} im Plan ist: dieselbe Ampel wie in Legends HQ, für ${kid} in eigenen Worten und ohne Rot. Mit Verbindungs-Code meldet die App einen kurzen Lagebericht nur mit Zahlen; die Sicherung ist verschlüsselt.</p>
    </div>
  </section>`;
}

// ================================================================
// Abfrage-Runde
// Aufgaben (task.art): regel (Merkkarte eines Pakets) · check (Blitz-Check einer neuen Karte) · vcheck (Verb-Check:
// Tabellenzeile mit zwei Karten) · wdh (fällig, der erste Versuch des Tages zählt für die Stufe) · nochmal (nach
// einem Fehler in derselben Runde, zählt nicht) · ueben (freies Üben, zählt nicht)
// ================================================================
let SES = null;
let E = {};

// Höchstens MODELL.themaFolge Karten desselben Themas hintereinander; sonst bleibt die Reihenfolge
function mischeThema(list) {
  const rest = list.slice(), out = [], k = MODELL.themaFolge;
  while (rest.length) {
    const n = out.length;
    const sperre = n >= k && out.slice(n - k).every(c => c.thema === out[n - 1].thema) ? out[n - 1].thema : null;
    let i = sperre ? rest.findIndex(c => c.thema !== sperre) : 0;
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}
function gruppiere(karten) {
  const out = [];
  for (const c of karten) {
    const x = out.find(y => y.p === c.p);
    if (x) x.karten.push(c); else out.push({ p: c.p, karten: [c] });
  }
  return out;
}
// Neue Pakete: Merkkarte vor der ersten Karte, dann reihum je höchstens 3 Karten eines Pakets (gemischt)
function neuAufgaben(pakete) {
  const reihen = pakete.map(x => ({ p: x.p, karten: x.karten.slice(), start: false }));
  const out = [];
  while (reihen.some(r => r.karten.length)) {
    for (const r of reihen) {
      if (!r.karten.length) continue;
      if (!r.start) { r.start = true; if (r.p.regel && !S.regel[r.p.id]) out.push({ art: 'regel', paket: r.p.id }); }
      out.push(...r.karten.splice(0, MODELL.themaFolge).map(c => ({ id: c.id, art: 'check' })));
    }
  }
  return out;
}
// Tagesrunde: 1 fällige A · 2 neue A (Verb-Check zuerst) · 3 fällige Extra · 4 neue Extra
function rundeAufgaben(plan) {
  const q = [];
  q.push(...mischeThema(plan.aDue).map(c => ({ id: c.id, art: 'wdh' })));
  if (plan.verben.length) {
    if (VPAKET.regel && !S.regel[VPAKET.id]) q.push({ art: 'regel', paket: VPAKET.id });
    // auch beim Verb-Check höchstens 3 derselben Familie hintereinander
    mischeThema(plan.verben.map(v => ({ v, thema: 'v:' + v.muster }))).forEach(x => q.push({ art: 'vcheck', verb: x.v.id }));
  }
  q.push(...neuAufgaben(plan.pakete));
  q.push(...mischeThema(plan.eDue).map(c => ({ id: c.id, art: 'wdh' })));
  q.push(...neuAufgaben(gruppiere(plan.eNeu)));
  return q;
}
// Freies Üben: die wackeligsten Tränke, dazu zwei zum Nachschlagen (C) – füllt nichts
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function uebenAufgaben(n = 10) {
  const score = st => st.bad - st.ok * 0.25;
  const got = KARTEN.filter(c => S.k[c.id] && c.rolle !== 'nachschlagen')
    .sort((a, b) => (S.k[a.id].lv - S.k[b.id].lv) || (score(S.k[b.id]) - score(S.k[a.id])));
  const c3 = shuffle(KARTEN.filter(c => c.rolle === 'nachschlagen')).slice(0, Math.max(2, n - got.length));
  return shuffle([...got.slice(0, n - Math.min(2, c3.length)), ...c3]).slice(0, n).map(c => ({ id: c.id, art: 'ueben' }));
}

function startSession(mode, queue) {
  if (!queue.length) { toast('Gerade gibt es nichts zu üben.'); return home(); }
  refreshStreak();
  SES = {
    mode, queue, cur: null, phase: '', done: 0, first: 0, right: 0, ups: [], collected: [], sterne: 0, ausgebessert: 0,
    zielVorher: zielStand(), sek: 0, halbzeit: false, used: new Set(), scored: new Set(), seg: [], offen: [], check: null,
    hintUsed: false, sel: null, lastFocus: 0
  };
  sessionShell();
  next();
}
function startRunde() {
  const plan = tagesPlan();
  const vorher = missionHeute(plan).fertig;   // war die Mission schon geschafft (z. B. nur noch Extra), heißt es am Ende „Runde geschafft!“
  startSession('runde', rundeAufgaben(plan));
  if (SES) SES.missionVorher = vorher;
}
function startExtra() {
  if (!extraPaketMoeglich()) { toast('Heute gibt es kein Extra-Paket mehr.'); return home(); }
  const karten = extraOffeneKarten().slice(0, MODELL.extraPaket);
  if (S.day.date !== today()) S.day = { date: today(), newCount: 0, extra: 0 };
  S.day.extra = (S.day.extra || 0) + 1;   // gleich beim Start: auch eine abgebrochene Extra-Runde zählt
  save();
  startSession('extra', neuAufgaben(gruppiere(karten)));
}
function startUeben() { startSession('ueben', uebenAufgaben(10)); }

function sessionShell() {
  screen = 'session';
  stopFx();
  document.body.classList.add('in-session');
  // Die Eingabefelder bleiben für die ganze Runde dieselben: So bleibt die Tastatur am iPhone offen.
  const rows = Array.from({ length: MAX_FELDER }, (_, i) => `
      <div class="frow" data-row="${i}" hidden>
        <label class="flabel" for="f${i}"></label>
        <input id="f${i}" class="finput" type="text" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="next">
        <div class="fseg" role="group" hidden></div>
      </div>`).join('');
  app.innerHTML = `
  <section class="session">
    <header class="ses-top">
      <button class="icon-btn" type="button" data-act="quit" aria-label="Runde beenden">✕</button>
      <div class="bar"><i id="ses-bar"></i></div>
      <div class="ses-ziel" id="ses-ziel" title="geschafft"></div>
    </header>
    <div class="ses-label"><span class="chip" id="ses-chip"></span><span class="tools" id="ses-tools"></span></div>
    <div class="ses-cardwrap" id="ses-wrap"><article class="vcard" id="ses-card" aria-live="polite"></article></div>
    <div class="choices" id="ses-choices" hidden></div>
    <form class="answer" id="ses-form" autocomplete="off" novalidate hidden>
      ${rows}
      <div class="kbrow">
        <button class="kbkey keepfocus" type="button" data-act="sz" aria-label="ß einfügen">ß</button>
        <button class="btn go big keepfocus" id="ses-main" type="submit">Prüfen</button>
      </div>
    </form>
    <button class="btn go big" id="ses-pruef" type="button" data-act="pruefen" hidden>Prüfen</button>
    <button class="btn go big" id="ses-next" type="button" data-act="next" hidden>Weiter</button>
  </section>`;
  const all = s => [...app.querySelectorAll(s)];
  E = {
    card: $('#ses-card'), wrap: $('#ses-wrap'), chip: $('#ses-chip'), tools: $('#ses-tools'),
    choices: $('#ses-choices'), form: $('#ses-form'), main: $('#ses-main'), next: $('#ses-next'), pruef: $('#ses-pruef'),
    bar: $('#ses-bar'), ziel: $('#ses-ziel'),
    rows: all('.frow'), labels: all('.flabel'), inputs: all('.finput'), segs: all('.fseg')
  };
  E.form.addEventListener('submit', e => { e.preventDefault(); onSubmit(); });
  E.inputs.forEach((inp, i) => {
    // Ein Feld mit dem Cursor ist nie eingeklappt (z. B. Tastatur in der Rückmeldung zu, dann ein Feld angetippt)
    inp.addEventListener('focus', () => { if (SES) SES.lastFocus = i; E.rows[i].classList.remove('zu'); });
    // Enter springt ins nächste Feld, im letzten wird geprüft; während der Rückmeldung heißt Enter „Weiter“
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !SES) return;
      if (SES.phase === 'feedback') { e.preventDefault(); onSubmit(); return; }
      if (SES.phase !== 'answer' && SES.phase !== 'retype') return;
      const nxt = nextField(i);
      if (nxt >= 0) { e.preventDefault(); focusField(nxt); }
    });
    // Während der Rückmeldung bleibt die Tastatur offen, aber Tippen wird ignoriert;
    // beim Ausbessern lassen sich nur die falschen Felder ändern. Enter (insertLineBreak) nie sperren – sonst
    // schickt das Formular nichts mehr ab.
    inp.addEventListener('beforeinput', e => {
      if (!SES || e.inputType === 'insertLineBreak') return;
      if (SES.phase === 'feedback' || (SES.phase === 'retype' && !SES.offen.includes(i))) e.preventDefault();
    });
  });
  E.ziel.textContent = SES.zielVorher.prozent + ' %';
  SES.zielJetzt = SES.zielVorher.prozent;
  syncViewport();
}
function bar() {
  const total = SES.done + SES.queue.length + (SES.cur ? 1 : 0);
  E.bar.style.width = (total ? SES.done / total * 100 : 100) + '%';
}
// Zielstand oben rechts: springt sichtbar, wenn ein Trank steigt
function zielUpdate() {
  const p = zielStand().prozent;
  E.ziel.textContent = p + ' %';
  if (p > SES.zielJetzt) restartAnim(E.ziel, 'bump');
  SES.zielJetzt = p;
}
// kind: type (Eingabefelder) · choices (Knöpfe) · pruef (Knöpfe + „Prüfen“) · next („Weiter“)
function mode(kind, label) {
  const typing = kind === 'type';
  E.form.hidden = !typing;
  E.choices.hidden = kind !== 'choices' && kind !== 'pruef';
  E.pruef.hidden = kind !== 'pruef';
  E.next.hidden = kind !== 'next';
  E.next.disabled = false;
  if (label) (kind === 'pruef' ? E.pruef : E.next).textContent = label;
  if (typing) focusField(firstField()); else E.inputs.forEach(x => x.blur());
  passend();
}
// Tastatur offen (iPhone): Über der Tastatur ist wenig Platz. Passt die Karte nicht ganz hinein, rückt die Abfrage
// enger zusammen (.eng: doppelter Hinweis und Text links weg, Frage kleiner · .enger: auch das Band · .scrollt: passt
// immer noch nicht, Auftrag und Hinweis rücken nach oben). Wichtige Hinweise (Verb, Ausgangssatz, Kategorie) bleiben
// immer stehen. Nur während der Frage –
// die Rückmeldung darf scrollen und zeigt ihr Band immer.
function passend() {
  const ses = E.wrap && E.wrap.closest('.session');
  if (!ses) return;
  const frage = !!SES && SES.phase === 'answer';
  ses.classList.toggle('rm', !!SES && !frage);   // Rückmeldung: oben nur Kopfzeile (CSS bei offener Tastatur)
  ses.classList.remove('eng', 'enger', 'scrollt');
  if (!document.body.classList.contains('kb') || !frage || E.form.hidden) return;   // nur bei Tipp-Aufgaben
  // offsetHeight statt scrollHeight: Die Pop-Animation vergrößert die Karte kurz (transform) – das zählt hier nicht
  const pad = parseFloat(getComputedStyle(E.wrap).paddingBottom) || 0;
  const passt = () => E.card.offsetHeight + pad <= E.wrap.clientHeight + 1;
  if (passt()) return;
  ses.classList.add('eng');
  if (passt()) return;
  ses.classList.add('enger');
  if (!passt()) ses.classList.add('scrollt');
}
// Rückmeldung bei offener Tastatur: Felder, die nichts mehr brauchen, klappen ein (CSS nur mit body.kb), damit die
// Rückmeldung über der Tastatur Platz hat. Das Feld mit dem Cursor bleibt immer stehen – sonst ginge die Tastatur zu.
function felderEinklappen() {
  const aktiv = document.activeElement;
  E.rows.forEach((row, i) => row.classList.toggle('zu', !row.hidden && !SES.offen.includes(i) && !row.contains(aktiv)));
  passend();
}
function fieldVisible(i) { return !E.rows[i].hidden && !E.inputs[i].hidden; }
function firstField() {
  for (let i = 0; i < E.inputs.length; i++) if (fieldVisible(i) && (SES.phase !== 'retype' || SES.offen.includes(i))) return i;
  return -1;
}
function nextField(i) {
  for (let j = i + 1; j < E.inputs.length; j++) if (fieldVisible(j) && (SES.phase !== 'retype' || SES.offen.includes(j))) return j;
  return -1;
}
function focusField(i) {
  const f = E.inputs[i];
  if (!f || !fieldVisible(i)) return;
  try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
}
// ß-Knopf über der Tastatur (am iPhone sonst langes Drücken auf s)
function szEinfuegen() {
  if (!SES || (SES.phase !== 'answer' && SES.phase !== 'retype')) return;
  let i = E.inputs.indexOf(document.activeElement);
  if (i < 0) i = SES.lastFocus;
  const inp = E.inputs[i];
  if (!inp || !fieldVisible(i) || (SES.phase === 'retype' && !SES.offen.includes(i))) return;
  const a = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
  const b = inp.selectionEnd == null ? a : inp.selectionEnd;
  inp.setRangeText('ß', a, b, 'end');
  focusField(i);
  sfx('tap');
}
// Felder einrichten: getippt oder angetippt (wahl, z. B. hat/ist). layout: Klasse am Formular (Verbzeile)
function setFields(felder, layout = '') {
  SES.seg = [];
  E.form.className = 'answer' + (layout ? ' ' + layout : felder.length >= 3 ? ' viele' : '') + (felder.length >= 5 ? ' sehrviele' : '');
  const typed = felder.map((f, i) => (f.wahl ? -1 : i)).filter(i => i >= 0);
  E.rows.forEach((row, i) => {
    const f = felder[i];
    row.hidden = !f;
    row.classList.remove('nolabel', 'zu');
    if (!f) return;
    const inp = E.inputs[i], seg = E.segs[i];
    E.labels[i].textContent = f.label;
    row.classList.toggle('nolabel', !f.label);
    inp.value = '';
    inp.className = 'finput';
    inp.placeholder = f.label ? '' : 'Lücke …';
    inp.setAttribute('enterkeyhint', i === typed[typed.length - 1] ? 'go' : 'next');
    if (f.wahl) {
      inp.hidden = true;
      seg.hidden = false;
      seg.innerHTML = f.wahl.map(v => `<button type="button" class="segbtn keepfocus" data-act="seg" data-i="${i}" data-v="${esc(v)}">${esc(v)}</button>`).join('');
    } else {
      inp.hidden = false;
      seg.hidden = true;
      seg.innerHTML = '';
    }
  });
}
function segWahl(b) {
  if (!SES || SES.phase !== 'answer') return;
  const i = +b.dataset.i;
  SES.seg[i] = b.dataset.v;
  E.segs[i].querySelectorAll('.segbtn').forEach(x => x.classList.toggle('on', x === b));
  sfx('tap');
  const nxt = nextField(i);
  if (nxt >= 0) focusField(nxt);
}

function next() {
  if (!SES) return;
  if (SES.cur) SES.done++;
  SES.cur = null;
  // Halbzeit: nach etwa 10 Minuten einmal fragen, ob eine Pause gut tut (erlebnis 11c)
  if (SES.mode === 'runde' && !SES.halbzeit && SES.sek >= MODELL.halbzeit && SES.queue.length >= 3) {
    SES.halbzeit = true;
    return halbzeit();
  }
  if (!SES.queue.length) return finish();
  SES.cur = SES.queue.shift();
  const t = SES.cur;
  if (t.art === 'vcheck' ? !VERB[t.verb] : t.art !== 'regel' && !BY_ID[t.id]) return next();   // Stoff geändert
  taskStart = Date.now();
  showTask();
}
async function halbzeit() {
  E.inputs.forEach(x => x.blur());
  const n = SES.ups.length + SES.collected.length;
  const v = await sheet(`<h2 class="sheet-title">Halbzeit!</h2><p>${n} ${n === 1 ? 'Trank ist' : 'Tränke sind'} schon gestiegen oder neu im Regal. Kurz Pause oder weiter?</p><p class="fineprint">Die Runde wartet auf dich.</p>`,
    [{ label: 'Weiter', value: 'weiter', cls: 'go' }, { label: 'Pause – später weiter', value: 'pause' }]);
  if (!SES) return;
  if (v === 'pause') return beenden();
  next();
}
function zeit(s) { if (SES) SES.sek += Math.min(60, s || 0); }

// Welche Darstellung kommt dran? Regel-Karte: ein anderes Beispiel als beim letzten Mal, in einer Runde keines doppelt.
// Einzelkarte mit Varianten: Wiederholungen wechseln der Reihe nach, der Blitz-Check nimmt die Karte selbst.
function waehleView(t, c) {
  const st = S.k[c.id];
  if (c.typ === 'regel') {
    const frei = x => !SES.used.has(x.id) && !(st && st.b === x.id);
    let pool = c.pool.filter(frei);
    if (t.art === 'check' && c.klasse === 'auswahl') { const k = pool.filter(x => x.optionen); if (k.length) pool = k; }
    if (!pool.length) pool = c.pool.filter(x => !(st && st.b === x.id));
    if (!pool.length) pool = c.pool;
    const v = pool[Math.floor(Math.random() * pool.length)];
    SES.used.add(v.id);
    return v;
  }
  if (t.art === 'check' || c.views.length === 1) return c.views[0];
  if (t.art === 'ueben') return c.views[Math.floor(Math.random() * c.views.length)];
  return c.views[((st && st.v) || 0) % c.views.length];
}
// als/wie (Klasse Auswahl): im Blitz-Check zwei Knöpfe, in den Wiederholungen getippt (bauauftrag 1)
function mitKnoepfen(t, c, v) { return !!v.optionen && (t.art === 'check' || c.klasse !== 'auswahl'); }

function showTask() {
  const t = SES.cur;
  SES.phase = 'answer';
  SES.hintUsed = false;
  SES.check = null;
  SES.offen = [];
  SES.seg = [];
  SES.sel = null;
  bar();
  E.choices.innerHTML = '';
  E.choices.className = 'choices';
  E.tools.innerHTML = '';
  E.main.textContent = 'Prüfen';
  E.pruef.disabled = false;   // Ordnen sperrt „Prüfen“, bis alles gelegt ist – für die nächste Aufgabe wieder frei
  E.wrap.scrollTop = 0;
  if (t.art === 'regel') return showRegel(t);
  if (t.art === 'vcheck') return showVerbCheck(t);
  const c = BY_ID[t.id];
  t.v = t.v || waehleView(t, c);
  const v = t.v;
  if (v.eingabe === 'tippen') return mitKnoepfen(t, c, v) ? showWahl(t, c, v) : showTippen(t, c, v);
  if (v.eingabe === 'wahl') return showWahl(t, c, v);
  if (v.eingabe === 'mehrfach') return showMehrfach(t, c, v);
  if (v.eingabe === 'zuordnen') return showZuordnen(t, c, v);
  if (v.eingabe === 'ordnen') return showOrdnen(t, c, v);
  if (v.eingabe === 'markieren') return showMarkieren(t, c, v);
}

// ---------- Bausteine der Karten ----------
function kopfBand(t, c) {
  if (t.art === 'check' || t.art === 'vcheck') return `<div class="band new"><span>Blitz-Check</span><span>${esc(c ? c.bereichKurz : 'Verben')}</span></div>`;
  if (t.art === 'nochmal') return `<div class="band again"><span>Noch einmal</span><span>${esc(c.bereichKurz)}</span></div>`;
  if (t.art === 'ueben') return `<div class="band practice"><span>Freies Üben</span><span>${esc(c.bereichKurz)}</span></div>`;
  const lv = karteStufe(c);
  return `<div class="band tier f${Math.min(3, lv)}${lv >= MAX_STUFE ? ' glueht' : ''}"><span>${karteTrank(c)} ${esc(stufeText(lv))}</span><span>${esc(c.bereichKurz)}</span></div>`;
}
const CHIP = { tippen: 'Schreib die Antwort.', luecke: 'Was fehlt?', wahl: 'Was passt?', zuordnen: 'Wohin gehört das?', ordnen: 'Bring in die richtige Reihenfolge.', markieren: 'Markiere die Wortarten.' };
function chipText(t, v, knoepfe) {
  if (t.art === 'check') return 'Kennst du das schon?';
  if (v.typ === 'verb') return v.form === 'prae' ? 'Mitvergangenheit (Präteritum)' : 'Vergangenheit (Perfekt)';
  return v.frage || (knoepfe ? 'Was passt in die Lücke?' : CHIP[v.typ] || '');
}
// Lückensatz; gefuellt = Antworten, die in den Lücken stehen sollen (sonst leere Lücken – immer gleich breit,
// damit die Länge nichts über die Schreibweise verrät)
function satzHTML(v, gefuellt) {
  let gi = 0;
  return v.teile.map(p => {
    if (typeof p === 'string') return fmtText(p);
    const i = gi++;
    if (gefuellt && gefuellt[i] != null) return `<b class="filled">${esc(gefuellt[i])}</b>`;
    return '<span class="gap"></span>';
  }).join('');
}
function promptHTML(v, t) {
  const frage = t && t.art === 'check' && v.frage ? `<div class="qhint">${esc(v.frage)}</div>` : '';
  if (v.typ === 'verb') return `<div class="q">${esc(v.wort)}</div><div class="qhint zusatz">${v.form === 'prae' ? 'Mitvergangenheit: er …' : 'Vergangenheit: er hat … oder er ist …'}</div>`;
  if (v.typ === 'luecke') return `${frage}<p class="satz">${satzHTML(v)}</p>${v.hinweis ? `<div class="qhint">${esc(v.hinweis)}</div>` : ''}`;
  if (v.typ === 'tippen') {
    if (v.diktat) return `${frage}<button class="speak keepfocus" type="button" data-act="vorlesen">🔊 Anhören</button>${v.hinweis ? `<div class="qhint">${esc(v.hinweis)}</div>` : ''}`;
    return `${frage}<div class="q">${fmtText(v.wort)}</div>${v.hinweis ? `<div class="qhint">${esc(v.hinweis)}</div>` : ''}`;
  }
  if (v.typ === 'wahl') return `${frage}${v.text ? `<div class="q sm">${fmtText(v.text)}</div>` : ''}`;
  return frage;
}
function toolsHTML(t, c, v) {
  const tools = [];
  if (t.art === 'check') tools.push('<button class="tool keepfocus" type="button" data-act="idk">Kenn ich noch nicht</button>');
  else {
    if (t.art === 'wdh' && c && c.typ === 'verb') tools.push('<button class="tool keepfocus" type="button" data-act="hilfe">Familie anzeigen</button>');
    else if (t.art === 'wdh' && (v.hilfe || (c && c.hilfe))) tools.push('<button class="tool keepfocus" type="button" data-act="hilfe">💡 Tipp</button>');
    if (v.eingabe === 'tippen' && !mitKnoepfen(t, c, v)) tools.push('<button class="tool keepfocus" type="button" data-act="idk">Weiß nicht</button>');
  }
  E.tools.innerHTML = tools.join('');
}

// ---------- Merkkarte eines Pakets ----------
function showRegel(t) {
  const p = PAKET[t.paket];
  E.chip.textContent = 'Neue Regel – lies sie dir kurz durch';
  E.card.innerHTML = `<div class="band rule"><span>${esc(p.titel)}</span><span>${esc(BEREICH[p.bereich].kurz)}</span></div><div class="cbody rulebody">${regelHTML(p.regel)}</div>`;
  restartAnim(E.card, 'pop');
  mode('next', 'Verstanden – los geht’s');
}

// ---------- Tippen (Felder, Lückensatz, Verbform) ----------
function showTippen(t, c, v) {
  E.chip.textContent = chipText(t, v, false);
  E.card.innerHTML = kopfBand(t, c) + `<div class="cbody">${promptHTML(v, t)}</div>`;
  restartAnim(E.card, 'pop');
  toolsHTML(t, c, v);
  setFields(v.felder, v.typ === 'verb' && v.form === 'perf' ? 'verbzeile2' : '');
  mode('type');
  if (v.diktat) vorlesen(v.wort);   // Diktat: wort wird vorgelesen, nicht gezeigt (stoff.js)
}
// ---------- Verb-Check: Tabellenzeile Nennform → Mitvergangenheit · hat/ist + 2. Mittelwort ----------
function showVerbCheck(t) {
  const v = VERB[t.verb];
  E.chip.textContent = 'Kennst du die schon?';
  E.card.innerHTML = `<div class="band new"><span>Blitz-Check</span><span>Verben</span></div><div class="cbody"><div class="q">${esc(v.inf)}</div><div class="qhint zusatz">Mitvergangenheit (er …) und Vergangenheit (er hat/ist …)</div></div>`;
  restartAnim(E.card, 'pop');
  E.tools.innerHTML = '<button class="tool keepfocus" type="button" data-act="idk">Kenn ich noch nicht</button>';
  setFields([{ label: 'Mitvergangenheit' }, { label: 'hat oder ist', wahl: ['hat', 'ist'] }, { label: '2. Mittelwort' }], 'verbzeile3');
  mode('type');
}

function onSubmit() {
  if (!SES || !SES.cur) return;
  if (SES.phase === 'feedback') return next();
  if (SES.phase === 'retype') return retype();
  if (SES.phase !== 'answer') return;
  const t = SES.cur;
  if (t.art === 'vcheck') {
    const vals = [E.inputs[0].value, SES.seg[1] || '', E.inputs[2].value];
    const leer = [0, 2].find(i => !normDE(vals[i]));
    if (leer != null) { shake(E.inputs[leer]); return focusField(leer); }
    if (!vals[1]) return shake(E.segs[1]);
    return verbCheckAntwort(t, vals);
  }
  const c = BY_ID[t.id], v = t.v;
  if (!c || v.eingabe !== 'tippen') return;
  const vals = v.felder.map((f, i) => (f.wahl ? (SES.seg[i] || '') : E.inputs[i].value));
  const leer = v.felder.findIndex((f, i) => !normDE(vals[i]));
  if (leer >= 0) {
    if (v.felder[leer].wahl) shake(E.segs[leer]);
    else { shake(E.inputs[leer]); focusField(leer); }
    return;
  }
  antwort(t, c, pruefeView(v, vals), {});
}
function idk() {
  if (!SES || SES.phase !== 'answer' || !SES.cur) return;
  const t = SES.cur;
  if (t.art === 'vcheck') return verbCheckAntwort(t, ['', '', ''], true);
  const c = BY_ID[t.id], v = t.v;
  antwort(t, c, pruefeView(v, v.eingabe === 'tippen' ? v.felder.map(() => '') : []), { idk: true });
}

// Ergebnis einer Aufgabe verbuchen und die Rückmeldung zeigen. r = pruefeView(...)
function antwort(t, c, r, info) {
  const good = r.res === 'ok';
  let res = good ? 'ok' : 'falsch';
  if (good && SES.hintUsed) res = 'bleibt';
  const erg = { res, sched: null, check: null };
  // „N von M beim ersten Mal gewusst“: Wiederholungen nach einem Fehler zählen nicht mit
  if (t.art !== 'nochmal') {
    SES.first++;
    if (good) SES.right++;
  }
  S.stats.answers++;
  if (good) S.stats.right++;
  if (t.art === 'check') {
    if (!S.k[c.id]) {
      // Blitz-Check (bauauftrag 4): einzel → voll mit Stern · regel → ⅔ · auswahl → ⅓ · falsch → ⅓ und Lernschritt
      if (good) {
        const lv = c.klasse === 'einzel' ? MODELL.sicherAb : c.klasse === 'regel' ? 2 : 1;
        collect(c, lv, { check: true, gewusst: true, stern: c.klasse === 'einzel' });
        if (c.klasse === 'einzel') SES.sterne++;
      } else collect(c, 1, { check: true, gewusst: false });
      if (c.typ === 'regel') S.k[c.id].b = t.v.id;
      SES.collected.push(c.id);
      zeit(logNew());
      erg.check = good ? c.klasse : 'neu';
    } else zeit(logTime());
    if (!good && c.klasse !== 'einzel') nochmal(t, c);   // Regel/Auswahl falsch: Lernschritt wie bei einem Fehler
  } else if (t.art === 'wdh' && S.k[c.id] && !SES.scored.has(c.id)) {
    SES.scored.add(c.id);
    const st = S.k[c.id];
    erg.sched = review(c, res);
    if (good) st.ok++; else if (res === 'falsch') st.bad++;
    if (c.typ === 'regel') st.b = t.v.id;
    if (c.views && c.views.length > 1) st.v = ((st.v || 0) + 1) % c.views.length;
    zeit(logAnswer(good));
    if (erg.sched.to > erg.sched.from) SES.ups.push({ id: c.id, from: erg.sched.from, to: erg.sched.to });
    if (!good) nochmal(t, c);
  } else {
    zeit(logTime());
    if (t.art === 'nochmal' && !good) nochmal(t, c);
  }
  save();
  if (v_istTippen(t, c)) feedbackTippen(t, c, r, erg, info);
  else feedbackTippbar(t, c, r, erg, info);
  zielUpdate();
}
function v_istTippen(t, c) { return t.v && t.v.eingabe === 'tippen' && !mitKnoepfen(t, c, t.v); }
// Fehler: nach mindestens 5 anderen Karten noch einmal, bis einmal richtig (höchstens 3 Mal)
function nochmal(t, c) {
  const re = (t.re || 0) + 1;
  if (re > MODELL.nochmalMax) return;
  push({ id: c.id, art: 'nochmal', re, v: t.v }, MODELL.nochmalAbstand);
}
// Aufgabe weiter hinten einreihen – nie zwischen eine Merkkarte und die erste Karte ihres Pakets
function push(task, offset) {
  let i = Math.min(offset, SES.queue.length);
  while (i > 0 && i < SES.queue.length && SES.queue[i - 1].art === 'regel') i++;
  SES.queue.splice(i, 0, task);
}

// Verb-Check: jede Form zählt für ihre Karte (einzel: gewusst → voll mit Stern; nicht gewusst → ⅓ und kurzer
// Lernschritt: richtige Form zeigen, einmal abschreiben, kein Nachfragen in der Runde)
function verbCheckAntwort(t, vals, weissNicht) {
  const v = VERB[t.verb];
  const [cPrae, cPerf] = verbKarten(v);
  const rPrae = [pruefeVerbPrae(v, vals[0])];
  const rPerf = pruefeVerbPerf(v, vals[1], vals[2]);
  const ergebnis = [];
  for (const [c, felder] of [[cPrae, rPrae], [cPerf, rPerf]]) {
    if (!c) continue;
    const ok = felder.every(f => f.ok);
    SES.first++;
    S.stats.answers++;
    if (ok) { SES.right++; S.stats.right++; }
    if (!S.k[c.id]) {
      collect(c, ok ? MODELL.sicherAb : 1, { check: true, gewusst: ok, stern: ok });
      SES.collected.push(c.id);
      if (ok) SES.sterne++;
    }
    ergebnis.push({ c, ok });
  }
  zeit(logNew());
  if (cPerf && S.k[cPerf.id] && S.k[cPerf.id].since === today()) STATUS && STATUS.zaehleNeu(S.log, today(), 0);   // zwei Karten gesammelt
  save();
  feedbackVerbCheck(t, v, rPrae[0], rPerf, ergebnis, !!weissNicht);
  zielUpdate();
}

// ---------- Rückmeldung (erlebnis 11d): Sitzt! · Schau genau (Stelle markiert) · So geht's · Fast! (nur ordnen) ----------
// Jede Rückmeldung endet mit der richtigen Form; die falsche Eingabe wird nie gezeigt.
function bandHTML(cls, title, rechts) {
  return `<div class="band ${cls}"><span>${esc(title)}</span><span>${rechts || ''}</span></div>`;
}
function weitWeg(x) { return !x.leer && x.art === 'wort' && dist(normDE(x.eingabe), normFrage(x.richtig)) > Math.max(2, String(x.richtig).length / 2); }
// Strategie-Satz je Fehlerart: Karte vor stoff.js (fallen, tipps) vor Standard
function strategie(x, c, v) {
  const verb = c && c.typ === 'verb' ? c.verb : null;
  const arten = (verb && verb.fallen) || [];
  const a = x.art;
  if (!a || a === 'alt' || a === 'wahl') return '';
  if (a === 'andere') return x.note || TIPPS.andere;
  if (verb) {
    // einfaches s: der Tipp des Verbs dazu, wenn er das s erklärt („las mit einem s …“)
    if (a === 'einfachS') return TIPPS.einfachS + (verb.tipp && /\bs\b/.test(verb.tipp) ? ' ' + verb.tipp : '');
    if (FALLEN[a]) return FALLEN[a];
    if (a === 'hilfsverb' && arten.includes('ist') && FALLEN.ist) return FALLEN.ist;
    if (a === 'schwach') return `${TIPPS.schwach} ${verbReihe(verb)}`;
    if (a === 'h' || a === 'wort') return verb.tipp || '';
    return TIPPS[a] || verb.tipp || '';
  }
  const eigene = (v && v.tipps && v.tipps[a]) || (c && c.tipps && c.tipps[a]);
  return eigene || TIPPS[a] || '';
}
function verbReihe(v) { return `${v.inf} – ${v.prae[0]} – ${v.perf[0]}`; }
function familienAnker(v) {
  const fam = FAMILIEN[v.muster];
  if (!fam || v.muster === 'einzeln') return '';
  const anderes = VERBEN.find(x => x.muster === v.muster && x !== v && verbKarten(x).every(c => S.k[c.id] && S.k[c.id].lv >= 2))
    || VERBEN.find(x => x.muster === v.muster && x !== v);
  return `Familie ${fam.titel}${anderes ? `: wie ${verbReihe(anderes)}` : ''}.`;
}
// Zeile unter der Rückmeldung: was mit dem Trank passiert
function trankZeile(t, c, erg, good) {
  const st = S.k[c.id];
  if (erg.check) {
    if (erg.check === 'einzel') return '<p class="sched up">⭐ Schon gekonnt! Ein Stern-Trank. Er ruht bis nach der Schularbeit.</p>';
    if (erg.check === 'regel') return `<p class="sched up">Gewusst! Zwei Drittel. ${istEndspurt() ? 'Morgen' : 'In zwei Tagen'} noch einmal, dann ist er voll.</p>`;
    if (erg.check === 'auswahl') return `<p class="sched up">Gewusst! Ein Drittel. ${t.v && t.v.optionen ? 'Ab morgen schreibst du die Antwort selbst.' : 'Morgen noch einmal.'}</p>`;
    return '<p class="sched">Neu im Regal: ein Drittel. Morgen kommt er wieder.</p>';
  }
  const s = erg.sched;
  if (s) {
    const d = inDays(daysBetween(today(), effDue(c)));
    if (s.to > s.from) {
      if (s.to >= MAX_STUFE) return '<p class="sched up">Er glüht! Den hast du richtig drauf.</p>';
      if (s.to === MODELL.sicherAb) return '<p class="sched up">Voll! Den hast du dir erarbeitet.</p>';
      if (s.to === 2) return '<p class="sched up">Steigt! Zwei Drittel. Noch einmal, dann ist er voll.</p>';
      return `<p class="sched up">Bleibt voll. Wieder dran ${d}.</p>`;
    }
    if (s.to < s.from) return `<p class="sched down">Auf ${s.to === 1 ? 'ein Drittel' : s.to === 2 ? 'zwei Drittel' : 'voll'} gesunken. Morgen füllst du ihn wieder auf.</p>`;
    if (erg.res === 'bleibt') return '<p class="sched">Mit Hilfe gewusst. Der Trank bleibt, wie er ist. Morgen ohne Hilfe.</p>';
    return `<p class="sched">${good ? `Wieder dran ${d}.` : 'Bleibt, wie er ist. Morgen kommt er wieder.'}</p>`;
  }
  if (t.art === 'nochmal' && good) return '<p class="sched up">Jetzt sitzt es. Morgen kommt er wieder.</p>';
  if (t.art === 'ueben' && good) return '<p class="sched">Gewusst! Das zählt morgen, wenn er wieder dran ist.</p>';
  if (t.art === 'wdh' && st && st.last === today() && SES.scored.has(c.id) && !s) return '';
  return '';
}
function feldZeile(f, x, nurRichtig) {
  const label = `<span class="fl">${esc(f.label || 'Lücke')}</span>`;
  if (x.ok) return `<div class="fz ok">${label}<span class="fv">${esc(x.richtig)} <em aria-label="richtig">✓</em></span></div>`;
  let fix;
  if (x.liste) fix = x.liste.soll.map(w => (x.liste.fehlt.includes(w) ? `<mark>${esc(w)}</mark>` : esc(w))).join(', ');
  else fix = x.leer || f.wahl || nurRichtig || x.art === 'andere' || weitWeg(x) ? esc(x.richtig) : diffMark(x.eingabe, x.richtig);
  return `<div class="fz bad">${label}<span class="fv"><span class="fix">${fix}</span></span></div>`;
}
function feedbackEnde(good, erg) {
  E.wrap.scrollTop = 0;
  restartAnim(E.card, good ? 'pop' : 'nudge');
  E.tools.innerHTML = '';
  bar();
  const s = erg && erg.sched;
  if (erg && erg.check === 'einzel') sfx('pling');
  else if (s && s.to === MODELL.sicherAb && s.from < s.to) sfx('plopp');
  else if (s && s.to > s.from) sfx('blub');
  else sfx(good ? 'ok' : 'bad');
  haptic();
}
// Getippte Antworten: je Feld richtig (✓) oder die richtige Form mit markierter Stelle, dann Strategie, dann die
// falschen Felder einmal richtig abschreiben – so endet jede Aufgabe mit der richtigen Form
function feedbackTippen(t, c, r, erg, info) {
  const v = t.v, good = r.res === 'ok';
  const felder = v.felder;
  SES.check = r;
  SES.offen = felder.map((f, i) => (!r.felder[i].ok && !f.wahl ? i : -1)).filter(i => i >= 0);
  const needRetype = SES.offen.length > 0;
  SES.phase = needRetype ? 'retype' : 'feedback';
  const leer = r.felder.every(x => x.leer || x.ok) || info.idk;
  const daneben = r.felder.some(weitWeg);
  let cls, titel;
  if (good) { cls = erg.res === 'bleibt' ? 'almost' : 'good'; titel = erg.res === 'bleibt' ? 'Mit Hilfe gewusst' : erg.check === 'einzel' ? 'Schon gekonnt!' : erg.check ? 'Gewusst!' : 'Sitzt!'; }
  else if (t.art === 'check' && (leer || info.idk)) { cls = 'sogehts'; titel = 'Neu für dich? So geht’s'; }
  else if (leer || daneben) { cls = 'sogehts'; titel = 'So geht’s'; }
  else { cls = 'almost'; titel = 'Schau genau'; }
  let body = v.typ === 'luecke'
    ? `<p class="satz">${satzHTML(v, felder.map((f, i) => r.felder[i].richtig))}</p>`
    : v.diktat ? '' : `<div class="q sm">${fmtText(v.wort)}</div>`;
  const zeilen = felder.map((f, i) => (v.typ === 'luecke' && r.felder[i].ok ? '' : feldZeile(f, r.felder[i]))).join('');
  if (zeilen) body += `<div class="fz-list">${zeilen}</div>`;
  const notes = [...new Set(r.felder.map(x => x.note).filter(Boolean))];
  body += notes.map(n => `<p class="note">${esc(n)}</p>`).join('');
  if (!good) {
    const st = [...new Set(r.felder.filter(x => !x.ok).map(x => strategie(x, c, v)).filter(Boolean))];
    body += st.map(s => `<p class="note">💡 ${esc(s)}</p>`).join('');
    // Familien-Anker – außer beim einfachen s: ein Vorbild wie „aß“ würde dort nur verwirren
    if (c.typ === 'verb') {
      const a = r.felder.some(x => x.art === 'einfachS') ? '' : familienAnker(c.verb);
      if (a) body += `<p class="tip">${esc(a)}</p>`;
    }
    else if (v.tipp && !st.includes(v.tipp)) body += `<p class="tip">${fmtText(v.tipp)}</p>`;
  } else if (c.typ === 'verb') {
    body += `<p class="tip">${esc(verbReihe(c.verb))}${erg.check || (S.k[c.id] && S.k[c.id].ok <= 2) ? ' · Sag’s halblaut mit.' : ''}</p>`;
  }
  body += trankZeile(t, c, erg, good);
  if (needRetype) body += `<p class="retype">Schreib ${SES.offen.length === 1 ? 'die richtige Form' : 'die richtigen Formen'} einmal ab:</p>`;
  E.card.innerHTML = bandHTML(cls, titel, S.k[c.id] ? karteTrank(c) : '') + `<div class="cbody">${body}</div>`;
  feedbackEnde(good, erg);
  felder.forEach((f, i) => {
    const x = r.felder[i];
    if (f.wahl) {
      E.segs[i].querySelectorAll('.segbtn').forEach(b => {
        b.classList.remove('on');
        if (b.dataset.v === x.richtig) b.classList.add('right');
        else if (b.dataset.v === SES.seg[i]) b.classList.add('wrong');
      });
      return;
    }
    const inp = E.inputs[i];
    if (x.ok) inp.className = 'finput good';
    else { inp.value = ''; inp.placeholder = x.richtig; inp.className = 'finput retype'; }
  });
  E.main.textContent = needRetype ? 'Prüfen' : 'Weiter';
  focusField(needRetype ? SES.offen[0] : firstField());
  felderEinklappen();
}
function feedbackVerbCheck(t, v, xPrae, xPerf, ergebnis, weissNicht) {
  const fx = [xPrae, xPerf[0], xPerf[1]];
  const labels = [{ label: 'Mitvergangenheit' }, { label: 'hat oder ist', wahl: true }, { label: '2. Mittelwort' }];
  SES.check = { felder: fx };
  SES.offen = [0, 2].filter(i => !fx[i].ok);
  const good = ergebnis.every(e => e.ok);
  SES.phase = SES.offen.length ? 'retype' : 'feedback';
  const leer = weissNicht || fx.every(x => x.leer || x.ok);
  const cls = good ? 'good' : leer ? 'sogehts' : 'almost';
  const titel = good ? 'Schon gekonnt!' : leer ? 'Neu für dich? So geht’s' : ergebnis.some(e => e.ok) ? 'Halb gekonnt' : 'Schau genau';
  let body = `<div class="q sm">${esc(v.inf)}</div><div class="fz-list">${fx.map((x, i) => (i === 1 && x.ok && fx[2].ok ? '' : feldZeile(labels[i], x))).join('')}</div>`;
  const notes = [...new Set(fx.map(x => x.note).filter(Boolean))];
  body += notes.map(n => `<p class="note">${esc(n)}</p>`).join('');
  const st = [...new Set(fx.filter(x => !x.ok && !x.leer).map(x => strategie(x, BY_ID[v.id + '-prae'], null)).filter(Boolean))];
  body += st.map(s => `<p class="note">💡 ${esc(s)}</p>`).join('');
  body += `<p class="tip">${esc(verbReihe(v))} · Sag’s halblaut mit.</p>`;
  const zeile = (e, was) => e.ok ? `<p class="sched up">⭐ ${was}: Stern-Trank, ruht bis nach der Schularbeit.</p>` : `<p class="sched">${was}: neu im Regal, ein Drittel. Morgen kommt sie wieder.</p>`;
  ergebnis.forEach((e, i) => { body += zeile(e, i === 0 ? 'Mitvergangenheit' : 'Vergangenheit'); });
  if (SES.offen.length) body += `<p class="retype">Schreib ${SES.offen.length === 1 ? 'die richtige Form' : 'die richtigen Formen'} einmal ab:</p>`;
  E.card.innerHTML = bandHTML(cls, titel, `<span class="dphiole">${ergebnis.map(e => karteTrank(e.c)).join('')}</span>`) + `<div class="cbody">${body}</div>`;
  feedbackEnde(good, { check: good ? 'einzel' : 'neu' });
  if (ergebnis.some(e => e.ok)) setTimeout(() => sfx('pling'), 200);
  E.segs[1].querySelectorAll('.segbtn').forEach(b => {
    b.classList.remove('on');
    if (b.dataset.v === fx[1].richtig) b.classList.add('right');
    else if (b.dataset.v === SES.seg[1]) b.classList.add('wrong');
  });
  [0, 2].forEach(i => {
    const inp = E.inputs[i], x = fx[i];
    if (x.ok) inp.className = 'finput good';
    else { inp.value = ''; inp.placeholder = x.richtig; inp.className = 'finput retype'; }
  });
  E.main.textContent = SES.offen.length ? 'Prüfen' : 'Weiter';
  focusField(SES.offen.length ? SES.offen[0] : firstField());
  felderEinklappen();
}
// Abschreiben: genau die gezeigte richtige Form (bei Listen: alle Teile, Reihenfolge egal)
function retype() {
  const r = SES.check;
  const noch = [];
  for (const i of SES.offen) {
    const x = r.felder[i];
    const val = E.inputs[i].value;
    const ok = x.liste ? pruefeListe(normDE(val), { antworten: [x.richtig] }).ok : gleich(val, x.richtig);
    E.inputs[i].className = 'finput ' + (ok ? 'good' : 'retype');
    if (!ok) { noch.push(i); shake(E.inputs[i]); }
  }
  SES.offen = noch;
  if (!noch.length) { SES.ausgebessert++; sfx('tap'); zeit(logTime()); save(); return next(); }
  focusField(noch[0]);
  felderEinklappen();
}

// ---------- Antippen: eine Antwort (wahl, Lücke mit Knöpfen), mit „dann“ ein zweiter Schritt ----------
function showWahl(t, c, v) {
  const luecke = v.typ === 'luecke';
  E.chip.textContent = chipText(t, v, luecke);
  E.card.innerHTML = kopfBand(t, c) + `<div class="cbody">${promptHTML(v, t)}</div>`;
  restartAnim(E.card, 'pop');
  toolsHTML(t, c, v);
  SES.sel = { schritt: 0, werte: [] };
  wahlKnoepfe(luecke ? v.optionen : v.optionen, luecke || v.fest);
  mode('choices');
}
function wahlKnoepfe(opts, fest) {
  const o = fest ? opts : shuffle(opts);
  E.choices.className = 'choices' + (o.length > 2 && o.every(x => String(x).length <= 14) ? ' grid2' : o.length === 2 ? ' grid2' : '');
  E.choices.innerHTML = o.map(x => `<button class="btn choice" type="button" data-act="choice" data-v="${esc(x)}">${esc(x)}</button>`).join('');
}
function onChoice(btn) {
  if (!SES || !SES.cur) return;
  const t = SES.cur, c = BY_ID[t.id], v = t.v;
  if (SES.phase === 'lern') return lernTipp(btn);
  if (SES.phase !== 'answer') return;
  if (v.eingabe === 'zuordnen') return zuordnenWahl(btn);
  const sel = SES.sel;
  sel.werte[sel.schritt] = btn.dataset.v;
  sfx('tap');
  if (v.dann && sel.schritt === 0) {
    // zweiter Schritt auf derselben Karte; gelöst nur, wenn beide stimmen
    sel.schritt = 1;
    // neutral: ob Schritt 1 stimmt, zeigt erst die Rückmeldung
    E.card.querySelector('.cbody').insertAdjacentHTML('beforeend', `<p class="schritt">Gewählt: <b>${esc(btn.dataset.v)}</b></p><div class="qhint">${esc(v.dann.frage || 'Und jetzt?')}</div>`);
    wahlKnoepfe(v.dann.optionen, v.dann.fest);
    return;
  }
  const r = v.typ === 'luecke' ? pruefeView(v, [sel.werte[0]]) : pruefeView(v, sel.werte);
  antwort(t, c, r, { werte: sel.werte.slice() });
}
// Rückmeldung für alles Angetippte (wahl, mehrfach, zuordnen, ordnen, markieren, Lücke mit Knöpfen)
function feedbackTippbar(t, c, r, erg, info) {
  const v = t.v, good = r.res === 'ok';
  SES.phase = 'feedback';
  const fast = !good && r.fast;
  const cls = good ? (erg.res === 'bleibt' ? 'almost' : 'good') : fast ? 'almost' : 'sogehts';
  const titel = good ? (erg.res === 'bleibt' ? 'Mit Hilfe gewusst' : erg.check === 'einzel' ? 'Schon gekonnt!' : erg.check ? 'Gewusst!' : 'Sitzt!')
    : fast ? 'Fast!' : t.art === 'check' ? 'Neu für dich? So geht’s' : 'So geht’s';
  let body = '';
  if (v.typ === 'luecke') body = `<p class="satz">${satzHTML(v, [v.felder[0].antworten[0]])}</p>`;
  else if (v.eingabe === 'wahl') {
    body = `${v.text ? `<div class="q sm">${fmtText(v.text)}</div>` : v.frage ? `<div class="qhint">${esc(v.frage)}</div>` : ''}
      <p class="answer-line">${good ? '' : 'Richtig: '}<b>${esc(good ? r.felder[0].richtig : v.antworten.join(' oder '))}</b>${v.dann ? ` · <b>${esc(good ? r.felder[1].richtig : v.dann.antworten.join(' oder '))}</b>` : ''}</p>`;
  } else if (v.eingabe === 'mehrfach') {
    body = `${v.frage ? `<div class="qhint">${esc(v.frage)}</div>` : ''}<ul class="mlist">${r.felder.map(x => {
      if (x.soll && x.hat) return `<li class="ok">✓ ${esc(x.option)}</li>`;
      if (x.soll) return `<li class="fehlt">＋ ${esc(x.option)} <small>gehört dazu</small></li>`;
      if (x.hat) return `<li class="weg">– ${esc(x.option)} <small>gehört nicht dazu</small></li>`;
      return '';
    }).join('')}</ul>`;
  } else if (v.eingabe === 'zuordnen') {
    body = `<ul class="zlist">${v.items.map((it, i) => `<li class="${r.felder[i].ok ? 'ok' : 'bad'}">${r.felder[i].ok ? '✓' : '→'} <b>${esc(it.wort)}</b> → ${esc(it.antwort)}</li>`).join('')}</ul>`;
  } else if (v.eingabe === 'ordnen') {
    body = `<ol class="olist">${v.teile.map((x, i) => `<li class="${r.felder[i].ok ? 'ok' : 'bad'}">${esc(x)}</li>`).join('')}</ol>`;
    if (fast) {
      const falsch = r.felder.map((f, i) => (f.ok ? -1 : i)).filter(i => i >= 0);
      body = `<p class="note">Fast! Nur ${esc(v.teile[falsch[1]])} und ${esc(v.teile[falsch[0]])} sind vertauscht.</p>` + body;
    }
  } else if (v.eingabe === 'markieren') {
    body = `<p class="satz">${markSatzHTML(v, v.soll, r.felder)}</p>${markLegende(v)}`;
  }
  if (!good && v.tipp) body += `<p class="tip">${fmtText(v.tipp)}</p>`;
  body += trankZeile(t, c, erg, good);
  // Lernschritt bei einer einzelnen Antwort: die richtige einmal antippen (statt abschreiben)
  const lern = !good && (v.eingabe === 'wahl' || v.typ === 'luecke') && !v.dann && E.choices.querySelector('.choice');
  if (lern) body += '<p class="retype">Tipp die richtige Antwort einmal an.</p>';
  E.card.innerHTML = bandHTML(cls, titel, S.k[c.id] ? karteTrank(c) : '') + `<div class="cbody">${body}</div>`;
  feedbackEnde(good, erg);
  if (lern) {
    SES.phase = 'lern';
    const richtig = v.typ === 'luecke' ? v.felder[0].antworten : v.antworten;
    E.choices.querySelectorAll('.choice').forEach(b => {
      b.disabled = false;
      b.classList.toggle('wrong', info.werte && b.dataset.v === info.werte[0]);
      b.classList.toggle('hint', richtig.includes(b.dataset.v));
    });
    mode('choices');
  } else {
    E.choices.querySelectorAll('.choice').forEach(b => { b.disabled = true; });
    mode('next', 'Weiter');
  }
}
function lernTipp(btn) {
  const v = SES.cur.v;
  const richtig = v.typ === 'luecke' ? v.felder[0].antworten : v.antworten;
  if (!richtig.includes(btn.dataset.v)) { shake(btn); return; }
  btn.classList.add('right');
  sfx('tap');
  SES.phase = 'feedback';
  SES.ausgebessert++;
  setTimeout(() => { if (SES && SES.phase === 'feedback') next(); }, 350);
}

// ---------- Mehrere antippen ----------
function showMehrfach(t, c, v) {
  E.chip.textContent = chipText(t, v);
  const hinweis = /alle richtigen/i.test(v.frage) ? '' : '<p class="qhint">Tippe alle richtigen an.</p>';   // steht oft schon in der Frage
  E.card.innerHTML = kopfBand(t, c) + `<div class="cbody">${promptHTML(v, t)}${hinweis}</div>`;
  restartAnim(E.card, 'pop');
  toolsHTML(t, c, v);
  SES.sel = new Set();
  const o = v.fest ? v.optionen : shuffle(v.optionen);
  E.choices.className = 'choices' + (o.every(x => String(x).length <= 14) ? ' grid3' : '');
  E.choices.innerHTML = o.map(x => `<button class="btn choice toggle-c" type="button" data-act="mtoggle" data-v="${esc(x)}" aria-pressed="false">${esc(x)}</button>`).join('');
  mode('pruef', 'Prüfen');
}
function mToggle(b) {
  if (!SES || SES.phase !== 'answer') return;
  const x = b.dataset.v;
  if (SES.sel.has(x)) SES.sel.delete(x); else SES.sel.add(x);
  b.classList.toggle('on', SES.sel.has(x));
  b.setAttribute('aria-pressed', String(SES.sel.has(x)));
  sfx('tap');
}

// ---------- Zuordnen: Wort für Wort eine Gruppe antippen ----------
function showZuordnen(t, c, v) {
  E.chip.textContent = chipText(t, v);
  toolsHTML(t, c, v);
  SES.sel = { i: 0, ant: [] };
  zuordnenItem();
  mode('choices');
}
function zuordnenItem() {
  const t = SES.cur, c = BY_ID[t.id], v = t.v, z = SES.sel, it = v.items[z.i];
  const dots = v.items.map((_, k) => `<i class="${k < z.i ? 'done' : k === z.i ? 'cur' : ''}"></i>`).join('');
  E.card.innerHTML = kopfBand(t, c) + `<div class="cbody"><div class="zprog" aria-label="Wort ${z.i + 1} von ${v.items.length}">${dots}</div><div class="q">${fmtText(it.wort)}</div></div>`;
  if (z.i === 0) restartAnim(E.card, 'pop');
  E.choices.className = 'choices' + (v.optionen.length > 2 && v.optionen.every(o => String(o).length <= 14) ? ' grid2' : '');
  E.choices.innerHTML = v.optionen.map(o => `<button class="btn choice" type="button" data-act="choice" data-v="${esc(o)}">${esc(o)}</button>`).join('');
}
function zuordnenWahl(btn) {
  const t = SES.cur, c = BY_ID[t.id], v = t.v, z = SES.sel;
  z.ant.push(btn.dataset.v);
  sfx('tap');
  z.i++;
  if (z.i < v.items.length) return zuordnenItem();
  antwort(t, c, pruefeView(v, z.ant), {});
}

// ---------- Ordnen: der Reihe nach antippen, Antippen in der Reihe nimmt es wieder heraus ----------
function showOrdnen(t, c, v) {
  E.chip.textContent = chipText(t, v);
  toolsHTML(t, c, v);
  let gemischt = shuffle(v.teile);
  for (let k = 0; k < 5 && gemischt.every((x, i) => x === v.teile[i]); k++) gemischt = shuffle(v.teile);   // nie schon richtig
  SES.sel = { reihe: [], pool: gemischt };
  ordnenZeigen(true);
  mode('pruef', 'Prüfen');
}
function ordnenZeigen(neu) {
  const t = SES.cur, c = BY_ID[t.id], v = t.v, s = SES.sel;
  const slots = v.teile.map((_, i) => s.reihe[i] != null
    ? `<button class="oslot full" type="button" data-act="oraus" data-i="${i}"><span>${i + 1}</span>${esc(s.reihe[i])}</button>`
    : `<div class="oslot"><span>${i + 1}</span></div>`).join('');
  E.card.innerHTML = kopfBand(t, c) + `<div class="cbody">${promptHTML(v, t)}<div class="oslots">${slots}</div></div>`;
  if (neu) restartAnim(E.card, 'pop');
  E.choices.className = 'choices ordnen';
  E.choices.innerHTML = s.pool.map((x, i) => `<button class="btn choice" type="button" data-act="orein" data-i="${i}">${esc(x)}</button>`).join('');
  E.pruef.disabled = s.reihe.length !== v.teile.length;
}
function ordnenRein(b) {
  if (!SES || SES.phase !== 'answer') return;
  const s = SES.sel;
  s.reihe.push(s.pool.splice(+b.dataset.i, 1)[0]);
  sfx('tap');
  ordnenZeigen();
}
function ordnenRaus(b) {
  if (!SES || SES.phase !== 'answer') return;
  const s = SES.sel;
  s.pool.push(...s.reihe.splice(+b.dataset.i, 1));
  ordnenZeigen();
}

// ---------- Markieren: Wortart wählen, dann die Wörter antippen ----------
const MARK_FARBE = ['m1', 'm2', 'm3', 'm4'];
function markSatzHTML(v, gruppen, felder) {
  return v.tokens.map((tk, i) => {
    const g = gruppen[i] || '';
    const k = g ? MARK_FARBE[v.gruppenNamen.indexOf(g)] || 'm4' : '';
    const falsch = felder && !felder[i].ok;
    return `<span class="mwort ${k}${falsch ? ' falsch' : ''}">${esc(tk.text)}</span>`;
  }).join(' ');
}
function markLegende(v) {
  return `<p class="mlegende">${v.gruppenNamen.map((g, i) => `<span class="mwort ${MARK_FARBE[i] || 'm4'}">${esc(g)}</span>`).join(' ')}</p>`;
}
function showMarkieren(t, c, v) {
  E.chip.textContent = chipText(t, v);
  toolsHTML(t, c, v);
  SES.sel = { gruppe: v.gruppenNamen[0], werte: v.tokens.map(() => '') };
  markZeigen(true);
  mode('pruef', 'Prüfen');
}
function markZeigen(neu) {
  const t = SES.cur, c = BY_ID[t.id], v = t.v, s = SES.sel;
  const woerter = v.tokens.map((tk, i) => {
    const g = s.werte[i];
    const k = g ? MARK_FARBE[v.gruppenNamen.indexOf(g)] || 'm4' : '';
    return `<button class="mwort tap ${k}" type="button" data-act="mwort" data-i="${i}">${esc(tk.text)}</button>`;
  }).join(' ');
  E.card.innerHTML = kopfBand(t, c) + `<div class="cbody">${promptHTML(v, t)}<p class="msatz">${woerter}</p><p class="qhint">Wörter, die zu keiner Gruppe gehören, bleiben weiß.</p></div>`;
  if (neu) restartAnim(E.card, 'pop');
  E.choices.className = 'choices mgruppen';
  E.choices.innerHTML = v.gruppenNamen.map((g, i) => `<button class="btn choice ${MARK_FARBE[i] || 'm4'} ${s.gruppe === g ? 'on' : ''}" type="button" data-act="mgruppe" data-g="${esc(g)}">${esc(g)}</button>`).join('');
}
function markWort(b) {
  if (!SES || SES.phase !== 'answer') return;
  const s = SES.sel, i = +b.dataset.i;
  s.werte[i] = s.werte[i] === s.gruppe ? '' : s.gruppe;
  sfx('tap');
  markZeigen();
}
function markGruppe(b) {
  if (!SES || SES.phase !== 'answer') return;
  SES.sel.gruppe = b.dataset.g;
  markZeigen();
}
// „Prüfen“ bei mehrfach, ordnen, markieren
function pruefenTippbar() {
  if (!SES || SES.phase !== 'answer' || !SES.cur) return;
  const t = SES.cur, c = BY_ID[t.id], v = t.v, s = SES.sel;
  let eingabe;
  if (v.eingabe === 'mehrfach') {
    if (!s.size) return shake(E.choices);
    eingabe = [...s];
  } else if (v.eingabe === 'ordnen') {
    if (s.reihe.length !== v.teile.length) return shake(E.choices);
    eingabe = s.reihe.slice();
  } else if (v.eingabe === 'markieren') eingabe = s.werte.slice();
  else return;
  antwort(t, c, pruefeView(v, eingabe), {});
}

// ---------- Hilfe: Tipp oder „Familie anzeigen“ – die Stufe bleibt, morgen wieder ----------
function hilfe() {
  if (!SES || SES.phase !== 'answer' || SES.hintUsed || !SES.cur) return;
  const t = SES.cur, c = BY_ID[t.id], v = t.v;
  let text = '';
  if (c.typ === 'verb') {
    const fam = FAMILIEN[c.verb.muster];
    // „eigenes Muster“: Ein anderes Verb dieser Gruppe hilft nicht weiter, darum kein Beispiel
    const anderes = c.verb.muster === 'einzeln' ? null : VERBEN.find(x => x.muster === c.verb.muster && x !== c.verb);
    text = fam ? `Familie ${fam.titel}${fam.merk ? ': ' + fam.merk : ''}${anderes ? `. Wie ${verbReihe(anderes)}.` : '.'}` : 'Eigenes Muster.';
  } else text = v.hilfe || c.hilfe || '';
  if (!text) return;
  SES.hintUsed = true;
  E.card.querySelector('.cbody').insertAdjacentHTML('beforeend', `<p class="hilfe">💡 ${fmtText(text)}</p>`);
  const b = E.tools.querySelector('[data-act="hilfe"]');
  if (b) b.disabled = true;
  if (!E.form.hidden) focusField(firstField());
}

async function quit() {
  if (!SES) return home();
  const s = SES;
  E.inputs.forEach(x => x.blur());
  const choice = await sheet('<h2 class="sheet-title">Runde beenden?</h2><p>Alles, was du bis jetzt geübt hast, ist gespeichert. Den Rest machst du später.</p>',
    [{ label: 'Weiterüben', value: 'stay', cls: 'go' }, { label: 'Beenden', value: 'quit' }]);
  if (choice !== 'quit') {
    if (SES === s && !E.form.hidden) focusField(SES.phase === 'retype' ? SES.offen[0] : firstField());
    return;
  }
  beenden();
}
function beenden() {
  const s = SES;
  if (!s) return home();
  if (s.first >= 10) { markDay(); save(); }
  if (s.done > 0 || s.first > 0) afterRound();
  home();
}
function finish() {
  const s = SES;
  E.inputs.forEach(x => x.blur());
  SES = null;
  document.body.classList.remove('in-session');
  const streakUp = markDay();
  S.stats.sessions++;
  save();
  afterRound();
  summary(s, { streakUp });
}

// ---------- Rundenende (erlebnis 3): „54 % → 61 %“, Zähler, Parade, Morgen bereit, Lob fürs Vorgehen ----------
function lobFuer(s) {
  if (s.ausgebessert >= 3) return `${s.ausgebessert} Fehler gleich ausgebessert, so bleibt’s hängen.`;
  if (S.stats.streak >= 5) return `${S.stats.streak} Tage am Stück. Das ist Dranbleiben.`;
  if (s.sterne >= 5) return `${s.sterne} Stern-Tränke auf einmal. Dein Vorwissen hält.`;
  if (s.ausgebessert >= 1) return 'Fehler gleich ausgebessert – genau so lernt dein Kopf.';
  return 'Jeden Tag ein bisschen – genau so bleibt’s im Kopf.';
}
function summary(s, extra) {
  screen = 'summary';
  $('#toast').classList.remove('show');
  const z = zielStand();
  const vorher = s.zielVorher;
  const neu = meilensteine(z);
  save();
  const morgen = morgenBereit();
  const plan = tagesPlan();
  const si = schreibInfo();
  // Tagesrunde fertig (nicht am Testtag): Ist ② noch offen, ist erst Etappe 1 von 2 geschafft – das steht gleich unter
  // der Überschrift, mit dem Weg zum Schreibauftrag, und unten heißt es „Pause“ statt „Fertig“. Kein Konfetti für die
  // Mission. Freies Üben, Extra-Paket und Testtag wie bisher.
  const m = missionHeute(plan, si);
  const tagesrunde = s.mode === 'runde' && !plan.testtag && !m.rundeOffen;
  const etappe1 = tagesrunde && m.schreibOffen;
  const title = s.mode === 'ueben' ? 'Gut geübt!' : s.mode === 'extra' ? 'Extra-Paket geschafft!'
    : etappe1 ? 'Etappe 1 von 2 geschafft!' : tagesrunde && !s.missionVorher ? 'Mission geschafft!' : 'Runde geschafft!';
  const altP = x => (vorher.bereiche.find(y => y.b.id === x.b.id) || { prozent: 0 }).prozent;
  const ueber = z.bereiche.filter(x => x.prozent >= ZIELLINIE && altP(x) < ZIELLINIE);   // in dieser Runde über die Linie
  // Je Trank eine Karte; ein Verb (zwei Formen = zwei Karten) nur einmal, als Doppel-Phiole
  const parade = (items, label) => {
    const gesehen = new Set();
    const karten = items.map(it => BY_ID[it.id]).filter(c => {
      if (!c) return false;
      const key = c.verb ? 'verb:' + c.verb.id : c.id;
      if (gesehen.has(key)) return false;
      gesehen.add(key);
      return true;
    });
    return karten.length ? `
    <h2 class="sub">${label}</h2>
    <div class="parade">${karten.slice(0, 12).map((c, i) => `<div class="pcard" style="--d:${i * 70}ms">${c.verb ? verbPhiole(c.verb) : karteTrank(c)}<b>${esc(c.typ === 'regel' ? c.p.titel : c.kurz)}</b></div>`).join('')}</div>` : '';
  };
  let meldung = '';
  if (neu.perfekt) meldung = '<p class="meilenstein holo">Alle Tränke voll, perfekt! Das ist selten, weil jeden Tag ein paar verdunsten.</p>';
  else if (neu.bereit) meldung = '<p class="meilenstein gold">BEREIT! Alle drei Balken sind über der Ziellinie. Neuer Titel: Spell Legend.</p>';
  else if (neu.titel) meldung = `<p class="meilenstein">Neuer Titel: ${esc(neu.titel)}.</p>`;
  else if (ueber.length) meldung = `<p class="meilenstein">${esc(ueber[0].b.titel)} ${istSind(ueber[0].b.titel)} über der Ziellinie!</p>`;
  const noch2 = etappe1 ? `<div class="panel mission-sum">
      <p class="mstand"><span class="ok">✓ ① Runde</span> · <span>○ ② Schreiben auf Papier</span></p>
      <p>Jetzt noch ②: Schreibauftrag „${esc(kurzTitel(si.offen))}“, ca. ${esc(si.offen.minuten || 6)} Min. Dann ist deine Mission für heute geschafft.</p>
      <div class="two"><button class="btn go" type="button" data-act="schreiben" data-id="${esc(si.offen.id)}">Jetzt schreiben</button><button class="btn" type="button" data-act="home">Pause</button></div>
    </div>` : '';
  app.innerHTML = `
  <section class="screen summary">
    <h1 class="outline hero center">${title}</h1>
    ${noch2}
    ${meldung}
    <div class="panel zsum">
      <div class="eyebrow">geschafft</div>
      <div class="zsum-zahlen">${z.prozent !== vorher.prozent ? `<span>${vorher.prozent} %</span><b aria-hidden="true">→</b>` : ''}<span class="neu">${z.prozent} %</span>${stempelHTML(z)}</div>
      <div class="zrows">${z.bereiche.map(x => {
        const alt = altP(x);
        return balkenHTML({ ...x, prozent: alt }, false).replace(`style="width:${alt}%"`, `style="width:${alt}%" data-ziel="${x.prozent}"`);
      }).join('')}</div>
      ${s.mode === 'ueben'
        ? '<p class="fineprint">Freies Üben füllt nichts. Gewusst zählt morgen, wenn der Trank wieder dran ist.</p>'
        : morgen ? `<p>Morgen bereit: <b>${morgen}</b></p>` : ''}
    </div>
    <p class="zaehler">${s.right} von ${s.first} beim ersten Mal gewusst · ${s.ups.length} ${s.ups.length === 1 ? 'Trank' : 'Tränke'} gestiegen · ${s.collected.length} neu im Regal${s.sterne ? ` · ⭐ ${s.sterne}` : ''}</p>
    ${s.mode !== 'ueben' ? `<p class="lob">${esc(lobFuer(s))}</p>` : ''}
    ${parade(s.ups.map(u => ({ id: u.id })), 'Gestiegen')}
    ${parade(s.collected.filter((id, i, a) => a.indexOf(id) === i).map(id => ({ id })), 'Neu im Regal')}
    <button class="btn ${etappe1 ? '' : 'go'} big" type="button" data-act="home">${etappe1 ? 'Pause' : 'Fertig'}</button>
  </section>`;
  // Balken laufen vom alten auf den neuen Stand (bei reduzierter Bewegung gleich der Endstand)
  setTimeout(() => app.querySelectorAll('.zsum [data-ziel]').forEach(i => {
    const p = +i.dataset.ziel;
    i.style.width = p + '%';
    const row = i.closest('.zrow');
    if (!row) return;
    row.querySelector('.zpct').textContent = p + ' %';
    row.classList.toggle('over', p >= ZIELLINIE);
    const rest = row.querySelector('.zrest');
    if (rest) { rest.textContent = p >= ZIELLINIE ? 'bereit' : `noch ${ZIELLINIE - p} %`; rest.classList.toggle('ok', p >= ZIELLINIE); }
  }), 120);
  if (neu.bereit || neu.titel || neu.perfekt) { confetti(); sfx('level'); }
  else if (s.mode !== 'ueben') sfx('blub'); else sfx('tap');
}

// ================================================================
// Schreiben auf Papier (bauauftrag 6, erlebnis 4 und 11): Auftrag → Bauplan, Bausteine, Wortspeicher → auf Papier
// schreiben (ruhiger Bildschirm, keine Uhr) → selbst prüfen mit der Checkliste (alles abgehakt → Trank ⅓) →
// Herzeigen bei Mama oder Papa („Passt“ → ⅔, „Morgen nochmal“ → bleibt ⅓, morgen kurz ausbessern) → Schreibmappe.
// Voll = zweites „Passt“ an einem anderen Tag in einem ganzen Text, bei dem der Wortspeicher beim Schreiben zu war.
// Kein Foto, kein Text im Handy; an den Server gehen nur Zahlen.
// S.schreiben.a[auftrag] = { person, start, fertig (geschrieben), haken: [..], selbst (selbst geprüft), dauer (Min.),
//   rate ('erkannt'|'nicht'), herz: [{ tag, teile: { trank: 'passt'|'nochmal' }, punkt: { trank: Frage } }],
//   aus (ausgebessert am), ausN (Zahl der Herzeigen-Einträge beim Ausbessern),
//   passtNicht: [..] (seit dl-v5, parallel zu haken: bedingter Punkt „passt hier nicht“; fehlt in älteren Ständen) }
// haken und passtNicht hängen am Index der Checkliste: Die Zahl der Punkte je Teil darf sich darum nie ändern.
// S.schreiben.t[trank] = { lv (0–3), passt: [Tage mit „Passt“] }
// ================================================================
let SW = null;   // laufender Schreibauftrag { a, schritt, fragen }
function aStand(a) { return S.schreiben.a[a.id] || null; }
function aStandNeu(a) { return (S.schreiben.a[a.id] = S.schreiben.a[a.id] || { person: '', start: '', fertig: '', haken: [], passtNicht: [], selbst: '', herz: [], aus: '' }); }
function kurzTitel(a) {
  if (!a) return '';
  const t = String(a.titel || '');
  const m = t.match(/:\s*(.+)$/);
  return m ? m[1] : a.traenke.map(id => TRANK[id].titel).join(', ');
}
function letztesHerz(st) { return st && Array.isArray(st.herz) && st.herz.length ? st.herz[st.herz.length - 1] : null; }
function hatNochmal(h) { return !!h && Object.values(h.teile || {}).includes('nochmal'); }
// Herzeigen offen: noch nie hergezeigt, oder nach „Morgen nochmal“ inzwischen ausgebessert (ausN = Zahl der
// Herzeigen-Einträge beim Ausbessern: So zählt nur ein Ausbessern nach dem letzten „Morgen nochmal“)
function herzOffen(st) {
  if (!st || !st.selbst) return false;
  const h = letztesHerz(st);
  if (!h) return true;
  return hatNochmal(h) && st.ausN === st.herz.length;
}
// Ausbessern offen: „Morgen nochmal“ von einem früheren Tag, danach noch nicht ausgebessert
function ausOffen(st) {
  const h = letztesHerz(st);
  return !!h && hatNochmal(h) && h.tag < today() && st.ausN !== st.herz.length;
}
function schreibInfo() {
  const pt = planTag(), t = today();
  const aktiv = AUFTRAEGE.filter(a => a.ab <= pt);
  const offen = aktiv.filter(a => !(aStand(a) || {}).selbst);
  const heuteGeprueft = AUFTRAEGE.filter(a => (aStand(a) || {}).selbst === t);
  return {
    offen: offen[0] || null,
    pflichtOffen: !!offen[0] && !heuteGeprueft.length && !istTesttag(),   // ein Schreibauftrag am Tag zählt für die Mission
    heuteGeprueft,
    herz: AUFTRAEGE.filter(a => herzOffen(aStand(a))),
    aus: AUFTRAEGE.filter(a => ausOffen(aStand(a)))
  };
}
// Unter dem Kasten „Deine Mission heute“, ohne Nummer und ohne ○: Herzeigen und Ausbessern gehören nicht zur
// Mission. Dazu wie bisher ein Schreibauftrag, der heute nicht mehr Pflicht ist (heute schon einer geprüft, etwa
// beim Nachholen): freiwillig, damit das Kind aufholen kann.
function schreibPanelHTML(plan) {
  if (!AUFTRAEGE.length) return '';
  const si = schreibInfo();
  const teile = [];
  for (const a of si.herz) teile.push(`<button class="btn neben" type="button" data-act="herzeigen" data-id="${esc(a.id)}"><b>Herzeigen:</b> „${esc(kurzTitel(a))}“ · dein Blatt für Mama oder Papa, 1 Min.</button>`);
  for (const a of si.aus) teile.push(`<button class="btn neben" type="button" data-act="ausbessern" data-id="${esc(a.id)}"><b>Ausbessern:</b> „${esc(kurzTitel(a))}“ · ca. 3 Min.</button>`);
  if (si.offen && !si.pflichtOffen) {
    const begonnen = (aStand(si.offen) || {}).start;
    teile.push(`<button class="btn neben" type="button" data-act="schreiben" data-id="${esc(si.offen.id)}"><b>${begonnen ? 'Weiterschreiben' : 'Nächster Schreibauftrag'}:</b> „${esc(kurzTitel(si.offen))}“ · du darfst ihn auch jetzt schon schreiben</button>`);
  }
  if (!teile.length) return '';
  return `<div class="panel schreib-panel">${teile.join('')}</div>`;
}
function schreibTrankDetail(id) {
  const tr = TRANK[id];
  if (!tr) return;
  const a = AUFTRAEGE.filter(x => x.traenke.includes(id));
  sheet(`<div class="tdetail">${trankHTML(trankStufe(id), { feder: true, gross: true })}<div><h2 class="sheet-title">${esc(tr.titel)}</h2><p class="zteile">${esc(trankZustand(tr))}</p></div></div>
    <ul class="sw-geschichte">${a.map(x => {
      const st = aStand(x);
      const h = letztesHerz(st);
      const was = !st || !st.selbst ? (x.ab > today() ? `ab ${dateShort(x.ab)}` : 'noch offen') : !h ? 'geschrieben, wartet aufs Herzeigen'
        : (h.teile || {})[id] === 'passt' ? `„Passt“ am ${dayMonth(h.tag)}` : 'Morgen nochmal';
      return `<li><b>${esc(x.titel)}</b><small>${esc(was)}</small></li>`;
    }).join('')}</ul>`, [{ label: 'Schließen', value: null, cls: 'go' }]);
}

// ---------- Ablauf eines Schreibauftrags ----------
function schreibStart(id) {
  const a = AUFTRAG[id];
  if (!a) return home();
  const st = aStandNeu(a);
  if (!st.start) { st.start = today(); save(); }
  SW = { a, schritt: st.fertig ? 'pruefen' : st.person ? 'plan' : 'person', fragen: null, startMs: 0 };
  schreibZeigen();
}
function personWahl(a) {
  const vorher = AUFTRAEGE.filter(x => x.index < a.index && (aStand(x) || {}).person).pop();
  const personen = Array.isArray(SCHREIBEN.personen) ? SCHREIBEN.personen : [];
  const opts = [];
  if (a.person) { const p = personen.find(x => x.id === a.person); if (p) opts.push({ id: p.id, text: p.name, empf: true }); }
  if (!a.ganz) {
    if (vorher && (aStand(vorher) || {}).person) opts.push({ id: aStand(vorher).person, text: 'Dieselbe Person wie beim letzten Mal', empf: true, gleich: true });
    else opts.push({ id: 'heft', text: 'Die Person aus deinem Heft-Text („Ich beschreibe …“) – Teil für Teil neu', empf: true });
  }
  if (a.probe) opts.push({ id: 'bild', text: 'Ein Bild, das Mama oder Papa aussucht' });
  opts.push({ id: 'papa', text: 'Papa' }, { id: 'mama', text: 'Mama' }, { id: 'oma', text: 'Oma oder Opa' }, { id: 'blatt', text: 'Eine Person aus deinen Arbeitsblättern' });
  for (const p of personen) if (!opts.some(o => o.id === p.id)) opts.push({ id: p.id, text: `${p.name} (erfunden)` });
  // doppelte ids (z. B. „dieselbe wie gestern“ = heft) nur einmal
  return opts.filter((o, i) => opts.findIndex(x => x.id === o.id) === i);
}
function personName(id) {
  const p = (Array.isArray(SCHREIBEN.personen) ? SCHREIBEN.personen : []).find(x => x.id === id);
  return p ? p.name : { heft: 'die Person aus deinem Heft-Text', papa: 'Papa', mama: 'Mama', oma: 'Oma oder Opa', blatt: 'eine Person aus deinen Arbeitsblättern', bild: 'die Person auf dem Bild' }[id] || '';
}
function steckbriefHTML(id) {
  const p = (Array.isArray(SCHREIBEN.personen) ? SCHREIBEN.personen : []).find(x => x.id === id);
  return p ? `<div class="steckbrief"><b>Steckbrief: ${esc(p.name)}</b><ul>${(p.steckbrief || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
}
function teilInfo(trankId) { return (SCHREIBEN.teile && SCHREIBEN.teile[trankId]) || {}; }
function bauplanHTML(a) {
  return a.traenke.map(id => {
    const t = teilInfo(id);
    const plan = Array.isArray(t.bauplan) ? t.bauplan : [];
    return `<div class="bauplan"><b>${esc(TRANK[id].titel)}</b>${plan.length ? `<p>${plan.map(esc).join(' <span aria-hidden="true">→</span> ')}</p>` : ''}</div>`;
  }).join('');
}
function bausteineHTML(a) {
  const alle = a.traenke.flatMap(id => (teilInfo(id).bausteine || []).map(b => ({ id, b })));
  if (!alle.length) return '';
  return `<details class="bausteine"><summary>Satzanfänge zum Ansehen</summary><ul>${alle.map(x => `<li>${esc(x.b)}</li>`).join('')}</ul></details>`;
}
// Bedingte Punkte (fachdidaktik, 08.11.2026): Text beginnt mit „wenn es passt:“. Sie brauchen eine Entscheidung –
// ✓ oder „passt hier nicht“ (z. B. keine Brille, nichts in der Hand). Pflichtpunkte brauchen wie bisher ✓.
const BEDINGT = /^wenn es passt:/i;
function checklisteFuer(a) {
  const punkt = teil => text => ({ text, teil, bedingt: BEDINGT.test(String(text)) });
  const teile = a.traenke.flatMap(id => (teilInfo(id).checkliste || []).map(punkt(a.ganz ? TRANK[id].titel : '')));
  const ganz = a.ganz && SCHREIBEN.ganzerText && Array.isArray(SCHREIBEN.ganzerText.checkliste) ? SCHREIBEN.ganzerText.checkliste.map(punkt('ganzer Text')) : [];
  return [...teile, ...ganz];
}
// haken und passtNicht auf die Länge der Liste bringen (ältere Stände haben kein passtNicht)
function checkStand(st, liste) {
  if (!Array.isArray(st.haken) || st.haken.length !== liste.length) st.haken = liste.map((_, i) => !!(st.haken || [])[i]);
  if (!Array.isArray(st.passtNicht) || st.passtNicht.length !== liste.length) st.passtNicht = liste.map((_, i) => !!(st.passtNicht || [])[i]);
}
// „Fertig geprüft“ geht, wenn jeder Pflichtpunkt ✓ hat und jeder bedingte ✓ oder „passt hier nicht“
function checklisteFertig(st, liste) {
  return liste.every((x, i) => !!st.haken[i] || (x.bedingt && !!st.passtNicht[i]));
}
function wsKnopf(a, phase) {
  // Wortspeicher: bei 1a–1d offen, im ganzen Text nur zum Überarbeiten, in der Probe zu
  const ws = a.wortspeicher || 'offen';
  if (ws === 'zu' || (ws === 'ueberarbeiten' && phase !== 'pruefen')) return '';
  return '<button class="btn" type="button" data-act="wortspeicher">Wortspeicher</button>';
}
function schreibZeigen() {
  if (!SW) return home();
  screen = 'schreiben';
  stopFx();
  const a = SW.a, st = aStandNeu(a);
  const kopf = `${topbar(esc(a.ganz ? 'Ganzer Text' : 'Schreibauftrag'))}<div class="panel sw-kopf"><div class="eyebrow">${a.probe ? 'Generalprobe' : 'auf Papier'}</div><h2>${esc(a.titel)}</h2>${a.text ? `<p>${fmtText(a.text)}</p>` : ''}</div>`;
  let body = '';
  if (SW.schritt === 'person') {
    body = `<div class="panel"><h3 class="sw-frage">Wen beschreibst du?</h3>
      <div class="sw-personen">${personWahl(a).map(o => `<button class="btn choice ${o.empf ? 'empf' : ''}" type="button" data-act="person" data-id="${esc(o.id)}">${esc(o.text)}${o.empf ? ' <small>empfohlen</small>' : ''}</button>`).join('')}</div></div>`;
  } else if (SW.schritt === 'plan') {
    const plan = a.ganz ? '<p class="note">Mach dir zuerst einen Stichwort-Plan (3 Min.): vier Kästchen auf einem Schmierzettel – Einleitung, Kopf und Gesicht, Kleidung, Schluss.</p>' : '';
    body = `<div class="panel"><p class="sw-wen">Du beschreibst: <b>${esc(personName(st.person))}</b></p>${steckbriefHTML(st.person)}
      <h3 class="sw-frage">Dein Bauplan</h3>${bauplanHTML(a)}${plan}${a.wortspeicher === 'zu' ? '' : bausteineHTML(a)}
      <div class="two">${wsKnopf(a, 'plan')}</div></div>
      <button class="btn go big" type="button" data-act="swSchreiben">Los, ich schreibe</button>`;
  } else if (SW.schritt === 'schreiben') {
    // ruhiger Bildschirm, keine Uhr (nur die Probe misst die Zeit, sie zählt mit, nicht runter)
    body = `<div class="panel ruhe"><p class="ruhe-gross">Nimm ein Blatt und deine Füllfeder.</p>
      <p>${a.ganz ? 'Schreib den ganzen Text: Überschrift, dann vier Absätze – Einleitung, Kopf und Gesicht, Kleidung, Schluss.' : '4 bis 6 Sätze, in der Gegenwart.'}</p>
      ${a.wortspeicher === 'ueberarbeiten' ? '<p class="fineprint">Der Wortspeicher kommt erst nachher, zum Überarbeiten.</p>' : ''}
      <details class="bauplan-zu"><summary>Bauplan ansehen</summary>${bauplanHTML(a)}</details>
      ${wsKnopf(a, 'schreiben')}</div>
      <button class="btn go big" type="button" data-act="swFertig">Fertig geschrieben</button>`;
  } else if (SW.schritt === 'pruefen') {
    const liste = checklisteFuer(a);
    checkStand(st, liste);
    const alle = checklisteFertig(st, liste);
    let gruppe = '';
    body = `${st.dauer ? `<p class="sw-dauer">Du hast ${st.dauer} Minuten gebraucht.</p>` : ''}
      <div class="panel"><h3 class="sw-frage">Selbst prüfen</h3><p>Lies deinen Text halblaut und hak ab, was stimmt. Fehlt was, bessere es am Blatt aus.</p>
      ${liste.some(x => x.bedingt) ? '<p class="pbedingt-hinweis">„Wenn es passt“ heißt: wenn deine Person das hat oder man es sieht. Sonst tipp auf „passt hier nicht“.</p>' : ''}
      <div class="pchecks">${liste.map((x, i) => {
        const kopfzeile = x.teil && x.teil !== gruppe ? `<p class="pgruppe">${esc(gruppe = x.teil)}</p>` : '';
        const nicht = x.bedingt && st.passtNicht[i];
        const haken = `<button type="button" class="pcheck${x.bedingt ? ' bedingt' : ''}${st.haken[i] ? ' on' : ''}${nicht ? ' nicht' : ''}" data-act="ptick" data-i="${i}" aria-pressed="${st.haken[i]}"><i aria-hidden="true"></i><span>${fmtText(x.text)}</span></button>`;
        if (!x.bedingt) return kopfzeile + haken;
        return `${kopfzeile}<div class="pbedingt">${haken}<button type="button" class="pnicht${nicht ? ' on' : ''}" data-act="pnicht" data-i="${i}" aria-pressed="${!!nicht}">passt hier nicht</button></div>`;
      }).join('')}</div>
      <div class="two">${wsKnopf(a, 'pruefen')}</div></div>
      <button class="btn go big" type="button" data-act="swGeprueft" ${alle ? '' : 'disabled'}>Fertig geprüft</button>
      ${alle ? '' : '<p class="fineprint center">Noch nicht alles abgehakt? Schreib es dazu, dann hak es ab. Du kannst auch später weitermachen.</p>'}`;
  } else if (SW.schritt === 'rate') {
    body = `<div class="panel"><h3 class="sw-frage">Rate-Spiel: Wen beschreibe ich?</h3>
      <p>Lies Mama oder Papa deinen Text vor, ohne den Namen zu sagen. Erkennen sie die Person?</p></div>
      <div class="two"><button class="btn go" type="button" data-act="rate" data-v="erkannt">Erkannt!</button><button class="btn" type="button" data-act="rate" data-v="nicht">Nicht erkannt</button></div>
      <button class="link center" type="button" data-act="rate" data-v="">Gerade niemand da – später</button>`;
  } else if (SW.schritt === 'drittel') {
    const lv = a.traenke.map(id => trankStufe(id));
    // Was von der Mission noch fehlt (am Testtag gibt es keine Mission)
    const m = istTesttag() ? null : missionHeute();
    const mission = !m ? '' : m.rundeOffen ? '<p class="sw-mission">Noch ① Runde, dann ist deine Mission geschafft.</p>'
      : '<p class="sw-mission"><b>Mission geschafft ✓</b> Für heute ist alles drin.</p>';
    body = `<div class="panel sw-drittel"><div class="sw-traenke">${a.traenke.map((id, i) => `<span>${trankHTML(lv[i], { feder: true, gross: true, neu: true })}<small>${esc(TRANK[id].titel)}</small></span>`).join('')}</div>
      <p class="ruhe-gross">${a.traenke.length === 1 ? `Trank „${esc(TRANK[a.traenke[0]].titel)}“ ist zu einem Drittel voll!` : 'Selbst geprüft – stark!'}</p>
      ${mission}
      ${st.rate === 'erkannt' ? '<p>Erkannt! Deine Beschreibung funktioniert.</p>' : st.rate === 'nicht' ? '<p>Nicht erkannt. Welches Detail hätte geholfen? Schreib einen Satz dazu.</p>' : ''}
      <p>Zeig dein Blatt jetzt Mama oder Papa. Das geht auch später.</p></div>
      <div class="two"><button class="btn go" type="button" data-act="herzeigen" data-id="${esc(a.id)}">Jetzt herzeigen</button><button class="btn" type="button" data-act="swSpaeter">Später herzeigen</button></div>`;
  } else if (SW.schritt === 'herz') body = herzHTML(a);
  else if (SW.schritt === 'ergebnis') body = ergebnisHTML(a);
  else if (SW.schritt === 'aus') {
    const h = letztesHerz(st);
    const punkte = Object.entries((h && h.punkt) || {}).map(([id, frage]) => `<li><b>${esc(TRANK[id] ? TRANK[id].titel : id)}:</b> ${esc(frage)}</li>`).join('');
    body = `<div class="panel"><h3 class="sw-frage">Ausbessern</h3><p>Nimm dein Blatt. Bessere nur diesen Punkt aus:</p><ul class="sw-punkte">${punkte}</ul><p class="fineprint">Das geht schnell, ca. 3 Minuten.</p></div>
      <button class="btn go big" type="button" data-act="swAusgebessert">Fertig ausgebessert</button>`;
  }
  app.innerHTML = `<section class="screen schreiben">${kopf}${body}</section>`;
}
function swPerson(id) {
  const st = aStandNeu(SW.a);
  st.person = String(id).slice(0, 20);
  save();
  SW.schritt = 'plan';
  schreibZeigen();
}
function swSchreiben() { SW.schritt = 'schreiben'; SW.startMs = Date.now(); schreibZeigen(); }
function swFertig() {
  const st = aStandNeu(SW.a);
  st.fertig = today();
  if (SW.a.probe && SW.startMs) st.dauer = Math.max(1, Math.round((Date.now() - SW.startMs) / 60000));   // Probe: Uhr zählt mit
  save();
  SW.schritt = 'pruefen';
  schreibZeigen();
}
function swTick(b) {
  const st = aStandNeu(SW.a), i = +b.dataset.i;
  checkStand(st, checklisteFuer(SW.a));
  st.haken[i] = !st.haken[i];
  if (st.haken[i]) st.passtNicht[i] = false;   // ✓ und „passt hier nicht“ schließen sich aus
  save();
  if (st.haken[i]) { sfx('tap'); haptic(); }
  schreibZeigen();
}
// Bedingter Punkt: „passt hier nicht“ (an/aus). Nur bei Punkten, die mit „wenn es passt:“ beginnen.
function swNicht(b) {
  const st = aStandNeu(SW.a), i = +b.dataset.i, liste = checklisteFuer(SW.a);
  if (!liste[i] || !liste[i].bedingt) return;
  checkStand(st, liste);
  st.passtNicht[i] = !st.passtNicht[i];
  if (st.passtNicht[i]) { st.haken[i] = false; sfx('tap'); }
  save();
  schreibZeigen();
}
// Alles abgehakt → selbst geprüft: Trank ⅓ (zählt für die Mission)
function selbstVerbuchen(a) {
  const st = aStandNeu(a);
  if (!st.selbst) st.selbst = today();
  for (const id of a.traenke) {
    const t = S.schreiben.t[id] = S.schreiben.t[id] || { lv: 0, passt: [] };
    t.lv = Math.max(t.lv || 0, 1);
  }
}
function swGeprueft() {
  const a = SW.a, st = aStandNeu(a), liste = checklisteFuer(a);
  checkStand(st, liste);
  if (!checklisteFertig(st, liste)) return;
  selbstVerbuchen(a);
  save();
  sfx('blub');
  afterRound();   // Mission vielleicht jetzt fertig: melden
  SW.schritt = a.rateSpiel && !st.rate ? 'rate' : 'drittel';
  schreibZeigen();
}
function swRate(v) {
  const st = aStandNeu(SW.a);
  if (v) { st.rate = v; save(); }
  SW.schritt = 'drittel';
  schreibZeigen();
}
function herzeigenStart(id) {
  const a = AUFTRAG[id];
  if (!a) return;
  if (!SW || SW.a !== a) SW = { a, schritt: 'herz' };
  SW.schritt = 'herz';
  SW.fragen = {};
  for (const tid of a.traenke) SW.fragen[tid] = (teilInfo(tid).herzeigen || []).map(() => null);
  schreibZeigen();
}
// Herzeigen: der Bildschirm für Mama oder Papa. Je Teil drei Fragen (Ja / Noch nicht). „Passt“ heißt: alle Ja.
function herzHTML(a) {
  const name = S.settings.name ? esc(S.settings.name) : 'Dein Kind';
  const bloecke = a.traenke.map(tid => {
    const fragen = teilInfo(tid).herzeigen || [];
    return `<div class="herz-teil">${a.traenke.length > 1 ? `<h3>${esc(TRANK[tid].titel)}</h3>` : ''}${fragen.map((f, i) => {
      const v = SW.fragen[tid][i];
      return `<div class="herz-frage"><p>${esc(f)}</p><div class="herz-knoepfe">
        <button class="btn ${v === true ? 'on-ja' : ''}" type="button" data-act="herzAntwort" data-t="${esc(tid)}" data-i="${i}" data-v="ja">Ja</button>
        <button class="btn ${v === false ? 'on-nein' : ''}" type="button" data-act="herzAntwort" data-t="${esc(tid)}" data-i="${i}" data-v="nein">Noch nicht</button></div></div>`;
    }).join('')}</div>`;
  }).join('');
  const alleBeantwortet = a.traenke.every(tid => SW.fragen[tid].every(v => v !== null));
  const allesJa = alleBeantwortet && a.traenke.every(tid => SW.fragen[tid].every(v => v === true));
  return `<div class="panel herz"><div class="eyebrow">Für Mama oder Papa</div>
    <p class="herz-intro"><b>${name} zeigt dir den Schreibauftrag „${esc(kurzTitel(a))}“.</b> Bitte lies das Blatt (1 Minute).</p>
    <p class="herz-tipp">Sag zuerst, was dir gefällt, ein gutes Wiewort oder einen guten Satz. Dann höchstens eine Sache zum Ausbessern. Nicht alles anstreichen.</p>
    ${bloecke}</div>
    <button class="btn go big" type="button" data-act="herzPasst" ${allesJa ? '' : 'disabled'}>Passt – ich unterschreibe das Blatt</button>
    <button class="btn big" type="button" data-act="herzNochmal" ${alleBeantwortet && !allesJa ? '' : 'disabled'}>Morgen nochmal</button>
    ${alleBeantwortet ? '' : '<p class="fineprint center">Bitte jede Frage mit Ja oder Noch nicht beantworten.</p>'}`;
}
function herzAntwort(b) {
  if (!SW || !SW.fragen) return;
  SW.fragen[b.dataset.t][+b.dataset.i] = b.dataset.v === 'ja';
  sfx('tap');
  schreibZeigen();
}
// Ergebnis festhalten: je Teil „passt“ (alle drei Ja) oder „nochmal“ mit dem einen Punkt (erste Frage mit „Noch nicht“)
function herzFertig() {
  const a = SW.a;
  if (!a.traenke.every(tid => SW.fragen[tid].every(v => v !== null))) return;   // erst alle Fragen beantworten
  const teile = {}, punkt = {};
  for (const tid of a.traenke) {
    const f = SW.fragen[tid];
    if (f.every(v => v === true)) teile[tid] = 'passt';
    else { teile[tid] = 'nochmal'; punkt[tid] = (teilInfo(tid).herzeigen || [])[f.findIndex(v => v === false)] || ''; }
  }
  herzVerbuchen(a, teile, punkt);
  save();
  afterRound();
  SW.schritt = 'ergebnis';
  schreibZeigen();
  if (Object.values(teile).includes('passt')) { sfx(a.traenke.some(id => trankStufe(id) >= 3) ? 'plopp' : 'blub'); haptic(); }
}
function herzVerbuchen(a, teile, punkt) {
  const st = aStandNeu(a), t = today();
  st.herz.push({ tag: t, teile, punkt });
  for (const tid of a.traenke) {
    const tr = S.schreiben.t[tid] = S.schreiben.t[tid] || { lv: 0, passt: [] };
    if (!Array.isArray(tr.passt)) tr.passt = [];
    if (teile[tid] !== 'passt') { tr.lv = Math.max(tr.lv || 0, 1); continue; }
    // voll nur beim zweiten „Passt“ an einem anderen Tag in einem ganzen Text mit geschlossenem Wortspeicher
    const frueher = tr.passt.some(d => d < t);
    const zaehltVoll = a.ganz && (a.wortspeicher || 'offen') !== 'offen';
    tr.lv = zaehltVoll && frueher ? 3 : Math.max(tr.lv || 0, 2);
    if (!tr.passt.includes(t)) tr.passt.push(t);
  }
}
function ergebnisHTML(a) {
  const h = letztesHerz(aStand(a));
  const teile = (h && h.teile) || {};
  const passt = a.traenke.filter(id => teile[id] === 'passt');
  const nochmal = a.traenke.filter(id => teile[id] === 'nochmal');
  const zeilen = a.traenke.map(id => {
    const lv = trankStufe(id);
    const txt = teile[id] === 'passt' ? (lv >= 3 ? 'Passt! Voll – zweimal „Passt“.' : 'Passt! Zwei Drittel. Im ganzen Text füllst du ihn auf.')
      : `Morgen nochmal. Tipp: ${String((h.punkt || {})[id] || '').replace(/\?$/, '.')} Das geht schnell.`;   // Herzeige-Frage als Hinweis
    return `<div class="sw-zeile">${trankHTML(lv, { feder: true, gross: true, neu: true })}<span><b>${esc(TRANK[id].titel)}</b><small>${esc(txt)}</small></span></div>`;
  }).join('');
  return `<div class="panel"><h3 class="sw-frage">${passt.length && !nochmal.length ? 'Passt!' : passt.length ? 'Fast alles passt' : 'Morgen nochmal'}</h3>
    <div class="sw-liste">${zeilen}</div>
    <p class="ruhe-gross">Leg das Blatt in deine Schreibmappe.</p></div>
    <button class="btn go big" type="button" data-act="home">Fertig</button>`;
}
function ausbessernStart(id) {
  const a = AUFTRAG[id];
  if (!a) return;
  SW = { a, schritt: 'aus' };
  schreibZeigen();
}
function swAusgebessert() {
  const st = aStandNeu(SW.a);
  st.aus = today();
  st.ausN = st.herz.length;
  save();
  herzeigenStart(SW.a.id);
}
function wortspeicherSheet() {
  sheet(`<h2 class="sheet-title">Wortspeicher</h2><p class="fineprint">Von oben nach unten, darin nach dem Alphabet.</p>${wortspeicherHTML()}`, [{ label: 'Schließen', value: null, cls: 'go' }]);
}
// Zahlen für den Lagebericht (nur Zahlen, kein Text)
function schreibZahlen() {
  let geschrieben = 0, hergezeigt = 0;
  for (const a of AUFTRAEGE) {
    const st = aStand(a);
    if (st && st.selbst) geschrieben++;
    if (st && Array.isArray(st.herz) && st.herz.length) hergezeigt++;
  }
  return { geschrieben, hergezeigt, voll: TRAENKE.filter(t => trankStufe(t.id) >= 3).length };
}

// ================================================================
// Sicherung: Code kopieren, Code einfügen, Fortschritt löschen
// ================================================================
async function exportCode() {
  const code = CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(S))));
  try {
    await navigator.clipboard.writeText(code);
    toast('Code kopiert. Am besten in eine Notiz einfügen.');
  } catch (e) {
    sheet(`<h2 class="sheet-title">Dein Sicherungs-Code</h2><p>Alles markieren und kopieren:</p><textarea class="code" readonly>${esc(code)}</textarea>`,
      [{ label: 'Fertig', value: null, cls: 'go' }]);
  }
}
// Das Sheet schließt sich vor dem Auslesen: Den Text darum schon beim Tippen mitschreiben
let importBuffer = '';
document.addEventListener('input', e => { if (e.target && e.target.id === 'imp') importBuffer = e.target.value; });
async function importCode() {
  importBuffer = '';
  const val = await sheet(`<h2 class="sheet-title">Code einfügen</h2><p>Achtung: Das ersetzt den Fortschritt auf diesem Gerät.</p><textarea class="code" id="imp" placeholder="${CODE_PREFIX}…" autocapitalize="none" autocorrect="off" spellcheck="false"></textarea>`,
    [{ label: 'Wiederherstellen', value: 'go', cls: 'go' }, { label: 'Abbrechen', value: null }]);
  if (val !== 'go') return;
  try {
    const txt = importBuffer.trim().replace(/\s+/g, '');
    if (!txt.startsWith(CODE_PREFIX)) throw new Error('falsches Präfix');
    const obj = JSON.parse(decodeURIComponent(escape(atob(txt.slice(CODE_PREFIX.length)))));
    if (!obj || typeof obj.k !== 'object' || !obj.settings) throw new Error(`kein ${APP_NAME}-Code`);
    S = upgrade(obj);
    if (STATUS) STATUS.kuerzen(S.log, today());
    save();
    toast('Fortschritt wiederhergestellt ✓');
    home();
  } catch (e) {
    toast(`Der Code passt nicht. Er beginnt mit ${CODE_PREFIX} – bitte ganz kopieren.`);
  }
}
async function resetAll() {
  const v = await sheet('<h2 class="sheet-title">Fortschritt löschen?</h2><p>Alle Tränke, Schreibaufträge und die Serie gehen verloren. Name und Einstellungen bleiben.</p><p class="fineprint">Tipp: Vorher „Code kopieren“, dann lässt sich alles wiederherstellen.</p>',
    [{ label: 'Ja, alles löschen', value: 'yes', cls: 'danger' }, { label: 'Abbrechen', value: null, cls: 'go' }]);
  if (v !== 'yes') return;
  const d = fresh();
  d.settings = S.settings;
  // Titel, BEREIT und PERFEKT gehören zum Fortschritt; Erklärungen, die schon gelesen wurden, nicht
  d.ui = { ...d.ui, hideInstall: S.ui.hideInstall, onboarded: S.ui.onboarded, ziellinie: S.ui.ziellinie };
  S = d;
  save();
  toast('Alles zurückgesetzt.');
  home();
}

// ================================================================
// Lagebericht und Eltern-Verbindung (Legends HQ)
// Vertrag: apps/legends-hq/docs/schnittstelle.md · Deutsch-Regeln: bauauftrag.md Abschnitt 7
// ================================================================
// Was gemessen wird, als kurzer Text: „Schularbeit 17.11.“, „Test 20.11.“ oder „alles“
function goalText(test) {
  if (!test) return 'alles';
  const [, m, d] = test.datum.split('-');
  return (/schularbeit/i.test(test.titel) ? 'Schularbeit ' : 'Test ') + d + '.' + m + '.';
}
// Die Ampel rechnet den Blitz-Check (vorwissen) erst mit der neuen legends-status.js. Mit einer älteren Kopie
// (z. B. halbes Update ohne Netz) melden wir keinen Termin – sonst zeigte die Ampel ab Tag 1 zu Unrecht Rot.
function ampelKenntVorwissen() { return !!(STATUS && STATUS.STANDARD && 'vorwissen' in STATUS.STANDARD); }
// Ziel-Karte für die Eltern-App: nur Zahlen, Wahrheitswerte und die Namen der Balken (nichts über das Kind).
// Seit dl-v5 dazu der Schreibauftrag von heute, damit Legends HQ sagen kann, was von der Mission fehlt:
// offen (0/1, steckt schon in heuteOffen.neu), erledigt (0/1: heute einer selbst geprüft), herzeigen (Texte, die
// aufs Herzeigen warten). Am Testtag ist nichts offen.
function fortschrittBericht() {
  const z = zielStand();
  const si = schreibInfo();
  let gefragt = 0, gewusst = 0;
  for (const c of KARTEN) {
    const st = S.k[c.id];
    if (!st || !imZiel(c) || st.c == null) continue;
    gefragt++;
    if (st.c === 1) gewusst++;
  }
  return {
    prozent: z.prozent, bereit: z.bereit, perfekt: z.perfekt,
    balken: z.bereiche.map(x => ({ id: x.b.id, titel: x.b.titel, prozent: x.prozent })),
    schreiben: Object.assign(schreibZahlen(), {
      offen: si.pflichtOffen ? 1 : 0, erledigt: si.heuteGeprueft.length ? 1 : 0, herzeigen: si.herz.length
    }),
    check: { gefragt, gewusst }
  };
}
// Eingabe für LegendsStatus.bericht(). Ziel (imZiel) = nur Rolle „ziel“; Extra und Schreib-Tränke zählen nicht.
function berichtEingabe() {
  vorStartTage();
  const test = ampelKenntVorwissen() ? nextTest() : null;
  const plan = tagesPlan();
  const si = schreibInfo();
  const unseen = KARTEN.filter(c => !S.k[c.id] && c.rolle !== 'nachschlagen');
  return {
    app: APP_ID, name: APP_NAME, version: VERSION,
    heute: today(), zeit: clock(),
    test,
    ziel: goalText(test),
    // since: Tag des Sammelns – damit lässt sich der Stand am Eintragetag des Termins nachbilden (Plan)
    karten: KARTEN.filter(c => S.k[c.id] && c.rolle !== 'nachschlagen').map(c => {
      const st = S.k[c.id];
      return { lv: st.lv, due: effDue(c), last: st.last, since: st.since, imZiel: imZiel(c), label: c.label, ok: st.ok, bad: st.bad };
    }),
    neuOffen: { ziel: unseen.filter(imZiel).length, gesamt: unseen.length },
    // „Mission fertig“ = A des Tages fertig und Schreibauftrag selbst geprüft; der Schreibauftrag zählt als eine neue
    // Aufgabe (fortschritt.schreiben.offen sagt, ob er dabei ist). Am Testtag ist Aufwärmen freiwillig – nichts offen.
    heuteOffen: plan.testtag ? { faellig: 0, neu: 0 } : { faellig: plan.aDue.length, neu: plan.aNeu.length + (si.pflichtOffen ? 1 : 0) },
    regeln: Object.assign({}, MODELL.ampel),
    fortschritt: fortschrittBericht(),
    log: S.log,         // bericht() trägt f, o, k von heute ein
    plaene: S.plaene    // bericht() friert hier den Plan je Termin ein
  };
}

// Ende einer Runde (oder eines Schreibauftrags): den Tag ins Protokoll schreiben (Mission fertig?), dann melden und
// sichern. Kurz warten, damit zuerst die Zusammenfassung erscheint. Ein Timer läuft auch, wenn die Seite verdeckt ist.
function afterRound() {
  if (!STATUS) return;
  setTimeout(() => {
    try { planNow(); } catch (e) { console.warn('Lagebericht:', e); }
    hqReport({ backup: true });
  }, 350);
}

// Melden (und auf Wunsch sichern), nur mit Verbindung. Nie blockierend, Fehler bleiben still:
// Klappt es nicht, geht beim nächsten Mal einfach der neuere Bericht.
let hqBusy = false, hqQueued = null;
let hqLastOk = 0;   // letzte erfolgreiche Meldung – beim Zurückholen aus dem Hintergrund höchstens alle 10 Minuten
async function hqReport(opt = {}) {
  if (!SYNC || !STATUS || !SYNC.verbunden()) return;
  if (opt.pause && Date.now() - hqLastOk < opt.pause) return;
  if (hqBusy) { hqQueued = { backup: !!(opt.backup || (hqQueued && hqQueued.backup)) }; return; }
  hqBusy = true;
  try {
    const p = planNow();
    const r = await SYNC.melden({ ...p.bericht, zeit: clock() });
    if (r.ok) hqLastOk = Date.now();
    // Kopie: die Sicherung zeigt genau den Stand vom Ende der Runde
    if (opt.backup) await SYNC.sichern(JSON.parse(JSON.stringify(S)), { tag: today(), version: VERSION });
  } catch (e) { /* still */ }
  hqBusy = false;
  hqShowState();
  if (hqQueued) { const o = hqQueued; hqQueued = null; hqReport(o); }
}

// ---------- Einstellungen → Eltern-Verbindung ----------
// 'JJJJ-MM-TT HH:MM' (Gerätezeit aus legends-sync.js) → '18:02' für heute, sonst '5.11. 18:02'
function hqWhen(s) {
  if (!s) return '';
  const [d, hm] = s.split(' ');
  if (d === fmt(new Date())) return hm;
  const [, m, dd] = d.split('-').map(Number);
  return `${dd}.${m}. ${hm}`;
}
function hqStateHTML() {
  const z = SYNC.zustand();
  const parts = ['verbunden', z.gemeldet ? 'gemeldet ' + hqWhen(z.gemeldet) : 'noch nicht gemeldet'];
  if (z.gesichert) parts.push('gesichert ' + hqWhen(z.gesichert));
  return `<b>${esc(parts.join(' · '))}</b>${z.fehler ? `<small>Zuletzt hat es nicht geklappt: ${esc(z.fehler)}. Die App versucht es beim nächsten Mal wieder.</small>` : ''}`;
}
function hqShowState() {
  const el = $('#hq-state');
  if (el && SYNC && SYNC.verbunden()) el.innerHTML = hqStateHTML();
}
function hqPanelHTML() {
  const head = `<div class="field"><b>Eltern-Verbindung</b>
    <small>Mama und Papa sehen, ob du im Plan bist – dasselbe wie auf deiner Startseite. Es gehen nur Zahlen weg, keine Antworten und kein Name. Die Sicherung ist verschlüsselt.</small></div>`;
  if (!SYNC) return head + '<p class="fineprint">Gerade nicht verfügbar. Öffne die App einmal mit Internet.</p>';
  if (!SYNC.verbunden()) {
    return head + `<form class="hq-form" id="hq-form" autocomplete="off" novalidate>
      <input id="hq-code" type="text" placeholder="Verbindungs-Code (HQ1:…)" aria-label="Verbindungs-Code" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done">
      <button class="btn go" type="submit">Verbinden</button>
    </form>`;
  }
  return head + `<p class="hq-state" id="hq-state" aria-live="polite">${hqStateHTML()}</p>
    <div class="hq-btns">
      <button class="btn" type="button" data-act="hqRestore">Aus Sicherung holen</button>
      <button class="link" type="button" data-act="hqDisconnect">Verbindung trennen</button>
    </div>`;
}
async function hqConnect() {
  const input = $('#hq-code'), btn = $('#hq-form .btn');
  if (!input || !SYNC) return;
  const code = input.value.trim();
  if (!code) { shake(input); input.focus(); return; }
  input.blur();
  btn.disabled = true;
  btn.textContent = 'Verbinde …';
  const r = await SYNC.verbinden(code);
  if (!r.ok) {
    toast(r.fehler || 'Verbinden hat nicht geklappt.');
    if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Verbinden'; }
    return;
  }
  toast('Verbunden ✓');
  if (screen === 'settings') settings();
  hqReport({ backup: true });   // gleich melden und die erste Sicherung ablegen
}
// Holt die letzte Sicherung und ersetzt nach Rückfrage den Fortschritt auf diesem Gerät (wie „Code einfügen“).
// Erst holen, dann fragen: So steht in der Rückfrage, wie alt die Sicherung ist.
let hqRestoring = false;
async function hqRestore() {
  if (!SYNC || hqRestoring) return;
  hqRestoring = true;
  const btn = app.querySelector('[data-act="hqRestore"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Hole Sicherung …'; }
  let daten = null, fehler = '';
  try { daten = await SYNC.holen(); }
  catch (e) {
    const net = !e || e.name === 'TypeError' || e.name === 'AbortError';   // fetch ohne Netz bzw. Zeit abgelaufen
    fehler = e && e.status === 404 ? 'Es gibt noch keine Sicherung.'
      : e && e.status === 401 ? 'Der Code passt nicht mehr zum Server.'
      : e && e.status ? 'Der Server hat gerade ein Problem. Probier es später nochmal.'
      : net ? 'Holen hat nicht geklappt. Ist Internet da?'
      : 'Die Sicherung lässt sich nicht öffnen.';
  }
  hqRestoring = false;
  if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = 'Aus Sicherung holen'; }
  if (fehler) return toast(fehler);
  const st = daten && daten.stand;
  if (!st || daten.app !== APP_ID || !st.k || typeof st.k !== 'object' || !st.settings) return toast(`Die Sicherung passt nicht zu ${APP_NAME}.`);
  const nBackup = KARTEN.filter(c => st.k[c.id]).length;
  const v = await sheet(`<h2 class="sheet-title">Aus Sicherung holen?</h2>
    <p>Sicherung vom <b>${isDay(daten.tag) ? esc(dateLabel(daten.tag)) : 'unbekannten Tag'}</b> mit ${nBackup} Tränken.
      Auf diesem Gerät: ${KARTEN.filter(c => S.k[c.id]).length} Tränke${isDay(S.stats.lastDay) ? `, zuletzt geübt ${esc(dateLabel(S.stats.lastDay))}` : ''}.</p>
    <p>Achtung: Das ersetzt den Fortschritt auf diesem Gerät.</p>`,
    [{ label: 'Wiederherstellen', value: 'go', cls: 'go' }, { label: 'Abbrechen', value: null }]);
  if (v !== 'go') return;
  S = upgrade(st);
  if (STATUS) STATUS.kuerzen(S.log, today());
  save();
  toast('Fortschritt wiederhergestellt ✓');
  home();
}
async function hqDisconnect() {
  const v = await sheet(`<h2 class="sheet-title">Verbindung trennen?</h2>
    <p>Dann bekommen Mama und Papa keine Meldungen und keine Sicherungen mehr von ${esc(APP_NAME)}. Dein Fortschritt bleibt auf diesem Gerät.</p>`,
    [{ label: 'Verbunden bleiben', value: null, cls: 'go' }, { label: 'Trennen', value: 'yes' }]);
  if (v !== 'yes' || !SYNC) return;
  SYNC.trennen();
  toast('Verbindung getrennt.');
  if (screen === 'settings') settings();
}

// ================================================================
// Aktionen: jeder Knopf hat data-act, hier steht, was er tut
// ================================================================
// „Weiter“ in der Runde: nach einer Merkkarte (gelesen → kommt nicht wieder) oder nach der Rückmeldung
function onNext() {
  if (!SES || !SES.cur) return;
  const t = SES.cur;
  if (t.art === 'regel' && SES.phase === 'answer') {
    if (!S.regel[t.paket]) S.regel[t.paket] = today();
    zeit(logTime());
    save();
    return next();
  }
  if (SES.phase === 'feedback') next();
}
const ACT = {
  home: () => home(),
  start: () => startRunde(),
  extra: () => startExtra(),
  ueben: () => startUeben(),
  regal: () => regalScreen(),
  zauberbuch: () => zauberbuchScreen(),
  zbTab: b => zauberbuchScreen(b.dataset.tab),
  bereich: b => bereichSheet(b.dataset.id),
  trank: b => trankDetail(b.dataset.id),
  schreibtrank: b => schreibTrankDetail(b.dataset.id),
  settings: () => settings(),
  about: () => about(),
  ziellinieOk: () => { S.ui.ziellinie = true; save(); home(); },
  // Runde
  next: () => onNext(),
  quit: () => quit(),
  hilfe: () => hilfe(),
  idk: () => idk(),
  choice: b => onChoice(b),
  seg: b => segWahl(b),
  sz: () => szEinfuegen(),
  vorlesen: () => { const v = SES && SES.cur && SES.cur.v; if (v && v.diktat) vorlesen(v.wort); },
  pruefen: () => pruefenTippbar(),
  mtoggle: b => mToggle(b),
  orein: b => ordnenRein(b),
  oraus: b => ordnenRaus(b),
  mwort: b => markWort(b),
  mgruppe: b => markGruppe(b),
  // Schreiben auf Papier
  schreiben: b => schreibStart(b.dataset.id),
  person: b => swPerson(b.dataset.id),
  swSchreiben: () => swSchreiben(),
  swFertig: () => swFertig(),
  ptick: b => swTick(b),
  pnicht: b => swNicht(b),
  swGeprueft: () => swGeprueft(),
  rate: b => swRate(b.dataset.v),
  swSpaeter: () => home(),
  herzeigen: b => herzeigenStart(b.dataset.id),
  herzAntwort: b => herzAntwort(b),
  herzPasst: () => herzFertig(),
  herzNochmal: () => herzFertig(),
  ausbessern: b => ausbessernStart(b.dataset.id),
  swAusgebessert: () => swAusgebessert(),
  wortspeicher: () => wortspeicherSheet(),
  // Einstellungen
  clearTest: () => { S.settings.testDate = ''; S.settings.testSince = ''; save(); settings(); },
  hqRestore: () => hqRestore(),
  hqDisconnect: () => hqDisconnect(),
  exportCode: () => exportCode(),
  importCode: () => importCode(),
  reset: () => resetAll(),
  hideInstall: () => { S.ui.hideInstall = true; save(); home(); }
};

app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const fn = ACT[b.dataset.act];
  if (fn) fn(b, e);
});
// Tipp-Knöpfe, ß und hat/ist sollen die Tastatur nicht schließen
app.addEventListener('mousedown', e => { if (e.target.closest('.keepfocus')) e.preventDefault(); });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (screen === 'home') home();
    hqReport({ pause: 10 * 60e3 });
  } else if (STATUS && KARTEN.length) {
    // Beim Verlassen den Tag ins Protokoll schreiben (fertig, offen, sicher) – falls die Startseite heute nicht mehr kommt
    try { planNow(); } catch (e) { /* egal */ }
  }
});

// ================================================================
// Konsole – nur zum Testen am Mac (nicht am Handy des Kindes)
// DL.shiftDays(1) springt einen Tag weiter (nur in diesem Tab) · DL.tag() zeigt die Tagesmenge ·
// DL.check(id, eingabe) prüft eine Antwort · DL.autoRunde() spielt die Tagesrunde ohne Oberfläche durch
// ================================================================
const POOL_BEISPIEL = Object.create(null);   // Beispiel-id → { karte, view }
for (const c of KARTEN) if (c.pool) for (const v of c.pool) if (v.id && !POOL_BEISPIEL[v.id]) POOL_BEISPIEL[v.id] = { c, v };
const r1 = x => Math.round(x * 10) / 10;
// Zufall mit Startwert, damit eine Zeitreise wiederholbar ist
function testZufall(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
window.DL = {
  get state() { return S; },
  today,
  version: VERSION,
  modell: MODELL,
  // id einer Karte oder eines Pool-Beispiels. eingabe: Text (ein Feld) oder Liste (je Feld/Lücke ein Text;
  // Verb Vergangenheit: ['hat', 'gegangen'] oder 'ist gegangen'; wahl: Option bzw. [Schritt 1, Schritt 2];
  // mehrfach: Liste der angetippten Optionen; ordnen: Teile in Reihenfolge; markieren: Gruppe je Wort)
  check(id, eingabe, variante = 0) {
    const c = BY_ID[id], pb = POOL_BEISPIEL[id];
    let v;
    if (c && c.views) v = c.views[Math.min(variante, c.views.length - 1)];
    else if (c && c.pool) v = c.pool[0];
    else if (pb) v = pb.v;
    if (!v) return `unbekannte id: ${id}`;
    let werte = eingabe;
    if (v.typ === 'verb' && v.form === 'perf' && typeof eingabe === 'string') werte = ['', eingabe];
    const r = pruefeView(v, werte);
    return { res: r.res, fast: r.fast || undefined, felder: r.felder.map(f => ({ ok: f.ok, art: f.art || undefined, richtig: f.richtig, note: f.note || undefined, markiert: !f.ok && f.eingabe && f.richtig ? diffMark(f.eingabe, f.richtig) : undefined })) };
  },
  stoff: () => ({ bereiche: BEREICHE.length, pakete: PAKETE.length, karten: KARTEN.length,
    ziel: KARTEN.filter(c => c.rolle === 'ziel').length, extra: KARTEN.filter(c => c.rolle === 'extra').length,
    nachschlagen: KARTEN.filter(c => c.rolle === 'nachschlagen').length, traenke: TRAENKE.length, auftraege: AUFTRAEGE.length,
    fehler: STOFF_FEHLER.slice(), extraFolge: EXTRA_FOLGE.map(p => p.id) }),
  // Tagesmenge von heute (so, wie die Startseite sie rechnet)
  tag() {
    const p = tagesPlan(), si = schreibInfo(), z = zielStand();
    const m = missionHeute(p, si);
    return {
      mission: p.testtag ? 'Testtag (keine Mission)' : `${m.rundeOffen ? '○' : '✓'} Runde${m.schreibTag ? ` · ${m.schreibOffen ? '○' : '✓'} Schreiben` : ''}${m.fertig ? (m.getan ? ' · geschafft' : ' · nichts fällig') : ''}`,
      herzeigen: si.herz.map(a => a.id), ausbessern: si.aus.map(a => a.id),
      tag: today(), wochentag: DAY_SHORT[weekdayOf(today())], testIn: testIn(), endspurt: istEndspurt(), testtag: p.testtag,
      faelligA: p.aDue.length, verben: p.verben.length, neuA: p.aNeu.length, faelligExtra: p.eDue.length, neuExtra: p.eNeu.length,
      merk: p.merk.map(x => x.id), minA: r1(p.sekA / 60), min: r1(p.sek / 60), deckel: deckelHeute(), schonMin: r1(heuteSek() / 60),
      schreiben: si.pflichtOffen ? si.offen.id : '', ziel: z.prozent, balken: z.bereiche.map(x => x.prozent), bereit: z.bereit,
      morgen: morgenBereit(), extraPaket: extraPaketMoeglich()
    };
  },
  ziel: () => zielStand(),
  prognose: () => prognose(),
  // Bestimmte Karten gleich üben, ohne Stufen zu ändern: DL.ueben(['st-kern-1']) · art 'check' wie beim ersten Mal ·
  // auch 'vcheck:v-bieten' (Verb-Check) und 'regel:v' (Regelkarte eines Pakets)
  ueben(ids, art = 'ueben') {
    startSession('ueben', [].concat(ids).map(id => (/^vcheck:/.test(id) ? (VERB[id.slice(7)] ? { art: 'vcheck', verb: id.slice(7) } : null)
      : /^regel:/.test(id) ? (PAKET[id.slice(6)] ? { art: 'regel', paket: id.slice(6) } : null)
      : BY_ID[id] ? { id, art } : null)).filter(Boolean));
    return SES ? SES.queue.length + 1 : 0;
  },
  get ses() { return SES && { cur: SES.cur, phase: SES.phase, karte: SES.cur && BY_ID[SES.cur.id], offen: SES.offen.slice(), rest: SES.queue.length, sek: Math.round(SES.sek) }; },
  // Simulation, nur zum Testen: spielt die Tagesrunde mit denselben Funktionen wie die Runde durch, ohne Oberfläche.
  // p = Anteil richtig bei Wiederholungen, vw = Anteil im Blitz-Check gewusst, Zeit nach MODELL.sek (+ Fehler).
  // schreiben: Schreibauftrag des Tages selbst prüfen und „Passt“ geben. Gibt die Tagesmenge vorher zurück.
  autoRunde({ p = 0.85, vw = 0.62, schreiben = true, seed = 1 } = {}) {
    const vorher = window.DL.tag();
    const plan = tagesPlan(), t = today();
    const rnd = testZufall(hash(t) ^ seed);
    for (const pk of plan.merk) { if (!S.regel[pk.id]) S.regel[pk.id] = t; if (STATUS) STATUS.zaehleZeit(S.log, t, MODELL.sek.merkkarte); }
    for (const c of [...plan.aDue, ...plan.eDue]) {
      const ok = rnd() < p, st = S.k[c.id];
      review(c, ok ? 'ok' : 'falsch');
      if (ok) st.ok++; else st.bad++;
      if (c.views && c.views.length > 1) st.v = ((st.v || 0) + 1) % c.views.length;
      if (STATUS) STATUS.zaehleAntwort(S.log, t, ok, sekKarte(c, false) + (ok ? 0 : MODELL.sek.fehler));
    }
    for (const c of [...plan.aNeu, ...plan.eNeu]) {
      if (S.k[c.id]) continue;
      const ok = rnd() < vw;
      const lv = ok ? (c.klasse === 'einzel' ? MODELL.sicherAb : c.klasse === 'regel' ? 2 : 1) : 1;
      collect(c, lv, { check: true, gewusst: ok, stern: ok && c.klasse === 'einzel' });
      if (STATUS) STATUS.zaehleNeu(S.log, t, sekKarte(c, true));
    }
    if (schreiben) {
      const si = schreibInfo();
      if (si.pflichtOffen) {
        const a = si.offen, st = aStandNeu(a);
        st.person = st.person || 'heft'; st.start = st.start || t; st.fertig = t;
        st.haken = checklisteFuer(a).map(() => true);
        selbstVerbuchen(a);
        herzVerbuchen(a, Object.fromEntries(a.traenke.map(id => [id, 'passt'])), {});
      }
    }
    markDay();
    save();
    PLAN = null;
    return vorher;
  },
  // Lagebericht frisch rechnen (wie er an Legends HQ ginge) · Ampel dazu (opt: { abend: true }) · Eingabe dafür
  bericht() { if (!STATUS) return null; PLAN = null; return planNow().bericht; },
  urteil: opt => (STATUS ? STATUS.urteil(planNow().bericht, today(), opt) : null),
  eingabe: () => berichtEingabe(),
  // Jetzt melden und sichern (nur mit Verbindung) → danach DL.sync zeigt den Zustand
  melden: () => hqReport({ backup: true }).then(() => SYNC && SYNC.zustand()),
  get sync() { return SYNC && SYNC.zustand(); },
  shiftDays(n) {
    dayOffset += n;
    try { sessionStorage.setItem(DAY_KEY, String(dayOffset)); } catch (e) { /* egal */ }
    PLAN = null;
    if (screen === 'home') home();
    return today();
  }
};

// ================================================================
// Start
// ================================================================
syncViewport();
if (!S.ui.onboarded) welcome();
else if (!S.ui.ziellinie) ziellinieScreen();   // auch nach dem Update von dl-v1: die Ziellinie einmal erklären
else home();
// Nach dem Start einmal melden (nur mit Verbindung), wenn die Startseite schon steht
setTimeout(() => hqReport(), 1500);

// Offline-Cache nur auf der echten Seite – lokal beim Entwickeln stört er (mit ?sw trotzdem testen)
const devHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw\b/.test(location.search);
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !devHost) {
  const sw = navigator.serviceWorker;
  const hadController = !!sw.controller;
  addEventListener('load', () => sw.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    // iOS holt Web-Apps oft nur aus dem Hintergrund zurück, ohne sie neu zu starten – dann selbst nach Updates schauen
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {}));
  // Neue Version übernommen: sofort neu laden, wenn man auf der Startseite ist – nie mitten in einer Runde
  sw.addEventListener('controllerchange', () => {
    if (!hadController) return;
    updateReady = true;
    if (screen === 'home') location.reload();
  });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
