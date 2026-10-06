// Tutoriel de prise en main : une suite de pages qu'on fait défiler du doigt,
// comme l'accueil de beaucoup d'apps. Il explique dans l'ordre ce qu'il faut
// mettre en place — profil, entraînement général, première course — puis
// l'usage au quotidien.
//
// Les pages s'appuient sur un défilement horizontal natif (scroll-snap) : le
// glissement au doigt marche sans code de geste, et les boutons, les points et
// les flèches du clavier ne font que piloter ce même défilement.
//
// Les illustrations reprennent les vraies classes de l'app (pastilles de type,
// coches) pour que ce qu'on voit ici ressemble à ce qu'on trouvera ensuite.

import { navigate } from '../app.js';

const STEP = (n, html) => `<li class="onb-steps__item"><span class="onb-steps__num">${n}</span><span>${html}</span></li>`;
const FIELD = (label, example) => `<div class="onb-field onb-field--row"><span>${label}</span><em>${example}</em></div>`;
const GROUP = (label, items) => `<div class="onb-group"><span class="onb-group__label">${label}</span><span>${items}</span></div>`;
const PATH = parts => `<div class="onb-path">${parts.map(p => `<span>${p}</span>`).join('<span class="onb-path__sep">›</span>')}</div>`;

function pages(name) {
  return [
    {
      icon: '👋',
      title: name ? `Bienvenue, ${esc(name)}` : 'Bienvenue',
      body: `
        <p>Pacing App suit tes plans d'entraînement et de préparation de course.</p>
        <p>Les plans sont écrits par <strong>Claude</strong> à partir de ton profil. Toi, tu coches au jour le jour ce que tu fais, et l'app garde l'historique pour ajuster la suite.</p>
        <p class="onb-muted">Quelques pages pour tout mettre en place — glisse ou touche «&nbsp;Suivant&nbsp;».</p>`,
    },
    {
      icon: '🏃',
      title: '1. Ton profil',
      body: `
        ${PATH(['Réglages'])}
        <p>Commence par là : Claude le lit pour adapter <strong>tous</strong> tes plans.</p>
        <div class="onb-card onb-card--compact">
          ${FIELD('Niveau et expérience', 'intermédiaire, 2 ans de course')}
          ${FIELD('Performances récentes', '10 km en 55 min')}
          ${FIELD('Volume actuel', '25 km/sem, 3 séances')}
          ${FIELD('Jours disponibles', 'mardi, jeudi, dimanche')}
          ${FIELD('Équipements', 'piste, vélo')}
          ${FIELD('Terrain local', 'parc plat, collines à 10 min')}
          ${FIELD('Pathologies', 'genou gauche fragile')}
          ${FIELD('Objectifs secondaires', 'perdre 3 kg')}
        </div>
        <p class="onb-muted">Plus c'est précis, mieux c'est. «&nbsp;Enregistrer&nbsp;» est en haut à droite.</p>`,
    },
    {
      icon: '🔁',
      title: '2. Ton entraînement général',
      body: `
        ${PATH(['Entraînement', 'Contexte'])}
        <p>Ton plan de tous les jours, quand tu ne prépares pas de course précise.</p>
        <ol class="onb-steps">
          ${STEP(1, '<strong>Activités récurrentes</strong> : ce que tu fais déjà (badminton le lundi, vélo…)')}
          ${STEP(2, '<strong>Ce que tu veux travailler</strong> : endurance, vitesse, reprise…')}
          ${STEP(3, '<strong>Début et durée</strong> du bloc, puis «&nbsp;Enregistrer&nbsp;»')}
        </ol>`,
    },
    {
      icon: '✦',
      title: '3. Faire écrire le plan',
      body: `
        ${PATH(['Entraînement', 'Versions'])}
        <ol class="onb-steps">
          ${STEP(1, 'Touche <strong>✦ Générer le prompt de plan initial</strong>, puis <strong>Copier le prompt</strong>')}
          ${STEP(2, 'Colle-le dans une conversation avec <strong>Claude</strong>')}
          ${STEP(3, 'Enregistre le fichier <strong>.md</strong> qu\'il te renvoie')}
          ${STEP(4, 'Reviens ici : <strong>+ Importer une nouvelle version</strong>')}
        </ol>
        <div class="onb-callout">
          <strong>Remplis d'abord, génère ensuite.</strong>
          Le prompt est construit quand tu touches le bouton : un champ vide y devient «&nbsp;[à&nbsp;compléter]&nbsp;» et Claude travaille avec des trous. Modifié un champ après coup ? Regénère le prompt.
        </div>`,
    },
    {
      icon: '🏁',
      title: '4. Créer une course',
      body: `
        ${PATH(['Courses', '+ Créer un événement'])}
        <p>La fiche de la course, que Claude lira en plus de ton profil :</p>
        <div class="onb-groups">
          ${GROUP('La course', 'nom, date, lieu, type et distance exacte, dénivelé, description du parcours')}
          ${GROUP('Tes objectifs', 'objectif temps et fourchette réaliste')}
          ${GROUP('Le plan', 'date de début (un lundi) et durée en semaines')}
        </div>
        <p class="onb-muted">La description du parcours («&nbsp;montée au km 14&nbsp;») et la fourchette réaliste aident Claude à doser l'effort : ne les saute pas.</p>`,
    },
    {
      icon: '🗺️',
      title: '5. Son plan et son parcours',
      body: `
        ${PATH(['La course', 'Versions'])}
        <p>Même principe que pour l'entraînement : <strong>✦ Générer le prompt de plan initial</strong> → Claude → <strong>+ Importer une nouvelle version</strong>. Là aussi, fiche complète d'abord.</p>
        ${PATH(['La course', 'Parcours'])}
        <p>Importe le <strong>GPX</strong> pour voir le profil du parcours, et corrige les infos de la course avec «&nbsp;Modifier ces infos&nbsp;».</p>
        <p class="onb-muted">Pendant une préparation, ton entraînement général se met en pause : on ne suit jamais deux plans à la fois.</p>`,
    },
    {
      icon: '✓',
      title: '6. Au quotidien',
      body: `
        <p>L'accueil te montre la séance du jour. Dans le plan :</p>
        <div class="onb-demo" aria-hidden="true">
          <span class="session-item__type-badge type-easy">EF</span>
          <div class="onb-demo__text"><div>Footing 40 min</div><small>Mercredi</small></div>
          <span class="checkbox checkbox--checked"></span>
          <span class="skipbox"></span>
        </div>
        <ol class="onb-steps">
          ${STEP('✓', '<strong>Fait</strong> — sans note, la séance compte comme faite à la lettre')}
          ${STEP('✕', '<strong>Manquée</strong>, avec la raison (vacances, maladie…)')}
          ${STEP('✎', 'Une <strong>note</strong> seulement si tu t\'écartes du prévu')}
        </ol>
        <p class="onb-muted">Fait du vélo à la place ? Touche la séance → <strong>Activité réalisée</strong>.</p>`,
    },
    {
      icon: '📈',
      title: '7. Faire évoluer le plan',
      body: `
        ${PATH(['Versions', '✦ Générer un prompt de révision'])}
        <p>Quand la vie s'en mêle, Claude reprend ce que tu as <strong>vraiment</strong> fait et réajuste les semaines suivantes.</p>
        <p>En fin de préparation, l'onglet <strong>Stratégie</strong> de la course prépare ton plan de course. Et quand tu coches la course, l'app te propose de noter ton chrono.</p>
        <p class="onb-muted">Ce tutoriel reste disponible dans Réglages.</p>`,
      final: true,
    },
  ];
}

