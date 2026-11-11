// Heute-Bildschirm: Tag A/B, Supersatz-Paare, Satz eintragen mit einem Tipp, Pausentimer.
import { S, speichereEinheit, setEinst } from './store.js';
import {
  tagHeute, eintragFuer, sichereEinheit, plaetze, reihenfolge, satzVon, vorschlag,
  wochenStand, faelligeErinnerungen, tagIds,
} from './training.js';
import * as timer from './timer.js';
import { bandPunkt, messungEintragen } from './ui.js';
import { FREI } from './progression.js';
import { esc, heute, trainingsDatum, fmtDatumLang, fmtZahl, fmtZeit, haptik, toast } from './util.js';

let auswahl = null;   // gewählter Satz {uebung, teil, nr}
let entwurf = null;   // Werte für einen neuen Satz {key, wdh, kg, band}
let ctx = null;       // aktuelle Bildschirm-Daten
let exportFn = null;

export function heuteInit({ beiExport }) { exportFn = beiExport; }

const key = a => `${a.uebung}|${a.teil}|${a.nr}`;

function teilName(ex, eintrag, teil) {
  const p = eintrag.ziel.teile[teil];
  if (eintrag.ziel.teile.length < 2) return ex.name;
  return ex.name + (p.typ === 'frei' ? ' frei' : p.typ === 'band' ? ' Band' : ' ohne Band');
}

export function zielText(ex, p) {
  const seite = ex.proSeite ? ' ' + ex.proSeite : '';
  if (p.typ === 'frei') return `${p.saetze} × ${p.wdh} frei`;
  if (p.typ === 'band') return `${p.saetze} × ${p.min}–${p.max} · ${p.band}`;
  if (p.typ === 'hantel') return `${p.saetze} × ${p.min}–${p.max}${seite} · ${fmtZahl(p.kg)} kg`;
  return `${p.saetze} × ${p.min}–${p.max}${seite}`;
}

function baueKontext() {
  const { einheit, tagId } = tagHeute();
  const tag = S.tage[tagId];
  const paare = (tag?.paare || []).map(paar => paar
    .filter(id => S.uebungen[id])
    .map(id => ({ ex: S.uebungen[id], eintrag: eintragFuer(einheit, S.uebungen[id]) })))
    .filter(p => p.length);
  return { einheit, tagId, tag, paare };
}

function alleEintraege() {
  return ctx.paare.flat();
}
function finde(uebId) {
  return alleEintraege().find(x => x.ex.id === uebId);
}

function naechsterPlatz() {
  for (const paar of ctx.paare) {
    for (const pl of reihenfolge(paar.map(x => x.eintrag))) {
      const { eintrag } = finde(pl.uebung);
      if (!satzVon(eintrag, pl.teil, pl.nr)) return pl;
    }
  }
  return null;
}

