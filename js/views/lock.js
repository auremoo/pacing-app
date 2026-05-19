const PASSWORD = '171225';
const SESSION_KEY = 'pacing_auth';

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
        <button type="submit" class="btn btn--primary btn--full">Entrer</button>
      </form>
    </div>
  `;

  const form  = container.querySelector('#lock-form');
  const input = container.querySelector('#lock-input');
  const error = container.querySelector('#lock-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      onUnlock();
    } else {
      error.textContent = 'Mot de passe incorrect.';
      input.value = '';
      input.focus();
      setTimeout(() => { error.textContent = ''; }, 2500);
    }
  });
}
