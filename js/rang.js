// Rangliste: Bronze → Silber → Gold → Diamant → Smaragd → Rubin.
// Gesamtrang = Mischung aus
//  • Kraft-Rang je Übung (geschätztes Maximalgewicht im Verhältnis zum Körpergewicht, beste Leistung der letzten 6 Wochen)
//  • Disziplin-Rang (Punkte/XP für Trainings, Wochenziel, Serie, Rekorde, Steigerungen)
// Rechnung: Durchschnitt der Übungs-Ränge, gerundet. Ist die Disziplin höher, hebt sie den Schnitt
// um 25 % des Abstands an (sie zieht nie nach unten).
// Beispiel: 4 × Gold + 2 × Silber → Ø 1,67 → gerundet Gold.
import { S } from './store.js';
import { einheitenSortiert, hatSaetze, gleicheIds, nachfolgerVon } from './training.js';
import { leistung } from './progression.js';
import { RANG_STANDARDS } from './plan.js';
import { heute, addTage, wochenStart } from './util.js';

export const RAENGE = ['Bronze', 'Silber', 'Gold', 'Diamant', 'Smaragd', 'Rubin'];
// Strenger seit 24.11.2026 (vorher 0/1500/4000/8000/14000/22000): Silber nach ca. 3–4 Wochen, Rubin nach rund einem Jahr.
export const XP_GRENZEN = [0, 3000, 8000, 16000, 28000, 45000];
export const KRAFT_TAGE = 42;

export function koerpergewicht() {
  const g = S.messungen.filter(m => m.art === 'gewicht').sort((a, b) => (a.datum < b.datum ? -1 : 1)).pop();
  return { kg: g?.wert || 70, geschaetzt: !g };
}

// Rang aus Wert und 6 Startgrenzen (Rang i beginnt bei grenzen[i]).
export function rangAus(wert, grenzen) {
  let i = 0;
  while (i < 5 && wert >= grenzen[i + 1]) i++;
  const lo = grenzen[i], hi = grenzen[i + 1];
  const anteil = hi == null ? 1 : Math.max(0, Math.min(1, (wert - lo) / (hi - lo)));
  return { i, anteil, naechste: hi ?? null };
}

// Kraft-Richtwerte → Startgrenzen der 6 Ränge (als Vielfaches des Körpergewichts).
// Seit 25.11.2026 an Strength-Level-Stufen gekoppelt (Quellen: S:Gym-AppRANG_QUELLEN.md):
// Silber = Novice (stärker als 20 %), Gold = Intermediate (50 %), Diamant = Advanced (80 %), Smaragd = Elite (95 %),
// Rubin = Elite + 60 % des Abstands Advanced→Elite (Schätzung für die obersten ~1–2 %).
export function kraftGrenzen(std) {
  const [, novice, inter, adv, elite] = std;
  return [0, novice, inter, adv, elite, elite + 0.6 * (elite - adv)];
}

// Geschätztes Maximalgewicht (1 Wdh.) eines Satzes, Formel nach Epley.
export function e1rm(satz, teil, bw) {
  const kg = typeof satz.kg === 'number' ? satz.kg : teil?.kg ?? 0;
  // Über 12 Wdh. überschätzt die Formel das Maximalgewicht stark → höchstens 12 Wdh. werten.
  const wdh = Math.min(satz.wdh, 12);
  if (!satz.wdh) return 0;
  if (teil?.typ === 'hilfe-kg') return Math.max(0, bw - kg) * (1 + wdh / 30);
  if (teil?.typ === 'hantel') return kg * (1 + wdh / 30);
  return 0;
}

// Diamant, Smaragd und Rubin zählen erst, wenn der Wert in mindestens 2 verschiedenen Trainings erreicht wurde
// (kein hoher Rang durch einen einzelnen Ausreißer). Sonst höchstens Gold bzw. der Rang des zweitbesten Trainings.
export const BESTAETIGEN_AB = 3;
export function rangMitBestaetigung(proTraining, grenzen) {
  const w = [...proTraining].sort((a, b) => b - a);
  const r = rangAus(w[0] || 0, grenzen);
  if (r.i < BESTAETIGEN_AB) return r;
  const i2 = rangAus(w[1] || 0, grenzen).i;
  if (i2 >= r.i) return r;
  const i = Math.max(BESTAETIGEN_AB - 1, i2);
  return { i, anteil: 1, naechste: grenzen[i + 1], bestaetigen: r.i };
}

