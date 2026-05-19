import { getActivePlan } from '../store.js';
import { renderMarkdown } from '../utils/markdown.js';

const TABS = [
  { id: 'synthese',  label: 'Synthèse' },
  { id: 'allures',   label: 'Allures' },
  { id: 'principes', label: 'Principes' },
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

  // Only show tabs that have content
  const visibleTabs = TABS.filter(t => hasContent(t.id, plan));

  container.innerHTML = `
    <div class="infos-tabs" id="infos-tabs">
      ${visibleTabs.map((t, i) => `
        <button class="infos-tab ${i === 0 ? 'infos-tab--active' : ''}" data-tab="${t.id}">${t.label}</button>
      `).join('')}
    </div>
    <div class="infos-content" id="infos-content">
      ${visibleTabs.length ? renderTab(visibleTabs[0].id, plan) : '<p>Aucune information dans ce plan.</p>'}
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

function hasContent(tabId, plan) {
  switch (tabId) {
    case 'synthese':  return !!plan.info.overview;
    case 'allures':   return plan.paces.current.length > 0 || plan.paces.target.length > 0;
    case 'principes': return !!plan.info.principles;
    case 'ppg':       return !!plan.info.ppg;
    case 'vigilance': return !!plan.info.vigilance;
    case 'strategie': return !!plan.info.raceStrategy;
    case 'nutrition': return !!plan.info.nutrition;
    default:          return false;
  }
}

function renderTab(tabId, plan) {
  switch (tabId) {
    case 'synthese':  return `<div class="markdown-body" style="padding:var(--space-4)">${renderMarkdown(plan.info.overview)}</div>`;
    case 'allures':   return renderAllures(plan.paces);
    case 'principes': return `<div class="markdown-body" style="padding:var(--space-4)">${renderMarkdown(plan.info.principles)}</div>`;
    case 'ppg':       return `<div class="markdown-body" style="padding:var(--space-4)">${renderMarkdown(plan.info.ppg)}</div>`;
    case 'vigilance': return `<div class="markdown-body" style="padding:var(--space-4)">${renderMarkdown(plan.info.vigilance)}</div>`;
    case 'strategie': return `<div class="markdown-body" style="padding:var(--space-4)">${renderMarkdown(plan.info.raceStrategy)}</div>`;
    case 'nutrition': return `<div class="markdown-body" style="padding:var(--space-4)">${renderMarkdown(plan.info.nutrition)}</div>`;
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
