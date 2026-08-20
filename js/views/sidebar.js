import { getEventsIndex, getActivePlan, getEventMeta } from '../store.js';
import { navigate } from '../app.js';
import { today, isPast } from '../utils/dates.js';
import { findTodaySession } from '../utils/today-session.js';
import { computeCompletion } from './courses.js';

export function mountSidebar(container, activeSlug = null) {
  if (!container) return;
  const events = getEventsIndex();
  const todayStr = today();
  const todaySession = findTodaySession(todayStr);

  container.innerHTML = `
    <div class="sb-header">
      <img src="./logo.png" class="sb-logo" alt="Pacing">
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
      <button class="sb-nav-item" id="sb-routine">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex-shrink:0"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        Entraînement général
      </button>
      <button class="sb-nav-item" id="sb-new-event">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Nouvel événement
      </button>
      <button class="sb-nav-item" id="sb-home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex-shrink:0"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></svg>
        Accueil
      </button>
    </div>
  `;

  container.querySelector('#sb-settings')?.addEventListener('click', () => navigate('/settings'));
  container.querySelector('#sb-home')?.addEventListener('click', () => navigate('/'));
  container.querySelector('#sb-routine')?.addEventListener('click', () => navigate('/routine'));
  container.querySelector('#sb-new-event')?.addEventListener('click', () => navigate('/new-event'));
  container.querySelector('#sb-today')?.addEventListener('click', () => {
    const base = todaySession.kind === 'routine' ? '/routine' : `/event/${todaySession.slug}`;
    navigate(`${base}/session/${todaySession.session.id}`);
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
