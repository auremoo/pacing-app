import { getEventMeta, importPlanVersion, setActiveVersion, getActivePlan, getAllSessionStates, getActivePlanRaw } from '../store.js';
import { navigate, showToast } from '../app.js';
import { parsePlan } from '../parser.js';
import { today, formatDateShort } from '../utils/dates.js';

export function mount(container, slug) {
  render(container, slug);
}

function render(container, slug) {
  const meta = getEventMeta(slug);
  if (!meta) return;

  const versions = (meta.versions || []).slice().reverse();
  const hasPlan  = versions.length > 0;

  container.innerHTML = `
    <div style="padding:var(--space-4)">
      <button class="btn btn--secondary btn--full" id="import-btn">
        + Importer une nouvelle version
      </button>
      <input type="file" id="md-input" accept=".md,text/markdown,text/plain" style="display:none">
    </div>

    ${hasPlan ? `
      <div style="padding:0 var(--space-4) var(--space-3)">
        <button class="btn btn--ghost btn--full" id="export-prompt-btn">
          ✦ Générer un prompt de révision
        </button>
      </div>
    ` : ''}

    ${!hasPlan ? `
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

  container.querySelector('#export-prompt-btn')?.addEventListener('click', () => {
    showExportModal(container, slug);
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

// ── Import ────────────────────────────────────────────────────────

async function handleImport(container, slug, file) {
  const status = container.querySelector('#import-status');
  status.textContent = 'Lecture du fichier…';

  const text = await file.text();

  if (!text.includes('## META') || !text.includes('## SEMAINES')) {
    showToast('Format invalide — vérifie le template Claude.', 'error');
    status.textContent = '';
    return;
  }

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

// ── Export prompt de révision ────────────────────────────────────

function showExportModal(container, slug) {
  const meta    = getEventMeta(slug);
  const plan    = getActivePlan(slug);
  const planRaw = getActivePlanRaw(slug);
  const states  = getAllSessionStates(slug);

  if (!plan || !planRaw) {
    showToast('Plan non chargé', 'error');
    return;
  }

  const prompt = buildRevisionPrompt(meta, plan, planRaw, states);

  const modal = document.createElement('div');
  modal.className = 'export-modal';
  modal.innerHTML = `
    <div class="export-modal__overlay"></div>
    <div class="export-modal__panel">
      <div class="export-modal__header">
        <span class="export-modal__title">Prompt de révision</span>
        <button class="export-modal__close" id="modal-close">✕</button>
      </div>
      <div class="export-modal__hint">
        Copie ce texte et envoie-le à Claude pour obtenir une version révisée du plan.
      </div>
      <textarea class="export-modal__textarea" id="prompt-text" readonly>${escHtml(prompt)}</textarea>
      <div class="export-modal__footer">
        <button class="btn btn--primary" id="copy-prompt-btn" style="flex:1">Copier le prompt</button>
        <button class="btn btn--secondary" id="close-modal-btn" style="flex:1">Fermer</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => document.body.removeChild(modal);
  modal.querySelector('#modal-close').addEventListener('click', close);
  modal.querySelector('#close-modal-btn').addEventListener('click', close);
  modal.querySelector('.export-modal__overlay').addEventListener('click', close);

  modal.querySelector('#copy-prompt-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      showToast('Prompt copié !', 'success');
    } catch {
      modal.querySelector('#prompt-text').select();
      document.execCommand('copy');
      showToast('Prompt copié !', 'success');
    }
  });
}

function buildRevisionPrompt(meta, plan, planRaw, states) {
  const todayStr    = today();
  const nextVersion = (meta.activeVersion || 1) + 1;

  // Stats
  const allSessions = plan.weeks.flatMap(w => w.sessions).filter(s => s.type !== 'rest');
  const done        = allSessions.filter(s => states[s.id]?.completed).length;
  const skipped     = allSessions.filter(s => states[s.id]?.skipped).length;
  const total       = allSessions.length;
  const pct         = total ? Math.round(done / total * 100) : 0;

  // Current week
  let currentWeekNum = plan.weeks[0]?.number || 1;
  for (const w of plan.weeks) {
    if (w.sessions.some(s => s.date <= todayStr)) currentWeekNum = w.number;
  }
  const weeksLeft = plan.weeks.filter(w => w.number >= currentWeekNum).length;

  // Week-by-week detail
  const weekDetail = plan.weeks.map(w => {
    const nonRest = w.sessions.filter(s => s.type !== 'rest');
    const wDone    = nonRest.filter(s => states[s.id]?.completed).length;
    const wSkipped = nonRest.filter(s => states[s.id]?.skipped).length;
    const wTotal   = nonRest.length;
    const isPast   = w.sessions.every(s => s.date < todayStr);
    const isCurrent = w.number === currentWeekNum;
    const label     = isCurrent ? ' ← EN COURS' : (isPast ? '' : ' (à venir)');

    const rows = nonRest.map(s => {
      const st = states[s.id];
      const status = st?.completed ? '✓ Faite' : st?.skipped ? '✗ Manquée' : (s.date < todayStr ? '— Non cochée' : '· À venir');
      const note   = st?.note ? ` [Note: ${st.note.replace(/\n/g, ' ')}]` : '';
      return `  | ${s.date} | ${s.type.padEnd(10)} | ${s.title.substring(0, 35).padEnd(35)} | ${status}${note} |`;
    }).join('\n');

    return `### S${String(w.number).padStart(2, '0')} — ${w.dateRange} (${w.phaseId}) — ${wDone}/${wTotal} faites${wSkipped > 0 ? `, ${wSkipped} manquée${wSkipped > 1 ? 's' : ''}` : ''}${label}\n${rows}`;
  }).join('\n\n');

  return `Tu es un coach running expert. Je te transmets mon plan d'entraînement en cours avec un bilan complet de l'avancement.

**Ta mission :** générer une version révisée v${nextVersion} du plan qui :
1. Intègre ce qui a été réellement effectué (ou manqué)
2. Adapte la charge, la progression et les objectifs en conséquence
3. Réorganise les ${weeksLeft} semaines restantes de façon cohérente et progressive
4. Maintient (ou révise si nécessaire) l'objectif final

---

## Événement cible
- Nom : ${meta.name}
- Date de course : ${meta.raceDate}
- Distance : ${meta.distanceKm} km · D+ ${meta.elevationGainM || 0} m
- Objectif : ${meta.objective || 'Non renseigné'}
- Objectif réaliste : ${meta.objectiveRealistic || 'Non renseigné'}

## Bilan au ${todayStr}
- Plan semaine ${currentWeekNum} / ${plan.weeks.length} (${weeksLeft} semaines restantes dont la semaine en cours)
- Séances réalisées : **${done} / ${total} (${pct}%)**${skipped > 0 ? `\n- Séances non effectuées : **${skipped}**` : ''}

## Détail semaine par semaine

${weekDetail}

---

## Plan actuel — v${meta.activeVersion}

\`\`\`
${planRaw}
\`\`\`

---

## FORMAT DE SORTIE OBLIGATOIRE

Génère le plan révisé en suivant **exactement** ce format, sans introduction, directement à partir du titre :

\`\`\`
# PLAN_v${nextVersion} — ${meta.name}

## META
event: ${meta.name}
slug: ${plan.meta?.slug || ''}
date: ${meta.raceDate}
location: ${plan.meta?.location || ''}
distance_km: ${meta.distanceKm}
distance_label: ${meta.distanceLabel || ''}
elevation_gain_m: ${meta.elevationGainM || 0}
course_description: [description]
objective_time: ${meta.objective || ''}
objective_realistic: [fourchette réaliste révisée]
plan_start: [date lundi de la semaine en cours ou prochaine]
plan_weeks: [nombre de semaines restantes]
version: ${nextVersion}
generated: ${todayStr}

## PHASES
| ID | Nom | Semaines | Couleur |
|---|---|---|---|
| phase-X | Nom | X-Y | color |

## ALLURES

### Actuelles
| Zone | Allure | Usage |
|---|---|---|

### Cibles
| Zone | Allure | Usage |
|---|---|---|

## SEMAINES

### S{NN} | {date début}-{date fin} {mois} {année} | {phase-id} | {volume}km | {note}
| Jour | Date | Type | Titre | Description |
|---|---|---|---|---|

## SYNTHESE
[mise en perspective actualisée : bilan de la préparation, gap restant, ajustements]

## PRINCIPES
[principes de la phase restante]

## PPG
[programme PPG adapté]

## VIGILANCE
[points de vigilance actualisés]

## STRATEGIE_COURSE
[stratégie course mise à jour]

## NUTRITION
[nutrition mise à jour]
\`\`\`

Types de séance valides : rest, easy, long, intervals, tempo, hills, race, strength, cross
IDs de session : s{NN}-{daycode} (ex: s01-mon, s03-thu)
`;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Version card ──────────────────────────────────────────────────

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
