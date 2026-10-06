import { configure } from '../github-api.js';
import { renderMarkdown } from '../utils/markdown.js';
import { findUserByPassword, saveSession } from '../utils/users.js';

export { isAuthenticated } from '../utils/users.js';

export function mount(container, onUnlock) {
  container.innerHTML = `
    <div class="lock-screen">
      <img src="./logo.png" class="lock-screen__logo" alt="Pacing App">
      <div>
        <div class="lock-screen__title">Pacing App</div>
        <div class="lock-screen__subtitle">Mes plans de préparation</div>
      </div>
      <form class="lock-screen__form" id="lock-form" autocomplete="off">
        <input
          type="password"
          inputmode="numeric"
          pattern="[0-9]*"
          class="input-field"
          id="lock-input"
          placeholder="Mot de passe"
          autofocus
          autocomplete="current-password"
        />
        <div class="lock-screen__error" id="lock-error"></div>
        <button type="submit" class="btn btn--primary btn--full" id="lock-btn">Entrer</button>
      </form>
      <div class="lock-screen__footer">
        Cette application est personnelle et n'est pas ouverte au public.<br>
        Une version multi-utilisateurs est en cours de développement.
        <a href="#" class="lock-screen__readme-link" id="lock-readme-link">En savoir plus →</a>
      </div>
    </div>
    <div class="readme-modal" id="readme-modal" hidden>
      <div class="readme-modal__overlay" id="readme-overlay"></div>
      <div class="readme-modal__panel">
        <div class="readme-modal__header">
          <span class="readme-modal__title">Documentation</span>
          <button class="readme-modal__close" id="readme-close">✕</button>
        </div>
        <div class="readme-modal__body markdown-body" id="readme-body">Chargement…</div>
      </div>
    </div>
  `;

  const form         = container.querySelector('#lock-form');
  const input        = container.querySelector('#lock-input');
  const error        = container.querySelector('#lock-error');
  const btn          = container.querySelector('#lock-btn');
  const readmeLink   = container.querySelector('#lock-readme-link');
  const readmeModal  = container.querySelector('#readme-modal');
  const readmeBody   = container.querySelector('#readme-body');
  const readmeClose  = container.querySelector('#readme-close');
  const readmeOverlay = container.querySelector('#readme-overlay');

  let readmeLoaded = false;

  async function openReadme(e) {
    e.preventDefault();
    readmeModal.hidden = false;
    if (!readmeLoaded) {
      try {
        const res = await fetch(`./README.md?_t=${Date.now()}`);
        if (!res.ok) throw new Error('README introuvable');
        const md = await res.text();
        readmeBody.innerHTML = renderMarkdown(md);
        readmeLoaded = true;
      } catch {
        readmeBody.textContent = 'Impossible de charger la documentation.';
      }
    }
  }

  function closeReadme() {
    readmeModal.hidden = true;
  }

  readmeLink.addEventListener('click', openReadme);
  readmeClose.addEventListener('click', closeReadme);
  readmeOverlay.addEventListener('click', closeReadme);

  // Le mot de passe désigne l'utilisateur : chaque entrée de config.json porte
  // le token chiffré par le mot de passe de son propriétaire.
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = input.value;

    btn.disabled = true;
    btn.textContent = 'Connexion…';
    error.textContent = '';

    try {
      const res = await fetch(`./config.json?_t=${Date.now()}`);
      if (!res.ok) throw new Error('config.json introuvable — ouvre setup.html.');
      const cfg = await res.json();
      if (!cfg.encryptedToken && !cfg.users?.length) throw new Error('Token non configuré — ouvre setup.html d\'abord.');

      const found = await findUserByPassword(cfg, pwd);
      if (!found) throw new Error('Mot de passe incorrect.');

      configure({ token: found.token, owner: cfg.owner, repo: cfg.repo,
                  branch: cfg.branch || 'main', dataPath: found.user.dataPath });
      saveSession(found.token, found.user);
      onUnlock();
    } catch (err) {
      error.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Entrer';
      input.value = '';
      input.focus();
    }
  });
}
