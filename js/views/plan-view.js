import { getActivePlan, getAllSessionStates, toggleSession } from '../store.js';
import { navigate, showToast } from '../app.js';
import { today, formatDateShort } from '../utils/dates.js';
import { SESSION_LABELS } from '../parser.js';

export function mount(container, slug) {
  const plan = getActivePlan(slug);

  if (!plan) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📋</div>
        <div class="empty-state__title">Aucun plan importé</div>
        <div class="empty-state__body">Va dans l'onglet Versions pour importer un fichier .md généré avec Claude.</div>
      </div>`;
    return;
  }

  const todayStr = today();
  const states   = getAllSessionStates(slug);

  // Find current week index
  let currentWeekNum = plan.weeks[0]?.number || 1;
  for (const w of plan.weeks) {
    if (w.sessions.some(s => s.date <= todayStr)) currentWeekNum = w.number;
  }

  const totSessions = plan.weeks.flatMap(w => w.sessions).filter(s => s.type !== 'rest').length;
  const totDone     = plan.weeks.flatMap(w => w.sessions).filter(s => states[s.id]?.completed).length;
  const pct         = totSessions ? Math.round(totDone / totSessions * 100) : 0;

  container.innerHTML = `
    <div style="padding-top:var(--space-4)">
      <!-- Global progress -->
      <div style="padding:0 var(--space-4) var(--space-2)">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label"><span>${totDone} séances réalisées</span><span>${pct}%</span></div>
      </div>

      <!-- Phase pills -->
      <div class="phase-pills-scroll" id="phase-pills">
        ${plan.phases.map(p => `
          <button class="phase-pill phase-pill--${p.color}" data-phase="${p.id}">
            <span class="phase-pill__dot"></span>${p.name}
          </button>`).join('')}
      </div>

      <!-- Weeks -->
      <div id="weeks-list">
        ${plan.weeks.map(w => renderWeekCard(w, currentWeekNum, states, plan)).join('')}
      </div>
    </div>
  `;

  // Phase pill scroll-to
  container.querySelectorAll('[data-phase]').forEach(btn => {
    btn.addEventListener('click', () => {
      const phaseId = btn.dataset.phase;
      const phase   = plan.phases.find(p => p.id === phaseId);
      if (!phase) return;
      const firstWeek = Math.min(...phase.weeks);
      const el = container.querySelector(`[data-week="${firstWeek}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Week expand/collapse
  container.querySelectorAll('[data-week-header]').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const card = hdr.closest('.week-card');
      card.classList.toggle('week-card--open');
    });
  });

  // Session tap → detail
  container.querySelectorAll('[data-session-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-session-check]')) return; // handled separately
      navigate(`/event/${slug}/session/${el.dataset.sessionNav}`);
    });
  });

  // Checkbox toggle
  container.querySelectorAll('[data-session-check]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sessionId = btn.dataset.sessionCheck;
      const completed = btn.dataset.completed !== 'true';
      await handleToggle(btn, sessionId, completed, slug, plan, container);
    });
  });

  // Auto-open current week
  const currentCard = container.querySelector(`[data-week="${currentWeekNum}"]`);
  if (currentCard) {
    currentCard.classList.add('week-card--open');
    // Delay scroll so layout is complete
    setTimeout(() => currentCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

async function handleToggle(btn, sessionId, completed, slug, plan, container) {
  // Optimistic update
  btn.dataset.completed = String(completed);
  const cb = btn.querySelector('[data-checkbox]');
  if (cb) cb.className = `checkbox ${completed ? 'checkbox--checked' : ''}`;

  const item = btn.closest('.session-item');
  if (item) item.classList.toggle('session-item--completed', completed);

  // Refresh week completion badge
  refreshWeekCompletion(container, sessionId, completed, plan, slug);

  try {
    await toggleSession(slug, sessionId, completed);
    if (completed) navigator.vibrate?.(10);
  } catch (err) {
    // Revert
    btn.dataset.completed = String(!completed);
    if (cb) cb.className = `checkbox ${!completed ? 'checkbox--checked' : ''}`;
    if (item) item.classList.toggle('session-item--completed', !completed);
    showToast('Erreur de synchronisation', 'error');
  }
}

function refreshWeekCompletion(container, sessionId, newCompleted, plan, slug) {
  const weekNum = parseInt(sessionId.replace('s', '').split('-')[0]);
  const week    = plan.weeks.find(w => w.number === weekNum);
  if (!week) return;

  const states = getAllSessionStates(slug);
  // Simulate the new state for counting
  const simStates = { ...states, [sessionId]: { completed: newCompleted } };

  const sessions = week.sessions.filter(s => s.type !== 'rest');
  const done     = sessions.filter(s => simStates[s.id]?.completed).length;
  const total    = sessions.length;
  const all      = total > 0 && done === total;

  const badge = container.querySelector(`[data-week-completion="${weekNum}"]`);
  if (badge) {
    badge.textContent    = total ? `${done}/${total}` : '';
    badge.className = `week-card__completion${all ? ' week-card__completion--done' : ''}`;
  }
}

function renderWeekCard(week, currentWeekNum, states, plan) {
  const isCurrent  = week.number === currentWeekNum;
  const phase      = plan.phases.find(p => p.id === week.phaseId);
  const phaseColor = phase?.color || 'gray';
  const sessions   = week.sessions.filter(s => s.type !== 'rest');
  const done       = sessions.filter(s => states[s.id]?.completed).length;
  const total      = sessions.length;
  const allDone    = total > 0 && done === total;
  const isRaceWeek = week.sessions.some(s => s.type === 'race');

  let badge = '';
  if (isCurrent)       badge = `<span class="week-card__badge week-card__badge--current">EN COURS</span>`;
  else if (week.isDecharge) badge = `<span class="week-card__badge week-card__badge--decharge">DÉCHARGE</span>`;
  else if (isRaceWeek) badge = `<span class="week-card__badge week-card__badge--race">COURSE</span>`;

  return `
    <div class="week-card ${isCurrent ? 'week-card--current' : ''}" data-week="${week.number}">
      <div class="week-card__header" data-week-header>
        <span class="week-card__phase-dot" style="background:var(--phase-${phaseColor})"></span>
        <div class="week-card__info">
          <div class="week-card__title">
            S${String(week.number).padStart(2, '0')} ${badge}
          </div>
          <div class="week-card__dates">${week.dateRange} · ${week.targetVolumeKm} km</div>
        </div>
        <div class="week-card__right">
          <span class="week-card__completion ${allDone ? 'week-card__completion--done' : ''}"
                data-week-completion="${week.number}">
            ${total ? `${done}/${total}` : ''}
          </span>
          <span class="week-card__chevron">›</span>
        </div>
      </div>
      <div class="week-card__sessions">
        ${week.sessions.map(s => renderSessionItem(s, states[s.id]?.completed || false)).join('')}
      </div>
    </div>
  `;
}

function renderSessionItem(session, completed) {
  const label = SESSION_LABELS[session.type] || session.type.slice(0, 4).toUpperCase();
  const dateStr = formatDateShort(session.date);

  return `
    <div class="session-item ${completed ? 'session-item--completed' : ''}"
         data-session-nav="${session.id}">
      <span class="session-item__type-badge type-${session.type}">${label}</span>
      <div class="session-item__content">
        <div class="session-item__title">${session.title}</div>
        <div class="session-item__meta">${session.dayLabel} ${dateStr}</div>
      </div>
      <button class="checkbox ${completed ? 'checkbox--checked' : ''}"
              data-session-check="${session.id}"
              data-completed="${completed}"
              aria-label="${completed ? 'Marquer non réalisée' : 'Marquer réalisée'}">
        <span data-checkbox></span>
      </button>
    </div>
  `;
}