// Ränge aller Übungen im aktuellen Plan, die Richtwerte haben.
export function uebungsRaenge() {
  const { kg: bw } = koerpergewicht();
  const start = addTage(heute(), -KRAFT_TAGE);
  const ids = [...new Set(Object.values(S.tage).flatMap(t => t.paare.flat()))];
  const out = [];
  for (const id of ids) {
    const ex = S.uebungen[id];
    const std = ex?.standard || RANG_STANDARDS[id];
    if (!ex || !std) continue;
    let best = 0, bestSatz = null, bestTeil = null;
    const proTraining = []; // bester Wert je Training (für die 2-Trainings-Regel)
    for (const e of S.einheiten) {
      if (e.datum < start) continue;
      const gleiche = gleicheIds(id); // inkl. Vorgänger mit denselben Gewichten
      let bestHier = 0;
      for (const en of (e.eintraege || []).filter(x => gleiche.has(x.uebung))) {
        for (const s of en.saetze) {
          const teil = en.ziel?.teile?.[s.teil];
          const v = e1rm(s, teil, bw);
          if (v > bestHier) bestHier = v;
          if (v > best) { best = v; bestSatz = s; bestTeil = teil; }
        }
      }
      if (bestHier > 0) proTraining.push(bestHier);
    }
    if (!best) { out.push({ ex, ohneDaten: true }); continue; }
    const grenzen = kraftGrenzen(std).map(x => x * bw);
    out.push({ ex, e1rm: best, satz: bestSatz, teil: bestTeil, bw, ...rangMitBestaetigung(proTraining, grenzen) });
  }
  return out;
}

// Disziplin-Punkte aus dem ganzen Verlauf (ohne das Training mit der ID „ohne“).
export function disziplinXP(ohne = null) {
  const ziel = S.einst.wochenZiel || 3;
  const { kg: bw } = koerpergewicht();
  const liste = einheitenSortiert().filter(e => hatSaetze(e) && e.id !== ohne);
  if (!liste.length) return 0;
  let xp = 0;
  const proWoche = {};
  const bestBisher = {};
  // Rekord- und Steigerungs-Punkte nur für Übungen aus dem aktuellen Plan.
  const imPlan = new Set(Object.values(S.tage).flatMap(t => t.paare.flat()));
  for (const e of liste) {
    xp += 100;
    const komplett = e.eintraege.every(en => en.saetze.length >= (en.ziel?.teile || []).reduce((n, t) => n + t.saetze, 0));
    if (komplett) xp += 50;
    for (const en of e.eintraege) {
      // Vorgänger (z. B. Kabelrudern) zählen als ihre neue Übung (Rudermaschine).
      const id = nachfolgerVon(en.uebung, imPlan);
      if (!en.saetze?.length || !imPlan.has(id)) continue;
      if (en.gesteigert) xp += 20;
      const ex = S.uebungen[id];
      if (!ex) continue;
      const v = leistung(ex, en, S.einst.baender, bw);
      if (v == null) continue;
      if (bestBisher[id] != null && v > bestBisher[id] + 1e-6) xp += 30;
      bestBisher[id] = Math.max(bestBisher[id] ?? -Infinity, v);
    }
    const w = wochenStart(e.datum);
    proWoche[w] = (proWoche[w] || 0) + 1;
  }
  const jetzt = wochenStart(heute());
  let w = wochenStart(liste[0].datum);
  let serie = 0;
  while (w <= jetzt) {
    const n = proWoche[w] || 0;
    if (n >= ziel) { serie++; xp += 150 + 25 * serie; }
    else if (w < jetzt) { if (n === 0) xp -= 200; serie = 0; } // laufende Woche zählt erst am Ende
    xp = Math.max(0, xp);
    w = addTage(w, 7);
  }
  return xp;
}

// Punkte, die ein bestimmtes Training gebracht hat (inkl. Wochen-/Serienbonus).
export function xpFuer(einheitId) {
  return Math.max(0, disziplinXP() - disziplinXP(einheitId));
}

export function gesamtRang() {
  const xp = disziplinXP();
  const disziplin = rangAus(xp, XP_GRENZEN);
  const uebungen = uebungsRaenge();
  const mitDaten = uebungen.filter(x => !x.ohneDaten);
  const kraftSchnitt = mitDaten.length ? mitDaten.reduce((n, x) => n + x.i, 0) / mitDaten.length : null;
  // Disziplin hilft nur nach oben: liegt sie über dem Kraft-Schnitt, zieht sie ihn um 25 % des Abstands hoch.
  const schnitt = kraftSchnitt == null ? disziplin.i : kraftSchnitt + Math.max(0, 0.25 * (disziplin.i - kraftSchnitt));
  return { i: Math.min(5, Math.round(schnitt + 1e-9)), schnitt, kraftSchnitt, xp, disziplin, uebungen };
}

export function rangChip(i, extra = '') {
  return `<span class="rang r${i}"${extra}><i></i>${RAENGE[i]}</span>`;
}
