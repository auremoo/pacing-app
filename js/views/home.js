import { navigate } from '../app.js';
import { today } from '../utils/dates.js';
import { findTodaySession, getActiveRacePreps } from '../utils/today-session.js';
import { renderEventCard } from './courses.js';
import { renderGlobalTabBar, attachGlobalTabBar } from './global-nav.js';

export function mount(container) {
  const todayStr = today();
  const todaySession = findTodaySession(todayStr);
  const activeRaces  = getActiveRacePreps(todayStr);

  container.innerHTML = `
    <div class="nav-bar">
      <span class="nav-bar__title">Accueil</span>
    </div>
    <div id="tab-content" class="scroll-view" style="padding-bottom:calc(var(--tab-bar-height) + var(--safe-bottom))">
      <div class="dashboard-body">
        ${renderTodayCard(todaySession)}
        ${activeRaces.length ? `
          <p class="section-header">Course en préparation</p>
          ${activeRaces.map(e => renderEventCard(e)).join('')}
        ` : ''}
        <div style="height:var(--space-8)"></div>
      </div>
    </div>
    ${renderGlobalTabBar('home')}
  `;

  attachGlobalTabBar(container);

  container.querySelectorAll('[data-event-slug]').forEach(el => {
    el.addEventListener('click', () => navigate(`/event/${el.dataset.eventSlug}`));
  });

  if (todaySession) {
    container.querySelector('#today-card')?.addEventListener('click', () => {
      const base = todaySession.kind === 'routine' ? '/routine' : `/event/${todaySession.slug}`;
      navigate(`${base}/session/${todaySession.session.id}`);
    });
  }
}

function renderTodayCard(todaySession) {
  if (!todaySession) {
    return `<div class="today-card today-card--rest" style="margin:var(--space-4)">
      <div class="today-card__label">Aujourd'hui</div>
      <div class="today-card__title">Repos ou journée libre</div>
    </div>`;
  }
  const { session, eventName } = todaySession;
  return `
    <div class="today-card" id="today-card">
      <div class="today-card__label">Aujourd'hui</div>
      <div class="today-card__event">${eventName}</div>
      <div class="today-card__title">${session.title}</div>
      <div class="today-card__desc">${session.description}</div>
    </div>
  `;
}
