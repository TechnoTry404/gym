// Steigerungs-Regeln. Reine Rechenlogik (kein Bildschirm, keine Datenbank) → automatisch testbar.
//
// Begriffe:
//  Zustand = wo du gerade stehst (Band, Gewicht, freie Wiederholungen …).
//  Ziel    = was heute dran ist, aufgeteilt in "Teile" (z. B. Klimmzüge frei + Klimmzüge mit Band).
//  Satz    = { teil, nr, wdh, kg?, band? }
//
// Bänder-Liste: leicht → schwer (z. B. gelb … grün). "frei" = ohne Band.

export const FREI = 'frei';

// Stufe eines Bandes in der Liste (frei = -1, also leichter als jedes Band).
export function bandIndex(baender, band) {
  return band === FREI || band == null ? -1 : baender.indexOf(band);
}
export function duenner(baender, band) {
  const i = baender.indexOf(band);
  return i > 0 ? baender[i - 1] : null;
}
export function dicker(baender, band) {
  const i = baender.indexOf(band);
  return i >= 0 && i < baender.length - 1 ? baender[i + 1] : null;
}

export function startZustand(ex) {
  switch (ex.art) {
    case 'band-hilfe':
      return { freiSaetze: ex.frei?.saetze ?? 0, freiWdh: ex.frei?.wdh ?? 0, band: ex.startBand ?? null, saetze: ex.saetze };
    case 'hantel': return { kg: ex.startKg ?? 0 };
    case 'koerper': return { saetze: ex.saetze };
    case 'band-widerstand': return { band: ex.startBand ?? null };
    default: return {};
  }
}

// Aus Übung + Zustand das heutige Ziel bauen.
export function baueZiel(ex, z) {
  const teile = [];
  const saetzeKoerper = Math.max(ex.saetze, z.saetze || 0);
  if (ex.art === 'band-hilfe') {
    if (ex.frei) teile.push({ typ: 'frei', saetze: z.freiSaetze > 0 ? z.freiSaetze : ex.frei.saetze, wdh: z.freiWdh > 0 ? z.freiWdh : ex.frei.wdh });
    if (z.band) teile.push({ typ: 'band', richtung: 'hilfe', saetze: ex.saetze, min: ex.min, max: ex.max, band: z.band });
    else if (!ex.frei) teile.push({ typ: 'koerper', saetze: saetzeKoerper, min: ex.ohneBand?.min ?? ex.min, max: ex.ohneBand?.max ?? ex.max });
  } else if (ex.art === 'hantel') {
    teile.push({ typ: 'hantel', saetze: ex.saetze, min: ex.min, max: ex.max, kg: z.kg });
  } else if (ex.art === 'koerper') {
    teile.push({ typ: 'koerper', saetze: saetzeKoerper, min: ex.min, max: ex.max });
  } else if (ex.art === 'band-widerstand') {
    teile.push({ typ: 'band', richtung: 'widerstand', saetze: ex.saetze, min: ex.min, max: ex.max, band: z.band });
  }
  return { teile };
}

const letzteBand = saetze => {
  for (let i = saetze.length - 1; i >= 0; i--) if (saetze[i].band) return saetze[i].band;
  return null;
};
const zahl = n => (Math.round(n * 100) / 100).toLocaleString('de-DE');

