// Standard-Trainingsplan (Startwerte beim allerersten Öffnen). Später in der App änderbar (Tab „Plan“).
//
// Arten:
//  band-hilfe      Band hilft (Klimmzüge, Chin-ups, Dips). Optional freie Sätze vorweg.
//  hantel          Kurzhanteln, Gewicht in kg PRO HANTEL.
//  koerper         nur Körpergewicht.
//  band-widerstand Band macht es schwerer (Face Pulls).

export const BAND_FARBEN = {
  gelb: '#facc15', rot: '#ef4444', schwarz: '#141414', lila: '#a855f7', grün: '#22c55e',
};

export const STANDARD_UEBUNGEN = [
  { id: 'klimmzug', name: 'Klimmzüge', art: 'band-hilfe', saetze: 3, min: 5, max: 8,
    frei: { saetze: 3, wdh: 2 }, startBand: 'grün', bandWegAb: 5, freiSaetzeOhneBand: 4 },
  { id: 'dips', name: 'Dips', art: 'band-hilfe', saetze: 3, min: 5, max: 8,
    frei: null, startBand: 'schwarz', ohneBand: { min: 5, max: 10 }, maxSaetze: 4 },
  { id: 'seitheben', name: 'Seitheben', art: 'hantel', saetze: 4, min: 12, max: 20, startKg: 5, schritt: 2.5, maxKg: 15 },
  { id: 'rudern', name: 'Einarmiges Rudern', art: 'hantel', saetze: 3, min: 8, max: 12, proSeite: 'pro Arm', startKg: 10, schritt: 2.5, maxKg: 15 },
  { id: 'bss', name: 'Bulgarian Split Squats', art: 'hantel', saetze: 3, min: 8, max: 12, proSeite: 'pro Bein', startKg: 5, schritt: 2.5, maxKg: 15 },
  { id: 'knieheben', name: 'Knieheben an der Stange', art: 'koerper', saetze: 3, min: 8, max: 15, hinweis: 'Beine gestreckt anheben' },
  { id: 'chinup', name: 'Chin-ups', art: 'band-hilfe', saetze: 3, min: 5, max: 8,
    frei: { saetze: 3, wdh: 2 }, startBand: 'grün', bandWegAb: 5, freiSaetzeOhneBand: 4 },
  { id: 'pike', name: 'Pike-Liegestütze', art: 'koerper', saetze: 3, min: 6, max: 10, hinweis: 'Füße erhöhen' },
  { id: 'facepull', name: 'Face Pulls (Band)', art: 'band-widerstand', saetze: 3, min: 15, max: 20, startBand: 'rot' },
  { id: 'rdl', name: 'Rumänisches Kreuzheben', art: 'hantel', saetze: 3, min: 8, max: 12, startKg: 12.5, schritt: 2.5, maxKg: 15 },
  { id: 'liegestuetz', name: 'Liegestütze Füße erhöht', art: 'koerper', saetze: 3, min: 8, max: 15, hinweis: 'Füße höher oder langsamer' },
  { id: 'curls', name: 'Curls', art: 'hantel', saetze: 2, min: 10, max: 15, startKg: 7.5, schritt: 2.5, maxKg: 15 },
  { id: 'trizeps', name: 'Trizeps über Kopf', art: 'hantel', saetze: 2, min: 10, max: 15, startKg: 10, schritt: 2.5, maxKg: 15 },
];

export const STANDARD_TAGE = [
  { id: 'A', name: 'Breite', paare: [['klimmzug', 'dips'], ['seitheben', 'rudern'], ['bss', 'knieheben']] },
  { id: 'B', name: 'Schultern/Arme', paare: [['chinup', 'pike'], ['seitheben', 'facepull'], ['rdl', 'liegestuetz'], ['curls', 'trizeps']] },
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
};

export const ARTEN = {
  'band-hilfe': 'Band als Hilfe (Klimmzug, Dips)',
  'hantel': 'Hanteln (kg)',
  'koerper': 'Körpergewicht',
  'band-widerstand': 'Band als Widerstand',
};
