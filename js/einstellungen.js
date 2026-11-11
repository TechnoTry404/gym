// Tab „Plan“ (Übungen und Tage ändern) und Tab „Mehr“ (Pause, Bänder, Backup, Speicher).
// Jede Änderung wird sofort gespeichert.
import { S, setEinst, speichereUebung, loescheUebung, speichereTag } from './store.js';
import { ARTEN } from './plan.js';
import { bandPunkt, modal, schliesseModal } from './ui.js';
import { exportieren, importieren, letzterExportText } from './backup.js';
import { istDauerhaft, dauerhaftAnfragen } from './db.js';
import { esc, fmtZeit, fmtZahl, toast, uid } from './util.js';

let viewRef;

// ================= PLAN =================
export function renderPlan(view) {
  viewRef = view;
  const uebs = Object.values(S.uebungen).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const optionen = (sel, leer) => (leer ? `<option value="">— keine —</option>` : '') +
    uebs.map(u => `<option value="${esc(u.id)}"${u.id === sel ? ' selected' : ''}>${esc(u.name)}</option>`).join('');

  let html = `<div class="pad"><h1>Plan</h1><p class="muted">Änderungen werden sofort gespeichert und gelten ab dem nächsten Training.</p></div>`;
  for (const tag of Object.values(S.tage).sort((a, b) => a.id.localeCompare(b.id))) {
    html += `<div class="chart"><div class="feld"><span><b>Tag ${esc(tag.id)}</b></span>
      <input type="text" data-a="tagname" data-tag="${esc(tag.id)}" value="${esc(tag.name)}" aria-label="Name von Tag ${esc(tag.id)}"></div>`;
    tag.paare.forEach((paar, i) => {
      html += `<div class="paar"><span class="nr">${i + 1}</span>
        <select data-a="paar" data-tag="${esc(tag.id)}" data-i="${i}" data-j="0">${optionen(paar[0], false)}</select>
        <select data-a="paar" data-tag="${esc(tag.id)}" data-i="${i}" data-j="1">${optionen(paar[1], true)}</select>
        <button class="mini" data-a="paar-hoch" data-tag="${esc(tag.id)}" data-i="${i}" aria-label="nach oben">↑</button>
        <button class="mini rot" data-a="paar-weg" data-tag="${esc(tag.id)}" data-i="${i}" aria-label="entfernen">✕</button></div>`;
    });
    html += `<button class="knopf" data-a="paar-neu" data-tag="${esc(tag.id)}">+ Supersatz-Paar</button></div>`;
  }
  html += `<div class="titel2">ÜBUNGEN</div>`;
  html += uebs.map(u => `<button class="ex" data-a="ueb" data-u="${esc(u.id)}"><div class="n"><b>${esc(u.name)}</b><span>${esc(kurz(u))}</span></div><span class="chev">›</span></button>`).join('');
  html += `<div class="pad"><button class="knopf haupt" data-a="ueb-neu">+ Neue Übung</button></div>`;
  view.innerHTML = html;
  view.onclick = planKlick;
  view.onchange = planAenderung;
}

function kurz(u) {
  const seite = u.proSeite ? ' ' + u.proSeite : '';
  let t = `${u.saetze} × ${u.min}–${u.max}${seite} · ${ARTEN[u.art] || u.art}`;
  if (u.art === 'band-hilfe' && u.frei) t = `frei ${u.frei.saetze} × ${u.frei.wdh} + ` + t;
  return t;
}

