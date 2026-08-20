import { getRoutineMeta, ensurePlanLoaded, getActivePlan, getEventsIndex, getEventMeta,
         getDateOverrides, getWeekMetaOverrides, ROUTINE_SLUG } from '../store.js';
import { navigate } from '../app.js';
import { mount as mountPlan }            from './plan-view.js';
import { mount as mountRoutineSettings } from './routine-settings.js';
import { mount as mountRoutineVersions } from './routine-versions.js';
import { applyDateOverrides, applyWeekMetaOverrides } from '../utils/plan-overrides.js';
import { computeEventRanges, computePausedWeeks }     from '../utils/routine-overlap.js';

const TABS = [
  { id: 'plan',     label: 'Plan',     icon: tabIcon('plan')     },
  { id: 'settings', label: 'Réglages', icon: tabIcon('settings') },
  { id: 'versions', label: 'Versions', icon: tabIcon('versions') },
];

export async function mount(container, activeTab = 'plan') {
  const meta = getRoutineMeta();

  if (meta?.activeVersion) {
    await ensurePlanLoaded(ROUTINE_SLUG, meta.activeVersion);
  }

  container.innerHTML = `
    <div class="nav-bar">
      <button class="nav-btn" id="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        Courses
      </button>
      <span class="nav-bar__title">Entraînement général</span>
      <span style="width:72px"></span>
    </div>

    <div id="tab-content" class="scroll-view" style="padding-bottom:calc(var(--tab-bar-height) + var(--safe-bottom))">
      <div class="loading-state"><div class="spinner"></div></div>
    </div>

    <nav class="tab-bar">
      ${TABS.map(t => `
        <button class="tab-item ${t.id === activeTab ? 'tab-item--active' : ''}"
                data-tab="${t.id}">
          ${t.icon}
          <span>${t.label}</span>
        </button>`).join('')}
    </nav>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => navigate('/'));

  container.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(`/routine/${btn.dataset.tab}`);
    });
  });

  mountTab(container.querySelector('#tab-content'), activeTab);
}

function mountTab(tabContent, tab) {
  switch (tab) {
    case 'plan':     mountRoutinePlan(tabContent);      break;
    case 'settings': mountRoutineSettings(tabContent);  break;
    case 'versions': mountRoutineVersions(tabContent);  break;
    default:         mountRoutinePlan(tabContent);
  }
}

function mountRoutinePlan(tabContent) {
  const meta = getRoutineMeta();

  if (!meta) {
    tabContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🗓️</div>
        <div class="empty-state__title">Aucun plan général configuré</div>
        <div class="empty-state__body">Commence par renseigner tes activités actuelles et tes objectifs dans l'onglet Réglages.</div>
      </div>
      <div style="padding:0 var(--space-4)">
        <button class="btn btn--primary btn--full" id="go-settings-btn">Aller aux réglages</button>
      </div>
    `;
    tabContent.querySelector('#go-settings-btn').addEventListener('click', () => navigate('/routine/settings'));
    return;
  }

  const plan = getActivePlan(ROUTINE_SLUG);
  let pausedWeeks;
  if (plan) {
    const overrides     = getDateOverrides(ROUTINE_SLUG);
    const metaOverrides = getWeekMetaOverrides(ROUTINE_SLUG);
    const effPlan       = applyWeekMetaOverrides(applyDateOverrides(plan, overrides), metaOverrides);
    const eventRanges   = computeEventRanges(getEventsIndex(), getEventMeta);
    pausedWeeks         = computePausedWeeks(effPlan, eventRanges);
  }

  mountPlan(tabContent, ROUTINE_SLUG, { pausedWeeks });
}

function tabIcon(id) {
  const icons = {
    plan:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    versions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  };
  return icons[id] || '';
}
