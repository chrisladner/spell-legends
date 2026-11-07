#!/usr/bin/env node
/*
  Prüft stoff.js (Format 2, beschrieben im Dateikopf von stoff.js), bevor neuer Stoff in die App kommt.

      node apps/deutsch-legends/tools/stoff-pruefen.mjs                   prüfen, Übersicht ausgeben
      node apps/deutsch-legends/tools/stoff-pruefen.mjs --merken          zusätzlich alle ids in tools/ids.txt aufnehmen
      node apps/deutsch-legends/tools/stoff-pruefen.mjs --verben <datei>  Verben gegen diese verben.json prüfen
                    (Standard: auftraege/2026-11-07_deutsch-app/verben.json im Workspace; fehlt sie: Warnung)
      Zum Testen des Prüfers: --datei <stoff.js> und --register <ids.txt> statt der Dateien im App-Ordner

  tools/ids.txt ist das Register aller veröffentlichten ids (vor jedem Veröffentlichen mit --merken nachziehen).
  Darin stehen alle ids, an denen Fortschritt hängt: Karten, die aus den Verben gebauten Karten (<id>-prae, <id>-perf),
  Schreib-Tränke und Schreibaufträge. Fehlt eine davon in stoff.js, ginge Fortschritt verloren: das ist ein Fehler.
  Exit 1 bei Fehlern (Warnungen allein: Exit 0). Die Regeln folgen dem Datenvertrag (bauauftrag.md, Abschnitt 3 und 6).
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const fehler = [], warn = [];
const F = (wo, was) => fehler.push(`${wo}: ${was}`);
const W = (wo, was) => warn.push(`${wo}: ${was}`);

// Soll je Rolle laut lernmodell.md 3a (07.11.2026). Kommt neuer Stoff dazu, hier mitziehen.
const SOLL = { ziel: 249, extra: 168, nachschlagen: 0 };   // ws und pb-adj seit 07.11. 18:10 im Extra-Regal (ohne Wortspeicher in der Schularbeit)
const MAX_FELDER = 6;      // vb-pers: Personalform-Tabelle wie im Heft
const MAX_LUECKEN = 5;     // vb-zeit-u-…: ein Satz in drei Zeitformen
const WS_KATEGORIEN = ['Haare', 'Frisur', 'Haarfarbe', 'Gesicht', 'Augen', 'Nase', 'Mund', 'Zähne', 'Ohren', 'Körper', 'Kleidung'];
const TIPP_ARTEN = ['gross', 'umlaut', 'ss', 'hilfsverb', 'ohneHilfsverb', 'feld', 'person', 'andere'];
const HTML_TAGS = ['p', 'b', 'br', 'ul', 'li', 'table', 'tr', 'th', 'td', 'i', 'em', 'strong'];
// Verbotene Wörter (Vorname des Kindes, Name der Lehrerin, Verlag der Arbeitsblätter). Rückwärts geschrieben,
// damit die Wörter selbst nicht im öffentlichen Repo stehen.
const VERBOTEN = ['sanoj', 'remmiz', 'ellebilnrel'].map(s => [...s].reverse().join(''));

// ================================================================
// Laden
// ================================================================
const QUELLE = fs.readFileSync(arg('--datei') || path.join(DIR, 'stoff.js'), 'utf8');
const win = {};
try {
  vm.runInNewContext(QUELLE, { window: win }, { filename: 'stoff.js' });
} catch (e) {
  console.error('FEHLER:  stoff.js ist kein gültiges JavaScript: ' + e.message);
  process.exit(1);
}
const S = win.STOFF;
if (!S || typeof S !== 'object') { console.error('FEHLER:  window.STOFF fehlt'); process.exit(1); }

const isDay = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !isNaN(Date.parse(x + 'T12:00:00'));
const istText = x => typeof x === 'string' && x.trim() !== '';
const textListe = x => Array.isArray(x) && x.length > 0 && x.every(istText);
const alsListe = x => [].concat(x == null ? [] : x);
const ID_FORM = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Alle ids an einem Ort: eindeutig über Karten, Pool-Beispiele, erzeugte Verb-Karten, Tränke und Aufträge hinweg
const ALLE_IDS = new Map();      // id → wo
const REGISTER = new Set();      // ids, an denen Fortschritt hängt
const neueId = (id, wo, register) => {
  if (!istText(id)) { F(wo, 'id fehlt'); return false; }
  if (register) REGISTER.add(id);
  if (ALLE_IDS.has(id)) { F(wo, `id „${id}“ doppelt (auch bei ${ALLE_IDS.get(id)})`); return false; }
  if (!ID_FORM.test(id)) W(wo, `id „${id}“ bitte nur aus Kleinbuchstaben, Ziffern und Bindestrich`);
  ALLE_IDS.set(id, wo);
  return true;
};
const sauber = (wo, a) => {
  const s = String(a);
  if (s !== s.trim()) W(wo, `Leerzeichen am Rand: „${s}“`);
  if (/\s{2,}/.test(s)) W(wo, `doppeltes Leerzeichen: „${s}“`);
  if (/[.,;:]$/.test(s.trim())) W(wo, `Satzzeichen am Ende zählt nicht: „${s}“`);
};
const htmlPruefen = (wo, html) => {
  if (!istText(html)) return F(wo, 'HTML fehlt');
  const tags = [...String(html).matchAll(/<\/?([a-z0-9]+)/gi)].map(m => m[1].toLowerCase());
  const fremd = [...new Set(tags.filter(t => !HTML_TAGS.includes(t)))];
  if (fremd.length) W(wo, `enthält ${fremd.map(t => '<' + t + '>').join(' ')}`);
  if (/<script|on\w+\s*=/i.test(html)) F(wo, 'enthält Skript');
  for (const t of ['p', 'b', 'ul', 'li', 'table', 'tr', 'th', 'td']) {
    const auf = (html.match(new RegExp(`<${t}[\\s>]`, 'gi')) || []).length, zu = (html.match(new RegExp(`</${t}>`, 'gi')) || []).length;
    if (auf !== zu) W(wo, `<${t}> ${auf}× geöffnet, ${zu}× geschlossen`);
  }
};
const fettPruefen = (wo, s) => { if (typeof s === 'string' && (s.match(/\*/g) || []).length % 2) W(wo, `ungerade Zahl von * (Fettdruck): „${s}“`); };

