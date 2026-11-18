// Haut-Tab (Entwurf 3: Wochenplan oben, Liste zum Abhaken, Kalender der letzten 14 Tage) und Haut-Einstellungen.
import { S, setEinst, speichereHaut } from './store.js';
import {
  WIRKSTOFFE, HAUT_WOCHENTAGE, HAUT_WOCHENTAGE_LANG, wirkstoffAm, wirkstoffFuer, schritteFuer, teilStand,
  hautSerie, tagStatus, haltbarkeit, zeitOptionen, istGueltigeZeit,
} from './haut.js';
import { pushMoeglich, pushEinschalten, pushAusschalten, zeitenSenden, testSenden } from './push.js';
import { esc, trainingsDatum, addTage, wochenStart, fmtDatumLang, fmtDatumKurz, parseDatum, haptik, toast, heute } from './util.js';

let modus = 'liste'; // 'liste' oder 'einst'
let viewRef = null;

export function hautModus(m) { modus = m === 'einst' ? 'einst' : 'liste'; }

const produkt = id => S.einst.hautProdukte.find(p => p.id === id);
const fmtMonat = s => parseDatum(s).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

// ---------- Für den Startbildschirm ----------

// Karte „Heute Abend: …“ für den Heute-Tab (Trainings- und Restday).
export function hautKarteHtml() {
  // Mit ✕ für heute ausgeblendet? (Der Haut-Tab bleibt natürlich da.)
  if ((S.einst.erinnerungAus || {}).hautKarte === heute()) return '';
  const d = trainingsDatum();
  const e = S.haut[d];
  const w = wirkstoffFuer(e, S.einst.hautPlan, d);
  const m = teilStand(e, 'morgen', w), a = teilStand(e, 'abend', w);
  const name = w === 'pause' ? 'Pause' : WIRKSTOFFE[w].name;
  const unter = w === 'pause' ? 'kein Wirkstoff – nur Reinigungsgel und Nachtcreme' : esc(produkt(WIRKSTOFFE[w].produkt)?.name || '');
  const stand = m.fertig && a.fertig ? '✅ Hautpflege heute komplett'
    : `☀️ Morgen ${m.fertig ? '✓' : `${m.erledigt}/${m.gesamt}`} · 🌙 Abend ${a.fertig ? '✓' : `${a.erledigt}/${a.gesamt}`}`;
  return `<div class="karte haut-karte" data-a="haut" role="button" tabindex="0">
      <button class="weg-x" data-a="erinnerung-weg" data-art="hautKarte" aria-label="Heute ausblenden">✕</button>
      <small>🧴 HEUTE ABEND</small>
      <b>${esc(name)}</b>
      <span class="muted">${unter}</span>
      <span class="haut-stand">${stand}</span>
      <span class="tap">Haut ›</span>
    </div>`;
}

// Erinnerung, wenn das Retinal zu lange offen ist (für den Heute-Tab und den Haut-Tab).
export function hautErinnerungen() {
  const d = heute();
  if ((S.einst.erinnerungAus || {}).retinal === d) return [];
  const out = [];
  for (const p of S.einst.hautProdukte) {
    const h = haltbarkeit(p, d);
    if (h?.faellig) out.push({ art: 'retinal', text: `🧴 ${p.name} ist seit ${h.monateOffen} Monaten offen – neu kaufen und Öffnungsdatum eintragen` });
  }
  return out;
}

// ---------- Haut-Tab ----------

