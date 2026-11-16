// Alle Daten im Arbeitsspeicher (schnell) + sofort in die Datenbank schreiben (kein Speichern-Knopf).
import * as db from './db.js';
import { STANDARD_UEBUNGEN, STANDARD_TAGE, STANDARD_EINSTELLUNGEN, PLAN_VERSION, TAUSCH_V3 } from './plan.js';
import { produkteErgaenzen, STANDARD_HAUT_ZEITEN } from './haut.js';
import { heute, toast } from './util.js';

export const S = { uebungen: {}, tage: {}, einheiten: [], messungen: [], einst: {}, haut: {} };

export async function ladeAlles() {
  let [u, t, e, m, s, h] = await Promise.all(db.SPEICHER.map(name => db.alle(name)));
  if (!u.length && !t.length) {
    // Allererster Start: Standardplan anlegen.
    await db.vieleSpeichern([
      ...STANDARD_UEBUNGEN.map(wert => ({ store: 'uebungen', wert })),
      ...STANDARD_TAGE.map(wert => ({ store: 'tage', wert })),
      { store: 'einstellungen', wert: { key: 'ersteNutzung', wert: heute() } },
      { store: 'einstellungen', wert: { key: 'planVersion', wert: PLAN_VERSION } },
    ]);
    [u, t, e, m, s, h] = await Promise.all(db.SPEICHER.map(name => db.alle(name)));
  }
  S.haut = Object.fromEntries((h || []).filter(x => x && x.datum).map(x => [x.datum, x]));
  S.uebungen = Object.fromEntries(u.map(x => [x.id, x]));
  S.tage = Object.fromEntries(t.map(x => [x.id, x]));
  S.einheiten = e;
  S.messungen = m;
  S.einst = { ...structuredClone(STANDARD_EINSTELLUNGEN), ...Object.fromEntries(s.map(x => [x.key, x.wert])) };
  S.einst.hautProdukte = produkteErgaenzen(S.einst.hautProdukte);
  S.einst.hautZeiten = { ...STANDARD_HAUT_ZEITEN, ...(S.einst.hautZeiten || {}) };
  if (!S.einst.ersteNutzung) await setEinst('ersteNutzung', heute());
  if ((S.einst.planVersion || 1) < PLAN_VERSION) await planUmstellen();
}

// Einmalige Umstellung auf einen neuen Standardplan (z. B. Heim → Gym).
// Alte Übungen und alle Trainings bleiben erhalten (Verlauf, Kraft-Übersicht); nur die Tage werden ersetzt.
async function planUmstellen() {
  const alt = S.einst.planVersion || 1;
  if (alt >= 2) {
    // Schritt 2 → 3: Freitag umbauen (Rudern/Schrägbank/Fliegende → Rudermaschine/Brustpresse/Butterfly).
    // Nur austauschen – deine übrigen Änderungen am Plan bleiben.
    const neu = STANDARD_UEBUNGEN.filter(u => !S.uebungen[u.id]);
    const tage = Object.values(S.tage).map(t => ({ ...t, paare: t.paare.map(p => p.map(id => TAUSCH_V3[id] || id)) }));
    await db.vieleSpeichern([
      ...neu.map(wert => ({ store: 'uebungen', wert: { ...wert } })),
      ...tage.map(wert => ({ store: 'tage', wert })),
      { store: 'einstellungen', wert: { key: 'planVersion', wert: PLAN_VERSION } },
    ]);
    for (const u of neu) S.uebungen[u.id] = { ...u };
    for (const t of tage) S.tage[t.id] = t;
    S.einst.planVersion = PLAN_VERSION;
    try { sessionStorage.setItem('gym-neuer-plan', 'v3'); } catch { /* egal */ }
    return;
  }
  await db.vieleSpeichern([
    ...STANDARD_UEBUNGEN.map(neu => ({ store: 'uebungen', wert: { ...neu } })),
    ...STANDARD_TAGE.map(wert => ({ store: 'tage', wert })),
    { store: 'einstellungen', wert: { key: 'planVersion', wert: PLAN_VERSION } },
    { store: 'einstellungen', wert: { key: 'tagWahl', wert: null } },
  ]);
  for (const u of STANDARD_UEBUNGEN) S.uebungen[u.id] = { ...u };
  for (const t of STANDARD_TAGE) S.tage[t.id] = t;
  S.einst.planVersion = PLAN_VERSION;
  S.einst.tagWahl = null;
  try { sessionStorage.setItem('gym-neuer-plan', '1'); } catch { /* egal */ }
}

async function sicher(fn) {
  try { await fn(); }
  catch (err) { console.error(err); toast('⚠️ Speichern fehlgeschlagen: ' + (err?.message || err)); throw err; }
}

