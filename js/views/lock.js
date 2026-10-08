import { configure } from '../github-api.js';
import { renderMarkdown } from '../utils/markdown.js';
import { findUserByNameAndPassword, saveSession, hasInvite, tokenFromInvite,
         getLastName, rememberName, listUserNames } from '../utils/users.js';
import { addUser } from '../store.js';

export { isAuthenticated } from '../utils/users.js';

export function mount(container, onUnlock) {
  container.innerHTML = `
    <div class="lock-screen">
      <img src="./logo.png" class="lock-screen__logo" alt="Pacing App">
      <div>
        <div class="lock-screen__title">Pacing App</div>
        <div class="lock-screen__subtitle">Mes plans de préparation</div>
      </div>
      <form class="lock-screen__form" id="lock-form" autocomplete="on">
        <!-- Remplacé par une liste des prénoms dès que config.json est lu ;
             reste un champ texte si aucun compte n'a encore de nom. -->
        <div id="lock-name-slot">
          <input type="text" class="input-field" id="lock-name" placeholder="Prénom"
                 autocomplete="username" autocapitalize="words" value="${escAttr(getLastName())}">
        </div>
        <input
          type="password"
          inputmode="numeric"
          pattern="[0-9]*"
          class="input-field"
          id="lock-input"
          name="password"
          placeholder="Mot de passe"
          autocomplete="current-password"
        />
        <div class="lock-screen__error" id="lock-error"></div>
        <button type="submit" class="btn btn--primary btn--full" id="lock-btn">Entrer</button>
        <button type="button" class="lock-screen__switch" id="show-signup">Pas encore de compte ? <strong>Créer un compte</strong></button>
      </form>

      <!-- Inscription : nécessite un code d'invitation, seul moyen d'obtenir le
           token sans être connecté (voir utils/users.js). -->
      <!-- Champs injectés seulement quand on touche « Créer un compte » (SIGNUP_FIELDS) :
           présents d'office, leurs deux « nouveau mot de passe » faisaient prendre
           l'écran de connexion pour une inscription par le trousseau d'Apple, qui
           proposait un mot de passe fort à chaque connexion. -->
      <form class="lock-screen__form" id="signup-form" autocomplete="off" hidden></form>

      <div class="lock-screen__footer">
        Cette application est privée : on y entre avec son prénom et son mot de passe, ou sur invitation.
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

  // Prénom mémorisé : on va droit au mot de passe.
  const focusFirstEmpty = () => {
    const nameField = container.querySelector('#lock-name');
    (nameField.value ? input : nameField).focus();
  };
  focusFirstEmpty();
  fillNameList(container).then(focusFirstEmpty);

  // ── Bascule connexion / inscription ──────────────────────────────
  const signupForm = container.querySelector('#signup-form');
  container.querySelector('#show-signup').addEventListener('click', () => {
    form.hidden = true;
    signupForm.innerHTML = SIGNUP_FIELDS;
    signupForm.hidden = false;
    container.querySelector('#su-name').focus();
  });
  signupForm.addEventListener('click', (e) => {
    if (!e.target.closest('#show-login')) return;
    signupForm.hidden = true;
    signupForm.innerHTML = '';
    form.hidden = false;
    input.focus();
  });

  // ── Inscription avec code d'invitation ───────────────────────────
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sErr = container.querySelector('#signup-error');
    const sBtn = container.querySelector('#signup-btn');
    const name = container.querySelector('#su-name').value.trim();
    const pwd  = container.querySelector('#su-pwd').value;
    const pwd2 = container.querySelector('#su-pwd2').value;
    const code = container.querySelector('#su-code').value;

    sErr.textContent = '';
    if (!name)                    { sErr.textContent = 'Indique ton prénom.'; return; }
    // Chiffres uniquement : l'écran de connexion affiche le pavé numérique.
    if (!/^[0-9]{6,}$/.test(pwd)) { sErr.textContent = 'Le mot de passe doit faire au moins 6 chiffres.'; return; }
    if (pwd !== pwd2)             { sErr.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
    if (!code)                    { sErr.textContent = 'Il faut un code d\'invitation.'; return; }

    sBtn.disabled = true;
    sBtn.textContent = 'Création du compte…';
    try {
      const res = await fetch(`./config.json?_t=${Date.now()}`);
      if (!res.ok) throw new Error('config.json introuvable.');
      const cfg = await res.json();
      if (!hasInvite(cfg)) throw new Error('Les inscriptions ne sont pas ouvertes : demande un code d\'invitation à une personne qui utilise l\'app.');
      const token = await tokenFromInvite(cfg, code);
      if (!token) throw new Error('Code d\'invitation incorrect.');

      const repo = { token, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch || 'main' };
      configure(repo);
      const user = await addUser({ name, password: pwd, token });

      // Connecté tout de suite, sans attendre que GitHub Pages republie
      // config.json : on connaît déjà son token et son dossier.
      configure({ ...repo, dataPath: user.dataPath });
      saveSession(token, user);
      rememberName(user.name);
      onUnlock();
    } catch (err) {
      sErr.textContent = err.message;
      sBtn.disabled = false;
      sBtn.textContent = 'Créer mon compte';
    }
  });

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

      const name  = container.querySelector('#lock-name').value.trim();
      const found = await findUserByNameAndPassword(cfg, name, pwd);
      if (found.error === 'unknown')  throw new Error(`Aucun compte au nom de « ${name} ».`);
      if (found.error === 'password') throw new Error('Mot de passe incorrect.');
      rememberName(found.user.name || name);

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

function escAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Liste déroulante des prénoms. Le dernier prénom utilisé est présélectionné ;
// s'il n'apparaît pas encore (compte tout juste créé, GitHub Pages n'a pas
// republié config.json), on l'ajoute quand même pour ne pas le perdre.
async function fillNameList(container) {
  let names = [];
  try {
    const res = await fetch(`./config.json?_t=${Date.now()}`);
    if (res.ok) names = listUserNames(await res.json());
  } catch { return; }
  if (!names.length) return;   // aucun nom enregistré : on garde le champ texte

  const last = getLastName();
  // Comparaison sans accents ni casse, comme à la connexion : « aurelien »
  // tapé avant la liste désigne « Aurélien », pas un deuxième prénom.
  const norm = n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (last && !names.some(n => norm(n) === norm(last))) names.push(last);
  names.sort((a, b) => a.localeCompare(b, 'fr'));

  const selected = (last && names.find(n => norm(n) === norm(last))) || '';
  container.querySelector('#lock-name-slot').innerHTML = `
    <!-- Identifiant pour le trousseau d'Apple : une liste déroulante n'en est pas
         un, et sans identifiant le formulaire passe pour une création de compte.
         Invisible, tenu à jour avec le prénom choisi. -->
    <input type="text" class="visually-hidden" id="lock-username" name="username" autocomplete="username"
           tabindex="-1" aria-hidden="true" value="${escAttr(selected)}">
    <select class="input-field lock-screen__select" id="lock-name" autocomplete="off" required>
      <option value="" ${selected ? '' : 'selected'} disabled>Choisis ton prénom</option>
      ${names.map(n => `<option value="${escAttr(n)}" ${n === selected ? 'selected' : ''}>${escAttr(n)}</option>`).join('')}
    </select>`;
  const select = container.querySelector('#lock-name');
  select.addEventListener('change', () => { container.querySelector('#lock-username').value = select.value; });
}

const SIGNUP_FIELDS = `
      <input type="text" class="input-field" id="su-name" placeholder="Ton prénom" autocomplete="given-name">
      <input type="password" inputmode="numeric" pattern="[0-9]*" class="input-field" id="su-pwd"
             placeholder="Mot de passe (6 chiffres min.)" autocomplete="new-password">
      <input type="password" inputmode="numeric" pattern="[0-9]*" class="input-field" id="su-pwd2"
             placeholder="Confirme le mot de passe" autocomplete="new-password">
      <input type="password" class="input-field" id="su-code" placeholder="Code d'invitation" autocomplete="off">
      <div class="lock-screen__hint">Le code d'invitation t'est donné par une personne qui utilise déjà l'app.</div>
      <div class="lock-screen__error" id="signup-error"></div>
      <button type="submit" class="btn btn--primary btn--full" id="signup-btn">Créer mon compte</button>
      <button type="button" class="lock-screen__switch" id="show-login">J'ai déjà un compte · <strong>Se connecter</strong></button>`;
