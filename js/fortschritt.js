// Fortschritt: Kraft-Übersicht (seit Tag 1 / letzte 30 Tage), Körperdaten mit Grafiken, Verlauf.
import { S, speichereEinheit, loescheEinheit, loescheMessung } from './store.js';
import { einheitenSortiert, hatSaetze, MESS_ARTEN, zusammenfassung as trainingsSumme, zusammenfassungHtml } from './training.js';
import { leistung, FREI } from './progression.js';
import { linie, balken } from './charts.js';
import { gesamtRang, rangChip, RAENGE, XP_GRENZEN, kraftGrenzen, koerpergewicht as koerpergewichtRang } from './rang.js';
import { RANG_STANDARDS } from './plan.js';
import { messungEintragen, bandPunkt, modal, schliesseModal } from './ui.js';
import { esc, heute, addTage, fmtZahl, fmtDatumLang, fmtDatumKurz, vorTagen } from './util.js';

let modus = 'kraft';          // kraft | koerper | verlauf
let unter = null;             // null | 'liste' | {uebung} | {einheit}
let zeitraum = '30';          // 'alle' | '30'
let viewRef;

export function fortschrittZuruecksetzen() { unter = null; }
export function fortschrittModus(m) { modus = m; unter = null; }

// ---------- Rang ----------
const RANG_TEXT = [
  'Startrang – jeder fängt hier an.',
  'Einsteiger: die ersten Monate regelmäßig trainiert.',
  'Fortgeschritten: solide Kraft, meist nach 1–2 Jahren.',
  'Stark: deutlich über dem Durchschnitt im Gym.',
  'Sehr stark: jahrelanges, konsequentes Training.',
  'Elite: die Spitze – nur sehr wenige kommen hierhin.',
];
function alleRaengeZeigen() {
  const g = gesamtRang();
  const { kg: bw } = koerpergewichtRang();
  const latzug = kraftGrenzen(RANG_STANDARDS.latzug);
  const zeilen = RAENGE.map((name, i) => `
    <div class="rangzeile" style="margin:0 0 8px;${i === g.i ? 'border-color:rgba(232,121,249,.6)' : ''}">
      <div class="n"><b>${i + 1}. ${name}${i === g.i ? ' · du bist hier' : ''}</b>
        <span>${RANG_TEXT[i]}</span>
        <em>Disziplin ab ${XP_GRENZEN[i].toLocaleString('de-DE')} XP · Latzug ab ${i === 0 ? '0' : fmtZahl(Math.round(latzug[i] * bw * 2) / 2)} kg (1 Wdh.)</em></div>
      ${rangChip(i)}</div>`).join('');
  modal(`<h3>Alle Ränge</h3>
    <p class="info">Von unten nach oben: Bronze → Silber → Gold → Diamant → Smaragd → Rubin. Beispielgewichte bei ${fmtZahl(bw)} kg Körpergewicht.</p>
    ${zeilen}
    <p class="info">Jede Übung bekommt ihren eigenen Rang, dein Gesamtrang ist der gerundete Durchschnitt. Disziplin-Punkte können ihn zusätzlich anheben.</p>
    <button class="knopf haupt" data-a="zu">Schließen</button>`, root => {
    root.querySelector('[data-a=zu]').addEventListener('click', schliesseModal);
  });
}
function rangAnsicht() {
  const g = gesamtRang();
  const bw = koerpergewichtRang();
  const pct = x => Math.round(x * 100);
  const schnittText = g.kraftSchnitt == null
    ? 'Noch keine Kraftwerte – zählt bisher nur die Disziplin.'
    : `Kraft im Schnitt ${RAENGE[Math.round(g.kraftSchnitt)]} (${g.uebungen.filter(x => !x.ohneDaten).length} Übungen) · Disziplin ${RAENGE[g.disziplin.i]}`;
  let html = `
    <div class="karte" style="text-align:center">
      <button class="mini" data-a="alle-raenge" style="position:absolute;right:12px;top:12px">ⓘ Alle Ränge</button>
      <div class="muted">Dein Rang</div>
      <div style="margin:10px 0"><span class="rang gross r${g.i}"><i></i>${RAENGE[g.i]}</span></div>
      <div class="muted">${esc(schnittText)}</div>
    </div>
    <div class="karte">
      <div class="t" style="display:flex;justify-content:space-between;align-items:center"><b>⚡ Disziplin</b>${rangChip(g.disziplin.i)}</div>
      <div class="pct" style="font-size:34px">${g.xp.toLocaleString('de-DE')} <small>XP</small></div>
      <div class="balken"><div style="width:${pct(g.disziplin.anteil)}%"></div></div>
      <div class="muted">${g.disziplin.naechste != null ? `Noch ${(g.disziplin.naechste - g.xp).toLocaleString('de-DE')} XP bis ${RAENGE[g.disziplin.i + 1]}` : 'Höchster Rang erreicht'}</div>
      <p class="info">Training +100 · komplett +50 · Wochenziel +150 · Serie +25 je Woche · Rekord +30 · Steigerung +20 · Woche ausgelassen −200</p>
    </div>
`;
  // Kraft kompakt: wie viele Übungen in welchem Rang – Details über den Knopf.
  const mitDaten = g.uebungen.filter(x => !x.ohneDaten);
  const verteilung = RAENGE.map((_, i) => mitDaten.filter(x => x.i === i).length);
  html += `
    <button class="karte" data-a="raenge-uebungen">
      <span class="tap">Je Übung ›</span>
      <b>💪 Kraft</b>
      <p class="muted" style="margin:4px 0 10px">${mitDaten.length ? `${mitDaten.length} von ${g.uebungen.length} Übungen bewertet (letzte 6 Wochen)` : 'Noch keine Übung trainiert'}</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${verteilung.map((n, i) => (n ? `<span class="rang r${i}"><i></i>${n} × ${RAENGE[i]}</span>` : '')).join('') || '<span class="muted">–</span>'}</div>
    </button>
    <p class="info pad">So wird gerechnet: Für jede Übung schätzt die App dein Maximalgewicht für 1 Wiederholung (aus deinem besten Satz) und teilt es durch dein Körpergewicht (${fmtZahl(bw.kg)} kg${bw.geschaetzt ? ', geschätzt – trag dein Gewicht unter „Körper“ ein' : ''}). Richtwerte angelehnt an strengthlevel.com. Der Gesamtrang ist der Durchschnitt aller Übungs-Ränge, gerundet (z. B. 4 × Gold + 2 × Silber = Gold). Ist deine Disziplin höher, hebt sie den Schnitt etwas an – sie zieht ihn nie nach unten.</p>`;
  return html;
}

