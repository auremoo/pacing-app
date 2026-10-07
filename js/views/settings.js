import { showToast } from '../app.js';
import { getAthleteProfile, saveAthleteProfile, addUser, getUsersConfig, setInviteCode, flushSync } from '../store.js';
import { getSession, clearSession, listUsers, hasInvite } from '../utils/users.js';
import { openOnboarding } from './onboarding.js';
import { SPORTS, GYM_LEVELS, getSports, doesRun, gymLevel } from '../utils/sports.js';
import { renderGlobalTabBar, attachGlobalTabBar } from './global-nav.js';

export function mount(container) {
  render(container);
}

function render(container) {
  const p = getAthleteProfile();
  const sports = getSports(p);
  const ph = placeholders(p);

  container.innerHTML = `
    <div class="nav-bar">
      <span style="width:72px"></span>
      <span class="nav-bar__title">Réglages</span>
      <button class="nav-btn" id="save-btn">Enregistrer</button>
    </div>
    <div id="tab-content" class="scroll-view" style="padding-bottom:calc(var(--tab-bar-height) + var(--safe-bottom))">
    <div class="form-page-body">

      <p class="section-header">Mes sports</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-2)">
        ${SPORTS.map(s => `
        <label class="list-row sport-row">
          <div class="list-row__content">
            <div class="list-row__title">${s.label}</div>
            <div class="list-row__subtitle">${s.hint}</div>
          </div>
          <input type="checkbox" class="ios-switch" data-sport="${s.id}" ${sports.includes(s.id) ? 'checked' : ''}>
        </label>
        ${s.id === 'gym' ? `
        <div class="form-field" id="gym-level-field" ${sports.includes('gym') ? '' : 'hidden'}>
          <label class="form-label" for="f-gym-level">Ton niveau en salle</label>
          <select class="form-input" id="f-gym-level">
            ${GYM_LEVELS.map(l => `<option value="${l.id}" ${l.id === gymLevel(p) ? 'selected' : ''}>${l.label}</option>`).join('')}
          </select>
          <div class="type-picker__hint" id="gym-level-hint" style="padding:var(--space-1) 0 0">${GYM_LEVELS.find(l => l.id === gymLevel(p)).hint}</div>
        </div>` : ''}`).join('')}
        <div class="form-field">
          <label class="form-label">Autres sports</label>
          <input class="form-input" id="f-other-sports" type="text"
            placeholder="Ex : badminton, yoga, natation" value="${esc(p.otherSports || '')}">
        </div>
        <label class="list-row sport-row">
          <div class="list-row__content">
            <div class="list-row__title">Suivre mon poids</div>
            <div class="list-row__subtitle">Pesées et courbe dans Entraînement → Suivi, transmises à l'IA</div>
          </div>
          <input type="checkbox" class="ios-switch" id="f-track-weight" ${p.trackWeight ? 'checked' : ''}>
        </label>
      </div>
      <p class="type-picker__hint" style="padding:0 var(--space-4) var(--space-4)">L'app n'affiche que ce qui sert à tes sports : sans course à pied, pas d'onglet Courses ni de km.</p>

      <p class="section-header">Niveau & Expérience</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Niveau et expérience</label>
          <input class="form-input" id="f-level" type="text"
            placeholder="${ph.level}"
            value="${esc(p.level || '')}">
        </div>
        <div class="form-field">
          <label class="form-label">Meilleures performances récentes</label>
          <textarea class="form-input form-textarea" id="f-perfs" rows="3"
            placeholder="${ph.perfs}">${esc(p.perfs || '')}</textarea>
        </div>
      </div>

      <p class="section-header">Entraînement</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        <div class="form-field">
          <label class="form-label">Volume hebdomadaire actuel</label>
          <input class="form-input" id="f-volume" type="text"
            placeholder="${ph.volume}"
            value="${esc(p.volume || '')}">
        </div>
        <div class="form-field">
          <label class="form-label">Jours disponibles</label>
          <input class="form-input" id="f-days" type="text"
            placeholder="${ph.days}"
            value="${esc(p.days || '')}">
        </div>
        <div class="form-field">
          <label class="form-label">Accès équipements</label>
          <input class="form-input" id="f-equipment" type="text"
            placeholder="${ph.equipment}"
            value="${esc(p.equipment || '')}">
        </div>
        <div class="form-field">
          <label class="form-label">${doesRun(p) ? 'Terrain local' : "Lieu d'entraînement"}</label>
          <input class="form-input" id="f-terrain" type="text"
            placeholder="${ph.terrain}"
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
            placeholder="${ph.goals}"
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
        <div class="list-row" id="invite-btn" style="cursor:pointer">
          <div class="list-row__content">
            <div class="list-row__title" style="color:var(--ios-blue)">Code d'invitation</div>
            <div class="list-row__subtitle" id="invite-status">Permet à quelqu'un de créer son compte depuis l'écran de connexion</div>
          </div>
        </div>
        <div id="invite-form" hidden style="padding:var(--space-3) var(--space-4)">
          <div class="form-field" id="f-invite-name-field" hidden>
            <label class="form-label">Ton prénom</label>
            <input class="form-input" id="f-invite-name" type="text" placeholder="Pour te distinguer des personnes invitées">
          </div>
          <div class="form-field">
            <label class="form-label">Nouveau code (6 caractères minimum)</label>
            <input class="form-input" id="f-invite-code" type="text" autocomplete="off" autocapitalize="off">
          </div>
          <div class="type-picker__hint" style="padding:0 0 var(--space-2)">Donne-le aux personnes à inviter. Il remplace l'ancien code, qui cesse de fonctionner.</div>
          <div id="invite-error" style="color:var(--ios-red);font-size:14px;margin-bottom:var(--space-2)"></div>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
            <button class="btn btn--primary" id="invite-save" style="flex:1">Enregistrer</button>
            <button class="btn btn--secondary" id="invite-cancel" style="flex:1">Annuler</button>
          </div>
          <button class="btn btn--ghost btn--full" id="invite-close" style="margin-top:var(--space-2);color:var(--ios-red)" hidden>Fermer les inscriptions</button>
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

  // Les interrupteurs s'enregistrent tout de suite, comme sur iOS : le menu du
  // bas (onglet Courses) suit sans passer par « Enregistrer ».
  const levelField = container.querySelector('#gym-level-field');
  const levelSelect = container.querySelector('#f-gym-level');
  levelSelect.addEventListener('change', () => {
    container.querySelector('#gym-level-hint').textContent = GYM_LEVELS.find(l => l.id === levelSelect.value).hint;
  });
  container.querySelectorAll('.ios-switch, #f-gym-level').forEach(sw => sw.addEventListener('change', async () => {
    const updates = {
      sports:      [...container.querySelectorAll('[data-sport]')].filter(c => c.checked).map(c => c.dataset.sport),
      trackWeight: container.querySelector('#f-track-weight').checked,
      gymLevel:    levelSelect.value,
    };
    levelField.hidden = !updates.sports.includes('gym');
    try {
      await saveAthleteProfile({ ...getAthleteProfile(), ...updates });
      const bar = container.querySelector('.global-tab-bar');
      if (bar) { bar.outerHTML = renderGlobalTabBar('settings'); attachGlobalTabBar(container); }
      window.dispatchEvent(new CustomEvent('pacing:profile-changed'));
    } catch (err) {
      if (sw.type === 'checkbox') sw.checked = !sw.checked;
      showToast('Erreur : ' + err.message, 'error');
    }
  }));

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
      sports:      [...container.querySelectorAll('[data-sport]')].filter(c => c.checked).map(c => c.dataset.sport),
      otherSports: container.querySelector('#f-other-sports').value.trim(),
      trackWeight: container.querySelector('#f-track-weight').checked,
      gymLevel:    container.querySelector('#f-gym-level').value,
    };
    try {
      await saveAthleteProfile({ ...getAthleteProfile(), ...profile });
      showToast('Profil enregistré', 'success');
      // Les sports changent le menu, les exemples des champs et la barre latérale.
      render(container);
      window.dispatchEvent(new CustomEvent('pacing:profile-changed'));
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// Exemples des champs selon les sports : une personne qui ne fait que de la
// salle ne doit pas lire « 25-35 km/semaine ».
function placeholders(p) {
  const run = doesRun(p);
  const gym = getSports(p).includes('gym');
  if (gym && !run) return {
    level: 'Ex : débutante, salle 2x/semaine depuis 6 mois',
    perfs: 'Ex : squat 50 kg × 8 | 20 min de vélo elliptique sans pause',
    volume: 'Ex : 3 séances de 1h par semaine',
    days: 'Ex : lundi, mercredi, samedi matin',
    equipment: 'Ex : salle complète (machines, haltères, tapis), cours collectifs',
    terrain: 'Ex : Basic-Fit à 10 min, parfois à la maison',
    goals: 'Ex : perdre 4 kg, prendre du muscle sur le haut du corps',
  };
  return {
    level: run && gym ? 'Ex : intermédiaire, 2 ans de course + salle 1x/semaine' : 'Ex : intermédiaire, 2 ans de course régulière',
    perfs: 'Ex : 2h05\'22&quot; semi des Alpes 2026-05-17 | 51\'10 sur 10K',
    volume: run && gym ? 'Ex : 25 km/semaine en 3 sorties + 1 séance de muscu' : 'Ex : 25-35 km/semaine, 3 séances',
    days: 'Ex : mardi, jeudi, dimanche + 1-2 cross-training',
    equipment: 'Ex : piste à 5 km, vélo, pas de rameur',
    terrain: 'Ex : Marseille — massif de l\'Étoile accessible',
    goals: 'Ex : perdre 3 kg, améliorer VMA',
  };
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

  wireInvite(container);

  container.querySelector('#replay-onboarding-btn').addEventListener('click', () => {
    openOnboarding({ name: getSession().name });
  });

  container.querySelector('#logout-btn').addEventListener('click', async () => {
    try { await flushSync(); } catch { /* on se déconnecte quand même */ }
    clearSession();
    location.hash = '#/';
    location.reload();
  });
}

// ── Code d'invitation ─────────────────────────────────────────────

function wireInvite(container) {
  const form   = container.querySelector('#invite-form');
  const status = container.querySelector('#invite-status');
  const error  = container.querySelector('#invite-error');
  const save   = container.querySelector('#invite-save');
  const closeB = container.querySelector('#invite-close');

  const refresh = async () => {
    try {
      const cfg = await getUsersConfig();
      const active = hasInvite(cfg);
      status.textContent = active
        ? `Actif depuis le ${new Date(cfg.invite.createdAt).toLocaleDateString('fr-FR')} — les inscriptions sont ouvertes`
        : 'Aucun — personne ne peut créer de compte depuis l\'écran de connexion';
      closeB.hidden = !active;
      const users = listUsers(cfg);
      container.querySelector('#f-invite-name-field').hidden = !(users.length === 1 && !users[0].name);
    } catch { /* l'état reste celui affiché */ }
  };
  refresh();

  container.querySelector('#invite-btn').addEventListener('click', () => { form.hidden = false; });
  container.querySelector('#invite-cancel').addEventListener('click', () => { form.hidden = true; error.textContent = ''; });

  const apply = async (code, btn, label) => {
    error.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    try {
      await setInviteCode({ code, currentName: container.querySelector('#f-invite-name').value.trim() });
      form.hidden = true;
      container.querySelector('#f-invite-code').value = '';
      // config.json est servi par GitHub Pages : le code n'est utilisable
      // qu'une fois le site republié.
      showToast(code ? 'Code enregistré — utilisable d\'ici une à deux minutes' : 'Inscriptions fermées', 'success');
      await refresh();
    } catch (err) {
      error.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  };

  save.addEventListener('click', () => {
    const code = container.querySelector('#f-invite-code').value.trim();
    if (code.length < 6) { error.textContent = 'Le code doit faire au moins 6 caractères.'; return; }
    apply(code, save, 'Enregistrer');
  });
  closeB.addEventListener('click', () => apply(null, closeB, 'Fermer les inscriptions'));
}
