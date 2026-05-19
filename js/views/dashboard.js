import { getEventsIndex, getEventMeta, getActivePlan, getAllSessionStates } from '../store.js';
import { navigate } from '../app.js';
import { today, formatDaysUntil, isPast } from '../utils/dates.js';
import { SESSION_LABELS } from '../parser.js';

export function mount(container) {
  const events = getEventsIndex();
  const todayStr = today();

  // Find today's session across all events
  const todaySession = findTodaySession(events, todayStr);

  container.innerHTML = `
    <div class="nav-bar">
      <span style="width:72px"></span>
      <span class="nav-bar__title">Mes Courses</span>
      <button class="nav-btn" id="settings-btn" aria-label="Réglages">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>
    <div class="scroll-view">
      ${renderTodayCard(todaySession)}
      <p class="section-header">Événements</p>
      ${events.map(e => renderEventCard(e)).join('')}
    </div>
  `;

  container.querySelector('#settings-btn').addEventListener('click', () => navigate('/settings'));

  container.querySelectorAll('[data-event-slug]').forEach(el => {
    el.addEventListener('click', () => navigate(`/event/${el.dataset.eventSlug}`));
  });

  if (todaySession) {
    container.querySelector('#today-card')?.addEventListener('click', () => {
      navigate(`/event/${todaySession.slug}/session/${todaySession.session.id}`);
    });
  }
}

function findTodaySession(events, todayStr) {
  for (const e of events) {
    const plan = getActivePlan(e.slug);
    if (!plan) continue;
    for (const week of plan.weeks) {
      for (const s of week.sessions) {
        if (s.date === todayStr && s.type !== 'rest') {
          return { slug: e.slug, eventName: e.name, session: s };
        }
      }
    }
  }
  return null;
}

function renderTodayCard(todaySession) {
  if (!todaySession) {
    return `<div class="today-card today-card--rest" style="margin:var(--space-4)">
      <div class="today-card__label">Aujourd'hui</div>
      <div class="today-card__title">Repos ou journée libre</div>
    </div>`;
  }
  const { session, eventName } = todaySession;
  const label = SESSION_LABELS[session.type] || session.type.toUpperCase();
  return `
    <div class="today-card" id="today-card">
      <div class="today-card__label">Aujourd'hui</div>
      <div class="today-card__event">${eventName}</div>
      <div class="today-card__title">${session.title}</div>
      <div class="today-card__desc">${session.description}</div>
    </div>
  `;
}

function renderEventCard(e) {
  const meta   = getEventMeta(e.slug);
  const plan   = getActivePlan(e.slug);
  const past   = isPast(e.raceDate);
  const pct    = plan ? computeCompletion(e.slug, plan) : null;
  const phase  = plan ? currentPhase(plan) : null;
  const dLabel = formatDaysUntil(e.raceDate);

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
        ${meta?.objective ? `<div class="event-card__meta-item">
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

function computeCompletion(slug, plan) {
  const states = getAllSessionStates(slug);
  const sessions = plan.weeks.flatMap(w => w.sessions).filter(s => s.type !== 'rest');
  if (!sessions.length) return 0;
  const done = sessions.filter(s => states[s.id]?.completed).length;
  return Math.round(done / sessions.length * 100);
}

function currentPhase(plan) {
  const todayStr = today();
  for (const week of [...plan.weeks].reverse()) {
    const hasStarted = week.sessions.some(s => s.date <= todayStr);
    if (hasStarted) {
      return plan.phases.find(p => p.id === week.phaseId) || null;
    }
  }
  return plan.phases[0] || null;
}
