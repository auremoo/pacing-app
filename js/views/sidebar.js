import { getEventsIndex, getActivePlan, getAllSessionStates, getEventMeta } from '../store.js';
import { navigate } from '../app.js';
import { today, isPast } from '../utils/dates.js';

export function mountSidebar(container, activeSlug = null) {
  if (!container) return;
  const events = getEventsIndex();
  const todayStr = today();
  const todaySession = findTodaySession(events, todayStr);

  container.innerHTML = `
    <div class="sb-header">
      <span class="sb-logo">🏃</span>
      <span class="sb-title">Pacing</span>
      <button class="sb-settings-btn" id="sb-settings" title="Réglages">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      </button>
    </div>

    ${todaySession ? `
    <div class="sb-today" id="sb-today">
      <div class="sb-today__label">Aujourd'hui</div>
      <div class="sb-today__title">${todaySession.session.title}</div>
      <div class="sb-today__event">${todaySession.eventName}</div>
    </div>` : ''}

    <div class="sb-section-label">Mes courses</div>
    <nav class="sb-nav">
      ${events.map(e => renderEventItem(e, activeSlug === e.slug)).join('')}
    </nav>

    <div class="sb-footer">
      <button class="sb-nav-item" id="sb-new-event">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Nouvel événement
      </button>
      <button class="sb-nav-item" id="sb-dashboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Tableau de bord
      </button>
    </div>
  `;

  container.querySelector('#sb-settings')?.addEventListener('click', () => navigate('/settings'));
  container.querySelector('#sb-dashboard')?.addEventListener('click', () => navigate('/'));
  container.querySelector('#sb-new-event')?.addEventListener('click', () => navigate('/new-event'));
  container.querySelector('#sb-today')?.addEventListener('click', () => {
    navigate(`/event/${todaySession.slug}/session/${todaySession.session.id}`);
  });
  container.querySelectorAll('[data-sb-slug]').forEach(el => {
    el.addEventListener('click', () => navigate(`/event/${el.dataset.sbSlug}`));
  });
}

function renderEventItem(e, isActive) {
  const meta  = getEventMeta(e.slug);
  const plan  = getActivePlan(e.slug);
  const past  = isPast(e.raceDate);
  const pct   = plan ? computeCompletion(e.slug, plan) : null;
  const result = meta?.result;

  return `
    <div class="sb-event-item ${isActive ? 'sb-event-item--active' : ''} ${past ? 'sb-event-item--past' : ''}"
         data-sb-slug="${e.slug}">
      <div class="sb-event-item__name">${e.name}</div>
      <div class="sb-event-item__meta">
        ${e.distanceLabel} · ${e.raceDate}
        ${result?.time ? ` · ${result.time}` : ''}
      </div>
      ${pct !== null ? `
        <div class="sb-event-item__bar">
          <div class="sb-event-item__bar-fill" style="width:${pct}%"></div>
        </div>` : ''}
    </div>
  `;
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

function computeCompletion(slug, plan) {
  const states = getAllSessionStates(slug);
  const sessions = plan.weeks.flatMap(w => w.sessions).filter(s => s.type !== 'rest');
  if (!sessions.length) return 0;
  const done = sessions.filter(s => states[s.id]?.completed).length;
  return Math.round(done / sessions.length * 100);
}
