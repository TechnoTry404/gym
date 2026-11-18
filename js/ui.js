// Gemeinsame Bausteine: Fenster von unten (Modal), Messwert-Eingabe, Band-Punkte.
import { S, speichereMessung } from './store.js';
import { MESS_ARTEN, letzteMessung } from './training.js';
import { BAND_FARBEN } from './plan.js';
import { esc, heute, uid, fmtZahl, toast } from './util.js';

export function bandPunkt(band) {
  if (!band || band === 'frei') return '<span class="bandpunkt" style="background:transparent;border-style:dashed"></span>';
  return `<span class="bandpunkt" style="background:${BAND_FARBEN[band] || '#888'}"></span>`;
}

let schliessenCb = null;
let vvAus = null; // Aufräumen des Tastatur-Ausgleichs
// oben = true: Fenster oben statt unten (für Eingaben mit Tastatur – unten würde die Tastatur es verdecken).
export function modal(html, beimOeffnen, beimSchliessen, { oben = false } = {}) {
  schliesseModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg' + (oben ? ' oben' : '');
  bg.innerHTML = `<div class="modal" role="dialog">${oben ? '' : '<div class="grip"></div>'}${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) schliesseModal(); });
  document.body.appendChild(bg);
  schliessenCb = beimSchliessen || null;
  if (oben && window.visualViewport) {
    // iPhone: Wenn die Tastatur aufgeht, das Fenster im sichtbaren Bereich halten.
    const vv = window.visualViewport;
    const passe = () => { bg.style.top = vv.offsetTop + 'px'; bg.style.height = vv.height + 'px'; };
    vv.addEventListener('resize', passe); vv.addEventListener('scroll', passe);
    vvAus = () => { vv.removeEventListener('resize', passe); vv.removeEventListener('scroll', passe); };
    passe();
  }
  beimOeffnen?.(bg.querySelector('.modal'));
  return bg;
}

// Eingabefeld sofort fokussieren – muss direkt im Tipp passieren, sonst öffnet das iPhone die Tastatur nicht.
function sofortFokus(inp, markieren) {
  try { inp.focus({ preventScroll: true }); } catch { inp.focus(); }
  if (markieren) { try { inp.select(); } catch { /* egal */ } }
}

export function schliesseModal() {
  const alt = document.querySelector('.modal-bg');
  vvAus?.(); vvAus = null;
  if (!alt) return;
  // Offene Eingabe zuerst abschließen (speichert sofort).
  if (document.activeElement && alt.contains(document.activeElement)) document.activeElement.blur();
  alt.remove();
  const cb = schliessenCb; schliessenCb = null;
  cb?.();
}

// Zahl per Tastatur eingeben (z. B. Gewicht eines Satzes). Übernimmt beim Tippen auf „Fertig“ oder Enter.
export function zahlEingeben({ titel, wert, einheit, ganz = false, max = 500 }, beiWert) {
  modal(`
    <h3>${esc(titel)}</h3>
    <input class="gross" id="zahlwert" type="text" inputmode="${ganz ? 'numeric' : 'decimal'}" value="${wert == null ? '' : fmtZahl(wert)}" autocomplete="off">
    <p class="muted" style="text-align:center">${esc(einheit)}</p>
    <button class="knopf haupt" data-a="fertig">Fertig</button>
  `, root => {
    const inp = root.querySelector('#zahlwert');
    let fertig = false;
    const uebernehmen = () => {
      if (fertig) return;
      const roh = inp.value.replace(',', '.').trim();
      const zahl = Number(roh);
      if (roh === '' || !Number.isFinite(zahl) || zahl < 0 || zahl > max) { toast('Bitte eine gültige Zahl eingeben'); return; }
      fertig = true;
      beiWert(ganz ? Math.round(zahl) : Math.round(zahl * 100) / 100);
      schliesseModal();
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') uebernehmen(); });
    root.querySelector('[data-a=fertig]').addEventListener('click', uebernehmen);
    sofortFokus(inp, true);
  }, null, { oben: true });
}

// Messwert eintragen. Speichert bei jeder Eingabe automatisch (kein Speichern-Knopf).
export function messungEintragen(art, beimSchliessen, vorhandene = null) {
  const info = MESS_ARTEN[art];
  const letzte = letzteMessung(art);
  let eintrag = vorhandene ? { ...vorhandene } : S.messungen.find(m => m.art === art && m.datum === heute()) || null;
  const wert = eintrag ? eintrag.wert : '';
  const ganz = info.schritt >= 1;
  modal(`
    <h3>${info.icon} ${esc(info.titel)}</h3>
    <p class="info">${esc(info.info)}${letzte && !vorhandene ? ` Zuletzt: ${fmtZahl(letzte.wert)} ${info.einheit}.` : ''}</p>
    <input class="gross" id="messwert" type="text" inputmode="${ganz ? 'numeric' : 'decimal'}" placeholder="0" value="${wert === '' ? '' : fmtZahl(wert)}" autocomplete="off">
    <p class="muted" style="text-align:center">${esc(info.einheit)}${vorhandene ? ' · ' + esc(vorhandene.datum) : ' · heute'} · wird automatisch gespeichert</p>
    <button class="knopf haupt" data-a="fertig">Fertig</button>
  `, root => {
    const inp = root.querySelector('#messwert');
    let timer;
    const speichern = async () => {
      const roh = inp.value.replace(',', '.').trim();
      if (roh === '') return;
      const zahl = Number(roh);
      const nullErlaubt = art === 'klimmzugMax';
      if (!Number.isFinite(zahl) || zahl < 0 || (zahl === 0 && !nullErlaubt) || zahl > 1000) { toast('Bitte eine gültige Zahl eingeben'); return; }
      if (!eintrag) eintrag = { id: uid('m'), art, datum: heute(), wert: zahl };
      eintrag = { ...eintrag, wert: ganz ? Math.round(zahl) : zahl };
      await speichereMessung(eintrag);
    };
    inp.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(speichern, 350); });
    inp.addEventListener('change', () => { clearTimeout(timer); speichern(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    root.querySelector('[data-a=fertig]').addEventListener('click', async () => {
      clearTimeout(timer); await speichern(); schliesseModal();
    });
    sofortFokus(inp, false);
  }, beimSchliessen, { oben: true });
}
