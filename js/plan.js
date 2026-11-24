// Standard-Trainingsplan (Startwerte). Später in der App änderbar (Tab „Plan“).
import { STANDARD_HAUT_PLAN, STANDARD_HAUT_ZEITEN, STANDARD_HAUT_PRODUKTE } from './haut.js';
//
// Arten:
//  band-hilfe      Band hilft (Klimmzüge, Chin-ups, Dips). Optional freie Sätze vorweg.
//  hantel          Kurzhanteln, Gewicht in kg PRO HANTEL.
//  maschine        Maschine oder Kabel, Gewicht in kg (eingestelltes Gewicht).
//  maschine-hilfe  Maschine mit Unterstützung (z. B. Klimmzug-Maschine): weniger kg = stärker.
//  koerper         nur Körpergewicht.
//  band-widerstand Band macht es schwerer (Face Pulls mit Band).
//  ausdauer        Ausdauer in Minuten (z. B. Laufband), ohne Steigerung.

export const BAND_FARBEN = {
  gelb: '#facc15', rot: '#ef4444', schwarz: '#141414', lila: '#a855f7', grün: '#22c55e',
};

// Version des Standardplans. Höher als auf dem iPhone gespeichert → Plan wird beim Öffnen umgestellt.
export const PLAN_VERSION = 4;

// Gym-Plan (ab 15.11.2026): Mo / Mi / Fr, ca. 60 Min.
export const STANDARD_UEBUNGEN = [
  // Montag – Brust und Rücken
  { id: 'schraegbank_kh', name: 'Schrägbankdrücken Kurzhantel', art: 'hantel', saetze: 3, min: 8, max: 10, startKg: 12, schritt: 2, maxKg: null },
  { id: 'klimmzug_maschine', name: 'Klimmzug-Maschine (Unterstützung)', art: 'maschine-hilfe', saetze: 3, min: 6, max: 10, startKg: 30, schritt: 5 },
  { id: 'brustpresse', name: 'Brustpresse', art: 'maschine', saetze: 3, min: 8, max: 12, startKg: 30, schritt: 5 },
  { id: 'kabelrudern', name: 'Kabelrudern sitzend', art: 'maschine', saetze: 3, min: 8, max: 12, startKg: 35, schritt: 5 },
  { id: 'seitheben_kabel', name: 'Seitheben am Kabel', art: 'maschine', saetze: 4, min: 12, max: 20, startKg: 5, schritt: 2.5 },
  { id: 'beinpresse', name: 'Beinpresse', art: 'maschine', saetze: 2, min: 8, max: 12, startKg: 60, schritt: 10 },
  // Mittwoch – Schultern und Arme
  { id: 'schulterpresse', name: 'Schulterpresse', art: 'maschine', saetze: 3, min: 8, max: 10, startKg: 20, schritt: 5 },
  { id: 'latzug', name: 'Latzug', art: 'maschine', saetze: 3, min: 8, max: 12, startKg: 35, schritt: 5 },
  { id: 'facepull_kabel', name: 'Face Pulls (Kabel)', art: 'maschine', saetze: 3, min: 12, max: 20, startKg: 15, schritt: 2.5 },
  { id: 'curls_kabel', name: 'Curls am Kabel', art: 'maschine', saetze: 3, min: 10, max: 15, startKg: 15, schritt: 2.5 },
  { id: 'trizeps_kabel', name: 'Trizepsdrücken am Kabel', art: 'maschine', saetze: 3, min: 10, max: 15, startKg: 15, schritt: 2.5 },
  { id: 'beinbeuger', name: 'Beinbeuger', art: 'maschine', saetze: 2, min: 10, max: 12, startKg: 30, schritt: 5 },
  // Freitag – Brust, Rücken, Arme
  { id: 'klimmzug_neutral', name: 'Klimmzug-Maschine neutraler Griff', art: 'maschine-hilfe', saetze: 3, min: 6, max: 10, startKg: 30, schritt: 5 },
  { id: 'schraegbank_maschine', name: 'Schrägbank-Maschine (oder Dips)', art: 'maschine', saetze: 3, min: 8, max: 12, startKg: 30, schritt: 5 },
  { id: 'rudern', name: 'Einarmiges Kurzhantelrudern', art: 'hantel', saetze: 3, min: 8, max: 12, proSeite: 'pro Arm', startKg: 12, schritt: 2, maxKg: null },
  { id: 'fliegende_kabel', name: 'Fliegende am Kabel (unten → oben)', art: 'maschine', saetze: 3, min: 12, max: 15, startKg: 7.5, schritt: 2.5 },
  // Ab Plan-Version 3 (15.11.2026) am Freitag statt Kurzhantelrudern und Fliegenden:
  // vorgaenger: frühere Übung mit denselben Gewichten (zählt für Steigerung, Kraft und Rang mit).
  // Montags-„Kabelrudern“ wurde in Wahrheit an der Brustpolster-Maschine gemacht (Nutzer, 24.11.2026).
  { id: 'rudermaschine', name: 'Rudermaschine (brustgestützt)', art: 'maschine', saetze: 3, min: 8, max: 12, startKg: 35, schritt: 5, vorgaenger: ['kabelrudern'] },
  { id: 'butterfly', name: 'Butterfly-Maschine', art: 'maschine', saetze: 3, min: 12, max: 15, startKg: 30, schritt: 5 },
  { id: 'hammercurls', name: 'Hammercurls', art: 'hantel', saetze: 3, min: 10, max: 15, startKg: 10, schritt: 2, maxKg: null },
  { id: 'trizeps_kopf_kabel', name: 'Trizeps über Kopf am Kabel', art: 'maschine', saetze: 3, min: 10, max: 15, startKg: 15, schritt: 2.5 },
  // Ab Plan-Version 4 (24.11.2026): Seitheben immer mit Kurzhanteln (die Werte vom „Kabel“ waren schon Hanteln),
  // Reverse Butterfly statt Face Pulls (andere Maschine → eigener Start, alte Werte bleiben im Verlauf).
  { id: 'seitheben_kh', name: 'Seitheben Kurzhanteln', art: 'hantel', saetze: 4, min: 12, max: 20, startKg: 5, schritt: 2, maxKg: null, vorgaenger: ['seitheben_kabel'] },
  { id: 'reverse_butterfly', name: 'Reverse Butterfly (Maschine)', art: 'maschine', saetze: 3, min: 12, max: 15, startKg: 25, schritt: 5 },
  // Am Ende jedes Trainings
  { id: 'laufband', name: 'Laufband mit Steigung', art: 'ausdauer', saetze: 1, min: 10, max: 20 },
];