async function planKlick(e) {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  const tag = S.tage[el.dataset.tag];
  if (a === 'paar-neu') {
    const erste = Object.keys(S.uebungen)[0];
    tag.paare.push([erste]);
    await speichereTag(tag);
  } else if (a === 'paar-weg') {
    if (!confirm('Dieses Paar aus dem Tag entfernen? (Die Übungen und ihr Verlauf bleiben erhalten.)')) return;
    tag.paare.splice(+el.dataset.i, 1);
    await speichereTag(tag);
  } else if (a === 'paar-hoch') {
    const i = +el.dataset.i;
    if (i === 0) return;
    [tag.paare[i - 1], tag.paare[i]] = [tag.paare[i], tag.paare[i - 1]];
    await speichereTag(tag);
  } else if (a === 'ueb') { uebungBearbeiten(el.dataset.u); return; }
  else if (a === 'ueb-neu') {
    const u = { id: uid('u'), name: 'Neue Übung', art: 'hantel', saetze: 3, min: 8, max: 12, startKg: 5, schritt: 2.5, maxKg: 15 };
    await speichereUebung(u);
    uebungBearbeiten(u.id);
  } else return;
  renderPlan(viewRef);
}

async function planAenderung(e) {
  const el = e.target;
  const tag = S.tage[el.dataset.tag];
  if (el.dataset.a === 'tagname') {
    tag.name = el.value.trim() || tag.name;
    await speichereTag(tag);
    toast('Gespeichert');
  } else if (el.dataset.a === 'paar') {
    const paar = tag.paare[+el.dataset.i];
    const j = +el.dataset.j;
    if (j === 0) paar[0] = el.value;
    else if (el.value) paar[1] = el.value;
    else paar.length = 1;
    await speichereTag(tag);
    toast('Gespeichert');
  }
}