export function setEinst(key, wert) {
  S.einst[key] = wert;
  return sicher(() => db.speichern('einstellungen', { key, wert }));
}

export function speichereEinheit(e) {
  const i = S.einheiten.findIndex(x => x.id === e.id);
  if (i >= 0) S.einheiten[i] = e; else S.einheiten.push(e);
  return sicher(() => db.speichern('einheiten', e));
}
export function loescheEinheit(id) {
  S.einheiten = S.einheiten.filter(x => x.id !== id);
  return sicher(() => db.loeschen('einheiten', id));
}

export function speichereMessung(m) {
  const i = S.messungen.findIndex(x => x.id === m.id);
  if (i >= 0) S.messungen[i] = m; else S.messungen.push(m);
  return sicher(() => db.speichern('messungen', m));
}
export function loescheMessung(id) {
  S.messungen = S.messungen.filter(x => x.id !== id);
  return sicher(() => db.loeschen('messungen', id));
}

// Hautpflege: ein Eintrag pro Tag { datum, morgen, abend, wirkstoff, gereizt }
export function speichereHaut(eintrag) {
  S.haut[eintrag.datum] = eintrag;
  return sicher(() => db.speichern('haut', eintrag));
}

export function speichereUebung(u) {
  S.uebungen[u.id] = u;
  return sicher(() => db.speichern('uebungen', u));
}
export function loescheUebung(id) {
  delete S.uebungen[id];
  return sicher(() => db.loeschen('uebungen', id));
}
export function speichereTag(t) {
  S.tage[t.id] = t;
  return sicher(() => db.speichern('tage', t));
}

// ---------- Backup ----------
// Schema 2 = mit Hautpflege. Backups mit Schema 1 lassen sich weiter laden.
export const BACKUP_SCHEMA = 2;

export function exportObjekt() {
  return {
    app: 'gymapp',
    schema: BACKUP_SCHEMA,
    exportiert: new Date().toISOString(),
    daten: {
      uebungen: Object.values(S.uebungen),
      tage: Object.values(S.tage),
      einheiten: S.einheiten,
      messungen: S.messungen,
      einstellungen: Object.entries(S.einst).map(([key, wert]) => ({ key, wert })),
      haut: Object.values(S.haut),
    },
  };
}

// Prüft eine Backup-Datei. Gibt Fehlertext zurück oder null, wenn alles passt.
export function pruefeBackup(obj) {
  if (!obj || typeof obj !== 'object') return 'Keine gültige Datei.';
  if (obj.app !== 'gymapp') return 'Das ist kein Backup dieser App.';
  if (typeof obj.schema !== 'number' || obj.schema > BACKUP_SCHEMA) return 'Backup stammt aus einer neueren App-Version.';
  const d = obj.daten;
  if (!d) return 'Backup ist leer.';
  for (const k of db.SPEICHER) {
    if (k === 'haut' && d.haut === undefined) continue; // altes Backup ohne Hautpflege
    if (!Array.isArray(d[k])) return `Backup unvollständig (${k} fehlt).`;
  }
  if (d.haut !== undefined && !d.haut.every(x => x && typeof x.datum === 'string')) return 'Hautpflege im Backup ist beschädigt.';
  if (!d.uebungen.every(x => x && x.id)) return 'Übungen im Backup sind beschädigt.';
  if (!d.tage.every(x => x && x.id && Array.isArray(x.paare))) return 'Trainingstage im Backup sind beschädigt.';
  if (!d.einheiten.every(x => x && x.id && x.datum && Array.isArray(x.eintraege))) return 'Trainings im Backup sind beschädigt.';
  if (!d.messungen.every(x => x && x.id && x.art && x.datum)) return 'Messungen im Backup sind beschädigt.';
  if (!d.einstellungen.every(x => x && x.key)) return 'Einstellungen im Backup sind beschädigt.';
  return null;
}

export async function importiere(obj) {
  const fehler = pruefeBackup(obj);
  if (fehler) throw new Error(fehler);
  let daten = obj.daten;
  if (daten.haut === undefined) {
    // Altes Backup ohne Hautpflege: Hautdaten und Haut-Einstellungen (Plan, Zeiten, Produkte, Push) behalten.
    const keys = new Set(daten.einstellungen.map(x => x.key));
    const hautEinst = Object.entries(S.einst).filter(([k]) => k.startsWith('haut') && !keys.has(k)).map(([key, wert]) => ({ key, wert }));
    daten = { ...daten, einstellungen: [...daten.einstellungen, ...hautEinst] };
  }
  await db.allesErsetzen(daten);
  await ladeAlles();
}