export function renderHaut(view) {
  viewRef = view;
  if (modus === 'einst') { renderEinst(view); return; }
  const d = trainingsDatum();
  const plan = S.einst.hautPlan;
  const e = S.haut[d];
  const w = wirkstoffFuer(e, plan, d);
  const serie = hautSerie(S.haut, plan, d);
  const mo = wochenStart(d);

  let html = `
    <div class="pad haut-kopf">
      <button class="zahn" data-a="einst" aria-label="Haut-Einstellungen">⚙︎</button>
      <h1>Haut</h1>
      <p class="muted">${esc(fmtDatumLang(d))}</p>
      <span class="fire">🔥 ${serie} ${serie === 1 ? 'Tag' : 'Tage'} am Stück</span>
    </div>
    <div class="woche">${HAUT_WOCHENTAGE.map((t, i) => {
      const tag = addTage(mo, i);
      const wi = tag === d ? w : wirkstoffAm(plan, tag);
      return `<div class="${tag === d ? 'heute' : ''}"><b>${t}</b><i class="p-${wi}"></i>${WIRKSTOFFE[wi].kurz}</div>`;
    }).join('')}</div>
    <div class="legende"><span><i class="p-retinal"></i>Retinal</span><span><i class="p-bha"></i>BHA 2 %</span><span><i class="p-pause"></i>Pause</span></div>`;

  for (const r of hautErinnerungen()) {
    html += `<div class="erinnerung"><button class="txt" data-a="einst">${esc(r.text)}</button><button class="weg" data-a="erinnerung-weg" data-art="${r.art}" aria-label="Heute ausblenden">✕</button></div>`;
  }
  const push = S.einst.hautPush || {};
  if (!push.an) {
    const m = pushMoeglich();
    html += `<button class="hinweis-karte" data-a="einst">🔔 ${m.moeglich ? 'Erinnerungen sind aus – in ⚙︎ einschalten' : esc(m.grund)}</button>`;
  } else if (push.fehler) {
    html += `<button class="hinweis-karte" data-a="einst">⚠️ ${esc(push.fehler)}</button>`;
  }

  for (const teil of ['morgen', 'abend']) {
    const st = teilStand(e, teil, w);
    const titel = teil === 'morgen' ? '☀️ MORGEN' : `🌙 ABEND · ${WIRKSTOFFE[w].name.toUpperCase()}`;
    html += `<div class="sec haut-sec">${titel}<small>${st.erledigt}/${st.gesamt}</small></div>`;
    for (const s of schritteFuer(teil, w)) {
      const an = !!e?.[teil]?.[s.id];
      const p = produkt(s.produkt);
      html += `<button class="row haut-row${an ? ' an' : ''}" data-a="schritt" data-teil="${teil}" data-s="${s.id}" aria-pressed="${an}">
        <div class="n"><b>${esc(s.name)}</b>${p ? `<span>${esc(p.name)}</span>` : ''}</div><span class="chk"></span></button>`;
    }
  }
  const g = e?.gereizt;
  html += `
    <div class="row haut-row" style="border:0">
      <div class="n"><b>Haut gereizt?</b><span>nur als Notiz für heute Abend</span></div>
      <div class="jn"><button data-a="gereizt" data-v="ja" class="${g === true ? 'on' : ''}">Ja</button><button data-a="gereizt" data-v="nein" class="${g === false ? 'on' : ''}">Nein</button></div>
    </div>`;
  if (w === 'pause') html += '<p class="info pad">Heute Pause: kein Wirkstoff, damit sich die Haut erholt.</p>';

  // Kalender: letzte 14 Tage
  const tage = [];
  for (let i = 13; i >= 0; i--) tage.push(addTage(d, -i));
  const voll = tage.filter(t => tagStatus(S.haut[t], plan, t) === 'voll').length;
  html += `
    <div class="chart" style="margin-top:12px">
      <div class="t"><b style="font-size:14px">Letzte 14 Tage</b><span style="color:var(--muted)">${voll} von 14 komplett</span></div>
      <div class="kal">${tage.map(t => `<i class="k-${tagStatus(S.haut[t], plan, t)}${t === d ? ' heute' : ''}" title="${esc(fmtDatumKurz(t))}"></i>`).join('')}</div>
      <div class="legende" style="margin:8px 0 0"><span><i class="kal-voll"></i>komplett</span><span><i class="kal-halb"></i>teilweise</span><span><i class="kal-leer"></i>nichts</span></div>
    </div>`;
  view.innerHTML = html;
  view.onclick = klickListe;
  view.onchange = null;
}

