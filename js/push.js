// Web-Push für die Hautpflege-Erinnerungen.
// An den Push-Server (Cloudflare Worker) gehen NUR: die anonyme Push-Adresse des iPhones,
// die drei Uhrzeiten und die Zeitzone. Alles andere bleibt auf dem iPhone.
import { S, setEinst } from './store.js';
import { heute } from './util.js';

// Adresse des Workers – wird nach dem Einrichten bei Cloudflare eingetragen (siehe ANLEITUNG.md, Teil G).
export const WORKER_URL = 'https://gym-push.technotry404.workers.dev';
// Öffentlicher VAPID-Schlüssel (darf öffentlich sein; der private liegt nur im Worker).
export const VAPID_PUBLIC = 'BIkJZdP_pkClB8-Q2VnwjFFCcO4QyysGvjyVd4DmqeMXLkFF8mhzUBbEGVEsC1O6CmDElcRypvr4XiEUZcaXsKA';

function istIphone() { return /iPhone|iPad|iPod/.test(navigator.userAgent); }
function istInstalliert() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

// Kann dieses Gerät Push? Gibt { moeglich, grund } zurück. grund = Text für den Hinweis in der App.
export function pushMoeglich() {
  if (!WORKER_URL) return { moeglich: false, grund: 'Der Push-Server ist noch nicht eingerichtet. Bis dahin zeigt dir die App beim Öffnen, was dran ist.' };
  if (istIphone() && !istInstalliert()) return { moeglich: false, grund: 'Push geht auf dem iPhone nur in der installierten App. Öffne die App über das Icon auf dem Home-Bildschirm.' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { moeglich: false, grund: istIphone() ? 'Dein iPhone kann hier keine Push-Mitteilungen. Nötig ist iOS 16.4 oder neuer und die App vom Home-Bildschirm.' : 'Dieser Browser kann keine Push-Mitteilungen.' };
  }
  if (Notification.permission === 'denied') return { moeglich: false, grund: 'Mitteilungen sind für die App verboten. Erlauben: iPhone-Einstellungen → Mitteilungen → Gym → Mitteilungen erlauben.' };
  return { moeglich: true, grund: '' };
}

function b64urlZuBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function zeitzone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'; } catch { return 'Europe/Berlin'; }
}

async function anWorker(pfad, methode, daten) {
  const r = await fetch(WORKER_URL.replace(/\/$/, '') + pfad, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(daten),
  });
  if (!r.ok) throw new Error(`Push-Server antwortet mit Fehler ${r.status}`);
  return r;
}

async function aboSenden(abo) {
  await anWorker('/abo', 'POST', { abo: abo.toJSON(), zeiten: S.einst.hautZeiten, zeitzone: zeitzone() });
}

// Einschalten. WICHTIG: direkt aus einem Tipp heraus aufrufen (iPhone fragt sonst nicht nach der Erlaubnis).
export async function pushEinschalten() {
  const m = pushMoeglich();
  if (!m.moeglich) throw new Error(m.grund);
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== 'granted') throw new Error('Ohne Erlaubnis keine Mitteilungen. Du kannst es später erneut versuchen.');
  const reg = await navigator.serviceWorker.ready;
  let abo = await reg.pushManager.getSubscription();
  if (!abo) abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlZuBytes(VAPID_PUBLIC) });
  await aboSenden(abo);
  await setEinst('hautPush', { an: true, sync: heute(), fehler: null });
}

export async function pushAusschalten() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const abo = await reg.pushManager.getSubscription();
    if (abo) {
      await anWorker('/abo', 'DELETE', { endpoint: abo.endpoint }).catch(() => {});
      await abo.unsubscribe().catch(() => {});
    }
  } finally {
    await setEinst('hautPush', { an: false, sync: null, fehler: null });
  }
}

// Nach dem Ändern der Uhrzeiten: neue Zeiten an den Server schicken.
export async function zeitenSenden() {
  if (!S.einst.hautPush?.an) return;
  const reg = await navigator.serviceWorker.ready;
  const abo = await reg.pushManager.getSubscription();
  if (!abo) throw new Error('Push-Abo fehlt – bitte Erinnerungen neu einschalten.');
  await aboSenden(abo);
  await setEinst('hautPush', { ...S.einst.hautPush, sync: heute(), fehler: null });
}

export async function testSenden() {
  const reg = await navigator.serviceWorker.ready;
  const abo = await reg.pushManager.getSubscription();
  if (!abo) throw new Error('Push-Abo fehlt – bitte Erinnerungen neu einschalten.');
  await anWorker('/test', 'POST', { endpoint: abo.endpoint });
}

// Beim Start der App (höchstens einmal am Tag): Abo prüfen und beim Server auffrischen.
// So bleibt der Server aktuell, auch wenn das iPhone die Push-Adresse erneuert.
export async function pushPruefen() {
  const p = S.einst.hautPush;
  if (!p?.an || !WORKER_URL) return;
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') { await setEinst('hautPush', { ...p, fehler: 'Mitteilungen sind nicht mehr erlaubt.' }); return; }
    const reg = await navigator.serviceWorker.ready;
    const abo = await reg.pushManager.getSubscription();
    if (!abo) { await setEinst('hautPush', { ...p, fehler: 'Das Push-Abo ist abgelaufen. Bitte Erinnerungen neu einschalten.' }); return; }
    if (p.sync === heute() && !p.fehler) return;
    await aboSenden(abo);
    await setEinst('hautPush', { ...p, sync: heute(), fehler: null });
  } catch (err) {
    // Kein Internet o. Ä.: still bleiben, beim nächsten Öffnen erneut versuchen.
    console.warn('Push prüfen:', err);
  }
}
