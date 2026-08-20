import { getEventMeta, ensurePlanLoaded } from '../store.js';
import { navigate } from '../app.js';
import { mount as mountPlan }     from './plan-view.js';
import { mount as mountCourse }   from './course-view.js';
import { mount as mountVersions } from './versions-view.js';
import { mount as mountInfos }    from './infos-view.js';

const TABS = [
  { id: 'plan',     label: 'Plan',     icon: tabIcon('plan')     },
  { id: 'course',   label: 'Parcours', icon: tabIcon('course')   },
  { id: 'versions', label: 'Versions', icon: tabIcon('versions') },
  { id: 'infos',    label: 'Infos',    icon: tabIcon('infos')    },
];

export async function mount(container, slug, activeTab = 'plan') {
  // Validate slug
  const meta = getEventMeta(slug);
  if (!meta) { navigate('/courses'); return; }

  // Load plan if available
  if (meta.activeVersion) {
    await ensurePlanLoaded(slug, meta.activeVersion);
  }

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
      ${TABS.map(t => `
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

  await mountTab(container.querySelector('#tab-content'), slug, activeTab);
}

async function mountTab(tabContent, slug, tab) {
  switch (tab) {
    case 'plan':     mountPlan(tabContent, slug);       break;
    case 'course':   await mountCourse(tabContent, slug); break;
    case 'versions': mountVersions(tabContent, slug);   break;
    case 'infos':    mountInfos(tabContent, slug);      break;
    default:         mountPlan(tabContent, slug);
  }
}

function tabIcon(id) {
  const icons = {
    plan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
    course: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l4-8 4 4 4-6 4 8"/></svg>`,
    versions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    infos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };
  return icons[id] || '';
}
