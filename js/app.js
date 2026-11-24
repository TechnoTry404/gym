// Start der App: Daten laden, Tabs, Offline-Speicher und automatische Updates.
import { ladeAlles, S, modulAn } from './store.js';
import { dauerhaftAnfragen } from './db.js';
import { renderHeute, heuteInit, heuteTick } from './heute.js';
import { renderFortschritt, fortschrittZuruecksetzen, fortschrittModus } from './fortschritt.js';
import { renderHaut, hautModus } from './haut-ansicht.js';
import { pushPruefen } from './push.js';
import { renderPlan, renderMehr } from './einstellungen.js';
import { exportieren } from './backup.js';
import * as timer from './timer.js';
import { einheitHeute } from './training.js';
import { messungEintragen } from './ui.js';
import { $, toast } from './util.js';

let tab = 'heute';

function zeige(neu) {
  if (neu) {
    if (neu === 'fortschritt' && tab === 'fortschritt') fortschrittZuruecksetzen();
    if (neu === 'haut' && tab !== 'haut') hautModus('liste');
    tab = neu;
  }
  // Hautpflege ausgeschaltet (Mehr → Bereiche)? Dann kein Haut-Tab.
  const hautKnopf = document.querySelector('#tabs [data-tab=haut]');
  if (hautKnopf) hautKnopf.hidden = !modulAn('haut');
  if (tab === 'haut' && !modulAn('haut')) tab = 'heute';
  const view = $('#view');
  const sheet = $('#sheet');
  view.onclick = null;
  view.onchange = null;
  view.dataset.tab = tab;
  sheet.innerHTML = '';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'heute') renderHeute(view, sheet);
  else if (tab === 'haut') renderHaut(view);
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
  document.addEventListener('gym-tab', e => {
    zeige(e.detail.tab);
    if (e.detail?.modus) {
      if (e.detail.tab === 'haut') hautModus(e.detail.modus); else fortschrittModus(e.detail.modus);
      zeige();
    }
    window.scrollTo(0, 0);
  });

  // Mitternacht oder App lange im Hintergrund: Heute-Bildschirm auffrischen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (tab === 'heute' || tab === 'haut')) zeige();
    if (document.visibilityState === 'visible' && (einheitHeute() || timer.laeuft())) timer.bildschirmWach();
  });

  // Tipp auf eine Haut-Mitteilung öffnet die App mit ?tab=haut (bzw. schickt eine Nachricht, wenn sie schon offen ist).
  // Tipp auf „Zeit zum Wiegen“: Heute-Tab mit der Gewichts-Eingabe öffnen.
  const wiegenOeffnen = () => {
    zeige('heute'); window.scrollTo(0, 0);
    messungEintragen('gewicht', () => { if (tab === 'heute') zeige(); });
  };
  let startTab = 'heute';
  let startWiegen = false;
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('tab') === 'haut') startTab = 'haut';
    if (q.get('aktion') === 'wiegen') startWiegen = true;
    if (location.search) history.replaceState(null, '', location.pathname);
  } catch { /* egal */ }
  navigator.serviceWorker?.addEventListener('message', e => {
    if (e.data?.aktion === 'wiegen') wiegenOeffnen();
    else if (e.data?.tab === 'haut') { zeige('haut'); window.scrollTo(0, 0); }
  });
  zeige(startTab);
  if (startWiegen) wiegenOeffnen();
  if (modulAn('haut')) pushPruefen().then(() => { if (tab === 'haut') zeige(); });
  try {
    const neu = sessionStorage.getItem('gym-neuer-plan');
    if (neu) {
      sessionStorage.removeItem('gym-neuer-plan');
      const text = neu === 'v4' ? '🏋️ Plan neu: Rudermaschine, Seitheben mit Hanteln, Reverse Butterfly' : neu === 'v3' ? '🏋️ Freitag neu: Brustpresse, Rudermaschine, Butterfly' : '🏋️ Neuer Gym-Plan aktiv: Mo A · Mi B · Fr C';
      setTimeout(() => toast(text, 4000), 900);
    }
  } catch { /* egal */ }
  try {
    const k = sessionStorage.getItem('gym-korrektur');
    if (k) { sessionStorage.removeItem('gym-korrektur'); setTimeout(() => toast(`🔧 Kabelrudern: alte Werte von lb in kg umgerechnet (${k} Trainings)`, 4500), 1500); }
  } catch { /* egal */ }
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
