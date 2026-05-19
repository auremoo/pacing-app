import { loadConfig, saveConfig, testConnection, configure } from '../github-api.js';
import { navigate, showToast } from '../app.js';

export function mount(container) {
  const cfg = loadConfig() || {};

  container.innerHTML = `
    <div class="nav-bar">
      <button class="nav-btn" id="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        Retour
      </button>
      <span class="nav-bar__title">Réglages</span>
      <span style="width:72px"></span>
    </div>
    <div class="scroll-view" style="padding-top:var(--space-4)">
      <p class="section-header">Connexion GitHub</p>
      <div class="settings-form">
        <div class="form-group">
          <label class="form-label" for="gh-owner">Propriétaire du repo</label>
          <input class="input-field" id="gh-owner" type="text" value="${cfg.owner || ''}" placeholder="votre-username" autocomplete="off" autocorrect="off" spellcheck="false"/>
        </div>
        <div class="form-group">
          <label class="form-label" for="gh-repo">Nom du repo</label>
          <input class="input-field" id="gh-repo" type="text" value="${cfg.repo || ''}" placeholder="pacing-app" autocomplete="off" autocorrect="off" spellcheck="false"/>
        </div>
        <div class="form-group">
          <label class="form-label" for="gh-branch">Branche</label>
          <input class="input-field" id="gh-branch" type="text" value="${cfg.branch || 'main'}" placeholder="main" autocomplete="off"/>
        </div>
        <div class="form-group">
          <label class="form-label" for="gh-token">Personal Access Token (PAT)</label>
          <input class="input-field" id="gh-token" type="password" value="${cfg.token || ''}" placeholder="github_pat_..." autocomplete="off"/>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:6px">
            Fine-grained PAT avec permission <strong>Contents: Read and write</strong> sur ce repo uniquement.
          </p>
        </div>
        <button class="btn btn--secondary btn--full" id="test-btn">Tester la connexion</button>
        <div class="connection-status" id="conn-status" style="justify-content:center;margin-top:var(--space-2)"></div>
        <button class="btn btn--primary btn--full" id="save-btn" style="margin-top:var(--space-3)">Enregistrer</button>
      </div>

      <p class="section-header" style="margin-top:var(--space-6)">À propos</p>
      <div class="card-group" style="margin:0 var(--space-4)">
        <div class="list-row" style="cursor:default">
          <div class="list-row__content">
            <div class="list-row__title">Pacing App</div>
            <div class="list-row__subtitle">Plans de préparation sportive</div>
          </div>
        </div>
        <div class="list-row" style="cursor:default">
          <div class="list-row__content">
            <div class="list-row__title">Données</div>
            <div class="list-row__subtitle">Stockées dans votre repo GitHub</div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => navigate('/'));
  container.querySelector('#save-btn').addEventListener('click', save);
  container.querySelector('#test-btn').addEventListener('click', test);

  function getFormValues() {
    return {
      owner:  container.querySelector('#gh-owner').value.trim(),
      repo:   container.querySelector('#gh-repo').value.trim(),
      branch: container.querySelector('#gh-branch').value.trim() || 'main',
      token:  container.querySelector('#gh-token').value.trim()
    };
  }

  function save() {
    const cfg = getFormValues();
    if (!cfg.owner || !cfg.repo || !cfg.token) {
      showToast('Remplis tous les champs obligatoires.', 'error');
      return;
    }
    saveConfig(cfg);
    configure(cfg);
    showToast('Réglages enregistrés', 'success');
  }

  async function test() {
    const cfg = getFormValues();
    if (!cfg.token || !cfg.owner || !cfg.repo) {
      showToast('Remplis tous les champs d\'abord.', 'error');
      return;
    }
    saveConfig(cfg);
    configure(cfg);

    const status = container.querySelector('#conn-status');
    status.innerHTML = `<span class="connection-dot connection-dot--pending"></span> Test en cours…`;

    try {
      const info = await testConnection();
      status.innerHTML = `<span class="connection-dot connection-dot--ok"></span> Connecté à <strong>${info.repoName}</strong>`;
    } catch (err) {
      status.innerHTML = `<span class="connection-dot connection-dot--error"></span> Erreur : ${err.message}`;
    }
  }
}
