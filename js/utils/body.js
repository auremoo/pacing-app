// Suivi du poids : calculs, courbe et texte pour les prompts.
// Les pesées vivent dans body.json (store.js) ; l'option s'active dans
// Réglages → Mes sports → « Suivre mon poids ».

import { getBodyEntries, getRoutineMeta } from '../store.js';
import { getTargets } from './routine-context.js';
import { addDays, formatDateShort } from './dates.js';
import { tracksWeight } from './sports.js';

export const fmtKg = (n) => `${String(n).replace('.', ',')} kg`;

export function latestEntry(entries = getBodyEntries()) {
  return entries.length ? entries[entries.length - 1] : null;
}

// Écart entre la dernière pesée et celle d'il y a environ `days` jours (la plus
// récente qui ne soit pas plus jeune que ça). null s'il n'y en a pas d'assez vieille.
export function weightChange(days, entries = getBodyEntries()) {
  const last = latestEntry(entries);
  if (!last) return null;
  const limit = addDays(last.date, -days);
  const ref = entries.filter(e => e.date <= limit).pop();
  if (!ref) return null;
  return { delta: Math.round((last.weight - ref.weight) * 10) / 10, since: ref.date };
}

export function fmtDelta(delta) {
  if (delta === 0) return 'stable';
  return `${delta > 0 ? '+' : '−'}${String(Math.abs(delta)).replace('.', ',')} kg`;
}

// Poids visé : le premier objectif « Poids » non atteint du plan général dont
// la valeur contient un nombre (« 58 kg », « 58,5 »).
export function weightTarget(meta = getRoutineMeta()) {
  const t = getTargets(meta).find(t => t.kind === 'poids' && !t.achieved);
  const m = t?.value.match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

// Section des prompts du plan général. '' si le suivi n'est pas activé ou vide.
export function bodyPromptSection(level) {
  if (!tracksWeight()) return '';
  const entries = getBodyEntries();
  if (!entries.length) return '';
  const first = entries[0];
  const last  = latestEntry(entries);
  const c4    = weightChange(28, entries);
  const recent = entries.slice(-12).map(e =>
    `- ${e.date} : ${fmtKg(e.weight)}${e.waist ? ` · tour de taille ${String(e.waist).replace('.', ',')} cm` : ''}`).join('\n');
  return `
${level} Suivi du poids

- Première pesée : ${fmtKg(first.weight)} le ${first.date}
- Dernière pesée : ${fmtKg(last.weight)} le ${last.date}${c4 ? `\n- Évolution sur 4 semaines : ${fmtDelta(c4.delta)}` : ''}

Dernières pesées :
${recent}

Tiens compte de cette évolution par rapport à mes objectifs (rythme raisonnable : une perte de l'ordre de 0,5 % du poids par semaine, une prise de masse lente) et ajuste l'entraînement en conséquence. Si tu donnes des repères nutritionnels, reste général (pas de régime strict) et mets-les dans la SYNTHESE.

`;
}

// Courbe du poids (SVG), avec la cible en pointillés si elle existe.
export function renderWeightChart(entries, target = null) {
  if (entries.length < 2) return '';
  const W = 320, H = 150, PAD_L = 34, PAD_R = 8, PAD_T = 10, PAD_B = 22;
  const t0 = Date.parse(entries[0].date), t1 = Date.parse(entries[entries.length - 1].date);
  const values = entries.map(e => e.weight).concat(target != null ? [target] : []);
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
  lo = Math.floor(lo - 0.3); hi = Math.ceil(hi + 0.3);
  const x = d => PAD_L + (t1 === t0 ? 0 : (Date.parse(d) - t0) / (t1 - t0)) * (W - PAD_L - PAD_R);
  const y = v => PAD_T + (hi - v) / (hi - lo) * (H - PAD_T - PAD_B);
  const pts = entries.map(e => `${x(e.date).toFixed(1)},${y(e.weight).toFixed(1)}`).join(' ');
  return `
    <svg class="weight-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe du poids">
      <line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(hi)}" y2="${y(hi)}" class="weight-chart__grid"/>
      <line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(lo)}" y2="${y(lo)}" class="weight-chart__grid"/>
      <text x="${PAD_L - 4}" y="${y(hi) + 4}" text-anchor="end" class="weight-chart__label">${hi}</text>
      <text x="${PAD_L - 4}" y="${y(lo) + 4}" text-anchor="end" class="weight-chart__label">${lo}</text>
      ${target != null ? `
        <line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(target)}" y2="${y(target)}" class="weight-chart__target"/>
        <text x="${W - PAD_R}" y="${y(target) - 4}" text-anchor="end" class="weight-chart__label weight-chart__label--target">objectif ${String(target).replace('.', ',')}</text>` : ''}
      <polyline points="${pts}" class="weight-chart__line"/>
      ${entries.map(e => `<circle cx="${x(e.date).toFixed(1)}" cy="${y(e.weight).toFixed(1)}" r="3" class="weight-chart__dot"/>`).join('')}
      <text x="${PAD_L}" y="${H - 6}" class="weight-chart__label">${formatDateShort(entries[0].date)}</text>
      <text x="${W - PAD_R}" y="${H - 6}" text-anchor="end" class="weight-chart__label">${formatDateShort(entries[entries.length - 1].date)}</text>
    </svg>`;
}