async function klickListe(ev) {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  const d = trainingsDatum();
  if (a === 'einst') { modus = 'einst'; renderHaut(viewRef); window.scrollTo(0, 0); return; }
  if (a === 'erinnerung-weg') {
    await setEinst('erinnerungAus', { ...(S.einst.erinnerungAus || {}), [el.dataset.art]: heute() });
    renderHaut(viewRef); return;
  }
  if (a !== 'schritt' && a !== 'gereizt') return;
  const alt = S.haut[d];
  // Wirkstoff des Tages beim ersten Eintrag festhalten.
  const e = structuredClone(alt || { datum: d, morgen: {}, abend: {}, gereizt: null });
  e.wirkstoff = wirkstoffFuer(alt, S.einst.hautPlan, d);
  if (a === 'schritt') {
    const { teil, s } = el.dataset;
    e[teil] = { ...(e[teil] || {}), [s]: !e[teil]?.[s] };
    if (e[teil][s]) haptik(20);
    const vorher = teilStand(alt, teil, e.wirkstoff).fertig;
    const jetzt = teilStand(e, teil, e.wirkstoff).fertig;
    await speichereHaut(e);
    if (!vorher && jetzt) {
      const serie = hautSerie(S.haut, S.einst.hautPlan, d);
      toast(teil === 'morgen' ? '☀️ Morgenroutine erledigt' : `🌙 Abendroutine erledigt${serie ? ` · 🔥 ${serie} ${serie === 1 ? 'Tag' : 'Tage'}` : ''}`);
    }
  } else {
    const v = el.dataset.v === 'ja';
    e.gereizt = e.gereizt === v ? null : v; // nochmal tippen = Notiz entfernen
    await speichereHaut(e);
  }
  renderHaut(viewRef);
}

// ---------- Haut-Einstellungen ----------

function zeitAuswahl(key) {
  const wert = S.einst.hautZeiten[key];
  const opts = zeitOptionen();
  if (!opts.includes(wert)) opts.unshift(wert);
  return `<select data-zeit="${key}">${opts.map(z => `<option value="${esc(z)}" ${z === wert ? 'selected' : ''}>${esc(z)} Uhr</option>`).join('')}</select>`;
}

