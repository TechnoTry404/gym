// Service Worker: macht die App offline nutzbar und lädt Updates.
// WICHTIG bei jedem Update: VERSION erhöhen (z. B. 1.0.1). Nur dann erkennt das iPhone die neue Version.
const VERSION = '1.7.1';
const CACHE = 'gymapp-' + VERSION;

const DATEIEN = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/backup.js',
  'js/charts.js',
  'js/db.js',
  'js/einstellungen.js',
  'js/fortschritt.js',
  'js/haut.js',
  'js/haut-ansicht.js',
  'js/heute.js',
  'js/plan.js',
  'js/progression.js',
  'js/push.js',
  'js/rang.js',
  'js/store.js',
  'js/timer.js',
  'js/training.js',
  'js/ui.js',
  'js/util.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(DATEIEN.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('gymapp-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const treffer = await cache.match(req, { ignoreSearch: true });
      if (treffer) return treffer;
      try {
        const antwort = await fetch(req);
        if (antwort.ok && antwort.type === 'basic') cache.put(req, antwort.clone());
        return antwort;
      } catch (err) {
        if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
        throw err;
      }
    }),
  );
});

// ---------- Hautpflege: Push-Mitteilungen ----------
// Der Push-Server schickt nur { art: 'morgen' | 'abend' | 'test' }. Den Text baut das iPhone hier selbst
// aus den eigenen Daten (Wochenplan, Häkchen) – der Server kennt sie nicht.

const H_WIRKSTOFF = { retinal: 'Retinal', bha: 'BHA', pause: 'Pause' };
const H_PLAN = ['retinal', 'pause', 'bha', 'retinal', 'pause', 'retinal', 'pause'];

// Datum wie in der App: bis 4 Uhr nachts zählt noch der Vortag.
function hautDatum(jetzt = new Date()) {
  const d = new Date(jetzt.getTime() - 4 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return { datum: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, wtag: (d.getDay() + 6) % 7 };
}

// Titel und Text der Mitteilung. Reine Funktion (wird auch automatisch getestet).
function hautText(art, plan, eintrag, wtag) {
  const w = (eintrag && H_WIRKSTOFF[eintrag.wirkstoff] && eintrag.wirkstoff) || (Array.isArray(plan) && H_WIRKSTOFF[plan[wtag]] ? plan[wtag] : H_PLAN[wtag]);
  if (art === 'test') return { titel: '🔔 Test', text: 'Push-Erinnerungen funktionieren.' };
  if (art === 'morgen') {
    const fertig = eintrag?.morgen?.reinigung && eintrag?.morgen?.lsf;
    if (fertig) return { titel: '☀️ Morgenroutine', text: 'Schon erledigt – super!' };
    return { titel: '☀️ Morgenroutine', text: 'Reinigung → LSF 50' + (w !== 'pause' ? ` · heute Abend: ${H_WIRKSTOFF[w]}` : '') };
  }
  const schritte = w === 'pause' ? ['reinigung', 'nachtcreme'] : ['reinigung', 'wirkstoff', 'nachtcreme'];
  const fertig = schritte.every(s => eintrag?.abend?.[s]);
  if (fertig) return { titel: '🌙 Abendroutine', text: 'Schon erledigt – super!' };
  return {
    titel: w === 'pause' ? '🌙 Abendroutine · Pause' : `🌙 Heute Abend: ${H_WIRKSTOFF[w]}`,
    text: w === 'pause' ? 'Reinigungsgel → Nachtcreme (kein Wirkstoff)' : `Reinigungsgel → ${H_WIRKSTOFF[w]} → Nachtcreme`,
  };
}

// Wiegen: montags mit der Morgen-Mitteilung, solange in dieser Woche noch nicht gewogen wurde
// (wie die Erinnerung in der App). gewichtDaten = Liste der Datumswerte 'JJJJ-MM-TT'.
function kalenderTag(jetzt = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return { datum: `${jetzt.getFullYear()}-${p(jetzt.getMonth() + 1)}-${p(jetzt.getDate())}`, wtag: (jetzt.getDay() + 6) % 7 };
}
function wiegenFaellig(gewichtDaten, jetzt = new Date()) {
  const { datum, wtag } = kalenderTag(jetzt);
  if (wtag !== 0) return false; // nur montags
  return !(gewichtDaten || []).some(d => String(d).slice(0, 10) >= datum);
}

// Liest Wochenplan, heutigen Eintrag und die Gewichts-Daten aus der App-Datenbank (nur lesen, nie ändern).
function hautDatenLesen(datum) {
  return new Promise(resolve => {
    let req;
    try { req = indexedDB.open('gymapp'); } catch { resolve({}); return; }
    req.onupgradeneeded = () => { try { req.transaction.abort(); } catch { /* egal */ } };
    req.onerror = () => resolve({});
    req.onblocked = () => resolve({});
    req.onsuccess = () => {
      const db = req.result;
      const namen = ['einstellungen', 'haut', 'messungen'].filter(n => db.objectStoreNames.contains(n));
      if (!namen.length) { db.close(); resolve({}); return; }
      const tx = db.transaction(namen, 'readonly');
      const out = {};
      if (namen.includes('einstellungen')) {
        const r = tx.objectStore('einstellungen').get('hautPlan');
        r.onsuccess = () => { out.plan = r.result?.wert; };
      }
      if (namen.includes('haut')) {
        const r = tx.objectStore('haut').get(datum);
        r.onsuccess = () => { out.eintrag = r.result; };
      }
      if (namen.includes('messungen')) {
        const r = tx.objectStore('messungen').getAll();
        r.onsuccess = () => { out.gewicht = (r.result || []).filter(m => m && m.art === 'gewicht').map(m => m.datum); };
      }
      tx.oncomplete = () => { db.close(); resolve(out); };
      tx.onerror = tx.onabort = () => { db.close(); resolve(out); };
    };
  });
}

self.addEventListener('push', event => {
  let daten = {};
  try { daten = event.data ? event.data.json() : {}; } catch { daten = {}; }
  event.waitUntil((async () => {
    const { datum, wtag } = hautDatum();
    const art = ['morgen', 'abend', 'test'].includes(daten.art) ? daten.art : (new Date().getHours() < 14 ? 'morgen' : 'abend');
    let t;
    let wiegen = false;
    try {
      const { plan, eintrag, gewicht } = await hautDatenLesen(datum);
      t = hautText(art, plan, eintrag, wtag);
      wiegen = art === 'morgen' && Array.isArray(gewicht) && wiegenFaellig(gewicht);
    } catch {
      t = hautText(art, null, null, wtag);
    }
    await self.registration.showNotification(t.titel, {
      body: t.text,
      tag: 'haut-' + art,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { tab: 'haut' },
    });
    if (wiegen) {
      await self.registration.showNotification('⚖️ Zeit zum Wiegen', {
        body: 'Am besten jetzt: nach dem Toilettengang, vor dem Frühstück. Tippen zum Eintragen.',
        tag: 'wiegen',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        data: { tab: 'heute', aktion: 'wiegen' },
      });
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const wiegen = event.notification.data?.aktion === 'wiegen';
  event.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of fenster) {
      if ('focus' in c) {
        c.postMessage(wiegen ? { tab: 'heute', aktion: 'wiegen' } : { tab: 'haut' });
        return c.focus();
      }
    }
    return self.clients.openWindow(wiegen ? './?aktion=wiegen' : './?tab=haut');
  })());
});
