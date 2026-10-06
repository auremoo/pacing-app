import { getActivePlan, getSessionState, toggleSession, saveSessionNote, getDateOverrides, ROUTINE_SLUG,
         getTypeOverrides, setSessionTypeOverride } from '../store.js';
import { navigate, showToast } from '../app.js';
import { formatDate } from '../utils/dates.js';
import { SESSION_LABELS } from '../parser.js';
import { applyDateOverrides, applyTypeOverrides } from '../utils/plan-overrides.js';
import { PLAN_TYPES, RUN_TYPES, GYM_TYPES, ACTIVITY_TYPES, typeBadge, typeName, sessionTitle } from '../utils/session-types.js';
import { doesRun, doesGym } from '../utils/sports.js';
import { syncEventClosure } from './event-closure.js';

export function mount(container, slug, sessionId) {
  const listPath = slug === ROUTINE_SLUG ? '/routine' : `/event/${slug}`;

  const plan = getActivePlan(slug);
  if (!plan) { navigate(listPath); return; }

  const effPlan = applyTypeOverrides(applyDateOverrides(plan, getDateOverrides(slug)), getTypeOverrides(slug));
  const session = effPlan.weeks.flatMap(w => w.sessions).find(s => s.id === sessionId);
  if (!session) { navigate(listPath); return; }

  const state     = getSessionState(slug, sessionId);
  const completed = state.completed;
  const label     = SESSION_LABELS[session.type] || session.type;
  // Le choix d'activité n'existe que sur le plan général (voir getTypeOverrides).
  const canChangeType = slug === ROUTINE_SLUG;
  const plannedType   = session.plannedType || session.type;

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
            <div class="session-detail__type-badge type-${session.type}" id="type-badge">${label}</div>
            <div>
              <div class="session-detail__type-label" id="type-label">${typeName(session.type)}</div>
            </div>
          </div>
          <div class="session-detail__title" id="session-title">${sessionTitle(session)}</div>
          <div class="session-detail__date">${formatDate(session.date)}</div>
          <!-- Activité changée : la séance du plan n'est plus ce qui a été fait,
               elle reste lisible en retrait sous « Séance prévue ». -->
          <div class="session-detail__description" id="plan-desc" ${session.plannedType ? 'hidden' : ''}>${renderDescription(session.description)}</div>
          <div class="session-detail__planned" id="type-planned" ${session.plannedType ? '' : 'hidden'}>
            <div class="session-detail__planned-label">Séance prévue · ${typeName(plannedType)}</div>
            <div class="session-detail__planned-title">${session.title}</div>
            <div class="session-detail__planned-desc">${renderDescription(session.description)}</div>
          </div>
        </div>

        <!-- Check button -->
        <button class="btn btn--full session-detail__check-btn ${completed ? 'session-detail__check-btn--done' : 'btn--primary'}"
                id="check-btn">
          ${completed ? '✓ Réalisée — Marquer non réalisée' : 'Marquer comme réalisée'}
        </button>

        ${canChangeType ? renderTypePicker(session.type, plannedType) : ''}

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
      await syncEventClosure(slug, sessionId, currentCompleted);
      syncStatus.textContent = 'Synchronisé ✓';
      setTimeout(() => { syncStatus.textContent = ''; }, 2000);
    } catch {
      showToast('Erreur de synchronisation', 'error');
      currentCompleted = !currentCompleted;
      updateCheckBtn(checkBtn, currentCompleted);
    }
  });

  if (canChangeType) wireTypePicker(container, slug, sessionId, plannedType, session.title, syncStatus);

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


// ── Changement d'activité (plan général) ──────────────────────────
// Choisir le type prévu revient au plan ; tout autre type remplace la pastille
// de la journée. Mise à jour sur place, sans remonter la vue : une note en
// cours de saisie dans le champ ne doit pas être perdue.

// Types proposés : ceux des sports de l'utilisateur (pas de « Côtes » pour qui
// ne court pas, pas de « HIIT » pour qui ne va pas en salle), plus toujours le
// type prévu et le type actuel.
function pickableTypes(current, planned) {
  const hidden = new Set([...(doesRun() ? [] : RUN_TYPES), ...(doesGym() ? [] : GYM_TYPES)]);
  return PLAN_TYPES.filter(t => !hidden.has(t) || t === current || t === planned);
}

function renderTypePicker(current, planned) {
  const chip = t => `
    <button class="type-chip ${t === current ? 'type-chip--active' : ''}" data-type-pick="${t}" aria-pressed="${t === current}">
      <span class="type-chip__badge type-${t}">${typeBadge(t)}</span>
      <span class="type-chip__name">${typeName(t)}${t === planned ? ' · prévu' : ''}</span>
    </button>`;
  return `
    <p class="section-header" style="padding-top:var(--space-6)">Activité réalisée</p>
    <div class="type-picker">
      <div class="type-picker__hint">Change l'activité si tu as fait autre chose que prévu : la pastille de la liste suivra.</div>
      <div class="type-picker__group">${ACTIVITY_TYPES.map(chip).join('')}</div>
      <div class="type-picker__group">${pickableTypes(current, planned).map(chip).join('')}</div>
    </div>`;
}

function wireTypePicker(container, slug, sessionId, planned, plannedTitle, syncStatus) {
  container.querySelectorAll('[data-type-pick]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.typePick;
      await setSessionTypeOverride(slug, sessionId, type === planned ? null : type);

      container.querySelectorAll('[data-type-pick]').forEach(b => {
        const on = b.dataset.typePick === type;
        b.classList.toggle('type-chip--active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      const badge = container.querySelector('#type-badge');
      badge.className = `session-detail__type-badge type-${type}`;
      badge.textContent = typeBadge(type);
      container.querySelector('#type-label').textContent = typeName(type);
      const changed = type !== planned;
      container.querySelector('#session-title').textContent = changed ? typeName(type) : plannedTitle;
      container.querySelector('#type-planned').hidden = !changed;
      container.querySelector('#plan-desc').hidden = changed;

      syncStatus.textContent = type === planned ? 'Activité prévue rétablie' : `Activité : ${typeName(type)}`;
      setTimeout(() => { syncStatus.textContent = ''; }, 2000);
    });
  });
}