// Kern: Aus dem letzten Training (Ziel + geschaffte Sätze) den nächsten Zustand berechnen.
export function naechsterZustand(ex, eintrag, baender) {
  const z = { ...startZustand(ex), ...(eintrag?.zustand || {}) };
  const hinweise = [];
  let gesteigert = false;
  if (!eintrag || !eintrag.saetze?.length) return { zustand: z, hinweise, gesteigert };

  const teile = eintrag.ziel?.teile || [];
  let bandWeg = false;

  teile.forEach((p, i) => {
    const s = eintrag.saetze.filter(x => x.teil === i);
    if (!s.length) return;

    if (p.typ === 'frei') {
      // Frei: alle Sätze mit Ziel-Wdh. geschafft → +1 Wdh.; ab 3 × 5 frei → Band weg, 4 freie Sätze.
      const ok = s.filter(x => x.wdh >= p.wdh).length >= p.saetze;
      if (!ok) return;
      gesteigert = true;
      if (z.band && p.wdh >= (ex.bandWegAb ?? 5)) {
        z.band = null;
        bandWeg = true;
        z.freiSaetze = ex.freiSaetzeOhneBand ?? 4;
        z.freiWdh = p.wdh;
        hinweise.push(`Band weg – jetzt ${z.freiSaetze} freie Sätze`);
      } else {
        z.freiWdh = p.wdh + 1;
        hinweise.push(`Frei jetzt ${p.saetze} × ${p.wdh + 1}`);
      }
    } else if (p.typ === 'band' && p.richtung === 'hilfe') {
      if (bandWeg) return;
      // Mit Band: alle Sätze mit oberer Wdh.-Zahl (z. B. 3 × 8) → dünneres Band.
      const genutzt = letzteBand(s) ?? p.band;
      const ok = s.filter(x => x.wdh >= p.max && bandIndex(baender, x.band ?? p.band) <= bandIndex(baender, p.band)).length >= p.saetze;
      if (ok) {
        const basis = genutzt !== FREI && bandIndex(baender, genutzt) < bandIndex(baender, p.band) ? genutzt : p.band;
        const d = duenner(baender, basis);
        if (d) {
          z.band = d; gesteigert = true;
          hinweise.push(`Dünneres Band: ${d}`);
        } else if (!ex.frei) {
          z.band = null; z.saetze = ex.saetze; gesteigert = true;
          hinweise.push('Band weg – jetzt ohne Band');
        } else {
          hinweise.push('Dünnstes Band geschafft – Fokus auf freie Sätze');
        }
      } else if (genutzt && genutzt !== FREI && baender.includes(genutzt) && genutzt !== p.band) {
        z.band = genutzt; // du hast selbst ein anderes Band gewählt → das gilt weiter
      }
    } else if (p.typ === 'koerper') {
      const ok = s.filter(x => x.wdh >= p.max).length >= p.saetze;
      if (!ok) return;
      const maxS = ex.maxSaetze ?? p.saetze;
      if (p.saetze < maxS) {
        z.saetze = p.saetze + 1; gesteigert = true;
        hinweise.push(`Jetzt ${z.saetze} Sätze`);
      } else {
        hinweise.push(ex.hinweis ? `Ziel geschafft – schwerer: ${ex.hinweis}` : 'Ziel geschafft – schwerere Variante probieren');
      }
    } else if (p.typ === 'hantel') {
      // Hanteln: obere Wdh.-Zahl in allen Sätzen → mehr Gewicht.
      const kgVon = x => (typeof x.kg === 'number' ? x.kg : p.kg);
      const genutzt = Math.max(...s.map(kgVon));
      const ok = s.filter(x => x.wdh >= p.max && kgVon(x) >= p.kg).length >= p.saetze;
      const basis = Math.max(genutzt, p.kg);
      if (ok) {
        const maxKg = ex.maxKg ?? Infinity;
        const neu = Math.min(basis + (ex.schritt ?? 2.5), maxKg);
        if (neu > basis) {
          z.kg = neu; gesteigert = true;
          hinweise.push(`Mehr Gewicht: ${zahl(neu)} kg`);
        } else {
          z.kg = basis;
          hinweise.push('Maximalgewicht erreicht – langsamer ausführen');
        }
      } else {
        z.kg = genutzt; // zuletzt genutztes Gewicht übernehmen
      }
    } else if (p.typ === 'band' && p.richtung === 'widerstand') {
      // Band als Widerstand: obere Wdh.-Zahl in allen Sätzen → dickeres Band.
      const genutzt = letzteBand(s) ?? p.band;
      const ok = s.filter(x => x.wdh >= p.max && bandIndex(baender, x.band ?? p.band) >= bandIndex(baender, p.band)).length >= p.saetze;
      if (ok) {
        const basis = bandIndex(baender, genutzt) > bandIndex(baender, p.band) ? genutzt : p.band;
        const d = dicker(baender, basis);
        if (d) { z.band = d; gesteigert = true; hinweise.push(`Dickeres Band: ${d}`); }
        else hinweise.push('Stärkstes Band geschafft – langsamer ausführen');
      } else if (genutzt && baender.includes(genutzt) && genutzt !== p.band) {
        z.band = genutzt;
      }
    }
  });

  return { zustand: z, hinweise, gesteigert };
}

// Leistungswert eines Trainings für die Kraft-Übersicht (höher = stärker).
//  Hanteln: kg × (1 + Wdh./30) des besten Satzes; Körpergewicht: beste Wdh.
//  Klimmzug-Art: freie Wdh. × 3 + Band-Stufe (+ Bruchteil der Band-Wdh.); ohne Band zählt die höchste Stufe.
//  Dips-Art: Stufe × 10 + Wdh.; Band als Widerstand: Stufe × 25 + Wdh.
export function leistung(ex, eintrag, baender) {
  const s = eintrag?.saetze || [];
  if (!s.length) return null;
  const teile = eintrag.ziel?.teile || [];
  const n = baender.length;
  const stufeHilfe = b => (b == null || b === FREI ? n + 1 : Math.max(0, n - baender.indexOf(b)));

  if (ex.art === 'hantel') {
    let best = 0;
    for (const x of s) {
      const kg = typeof x.kg === 'number' ? x.kg : teile[x.teil]?.kg ?? 0;
      best = Math.max(best, kg > 0 ? kg * (1 + x.wdh / 30) : x.wdh);
    }
    return best;
  }
  if (ex.art === 'koerper') return Math.max(...s.map(x => x.wdh));
  if (ex.art === 'band-widerstand') {
    return Math.max(...s.map(x => (baender.indexOf(x.band ?? teile[x.teil]?.band) + 1) * 25 + x.wdh));
  }
  if (ex.art === 'band-hilfe') {
    if (ex.frei) {
      let frei = 0, bandBest = -1, bandWdh = 0;
      for (const x of s) {
        const p = teile[x.teil];
        if (p?.typ === 'frei' || x.band === FREI) { frei = Math.max(frei, x.wdh); continue; }
        const st = stufeHilfe(x.band ?? p?.band);
        if (st > bandBest || (st === bandBest && x.wdh > bandWdh)) { bandBest = st; bandWdh = x.wdh; }
      }
      const hatBandTeil = teile.some(p => p.typ === 'band');
      const stufe = hatBandTeil ? Math.max(bandBest, 0) : n + 1;
      return frei * 3 + stufe + (hatBandTeil ? Math.min(bandWdh, 9) / 10 : 0);
    }
    return Math.max(...s.map(x => {
      const p = teile[x.teil];
      const b = p?.typ === 'koerper' ? FREI : (x.band ?? p?.band);
      return stufeHilfe(b) * 10 + x.wdh;
    }));
  }
  return null;
}