export function renderHeute(view, sheet) {
  ctx = baueKontext();
  if (!ctx.tag) {
    view.innerHTML = '<div class="leer">Kein Trainingstag angelegt. Lege im Tab „Plan“ einen Tag an.</div>';
    sheet.innerHTML = '';
    return;
  }
  if (auswahl && !finde(auswahl.uebung)) auswahl = null;
  const aktiv = auswahl || naechsterPlatz();

  const w = wochenStand();
  const p = Math.min(100, Math.round((w.anzahl / w.ziel) * 100));
  const darfWechseln = !ctx.einheit && tagIds().length > 1;
  const erinnerungen = faelligeErinnerungen();

  let html = `
    <div class="kopf">
      <div class="ring" style="--p:${p}"><div>${w.anzahl}/${w.ziel}<small>Woche</small></div></div>
      <div class="titel">
        <h1>Tag ${esc(ctx.tagId)} · ${esc(ctx.tag.name)}</h1>
        <p class="muted">${esc(fmtDatumLang(trainingsDatum()))}${darfWechseln ? `<button class="tagwechsel" data-a="tagwechsel">Tag wechseln</button>` : ''}</p>
        <span class="fire">🔥 ${w.serie} ${w.serie === 1 ? 'Woche' : 'Wochen'} Serie</span>
      </div>
    </div>`;

  for (const e of erinnerungen) {
    html += `<div class="erinnerung"><button class="txt" data-a="erinnerung" data-art="${e.art}">${esc(e.text)}</button><button class="weg" data-a="erinnerung-weg" data-art="${e.art}" aria-label="Heute ausblenden">✕</button></div>`;
  }

  ctx.paare.forEach((paar, pi) => {
    html += `<div class="sec">SUPERSATZ ${pi + 1}</div>`;
    for (const { ex, eintrag } of paar) {
      eintrag.ziel.teile.forEach((teilZiel, teil) => {
        const istAktiv = aktiv && aktiv.uebung === ex.id && aktiv.teil === teil;
        const liste = plaetze(eintrag).filter(x => x.teil === teil);
        if (aktiv && aktiv.uebung === ex.id && aktiv.teil === teil && aktiv.nr >= liste.length) liste.push({ ...aktiv });
        const kreise = liste.map(pl => {
          const s = satzVon(eintrag, teil, pl.nr);
          const c = aktiv && key(aktiv) === key(pl) ? ' c' : '';
          const inhalt = s ? s.wdh : `<span class="geist">${pl.nr + 1}</span>`;
          return `<button class="${s ? 'd' : ''}${c}" data-a="platz" data-u="${ex.id}" data-t="${teil}" data-n="${pl.nr}" aria-label="Satz ${pl.nr + 1}">${inhalt}</button>`;
        }).join('');
        const hinweis = teil === 0 && eintrag.hinweise?.length
          ? `<span class="hinweis">${eintrag.gesteigert ? '↑ ' : '✓ '}${esc(eintrag.hinweise.join(' · '))}</span>` : '';
        html += `
          <div class="row${istAktiv ? ' aktiv' : ''}" data-a="zeile" data-u="${ex.id}" data-t="${teil}">
            <div class="n"><b>${esc(teilName(ex, eintrag, teil))}</b><span>${esc(zielText(ex, teilZiel))}</span>${hinweis}</div>
            <div class="circ">${kreise}</div>
          </div>`;
      });
    }
  });
  view.innerHTML = html;
  renderSheet(sheet, aktiv);
  verbinde(view, sheet);
}

