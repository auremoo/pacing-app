import { isAuthenticated, mount as mountLock } from './views/lock.js';
import { mount as mountDashboard }             from './views/dashboard.js';
import { mount as mountEvent }                 from './views/event.js';
import { mount as mountSession }               from './views/session-view.js';
import { mount as mountSettings }             from './views/settings.js';
import { initStore }                           from './store.js';
import { isConfigured, loadConfig, configure } from './github-api.js';
import { showToast as _showToast }             from './toast.js';

const app = document.getElementById('app');

// ── Toast ─────────────────────────────────────────────────────────

export { showToast } from './toast.js';

// ── Navigation ────────────────────────────────────────────────────

export function navigate(path) {
  location.hash = path;
}

// ── Router ────────────────────────────────────────────────────────

const ROUTES = [
  { re: /^\/$/, fn: () => mountDashboard(app) },
  { re: /^\/settings$/, fn: () => mountSettings(app) },
  { re: /^\/event\/([\w-]+)$/, fn: (m) => mountEvent(app, m[1], 'plan') },
  { re: /^\/event\/([\w-]+)\/(plan|course|versions|infos)$/, fn: (m) => mountEvent(app, m[1], m[2]) },
  { re: /^\/event\/([\w-]+)\/session\/([\w-]+)$/, fn: (m) => mountSession(app, m[1], m[2]) },
];

async function route() {
  const path = decodeURIComponent(location.hash.slice(1)) || '/';
  for (const { re, fn } of ROUTES) {
    const m = path.match(re);
    if (m) { await fn(m); return; }
  }
  // No match → dashboard
  mountDashboard(app);
}

// ── Boot ──────────────────────────────────────────────────────────

async function boot() {
  if (!isAuthenticated()) {
    mountLock(app, () => boot());
    return;
  }

  // Apply saved GitHub config
  const cfg = loadConfig();
  if (cfg) configure(cfg);

  if (!isConfigured()) {
    // No config → go straight to settings
    mountSettings(app);
    showToast('Configure la connexion GitHub pour commencer.', '');
    return;
  }

  // Show loading
  app.innerHTML = `<div class="loading-state" style="min-height:100dvh"><div class="spinner"></div><span>Chargement…</span></div>`;

  try {
    await initStore();
  } catch (err) {
    app.innerHTML = `
      <div class="loading-state" style="min-height:100dvh;flex-direction:column;gap:16px">
        <div style="font-size:40px">⚠️</div>
        <div style="font-size:17px;font-weight:600">Erreur de connexion</div>
        <div style="font-size:14px;color:var(--text-secondary);max-width:280px;text-align:center">${err.message}</div>
        <button class="btn btn--secondary" onclick="location.hash='/settings'">Réglages GitHub</button>
      </div>`;
    return;
  }

  window.addEventListener('hashchange', () => route());
  await route();
}

document.addEventListener('DOMContentLoaded', boot);
