import { getActivePlan } from '../store.js';
import { renderMarkdown } from '../utils/markdown.js';

const TABS = [
  { id: 'allures',   label: 'Allures' },
  { id: 'ppg',       label: 'PPG' },
  { id: 'vigilance', label: 'Vigilance' },
  { id: 'strategie', label: 'Stratégie' },
  { id: 'nutrition', label: 'Nutrition' },
];

export function mount(container, slug) {
  const plan = getActivePlan(slug);
  if (!plan) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📋</div><div class="empty-state__title">Aucun plan importé</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="infos-tabs" id="infos-tabs">
      ${TABS.map((t, i) => `
        <button class="infos-tab ${i === 0 ? 'infos-tab--active' : ''}" data-tab="${t.id}">${t.label}</button>
      `).join('')}
    </div>
    <div class="infos-content" id="infos-content">
      ${renderTab('allures', plan)}
    </div>
  `;

  container.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('infos-tab--active'));
      btn.classList.add('infos-tab--active');
      container.querySelector('#infos-content').innerHTML = renderTab(btn.dataset.tab, plan);
    });
  });
}

function renderTab(tabId, plan) {
  switch (tabId) {
    case 'allures':   return renderAllures(plan.paces);
    case 'ppg':       return renderMarkdown(plan.info.ppg) || '<p>Aucune information PPG dans ce plan.</p>';
    case 'vigilance': return renderMarkdown(plan.info.vigilance) || '<p>Aucune information de vigilance.</p>';
    case 'strategie': return renderMarkdown(plan.info.raceStrategy) || '<p>Aucune stratégie de course.</p>';
    case 'nutrition': return renderMarkdown(plan.info.nutrition) || '<p>Aucune information nutrition.</p>';
    default:          return '';
  }
}

function renderAllures(paces) {
  const renderTable = (rows) => rows.map(p => `
    <div class="pace-row">
      <span class="pace-row__label">${p.label}</span>
      <span class="pace-row__value">${p.value}</span>
    </div>`).join('');

  return `
    <div class="paces-section">
      <div class="paces-section__title">Allures actuelles</div>
      <div class="card-group" style="margin:0 0 var(--space-5)">${renderTable(paces.current)}</div>
    </div>
    <div class="paces-section">
      <div class="paces-section__title">Allures cibles</div>
      <div class="card-group" style="margin:0">${renderTable(paces.target)}</div>
    </div>
  `;
}
