import { getEventsIndex, getEventMeta, getActivePlan, getAllSessionStates } from '../store.js';
import { navigate } from '../app.js';
import { today, formatDaysUntil, isPast } from '../utils/dates.js';
import { isRaceDone } from '../utils/race-status.js';
import { renderGlobalTabBar, attachGlobalTabBar } from './global-nav.js';
import { getCurrentWeekNum } from '../utils/plan-overrides.js';

export function mount(container) {
  const events = getEventsIndex();

  container.innerHTML = `
    <div class="nav-bar">
      <span class="nav-bar__title">Mes Courses</span>
    </div>
    <div id="tab-content" class="scroll-view" style="padding-bottom:calc(var(--tab-bar-height) + var(--safe-bottom))">
      <div class="dashboard-body">
        <p class="section-header">Événements</p>
        ${events.map(e => renderEventCard(e)).join('')}
        <div class="dashboard-add-row">
          <button class="btn btn--ghost" id="new-event-btn">+ Créer un événement</button>
        </div>
        <div style="height:var(--space-8)"></div>
      </div>
    </div>
    ${renderGlobalTabBar('courses')}
  `;

  attachGlobalTabBar(container);

  container.querySelector('#new-event-btn').addEventListener('click', () => navigate('/new-event'));

  container.querySelectorAll('[data-event-slug]').forEach(el => {
    el.addEventListener('click', () => navigate(`/event/${el.dataset.eventSlug}`));
  });
}

export function renderEventCard(e) {
  const meta   = getEventMeta(e.slug);
  const plan   = getActivePlan(e.slug);
  // Course courue ou date dépassée : dans les deux cas elle appartient au passé.
  // Le critère est le cochage de la séance de course, pas le closedAt du
  // meta.json : les deux fichiers s'écrivent séparément et peuvent diverger.
  const past   = isPast(e.raceDate) || isRaceDone(e.slug);
  // Une course terminée n'a plus de phase en cours ni de progression à suivre :
  // sans ça, elle gardait sa pastille de phase, son pourcentage et sa barre
  // verte à côté du chrono, là où les courses sans plan n'affichent que le
  // résultat.
  const pct    = !past && plan ? computeCompletion(e.slug, plan) : null;
  const phase  = !past && plan ? currentPhase(plan) : null;
  const dLabel = formatDaysUntil(e.raceDate);
  const result = meta?.result;
  const showResult = past && result?.time;

  return `
    <div class="event-card ${past ? 'event-card--past' : ''}" data-event-slug="${e.slug}">
      <div class="event-card__header">
        <div>
          <div class="event-card__title">${e.name}</div>
          <div class="event-card__subtitle">${e.subtitle || ''} · ${e.raceDate}</div>
        </div>
        <span class="event-card__distance-badge">${e.distanceLabel}</span>
      </div>
      <div class="event-card__meta">
        <div class="event-card__meta-item">
          <span class="event-card__meta-label">Course</span>
          <span class="event-card__meta-value">${dLabel}</span>
        </div>
        ${showResult ? `<div class="event-card__meta-item">
          <span class="event-card__meta-label">Temps</span>
          <span class="event-card__meta-value">${result.time}</span>
        </div>
        ${result.pacePerKm ? `<div class="event-card__meta-item">
          <span class="event-card__meta-label">Allure</span>
          <span class="event-card__meta-value">${result.pacePerKm}</span>
        </div>` : ''}` : meta?.objective ? `<div class="event-card__meta-item">
          <span class="event-card__meta-label">Objectif</span>
          <span class="event-card__meta-value">${meta.objective}</span>
        </div>` : ''}
        ${phase ? `<div class="event-card__meta-item">
          <span class="event-card__meta-label">Phase</span>
          <span class="event-card__meta-value" style="color:var(--phase-${phase.color})">${phase.name}</span>
        </div>` : ''}
        ${pct !== null ? `<div class="event-card__meta-item">
          <span class="event-card__meta-label">Complétion</span>
          <span class="event-card__meta-value">${pct}%</span>
        </div>` : ''}
      </div>
      ${pct !== null ? `<div class="event-card__progress-bar">
        <div class="event-card__progress-fill" style="width:${pct}%"></div>
      </div>` : ''}
    </div>
  `;
}

export function computeCompletion(slug, plan) {
  const states = getAllSessionStates(slug);
  const sessions = plan.weeks.flatMap(w => w.sessions).filter(s => s.type !== 'rest');
  if (!sessions.length) return 0;
  const done = sessions.filter(s => states[s.id]?.completed).length;
  return Math.round(done / sessions.length * 100);
}

function currentPhase(plan) {
  const weekNum = getCurrentWeekNum(plan, today());
  const week = plan.weeks.find(w => w.number === weekNum);
  return plan.phases.find(p => p.id === week?.phaseId) || null;
}
