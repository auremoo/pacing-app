// Menu du bas commun (mobile) — 4 sections racines de l'app.
// Sur desktop, la sidebar persistante joue déjà ce rôle : .global-tab-bar
// est masqué via CSS (voir components.css).

const TABS = [
  { id: 'home',     label: 'Accueil',      path: '/',        icon: 'home'     },
  { id: 'courses',  label: 'Courses',      path: '/courses', icon: 'courses'  },
  { id: 'routine',  label: 'Entraînement', path: '/routine', icon: 'routine'  },
  { id: 'settings', label: 'Réglages',     path: '/settings', icon: 'settings' },
];

export function renderGlobalTabBar(activeId) {
  return `
    <nav class="global-tab-bar">
      ${TABS.map(t => `
        <button class="tab-item ${t.id === activeId ? 'tab-item--active' : ''}" data-gtab="${t.path}">
          ${icon(t.icon)}
          <span>${t.label}</span>
        </button>`).join('')}
    </nav>
  `;
}

export function attachGlobalTabBar(container) {
  container.querySelectorAll('[data-gtab]').forEach(btn => {
    btn.addEventListener('click', () => { location.hash = btn.dataset.gtab; });
  });
}

function icon(id) {
  const icons = {
    home:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></svg>`,
    courses:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h13l-2.5 4L18 12H5"/></svg>`,
    routine:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  };
  return icons[id] || '';
}
