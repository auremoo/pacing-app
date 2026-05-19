import { navigate } from '../app.js';

export function mount(container) {
  container.innerHTML = `
    <div class="nav-bar">
      <button class="nav-btn" id="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        Retour
      </button>
      <span class="nav-bar__title">À propos</span>
      <span style="width:72px"></span>
    </div>
    <div class="scroll-view" style="padding-top:var(--space-4)">
      <p class="section-header">Application</p>
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

      <p class="section-header" style="margin-top:var(--space-6)">Configuration</p>
      <div class="card-group" style="margin:0 var(--space-4)">
        <a class="list-row" href="./setup.html" target="_blank" style="text-decoration:none">
          <div class="list-row__content">
            <div class="list-row__title">Mettre à jour le token GitHub</div>
            <div class="list-row__subtitle">Ouvre l'outil de configuration</div>
          </div>
          <svg style="width:16px;height:16px;flex-shrink:0;color:var(--text-tertiary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </a>
      </div>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => navigate('/'));
}
