import { navigate } from '../app.js';
import { today, formatDateShort } from '../utils/dates.js';
import { findTodaySession, getActiveRacePreps, todaySessionTitle, getRoutineProgress } from '../utils/today-session.js';
import { typeBadge } from '../utils/session-types.js';
import { renderEventCard } from './courses.js';
import { renderGlobalTabBar, attachGlobalTabBar } from './global-nav.js';
import { tracksWeight } from '../utils/sports.js';
import { latestEntry, weightChange, fmtDelta, fmtKg, weightTarget } from '../utils/body.js';

export function mount(container) {
  const todayStr = today();
  const todaySession = findTodaySession(todayStr);
  const activeRaces  = getActiveRacePreps(todayStr);
  // Accueil contextuel : la course quand on en prépare une, sinon le plan
  // général. Les deux ne coexistent pas — les semaines du plan général sont en
  // pause pendant une préparation de course.
  const routine      = activeRaces.length ? null : getRoutineProgress(todayStr);

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
        ${routine ? `
          <p class="section-header">Entraînement en cours</p>
          ${renderRoutineCard(routine)}
        ` : ''}
        ${tracksWeight() ? renderWeightCard() : ''}
        <div style="height:var(--space-8)"></div>
      </div>
    </div>
    ${renderGlobalTabBar('home')}
  `;

  attachGlobalTabBar(container);

  container.querySelectorAll('[data-event-slug]').forEach(el => {
    el.addEventListener('click', () => navigate(`/event/${el.dataset.eventSlug}`));
  });

  container.querySelector('#routine-card')?.addEventListener('click', () => navigate('/routine'));
  container.querySelector('#weight-card')?.addEventListener('click', () => navigate('/routine/body'));

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
      <div class="today-card__title">${todaySessionTitle(session)}</div>
      <div class="today-card__desc">${session.description}</div>
    </div>
  `;
}

// Même gabarit que la carte d'une course, pour que l'accueil garde une seule
// apparence quel que soit ce que l'on prépare.
function renderRoutineCard({ week, done, total, next, phase }) {
  const pct = total ? Math.round(done / total * 100) : 0;
  return `
    <div class="event-card" id="routine-card">
      <div class="event-card__header">
        <div>
          <div class="event-card__title">Entraînement général</div>
          <div class="event-card__subtitle">S${String(week.number).padStart(2, '0')} · ${week.dateRange}</div>
        </div>
        ${week.isDecharge ? '<span class="event-card__distance-badge">Décharge</span>' : ''}
      </div>
      <div class="event-card__meta">
        <div class="event-card__meta-item">
          <span class="event-card__meta-label">Cette semaine</span>
          <span class="event-card__meta-value">${done}/${total}</span>
        </div>
        ${phase ? `<div class="event-card__meta-item">
          <span class="event-card__meta-label">Phase</span>
          <span class="event-card__meta-value" style="color:var(--phase-${phase.color})">${phase.name}</span>
        </div>` : ''}
        ${next ? `<div class="event-card__meta-item">
          <span class="event-card__meta-label">Prochaine</span>
          <span class="event-card__meta-value">${formatDateShort(next.date)} · ${typeBadge(next.type)}</span>
        </div>` : ''}
      </div>
      <div class="event-card__progress-bar">
        <div class="event-card__progress-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

// Poids : dernière pesée, évolution sur 4 semaines, objectif. Sans pesée, la
// carte invite à en saisir une.
function renderWeightCard() {
  const last = latestEntry();
  const c4 = weightChange(28);
  const target = weightTarget();
  if (!last) return `
    <p class="section-header">Poids</p>
    <div class="event-card" id="weight-card">
      <div class="event-card__header">
        <div>
          <div class="event-card__title">Aucune pesée pour l'instant</div>
          <div class="event-card__subtitle">Touche pour enregistrer la première</div>
        </div>
      </div>
    </div>`;
  const left = target != null ? Math.round((target - last.weight) * 10) / 10 : null;
  return `
    <p class="section-header">Poids</p>
    <div class="event-card" id="weight-card">
      <div class="event-card__header">
        <div>
          <div class="event-card__title">${fmtKg(last.weight)}</div>
          <div class="event-card__subtitle">Dernière pesée · ${formatDateShort(last.date)}</div>
        </div>
        ${c4 ? `<span class="event-card__distance-badge">${fmtDelta(c4.delta)} en 4 sem.</span>` : ''}
      </div>
      ${target != null ? `
      <div class="event-card__meta">
        <div class="event-card__meta-item">
          <span class="event-card__meta-label">Objectif</span>
          <span class="event-card__meta-value">${fmtKg(target)}</span>
        </div>
        <div class="event-card__meta-item">
          <span class="event-card__meta-label">Reste</span>
          <span class="event-card__meta-value">${left === 0 ? 'atteint' : fmtDelta(left)}</span>
        </div>
      </div>` : ''}
    </div>`;
}
