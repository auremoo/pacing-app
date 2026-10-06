import { showToast } from '../app.js';
import { getAthleteProfile, saveAthleteProfile, addUser, getUsersConfig } from '../store.js';
import { getSession, clearSession, listUsers } from '../utils/users.js';
import { openOnboarding } from './onboarding.js';
import { renderGlobalTabBar, attachGlobalTabBar } from './global-nav.js';

export function mount(container) {
  render(container);
}

function render(container) {
  const p = getAthleteProfile();

  container.innerHTML = `
    <div class="nav-bar">
      <span style="width:72px"></span>
      <span class="nav-bar__title">Réglages</span>
      <button class="nav-btn" id="save-btn">Enregistrer</button>
    </div>
    <div id="tab-content" class="scroll-view" style="padding-bottom:calc(var(--tab-bar-height) + var(--safe-bottom))">
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

      <p class="section-header">Compte</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        ${getSession().name ? `
        <div class="list-row" style="cursor:default">
          <div class="list-row__content">
            <div class="list-row__subtitle">Connecté</div>
            <div class="list-row__title">${esc(getSession().name)}</div>
          </div>
        </div>` : ''}
        <div class="list-row" id="add-user-btn" style="cursor:pointer">
          <div class="list-row__content">
            <div class="list-row__title" style="color:var(--ios-blue)">Ajouter un utilisateur</div>
            <div class="list-row__subtitle">Ses propres courses, plan et profil, avec son mot de passe</div>
          </div>
        </div>
        <div id="add-user-form" hidden style="padding:var(--space-3) var(--space-4)">
          <div class="form-field" id="f-current-name-field" hidden>
            <label class="form-label">Ton prénom</label>
            <input class="form-input" id="f-current-name" type="text" placeholder="Pour te distinguer du nouvel utilisateur">
          </div>
          <div class="form-field">
            <label class="form-label">Prénom du nouvel utilisateur</label>
            <input class="form-input" id="f-new-name" type="text" autocomplete="off">
          </div>
          <div class="form-field">
            <label class="form-label">Son mot de passe (6 chiffres minimum)</label>
            <input class="form-input" id="f-new-pwd" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="new-password">
          </div>
          <div class="form-field">
            <label class="form-label">Confirmer le mot de passe</label>
            <input class="form-input" id="f-new-pwd2" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="new-password">
          </div>
          <div id="add-user-error" style="color:var(--ios-red);font-size:14px;margin-bottom:var(--space-2)"></div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn--primary" id="add-user-save" style="flex:1">Créer</button>
            <button class="btn btn--secondary" id="add-user-cancel" style="flex:1">Annuler</button>
          </div>
        </div>
        <div class="list-row" id="replay-onboarding-btn" style="cursor:pointer">
          <div class="list-row__content">
            <div class="list-row__title" style="color:var(--ios-blue)">Revoir le tutoriel</div>
            <div class="list-row__subtitle">Comment mettre en place profil, plans et courses</div>
          </div>
        </div>
        <div class="list-row" id="logout-btn" style="cursor:pointer">
          <div class="list-row__content">
            <div class="list-row__title" style="color:var(--ios-red)">Se déconnecter</div>
          </div>
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
    ${renderGlobalTabBar('settings')}
  `;

  attachGlobalTabBar(container);

  wireAccount(container);

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

// ── Compte : ajout d'utilisateur, déconnexion ─────────────────────

function wireAccount(container) {
  const form  = container.querySelector('#add-user-form');
  const error = container.querySelector('#add-user-error');
  const save  = container.querySelector('#add-user-save');

  container.querySelector('#add-user-btn').addEventListener('click', async () => {
    form.hidden = false;
    // Premier ajout : la config ne nomme pas encore l'utilisateur actuel.
    try {
      const cfg = await getUsersConfig();
      const users = listUsers(cfg);
      container.querySelector('#f-current-name-field').hidden = !(users.length === 1 && !users[0].name);
    } catch { /* le champ reste masqué, « Utilisateur 1 » par défaut */ }
  });

  container.querySelector('#add-user-cancel').addEventListener('click', () => {
    form.hidden = true;
    error.textContent = '';
  });

  save.addEventListener('click', async () => {
    const name  = container.querySelector('#f-new-name').value.trim();
    const pwd   = container.querySelector('#f-new-pwd').value;
    const pwd2  = container.querySelector('#f-new-pwd2').value;
    const currentName = container.querySelector('#f-current-name').value.trim();

    error.textContent = '';
    if (!name)                  { error.textContent = 'Indique un prénom.'; return; }
    // Chiffres uniquement : l'écran de connexion affiche le pavé numérique.
    if (!/^[0-9]{6,}$/.test(pwd)) { error.textContent = 'Le mot de passe doit faire au moins 6 chiffres.'; return; }
    if (pwd !== pwd2)           { error.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }

    save.disabled = true;
    save.textContent = 'Création…';
    try {
      await addUser({ name, password: pwd, currentName });
      form.hidden = true;
      ['#f-new-name', '#f-new-pwd', '#f-new-pwd2', '#f-current-name'].forEach(id => { container.querySelector(id).value = ''; });
      // config.json est servi par GitHub Pages : la nouvelle entrée n'y est
      // visible qu'une fois le site redéployé.
      showToast(`${name} ajouté — connexion possible d'ici une à deux minutes`, 'success');
    } catch (err) {
      error.textContent = err.message;
    } finally {
      save.disabled = false;
      save.textContent = 'Créer';
    }
  });

  container.querySelector('#replay-onboarding-btn').addEventListener('click', () => {
    openOnboarding({ name: getSession().name });
  });

  container.querySelector('#logout-btn').addEventListener('click', () => {
    clearSession();
    location.hash = '#/';
    location.reload();
  });
}