// Unterseite: Rang je Übung, nach Trainingstag sortiert.
function raengeJeUebung() {
  const g = gesamtRang();
  const pct = x => Math.round(x * 100);
  const nachId = Object.fromEntries(g.uebungen.map(x => [x.ex.id, x]));
  const gezeigt = new Set();
  let html = `<button class="zurueck" data-a="zurueck-rang">‹ Rang</button>
    <div class="pad"><h1>Rang je Übung</h1><p class="muted">Beste Leistung der letzten 6 Wochen</p></div>`;
  const nichtTrainiert = [];
  for (const tag of Object.values(S.tage).sort((a, b) => a.id.localeCompare(b.id))) {
    const zeilen = [];
    for (const id of tag.paare.flat()) {
      const x = nachId[id];
      if (!x || gezeigt.has(id)) continue;
      gezeigt.add(id);
      if (x.ohneDaten) { nichtTrainiert.push(x.ex.name); continue; }
      zeilen.push(rangZeile(x, pct));
    }
    if (zeilen.length) html += `<div class="titel2">TAG ${esc(tag.id)} · ${esc(tag.name.toUpperCase())}</div>` + zeilen.join('');
  }
  if (nichtTrainiert.length) html += `<p class="info pad">Noch ohne Rang (in 6 Wochen nicht trainiert): ${esc(nichtTrainiert.join(', '))}</p>`;
  return html;
}

