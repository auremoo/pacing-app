import { navigate, showToast } from '../app.js';
import { createEvent } from '../store.js';

export function mount(container) {
  const planStart = suggestPlanStart();

  container.innerHTML = `
    <div class="nav-bar">
      <button class="nav-btn" id="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        Retour
      </button>
      <span class="nav-bar__title">Nouvel événement</span>
      <button class="nav-btn" id="create-btn">Créer</button>
    </div>
    <div class="scroll-view">
    <div class="form-page-body">

      <p class="section-header">Course</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Nom de l'événement <span style="color:var(--ios-red)">*</span></label>
          <input class="form-input" id="f-name" type="text"
            placeholder="Ex : Run in Lyon 2027">
        </div>
        <div class="form-field">
          <label class="form-label">Date de course <span style="color:var(--ios-red)">*</span></label>
          <input class="form-input" id="f-date" type="date">
        </div>
        <div class="form-field">
          <label class="form-label">Lieu</label>
          <input class="form-input" id="f-location" type="text"
            placeholder="Ex : Lyon, France">
        </div>
      </div>

      <p class="section-header">Distance & Dénivelé</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Type de distance <span style="color:var(--ios-red)">*</span></label>
          <select class="form-input" id="f-label">
            <option value="">— Choisir —</option>
            <option value="10K">10K route</option>
            <option value="Semi-marathon">Semi-marathon</option>
            <option value="Marathon">Marathon</option>
            <option value="Trail 20K">Trail 20K</option>
            <option value="Trail 30K">Trail 30K</option>
            <option value="Trail 50K">Trail 50K</option>
            <option value="Trail 80K">Trail 80K</option>
            <option value="Ultra 100K+">Ultra 100K+</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Distance exacte (km) <span style="color:var(--ios-red)">*</span></label>
          <input class="form-input" id="f-distance" type="number" min="1" max="500" step="0.001"
            placeholder="Ex : 21.0975">
        </div>
        <div class="form-field">
          <label class="form-label">Dénivelé positif (m D+)</label>
          <input class="form-input" id="f-elevation" type="number" min="0" step="1"
            placeholder="0 si plat" value="0">
        </div>
        <div class="form-field">
          <label class="form-label">Description du parcours</label>
          <textarea class="form-input form-textarea" id="f-course" rows="2"
            placeholder="Ex : Vallonné léger, montée notable km 14-17"></textarea>
        </div>
      </div>

      <p class="section-header">Objectifs</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Objectif temps</label>
          <input class="form-input" id="f-objective" type="text"
            placeholder="Ex : 1h50 | Terminer | Améliorer de 10 min">
        </div>
        <div class="form-field">
          <label class="form-label">Objectif réaliste (fourchette)</label>
          <input class="form-input" id="f-realistic" type="text"
            placeholder="Ex : 1h51–1h53">
        </div>
      </div>

      <p class="section-header">Plan d'entraînement</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Début du plan (lundi)</label>
          <input class="form-input" id="f-start" type="date" value="${planStart}">
        </div>
        <div class="form-field">
          <label class="form-label">Durée du plan (semaines)</label>
          <input class="form-input" id="f-weeks" type="number" min="4" max="52" step="1"
            placeholder="Ex : 20">
        </div>
      </div>

      <div id="form-error" style="padding:0 var(--space-4);color:var(--ios-red);font-size:14px;display:none"></div>
      <div style="padding:var(--space-4)">
        <button class="btn btn--primary btn--full" id="create-btn-bottom">Créer l'événement</button>
      </div>
      <div style="height:var(--space-8)"></div>

    </div>
    </div>
  `;

  // Auto-fill weeks when date changes
  const dateInput = container.querySelector('#f-date');
  const weeksInput = container.querySelector('#f-weeks');
  const startInput = container.querySelector('#f-start');
  dateInput.addEventListener('change', () => autoFillWeeks(dateInput, startInput, weeksInput));
  startInput.addEventListener('change', () => autoFillWeeks(dateInput, startInput, weeksInput));

  container.querySelector('#back-btn').addEventListener('click', () => navigate('/'));

  const handleCreate = async () => {
    const error = container.querySelector('#form-error');
    error.style.display = 'none';

    const name     = container.querySelector('#f-name').value.trim();
    const raceDate = container.querySelector('#f-date').value;
    const label    = container.querySelector('#f-label').value;
    const distKm   = container.querySelector('#f-distance').value;

    if (!name)     { showError(error, 'Le nom est obligatoire.'); return; }
    if (!raceDate) { showError(error, 'La date de course est obligatoire.'); return; }
    if (!label)    { showError(error, 'Le type de distance est obligatoire.'); return; }
    if (!distKm)   { showError(error, 'La distance est obligatoire.'); return; }

    const slug = toSlug(name);

    const btn = container.querySelector('#create-btn-bottom');
    btn.disabled = true;
    btn.textContent = 'Création…';

    try {
      await createEvent({
        slug,
        name,
        raceDate,
        distanceLabel: label,
        distanceKm: parseFloat(distKm),
        elevationGainM: parseInt(container.querySelector('#f-elevation').value) || 0,
        courseDescription: container.querySelector('#f-course').value.trim(),
        location: container.querySelector('#f-location').value.trim(),
        objective: container.querySelector('#f-objective').value.trim(),
        objectiveRealistic: container.querySelector('#f-realistic').value.trim(),
        planStart: container.querySelector('#f-start').value,
        planWeeks: parseInt(container.querySelector('#f-weeks').value) || 0,
      });
      showToast('Événement créé !', 'success');
      navigate(`/event/${slug}/versions`);
    } catch (err) {
      showError(error, 'Erreur : ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Créer l\'événement';
    }
  };

  container.querySelector('#create-btn').addEventListener('click', handleCreate);
  container.querySelector('#create-btn-bottom').addEventListener('click', handleCreate);
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function suggestPlanStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const offset = day === 1 ? 0 : (8 - day) % 7;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function autoFillWeeks(dateInput, startInput, weeksInput) {
  const race  = dateInput.value;
  const start = startInput.value;
  if (!race || !start) return;
  const diffDays = (new Date(race) - new Date(start)) / (1000 * 60 * 60 * 24);
  const weeks = Math.max(1, Math.ceil(diffDays / 7));
  weeksInput.value = weeks;
}

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
