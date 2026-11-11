// Backup: alle Daten als JSON-Datei sichern und wiederherstellen.
import { S, setEinst, exportObjekt, importiere, pruefeBackup } from './store.js';
import { heute, toast } from './util.js';

// Export. Auf dem iPhone öffnet sich das Teilen-Menü → „In Dateien sichern“ (oder AirDrop/Mail).
export async function exportieren() {
  const daten = exportObjekt();
  const name = `gym-backup-${heute()}.json`;
  const text = JSON.stringify(daten, null, 1);
  const blob = new Blob([text], { type: 'application/json' });
  const datei = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [datei] })) {
      await navigator.share({ files: [datei], title: 'Gym-Backup' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    await setEinst('letzterExport', new Date().toISOString());
    toast('💾 Backup erstellt – sicher es in „Dateien“ oder iCloud');
    return true;
  } catch (err) {
    if (err?.name === 'AbortError') { toast('Backup abgebrochen'); return false; }
    console.error(err);
    toast('⚠️ Backup fehlgeschlagen: ' + (err?.message || err));
    return false;
  }
}

// Import: Datei wählen → prüfen → nachfragen → alles ersetzen.
export function importieren(nachher) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json,text/plain';
  // Safari braucht das Feld im Dokument, sonst kommt nach der Auswahl kein „change“.
  inp.style.cssText = 'position:fixed;left:-9999px;opacity:0';
  document.body.appendChild(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files?.[0];
    inp.remove();
    if (!f) return;
    let obj;
    try { obj = JSON.parse(await f.text()); }
    catch { toast('⚠️ Datei ist kein gültiges Backup'); return; }
    const fehler = pruefeBackup(obj);
    if (fehler) { toast('⚠️ ' + fehler, 4000); return; }
    const n = obj.daten.einheiten.length;
    const vom = obj.exportiert ? new Date(obj.exportiert).toLocaleDateString('de-DE') : '?';
    if (!confirm(`Backup vom ${vom} mit ${n} Trainings laden?\n\nACHTUNG: Alle aktuellen Daten in der App werden dadurch ersetzt.`)) return;
    try {
      await importiere(obj);
      toast('✅ Backup geladen');
      nachher?.();
    } catch (err) {
      toast('⚠️ Import fehlgeschlagen: ' + (err?.message || err), 4000);
    }
  });
  inp.click();
}

export function letzterExportText() {
  const l = S.einst.letzterExport;
  return l ? new Date(l).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'noch nie';
}