function renderSheet(sheet, aktiv) {
  const rest = timer.rest();
  let html = '<div class="grip"></div>';
  if (rest !== null) {
    html += `<div class="timer"><div class="zeit"><small>Pause</small><big>${fmtZeit(rest)}</big></div>
      <div class="tk"><button data-a="t-minus">−15</button><button data-a="t-plus">+15</button><button data-a="t-stop">Weiter</button></div></div>`;
  }
  if (!aktiv) {
    const w = wochenStand();
    html += `<div class="fertig"><b>💪 Training geschafft!</b><span class="muted">Diese Woche ${w.anzahl}/${w.ziel} · tippe einen Kreis an, um einen Satz zu ändern.</span></div>`;
    sheet.innerHTML = html;
    return;
  }
  const { ex, eintrag } = finde(aktiv.uebung);
  const p = eintrag.ziel.teile[aktiv.teil];
  const gespeichert = satzVon(eintrag, aktiv.teil, aktiv.nr);
  const k = key(aktiv);
  if (!gespeichert && (!entwurf || entwurf.key !== k)) {
    entwurf = { key: k, ...vorschlag(eintrag, aktiv.teil, aktiv.nr, ctx.einheit?.id) };
  }
  const werte = gespeichert || entwurf;
  const zielKurz = p.typ === 'frei' ? `Ziel ${p.wdh}` : `Ziel ${p.min}–${p.max}`;

  let zweites = '';
  if (p.typ === 'hantel') {
    zweites = `<div><small>kg pro Hantel</small><div class="st"><button data-a="kg-minus">−</button><b>${fmtZahl(werte.kg ?? p.kg)}</b><button data-a="kg-plus">+</button></div></div>`;
  } else if (p.typ === 'band') {
    const b = werte.band ?? p.band;
    zweites = `<div><small>Band</small><div class="st"><button data-a="band-minus" aria-label="leichteres Band">‹</button><b class="klein">${bandPunkt(b)}${esc(b)}</b><button data-a="band-plus" aria-label="schwereres Band">›</button></div></div>`;
  } else {
    zweites = `<div><small>Ausführung</small><div class="st" style="justify-content:center;height:44px"><b class="klein">${p.typ === 'frei' ? 'frei' : 'Körpergewicht'}</b></div></div>`;
  }
  const extra = `<button class="link" data-a="extra">+ Satz</button>`;
  const loeschen = gespeichert ? `<button class="link rot" data-a="loeschen">Löschen</button>` : '';
  html += `
    <div class="sh-kopf"><h4>${esc(teilName(ex, eintrag, aktiv.teil))} · Satz ${aktiv.nr + 1} <span>· ${zielKurz}</span></h4>${loeschen}${extra}</div>
    <div class="inp">
      <div><small>Wiederholungen</small><div class="st"><button data-a="wdh-minus">−</button><b>${werte.wdh}</b><button data-a="wdh-plus">+</button></div></div>
      ${zweites}
    </div>
    ${gespeichert
      ? `<button class="ok" data-a="weiter">✓ Gespeichert – weiter</button>`
      : `<button class="ok" data-a="speichern">✓ ${werte.wdh} Wdh. speichern</button>`}`;
  sheet.innerHTML = html;
}

// Satz-Werte ändern. Gespeicherte Sätze werden sofort gesichert, neue erst mit ✓.
async function aendereWert(feld, delta) {
  const aktiv = auswahl || naechsterPlatz();
  if (!aktiv) return;
  const { eintrag } = finde(aktiv.uebung);
  const p = eintrag.ziel.teile[aktiv.teil];
  const gespeichert = ctx.einheit ? satzVon(eintrag, aktiv.teil, aktiv.nr) : null;
  const ziel = gespeichert || entwurf;
  const baender = S.einst.baender;
  if (feld === 'wdh') ziel.wdh = Math.max(0, Math.min(200, ziel.wdh + delta));
  if (feld === 'kg') {
    const step = (S.uebungen[aktiv.uebung]?.schritt ?? 2.5) / 2;
    ziel.kg = Math.max(0, Math.round(((ziel.kg ?? p.kg) + delta * step) * 100) / 100);
  }
  if (feld === 'band') {
    const liste = p.richtung === 'hilfe' ? [FREI, ...baender] : baender;
    const i = liste.indexOf(ziel.band ?? p.band);
    ziel.band = liste[Math.max(0, Math.min(liste.length - 1, (i < 0 ? 0 : i) + delta))];
  }
  if (gespeichert) await speichereEinheit(ctx.einheit);
  rerender();
}

async function speichereSatz() {
  const aktiv = auswahl || naechsterPlatz();
  if (!aktiv || !entwurf) return;
  timer.tonFreischalten();
  haptik();
  const einheit = await sichereEinheit(ctx.tagId);
  let eintrag = einheit.eintraege.find(x => x.uebung === aktiv.uebung);
  if (!eintrag) { eintrag = finde(aktiv.uebung).eintrag; einheit.eintraege.push(eintrag); }
  const satz = { teil: aktiv.teil, nr: aktiv.nr, wdh: entwurf.wdh, t: Date.now() };
  if (entwurf.kg != null) satz.kg = entwurf.kg;
  if (entwurf.band != null) satz.band = entwurf.band;
  eintrag.saetze = eintrag.saetze.filter(s => !(s.teil === satz.teil && s.nr === satz.nr));
  eintrag.saetze.push(satz);
  await speichereEinheit(einheit);
  if (S.einst.tagWahl) setEinst('tagWahl', null);
  auswahl = null;
  entwurf = null;
  ctx = baueKontext();
  if (naechsterPlatz()) timer.starte();
  else { timer.stoppe(); toast('💪 Training geschafft – stark!'); }
  rerender();
}

