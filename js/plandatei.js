// Plan-Datei: einen Trainingsplan (Übungen, Tage, Bereiche) als Datei weitergeben und laden.
// Gedacht z. B. für ein zweites iPhone mit eigenem Plan: nach dem Import ist NUR dieser Plan zu sehen.
// Trainings im Verlauf bleiben beim Import immer erhalten.
import * as db from './db.js';
import { S, ladeAlles, MODULE } from './store.js';
import { ARTEN, PLAN_VERSION } from './plan.js';
import { heute, toast } from './util.js';

export const PLAN_APP = 'gymapp-plan';

const istText = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 80;
const istZahl = (x, min, max) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

// Prüft eine Plan-Datei. Gibt Fehlertext zurück oder null, wenn alles passt.
export function pruefePlan(p) {
  if (!p || typeof p !== 'object') return 'Keine gültige Datei.';
  if (p.app !== PLAN_APP) return p.app === 'gymapp' ? 'Das ist ein Backup, keine Plan-Datei (Backups unter „Backup importieren“).' : 'Das ist keine Plan-Datei dieser App.';
  if (typeof p.schema !== 'number' || p.schema > 1) return 'Plan-Datei stammt aus einer neueren App-Version.';
  if (!Array.isArray(p.uebungen) || !p.uebungen.length) return 'Plan enthält keine Übungen.';
  if (!Array.isArray(p.tage) || !p.tage.length) return 'Plan enthält keine Trainingstage.';
  const ids = new Set();
  for (const u of p.uebungen) {
    if (!u || !istText(u.id) || !istText(u.name)) return 'Eine Übung hat keinen Namen oder keine ID.';
    if (ids.has(u.id)) return `Übung „${u.name}“ ist doppelt.`;
    ids.add(u.id);
    if (!ARTEN[u.art]) return `Übung „${u.name}“: unbekannte Art „${u.art}“.`;
    if (!istZahl(u.saetze, 1, 10) || !istZahl(u.min, 1, 200) || !istZahl(u.max, u.min, 200)) return `Übung „${u.name}“: Sätze oder Wiederholungen ungültig.`;
    if (['hantel', 'maschine', 'maschine-hilfe'].includes(u.art) && !istZahl(u.startKg, 0, 500)) return `Übung „${u.name}“: Startgewicht fehlt.`;
    if (u.einheit != null && !['kg', 'lb'].includes(u.einheit)) return `Übung „${u.name}“: Einheit muss kg oder lb sein.`;
  }
  const tagIds = new Set();
  for (const t of p.tage) {
    if (!t || !istText(t.id) || !istText(t.name)) return 'Ein Trainingstag hat keinen Namen oder keine ID.';
    if (tagIds.has(t.id)) return `Tag „${t.id}“ ist doppelt.`;
    tagIds.add(t.id);
    if (t.wochentag != null && !istZahl(t.wochentag, 0, 7)) return `Tag „${t.name}“: Wochentag ungültig (0–7).`;
    if (!Array.isArray(t.paare) || !t.paare.length) return `Tag „${t.name}“ hat keine Übungen.`;
    for (const paar of t.paare) {
      if (!Array.isArray(paar) || paar.length < 1 || paar.length > 2) return `Tag „${t.name}“: Übungspaar ungültig.`;
      for (const id of paar) if (!ids.has(id)) return `Tag „${t.name}“: Übung „${id}“ fehlt in der Liste.`;
    }
  }
  const m = p.einstellungen?.module;
  if (m != null && (typeof m !== 'object' || Object.keys(m).some(k => !MODULE[k]))) return 'Bereiche in der Plan-Datei ungültig.';
  return null;
}

// Aktuellen Plan als Datei-Inhalt (Tage + benutzte Übungen + Bereiche).
export function planExportObjekt() {
  const tage = Object.values(S.tage).sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set(tage.flatMap(t => t.paare.flat()));
  return {
    app: PLAN_APP,
    schema: 1,
    name: S.einst.planName || 'Mein Plan',
    exportiert: new Date().toISOString(),
    uebungen: Object.values(S.uebungen).filter(u => ids.has(u.id)),
    tage,
    einstellungen: { module: { ...(S.einst.module || {}) }, wochenZiel: S.einst.wochenZiel, pauseSek: S.einst.pauseSek },
  };
}

