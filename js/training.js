// Training-Logik: welcher Tag heute dran ist, Ziele, Sätze, Wochenziel, Erinnerungen.
import { S, speichereEinheit } from './store.js';
import { naechsterZustand, baueZiel } from './progression.js';
import { heute, trainingsDatum, wochenStart, addTage, tageZwischen, uid } from './util.js';

export const hatSaetze = e => !!e?.eintraege?.some(x => x.saetze?.length);

export function einheitenSortiert() {
  return [...S.einheiten].sort((a, b) => (a.datum === b.datum ? (a.start || 0) - (b.start || 0) : a.datum < b.datum ? -1 : 1));
}

export function tagIds() {
  return Object.keys(S.tage).sort();
}

// Letzter Eintrag dieser Übung mit mindestens einem Satz (ohne das angegebene Training).
export function letzterEintrag(uebId, ausserId) {
  const list = einheitenSortiert();
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].id === ausserId) continue;
    const en = list[i].eintraege?.find(x => x.uebung === uebId && x.saetze?.length);
    if (en) return en;
  }
  return null;
}

// Ziel für heute aus dem letzten Training berechnen.
export function zielFuer(ex, ausserId) {
  const vorher = letzterEintrag(ex.id, ausserId);
  const r = naechsterZustand(ex, vorher, S.einst.baender);
  return {
    uebung: ex.id,
    name: ex.name,
    zustand: r.zustand,
    ziel: baueZiel(ex, r.zustand),
    hinweise: r.hinweise,
    gesteigert: r.gesteigert,
    saetze: [],
  };
}

export function einheitHeute() {
  const d = trainingsDatum();
  return S.einheiten.find(x => x.datum === d && hatSaetze(x)) || null;
}

// Welcher Tag ist heute dran? Gibt es heute schon Sätze → dieser Tag. Sonst abwechselnd.
export function tagHeute() {
  const d = trainingsDatum();
  const ids = tagIds();
  const e = einheitHeute();
  if (e && S.tage[e.tag]) return { einheit: e, tagId: e.tag };
  const wahl = S.einst.tagWahl;
  if (wahl?.datum === d && S.tage[wahl.tag]) return { einheit: null, tagId: wahl.tag };
  const alle = einheitenSortiert().filter(hatSaetze);
  const letzte = alle[alle.length - 1];
  if (!letzte) return { einheit: null, tagId: ids[0] };
  const i = ids.indexOf(letzte.tag);
  return { einheit: null, tagId: ids[(i + 1) % ids.length] };
}

// Eintrag einer Übung im heutigen Training (oder berechnet, solange noch nichts gespeichert ist).
export function eintragFuer(einheit, ex) {
  return einheit?.eintraege.find(x => x.uebung === ex.id) || zielFuer(ex, einheit?.id);
}

// Heutiges Training holen oder beim ersten Satz anlegen.
export async function sichereEinheit(tagId) {
  const d = trainingsDatum();
  let e = S.einheiten.find(x => x.datum === d && hatSaetze(x)) || S.einheiten.find(x => x.datum === d);
  const tag = S.tage[tagId];
  const uebIds = [...new Set(tag.paare.flat().filter(id => S.uebungen[id]))];
  if (!e) {
    e = { id: uid('e'), datum: d, tag: tagId, start: Date.now(), eintraege: [] };
  } else if (!hatSaetze(e)) {
    e.tag = tagId;
    e.eintraege = [];
  }
  for (const id of uebIds) {
    if (!e.eintraege.find(x => x.uebung === id)) e.eintraege.push(zielFuer(S.uebungen[id], e.id));
  }
  return e;
}

// ---------- Sätze ----------
export const satzVon = (eintrag, teil, nr) => eintrag.saetze.find(s => s.teil === teil && s.nr === nr) || null;

export function plaetze(eintrag) {
  return eintrag.ziel.teile.flatMap((p, teil) => {
    const geloggt = eintrag.saetze.filter(s => s.teil === teil);
    const n = Math.max(p.saetze, geloggt.length ? Math.max(...geloggt.map(s => s.nr)) + 1 : 0);
    return Array.from({ length: n }, (_, nr) => ({ uebung: eintrag.uebung, teil, nr }));
  });
}