function rangZeile(x, pct) {
  {
    const wdh = Math.min(x.satz.wdh, 20);
    const faktor = 1 + wdh / 30;
    const hilfe = x.teil?.typ === 'hilfe-kg';
    const jetzt = hilfe ? `${fmtZahl(x.satz.kg ?? x.teil.kg)} kg Hilfe × ${x.satz.wdh}` : `${fmtZahl(x.satz.kg ?? x.teil.kg)} kg × ${x.satz.wdh}`;
    let ziel = 'Höchster Rang erreicht';
    if (x.naechste != null) {
      const kg = x.naechste / faktor;
      ziel = hilfe
        ? `Für ${RAENGE[x.i + 1]}: ${Math.max(0, x.bw - kg) > 0 ? '≈ ' + fmtZahl(Math.floor(Math.max(0, x.bw - kg) * 2) / 2) + ' kg Hilfe' : 'ohne Hilfe'} × ${wdh}`
        : `Für ${RAENGE[x.i + 1]}: ≈ ${fmtZahl(Math.ceil(kg * 2) / 2)} kg × ${wdh}`;
    }
    return `<div class="rangzeile"><div class="n"><b>${esc(x.ex.name)}</b><span>Bestwert ${esc(jetzt)} · 1RM ≈ ${fmtZahl(Math.round(x.e1rm))} kg</span><em>${esc(ziel)}</em>
      <div class="balken"><div style="width:${pct(x.anteil)}%"></div></div></div>${rangChip(x.i)}</div>`;
  }
}

// ---------- Berechnungen ----------
// Nur Übungen, die im aktuellen Plan stehen (alte Übungen bleiben im Verlauf, aber nicht in Kraft/Rekorden).
function planUebungen() {
  const ids = new Set(Object.values(S.tage).flatMap(t => t.paare.flat()));
  return [...ids].map(id => S.uebungen[id]).filter(Boolean);
}

function verlaufUebung(ex) {
  const out = [];
  for (const e of einheitenSortiert()) {
    const en = e.eintraege?.find(x => x.uebung === ex.id && x.saetze?.length);
    if (!en) continue;
    const wert = leistung(ex, en, S.einst.baender, koerpergewicht());
    if (wert != null) out.push({ datum: e.datum, wert, eintrag: en });
  }
  return out;
}

function koerpergewicht() {
  const g = S.messungen.filter(m => m.art === 'gewicht').sort((a, b) => (a.datum < b.datum ? -1 : 1)).pop();
  return g?.wert || 70;
}