// Lücken [a|b] zerlegen; Fehler bei leeren oder verschachtelten Klammern
function luecken(wo, satz) {
  const auf = (satz.match(/\[/g) || []).length, zu = (satz.match(/\]/g) || []).length;
  if (auf !== zu) F(wo, `Klammern [ ] passen nicht zusammen: „${satz}“`);
  const gaps = [...satz.matchAll(/\[([^\]]*)\]/g)].map(m => {
    if (m[1].includes('[')) F(wo, `verschachtelte Lücke: „${satz}“`);
    const opt = m[1].split('|').map(s => s.trim());
    if (!opt.length || opt.some(o => !o)) F(wo, `leere Lücke oder leere Option: „[${m[1]}]“`);
    opt.forEach(o => sauber(wo, o));
    return opt.filter(Boolean);
  });
  return gaps;
}

// ================================================================
// Aufgaben je Typ (Karte, Pool-Beispiel, Variante)
// ================================================================
const TYPEN = ['tippen', 'luecke', 'wahl', 'zuordnen', 'ordnen', 'markieren'];
function wahlTeil(wo, o, was) {
  const opt = o.optionen;
  if (!textListe(opt)) { F(wo, `${was}optionen fehlen`); return; }
  if (new Set(opt).size !== opt.length) F(wo, `${was}optionen doppelt`);
  const a = alsListe(o.antwort).filter(istText);
  if (!a.length) F(wo, `${was}antwort fehlt`);
  a.forEach(x => { if (!opt.includes(x)) F(wo, `${was}antwort „${x}“ steht nicht in optionen`); });
  if (new Set(a).size !== a.length) F(wo, `${was}antwort doppelt`);
  if (o.mehrere && a.length === opt.length) W(wo, `${was}mehrere: alle Optionen sind richtig`);
}
function aufgabe(wo, c) {
  if (!TYPEN.includes(c.typ)) return F(wo, `unbekannter typ „${c.typ}“ (erlaubt: ${TYPEN.join(', ')})`);
  ['frage', 'tipp', 'hilfe'].forEach(k => { if (c[k] != null && !istText(c[k])) F(wo, `${k} muss ein Text sein`); });
  if (c.tipps) for (const k of Object.keys(c.tipps)) {
    if (!TIPP_ARTEN.includes(k)) W(wo, `tipps.${k}: unbekannte Fehlerart`);
    if (!istText(c.tipps[k])) F(wo, `tipps.${k} leer`);
  }
  ['wort', 'text', 'satz'].forEach(k => fettPruefen(wo, c[k]));
  if (c.typ === 'tippen') {
    if (!istText(c.wort)) F(wo, 'wort fehlt');
    if (c.diktat != null && typeof c.diktat !== 'boolean') F(wo, 'diktat: true oder false');
    if (!Array.isArray(c.felder) || !c.felder.length) return F(wo, 'felder fehlen');
    if (c.felder.length > MAX_FELDER) F(wo, `höchstens ${MAX_FELDER} Felder`);
    c.felder.forEach((f, k) => {
      const fw = `${wo} felder[${k}]`;
      if (!f || typeof f !== 'object') return F(fw, 'Feld fehlt');
      if (!istText(f.label)) W(fw, 'label fehlt');
      const ant = alsListe(f.antwort);
      if (!ant.length || !ant.every(istText)) return F(fw, 'antwort fehlt (Text oder Liste von Texten)');
      if (new Set(ant).size !== ant.length) F(fw, 'antwort doppelt');
      if (f.liste) {
        if (Array.isArray(f.antwort)) F(fw, 'liste: antwort ist EIN Text mit Beistrich, z. B. \'haben, sein, werden\'');
        else {
          const el = f.antwort.split(/\s*,\s*|\s+und\s+|\s+/).filter(Boolean);
          if (el.length < 2) F(fw, 'liste: mindestens zwei Elemente, durch Beistrich getrennt');
          if (new Set(el).size !== el.length) F(fw, 'liste: Element doppelt');
        }
      }
      if (f.wahl) {
        if (!textListe(f.wahl)) F(fw, 'wahl: Liste von Texten');
        else ant.forEach(a => { if (!f.wahl.includes(a)) F(fw, `„${a}“ steht nicht in wahl`); });
      }
      for (const [k2, h] of [['alt', 'altHinweis'], ['andere', 'andereHinweis']]) {
        if (f[k2] == null) continue;
        if (!textListe(f[k2])) F(fw, `${k2}: Liste von Texten`);
        else {
          f[k2].forEach(a => { if (ant.includes(a)) F(fw, `${k2} „${a}“ steht schon in antwort`); sauber(fw, a); });
          if (!istText(f[h])) W(fw, `${k2} ohne ${h}`);
        }
      }
      if (k2Konflikt(f)) F(fw, 'alt und andere überschneiden sich');
      if (!f.liste) ant.forEach(a => sauber(fw, a));
    });
  } else if (c.typ === 'luecke') {
    if (!istText(c.satz)) return F(wo, 'satz fehlt');
    const gaps = luecken(wo, c.satz);
    if (!gaps.length) F(wo, 'keine Lücke [ ] im Satz');
    if (gaps.length > MAX_LUECKEN) F(wo, `höchstens ${MAX_LUECKEN} Lücken`);
    if (c.optionen != null) {
      if (!textListe(c.optionen)) F(wo, 'optionen: Liste von Texten');
      else if (gaps.length !== 1) F(wo, 'optionen gehen nur bei genau einer Lücke');
      else gaps[0].forEach(a => { if (!c.optionen.includes(a)) F(wo, `Antwort „${a}“ steht nicht in optionen`); });
    }
    if (c.hinweise != null && (!Array.isArray(c.hinweise) || c.hinweise.length !== gaps.length)) W(wo, 'hinweise: nicht genau einer je Lücke');
  } else if (c.typ === 'wahl') {
    wahlTeil(wo, c, '');
    if (c.dann != null) {
      if (typeof c.dann !== 'object') F(wo, 'dann: { frage, optionen, antwort }');
      else { if (!istText(c.dann.frage)) F(wo, 'dann.frage fehlt'); wahlTeil(wo, c.dann, 'dann.'); fettPruefen(wo, c.dann.frage); }
    }
  } else if (c.typ === 'zuordnen') {
    if (!textListe(c.optionen)) return F(wo, 'optionen fehlen');
    if (!Array.isArray(c.paare) || !c.paare.length) return F(wo, 'paare fehlen');
    c.paare.forEach((x, k) => {
      if (!Array.isArray(x) || x.length < 2 || !istText(x[0])) return F(wo, `paare[${k}]: [Wort, Gruppe]`);
      if (!c.optionen.includes(x[1])) F(wo, `paare[${k}]: „${x[1]}“ steht nicht in optionen`);
    });
  } else if (c.typ === 'ordnen') {
    if (!textListe(c.teile) || c.teile.length < 2) return F(wo, 'teile: mindestens zwei Texte in der richtigen Reihenfolge');
    if (new Set(c.teile).size !== c.teile.length) F(wo, 'teile doppelt (die Reihenfolge wäre nicht eindeutig)');
  } else if (c.typ === 'markieren') {
    if (!istText(c.satz)) return F(wo, 'satz fehlt');
    if (!c.gruppen || typeof c.gruppen !== 'object') return F(wo, 'gruppen fehlen');
    const woerter = c.satz.split(/\s+/).map(w => w.replace(/^[„“"'(«»]+|[.,!?;:„“"')«»…]+$/g, '')).filter(Boolean);
    const zaehl = new Map(); woerter.forEach(w => zaehl.set(w, (zaehl.get(w) || 0) + 1));
    const gesehen = new Map();
    for (const [g, liste] of Object.entries(c.gruppen)) {
      if (!['Hauptwort', 'Zeitwort', 'Wiewort'].includes(g)) F(wo, `unbekannte Gruppe „${g}“`);
      if (!Array.isArray(liste)) { F(wo, `gruppen.${g}: Liste`); continue; }
      liste.forEach(w => {
        if (!zaehl.has(w)) F(wo, `„${w}“ (${g}) steht nicht genau so im Satz`);
        else if (zaehl.get(w) > 1) W(wo, `„${w}“ steht mehrmals im Satz`);
        if (gesehen.has(w)) F(wo, `„${w}“ steht in ${gesehen.get(w)} und ${g}`);
        gesehen.set(w, g);
      });
    }
    if (!gesehen.size) F(wo, 'keine Wörter in den Gruppen');
  }
}
function k2Konflikt(f) { return Array.isArray(f.alt) && Array.isArray(f.andere) && f.alt.some(a => f.andere.includes(a)); }

// ================================================================
// Termin, Bereiche
// ================================================================
if (S.format !== 2) F('stoff.js', `format: 2 erwartet (steht: ${S.format})`);
if (!S.test) W('test', 'kein offizieller Termin');
else {
  if (!isDay(S.test.datum)) F('test', 'datum fehlt oder nicht JJJJ-MM-TT');
  if (!isDay(S.test.eingetragen)) W('test', 'eingetragen fehlt (Plan rechnet dann ab dem ersten Öffnen)');
  if (!istText(S.test.titel)) W('test', 'titel fehlt');
}
const TEST = S.test && isDay(S.test.datum) ? S.test.datum : null;
const BER = new Map();
(Array.isArray(S.bereiche) ? S.bereiche : []).forEach((b, i) => {
  const wo = `Bereich ${b && b.id ? b.id : '#' + i}`;
  if (!b || !istText(b.id)) return F(wo, 'id fehlt');
  if (BER.has(b.id)) F(wo, 'id doppelt');
  if (!istText(b.titel)) W(wo, 'titel fehlt');
  if (b.gewicht != null && !(Number(b.gewicht) > 0)) F(wo, 'gewicht muss eine Zahl über 0 sein');
  if (b.papier != null && !(b.papier > 0 && b.papier < 1)) F(wo, 'papier muss zwischen 0 und 1 liegen');
  BER.set(b.id, { ...b, n: { ziel: 0, extra: 0, nachschlagen: 0 } });
});
if (!BER.size) F('bereiche', 'keine Bereiche');
const mitG = [...BER.values()].filter(b => b.gewicht != null).length;
if (mitG && mitG < BER.size) F('bereiche', 'gewicht bei allen Bereichen angeben oder bei keinem');

// ================================================================
// Pakete
// ================================================================
const PAK = new Map();
(Array.isArray(S.pakete) ? S.pakete : []).forEach((p, i) => {
  const wo = `Paket ${p && p.id ? p.id : '#' + i}`;
  if (!p || !istText(p.id)) return F(wo, 'id fehlt');
  if (PAK.has(p.id)) F(wo, 'id doppelt');
  if (!BER.has(p.bereich)) F(wo, `Bereich „${p.bereich}“ fehlt`);
  if (!istText(p.titel)) W(wo, 'titel fehlt');
  if (!['ziel', 'extra', 'nachschlagen'].includes(p.rolle)) F(wo, `rolle „${p.rolle}“ (erlaubt: ziel, extra, nachschlagen)`);
  if (p.rolle === 'ziel') {
    if (!isDay(p.ab)) F(wo, 'ab fehlt (frühester Tag, JJJJ-MM-TT)');
    else if (TEST && p.ab >= TEST) F(wo, `ab ${p.ab} liegt nicht vor dem Test`);
    if (p.rang != null) W(wo, 'rang gilt nur für Extra-Pakete');
  } else if (p.ab != null) W(wo, 'ab gilt nur für Ziel-Pakete');
  if (p.rolle === 'extra' && !(Number.isInteger(p.rang) && p.rang >= 1)) F(wo, 'rang fehlt (Platz im Extra-Regal, ganze Zahl ab 1)');
  if (p.rolle === 'nachschlagen' && p.rang != null) W(wo, 'Nachschlagen steht nicht im Extra-Regal (rang weglassen)');
  if (p.check != null && !['einzel', 'regel', 'auswahl'].includes(p.check)) F(wo, `check „${p.check}“ (erlaubt: einzel, regel, auswahl)`);
  if (p.thema != null && !istText(p.thema)) F(wo, 'thema muss ein Text sein');
  if (p.regel != null) htmlPruefen(`${wo} regel`, p.regel);
  if (!istText(p.quelle)) W(wo, 'quelle fehlt');
  PAK.set(p.id, { ...p, karten: [], verben: 0 });
});

// ================================================================
// Pools
// ================================================================
const POOLS = S.pools && typeof S.pools === 'object' ? S.pools : {};
const POOL_BENUTZT = new Map();
for (const [pid, liste] of Object.entries(POOLS)) {
  if (!Array.isArray(liste) || !liste.length) { F(`Pool ${pid}`, 'leer oder keine Liste'); continue; }
  liste.forEach((b, k) => {
    const wo = `Pool ${pid} ${b && b.id ? b.id : '#' + k}`;
    if (!b || typeof b !== 'object') return F(wo, 'Beispiel fehlt');
    neueId(b.id, wo, false);
    if (b.paket != null) W(wo, 'Pool-Beispiele haben kein paket');
    aufgabe(wo, b);
    if (b.varianten != null) W(wo, 'varianten gibt es nur bei Einzelkarten');
  });
  POOL_BENUTZT.set(pid, []);
}

// ================================================================
// Karten
// ================================================================
const proTyp = {};
(Array.isArray(S.karten) ? S.karten : []).forEach((c, i) => {
  const wo = `Karte ${c && c.id ? c.id : '#' + i}`;
  if (!c || typeof c !== 'object') return F(wo, 'Karte fehlt');
  neueId(c.id, wo, true);
  const p = PAK.get(c.paket);
  if (!p) F(wo, `Paket „${c.paket}“ fehlt`); else p.karten.push(c);
  if (c.pool != null) {
    // Regel-Karte: { id, paket, pool }, id = Gruppe + -r1, -r2 …
    if (!POOL_BENUTZT.has(c.pool)) return F(wo, `Pool „${c.pool}“ fehlt`);
    POOL_BENUTZT.get(c.pool).push(c.id);
    const m = /^(.+)-r(\d+)$/.exec(c.id || '');
    if (!m || m[1] !== c.pool) W(wo, `Regel-Karten heißen ${c.pool}-r1, ${c.pool}-r2 …`);
    if (c.typ != null) W(wo, 'Regel-Karte mit typ: die Aufgabe kommt aus dem Pool');
    if (c.varianten != null) W(wo, 'Regel-Karte mit varianten');
    proTyp.regel = (proTyp.regel || 0) + 1;
    return;
  }
  proTyp[c.typ] = (proTyp[c.typ] || 0) + 1;
  aufgabe(wo, c);
  if (c.varianten != null) {
    if (!Array.isArray(c.varianten) || !c.varianten.length) F(wo, 'varianten: Liste von Aufgaben');
    else c.varianten.forEach((v, k) => {
      const vw = `${wo} varianten[${k}]`;
      if (!v || typeof v !== 'object') return F(vw, 'Variante fehlt');
      if (v.id != null || v.paket != null) W(vw, 'Varianten haben keine id und kein paket');
      aufgabe(vw, v);
    });
  }
});
for (const [pid, karten] of POOL_BENUTZT) {
  if (!karten.length) W(`Pool ${pid}`, 'keine Regel-Karte zieht aus diesem Pool');
  else if (karten.length > POOLS[pid].length) W(`Pool ${pid}`, `${karten.length} Regel-Karten, aber nur ${POOLS[pid].length} Beispiele`);
}

// ================================================================
// Verben (gegen verben.json) und die daraus gebauten Karten
// ================================================================
const FAM = S.familien && typeof S.familien === 'object' ? S.familien : {};
const FALLEN = S.fallen && typeof S.fallen === 'object' ? S.fallen : {};
const VERBEN = Array.isArray(S.verben) ? S.verben : [];
const VIDS = new Set();
const paketV = [...PAK.values()].find(p => p.bereich === 'verben');
if (VERBEN.length && !paketV) W('verben', 'kein Paket im Bereich verben (die App hängt die Verb-Karten an ein Paket)');
VERBEN.forEach((v, i) => {
  const wo = `Verb ${v && v.id ? v.id : '#' + i}`;
  if (!v || !istText(v.id)) return F(wo, 'id fehlt');
  if (!/^v-[a-z]+$/.test(v.id)) W(wo, 'Verb-ids: v- und die Nennform in ASCII (ä → ae, ß → ss)');
  if (VIDS.has(v.id)) F(wo, 'id doppelt');
  VIDS.add(v.id);
  neueId(v.id, wo, false);
  neueId(v.id + '-prae', wo + ' (Karte Mitvergangenheit)', true);
  neueId(v.id + '-perf', wo + ' (Karte Vergangenheit)', true);
  if (paketV) paketV.verben++;
  if (!istText(v.inf)) F(wo, 'inf fehlt');
  if (!textListe(v.prae)) F(wo, 'prae fehlt (Liste)');
  if (!textListe(v.perf)) F(wo, 'perf fehlt (Liste)');
  else v.perf.forEach(x => { if (!/^(hat|ist) \S+$/.test(x)) F(wo, `perf „${x}“: hat oder ist und das 2. Mittelwort`); });
  if (!FAM[v.muster]) F(wo, `Familie „${v.muster}“ fehlt in familien`);
  (v.fallen || []).forEach(code => { if (code !== 'h' && !istText(FALLEN[code])) F(wo, `Fehlerfalle „${code}“ hat keinen Text in fallen`); });
  if (!istText(v.tipp)) W(wo, 'tipp fehlt');
  for (const k of ['alt', 'andere']) {
    if (v[k] == null) continue;
    if (!textListe(v[k].prae || []) && v[k].prae != null) F(wo, `${k}.prae: Liste`);
    if (!textListe(v[k].perf || []) && v[k].perf != null) F(wo, `${k}.perf: Liste`);
    if (!istText(v[k].note)) W(wo, `${k}.note fehlt`);
  }
  // Beispielsätze: Lücken gültig, und jede Option ist eine erlaubte Form
  if (v.satz) {
    const okPrae = [...(v.prae || []), ...((v.alt && v.alt.prae) || [])];
    const okPerf = [...(v.perf || []), ...((v.alt && v.alt.perf) || [])];
    if (istText(v.satz.prae)) {
      const g = luecken(wo + ' satz.prae', v.satz.prae);
      if (g.length !== 1) W(wo, 'satz.prae: eine Lücke erwartet');
      else g[0].forEach(x => { if (!okPrae.includes(x)) W(wo, `satz.prae: „${x}“ ist keine Form aus prae`); });
    }
    if (istText(v.satz.perf)) {
      const g = luecken(wo + ' satz.perf', v.satz.perf);
      if (g.length !== 2) W(wo, 'satz.perf: zwei Lücken erwartet (hat/ist und 2. Mittelwort)');
      else g[0].forEach(h => g[1].forEach(pz => { if (!okPerf.includes(`${h} ${pz}`)) W(wo, `satz.perf: „${h} ${pz}“ ist keine Form aus perf`); }));
    }
  }
});
// Abgleich mit verben.json (Workspace); Reihenfolge und Inhalt müssen gleich sein
const canon = x => Array.isArray(x) ? '[' + x.map(canon).join(',') + ']' : x && typeof x === 'object'
  ? '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}' : JSON.stringify(x);
const VJ = arg('--verben') || path.resolve(DIR, '../../auftraege/2026-11-07_deutsch-app/verben.json');
if (fs.existsSync(VJ)) {
  try {
    const ref = JSON.parse(fs.readFileSync(VJ, 'utf8'));
    if (ref.length !== VERBEN.length) F('verben', `${VERBEN.length} Verben, verben.json hat ${ref.length}`);
    ref.forEach((r, i) => {
      const v = VERBEN[i];
      if (!v) return;
      if (canon(r) !== canon(v)) F(`Verb ${v.id}`, `weicht von verben.json ab (Eintrag ${i + 1}, dort ${r.id})`);
    });
  } catch (e) { F('verben.json', 'nicht lesbar: ' + e.message); }
} else W('verben', `verben.json nicht gefunden (${path.relative(process.cwd(), VJ)}) – Abgleich übersprungen`);

// Familien, Verb-Check, Fehlerfallen, Tipps
const benutzteFam = new Set(VERBEN.map(v => v && v.muster));
for (const [k, f] of Object.entries(FAM)) {
  if (!f || !istText(f.titel) || !istText(f.merk)) F(`Familie ${k}`, 'titel und merk');
  if (!benutzteFam.has(k)) W(`Familie ${k}`, 'kein Verb gehört dazu');
}
const VC = S.verbCheck;
if (VERBEN.length && !VC) F('verbCheck', 'fehlt');
if (VC) {
  if (!Array.isArray(VC.tage) || !VC.tage.length || !VC.tage.every(isDay)) F('verbCheck', 'tage: Liste von Tagen (JJJJ-MM-TT)');
  else {
    if (VC.tage.some((t, i) => i && t <= VC.tage[i - 1])) F('verbCheck', 'tage nicht aufsteigend');
    if (TEST && VC.tage.some(t => t >= TEST)) F('verbCheck', 'ein Check-Tag liegt nicht vor dem Test');
  }
  if (!(Number.isInteger(VC.proFamilie) && VC.proFamilie > 0)) F('verbCheck', 'proFamilie: ganze Zahl über 0');
  (VC.nichtZusammen || []).forEach((paar, k) => {
    if (!Array.isArray(paar) || paar.length < 2) return F('verbCheck', `nichtZusammen[${k}]: Paar von Verb-ids`);
    paar.forEach(id => { if (!VIDS.has(id)) F('verbCheck', `nichtZusammen[${k}]: Verb „${id}“ fehlt`); });
  });
}
const benutzteFallen = new Set(VERBEN.flatMap(v => (v && v.fallen) || []));
for (const [k, t] of Object.entries(FALLEN)) {
  if (!istText(t)) F(`fallen.${k}`, 'Text fehlt');
  if (!benutzteFallen.has(k)) W(`fallen.${k}`, 'kein Verb hat diese Fehlerfalle');
}
for (const [k, t] of Object.entries(S.tipps || {})) {
  if (!TIPP_ARTEN.includes(k)) W(`tipps.${k}`, 'unbekannte Fehlerart (die App kennt: ' + TIPP_ARTEN.join(', ') + ')');
  if (!istText(t)) F(`tipps.${k}`, 'Text fehlt');
}

// ================================================================
// Schreiben
// ================================================================
const SCH = S.schreiben;
const TRAENKE = new Set();
if (!SCH) W('schreiben', 'fehlt');
else {
  (SCH.traenke || []).forEach((t, i) => {
    const wo = `Trank ${t && t.id ? t.id : '#' + i}`;
    if (!t || !neueId(t.id, wo, true)) return;
    TRAENKE.add(t.id);
    if (!istText(t.titel)) F(wo, 'titel fehlt');
    const teil = SCH.teile && SCH.teile[t.id];
    if (!teil) return F(wo, 'teile: Eintrag fehlt');
    for (const k of ['bauplan', 'bausteine', 'checkliste']) if (!textListe(teil[k])) F(wo, `${k} fehlt`);
    if (!textListe(teil.herzeigen) || teil.herzeigen.length !== 3) F(wo, 'herzeigen: genau 3 Fragen');
  });
  if (!TRAENKE.size) F('schreiben', 'keine Schreib-Tränke');
  for (const k of Object.keys(SCH.teile || {})) if (!TRAENKE.has(k)) F(`teile.${k}`, 'kein Trank mit dieser id');
  if (!SCH.ganzerText || !textListe(SCH.ganzerText.checkliste)) F('schreiben', 'ganzerText.checkliste fehlt');
  const PERS = new Set();
  (SCH.personen || []).forEach((p, i) => {
    const wo = `Person ${p && p.id ? p.id : '#' + i}`;
    if (!p || !istText(p.id)) return F(wo, 'id fehlt');
    if (PERS.has(p.id)) F(wo, 'id doppelt');
    PERS.add(p.id);
    if (!istText(p.name)) F(wo, 'name fehlt');
    if (!textListe(p.steckbrief)) F(wo, 'steckbrief fehlt');
  });
  (SCH.auftraege || []).forEach((a, i) => {
    const wo = `Auftrag ${a && a.id ? a.id : '#' + i}`;
    if (!a || !neueId(a.id, wo, true)) return;
    if (!isDay(a.ab)) F(wo, 'ab fehlt (JJJJ-MM-TT)');
    else if (TEST && a.ab > TEST) F(wo, 'ab liegt nach dem Test');
    if (!textListe(a.traenke)) F(wo, 'traenke fehlen');
    else a.traenke.forEach(t => { if (!TRAENKE.has(t)) F(wo, `Trank „${t}“ fehlt`); });
    if (!istText(a.titel)) F(wo, 'titel fehlt');
    if (!istText(a.text)) W(wo, 'text fehlt');
    if (!(a.minuten > 0)) F(wo, 'minuten fehlen');
    if (!['offen', 'ueberarbeiten', 'zu'].includes(a.wortspeicher)) F(wo, 'wortspeicher: offen, ueberarbeiten oder zu');
    if (a.person != null && !PERS.has(a.person)) F(wo, `Person „${a.person}“ fehlt`);
    if (a.ganz && Array.isArray(a.traenke) && a.traenke.length !== TRAENKE.size) W(wo, 'ganzer Text, aber nicht alle Tränke');
  });
  if (!SCH.mustertext || !istText(SCH.mustertext.titel) || !textListe(SCH.mustertext.absaetze)) F('schreiben', 'mustertext: titel und absaetze');
  // Wortspeicher: Kategorien von oben nach unten, darin alphabetisch (de-AT) – nie in der Reihenfolge der Blätter
  const ws = SCH.wortspeicher;
  if (!Array.isArray(ws) || !ws.length) F('schreiben', 'wortspeicher fehlt');
  else {
    const kat = ws.map(w => w && w.kategorie);
    if (kat.join('|') !== WS_KATEGORIEN.join('|')) F('wortspeicher', `Kategorien in dieser Reihenfolge: ${WS_KATEGORIEN.join(' · ')} (steht: ${kat.join(' · ')})`);
    const coll = new Intl.Collator('de-AT');
    ws.forEach(w => {
      const wo = `wortspeicher ${w && w.kategorie}`;
      if (!w || !textListe(w.woerter)) return F(wo, 'woerter fehlen');
      const sortiert = w.woerter.slice().sort(coll.compare);
      if (sortiert.join('|') !== w.woerter.join('|')) F(wo, 'nicht alphabetisch (de-AT, ä wie a)');
      if (new Set(w.woerter).size !== w.woerter.length) F(wo, 'Wort doppelt');
    });
  }
}

// ================================================================
// Zauberbuch
// ================================================================
const ZB = new Set();
(Array.isArray(S.zauberbuch) ? S.zauberbuch : []).forEach((z, i) => {
  const wo = `Zauberbuch ${z && z.id ? z.id : '#' + i}`;
  if (!z || !istText(z.id)) return F(wo, 'id fehlt');
  if (ZB.has(z.id)) F(wo, 'id doppelt');
  ZB.add(z.id);
  if (!istText(z.titel)) F(wo, 'titel fehlt');
  htmlPruefen(wo, z.html);
});
if (!ZB.size) W('zauberbuch', 'leer');

// ================================================================
// Verbotene Wörter im ganzen Text (ganze Wörter, Groß/klein egal)
// ================================================================
for (const w of VERBOTEN) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, 'giu');
  const zeilen = QUELLE.split('\n').map((z, i) => re.test(z) ? i + 1 : 0).filter(Boolean);
  if (zeilen.length) F('stoff.js', `verbotenes Wort (${w[0]}…) in Zeile ${zeilen.slice(0, 8).join(', ')}`);
}

// ================================================================
// Zählung je Rolle
// ================================================================
const n = { ziel: 0, extra: 0, nachschlagen: 0 };
for (const p of PAK.values()) {
  const k = p.karten.length + 2 * p.verben;
  if (!k) W(`Paket ${p.id}`, 'hat keine Karten');
  if (n[p.rolle] != null) n[p.rolle] += k;
  const b = BER.get(p.bereich);
  if (b && b.n[p.rolle] != null) b.n[p.rolle] += k;
  // Klasse im Blitz-Check: ohne check je Karte (pool → regel, sonst einzel)
  if (p.check === 'regel' && p.karten.some(c => c.pool == null)) W(`Paket ${p.id}`, 'check regel, aber Einzelkarten darin');
  if (p.check === 'einzel' && p.karten.some(c => c.pool != null)) W(`Paket ${p.id}`, 'check einzel, aber Regel-Karten darin');
}
for (const r of Object.keys(SOLL)) if (n[r] !== SOLL[r]) F('Zählung', `${r}: ${n[r]} Karten, Soll ${SOLL[r]} (lernmodell 3a)`);

// ================================================================
// Register veröffentlichter ids
// ================================================================
const REG = arg('--register') || path.join(DIR, 'tools', 'ids.txt');
const reg = fs.existsSync(REG) ? fs.readFileSync(REG, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')) : [];
const weg = reg.filter(id => !REGISTER.has(id));
if (weg.length) F('ids.txt', `${weg.length} veröffentlichte ids fehlen in stoff.js (Fortschritt ginge verloren): ${weg.slice(0, 12).join(', ')}${weg.length > 12 ? ' …' : ''}`);
if (process.argv.includes('--merken')) {
  if (fehler.length) { console.log('ids.txt: nicht gemerkt, solange es Fehler gibt'); }
  else {
    const alle = [...new Set([...reg, ...[...REGISTER].filter(id => !id.startsWith('demo-'))])];
    fs.writeFileSync(REG, '# Alle ids, die je veröffentlicht wurden – nie löschen, nie wiederverwenden (stoff-pruefen.mjs --merken)\n' + alle.join('\n') + '\n');
    console.log(`ids.txt: ${alle.length} ids gemerkt`);
  }
}

// ================================================================
// Ausgabe
// ================================================================
const poolBsp = Object.values(POOLS).reduce((a, l) => a + (Array.isArray(l) ? l.length : 0), 0);
console.log(`stoff.js (Format ${S.format}): ${n.ziel + n.extra + n.nachschlagen} Karten · Ziel ${n.ziel} · Extra ${n.extra} · Nachschlagen ${n.nachschlagen}` +
  `  (Soll ${SOLL.ziel} · ${SOLL.extra} · ${SOLL.nachschlagen})`);
console.log(`  ${PAK.size} Pakete · ${Object.keys(POOLS).length} Pools mit ${poolBsp} Beispielen · ${VERBEN.length} Verben (= ${2 * VERBEN.length} Karten) · ` +
  `Einträge in karten: ${Object.entries(proTyp).map(([t, k]) => `${t} ${k}`).join(', ')}`);
for (const b of BER.values()) console.log(`  ${b.titel || b.id}: Ziel ${b.n.ziel} · Extra ${b.n.extra} · Nachschlagen ${b.n.nachschlagen}`);
for (const r of ['ziel', 'extra', 'nachschlagen']) {
  const ps = [...PAK.values()].filter(p => p.rolle === r);
  console.log(`  ${r}: ` + ps.map(p => `${p.id} ${p.karten.length + 2 * p.verben}`).join(' · '));
}
if (SCH) console.log(`  Schreiben: ${TRAENKE.size} Tränke · ${(SCH.auftraege || []).length} Aufträge · ${(SCH.personen || []).length} Personen · Wortspeicher ` +
  `${(SCH.wortspeicher || []).reduce((a, w) => a + ((w && w.woerter) || []).length, 0)} Einträge · Zauberbuch ${ZB.size} Regelkarten`);
if (TEST) console.log(`  Termin: ${S.test.titel || 'Test'} am ${S.test.datum} (eingetragen ${S.test.eingetragen || '–'}) · Register: ${REGISTER.size} ids mit Fortschritt, ids.txt ${reg.length}`);
warn.forEach(x => console.log('Warnung: ' + x));
fehler.forEach(x => console.log('FEHLER:  ' + x));
console.log(fehler.length ? `${fehler.length} Fehler` : 'keine Fehler');
process.exit(fehler.length ? 1 : 0);