// Früherer Heimtrainingsplan (bis 14.11.2026) – bleibt für Verlauf und Tests erhalten.
export const HEIM_UEBUNGEN = [
  { id: 'klimmzug', name: 'Klimmzüge', art: 'band-hilfe', saetze: 3, min: 5, max: 8, frei: { saetze: 3, wdh: 2 }, startBand: 'grün', bandWegAb: 5, freiSaetzeOhneBand: 4 },
  { id: 'dips', name: 'Dips', art: 'band-hilfe', saetze: 3, min: 5, max: 8, frei: null, startBand: 'schwarz', ohneBand: { min: 5, max: 10 }, maxSaetze: 4 },
  { id: 'seitheben', name: 'Seitheben', art: 'hantel', saetze: 4, min: 12, max: 20, startKg: 5, schritt: 2.5, maxKg: 15 },
  { id: 'bss', name: 'Bulgarian Split Squats', art: 'hantel', saetze: 3, min: 8, max: 12, proSeite: 'pro Bein', startKg: 5, schritt: 2.5, maxKg: 15 },
  { id: 'knieheben', name: 'Knieheben an der Stange', art: 'koerper', saetze: 3, min: 8, max: 15, hinweis: 'Beine gestreckt anheben' },
  { id: 'chinup', name: 'Chin-ups', art: 'band-hilfe', saetze: 3, min: 5, max: 8, frei: { saetze: 3, wdh: 2 }, startBand: 'grün', bandWegAb: 5, freiSaetzeOhneBand: 4 },
  { id: 'pike', name: 'Pike-Liegestütze', art: 'koerper', saetze: 3, min: 6, max: 10, hinweis: 'Füße erhöhen' },
  { id: 'facepull', name: 'Face Pulls (Band)', art: 'band-widerstand', saetze: 3, min: 15, max: 20, startBand: 'rot' },
  { id: 'rdl', name: 'Rumänisches Kreuzheben', art: 'hantel', saetze: 3, min: 8, max: 12, startKg: 12.5, schritt: 2.5, maxKg: 15 },
  { id: 'liegestuetz', name: 'Liegestütze Füße erhöht', art: 'koerper', saetze: 3, min: 8, max: 15, hinweis: 'Füße höher oder langsamer' },
  { id: 'curls', name: 'Curls', art: 'hantel', saetze: 2, min: 10, max: 15, startKg: 7.5, schritt: 2.5, maxKg: 15 },
  { id: 'trizeps', name: 'Trizeps über Kopf', art: 'hantel', saetze: 2, min: 10, max: 15, startKg: 10, schritt: 2.5, maxKg: 15 },
];

// Austausch beim Umstieg auf Plan-Version 3 (nur Tag C, andere Änderungen bleiben).
export const TAUSCH_V3 = { schraegbank_maschine: 'brustpresse', rudern: 'rudermaschine', fliegende_kabel: 'butterfly' };
// Austausch beim Umstieg auf Plan-Version 4 (24.11.2026), ebenfalls nur diese Übungen.
export const TAUSCH_V4 = { kabelrudern: 'rudermaschine', seitheben_kabel: 'seitheben_kh', facepull_kabel: 'reverse_butterfly' };

