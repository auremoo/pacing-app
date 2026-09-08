import { showToast, navigate } from '../app.js';
import { getRoutineMeta, saveRoutineSettings } from '../store.js';
import { addDays, weeksBetween } from '../utils/dates.js';
import { getWeekMonday } from '../utils/plan-overrides.js';

export function mount(container) {
  render(container);
}

function render(container) {
  const meta = getRoutineMeta() || {};
  const startDate = meta.startDate || '';
  const blockWeeks = meta.blockWeeks || '';
  const endDate = (startDate && blockWeeks) ? addDays(startDate, blockWeeks * 7 - 1) : '';

  container.innerHTML = `
    <div class="form-page-body" style="padding-top:var(--space-4)">

      <p class="section-header">Activités actuelles</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Activités récurrentes</label>
          <textarea class="form-input form-textarea" id="f-context" rows="4"
            placeholder="Ex : Badminton le mercredi soir, 1x/semaine, loisir">${esc(meta.context || '')}</textarea>
        </div>
      </div>

      <p class="section-header">Objectifs de ce bloc</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Ce que tu veux travailler</label>
          <textarea class="form-input form-textarea" id="f-goals" rows="4"
            placeholder="Ex : 2 séances de fractionné/sprint en plus par semaine pour progresser en course à pied">${esc(meta.goals || '')}</textarea>
        </div>
      </div>

      <p class="section-header">Paramètres du bloc</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Date de début (toujours un lundi)</label>
          <input class="form-input" id="f-startdate" type="date" value="${esc(startDate)}">
        </div>
        <div class="form-field">
          <label class="form-label">Durée du bloc (semaines)</label>
          <input class="form-input" id="f-blockweeks" type="number" inputmode="numeric" pattern="[0-9]*" min="1" max="52"
            placeholder="Ex : 12" value="${esc(blockWeeks)}">
        </div>
        <div class="form-field">
          <label class="form-label">Date de fin (dernier dimanche du bloc)</label>
          <input class="form-input" id="f-enddate" type="date" value="${esc(endDate)}" min="${esc(startDate)}">
        </div>
      </div>

      <div style="padding:0 var(--space-4)">
        <button class="btn btn--primary btn--full" id="save-btn">Enregistrer</button>
      </div>

      ${!meta.activeVersion ? `
        <div style="padding:var(--space-3) var(--space-4) 0">
          <button class="btn btn--ghost btn--full" id="go-versions-btn">Aller générer le prompt initial →</button>
        </div>
      ` : ''}

      <div style="height:var(--space-8)"></div>
    </div>
  `;

  const startInput  = container.querySelector('#f-startdate');
  const weeksInput  = container.querySelector('#f-blockweeks');
  const endInput    = container.querySelector('#f-enddate');

  // Le lundi de la semaine choisie devient la date de début effective
  startInput.addEventListener('change', () => {
    if (!startInput.value) return;
    const monday = getWeekMonday(startInput.value);
    if (monday !== startInput.value) {
      startInput.value = monday;
      showToast('Date recalée sur le lundi de la semaine', 'success');
    }
    endInput.min = startInput.value;
    syncEndFromWeeks(startInput, weeksInput, endInput);
  });

  weeksInput.addEventListener('input', () => syncEndFromWeeks(startInput, weeksInput, endInput));

  endInput.addEventListener('change', () => {
    if (!startInput.value || !endInput.value) return;
    if (endInput.value < startInput.value) { endInput.value = ''; return; }
    weeksInput.value = weeksBetween(startInput.value, endInput.value);
  });

  container.querySelector('#go-versions-btn')?.addEventListener('click', () => navigate('/routine/versions'));

  container.querySelector('#save-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#save-btn');
    btn.disabled = true;
    const updates = {
      context:    container.querySelector('#f-context').value.trim(),
      goals:      container.querySelector('#f-goals').value.trim(),
      blockWeeks: parseInt(weeksInput.value) || 0,
      startDate:  startInput.value,
    };
    try {
      await saveRoutineSettings(updates);
      showToast('Réglages enregistrés', 'success');
      render(container);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function syncEndFromWeeks(startInput, weeksInput, endInput) {
  const weeks = parseInt(weeksInput.value);
  if (!startInput.value || !weeks) { endInput.value = ''; return; }
  endInput.value = addDays(startInput.value, weeks * 7 - 1);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