function vergleich(ex, zr) {
  const v = verlaufUebung(ex);
  if (v.length < 2) return null;
  const b = v[v.length - 1];
  let a;
  if (zr === 'alle') a = v[0];
  else {
    const start = addTage(heute(), -30);
    if (b.datum < start) return null;
    const vorher = v.filter(x => x.datum < start);
    a = vorher.length ? vorher[vorher.length - 1] : v.find(x => x.datum >= start);
    if (a === b) return null;
  }
  const pct = a.wert > 0 ? ((b.wert - a.wert) / a.wert) * 100 : 0;
  return { a, b, pct, klasse: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat' };
}

function alleVergleiche(zr) {
  return planUebungen()
    .map(ex => ({ ex, v: vergleich(ex, zr) }))
    .filter(x => x.v);
}

function zusammenfassung(zr) {
  const liste = alleVergleiche(zr);
  if (!liste.length) return null;
  const pct = liste.reduce((s, x) => s + x.v.pct, 0) / liste.length;
  return {
    pct,
    up: liste.filter(x => x.v.klasse === 'up').length,
    flat: liste.filter(x => x.v.klasse === 'flat').length,
    down: liste.filter(x => x.v.klasse === 'down').length,
  };
}

function rekorde() {
  const start = addTage(heute(), -30);
  const out = [];
  for (const ex of planUebungen()) {
    const v = verlaufUebung(ex);
    let best = v[0]?.wert ?? 0;
    for (let i = 1; i < v.length; i++) {
      if (v[i].wert > best + 1e-6) {
        if (v[i].datum >= start) out.push({ ex, punkt: v[i] });
        best = v[i].wert;
      }
    }
  }
  return out.sort((a, b) => (a.punkt.datum < b.punkt.datum ? 1 : -1)).slice(0, 3);
}

// Bester Satz eines Trainings als Text.
function satzText(ex, en) {
  const s = en.saetze, teile = en.ziel?.teile || [];
  if (ex.art === 'hantel' || ex.art === 'maschine') {
    const kg = x => (typeof x.kg === 'number' ? x.kg : teile[x.teil]?.kg ?? 0);
    const b = [...s].sort((x, y) => kg(y) * (1 + y.wdh / 30) - kg(x) * (1 + x.wdh / 30))[0];
    return `${fmtZahl(kg(b))} kg × ${b.wdh}`;
  }
  if (ex.art === 'maschine-hilfe') {
    const kg = x => (typeof x.kg === 'number' ? x.kg : teile[x.teil]?.kg ?? 0);
    const b = [...s].sort((x, y) => kg(x) - kg(y) || y.wdh - x.wdh)[0];
    return kg(b) > 0 ? `${fmtZahl(kg(b))} kg Hilfe × ${b.wdh}` : `ohne Hilfe × ${b.wdh}`;
  }
  if (ex.art === 'koerper') return `${Math.max(...s.map(x => x.wdh))} Wdh.`;
  if (ex.art === 'band-widerstand') {
    const bi = x => S.einst.baender.indexOf(x.band ?? teile[x.teil]?.band);
    const b = [...s].sort((x, y) => bi(y) - bi(x) || y.wdh - x.wdh)[0];
    return `${b.band ?? teile[b.teil]?.band} × ${b.wdh}`;
  }
  const teilText = [];
  const frei = s.filter(x => teile[x.teil]?.typ === 'frei' || x.band === FREI);
  if (frei.length) teilText.push(`frei ${Math.max(...frei.map(x => x.wdh))}`);
  const ohne = s.filter(x => teile[x.teil]?.typ === 'koerper');
  if (ohne.length) teilText.push(`ohne Band ${Math.max(...ohne.map(x => x.wdh))}`);
  const band = s.filter(x => teile[x.teil]?.typ === 'band' && x.band !== FREI);
  if (band.length) {
    const bi = x => S.einst.baender.indexOf(x.band ?? teile[x.teil]?.band);
    const b = [...band].sort((x, y) => bi(x) - bi(y) || y.wdh - x.wdh)[0];
    teilText.push(`${b.band ?? teile[b.teil]?.band} × ${b.wdh}`);
  }
  return teilText.join(' · ');
}

function badge(ex, v) {
  const hatteBand = v.a.eintrag.ziel?.teile?.some(t => t.typ === 'band');
  const hatBand = v.b.eintrag.ziel?.teile?.some(t => t.typ === 'band');
  if (ex.art === 'band-hilfe' && hatteBand && !hatBand) return '<div class="badge">Band weg</div>';
  const r = Math.round(v.pct);
  const cls = v.klasse === 'up' ? '' : v.klasse === 'down' ? ' down' : ' flat';
  return `<div class="badge${cls}">${r > 0 ? '+' : r < 0 ? '−' : '± '}${Math.abs(r)} %</div>`;
}

const pctHtml = pct => {
  const r = Math.round(pct);
  const cls = r > 0 ? '' : r < 0 ? ' minus' : ' null';
  return `<div class="pct${cls}">${r > 0 ? '+' : r < 0 ? '−' : '± '}${Math.abs(r)} %<small> ${r >= 0 ? 'stärker' : 'schwächer'}</small></div>`;
};

function balkenHtml(z) {
  return `<div class="bar3"><div style="flex:${z.up};background:#5eead4"></div><div style="flex:${z.flat};background:#4a3d6e"></div><div style="flex:${z.down};background:#f87171"></div></div>
    <div class="legend"><span><i style="background:#5eead4"></i>${z.up} gesteigert</span><span><i style="background:#4a3d6e"></i>${z.flat} gleich</span><span><i style="background:#f87171"></i>${z.down} weniger</span></div>`;
}

// ---------- Ansichten ----------
export function renderFortschritt(view) {
  viewRef = view;
  let html = '';
  if (unter && typeof unter === 'object' && unter.uebung) html = detailUebung(unter.uebung);
  else if (unter === 'liste') html = listeUebungen();
  else if (unter === 'raenge') html = raengeJeUebung();
  else if (unter && typeof unter === 'object' && unter.einheit) html = detailEinheit(unter.einheit);
  else {
    html = `<div class="pad"><h1>Fortschritt</h1></div>
      <div class="seg">${[['rang', 'Rang'], ['kraft', 'Kraft'], ['koerper', 'Körper'], ['verlauf', 'Verlauf']]
        .map(([k, t]) => `<button class="${modus === k ? 'on' : ''}" data-a="modus" data-k="${k}">${t}</button>`).join('')}</div>`;
    html += modus === 'rang' ? rangAnsicht() : modus === 'kraft' ? kraft() : modus === 'koerper' ? koerper() : verlauf();
  }
  view.innerHTML = html;
  view.onclick = klick;
}

function kraft() {
  const alle = zusammenfassung('alle');
  const d30 = zusammenfassung('30');
  const ersteE = einheitenSortiert().find(hatSaetze);
  const anzahl30 = S.einheiten.filter(e => hatSaetze(e) && e.datum >= addTage(heute(), -30)).length;
  if (!alle) {
    return `<div class="leer">Hier siehst du bald, wie stark du geworden bist.<br>Dafür braucht jede Übung mindestens 2 Trainings.</div>`;
  }
  let html = `
    <button class="karte" data-a="liste" data-z="alle">
      <span class="tap">Details ›</span>
      <div class="muted">Seit Tag 1 · ${esc(fmtDatumKurz(ersteE.datum))} → heute</div>
      ${pctHtml(alle.pct)}
      ${balkenHtml(alle)}
    </button>
    <button class="karte" data-a="liste" data-z="30">
      <span class="tap">Details ›</span>
      <div class="muted">Letzte 30 Tage · ${anzahl30} ${anzahl30 === 1 ? 'Training' : 'Trainings'}</div>
      ${d30 ? pctHtml(d30.pct) + balkenHtml(d30) : '<div class="pct null">–</div><div class="muted">Noch zu wenig Trainings in den letzten 30 Tagen.</div>'}
    </button>`;
  const r = rekorde();
  if (r.length) {
    html += `<div class="titel2">🏆 NEUE REKORDE (30 TAGE)</div>`;
    html += r.map(x => `<button class="ex" data-a="uebung" data-u="${x.ex.id}"><div class="n"><b>${esc(x.ex.name)}</b><span>${esc(satzText(x.ex, x.punkt.eintrag))} · ${esc(vorTagen(x.punkt.datum))}</span></div><div class="badge">Rekord</div></button>`).join('');
  }
  return html;
}

function listeUebungen() {
  const liste = alleVergleiche(zeitraum);
  const gruppe = (k, titel) => {
    const g = liste.filter(x => x.v.klasse === k).sort((a, b) => b.v.pct - a.v.pct);
    if (!g.length) return '';
    return `<div class="titel2">${titel} · ${g.length}</div>` + g.map(({ ex, v }) =>
      `<button class="ex" data-a="uebung" data-u="${ex.id}"><div class="n"><b>${esc(ex.name)}</b><span>${esc(satzText(ex, v.a.eintrag))} → ${esc(satzText(ex, v.b.eintrag))}</span></div>${badge(ex, v)}<span class="chev">›</span></button>`).join('');
  };
  return `<button class="zurueck" data-a="zurueck">‹ Fortschritt</button>
    <div class="pad"><h1>Welche Übung?</h1></div>
    <div class="seg klein"><button class="${zeitraum === 'alle' ? 'on' : ''}" data-a="zeitraum" data-z="alle">Seit Tag 1</button><button class="${zeitraum === '30' ? 'on' : ''}" data-a="zeitraum" data-z="30">Letzte 30 Tage</button></div>
    ${liste.length ? gruppe('up', 'GESTEIGERT') + gruppe('flat', 'GLEICH') + gruppe('down', 'WENIGER') : '<div class="leer">Noch keine Vergleiche in diesem Zeitraum.</div>'}`;
}

function detailUebung(id) {
  const ex = S.uebungen[id];
  if (!ex) { unter = null; return kraft(); }
  const v = verlaufUebung(ex);
  const letzte = v[v.length - 1];
  let html = `<button class="zurueck" data-a="zurueck-liste">‹ Zurück</button>
    <div class="pad"><h1>${esc(ex.name)}</h1>
    <p class="muted">${letzte ? 'Zuletzt ' + esc(letzte.eintrag.saetze.map(s => s.wdh).join(' · ')) + ' Wdh. · ' + esc(vorTagen(letzte.datum)) : 'Noch nicht trainiert'}</p></div>`;
  if (!v.length) return html;
  html += `<div class="vs"><div><b>Tag 1</b>${esc(satzText(ex, v[0].eintrag))}</div><div class="pfeil">→</div><div class="b"><b>Heute</b>${esc(satzText(ex, letzte.eintrag))}</div></div>`;

  const vg = vergleich(ex, 'alle');
  let titel, punkte;
  if (ex.art === 'hantel' || ex.art === 'maschine' || ex.art === 'maschine-hilfe') {
    titel = ex.art === 'hantel' ? 'Gewicht pro Hantel (kg)' : ex.art === 'maschine' ? 'Gewicht (kg)' : 'Unterstützung (kg) – weniger ist besser';
    const best = ex.art === 'maschine-hilfe' ? Math.min : Math.max;
    punkte = v.map(p => ({ datum: p.datum, wert: best(...p.eintrag.saetze.map(s => (typeof s.kg === 'number' ? s.kg : p.eintrag.ziel.teile[s.teil]?.kg ?? 0))) }));
  } else if (ex.art === 'band-hilfe' && ex.frei) {
    titel = 'Freie Wiederholungen (bester Satz)';
    punkte = v.map(p => ({ datum: p.datum, wert: Math.max(0, ...p.eintrag.saetze.filter(s => p.eintrag.ziel.teile[s.teil]?.typ === 'frei' || s.band === FREI).map(s => s.wdh)) }));
  } else {
    titel = 'Leistung (bester Satz)';
    punkte = v.map(p => ({ datum: p.datum, wert: Math.round(p.wert * 10) / 10 }));
  }
  html += `<div class="chart"><div class="t"><b>${esc(titel)}</b>${vg ? `<span>${vg.pct >= 0 ? '+' : '−'}${Math.abs(Math.round(vg.pct))} % seit Tag 1</span>` : ''}</div>${linie(punkte)}</div>`;
  const gesamt = v.slice(-12).map(p => p.eintrag.saetze.reduce((s, x) => s + x.wdh, 0));
  html += `<div class="chart"><div class="t"><b>Wiederholungen je Training</b><span class="muted">letzte ${gesamt.length}</span></div>${balken(gesamt)}</div>`;
  if (ex.art === 'band-hilfe' || ex.art === 'band-widerstand') {
    html += `<p class="info pad">Bei Band-Übungen zählt ein dünneres (bzw. bei Face Pulls ein dickeres) Band als Steigerung, freie Wiederholungen zählen am meisten.</p>`;
  }
  return html;
}

function koerper() {
  let html = '';
  for (const [art, info] of Object.entries(MESS_ARTEN)) {
    const werte = S.messungen.filter(m => m.art === art).sort((a, b) => (a.datum < b.datum ? -1 : 1));
    let diff = '';
    if (werte.length > 1) {
      const d = werte[werte.length - 1].wert - werte[0].wert;
      diff = `<span>${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmtZahl(Math.abs(d))} ${info.einheit}</span>`;
    }
    html += `<div class="chart"><div class="t"><b>${info.icon} ${esc(info.titel)}</b>${diff}</div>
      ${linie(werte.map(m => ({ datum: m.datum, wert: m.wert })), { farbe: art === 'klimmzugMax' ? '#5eead4' : '#e879f9', leer: 'Noch kein Wert eingetragen' })}
      <p class="muted" style="margin-top:6px">${info.montags ? 'Jeden Montag' : info.tage === 14 ? 'Alle 2 Wochen' : 'Alle 4 Wochen'}</p>
      <div class="liste">${werte.slice(-5).reverse().map(m => `
        <div class="zeile"><span>${esc(fmtDatumKurz(m.datum))}</span><b>${fmtZahl(m.wert)} ${info.einheit}</b>
          <span><button class="mini" data-a="mess-edit" data-id="${m.id}">Ändern</button> <button class="mini rot" data-a="mess-del" data-id="${m.id}">✕</button></span></div>`).join('')}</div>
      <button class="knopf haupt" data-a="mess-neu" data-art="${art}">+ ${esc(info.titel)} eintragen</button></div>`;
  }
  return html;
}

function verlauf() {
  const liste = einheitenSortiert().filter(hatSaetze).reverse();
  if (!liste.length) return '<div class="leer">Noch kein Training eingetragen.</div>';
  return liste.map(e => {
    const z = trainingsSumme(e);
    return `<button class="ex" data-a="einheit" data-id="${e.id}"><div class="vl"><div class="tagbadge">${esc(e.tag)}</div></div>
      <div class="n"><b>${esc(fmtDatumLang(e.datum))}</b><span>${z.minuten ?? '–'} Min. · ${z.kg.toLocaleString('de-DE')} kg · ${z.saetze} Sätze · ${z.wdh} Wdh.</span></div><span class="chev">›</span></button>`;
  }).join('');
}

function detailEinheit(id) {
  const e = S.einheiten.find(x => x.id === id);
  if (!e) { unter = null; modus = 'verlauf'; return verlauf(); }
  let html = `<button class="zurueck" data-a="zurueck">‹ Verlauf</button>
    <div class="pad"><h1>Tag ${esc(e.tag)}</h1><p class="muted">${esc(fmtDatumLang(e.datum))} · Änderungen werden sofort gespeichert</p>
    ${trainingsSumme(e) ? zusammenfassungHtml(trainingsSumme(e)) : ''}</div><div style="height:12px"></div>`;
  for (const en of e.eintraege) {
    if (!en.saetze.length) continue;
    const ex = S.uebungen[en.uebung];
    html += `<div class="chart"><div class="t"><b>${esc(ex?.name || en.name || en.uebung)}</b></div>`;
    const sortiert = [...en.saetze].sort((a, b) => a.teil - b.teil || a.nr - b.nr);
    for (const s of sortiert) {
      const p = en.ziel.teile[s.teil] || {};
      const z = `data-u="${esc(en.uebung)}" data-i="${en.saetze.indexOf(s)}"`;
      let zweites = '';
      if (p.typ === 'hantel' || p.typ === 'hilfe-kg') zweites = `<div class="st"><button data-a="s-kg" data-d="-1" ${z}>−</button><b>${fmtZahl(s.kg ?? p.kg)}</b><button data-a="s-kg" data-d="1" ${z}>+</button></div>`;
      else if (p.typ === 'band') zweites = `<div class="st"><button data-a="s-band" data-d="-1" ${z}>‹</button><b>${bandPunkt(s.band ?? p.band)}</b><button data-a="s-band" data-d="1" ${z}>›</button></div>`;
      html += `<div class="satzzeile"><span class="nr">${p.typ === 'frei' ? 'frei ' : ''}Satz ${s.nr + 1}</span>
        <div class="st"><button data-a="s-wdh" data-d="-1" ${z}>−</button><b>${s.wdh}</b><button data-a="s-wdh" data-d="1" ${z}>+</button></div>
        ${zweites}<button class="mini rot" data-a="s-del" ${z}>✕</button></div>`;
    }
    html += '</div>';
  }
  html += `<div class="pad"><button class="knopf rot" data-a="einheit-del">Training löschen</button></div>`;
  return html;
}

async function aendereSatz(el) {
  const e = S.einheiten.find(x => x.id === unter.einheit);
  const en = e?.eintraege.find(x => x.uebung === el.dataset.u);
  const s = en?.saetze[+el.dataset.i];
  if (!s) return;
  const p = en.ziel.teile[s.teil] || {};
  const d = +el.dataset.d;
  const a = el.dataset.a;
  if (a === 's-wdh') s.wdh = Math.max(0, s.wdh + d);
  if (a === 's-kg') s.kg = Math.max(0, Math.round(((s.kg ?? p.kg ?? 0) + d * ((S.uebungen[en.uebung]?.schritt ?? 2.5) / 2)) * 100) / 100);
  if (a === 's-band') {
    const liste = p.richtung === 'hilfe' ? [FREI, ...S.einst.baender] : S.einst.baender;
    const i = liste.indexOf(s.band ?? p.band);
    s.band = liste[Math.max(0, Math.min(liste.length - 1, (i < 0 ? 0 : i) + d))];
  }
  if (a === 's-del') {
    if (!confirm('Diesen Satz löschen?')) return;
    en.saetze = en.saetze.filter(x => x !== s).map(x => (x.teil === s.teil && x.nr > s.nr ? { ...x, nr: x.nr - 1 } : x));
  }
  await speichereEinheit(e);
  renderFortschritt(viewRef);
}

async function klick(ev) {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  if (a === 'modus') { modus = el.dataset.k; unter = null; }
  else if (a === 'liste') { zeitraum = el.dataset.z; unter = 'liste'; }
  else if (a === 'zeitraum') { zeitraum = el.dataset.z; }
  else if (a === 'uebung') { unter = { uebung: el.dataset.u, von: unter }; }
  else if (a === 'zurueck') { unter = null; }
  else if (a === 'raenge-uebungen') { unter = 'raenge'; }
  else if (a === 'zurueck-rang') { unter = null; modus = 'rang'; }
  else if (a === 'zurueck-liste') { unter = unter?.von === 'liste' ? 'liste' : null; }
  else if (a === 'einheit') { unter = { einheit: el.dataset.id }; }
  else if (a === 'alle-raenge') { alleRaengeZeigen(); return; }
  else if (a === 'mess-neu') { messungEintragen(el.dataset.art, () => renderFortschritt(viewRef)); return; }
  else if (a === 'mess-edit') {
    const m = S.messungen.find(x => x.id === el.dataset.id);
    if (m) messungEintragen(m.art, () => renderFortschritt(viewRef), m);
    return;
  } else if (a === 'mess-del') {
    if (!confirm('Diesen Wert löschen?')) return;
    await loescheMessung(el.dataset.id);
  } else if (a.startsWith('s-')) { await aendereSatz(el); return; }
  else if (a === 'einheit-del') {
    if (!confirm('Dieses ganze Training löschen? Das kann nicht rückgängig gemacht werden.')) return;
    await loescheEinheit(unter.einheit);
    unter = null;
  }
  renderFortschritt(viewRef);
  window.scrollTo(0, 0);
}