export function openOnboarding({ name = '', onDone = () => {} } = {}) {
  const list = pages(name);
  const overlay = document.createElement('div');
  overlay.className = 'onboarding';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Tutoriel de prise en main');
  overlay.innerHTML = `
    <div class="onboarding__top">
      <button class="onboarding__skip" id="onb-skip">Passer</button>
    </div>
    <div class="onboarding__track" id="onb-track">
      ${list.map((p, i) => `
        <section class="onboarding__page" data-onb-page="${i}">
          <div class="onboarding__icon">${p.icon}</div>
          <h2 class="onboarding__title">${p.title}</h2>
          <div class="onboarding__body">${p.body}</div>
        </section>`).join('')}
    </div>
    <div class="onboarding__bottom">
      <!-- Hors de la page qui défile : sur un petit écran, des boutons placés en
           bas du contenu se retrouvaient rognés. Ici ils restent visibles. -->
      <div class="onboarding__final" id="onb-final" hidden>
        <button class="btn btn--primary btn--full" id="onb-profile">Remplir mon profil</button>
        <button class="btn btn--secondary btn--full" id="onb-explore">Explorer l'app</button>
      </div>
      <div class="onboarding__navrow">
      <button class="onboarding__nav" id="onb-prev" aria-label="Précédent">‹</button>
      <div class="onboarding__dots">
        ${list.map((_, i) => `<button class="onboarding__dot" data-onb-dot="${i}" aria-label="Page ${i + 1}"></button>`).join('')}
      </div>
      <button class="onboarding__nav onboarding__nav--next" id="onb-next">Suivant</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const track = overlay.querySelector('#onb-track');
  const dots  = [...overlay.querySelectorAll('[data-onb-dot]')];
  const prev  = overlay.querySelector('#onb-prev');
  const next  = overlay.querySelector('#onb-next');
  const last  = list.length - 1;
  let current = 0;

  const goTo = i => {
    const target = Math.max(0, Math.min(last, i));
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  };

  const sync = () => {
    current = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    dots.forEach((d, i) => d.classList.toggle('onboarding__dot--active', i === current));
    prev.style.visibility = current === 0 ? 'hidden' : 'visible';
    // Sur la dernière page, les deux boutons d'action prennent le relais de «&nbsp;Suivant&nbsp;».
    next.style.visibility = current === last ? 'hidden' : 'visible';
    overlay.querySelector('#onb-final').hidden = current !== last;
  };

  const close = destination => {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onDone();
    if (destination) navigate(destination);
  };

  const onKey = e => {
    if (e.key === 'ArrowRight') goTo(current + 1);
    else if (e.key === 'ArrowLeft') goTo(current - 1);
    else if (e.key === 'Escape') close();
  };

  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
  prev.addEventListener('click', () => goTo(current - 1));
  next.addEventListener('click', () => goTo(current + 1));
  overlay.querySelector('#onb-skip').addEventListener('click', () => close());
  overlay.querySelector('#onb-profile').addEventListener('click', () => close('/settings'));
  overlay.querySelector('#onb-explore').addEventListener('click', () => close('/'));
  document.addEventListener('keydown', onKey);

  sync();
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
