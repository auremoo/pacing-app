// Volume par semaine d'un plan (onglet Plan) : barres = séances faites / manquées / à faire,
// courbe = km prévus quand le plan en donne (en-tête « 12km »). Les séances ne portant pas
// de distance, le réalisé ne peut se compter qu'en séances.

import { weekRangeOf } from './dates.js';

const W = 400, H = 170, PAD = { t: 18, b: 20, l: 4, r: 4 };

// weeks : semaines effectives du plan actif ; states : état des séances ;
// weekNo : numéro affiché ; paused : Map numéro → nom de la course qui met la semaine en pause
export function renderVolumeChart(weeks, states, currentWeekNum, { weekNo = n => n, paused } = {}) {
  if (!weeks.length) return '';
  const cols = weeks.map(w => {
    const sessions = w.sessions.filter(s => s.type !== 'rest');
    const done = sessions.filter(s => states[s.id]?.completed).length;
    const skipped = sessions.filter(s => states[s.id]?.skipped).length;
    return { w, done, skipped, todo: sessions.length - done - skipped, total: sessions.length, km: w.targetVolumeKm || 0 };
  });
  const maxS = Math.max(1, ...cols.map(c => c.total));
  const maxKm = Math.max(0, ...cols.map(c => c.km));
  const n = cols.length;
  const slot = (W - PAD.l - PAD.r) / n;
  const bw = Math.min(26, slot * 0.7);
  const x = i => PAD.l + slot * i + slot / 2;
  const yS = v => H - PAD.b - (H - PAD.t - PAD.b) * v / maxS;
  const yKm = v => H - PAD.b - (H - PAD.t - PAD.b) * v / maxKm;
  const step = Math.max(1, Math.ceil(n / 8));

  const bars = cols.map((c, i) => {
    const cx = x(i), left = cx - bw / 2;
    let y0 = H - PAD.b;
    const seg = (v, cls) => {
      if (!v) return '';
      const h = (H - PAD.t - PAD.b) * v / maxS;
      y0 -= h;
      return `<rect x="${left.toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" class="vchart__${cls}"/>`;
    };
    const isCur = c.w.number === currentWeekNum;
    const isPaused = paused?.get(c.w.number);
    const title = `S${String(weekNo(c.w.number)).padStart(2, '0')} · ${weekRangeOf(c.w)} : ${c.done}/${c.total} séance${c.total > 1 ? 's' : ''}`
      + (c.skipped ? `, ${c.skipped} manquée${c.skipped > 1 ? 's' : ''}` : '') + (c.km ? ` · ${c.km} km prévus` : '') + (isPaused ? ' · en pause' : '');
    return `
      <g class="vchart__col ${isCur ? 'vchart__col--current' : ''} ${isPaused ? 'vchart__col--paused' : ''}" data-week-bar="${c.w.number}">
        <title>${title.replace(/</g, '&lt;')}</title>
        <rect x="${(x(i) - slot / 2).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" class="vchart__hit"/>
        ${seg(c.done, 'done')}${seg(c.skipped, 'skipped')}${seg(c.todo, 'todo')}
        ${i % step === 0 || isCur ? `<text x="${cx.toFixed(1)}" y="${H - 4}" class="vchart__label">S${weekNo(c.w.number)}</text>` : ''}
      </g>`;
  }).join('');

  const kmLine = maxKm ? `
    <polyline class="vchart__km" points="${cols.map((c, i) => `${x(i).toFixed(1)},${yKm(c.km).toFixed(1)}`).join(' ')}"/>
    ${cols.map((c, i) => c.km ? `<circle cx="${x(i).toFixed(1)}" cy="${yKm(c.km).toFixed(1)}" r="2.5" class="vchart__km-dot"/>` : '').join('')}
    <text x="${W - PAD.r}" y="10" class="vchart__km-max">${maxKm} km max</text>` : '';

  return `
    <details class="vchart" open>
      <summary class="vchart__summary">Volume par semaine</summary>
      <svg class="vchart__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Séances par semaine${maxKm ? ' et km prévus' : ''}">
        <line x1="${PAD.l}" x2="${W - PAD.r}" y1="${H - PAD.b}" y2="${H - PAD.b}" class="vchart__axis"/>
        ${bars}
        ${kmLine}
      </svg>
      <div class="vchart__legend">
        <span><i class="vchart__dot vchart__dot--done"></i>Faites</span>
        <span><i class="vchart__dot vchart__dot--skipped"></i>Manquées</span>
        <span><i class="vchart__dot vchart__dot--todo"></i>À faire</span>
        ${maxKm ? '<span><i class="vchart__line"></i>Km prévus</span>' : ''}
        <span class="vchart__hint">Touche une barre pour ouvrir la semaine</span>
      </div>
    </details>`;
}
