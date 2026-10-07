import { showToast, navigate } from '../app.js';
import { getRoutineMeta, saveRoutineSettings } from '../store.js';
import { today, addDays, weeksBetween } from '../utils/dates.js';
import { getWeekMonday } from '../utils/plan-overrides.js';
import { TARGET_DISTANCES, TARGET_KINDS, CHRONO_MEASURES, normalizeTarget, isTargetComplete, availableTargetKinds } from '../utils/routine-context.js';
import { doesRun, doesGym, gymLevel } from '../utils/sports.js';

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

      <p class="section-header">Objectifs perso</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-2)" id="targets-list">
        ${(meta.targets || []).map(normalizeTarget).filter(Boolean).map(targetRow).join('')}
      </div>
      <div style="padding:0 var(--space-4) var(--space-1)">
        <button class="btn btn--ghost btn--full" id="add-target-btn" type="button">+ Ajouter un objectif</button>
      </div>
      <p class="type-picker__hint" style="padding:0 var(--space-4) var(--space-4)">Ce que tu aimerais atteindre, hors course officielle : un chrono (5 km en 24'30) ou une allure (4'40/km), une zone à renforcer (fessiers, posture), une charge (en niveau confirmé), un poids, ou autre chose. Le plan prévoira les séances et les tests qui y mènent ; sans date, c'est l'IA qui choisit quand, d'après ton niveau actuel. Modifiable à tout moment : la prochaine version du plan en tiendra compte.</p>
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
    const kind = doesRun() ? 'chrono' : doesGym() ? (gymLevel() === 'advanced' ? 'force' : 'renfo') : 'poids';
    targetsList.insertAdjacentHTML('beforeend', targetRow({ kind, measure: 'time', what: '', value: '', by: '', achieved: false }));
    syncTargetsVisibility();
    targetsList.lastElementChild.querySelector('.target-what, .target-value')?.focus();
  });
  // Changer le type d'objectif change les champs ; échéance et « atteint »
  // restent. Passer un chrono du temps à l'allure garde la distance.
  targetsList.addEventListener('change', e => {
    const kindSel = e.target.closest('.target-kind');
    const measureSel = e.target.closest('.target-measure');
    if (!kindSel && !measureSel) return;
    const row = e.target.closest('.target-row');
    const t = readRow(row);
    row.outerHTML = targetRow(kindSel ? { ...t, what: '', value: '' } : { ...t, value: '' });
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
    const incomplete = [...targetsList.querySelectorAll('.target-row')].map(readRow)
      .some(t => (t.what || t.value) && !isTargetComplete(t));
    if (incomplete) {
      showToast('Objectif incomplet : remplis ses champs (ou supprime-le)', 'error');
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

// Un objectif : type (chrono, force, poids, autre), un ou deux champs selon le
// type, échéance facultative, case « atteint ».
function targetRow(t) {
  const base = TARGET_KINDS[t.kind] || TARGET_KINDS.autre;
  const chrono = t.kind === 'chrono';
  const m = CHRONO_MEASURES[t.measure] || CHRONO_MEASURES.time;
  const k = chrono ? { ...base, what: m.what, value: m.value, valuePh: m.valuePh } : base;
  return `
    <div class="form-field target-row">
      <div class="target-row__head">
        <select class="form-input target-kind" aria-label="Type d'objectif">
          ${availableTargetKinds({ run: doesRun(), gym: doesGym(), level: gymLevel() }, t.kind).map(id => `<option value="${id}" ${id === t.kind ? 'selected' : ''}>${TARGET_KINDS[id].label}</option>`).join('')}
        </select>
        ${chrono ? `<select class="form-input target-measure" aria-label="Temps ou allure">
          ${Object.entries(CHRONO_MEASURES).map(([id, mm]) => `<option value="${id}" ${id === t.measure ? 'selected' : ''}>${mm.label}</option>`).join('')}
        </select>` : ''}
        <button class="target-remove" type="button" aria-label="Supprimer cet objectif">✕</button>
      </div>
      <div class="target-row__grid">
        ${k.what ? `<label${k.value ? '' : ' class="target-row__wide"'}><span class="form-label">${k.what}</span>
          <input class="form-input target-what" ${t.kind === 'chrono' ? 'list="target-distances"' : ''} placeholder="${esc(k.whatPh)}" value="${esc(t.what)}"></label>` : ''}
        ${k.value ? `<label><span class="form-label">${k.value}</span>
          <input class="form-input target-value" placeholder="${esc(k.valuePh)}" value="${esc(t.value)}"></label>` : ''}
        <label><span class="form-label">D'ici le (sinon l'IA choisit)</span>
          <input class="form-input target-by" type="date" value="${esc(t.by)}"></label>
      </div>
      <label class="target-row__done"><input type="checkbox" class="target-achieved" ${t.achieved ? 'checked' : ''}> Atteint</label>
    </div>`;
}

function readRow(row) {
  return {
    kind:     row.querySelector('.target-kind').value,
    measure:  row.querySelector('.target-measure')?.value || 'time',
    what:     row.querySelector('.target-what')?.value.trim() || '',
    value:    row.querySelector('.target-value')?.value.trim() || '',
    by:       row.querySelector('.target-by').value || '',
    achieved: row.querySelector('.target-achieved').checked,
  };
}

// Lignes complètes seulement ; une ligne vide est ignorée.
function readTargets(list) {
  return [...list.querySelectorAll('.target-row')].map(readRow).filter(isTargetComplete);
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
