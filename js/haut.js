// Hautpflege: Wochenplan, Schritte, Serie und Retinal-Haltbarkeit.
// Reine Rechen-Funktionen ohne Bildschirm und ohne Datenbank, damit sie sich automatisch testen lassen.
import { parseDatum, heute, addTage } from './util.js';

export const WIRKSTOFFE = {
  retinal: { name: 'Retinal', kurz: 'Ret', produkt: 'retinal' },
  bha: { name: 'BHA', kurz: 'BHA', produkt: 'bha' },
  pause: { name: 'Pause', kurz: '–', produkt: null },
};

// Index 0 = Montag … 6 = Sonntag
export const HAUT_WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const HAUT_WOCHENTAGE_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const STANDARD_HAUT_PLAN = ['retinal', 'pause', 'bha', 'retinal', 'pause', 'retinal', 'pause'];

// Uhrzeiten für die Push-Erinnerungen (nur volle und halbe Stunden, weil der Server alle 30 Minuten prüft).
export const STANDARD_HAUT_ZEITEN = { morgenWoche: '06:30', morgenWochenende: '08:00', abend: '20:00' };

export const STANDARD_HAUT_PRODUKTE = [
  { id: 'reinigung', name: 'CeraVe Reinigungsgel', geoeffnet: null },
  { id: 'lsf', name: 'CeraVe LSF 50', geoeffnet: null },
  { id: 'retinal', name: 'Geek & Gorgeous A-Game 5', geoeffnet: null, haltbarMonate: 6 },
  { id: 'bha', name: 'Salicylsäure 2 % (BHA)', geoeffnet: null },
  { id: 'nachtcreme', name: 'CeraVe Nachtcreme', geoeffnet: null },
];

export const SCHRITTE = {
  morgen: [
    { id: 'reinigung', name: 'Reinigung', produkt: 'reinigung' },
    { id: 'lsf', name: 'LSF 50', produkt: 'lsf' },
  ],
  abend: [
    { id: 'reinigung', name: 'Reinigungsgel', produkt: 'reinigung' },
    { id: 'wirkstoff', name: null, produkt: null },
    { id: 'nachtcreme', name: 'Nachtcreme', produkt: 'nachtcreme' },
  ],
};

// 0 = Montag … 6 = Sonntag
export function wochentagIndex(datum) {
  return (parseDatum(datum).getDay() + 6) % 7;
}

export function wirkstoffAm(plan, datum) {
  const w = (plan || STANDARD_HAUT_PLAN)[wochentagIndex(datum)];
  return WIRKSTOFFE[w] ? w : 'pause';
}

// Wirkstoff eines Tages: Wurde schon etwas abgehakt, gilt der damals gespeicherte Wirkstoff
// (spätere Planänderungen verändern den Verlauf nicht).
export function wirkstoffFuer(eintrag, plan, datum) {
  return eintrag?.wirkstoff && WIRKSTOFFE[eintrag.wirkstoff] ? eintrag.wirkstoff : wirkstoffAm(plan, datum);
}

// Die Schritte eines Tagesteils. An Pause-Tagen fällt der Wirkstoff weg.
export function schritteFuer(teil, wirkstoff) {
  return SCHRITTE[teil].filter(s => s.id !== 'wirkstoff' || wirkstoff !== 'pause')
    .map(s => s.id === 'wirkstoff' ? { ...s, name: WIRKSTOFFE[wirkstoff].name, produkt: WIRKSTOFFE[wirkstoff].produkt } : s);
}

export function teilStand(eintrag, teil, wirkstoff) {
  const schritte = schritteFuer(teil, wirkstoff);
  const erledigt = schritte.filter(s => eintrag?.[teil]?.[s.id]).length;
  return { erledigt, gesamt: schritte.length, fertig: erledigt === schritte.length };
}

// Ein Tag zählt für die Serie, wenn Morgen- UND Abendroutine komplett sind.
export function tagFertig(eintrag, plan, datum) {
  const w = wirkstoffFuer(eintrag, plan, datum);
  return teilStand(eintrag, 'morgen', w).fertig && teilStand(eintrag, 'abend', w).fertig;
}

// Serie: Tage am Stück mit kompletter Routine. Ist heute noch offen, reißt die Serie nicht.
// eintraege: Objekt { 'JJJJ-MM-TT': eintrag }
export function hautSerie(eintraege, plan, heuteDatum) {
  let d = heuteDatum;
  if (!tagFertig(eintraege[d], plan, d)) d = addTage(d, -1);
  let n = 0;
  while (tagFertig(eintraege[d], plan, d) && n < 10000) { n++; d = addTage(d, -1); }
  return n;
}

// Status eines Tages für den Kalender: 'voll', 'halb' oder 'leer'.
export function tagStatus(eintrag, plan, datum) {
  if (tagFertig(eintrag, plan, datum)) return 'voll';
  const w = wirkstoffFuer(eintrag, plan, datum);
  const m = teilStand(eintrag, 'morgen', w), a = teilStand(eintrag, 'abend', w);
  return m.erledigt + a.erledigt > 0 ? 'halb' : 'leer';
}

// Datum + n Monate (31. Jan + 1 Monat → 28./29. Feb).
export function addMonate(datum, n) {
  const d = parseDatum(datum);
  const tag = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const letzter = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(tag, letzter));
  return heute(d);
}

// Haltbarkeit eines Produkts nach dem Öffnen (nur wenn haltbarMonate gesetzt ist).
export function haltbarkeit(produkt, heuteDatum) {
  if (!produkt?.geoeffnet || !produkt.haltbarMonate) return null;
  const ablauf = addMonate(produkt.geoeffnet, produkt.haltbarMonate);
  let monate = 0;
  while (monate < 1000 && addMonate(produkt.geoeffnet, monate + 1) <= heuteDatum) monate++;
  return { ablauf, faellig: heuteDatum >= ablauf, monateOffen: monate };
}

// Morgens unter der Woche (Mo–Fr) und am Wochenende (Sa–So) gelten verschiedene Uhrzeiten.
export function morgenZeit(zeiten, datum) {
  return wochentagIndex(datum) >= 5 ? zeiten.morgenWochenende : zeiten.morgenWoche;
}

// Gültige Uhrzeiten zur Auswahl: 04:00 bis 23:30 in 30-Minuten-Schritten.
export function zeitOptionen() {
  const out = [];
  for (let h = 4; h < 24; h++) for (const m of ['00', '30']) out.push(`${String(h).padStart(2, '0')}:${m}`);
  return out;
}
export function istGueltigeZeit(z) {
  return /^([01]\d|2[0-3]):(00|30)$/.test(String(z));
}

// Fehlende Standardprodukte ergänzen (z. B. nach einem Update), eigene Änderungen bleiben.
export function produkteErgaenzen(liste) {
  const vorhanden = Array.isArray(liste) ? liste.filter(p => p && p.id) : [];
  const ids = new Set(vorhanden.map(p => p.id));
  return [...vorhanden, ...STANDARD_HAUT_PRODUKTE.filter(p => !ids.has(p.id)).map(p => ({ ...p }))];
}