// ---------- Übung bearbeiten ----------
function zahlFeld(label, key, wert, extra = '') {
  return `<div class="feld"><span>${label}</span><input type="text" inputmode="decimal" data-zahl="1" data-k="${key}" value="${wert == null ? '' : fmtZahl(wert)}" ${extra}></div>`;
}
function bandAuswahl(key, wert) {
  return `<div class="feld"><span>${key === 'startBand' ? 'Start-Band' : 'Band'}</span><select data-k="${key}">${S.einst.baender.map(b => `<option${b === wert ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
}

function uebungBearbeiten(id) {
  const u = S.uebungen[id];
  if (!u) return;
  const imPlan = Object.values(S.tage).some(t => t.paare.some(p => p.includes(id)));
  let html = `<h3>Übung bearbeiten</h3><p class="info">Wird sofort gespeichert. Startwerte gelten, bis es für die Übung einen Verlauf gibt – danach rechnet die App selbst weiter.</p>
    <div class="feld"><span>Name</span><input type="text" data-k="name" value="${esc(u.name)}"></div>
    <div class="feld"><span>Art</span><select data-k="art">${Object.entries(ARTEN).map(([k, t]) => `<option value="${k}"${k === u.art ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
    ${zahlFeld('Sätze', 'saetze', u.saetze)}
    ${zahlFeld('Wdh. von', 'min', u.min)}
    ${zahlFeld('Wdh. bis', 'max', u.max)}
    <div class="feld"><span>Zusatz<small>z. B. „pro Bein“</small></span><input type="text" data-k="proSeite" value="${esc(u.proSeite || '')}"></div>`;
  if (u.art === 'hantel') {
    html += zahlFeld('Start-Gewicht (kg pro Hantel)', 'startKg', u.startKg)
      + zahlFeld('Steigerung (kg)', 'schritt', u.schritt ?? 2.5)
      + zahlFeld('Höchstgewicht (kg)', 'maxKg', u.maxKg ?? 15);
  }
  if (u.art === 'band-hilfe') {
    html += bandAuswahl('startBand', u.startBand)
      + `<div class="feld"><span>Freie Sätze vorweg<small>wie bei Klimmzügen</small></span><input type="checkbox" data-k="hatFrei"${u.frei ? ' checked' : ''}></div>`;
    if (u.frei) {
      html += zahlFeld('Freie Sätze', 'frei.saetze', u.frei.saetze)
        + zahlFeld('Freie Wdh. zum Start', 'frei.wdh', u.frei.wdh)
        + zahlFeld('Band weg ab freien Wdh.', 'bandWegAb', u.bandWegAb ?? 5)
        + zahlFeld('Freie Sätze ohne Band', 'freiSaetzeOhneBand', u.freiSaetzeOhneBand ?? 4);
    } else {
      html += zahlFeld('Ohne Band: Wdh. von', 'ohneBand.min', u.ohneBand?.min ?? u.min)
        + zahlFeld('Ohne Band: Wdh. bis', 'ohneBand.max', u.ohneBand?.max ?? u.max)
        + zahlFeld('Ohne Band: max. Sätze', 'maxSaetze', u.maxSaetze ?? u.saetze);
    }
  }
  if (u.art === 'koerper') {
    html += zahlFeld('Max. Sätze', 'maxSaetze', u.maxSaetze ?? u.saetze)
      + `<div class="feld"><span>Tipp für schwerer</span><input type="text" data-k="hinweis" value="${esc(u.hinweis || '')}"></div>`;
  }
  if (u.art === 'band-widerstand') html += bandAuswahl('startBand', u.startBand);
  html += `<button class="knopf haupt" data-a="zu">Fertig</button>`;
  html += imPlan ? `<p class="info">Zum Löschen die Übung zuerst aus allen Tagen entfernen.</p>` : `<button class="knopf rot" data-a="ueb-del">Übung löschen</button>`;

  modal(html, root => {
    root.addEventListener('change', async ev => {
      const el = ev.target;
      const k = el.dataset.k;
      if (!k) return;
      const neu = structuredClone(S.uebungen[id]);
      if (k === 'hatFrei') {
        neu.frei = el.checked ? { saetze: 3, wdh: 2 } : null;
        if (el.checked) { neu.bandWegAb ??= 5; neu.freiSaetzeOhneBand ??= 4; }
        else neu.ohneBand ??= { min: neu.min, max: neu.max };
      } else if (el.dataset.zahl) {
        const roh = String(el.value).replace(',', '.').trim();
        const v = Number(roh);
        if (roh === '' || !Number.isFinite(v) || v < 0) { toast('Bitte eine gültige Zahl eingeben'); return; }
        if (k === 'schritt' && v <= 0) { toast('Steigerung muss größer als 0 sein'); return; }
        const [a, b] = k.split('.');
        if (b) { neu[a] = { ...(neu[a] || {}), [b]: v }; } else neu[a] = v;
        if (['saetze', 'min', 'max'].includes(k) && v < 1) { toast('Mindestens 1'); return; }
      } else {
        neu[k] = el.value.trim();
        if (k === 'name' && !neu.name) { toast('Name darf nicht leer sein'); return; }
        if (k === 'art') {
          if (neu.art === 'hantel') { neu.startKg ??= 5; neu.schritt ??= 2.5; neu.maxKg ??= 15; }
          if (neu.art === 'band-hilfe' || neu.art === 'band-widerstand') neu.startBand ??= S.einst.baender[Math.floor(S.einst.baender.length / 2)];
          if (neu.art === 'band-hilfe' && neu.frei === undefined) neu.frei = null;
          if (neu.art === 'band-hilfe' && !neu.frei) neu.ohneBand ??= { min: neu.min, max: neu.max };
        }
      }
      if (neu.min > neu.max) { toast('„Wdh. von“ muss kleiner als „bis“ sein'); return; }
      await speichereUebung(neu);
      toast('Gespeichert');
      if (k === 'art' || k === 'hatFrei') { schliesseModal(); uebungBearbeiten(id); }
    });
    root.addEventListener('click', async ev => {
      const el = ev.target.closest('[data-a]');
      if (!el) return;
      if (el.dataset.a === 'zu') schliesseModal();
      if (el.dataset.a === 'ueb-del') {
        if (!confirm('Übung löschen? Bisherige Trainings bleiben im Verlauf.')) return;
        await loescheUebung(id);
        schliesseModal();
      }
    });
  }, () => renderPlan(viewRef));
}

// ================= MEHR =================
export async function renderMehr(view) {
  viewRef = view;
  view.dataset.tab = 'mehr';
  const dauerhaft = await istDauerhaft();
  const version = await appVersion();
  if (view.dataset.tab !== 'mehr') return; // inzwischen anderer Tab gewählt
  const b = S.einst.baender;
  view.innerHTML = `
    <div class="pad"><h1>Mehr</h1></div>
    <div class="chart">
      <div class="feld"><span>Pausenzeit<small>startet nach jedem Satz</small></span>
        <div class="st"><button data-a="pause" data-d="-15">−</button><b>${fmtZeit(S.einst.pauseSek)}</b><button data-a="pause" data-d="15">+</button></div></div>
      <div class="feld"><span>Wochenziel<small>Trainings pro Woche</small></span>
        <div class="st"><button data-a="ziel" data-d="-1">−</button><b>${S.einst.wochenZiel}</b><button data-a="ziel" data-d="1">+</button></div></div>
    </div>
    <div class="titel2">BÄNDER · LEICHT → SCHWER</div>
    <div class="chart">
      ${b.map((x, i) => `<div class="band-zeile">${bandPunkt(x)}<b>${esc(x)}</b>
        <button class="mini" data-a="band-hoch" data-i="${i}" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="leichter">↑</button>
        <button class="mini" data-a="band-runter" data-i="${i}" ${i === b.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="schwerer">↓</button></div>`).join('')}
      <p class="info">Oben = dünnstes Band (wenig Hilfe), unten = dickstes Band (viel Hilfe).</p>
    </div>
    <div class="titel2">BACKUP</div>
    <div class="chart">
      <p class="info">Deine Daten liegen nur auf diesem iPhone. Letztes Backup: <b>${esc(letzterExportText())}</b>. Die App erinnert dich alle 4 Wochen.</p>
      <button class="knopf haupt" data-a="export">💾 Backup exportieren</button>
      <button class="knopf" data-a="import">📂 Backup importieren</button>
    </div>
    <div class="titel2">SPEICHER</div>
    <div class="chart">
      <p class="info">Dauerhafter Speicher: <b>${dauerhaft === true ? 'ja ✅' : dauerhaft === false ? 'nein' : 'unbekannt'}</b></p>
      ${dauerhaft === true ? '' : '<button class="knopf" data-a="persist">Dauerhaften Speicher anfragen</button>'}
      <p class="info">⚠️ Wenn du die App vom Home-Bildschirm löschst, sind die Daten weg. Öffne die App immer über das Icon, nicht in Safari (dort ist ein anderer Speicher).</p>
    </div>
    <p class="info pad" style="text-align:center">Version ${esc(version)}</p>`;
  view.onclick = mehrKlick;
  view.onchange = null;
}

async function appVersion() {
  try {
    const k = (await caches.keys()).filter(x => x.startsWith('gymapp-')).sort().pop();
    return k ? k.replace('gymapp-', '') : 'ohne Offline-Speicher';
  } catch { return '?'; }
}

async function mehrKlick(e) {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  if (a === 'pause') await setEinst('pauseSek', Math.max(15, Math.min(600, S.einst.pauseSek + +el.dataset.d)));
  else if (a === 'ziel') await setEinst('wochenZiel', Math.max(1, Math.min(7, S.einst.wochenZiel + +el.dataset.d)));
  else if (a === 'band-hoch' || a === 'band-runter') {
    const i = +el.dataset.i, j = a === 'band-hoch' ? i - 1 : i + 1;
    const b = [...S.einst.baender];
    if (j < 0 || j >= b.length) return;
    [b[i], b[j]] = [b[j], b[i]];
    await setEinst('baender', b);
  } else if (a === 'export') await exportieren();
  else if (a === 'import') { importieren(() => location.reload()); return; }
  else if (a === 'persist') {
    const ok = await dauerhaftAnfragen();
    toast(ok ? '✅ Speicher ist jetzt dauerhaft' : 'iPhone hat abgelehnt – App über das Home-Bildschirm-Icon öffnen und regelmäßig Backups machen', 4000);
  }
  renderMehr(viewRef);
}

export { fmtZahl };