// Supersatz: abwechselnd Übung 1, Übung 2, Übung 1 …
export function reihenfolge(eintraege) {
  const listen = eintraege.map(plaetze);
  const out = [];
  const max = Math.max(0, ...listen.map(l => l.length));
  for (let i = 0; i < max; i++) for (const l of listen) if (l[i]) out.push(l[i]);
  return out;
}

// Vorschlag für einen neuen Satz (damit meist ein Tipp reicht).
export function vorschlag(eintrag, teil, nr, einheitId) {
  const p = eintrag.ziel.teile[teil];
  const davor = satzVon(eintrag, teil, nr - 1);
  const alt = letzterEintrag(eintrag.uebung, einheitId);
  let altSatz = null;
  if (alt) {
    const altTeilIdx = alt.ziel?.teile?.findIndex(t => t.typ === p.typ);
    const altTeil = alt.ziel?.teile?.[altTeilIdx];
    const gleich = altTeil && (p.typ !== 'hantel' || altTeil.kg === p.kg) && (p.typ !== 'band' || altTeil.band === p.band);
    if (gleich) altSatz = alt.saetze.find(s => s.teil === altTeilIdx && s.nr === nr) || null;
  }
  const v = { wdh: davor?.wdh ?? altSatz?.wdh ?? (p.typ === 'frei' ? p.wdh : p.min) };
  if (p.typ === 'frei') v.wdh = Math.max(v.wdh, 1);
  if (p.typ === 'hantel') v.kg = davor?.kg ?? p.kg;
  if (p.typ === 'band') v.band = davor?.band ?? p.band;
  return v;
}

// ---------- Motivation ----------
export function wochenStand() {
  const ziel = S.einst.wochenZiel || 3;
  const proWoche = {};
  for (const e of S.einheiten) {
    if (!hatSaetze(e)) continue;
    const w = wochenStart(e.datum);
    proWoche[w] = (proWoche[w] || 0) + 1;
  }
  const w0 = wochenStart(heute());
  const anzahl = proWoche[w0] || 0;
  let serie = 0;
  let w = anzahl >= ziel ? w0 : addTage(w0, -7); // laufende Woche bricht die Serie nicht
  while ((proWoche[w] || 0) >= ziel) { serie++; w = addTage(w, -7); }
  return { anzahl, ziel, serie };
}

// ---------- Erinnerungen ----------
export const MESS_ARTEN = {
  gewicht: { titel: 'Körpergewicht', icon: '⚖️', einheit: 'kg', tage: 7, schritt: 0.1, text: 'Gewicht eintragen', info: 'Am besten morgens, nach dem Toilettengang, vor dem Frühstück.' },
  bauch: { titel: 'Bauchumfang', icon: '📏', einheit: 'cm', tage: 28, schritt: 0.5, text: 'Bauchumfang messen', info: 'Auf Höhe des Bauchnabels, entspannt ausatmen.' },
  klimmzugMax: { titel: 'Maxtest freie Klimmzüge', icon: '🏆', einheit: 'Wdh.', tage: 14, schritt: 1, text: 'Maxtest: freie Klimmzüge', info: 'Nach dem Aufwärmen: so viele saubere Klimmzüge wie möglich, ohne Band.' },
};

export function letzteMessung(art) {
  return S.messungen.filter(m => m.art === art).sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0)).pop() || null;
}

export function faelligeErinnerungen() {
  const d = heute();
  const aus = S.einst.erinnerungAus || {};
  const out = [];
  for (const [art, info] of Object.entries(MESS_ARTEN)) {
    if (aus[art] === d) continue;
    const l = letzteMessung(art);
    if (!l) out.push({ art, text: info.icon + ' ' + info.text });
    else {
      const t = tageZwischen(l.datum, d);
      if (t >= info.tage) out.push({ art, text: `${info.icon} ${info.text} – zuletzt vor ${t} Tagen` });
    }
  }
  const basis = S.einst.letzterExport || S.einst.ersteNutzung;
  if (basis && aus.backup !== d) {
    const t = tageZwischen(basis.slice(0, 10), d);
    if (t >= 28) out.push({ art: 'backup', text: S.einst.letzterExport ? `💾 Backup machen – letztes vor ${t} Tagen` : '💾 Zeit für dein erstes Backup' });
  }
  return out;
}