function renderEinst(view) {
  const plan = S.einst.hautPlan;
  const push = S.einst.hautPush || {};
  const m = pushMoeglich();
  const d = heute();
  let pushHtml;
  if (push.an) {
    pushHtml = `<p class="info">🔔 Erinnerungen sind <b>an</b>.${push.fehler ? `<br>⚠️ ${esc(push.fehler)}` : ''}</p>
      <button class="knopf" data-a="push-test">Test-Mitteilung senden</button>
      <button class="knopf rot" data-a="push-aus">Erinnerungen ausschalten</button>`;
  } else if (m.moeglich) {
    pushHtml = `<p class="info">Die App schickt dir morgens und abends eine Mitteilung, auch wenn sie geschlossen ist.</p>
      <button class="knopf haupt" data-a="push-an">🔔 Erinnerungen einschalten</button>`;
  } else {
    pushHtml = `<p class="info">⚠️ ${esc(m.grund)}</p>`;
  }
  view.innerHTML = `
    <button class="zurueck" data-a="zurueck">‹ Haut</button>
    <div class="pad"><h1>Haut-Einstellungen</h1></div>
    <div class="titel2">WOCHENPLAN · ABENDS</div>
    <div class="chart">
      ${HAUT_WOCHENTAGE_LANG.map((t, i) => `<div class="feld"><span>${t}</span>
        <select data-plan="${i}">${Object.entries(WIRKSTOFFE).map(([k, v]) => `<option value="${k}" ${plan[i] === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>`).join('')}
      <p class="info">Retinal und BHA nie am selben Abend. Nach einem Wirkstoff-Abend tut eine Pause gut.</p>
    </div>
    <div class="titel2">ERINNERUNGEN</div>
    <div class="chart">
      <div class="feld"><span>Morgens Mo–Fr</span>${zeitAuswahl('morgenWoche')}</div>
      <div class="feld"><span>Morgens Sa–So</span>${zeitAuswahl('morgenWochenende')}</div>
      <div class="feld"><span>Abends</span>${zeitAuswahl('abend')}</div>
      ${pushHtml}
      <p class="info">An den Push-Server gehen nur die anonyme Push-Adresse, diese drei Uhrzeiten und die Zeitzone. Alles andere bleibt auf dem iPhone. Die Mitteilung kann bis zu 30 Minuten später kommen.</p>
    </div>
    <div class="titel2">PRODUKTE · ÖFFNUNGSDATUM</div>
    <div class="chart">
      ${S.einst.hautProdukte.map(p => {
        const h = haltbarkeit(p, d);
        const info = h ? (h.faellig ? `<small style="color:var(--red)">seit ${h.monateOffen} Monaten offen – ersetzen</small>` : `<small>ersetzen ab ${esc(fmtMonat(h.ablauf))}</small>`)
          : p.haltbarMonate ? `<small>nach ${p.haltbarMonate} Monaten ersetzen</small>` : '';
        return `<div class="produkt">
          <input type="text" data-pname="${esc(p.id)}" value="${esc(p.name)}" aria-label="Produktname">
          <div class="produkt-datum"><span>geöffnet ${info}</span>
            <input type="date" data-pdatum="${esc(p.id)}" value="${esc(p.geoeffnet || '')}" max="${d}">
            <button class="mini" data-a="heute-offen" data-p="${esc(p.id)}">heute</button></div>
        </div>`;
      }).join('')}
    </div>`;
  view.onclick = klickEinst;
  view.onchange = aenderungEinst;
}

async function klickEinst(ev) {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  if (a === 'zurueck') { modus = 'liste'; renderHaut(viewRef); window.scrollTo(0, 0); return; }
  if (a === 'heute-offen') {
    await produktAendern(el.dataset.p, { geoeffnet: heute() });
    toast('📅 Öffnungsdatum: heute');
  } else if (a === 'push-an') {
    el.disabled = true; el.textContent = 'Wird eingeschaltet …';
    try { await pushEinschalten(); toast('🔔 Erinnerungen sind an'); }
    catch (err) { toast('⚠️ ' + (err?.message || err), 5000); }
  } else if (a === 'push-aus') {
    await pushAusschalten();
    toast('🔕 Erinnerungen sind aus');
  } else if (a === 'push-test') {
    try { await testSenden(); toast('📨 Test gesendet – kommt gleich'); }
    catch (err) { toast('⚠️ ' + (err?.message || err), 5000); }
  }
  renderHaut(viewRef);
}

async function produktAendern(id, aenderung) {
  const liste = S.einst.hautProdukte.map(p => p.id === id ? { ...p, ...aenderung } : p);
  await setEinst('hautProdukte', liste);
}

async function aenderungEinst(ev) {
  const el = ev.target;
  if (el.dataset.plan != null) {
    const plan = [...S.einst.hautPlan];
    plan[+el.dataset.plan] = WIRKSTOFFE[el.value] ? el.value : 'pause';
    await setEinst('hautPlan', plan);
    toast('✅ Wochenplan gespeichert');
  } else if (el.dataset.zeit) {
    if (!istGueltigeZeit(el.value)) return;
    await setEinst('hautZeiten', { ...S.einst.hautZeiten, [el.dataset.zeit]: el.value });
    try { await zeitenSenden(); toast('✅ Uhrzeit gespeichert'); }
    catch (err) { toast('⚠️ Gespeichert, aber nicht an den Push-Server: ' + (err?.message || err), 5000); }
  } else if (el.dataset.pname) {
    const name = el.value.trim();
    if (!name) { renderHaut(viewRef); return; }
    await produktAendern(el.dataset.pname, { name });
  } else if (el.dataset.pdatum) {
    await produktAendern(el.dataset.pdatum, { geoeffnet: el.value || null });
    toast(el.value ? '📅 Öffnungsdatum gespeichert' : 'Öffnungsdatum gelöscht');
  }
  renderHaut(viewRef);
}
