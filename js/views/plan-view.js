import { getActivePlan, getAllSessionStates, toggleSession, skipSession,
         saveSessionNote, getDateOverrides, getWeekMetaOverrides,
         moveSession, swapSessionDates, swapWeeks } from '../store.js';
import { navigate, showToast } from '../app.js';
import { today, formatDateShort } from '../utils/dates.js';
import { SESSION_LABELS } from '../parser.js';
import { applyDateOverrides, applyWeekMetaOverrides, getWeekMonday, getDayLabel } from '../utils/plan-overrides.js';

const REASON_LABELS = {
  vacances:      'Vacances',
  professionnel: 'Empêchement pro.',
  maladie:       'Maladie',
  blessure:      'Blessure',
  autre:         'Autre',
};

export function mount(container, slug, { pausedWeeks } = {}) {
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

  const todayStr  = today();
  const states    = getAllSessionStates(slug);
  const overrides     = getDateOverrides(slug);
  const metaOverrides = getWeekMetaOverrides(slug);
  const effPlan       = applyWeekMetaOverrides(applyDateOverrides(plan, overrides), metaOverrides);
  const dateIndex     = buildDateIndex(effPlan);

  // Semaine en cours
  let currentWeekNum = effPlan.weeks[0]?.number || 1;
  for (const w of effPlan.weeks) {
    if (w.sessions.some(s => s.date <= todayStr)) currentWeekNum = w.number;
  }

  const allSessions = effPlan.weeks.flatMap(w => w.sessions).filter(s => s.type !== 'rest');
  const totSessions = allSessions.length;
  const totDone     = allSessions.filter(s => states[s.id]?.completed).length;
  const totSkipped  = allSessions.filter(s => states[s.id]?.skipped).length;
  const pct         = totSessions ? Math.round(totDone / totSessions * 100) : 0;

  const skippedLabel = totSkipped > 0
    ? ` · <span style="color:var(--ios-orange)">${totSkipped} manquée${totSkipped > 1 ? 's' : ''}</span>`
    : '';

  container.innerHTML = `
    <div style="padding-top:var(--space-4)">
      <div style="padding:0 var(--space-4) var(--space-2)">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label"><span>${totDone} réalisée${totDone > 1 ? 's' : ''}${skippedLabel}</span><span>${pct}%</span></div>
      </div>

      <div class="phase-pills-scroll" id="phase-pills">
        ${effPlan.phases.map(p => `
          <button class="phase-pill phase-pill--${p.color}" data-phase="${p.id}">
            <span class="phase-pill__dot"></span>${p.name}
          </button>`).join('')}
      </div>

      <div id="weeks-list">
        ${effPlan.weeks.map(w => renderWeekCard(w, currentWeekNum, states, effPlan, overrides, pausedWeeks?.get(w.number))).join('')}
      </div>
    </div>
  `;

  // ── Filtre phase pill ─────────────────────────────────────────
  let activePhaseId = null;
  const pillsContainer = container.querySelector('#phase-pills');

  container.querySelectorAll('[data-phase]').forEach(btn => {
    btn.addEventListener('click', () => {
      const phaseId = btn.dataset.phase;
      if (activePhaseId === phaseId) {
        activePhaseId = null;
        delete pillsContainer.dataset.filterActive;
        container.querySelectorAll('[data-phase]').forEach(p => p.classList.remove('phase-pill--active'));
        container.querySelectorAll('.week-card').forEach(card => {
          card.classList.toggle('week-card--open', parseInt(card.dataset.week) === currentWeekNum);
        });
      } else {
        container.querySelectorAll('[data-phase]').forEach(p => p.classList.remove('phase-pill--active'));
        btn.classList.add('phase-pill--active');
        pillsContainer.dataset.filterActive = '1';
        activePhaseId = phaseId;
        container.querySelectorAll('.week-card').forEach(card => {
          card.classList.toggle('week-card--open', card.dataset.phaseId === phaseId);
        });
        const first = container.querySelector(`.week-card[data-phase-id="${phaseId}"]`);
        if (first) setTimeout(() => first.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
    });
  });

  // ── Expand/collapse semaine ───────────────────────────────────
  container.querySelectorAll('[data-week-header]').forEach(hdr => {
    hdr.addEventListener('click', () => hdr.closest('.week-card').classList.toggle('week-card--open'));
  });

  // ── Navigation vers détail séance ────────────────────────────
  container.querySelectorAll('[data-session-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-session-check]') ||
          e.target.closest('[data-session-skip]') ||
          e.target.closest('[data-session-move]')) return;
      navigate(`/event/${slug}/session/${el.dataset.sessionNav}`);
    });
  });

  // ── Checkbox (réalisée) ───────────────────────────────────────
  container.querySelectorAll('[data-session-check]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sessionId = btn.dataset.sessionCheck;
      const completed = btn.dataset.completed !== 'true';
      await handleToggle(btn, sessionId, completed, slug, effPlan, container);
    });
  });

  // ── Skipbox (manquée) → modale raison ────────────────────────
  container.querySelectorAll('[data-session-skip]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sessionId = btn.dataset.sessionSkip;
      const skipping  = btn.dataset.skipped !== 'true';
      if (skipping) {
        showSkipReasonModal(btn, sessionId, slug, effPlan, container);
      } else {
        handleSkip(btn, sessionId, false, null, slug, effPlan, container);
      }
    });
  });

  // ── Bouton déplacer ───────────────────────────────────────────
  container.querySelectorAll('[data-session-move]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sessionId = btn.dataset.sessionMove;
      const session   = effPlan.weeks.flatMap(w => w.sessions).find(s => s.id === sessionId);
      if (session) showMoveModal(session, effPlan, dateIndex, slug, container);
    });
  });

  // ── Bouton échanger semaine ───────────────────────────────────
  container.querySelectorAll('[data-week-swap]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const weekNum = parseInt(btn.dataset.weekSwap);
      showSwapWeekModal(weekNum, effPlan, slug, container);
    });
  });

  // ── Auto-ouvrir semaine courante ──────────────────────────────
  const currentCard = container.querySelector(`[data-week="${currentWeekNum}"]`);
  if (currentCard) {
    currentCard.classList.add('week-card--open');
    setTimeout(() => currentCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

// ── Date overrides ────────────────────────────────────────────────

function buildDateIndex(effectivePlan) {
  const index = {};
  effectivePlan.weeks.forEach(w => w.sessions.forEach(s => { index[s.date] = s.id; }));
  return index;
}

// ── Modale déplacer ───────────────────────────────────────────────

function showMoveModal(session, effectivePlan, dateIndex, slug, parentContainer) {
  const currentDate = session.date;
  const allDates    = effectivePlan.weeks.flatMap(w => w.sessions.map(s => s.date)).sort();
  const minDate     = allDates[0] || '';
  const maxDate     = allDates[allDates.length - 1] || '';

  const modal = document.createElement('div');
  modal.className = 'compact-modal';
  modal.innerHTML = `
    <div class="compact-modal__overlay"></div>
    <div class="compact-modal__panel">
      <div class="compact-modal__title">Déplacer la séance</div>
      <div class="compact-modal__subtitle">${session.title}</div>
      <div style="margin-top:var(--space-3)">
        <label class="form-label">Nouvelle date</label>
        <input class="form-input" type="date" id="move-date"
               value="${currentDate}" min="${minDate}" max="${maxDate}"
               style="padding-top:var(--space-1);font-size:16px">
      </div>
      <div class="compact-modal__hint" id="move-hint"></div>
      <div class="compact-modal__footer">
        <button class="btn btn--secondary" style="flex:1" id="move-cancel">Annuler</button>
        <button class="btn btn--primary"   style="flex:1" id="move-confirm">Déplacer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const dateInput  = modal.querySelector('#move-date');
  const hint       = modal.querySelector('#move-hint');
  const confirmBtn = modal.querySelector('#move-confirm');

  const updateHint = () => {
    const target = dateInput.value;
    if (!target || target === currentDate) { hint.textContent = ''; return; }
    const conflictId = dateIndex[target];
    if (conflictId && conflictId !== session.id) {
      const cs = effectivePlan.weeks.flatMap(w => w.sessions).find(s => s.id === conflictId);
      hint.textContent  = `↔ Échange avec : ${cs?.title || conflictId}`;
      hint.style.color  = 'var(--ios-orange)';
    } else {
      hint.textContent = '';
    }
  };
  dateInput.addEventListener('change', updateHint);

  const close = () => document.body.removeChild(modal);
  modal.querySelector('#move-cancel').addEventListener('click', close);
  modal.querySelector('.compact-modal__overlay').addEventListener('click', close);

  confirmBtn.addEventListener('click', async () => {
    const targetDate = dateInput.value;
    if (!targetDate || targetDate === currentDate) { close(); return; }
    confirmBtn.disabled = true;
    try {
      const conflictId = dateIndex[targetDate];
      if (conflictId && conflictId !== session.id) {
        await swapSessionDates(slug, session.id, targetDate, conflictId, currentDate);
      } else {
        await moveSession(slug, session.id, targetDate);
      }
      close();
      mount(parentContainer, slug);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      confirmBtn.disabled = false;
    }
  });
}

// ── Modale échanger semaines ──────────────────────────────────────

function showSwapWeekModal(weekNum, effPlan, slug, container) {
  const weekA  = effPlan.weeks.find(w => w.number === weekNum);
  const phaseA = effPlan.phases.find(p => p.id === weekA.phaseId);

  const otherWeeks = effPlan.weeks.filter(w => w.number !== weekNum && w.sessions.length > 0);

  const weekLabel = w => {
    const ph   = effPlan.phases.find(p => p.id === w.phaseId);
    const tags = [ph?.name, w.isDecharge ? 'Décharge' : null, `${w.targetVolumeKm}km`]
      .filter(Boolean).join(' · ');
    return `S${String(w.number).padStart(2, '0')} — ${w.dateRange} · ${tags}`;
  };

  const modal = document.createElement('div');
  modal.className = 'compact-modal';
  modal.innerHTML = `
    <div class="compact-modal__overlay"></div>
    <div class="compact-modal__panel">
      <div class="compact-modal__title">Échanger S${String(weekNum).padStart(2, '0')}</div>
      <div class="compact-modal__subtitle">${weekA.dateRange} · ${phaseA?.name || ''}${weekA.isDecharge ? ' · Décharge' : ''}</div>
      <div style="margin-top:var(--space-3)">
        <label style="font-size:13px;color:var(--text-secondary);font-weight:500;display:block;margin-bottom:var(--space-1)">Semaine cible</label>
        <select class="form-input" id="swap-week-select" style="font-size:15px">
          <option value="">Choisir une semaine…</option>
          ${otherWeeks.map(w => `<option value="${w.number}">${weekLabel(w)}</option>`).join('')}
        </select>
      </div>
      <div class="compact-modal__footer">
        <button class="btn btn--secondary" style="flex:1" id="swap-week-cancel">Annuler</button>
        <button class="btn btn--primary"   style="flex:1" id="swap-week-confirm">Échanger</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => document.body.removeChild(modal);
  modal.querySelector('#swap-week-cancel').addEventListener('click', close);
  modal.querySelector('.compact-modal__overlay').addEventListener('click', close);

  modal.querySelector('#swap-week-confirm').addEventListener('click', async () => {
    const targetNum = parseInt(modal.querySelector('#swap-week-select').value);
    if (!targetNum) { showToast('Sélectionne une semaine cible', 'error'); return; }

    const weekB = effPlan.weeks.find(w => w.number === targetNum);

    const mondayA = getWeekMonday(weekA.sessions[0].date);
    const mondayB = getWeekMonday(weekB.sessions[0].date);

    const confirmBtn = modal.querySelector('#swap-week-confirm');
    confirmBtn.disabled = true;
    try {
      await swapWeeks(slug, weekA.sessions, mondayA, weekB.sessions, mondayB, weekA, weekB);
      close();
      mount(container, slug);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      confirmBtn.disabled = false;
    }
  });
}

// ── Modale raison absence ─────────────────────────────────────────

function showSkipReasonModal(btn, sessionId, slug, effPlan, container) {
  const REASONS = [
    { value: 'vacances',      label: 'Vacances' },
    { value: 'professionnel', label: 'Empêchement professionnel' },
    { value: 'maladie',       label: 'Maladie' },
    { value: 'blessure',      label: 'Blessure' },
    { value: 'autre',         label: 'Autre' },
  ];

  const modal = document.createElement('div');
  modal.className = 'compact-modal';
  modal.innerHTML = `
    <div class="compact-modal__overlay"></div>
    <div class="compact-modal__panel">
      <div class="compact-modal__title">Raison de l'absence</div>
      <div class="compact-modal__options">
        ${REASONS.map((r, i) => `
          <label class="compact-modal__option">
            <input type="radio" name="skip-reason" value="${r.value}" ${i === 0 ? 'checked' : ''}>
            <span>${r.label}</span>
          </label>`).join('')}
      </div>
      <div class="compact-modal__footer">
        <button class="btn btn--secondary" style="flex:1" id="reason-cancel">Annuler</button>
        <button class="btn btn--primary"   style="flex:1" id="reason-confirm">Confirmer</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => document.body.removeChild(modal);
  modal.querySelector('#reason-cancel').addEventListener('click', close);
  modal.querySelector('.compact-modal__overlay').addEventListener('click', close);

  modal.querySelector('#reason-confirm').addEventListener('click', async () => {
    const reason = modal.querySelector('input[name="skip-reason"]:checked')?.value || 'autre';
    close();
    await handleSkip(btn, sessionId, true, reason, slug, effPlan, container);
  });
}

// ── Handlers ──────────────────────────────────────────────────────

async function handleToggle(btn, sessionId, completed, slug, plan, container) {
  const item = btn.closest('.session-item');
  btn.dataset.completed = String(completed);
  btn.classList.toggle('checkbox--checked', completed);
  if (item) {
    item.classList.toggle('session-item--completed', completed);
    if (completed) {
      item.classList.remove('session-item--skipped');
      const skipBtn = item.querySelector('[data-session-skip]');
      if (skipBtn) { skipBtn.dataset.skipped = 'false'; skipBtn.classList.remove('skipbox--skipped'); }
    }
  }
  refreshWeekCompletion(container, sessionId, completed, false, plan, slug);

  try {
    await toggleSession(slug, sessionId, completed);
    if (completed) navigator.vibrate?.(10);
  } catch {
    btn.dataset.completed = String(!completed);
    btn.classList.toggle('checkbox--checked', !completed);
    if (item) item.classList.toggle('session-item--completed', !completed);
    showToast('Erreur de synchronisation', 'error');
  }
}

async function handleSkip(btn, sessionId, skipped, reason, slug, plan, container) {
  const item = btn.closest('.session-item');
  btn.dataset.skipped = String(skipped);
  btn.classList.toggle('skipbox--skipped', skipped);
  if (item) {
    item.classList.toggle('session-item--skipped', skipped);
    if (skipped) {
      item.classList.remove('session-item--completed');
      const checkBtn = item.querySelector('[data-session-check]');
      if (checkBtn) { checkBtn.dataset.completed = 'false'; checkBtn.classList.remove('checkbox--checked'); }
      if (reason) {
        const meta = item.querySelector('.session-item__meta');
        if (meta && !meta.textContent.includes('·')) {
          meta.textContent += ` · ${REASON_LABELS[reason] || reason}`;
        }
      }
    }
  }
  refreshWeekCompletion(container, sessionId, false, skipped, plan, slug);

  try {
    await skipSession(slug, sessionId, skipped, reason);
    if (skipped && reason) {
      const currentNote = getAllSessionStates(slug)[sessionId]?.note || '';
      const reasonText  = REASON_LABELS[reason] || reason;
      if (!currentNote.includes(reasonText)) {
        await saveSessionNote(slug, sessionId, currentNote ? `${reasonText}\n${currentNote}` : reasonText);
      }
    }
  } catch {
    btn.dataset.skipped = String(!skipped);
    btn.classList.toggle('skipbox--skipped', !skipped);
    if (item) item.classList.toggle('session-item--skipped', !skipped);
    showToast('Erreur de synchronisation', 'error');
  }
}

function refreshWeekCompletion(container, sessionId, newCompleted, newSkipped, plan, slug) {
  const weekNum = parseInt(sessionId.replace('s', '').split('-')[0]);
  const week    = plan.weeks.find(w => w.number === weekNum);
  if (!week) return;

  const states    = getAllSessionStates(slug);
  const simStates = { ...states, [sessionId]: { completed: newCompleted, skipped: newSkipped } };
  const sessions  = week.sessions.filter(s => s.type !== 'rest');
  const done      = sessions.filter(s => simStates[s.id]?.completed).length;
  const skipped   = sessions.filter(s => simStates[s.id]?.skipped).length;
  const total     = sessions.length;
  const all       = total > 0 && done === total;

  const badge = container.querySelector(`[data-week-completion="${weekNum}"]`);
  if (badge) {
    let text = total ? `${done}/${total}` : '';
    if (skipped > 0) text += ` ·${skipped}✗`;
    badge.textContent = text;
    badge.className   = `week-card__completion${all ? ' week-card__completion--done' : ''}`;
  }
}

// ── Rendu ─────────────────────────────────────────────────────────

function renderWeekCard(week, currentWeekNum, states, plan, overrides, pausedByRace) {
  const isCurrent  = week.number === currentWeekNum;
  const phase      = plan.phases.find(p => p.id === week.phaseId);
  const phaseColor = phase?.color || 'gray';
  const sessions   = week.sessions.filter(s => s.type !== 'rest');
  const done       = sessions.filter(s => states[s.id]?.completed).length;
  const skipped    = sessions.filter(s => states[s.id]?.skipped).length;
  const total      = sessions.length;
  const allDone    = total > 0 && done === total;
  const isRaceWeek = week.sessions.some(s => s.type === 'race');

  let badge = '';
  if (pausedByRace)       badge = `<span class="week-card__badge week-card__badge--paused" title="Course en cours : ${pausedByRace}">⏸ EN PAUSE</span>`;
  else if (isCurrent)     badge = `<span class="week-card__badge week-card__badge--current">EN COURS</span>`;
  else if (week.isDecharge) badge = `<span class="week-card__badge week-card__badge--decharge">DÉCHARGE</span>`;
  else if (isRaceWeek)    badge = `<span class="week-card__badge week-card__badge--race">COURSE</span>`;

  let completionText = total ? `${done}/${total}` : '';
  if (skipped > 0) completionText += ` ·${skipped}✗`;

  return `
    <div class="week-card ${isCurrent ? 'week-card--current' : ''} ${pausedByRace ? 'week-card--paused' : ''}"
         data-week="${week.number}" data-phase-id="${week.phaseId}">
      <div class="week-card__header" data-week-header>
        <span class="week-card__phase-dot" style="background:var(--phase-${phaseColor})"></span>
        <div class="week-card__info">
          <div class="week-card__title">S${String(week.number).padStart(2, '0')} ${badge}</div>
          <div class="week-card__dates">${week.dateRange} · ${week.targetVolumeKm} km</div>
        </div>
        <div class="week-card__right">
          <button class="week-swapbtn" data-week-swap="${week.number}" title="Échanger avec une autre semaine">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round"
                 style="width:14px;height:14px;pointer-events:none">
              <path d="M6 3v14M3 6l3-3 3 3"/>
              <path d="M14 17V3M11 14l3 3 3-3"/>
            </svg>
          </button>
          <span class="week-card__completion ${allDone ? 'week-card__completion--done' : ''}"
                data-week-completion="${week.number}">${completionText}</span>
          <span class="week-card__chevron">›</span>
        </div>
      </div>
      <div class="week-card__sessions">
        ${week.sessions.map(s => renderSessionItem(s, states[s.id] || {}, !!overrides[s.id])).join('')}
      </div>
    </div>
  `;
}

function renderSessionItem(session, state, isMoved) {
  const completed    = state.completed || false;
  const skipped      = state.skipped   || false;
  const reason       = state.skipReason || null;
  const label        = SESSION_LABELS[session.type] || session.type.slice(0, 4).toUpperCase();
  const dateStr      = formatDateShort(session.date);
  const reasonSuffix = skipped && reason ? ` · ${REASON_LABELS[reason] || reason}` : '';
  const movedMark    = isMoved ? ' · ↕' : '';

  return `
    <div class="session-item ${completed ? 'session-item--completed' : ''} ${skipped ? 'session-item--skipped' : ''}"
         data-session-nav="${session.id}">
      <span class="session-item__type-badge type-${session.type}">${label}</span>
      <div class="session-item__content">
        <div class="session-item__title">${session.title}</div>
        <div class="session-item__meta">${session.dayLabel} ${dateStr}${reasonSuffix}${movedMark}</div>
      </div>
      <div class="session-item__actions">
        <button class="movebtn" data-session-move="${session.id}" aria-label="Déplacer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               style="width:13px;height:13px;pointer-events:none">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
        </button>
        <button class="skipbox ${skipped ? 'skipbox--skipped' : ''}"
                data-session-skip="${session.id}"
                data-skipped="${skipped}"
                aria-label="${skipped ? 'Retirer la mention manquée' : 'Marquer comme manquée'}">
          <span data-skipbox></span>
        </button>
        <button class="checkbox ${completed ? 'checkbox--checked' : ''}"
                data-session-check="${session.id}"
                data-completed="${completed}"
                aria-label="${completed ? 'Marquer non réalisée' : 'Marquer réalisée'}">
        </button>
      </div>
    </div>
  `;
}
