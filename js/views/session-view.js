import { getActivePlan, getSessionState, toggleSession, saveSessionNote, getDateOverrides, ROUTINE_SLUG } from '../store.js';
import { navigate, showToast } from '../app.js';
import { formatDate } from '../utils/dates.js';
import { SESSION_LABELS } from '../parser.js';
import { applyDateOverrides } from '../utils/plan-overrides.js';

export function mount(container, slug, sessionId) {
  const listPath = slug === ROUTINE_SLUG ? '/routine' : `/event/${slug}`;

  const plan = getActivePlan(slug);
  if (!plan) { navigate(listPath); return; }

  const effPlan = applyDateOverrides(plan, getDateOverrides(slug));
  const session = effPlan.weeks.flatMap(w => w.sessions).find(s => s.id === sessionId);
  if (!session) { navigate(listPath); return; }

  const state     = getSessionState(slug, sessionId);
  const completed = state.completed;
  const label     = SESSION_LABELS[session.type] || session.type;

  container.innerHTML = `
    <div class="nav-bar">
      <button class="nav-btn" id="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        Plan
      </button>
      <span class="nav-bar__title">${session.dayLabel}</span>
      <span style="width:72px"></span>
    </div>
    <div class="scroll-view">
      <div class="session-detail">
        <!-- Header card -->
        <div class="session-detail__header">
          <div class="session-detail__type-row">
            <div class="session-detail__type-badge type-${session.type}">${label}</div>
            <div>
              <div class="session-detail__type-label">${typeLabel(session.type)}</div>
            </div>
          </div>
          <div class="session-detail__title">${session.title}</div>
          <div class="session-detail__date">${formatDate(session.date)}</div>
          <div class="session-detail__description">${renderDescription(session.description)}</div>
        </div>

        <!-- Check button -->
        <button class="btn btn--full session-detail__check-btn ${completed ? 'session-detail__check-btn--done' : 'btn--primary'}"
                id="check-btn">
          ${completed ? '✓ Réalisée — Marquer non réalisée' : 'Marquer comme réalisée'}
        </button>

        <!-- Note -->
        <p class="section-header" style="padding-top:var(--space-6)">Notes personnelles</p>
        <div style="padding:0 var(--space-4)">
          <textarea class="textarea-field" id="note-input" rows="4"
                    placeholder="Sensations, commentaires, temps…">${state.note || ''}</textarea>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:var(--space-2)">
            <div class="session-detail__sync-status" id="sync-status"></div>
            <button class="btn btn--secondary btn--sm" id="save-note-btn">Sauvegarder</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => navigate(`${listPath}/plan`));

  const checkBtn   = container.querySelector('#check-btn');
  const noteInput  = container.querySelector('#note-input');
  const syncStatus = container.querySelector('#sync-status');

  let currentCompleted = completed;

  checkBtn.addEventListener('click', async () => {
    currentCompleted = !currentCompleted;
    updateCheckBtn(checkBtn, currentCompleted);
    try {
      await toggleSession(slug, sessionId, currentCompleted);
      if (currentCompleted) navigator.vibrate?.(10);
      syncStatus.textContent = 'Synchronisé ✓';
      setTimeout(() => { syncStatus.textContent = ''; }, 2000);
    } catch {
      showToast('Erreur de synchronisation', 'error');
      currentCompleted = !currentCompleted;
      updateCheckBtn(checkBtn, currentCompleted);
    }
  });

  const saveNoteBtn = container.querySelector('#save-note-btn');

  saveNoteBtn.addEventListener('click', async () => {
    saveNoteBtn.disabled = true;
    syncStatus.textContent = 'Sauvegarde…';
    try {
      await saveSessionNote(slug, sessionId, noteInput.value);
      syncStatus.textContent = 'Sauvegardé ✓';
      setTimeout(() => { syncStatus.textContent = ''; }, 2000);
    } catch {
      syncStatus.textContent = 'Erreur';
      showToast('Erreur de synchronisation', 'error');
    } finally {
      saveNoteBtn.disabled = false;
    }
  });
}

function updateCheckBtn(btn, completed) {
  btn.textContent = completed ? '✓ Réalisée — Marquer non réalisée' : 'Marquer comme réalisée';
  btn.className = `btn btn--full session-detail__check-btn ${completed ? 'session-detail__check-btn--done' : 'btn--primary'}`;
}

function renderDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function typeLabel(type) {
  const labels = {
    rest: 'Repos', easy: 'Endurance fondamentale', long: 'Sortie longue',
    intervals: 'Fractionné', tempo: 'Seuil / Tempo', hills: 'Côtes',
    race: 'Course / Compétition', strength: 'PPG / Renforcement', cross: 'Cross-training'
  };
  return labels[type] || type;
}
