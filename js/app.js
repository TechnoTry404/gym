// Start der App: Daten laden, Tabs, Offline-Speicher und automatische Updates.
import { ladeAlles, S } from './store.js';
import { dauerhaftAnfragen } from './db.js';
import { renderHeute, heuteInit, heuteTick } from './heute.js';
import { renderFortschritt, fortschrittZuruecksetzen } from './fortschritt.js';
import { renderPlan, renderMehr } from './einstellungen.js';
import { exportieren } from './backup.js';
import * as timer from './timer.js';
import { einheitHeute } from './training.js';
import { $, toast } from './util.js';

let tab = 'heute';

function zeige(neu) {
  if (neu) {
    if (neu === 'fortschritt' && tab === 'fortschritt') fortschrittZuruecksetzen();
    tab = neu;
  }
  const view = $('#view');
  const sheet = $('#sheet');
  view.onclick = null;
  view.onchange = null;
  view.dataset.tab = tab;
  sheet.innerHTML = '';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'heute') renderHeute(view, sheet);
  else if (tab === 'fortschritt') renderFortschritt(view);
  else if (tab === 'plan') renderPlan(view);
  else if (tab === 'mehr') renderMehr(view);
  sheetHoehe();
}

// Platz unten freihalten, damit die Eingabe-Leiste nichts verdeckt.
function sheetHoehe() {
  const h = $('#sheet').offsetHeight || 0;
  document.documentElement.style.setProperty('--sheet-h', h + 'px');
}

async function start() {
  try {
    await ladeAlles();
  } catch (err) {
    $('#view').innerHTML = `<div class="leer">⚠️ Daten konnten nicht geladen werden.<br>${String(err?.message || err)}<br><br>App schließen und neu öffnen.</div>`;
    return;
  }
  heuteInit({ beiExport: async () => { await exportieren(); if (tab === 'heute') zeige(); } });
  timer.timerInit(() => { if (tab === 'heute') { heuteTick(); sheetHoehe(); } });

  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { zeige(b.dataset.tab); window.scrollTo(0, 0); }));
  new ResizeObserver(sheetHoehe).observe($('#sheet'));

  // Mitternacht oder App lange im Hintergrund: Heute-Bildschirm auffrischen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && tab === 'heute') zeige();
    if (document.visibilityState === 'visible' && (einheitHeute() || timer.laeuft())) timer.bildschirmWach();
  });

  zeige('heute');
  dauerhaftAnfragen();
  if (einheitHeute()) timer.bildschirmWach();
  registriereServiceWorker();
}

// Offline + Updates: Beim Öffnen fragt die App nach einer neuen Version. Gibt es eine,
// wird sie im Hintergrund geladen und die App startet einmal neu. Daten bleiben (sie liegen in IndexedDB).
function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hatteSteuerung = !!navigator.serviceWorker.controller;
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteSteuerung || neuGeladen) return;
    neuGeladen = true;
    sessionStorage.setItem('gym-update', '1');
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(err => console.warn('Service Worker:', err));
  try {
    if (sessionStorage.getItem('gym-update')) {
      sessionStorage.removeItem('gym-update');
      setTimeout(() => toast('✨ App wurde aktualisiert'), 400);
    }
  } catch { /* egal */ }
}

window.addEventListener('error', e => console.error(e.error || e.message));
start();
export { S };
