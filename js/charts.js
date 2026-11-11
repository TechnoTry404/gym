// Einfache Grafiken als SVG (selbst gezeichnet, keine fremde Bibliothek nötig, funktioniert offline).
import { parseDatum, fmtZahl, fmtDatumKurz, esc } from './util.js';

const W = 320, H = 140, L = 38, R = 10, O = 12, U = 24;

// Liniengrafik. punkte = [{datum:'JJJJ-MM-TT', wert:Zahl}]
export function linie(punkte, { farbe = '#e879f9', leer = 'Noch keine Werte' } = {}) {
  const p = [...punkte].filter(x => Number.isFinite(x.wert)).sort((a, b) => (a.datum < b.datum ? -1 : 1));
  if (!p.length) return `<div class="leerchart">${esc(leer)}</div>`;
  const xs = p.map(x => parseDatum(x.datum).getTime());
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...p.map(x => x.wert)), y1 = Math.max(...p.map(x => x.wert));
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const spanne = y1 - y0;
  y0 -= spanne * 0.1; y1 += spanne * 0.1;
  const px = t => (x1 === x0 ? (L + W - R) / 2 : L + ((t - x0) / (x1 - x0)) * (W - L - R));
  const py = v => O + (1 - (v - y0) / (y1 - y0)) * (H - O - U);
  const pts = p.map((x, i) => `${px(xs[i]).toFixed(1)},${py(x.wert).toFixed(1)}`).join(' ');
  const gitter = [0, 0.5, 1].map(f => {
    const v = y0 + (y1 - y0) * (1 - f);
    const y = O + f * (H - O - U);
    return `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="rgba(255,255,255,.08)"/>
      <text x="${L - 6}" y="${y + 4}" text-anchor="end" fill="#b9a8e0" font-size="10">${fmtZahl(Math.round(v * 10) / 10)}</text>`;
  }).join('');
  const punkteSvg = p.length <= 40
    ? p.map((x, i) => `<circle cx="${px(xs[i]).toFixed(1)}" cy="${py(x.wert).toFixed(1)}" r="3.5" fill="${farbe}"/>`).join('') : '';
  const datum = `<text x="${L}" y="${H - 6}" fill="#b9a8e0" font-size="10">${esc(fmtDatumKurz(p[0].datum))}</text>` +
    (p.length > 1 ? `<text x="${W - R}" y="${H - 6}" text-anchor="end" fill="#b9a8e0" font-size="10">${esc(fmtDatumKurz(p[p.length - 1].datum))}</text>` : '');
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${gitter}
    <polyline points="${pts}" fill="none" stroke="${farbe}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${punkteSvg}${datum}</svg>`;
}

// Balkengrafik. werte = [Zahl], der letzte Balken wird hervorgehoben.
export function balken(werte, { leer = 'Noch keine Werte' } = {}) {
  if (!werte.length) return `<div class="leerchart">${esc(leer)}</div>`;
  const h = 90, max = Math.max(...werte, 1);
  const n = werte.length;
  const breite = Math.min(28, (W - 10) / n - 6);
  const abstand = (W - n * breite) / (n + 1);
  const rects = werte.map((v, i) => {
    const bh = Math.max(3, (v / max) * (h - 18));
    const x = abstand + i * (breite + abstand);
    const farbe = i === n - 1 ? '#e879f9' : '#8b5cf6';
    return `<rect x="${x.toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${breite.toFixed(1)}" height="${bh.toFixed(1)}" rx="5" fill="${farbe}"/>
      <text x="${(x + breite / 2).toFixed(1)}" y="${(h - bh - 4).toFixed(1)}" text-anchor="middle" fill="#b9a8e0" font-size="9">${fmtZahl(v)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${h}" role="img">${rects}</svg>`;
}
