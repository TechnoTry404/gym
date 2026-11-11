// Datenbank im iPhone (IndexedDB). Alles bleibt lokal auf dem Gerät.
// Regel für Updates: Neue Versionen dürfen Speicher nur ERGÄNZEN, nie löschen → kein Datenverlust.

const NAME = 'gymapp';
const VERSION = 1;
export const SPEICHER = ['uebungen', 'tage', 'einheiten', 'messungen', 'einstellungen'];

let dbPromise = null;

export function oeffnen() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Version 1: Grundspeicher anlegen (nur wenn noch nicht vorhanden).
      if (!db.objectStoreNames.contains('uebungen')) db.createObjectStore('uebungen', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tage')) db.createObjectStore('tage', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('einheiten')) {
        const s = db.createObjectStore('einheiten', { keyPath: 'id' });
        s.createIndex('datum', 'datum');
      }
      if (!db.objectStoreNames.contains('messungen')) {
        const s = db.createObjectStore('messungen', { keyPath: 'id' });
        s.createIndex('art', 'art');
      }
      if (!db.objectStoreNames.contains('einstellungen')) db.createObjectStore('einstellungen', { keyPath: 'key' });
      // Spätere Versionen: hier mit "if (event.oldVersion < 2) { … }" ergänzen.
    };
    req.onsuccess = () => {
      const db = req.result;
      // Falls eine neuere App-Version in einem anderen Fenster die Datenbank erweitert: sauber schließen.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    // Nur ein Hinweis: Öffnen geht weiter, sobald das andere Fenster schließt.
    req.onblocked = () => console.warn('Datenbank wartet auf ein anderes offenes Fenster der App.');
  });
  return dbPromise;
}

function fertig(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Abgebrochen'));
  });
}

export async function alle(store) {
  const db = await oeffnen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function speichern(store, wert) {
  const db = await oeffnen();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(wert);
  return fertig(tx);
}

export async function loeschen(store, key) {
  const db = await oeffnen();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  return fertig(tx);
}

// Mehrere Einträge in EINEM Schritt speichern (alles oder nichts).
export async function vieleSpeichern(eintraege) {
  const db = await oeffnen();
  const stores = [...new Set(eintraege.map(e => e.store))];
  const tx = db.transaction(stores, 'readwrite');
  for (const e of eintraege) tx.objectStore(e.store).put(e.wert);
  return fertig(tx);
}

// Alles ersetzen (Backup-Import) – in einem Schritt: klappt etwas nicht, bleibt alles wie vorher.
export async function allesErsetzen(daten) {
  const db = await oeffnen();
  const tx = db.transaction(SPEICHER, 'readwrite');
  for (const s of SPEICHER) {
    const os = tx.objectStore(s);
    os.clear();
    for (const wert of daten[s] || []) os.put(wert);
  }
  return fertig(tx);
}

// Dauerhaften Speicher anfragen (Schutz davor, dass das iPhone die Daten bei Platzmangel löscht).
export async function dauerhaftAnfragen() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}
export async function istDauerhaft() {
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { return null; }
}