// Plan ersetzen – in EINEM Schritt (klappt etwas nicht, bleibt alles wie vorher).
// Alte Übungen werden entfernt, außer sie stecken in gespeicherten Trainings (für den Verlauf).
export async function planErsetzen(p) {
  const fehler = pruefePlan(p);
  if (fehler) throw new Error(fehler);
  const neu = new Set(p.uebungen.map(u => u.id));
  const benutzt = new Set(S.einheiten.flatMap(e => (e.eintraege || []).map(x => x.uebung)));
  const e = p.einstellungen || {};
  const einst = {
    module: { ...(e.module || {}) },
    eigenerPlan: true,
    planVersion: PLAN_VERSION,
    planName: istText(p.name) ? p.name : 'Eigener Plan',
    tagWahl: null,
    ...(istZahl(e.wochenZiel, 1, 7) ? { wochenZiel: e.wochenZiel } : {}),
    ...(istZahl(e.pauseSek, 15, 600) ? { pauseSek: e.pauseSek } : {}),
  };
  await db.vieleAendern([
    ...Object.keys(S.uebungen).filter(id => !neu.has(id) && !benutzt.has(id)).map(id => ({ store: 'uebungen', loeschen: id })),
    ...Object.keys(S.tage).map(id => ({ store: 'tage', loeschen: id })),
    ...p.uebungen.map(u => ({ store: 'uebungen', wert: { ...u } })),
    ...p.tage.map(t => ({ store: 'tage', wert: { id: t.id, name: t.name, wochentag: t.wochentag || 0, paare: t.paare.map(x => [...x]) } })),
    ...Object.entries(einst).map(([key, wert]) => ({ store: 'einstellungen', wert: { key, wert } })),
  ]);
  await ladeAlles();
}

// Datei wählen → prüfen → nachfragen → Plan ersetzen.
export function planImportieren(nachher) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json,text/plain';
  inp.style.cssText = 'position:fixed;left:-9999px;opacity:0';
  document.body.appendChild(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files?.[0];
    inp.remove();
    if (!f) return;
    let p;
    try { p = JSON.parse(await f.text()); } catch { toast('⚠️ Datei ist keine gültige Plan-Datei'); return; }
    const fehler = pruefePlan(p);
    if (fehler) { toast('⚠️ ' + fehler, 5000); return; }
    const aus = Object.entries(p.einstellungen?.module || {}).filter(([, v]) => v === false).map(([k]) => MODULE[k].split(' (')[0]);
    if (!confirm(`Plan „${p.name || 'ohne Namen'}“ laden?\n\n${p.tage.length} Trainingstage, ${p.uebungen.length} Übungen.${aus.length ? `\nAusgeschaltet: ${aus.join(', ')}.` : ''}\n\nDein bisheriger Plan wird ersetzt. Gespeicherte Trainings bleiben erhalten.`)) return;
    try {
      await planErsetzen(p);
      toast('✅ Plan geladen');
      nachher?.();
    } catch (err) {
      toast('⚠️ Plan laden fehlgeschlagen: ' + (err?.message || err), 5000);
    }
  });
  inp.click();
}

// Plan als Datei weitergeben (iPhone: Teilen-Menü → AirDrop, WhatsApp, Dateien …).
export async function planExportieren() {
  const daten = planExportObjekt();
  const name = `gym-plan-${String(daten.name).toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || 'plan'}-${heute()}.json`;
  const blob = new Blob([JSON.stringify(daten, null, 1)], { type: 'application/json' });
  const datei = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [datei] })) await navigator.share({ files: [datei], title: 'Gym-Plan' });
    else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    toast('📤 Plan-Datei erstellt');
  } catch (err) {
    if (err?.name !== 'AbortError') toast('⚠️ Plan exportieren fehlgeschlagen: ' + (err?.message || err));
  }
}
