import { navigate, showToast } from '../app.js';
import { getAthleteProfile, saveAthleteProfile } from '../store.js';

export function mount(container) {
  render(container);
}

function render(container) {
  const p = getAthleteProfile();

  container.innerHTML = `
    <div class="nav-bar">
      <button class="nav-btn" id="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        Retour
      </button>
      <span class="nav-bar__title">Profil Athlète</span>
      <button class="nav-btn" id="save-btn">Enregistrer</button>
    </div>
    <div class="scroll-view">
    <div class="form-page-body">

      <p class="section-header">Niveau & Expérience</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Niveau et expérience</label>
          <input class="form-input" id="f-level" type="text"
            placeholder="Ex : intermédiaire, 2 ans de course régulière"
            value="${esc(p.level || '')}">
        </div>
        <div class="form-field">
          <label class="form-label">Meilleures performances récentes</label>
          <textarea class="form-input form-textarea" id="f-perfs" rows="3"
            placeholder="Ex : 2h05'22&quot; semi des Alpes 2026-05-17 | 51'10 sur 10K">${esc(p.perfs || '')}</textarea>
        </div>
      </div>

      <p class="section-header">Entraînement</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Volume hebdomadaire actuel</label>
          <input class="form-input" id="f-volume" type="text"
            placeholder="Ex : 25-35 km/semaine, 3 séances"
            value="${esc(p.volume || '')}">
        </div>
        <div class="form-field">
          <label class="form-label">Jours disponibles</label>
          <input class="form-input" id="f-days" type="text"
            placeholder="Ex : mardi, jeudi, dimanche + 1-2 cross-training"
            value="${esc(p.days || '')}">
        </div>
        <div class="form-field">
          <label class="form-label">Accès équipements</label>
          <input class="form-input" id="f-equipment" type="text"
            placeholder="Ex : piste à 5 km, vélo, pas de rameur"
            value="${esc(p.equipment || '')}">
        </div>
        <div class="form-field">
          <label class="form-label">Terrain local</label>
          <input class="form-input" id="f-terrain" type="text"
            placeholder="Ex : Marseille — massif de l'Étoile accessible"
            value="${esc(p.terrain || '')}">
        </div>
      </div>

      <p class="section-header">Santé & Objectifs</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Pathologies / points de vigilance</label>
          <textarea class="form-input form-textarea" id="f-pathologies" rows="2"
            placeholder="Ex : syndrome essuie-glace droit, arthrites métatarses M1">${esc(p.pathologies || '')}</textarea>
        </div>
        <div class="form-field">
          <label class="form-label">Objectifs secondaires</label>
          <input class="form-input" id="f-goals" type="text"
            placeholder="Ex : perdre 3 kg, améliorer VMA"
            value="${esc(p.goals || '')}">
        </div>
      </div>

      <p class="section-header">Configuration</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <a class="list-row" href="./setup.html" target="_blank">
          <div class="list-row__content">
            <div class="list-row__title">Mettre à jour le token GitHub</div>
            <div class="list-row__subtitle">Ouvre l'outil de configuration</div>
          </div>
          <svg style="width:16px;height:16px;flex-shrink:0;color:var(--text-tertiary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </a>
      </div>

      <div style="height:var(--space-8)"></div>

    </div>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => navigate('/'));

  container.querySelector('#save-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#save-btn');
    btn.disabled = true;
    const profile = {
      level:       container.querySelector('#f-level').value.trim(),
      perfs:       container.querySelector('#f-perfs').value.trim(),
      volume:      container.querySelector('#f-volume').value.trim(),
      days:        container.querySelector('#f-days').value.trim(),
      equipment:   container.querySelector('#f-equipment').value.trim(),
      terrain:     container.querySelector('#f-terrain').value.trim(),
      pathologies: container.querySelector('#f-pathologies').value.trim(),
      goals:       container.querySelector('#f-goals').value.trim(),
    };
    try {
      await saveAthleteProfile(profile);
      showToast('Profil enregistré', 'success');
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
