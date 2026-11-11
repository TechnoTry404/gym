// Kleine Helfer: Datum, Zahlen, Text, Hinweis-Meldung.

export const $ = (sel, root = document) => root.querySelector(sel);

// Text sicher in HTML einsetzen (verhindert kaputte Anzeige bei Sonderzeichen).
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Datum als "JJJJ-MM-TT" in lokaler Zeit.
export function heute(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Trainingstag: bis 4 Uhr nachts zählt noch der Vortag (Training über Mitternacht bleibt ein Training).
export function trainingsDatum() {
  return heute(new Date(Date.now() - 4 * 3600 * 1000));
}
export function parseDatum(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function tageZwischen(a, b) {
  return Math.round((parseDatum(b) - parseDatum(a)) / 86400000);
}
export function addTage(s, n) {
  const d = parseDatum(s);
  d.setDate(d.getDate() + n);
  return heute(d);
}
// Montag der Woche (Woche = Mo–So).
export function wochenStart(s) {
  const d = parseDatum(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return heute(d);
}
export function fmtZahl(n) {
  if (n == null || Number.isNaN(n)) return '–';
  return (Math.round(n * 100) / 100).toLocaleString('de-DE');
}
export function fmtDatumLang(s) {
  return parseDatum(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' });
}
export function fmtDatumKurz(s) {
  return parseDatum(s).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}
export function vorTagen(s) {
  const t = tageZwischen(s, heute());
  return t <= 0 ? 'heute' : t === 1 ? 'gestern' : `vor ${t} Tagen`;
}
export function fmtZeit(sek) {
  const m = Math.floor(sek / 60), s = sek % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let toastTimer;
export function toast(text, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('zeigen');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('zeigen'), ms);
}

// Kurzes Antippen-Gefühl. iPhone: Trick über einen versteckten Schalter (iOS 18+),
// andere Handys: Vibrations-Schnittstelle. Klappt auf dem iPhone meist nur direkt nach einem Tipp.
export function haptik(muster = 30) {
  try { if (navigator.vibrate) navigator.vibrate(muster); } catch { /* egal */ }
  try {
    const label = document.createElement('label');
    label.style.display = 'none';
    label.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch { /* egal */ }
}