export const STANDARD_TAGE = [
  { id: 'A', name: 'Brust und Rücken', wochentag: 1,
    paare: [['schraegbank_kh'], ['klimmzug_maschine'], ['brustpresse'], ['rudermaschine'], ['seitheben_kh'], ['beinpresse'], ['laufband']] },
  { id: 'B', name: 'Schultern und Arme', wochentag: 3,
    paare: [['schulterpresse'], ['latzug'], ['seitheben_kh'], ['reverse_butterfly'], ['curls_kabel', 'trizeps_kabel'], ['beinbeuger'], ['laufband']] },
  { id: 'C', name: 'Brust, Rücken, Arme', wochentag: 5,
    paare: [['klimmzug_neutral'], ['brustpresse'], ['rudermaschine'], ['butterfly'], ['seitheben_kh'], ['hammercurls', 'trizeps_kopf_kabel'], ['laufband']] },
];

export const STANDARD_EINSTELLUNGEN = {
  pauseSek: 90,
  wochenZiel: 3,
  baender: ['gelb', 'rot', 'schwarz', 'lila', 'grün'], // leicht → schwer
  letzterExport: null,
  ersteNutzung: null,
  timerEnde: null,
  tagWahl: null,
  erinnerungAus: {},
  planVersion: 1,
  // Hautpflege
  hautPlan: [...STANDARD_HAUT_PLAN],
  hautZeiten: { ...STANDARD_HAUT_ZEITEN },
  hautProdukte: STANDARD_HAUT_PRODUKTE.map(p => ({ ...p })),
  hautPush: { an: false },
};

export const ARTEN = {
  'hantel': 'Kurzhanteln (kg pro Hantel)',
  'maschine': 'Maschine / Kabel (kg)',
  'maschine-hilfe': 'Maschine mit Unterstützung (kg)',
  'koerper': 'Körpergewicht',
  'band-hilfe': 'Band als Hilfe (Klimmzug, Dips)',
  'band-widerstand': 'Band als Widerstand',
  'ausdauer': 'Ausdauer (Minuten)',
};

// Kraft-Richtwerte je Übung: [Beginner, Novice, Intermediate, Advanced, Elite] als 1RM ÷ Körpergewicht (Männer).
// Neu kalibriert am 25.11.2026 nach Strength Level (Zeile 70 kg Körpergewicht), Quellen und Begründung: S:\Gym-App\RANG_QUELLEN.md
// Ränge: Silber = Novice (stärker als 20 %), Gold = Intermediate (50 %), Diamant = Advanced (80 %), Smaragd = Elite (95 %), Rubin = Schätzung darüber.
// Kurzhanteln: pro Hantel. Klimmzug-Maschine: bewegtes Gewicht = Körpergewicht − Unterstützung.
export const RANG_STANDARDS = {
  schraegbank_kh: [0.257, 0.357, 0.486, 0.643, 0.8], // Incline Dumbbell Bench Press
  klimmzug_maschine: [0.971, 1.186, 1.443, 1.714, 2.014], // Pull Ups (Körpergewicht + Zusatz)
  klimmzug_neutral: [0.971, 1.186, 1.443, 1.714, 2.014], // Neutral Grip Pull Ups ≈ Pull Ups
  brustpresse: [0.471, 0.757, 1.143, 1.6, 2.1], // Chest Press
  rudermaschine: [0.6, 1, 1.529, 2.171, 2.886], // keine eigenen Daten: FitnessVolt Machine Row × 1,2 Hebel-Zuschlag (Schätzung)
  seitheben_kh: [0.057, 0.129, 0.214, 0.329, 0.457], // Dumbbell Lateral Raise
  beinpresse: [1.286, 1.986, 2.886, 3.957, 5.129], // Sled Leg Press
  schulterpresse: [0.329, 0.6, 0.943, 1.386, 1.871], // Machine Shoulder Press
  latzug: [0.6, 0.814, 1.1, 1.414, 1.757], // Lat Pulldown
  reverse_butterfly: [0.343, 0.557, 0.843, 1.171, 1.557], // Machine Reverse Fly
  curls_kabel: [0.243, 0.414, 0.657, 0.957, 1.3], // Cable Bicep Curl
  trizeps_kabel: [0.257, 0.443, 0.714, 1.043, 1.4], // Tricep Pushdown
  beinbeuger: [0.486, 0.743, 1.086, 1.471, 1.914], // Seated Leg Curl
  butterfly: [0.514, 0.786, 1.129, 1.529, 1.986], // Machine Chest Fly
  hammercurls: [0.129, 0.2, 0.3, 0.414, 0.557], // Hammer Curl
  trizeps_kopf_kabel: [0.157, 0.314, 0.529, 0.814, 1.129], // Cable Overhead Tricep Extension
  // Alte Übungen (nur noch im Verlauf), unverändert geschätzt:
  kabelrudern: [0.5, 0.75, 1.05, 1.4, 1.8],
  seitheben_kabel: [0.08, 0.15, 0.25, 0.38, 0.5],
  facepull_kabel: [0.25, 0.4, 0.6, 0.85, 1.1],
  rudern: [0.2, 0.35, 0.55, 0.8, 1.1],
  fliegende_kabel: [0.1, 0.2, 0.35, 0.55, 0.8],
  schraegbank_maschine: [0.3, 0.55, 1.25, 1.6, 2.3],
};

export const WOCHENTAGE = ['—', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']; // Index 1 = Montag
