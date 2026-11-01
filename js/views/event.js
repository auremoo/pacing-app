import { getEventMeta, ensurePlanLoaded, updateEventMeta, getRoutineMeta } from '../store.js';
import { loadPastVersions } from '../utils/plan-history.js';
import { navigate, showToast } from '../app.js';
import { formatDate } from '../utils/dates.js';
import { mount as mountPlan }     from './plan-view.js';
import { mount as mountCourse }   from './course-view.js';
import { mount as mountVersions } from './versions-view.js';
import { mount as mountInfos }    from './infos-view.js';
import { mount as mountStrategy } from './strategy-view.js';
import { isPrepComplete } from '../utils/prep-report.js';

const TABS = [
  { id: 'plan',     label: 'Plan',     icon: tabIcon('plan')     },
  { id: 'course',   label: 'Parcours', icon: tabIcon('course')   },
  { id: 'versions', label: 'Versions', icon: tabIcon('versions') },
  { id: 'infos',    label: 'Infos',    icon: tabIcon('infos')    },
];

// L'onglet Stratégie n'apparaît qu'en fin de préparation (ou si une stratégie
// a déjà été importée) : inutile de l'avoir sous les yeux pendant 20 semaines.
function tabsFor(slug, meta, activeTab) {
  // Préparée avec l'entraînement général : ni versions ni infos de plan.
  if (isFollowingRoutine(meta)) return [{ ...TABS[0], label: 'Préparation' }, TABS[1]];
  const show = activeTab === 'strategy' || !!meta.strategy || isPrepComplete(slug);
  return show
    ? [...TABS, { id: 'strategy', label: 'Stratégie', icon: tabIcon('strategy') }]
    : TABS;
}

export async function mount(container, slug, activeTab = 'plan') {
  // Validate slug
  const meta = getEventMeta(slug);
  if (!meta) { navigate('/courses'); return; }

  // Load plan if available
  if (meta.activeVersion) {
    await ensurePlanLoaded(slug, meta.activeVersion);
    await loadPastVersions(slug);
  }

  if (isFollowingRoutine(meta) && !['plan', 'course'].includes(activeTab)) activeTab = 'plan';
  const tabs = tabsFor(slug, meta, activeTab);

  container.innerHTML = `
    <div class="nav-bar">
      <button class="nav-btn" id="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        Courses
      </button>
      <span class="nav-bar__title">${meta.name}</span>
      <span style="width:72px"></span>
    </div>

    <div id="tab-content" class="scroll-view" style="padding-bottom:calc(var(--tab-bar-height) + var(--safe-bottom))">
      <div class="loading-state"><div class="spinner"></div></div>
    </div>

    <nav class="tab-bar">
      ${tabs.map(t => `
        <button class="tab-item ${t.id === activeTab ? 'tab-item--active' : ''}"
                data-tab="${t.id}">
          ${t.icon}
          <span>${t.label}</span>
        </button>`).join('')}
    </nav>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => navigate('/courses'));

  container.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      navigate(`/event/${slug}/${tab}`);
    });
  });

  await mountTab(container.querySelector('#tab-content'), slug, activeTab, () => mount(container, slug, 'plan'));
}

const isFollowingRoutine = (meta) => !!meta.followRoutine && !meta.activeVersion;

async function mountTab(tabContent, slug, tab, remount) {
  if ((tab === 'plan' || !tab) && !getEventMeta(slug).activeVersion) return mountNoPlan(tabContent, slug, remount);
  switch (tab) {
    case 'plan':     mountPlan(tabContent, slug);       break;
    case 'course':   await mountCourse(tabContent, slug); break;
    case 'versions': mountVersions(tabContent, slug);   break;
    case 'infos':    mountInfos(tabContent, slug);      break;
    case 'strategy': await mountStrategy(tabContent, slug); break;
    default:         mountPlan(tabContent, slug);
  }
}

// Course sans plan : soit préparée avec l'entraînement général (choix fait à la
// création ou ici), soit en attente d'un plan dédié. On passe de l'un à
// l'autre tant qu'aucun plan n'a été importé.
function mountNoPlan(container, slug, remount) {
  const meta = getEventMeta(slug);
  const follow = isFollowingRoutine(meta);
  const routine = getRoutineMeta();
  const active = routine?.versions?.find(v => v.v === routine.activeVersion);
  // Plan général fait avant que la course y soit rattachée : il ne la connaît pas.
  const stale = follow && active && (!meta.followRoutineSince || (active.importedAt || '') < meta.followRoutineSince);

  container.innerHTML = follow ? `
    <div class="empty-state">
      <div class="empty-state__icon">🔁</div>
      <div class="empty-state__title">Préparée avec ton entraînement général</div>
      <div class="empty-state__body">Pas de plan dédié : tu continues ton entraînement général jusqu'au ${formatDate(meta.raceDate).toLowerCase()}. Ses prompts annoncent la course à l'IA, qui la place le jour J, allège les jours d'avant et prévoit la récupération.</div>
    </div>
    ${!routine?.activeVersion ? `
      <p class="no-plan__note">Tu n'as pas encore de plan général : crée-le depuis Entraînement, la course y sera reprise.</p>`
    : stale ? `
      <p class="no-plan__note">Ton plan général actuel a été fait avant d'y rattacher cette course : génère une nouvelle version pour qu'il en tienne compte.</p>` : ''}
    <div class="no-plan__actions">
      <button class="btn btn--primary btn--full" data-go="${stale || !routine?.activeVersion ? '/routine/versions' : '/routine'}">
        ${stale ? 'Générer une nouvelle version' : !routine?.activeVersion ? 'Créer mon plan général' : "Voir l'entraînement"}
      </button>
      <button class="btn btn--ghost btn--full" data-follow="0">Faire plutôt un plan dédié</button>
    </div>
  ` : `
    <div class="empty-state">
      <div class="empty-state__icon">📋</div>
      <div class="empty-state__title">Pas encore de plan</div>
      <div class="empty-state__body">Génère un plan dédié à cette course depuis l'onglet Versions, ou garde simplement ton entraînement général pour la préparer.</div>
    </div>
    <div class="no-plan__actions">
      <button class="btn btn--primary btn--full" data-go="/event/${slug}/versions">Créer un plan dédié</button>
      <button class="btn btn--ghost btn--full" data-follow="1">Mon entraînement général suffit</button>
    </div>
  `;

  container.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.go)));
  container.querySelector('[data-follow]').addEventListener('click', async (e) => {
    const on = e.currentTarget.dataset.follow === '1';
    e.currentTarget.disabled = true;
    try {
      await updateEventMeta(slug, on ? { followRoutine: true, followRoutineSince: new Date().toISOString() } : { followRoutine: false });
      if (on) { showToast('Course rattachée à ton entraînement général', 'success'); remount(); }
      else navigate(`/event/${slug}/versions`);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      e.currentTarget.disabled = false;
    }
  });
}

function tabIcon(id) {
  const icons = {
    plan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
    course: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l4-8 4 4 4-6 4 8"/></svg>`,
    versions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    infos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    strategy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V4h9l1 2h6v9h-7l-1-2H4"/></svg>`,
  };
  return icons[id] || '';
}