async function loescheSatz() {
  const aktiv = auswahl;
  if (!aktiv || !ctx.einheit) return;
  if (!confirm('Diesen Satz löschen?')) return;
  const eintrag = ctx.einheit.eintraege.find(x => x.uebung === aktiv.uebung);
  eintrag.saetze = eintrag.saetze
    .filter(s => !(s.teil === aktiv.teil && s.nr === aktiv.nr))
    .map(s => (s.teil === aktiv.teil && s.nr > aktiv.nr ? { ...s, nr: s.nr - 1 } : s));
  await speichereEinheit(ctx.einheit);
  auswahl = null;
  entwurf = null;
  rerender();
}

let viewRef, sheetRef;
function rerender() { renderHeute(viewRef, sheetRef); }
export function heuteTick() {
  // Nur den Timer neu zeichnen (nicht den ganzen Bildschirm).
  if (!sheetRef || !document.body.contains(sheetRef) || !ctx) return;
  const big = sheetRef.querySelector('.timer big');
  const rest = timer.rest();
  if (rest !== null && big) big.textContent = fmtZeit(rest);
  else if ((rest === null) !== !big) rerender();
}

function verbinde(view, sheet) {
  viewRef = view; sheetRef = sheet;
  view.onclick = async e => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;
    if (a === 'platz') {
      e.stopPropagation();
      auswahl = { uebung: el.dataset.u, teil: +el.dataset.t, nr: +el.dataset.n };
      entwurf = null;
      rerender();
    } else if (a === 'zeile') {
      const { eintrag } = finde(el.dataset.u);
      const teil = +el.dataset.t;
      const frei = plaetze(eintrag).find(pl => pl.teil === teil && !satzVon(eintrag, teil, pl.nr));
      auswahl = frei || null;
      entwurf = null;
      rerender();
    } else if (a === 'tagwechsel') {
      const ids = tagIds();
      const i = ids.indexOf(ctx.tagId);
      await setEinst('tagWahl', { datum: trainingsDatum(), tag: ids[(i + 1) % ids.length] });
      auswahl = null; entwurf = null;
      rerender();
    } else if (a === 'erinnerung') {
      const art = el.dataset.art;
      if (art === 'backup') exportFn?.();
      else messungEintragen(art, rerender);
    } else if (a === 'erinnerung-weg') {
      await setEinst('erinnerungAus', { ...(S.einst.erinnerungAus || {}), [el.dataset.art]: heute() });
      rerender();
    }
  };
  sheet.onclick = async e => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;
    if (a === 'wdh-minus') aendereWert('wdh', -1);
    else if (a === 'wdh-plus') aendereWert('wdh', 1);
    else if (a === 'kg-minus') aendereWert('kg', -1);
    else if (a === 'kg-plus') aendereWert('kg', 1);
    else if (a === 'band-minus') aendereWert('band', -1);
    else if (a === 'band-plus') aendereWert('band', 1);
    else if (a === 'speichern') speichereSatz();
    else if (a === 'weiter') { auswahl = null; entwurf = null; rerender(); }
    else if (a === 'loeschen') loescheSatz();
    else if (a === 'extra') {
      const aktiv = auswahl || naechsterPlatz();
      if (!aktiv) return;
      const { eintrag } = finde(aktiv.uebung);
      const nrs = plaetze(eintrag).filter(pl => pl.teil === aktiv.teil).length;
      auswahl = { uebung: aktiv.uebung, teil: aktiv.teil, nr: nrs };
      entwurf = null;
      rerender();
    }
    else if (a === 't-minus') timer.aendere(-15);
    else if (a === 't-plus') timer.aendere(15);
    else if (a === 't-stop') timer.stoppe();
  };
}
