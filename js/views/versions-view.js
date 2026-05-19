import { getEventMeta, importPlanVersion, setActiveVersion } from '../store.js';
import { navigate, showToast } from '../app.js';
import { parsePlan } from '../parser.js';

export function mount(container, slug) {
  render(container, slug);
}

function render(container, slug) {
  const meta = getEventMeta(slug);
  if (!meta) return;

  const versions = (meta.versions || []).slice().reverse();

  container.innerHTML = `
    <div style="padding:var(--space-4)">
      <button class="btn btn--secondary btn--full" id="import-btn">
        + Importer une nouvelle version
      </button>
      <input type="file" id="md-input" accept=".md,text/markdown,text/plain" style="display:none">
    </div>

    ${versions.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state__icon">📄</div>
        <div class="empty-state__title">Aucune version importée</div>
        <div class="empty-state__body">Génère un plan avec Claude (voir docs/CLAUDE_PROMPT.md) puis importe le fichier .md.</div>
      </div>
    ` : `
      <p class="section-header">Versions du plan</p>
      ${versions.map(v => renderVersionCard(v, meta.activeVersion)).join('')}
    `}

    <div id="import-status" style="padding:0 var(--space-4);font-size:14px;color:var(--text-secondary)"></div>
  `;

  container.querySelector('#import-btn').addEventListener('click', () => {
    container.querySelector('#md-input').click();
  });

  container.querySelector('#md-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImport(container, slug, file);
    e.target.value = '';
  });

  container.querySelectorAll('[data-set-active]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const v = parseInt(btn.dataset.setActive);
      try {
        await setActiveVersion(slug, v);
        showToast(`Version ${v} activée`, 'success');
        render(container, slug);
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}

async function handleImport(container, slug, file) {
  const status = container.querySelector('#import-status');
  status.textContent = 'Lecture du fichier…';

  const text = await file.text();

  // Minimal validation: check required sections
  if (!text.includes('## META') || !text.includes('## SEMAINES')) {
    showToast('Format invalide — vérifie le template Claude.', 'error');
    status.textContent = '';
    return;
  }

  // Quick parse to extract label
  const metaMatch = text.match(/^event:\s*(.+)$/m);
  const label = metaMatch ? metaMatch[1].trim() : file.name.replace('.md', '');

  status.textContent = 'Upload vers GitHub…';
  try {
    const v = await importPlanVersion(slug, text, label);
    showToast(`Version ${v} importée et activée !`, 'success');
    status.textContent = '';
    render(container, slug);
  } catch (err) {
    showToast('Erreur upload : ' + err.message, 'error');
    status.textContent = '';
  }
}

function renderVersionCard(v, activeVersion) {
  const isActive = v.v === activeVersion;
  const date = new Date(v.importedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <div class="version-card ${isActive ? 'version-card--active' : 'version-card--archive'}">
      <div class="version-card__badge">v${v.v}</div>
      <div class="version-card__info">
        <div class="version-card__title">${v.label || `Version ${v.v}`}</div>
        <div class="version-card__date">Importée le ${date}</div>
      </div>
      ${isActive
        ? `<span class="version-card__active-label">Active</span>`
        : `<button class="btn btn--ghost btn--sm" data-set-active="${v.v}">Activer</button>`
      }
    </div>
  `;
}
