// Alle Daten im Arbeitsspeicher (schnell) + sofort in die Datenbank schreiben (kein Speichern-Knopf).
import * as db from './db.js';
import { STANDARD_UEBUNGEN, STANDARD_TAGE, STANDARD_EINSTELLUNGEN } from './plan.js';
import { heute, toast } from './util.js';

export const S = { uebungen: {}, tage: {}, einheiten: [], messungen: [], einst: {} };

export async function ladeAlles() {
  let [u, t, e, m, s] = await Promise.all(db.SPEICHER.map(name => db.alle(name)));
  if (!u.length && !t.length) {
    // Allererster Start: Standardplan anlegen.
    await db.vieleSpeichern([
      ...STANDARD_UEBUNGEN.map(wert => ({ store: 'uebungen', wert })),
      ...STANDARD_TAGE.map(wert => ({ store: 'tage', wert })),
      { store: 'einstellungen', wert: { key: 'ersteNutzung', wert: heute() } },
    ]);
    [u, t, e, m, s] = await Promise.all(db.SPEICHER.map(name => db.alle(name)));
  }
  S.uebungen = Object.fromEntries(u.map(x => [x.id, x]));
  S.tage = Object.fromEntries(t.map(x => [x.id, x]));
  S.einheiten = e;
  S.messungen = m;
  S.einst = { ...structuredClone(STANDARD_EINSTELLUNGEN), ...Object.fromEntries(s.map(x => [x.key, x.wert])) };
  if (!S.einst.ersteNutzung) await setEinst('ersteNutzung', heute());
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
export const BACKUP_SCHEMA = 1;

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
  for (const k of db.SPEICHER) if (!Array.isArray(d[k])) return `Backup unvollständig (${k} fehlt).`;
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
  await db.allesErsetzen(obj.daten);
  await ladeAlles();
}
