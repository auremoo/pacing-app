import { showToast, navigate } from '../app.js';
import { getRoutineMeta, saveRoutineSettings } from '../store.js';
import { today, addDays, weeksBetween } from '../utils/dates.js';
import { getWeekMonday } from '../utils/plan-overrides.js';
import { TARGET_DISTANCES } from '../utils/routine-context.js';

export function mount(container) {
  render(container);
}

function nextMonday() {
  const monday = getWeekMonday(today());
  return monday === today() ? monday : addDays(monday, 7);
}

function render(container) {
  const meta = getRoutineMeta() || {};
  const startDate = meta.startDate || nextMonday();
  const blockWeeks = meta.blockWeeks || '';
  const endDate = blockWeeks ? addDays(startDate, blockWeeks * 7 - 1) : '';

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

      <p class="section-header">Objectifs chrono perso</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-2)" id="targets-list">
        ${(meta.targets || []).map(targetRow).join('')}
      </div>
      <div style="padding:0 var(--space-4) var(--space-1)">
        <button class="btn btn--ghost btn--full" id="add-target-btn" type="button">+ Ajouter un objectif chrono</button>
      </div>
      <p class="type-picker__hint" style="padding:0 var(--space-4) var(--space-4)">Un record que tu aimerais battre un jour, hors course officielle (ex : 5 km en 24'30). Le plan prévoira des séances et des tests pour y arriver. Modifiable à tout moment : la prochaine version du plan en tiendra compte.</p>
      <datalist id="target-distances">${TARGET_DISTANCES.map(d => `<option value="${esc(d)}">`).join('')}</datalist>

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
    if (!startInput.value) startInput.value = nextMonday();
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
    if (!endInput.value) return;
    if (!startInput.value) { startInput.value = nextMonday(); endInput.min = startInput.value; }
    if (endInput.value < startInput.value) {
      showToast('La date de fin doit être après la date de début', 'error');
      endInput.value = '';
      return;
    }
    weeksInput.value = weeksBetween(startInput.value, endInput.value);
  });

  const targetsList = container.querySelector('#targets-list');
  const syncTargetsVisibility = () => { targetsList.hidden = !targetsList.children.length; };
  syncTargetsVisibility();
  container.querySelector('#add-target-btn').addEventListener('click', () => {
    targetsList.insertAdjacentHTML('beforeend', targetRow({}));
    syncTargetsVisibility();
    targetsList.lastElementChild.querySelector('.target-distance').focus();
  });
  targetsList.addEventListener('click', e => {
    const del = e.target.closest('.target-remove');
    if (!del) return;
    del.closest('.target-row').remove();
    syncTargetsVisibility();
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
      targets:    readTargets(targetsList),
    };
    // Une ligne restée vide est ignorée ; à moitié remplie, on prévient.
    const incomplete = [...targetsList.querySelectorAll('.target-row')].some(row =>
      !row.querySelector('.target-distance').value.trim() !== !row.querySelector('.target-time').value.trim());
    if (incomplete) {
      showToast('Objectif chrono incomplet : indique la distance et le temps (ou supprime-le)', 'error');
      btn.disabled = false;
      return;
    }
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

// Un objectif chrono : distance (liste ou libre), temps visé, échéance
// facultative, case « atteint ».
function targetRow(t) {
  return `
    <div class="form-field target-row">
      <div class="target-row__head">
        <input class="form-input target-distance" list="target-distances" placeholder="Distance (ex : 5 km)" value="${esc(t.distance || '')}">
        <button class="target-remove" type="button" aria-label="Supprimer cet objectif">✕</button>
      </div>
      <div class="target-row__grid">
        <label><span class="form-label">Temps visé</span>
          <input class="form-input target-time" placeholder="ex : 24'30" value="${esc(t.time || '')}"></label>
        <label><span class="form-label">D'ici le (facultatif)</span>
          <input class="form-input target-by" type="date" value="${esc(t.by || '')}"></label>
      </div>
      <label class="target-row__done"><input type="checkbox" class="target-achieved" ${t.achieved ? 'checked' : ''}> Atteint</label>
    </div>`;
}

// Lignes complètes seulement (distance + temps) ; une ligne vide est ignorée.
function readTargets(list) {
  return [...list.querySelectorAll('.target-row')].map(row => ({
    distance: row.querySelector('.target-distance').value.trim(),
    time:     row.querySelector('.target-time').value.trim(),
    by:       row.querySelector('.target-by').value || '',
    achieved: row.querySelector('.target-achieved').checked,
  })).filter(t => t.distance && t.time);
}

function syncEndFromWeeks(startInput, weeksInput, endInput) {
  if (!startInput.value) { startInput.value = nextMonday(); endInput.min = startInput.value; }
  const weeks = parseInt(weeksInput.value);
  endInput.value = weeks ? addDays(startInput.value, weeks * 7 - 1) : '';
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
