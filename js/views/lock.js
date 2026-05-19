import { configure } from '../github-api.js';
import { decryptToken } from '../utils/crypto.js';

const PASSWORD = '171225';
const SESSION_KEY = 'pacing_auth';
const PAT_KEY = 'pacing_pat';

export function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function mount(container, onUnlock) {
  container.innerHTML = `
    <div class="lock-screen">
      <div class="lock-screen__logo">🏃</div>
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
    </div>
  `;

  const form  = container.querySelector('#lock-form');
  const input = container.querySelector('#lock-input');
  const error = container.querySelector('#lock-error');
  const btn   = container.querySelector('#lock-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = input.value;

    if (pwd !== PASSWORD) {
      error.textContent = 'Mot de passe incorrect.';
      input.value = '';
      input.focus();
      setTimeout(() => { error.textContent = ''; }, 2500);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Connexion…';
    error.textContent = '';

    try {
      const res = await fetch(`./config.json?_t=${Date.now()}`);
      if (!res.ok) throw new Error('config.json introuvable — ouvre setup.html.');
      const cfg = await res.json();
      if (!cfg.encryptedToken) throw new Error('Token non configuré — ouvre setup.html d\'abord.');
      const token = await decryptToken(cfg.encryptedToken, pwd);
      configure({ token, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch || 'main' });
      sessionStorage.setItem(PAT_KEY, token);
      sessionStorage.setItem(SESSION_KEY, '1');
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
