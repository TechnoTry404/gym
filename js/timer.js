// Pausentimer. Die Endzeit wird gespeichert → läuft auch nach Schließen/Neustart der App richtig weiter.
// Am Ende: Ton + Bildschirm blinkt + Vibration/Haptik (soweit das iPhone es erlaubt).
import { S, setEinst } from './store.js';
import { haptik, toast } from './util.js';

let ende = null;
let tickId = null;
let beimTick = () => {};
let audio = null;
let wakeLock = null;

export function timerInit(callback) {
  beimTick = callback;
  const gespeichert = S.einst.timerEnde;
  if (gespeichert && gespeichert > Date.now()) { ende = gespeichert; starteTick(); }
  else if (gespeichert) setEinst('timerEnde', null);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (ende) { pruefe(); }
      if (ende) bildschirmWach();
    }
  });
}

export function rest() {
  return ende ? Math.max(0, Math.ceil((ende - Date.now()) / 1000)) : null;
}
export const laeuft = () => ende !== null;

export function starte(sek = S.einst.pauseSek || 90) {
  ende = Date.now() + sek * 1000;
  setEinst('timerEnde', ende);
  starteTick();
  bildschirmWach();
  beimTick();
}
export function aendere(deltaSek) {
  if (!ende) return;
  ende = Math.max(Date.now() + 1000, ende + deltaSek * 1000);
  setEinst('timerEnde', ende);
  beimTick();
}
export function stoppe() {
  ende = null;
  setEinst('timerEnde', null);
  clearInterval(tickId); tickId = null;
  beimTick();
}

function starteTick() {
  clearInterval(tickId);
  tickId = setInterval(pruefe, 250);
}
function pruefe() {
  if (!ende) return;
  if (Date.now() >= ende) {
    const verpasst = Date.now() - ende > 5000; // App war zu → nicht nachträglich piepen
    ende = null;
    setEinst('timerEnde', null);
    clearInterval(tickId); tickId = null;
    if (!verpasst) alarm();
  }
  beimTick();
}

// Ton freischalten: Das iPhone erlaubt Töne nur, wenn vorher getippt wurde. Wird bei jedem Satz-Tipp aufgerufen.
export function tonFreischalten() {
  try {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = new AC();
    }
    if (audio.state === 'suspended') audio.resume();
  } catch { /* egal */ }
}

function piep(start, freq) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + 0.3);
}

function alarm() {
  try {
    if (audio) {
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime + 0.05;
      piep(t, 880); piep(t + 0.35, 880); piep(t + 0.7, 1320);
    }
  } catch { /* egal */ }
  haptik([200, 100, 200, 100, 300]);
  setTimeout(() => haptik(), 300);
  setTimeout(() => haptik(), 600);
  document.body.classList.remove('blink');
  void document.body.offsetWidth;
  document.body.classList.add('blink');
  setTimeout(() => document.body.classList.remove('blink'), 1700);
  toast('⏰ Pause vorbei – nächster Satz!');
}

// Bildschirm während des Trainings anlassen (iOS 18.4+ auch in der Home-Bildschirm-App).
export async function bildschirmWach() {
  try {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* nicht schlimm */ }
}
