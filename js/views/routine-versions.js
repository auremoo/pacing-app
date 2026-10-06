import { getRoutineMeta, importPlanVersion, setActiveVersion, getActivePlan, getAllSessionStates,
         getActivePlanRaw, getAthleteProfile, getDateOverrides, getWeekMetaOverrides, ROUTINE_SLUG,
         getTypeOverrides } from '../store.js';
import { showToast, navigate } from '../app.js';
import { today } from '../utils/dates.js';
import { applyDateOverrides, applyWeekMetaOverrides, applyTypeOverrides, getCurrentWeekNum } from '../utils/plan-overrides.js';
import { typeName } from '../utils/session-types.js';
import { getTargets, formatTargets, targetText } from '../utils/routine-context.js';
import { doesRun, doesGym, sportsSummary } from '../utils/sports.js';
import { bodyPromptSection } from '../utils/body.js';

export function mount(container) {
  render(container);
}

function render(container) {
  const meta = getRoutineMeta();
  if (!meta) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🗓️</div>
        <div class="empty-state__title">Aucun plan général configuré</div>
        <div class="empty-state__body">Renseigne d'abord tes activités actuelles et tes objectifs dans l'onglet Contexte.</div>
      </div>
      <div style="padding:0 var(--space-4)">
        <button class="btn btn--primary btn--full" id="go-settings-btn">Aller au contexte</button>
      </div>
    `;
    container.querySelector('#go-settings-btn').addEventListener('click', () => navigate('/routine/settings'));
    return;
  }

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
      ${targetsHint(meta)}
    ` : ''}

    ${!hasPlan ? `
      <div class="empty-state">
        <div class="empty-state__icon">📄</div>
        <div class="empty-state__title">Aucune version importée</div>
        <div class="empty-state__body">Génère un plan avec Claude en copiant le prompt ci-dessous, puis importe le fichier .md.</div>
      </div>
      <div style="padding:0 var(--space-4) var(--space-3)">
        <button class="btn btn--ghost btn--full" id="gen-initial-btn">
          ✦ Générer le prompt de plan initial
        </button>
      </div>
      ${targetsHint(meta)}
    ` : `
      <p class="section-header">Versions du plan général</p>
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
    await handleImport(container, file);
    e.target.value = '';
  });

  container.querySelectorAll('.targets-hint__edit').forEach(b => b.addEventListener('click', () => navigate('/routine/settings')));

  container.querySelector('#export-prompt-btn')?.addEventListener('click', () => {
    showExportModal();
  });

  container.querySelector('#gen-initial-btn')?.addEventListener('click', () => {
    showInitialPromptModal();
  });

  container.querySelectorAll('[data-set-active]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const v = parseInt(btn.dataset.setActive);
      try {
        await setActiveVersion(ROUTINE_SLUG, v);
        showToast(`Version ${v} activée`, 'success');
        render(container);
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}

// ── Import ────────────────────────────────────────────────────────

async function handleImport(container, file) {
  const status = container.querySelector('#import-status');
  status.textContent = 'Lecture du fichier…';

  const text = await file.text();

  if (!text.includes('## META') || !text.includes('## SEMAINES')) {
    showToast('Format invalide — vérifie le template Claude.', 'error');
    status.textContent = '';
    return;
  }

  const labelMatch = text.match(/^block_label:\s*(.+)$/m);
  const label = labelMatch ? labelMatch[1].trim() : file.name.replace('.md', '');

  status.textContent = 'Upload vers GitHub…';
  try {
    const v = await importPlanVersion(ROUTINE_SLUG, text, label);
    showToast(`Version ${v} importée et activée !`, 'success');
    status.textContent = '';
    render(container);
  } catch (err) {
    showToast('Erreur upload : ' + err.message, 'error');
    status.textContent = '';
  }
}

// ── Prompt de plan initial ────────────────────────────────────────

function showInitialPromptModal() {
  const meta    = getRoutineMeta();
  const athlete = getAthleteProfile();
  const prompt  = buildInitialPrompt(meta, athlete);
  openPromptModal('Prompt de plan initial', prompt);
}

// Rappel, sous le bouton de prompt, des objectifs chrono qui y seront repris :
// c'est avant de générer qu'on les choisit ou les change.
function targetsHint(meta) {
  const targets = getTargets(meta);
  const list = targets.length
    ? targets.map(t => `${escHtml(targetText(t))}${t.achieved ? ' ✓' : ''}`).join(' · ')
    : 'aucun';
  return `<p class="type-picker__hint" style="padding:0 var(--space-4) var(--space-3)">
      Objectifs perso repris dans le prompt : ${list}.
      <button class="targets-hint__edit" type="button" style="color:var(--ios-blue)">Modifier dans Contexte</button>
    </p>`;
}

// Objectifs perso : ce que je vise hors course officielle. Le plan doit y mener
// et prévoir quand les tester ; la consigne dépend du type d'objectif.
function targetsSection(meta, level) {
  const targets = getTargets(meta);
  if (!targets.length) return '';
  const kinds = new Set(targets.filter(t => !t.achieved).map(t => t.kind));
  const rules = [
    kinds.has('chrono') && `- **Chrono** : prévois les séances qui y mènent et place un test chronométré (type \`race\`, titre du type « Test 5 km ») au moment où je peux raisonnablement le réussir, en arrivant reposé (pas de séance dure les 2 jours avant).${targets.some(t => t.kind === 'chrono' && t.measure === 'pace' && !t.achieved) ? ` Pour un objectif d'allure, cale les allures des séances pour y arriver ; si la distance n'est pas précisée, choisis une distance de test pertinente et indique-la.` : ''}`,
    kinds.has('force')  && `- **Force** : progression de charge sur l'exercice visé (et ses exercices d'assistance), puis un test (type \`gym\`, titre du type « Test squat »), en arrivant reposé.`,
    kinds.has('poids')  && `- **Poids** : organise l'entraînement pour y contribuer (perte : volume d'activité et maintien de la masse musculaire ; prise de masse : priorité à la musculation, cardio modéré) et donne dans la SYNTHESE quelques repères généraux de nutrition, sans régime strict. Rythme raisonnable, pas de promesse irréaliste.`,
    kinds.has('autre')  && `- **Autre** : prévois les séances qui y mènent et, si ça se mesure, un moment pour le tester.`,
  ].filter(Boolean).join('\n');
  return `
${level} Objectifs personnels

${formatTargets(targets)}

Ce ne sont pas des courses ou des compétitions officielles : ce sont des objectifs que je veux atteindre à l'entraînement.
${rules}
Respecte les échéances quand il y en a. **Sans échéance, c'est à toi de choisir quand tenter l'objectif**, d'après mon niveau actuel (profil, historique) et la progression du plan — ni trop tôt pour le rater, ni repoussé indéfiniment — et indique dans la SYNTHESE la date retenue et pourquoi. Si un objectif te paraît irréaliste dans le délai, dis-le dans la SYNTHESE et propose un palier intermédiaire. Un objectif déjà atteint sert de repère (allures, charges).

`;
}

// Types valides et consignes de description selon mes sports : pas de côtes ni
// d'allures pour qui ne court pas, pas de types salle pour qui n'y va pas.
function sessionRules(meta) {
  const run = doesRun(), gym = doesGym();
  const chronoTarget = getTargets(meta).some(t => t.kind === 'chrono' && !t.achieved);
  const lines = ['Types de séance valides :'];
  if (run) lines.push('- course à pied : `easy` (endurance), `long` (sortie longue), `intervals` (fractionné), `tempo` (seuil), `hills` (côtes), `race` (course ou test chronométré)');
  else if (chronoTarget) lines.push('- `race` : test chronométré');
  if (gym) lines.push('- salle : `gym` (musculation), `cardio` (cardio continu : tapis, vélo, elliptique, rameur), `hiit` (HIIT / circuit), `mobility` (mobilité, étirements, yoga), `class` (cours collectif)');
  lines.push('- toujours : `strength` (renforcement / PPG, au poids du corps ou petit matériel), `cross` (autre sport : badminton, vélo, natation… — mes activités récurrentes en général), `rest` (repos)');
  lines.push('Colonne {volume} de chaque semaine : en km si la semaine comporte de la course à pied (ex : `18km`), sinon le nombre de séances (ex : `4 séances`) ou la durée totale (ex : `3h30`).');
  if (gym) lines.push('Pour une séance de musculation, la description liste les exercices avec séries × répétitions, charge (ou RPE) et temps de repos — ex : « Squat 4×8 à 40 kg, repos 2 min ; Fentes 3×10 par jambe… ». Varie les groupes musculaires sur la semaine et prévois une progression des charges.');
  return lines.join('\n');
}

function buildInitialPrompt(meta, athlete) {
  const todayStr = today();
  const a = athlete || {};

  return `Tu es un coach expert en préparation physique tous sports. Génère un plan d'entraînement générique complet et personnalisé, qui n'est PAS lié à une course spécifique — c'est un plan de fond qui intègre mes activités récurrentes actuelles et fait progresser des qualités précises (endurance, vitesse, force, composition corporelle…) sur plusieurs semaines.

### Profil athlète

- Niveau et expérience : ${a.level || '[à compléter]'}
- Meilleures performances récentes : ${a.perfs || '[à compléter]'}
- Volume d'entraînement actuel : ${a.volume || '[à compléter]'}
- Jours disponibles par semaine : ${a.days || '[à compléter]'}
- Accès équipements : ${a.equipment || '[à compléter]'}
- Terrain local : ${a.terrain || '[à compléter]'}
- Pathologies / points de vigilance : ${a.pathologies || 'Aucun'}
- Sports pratiqués : ${sportsSummary(a)}
- Objectifs secondaires : ${a.goals || 'Aucun'}

### Activités actuelles et récurrentes

${meta.context || '[à compléter — ex : Badminton le mercredi soir, 1x/semaine, loisir]'}

### Objectifs de ce bloc

${meta.goals || '[à compléter — ex : 2 séances de fractionné/sprint en plus par semaine]'}

${targetsSection(meta, '###')}${bodyPromptSection('###')}### Paramètres du bloc

- Date de début du plan : ${meta.startDate || '[à compléter — toujours un lundi]'}
- Durée souhaitée du bloc : ${meta.blockWeeks ? meta.blockWeeks + ' semaines' : '[à compléter]'}

---

**FORMAT DE SORTIE OBLIGATOIRE**

Génère le plan en suivant **EXACTEMENT** ce format template, sans aucune déviation, pour qu'il soit importable dans mon application de suivi. Ne commence pas par une introduction, commence directement par \`# PLAN_GENERAL_v1\`.

**Important :** intègre les activités récurrentes existantes (ex : badminton) comme des séances normales du plan (type \`cross\` en général), aux côtés des nouvelles séances demandées, pour que le planning hebdomadaire soit complet et réaliste.

\`\`\`
# PLAN_GENERAL_v1

## META
block_label: [nom court du bloc, ex: Bloc fractionné été 2026]
plan_start: ${meta.startDate || '[YYYY-MM-DD — toujours un lundi]'}
plan_weeks: ${meta.blockWeeks || '[nombre]'}
version: 1
generated: ${todayStr}

## PHASES
| ID | Nom | Semaines | Couleur |
|---|---|---|---|
| phase-1 | {Nom phase} | 1-{fin} | gray |

## SEMAINES

### S{NN} | {date début}-{date fin} {mois} {année} | {phase-id} | {volume} | {note courte}
| Jour | Date | Type | Titre | Description |
|---|---|---|---|---|
| {Lundi/Mardi/…} | {YYYY-MM-DD} | {type} | {Titre court} | {Description détaillée} |

{Répéter pour toutes les semaines}

## SYNTHESE
[logique du bloc : point de départ, progression visée, comment les activités récurrentes s'articulent avec les nouvelles séances]
\`\`\`

**Règles importantes :**
- Calcule les dates exactes à partir de \`plan_start\` (toujours un lundi)
- Chaque séance a une description détaillée avec intensités (allures, charges), durées et répétitions précises
${sessionRules(meta)}
- N'inclus que les jours avec séances (pas les jours vides)
`;
}

// ── Export prompt de révision ────────────────────────────────────

function showExportModal() {
  const meta              = getRoutineMeta();
  const plan               = getActivePlan(ROUTINE_SLUG);
  const planRaw             = getActivePlanRaw(ROUTINE_SLUG);
  const states              = getAllSessionStates(ROUTINE_SLUG);
  const athlete             = getAthleteProfile();
  const dateOverrides       = getDateOverrides(ROUTINE_SLUG);
  const weekMetaOverrides   = getWeekMetaOverrides(ROUTINE_SLUG);

  if (!plan || !planRaw) {
    showToast('Plan non chargé', 'error');
    return;
  }

  const effPlan = applyTypeOverrides(
    applyWeekMetaOverrides(applyDateOverrides(plan, dateOverrides), weekMetaOverrides),
    getTypeOverrides(ROUTINE_SLUG)
  );
  const prompt  = buildRevisionPrompt(meta, plan, effPlan, planRaw, states, athlete, dateOverrides);
  openPromptModal('Prompt de révision', prompt);
}

function buildRevisionPrompt(meta, plan, effPlan, planRaw, states, athlete, dateOverrides) {
  const todayStr    = today();
  const nextVersion = (meta.activeVersion || 1) + 1;
  const a           = athlete || {};

  const originalDateById = {};
  plan.weeks.forEach(w => w.sessions.forEach(s => { originalDateById[s.id] = s.date; }));

  const allSessions = effPlan.weeks.flatMap(w => w.sessions).filter(s => s.type !== 'rest');
  const done        = allSessions.filter(s => states[s.id]?.completed).length;
  const skipped     = allSessions.filter(s => states[s.id]?.skipped).length;
  const total       = allSessions.length;
  const pct         = total ? Math.round(done / total * 100) : 0;

  const currentWeekNum = getCurrentWeekNum(effPlan, todayStr);

  const weekDetail = effPlan.weeks.map(w => {
    const nonRest = w.sessions.filter(s => s.type !== 'rest');
    const wDone    = nonRest.filter(s => states[s.id]?.completed).length;
    const wSkipped = nonRest.filter(s => states[s.id]?.skipped).length;
    const wTotal   = nonRest.length;
    const isCurrent = w.number === currentWeekNum;
    const label      = isCurrent ? ' ← EN COURS' : '';

    const rows = nonRest.map(s => {
      const st     = states[s.id];
      const status = st?.completed ? '✓ Faite' : st?.skipped ? '✗ Manquée' : (s.date < todayStr ? '— Non cochée' : '· À venir');
      const note   = st?.note ? ` [Note: ${st.note.replace(/\n/g, ' ')}]` : '';
      const moved  = (dateOverrides && dateOverrides[s.id]) ? ` [déplacée, était le ${originalDateById[s.id]}]` : '';
      // Activité changée par l'athlète : la colonne type dit ce qui a été fait,
      // la mention rappelle ce qui était prévu.
      const swapped = s.plannedType ? ` [activité changée : ${typeName(s.type)} au lieu de ${typeName(s.plannedType)}]` : '';
      return `  | ${s.date} | ${s.type.padEnd(10)} | ${s.title.substring(0, 35).padEnd(35)} | ${status}${note}${moved}${swapped} |`;
    }).join('\n');

    return `### S${String(w.number).padStart(2, '0')} — ${w.dateRange} (${w.phaseId}) — ${wDone}/${wTotal} faites${wSkipped > 0 ? `, ${wSkipped} manquée${wSkipped > 1 ? 's' : ''}` : ''}${label}\n${rows}`;
  }).join('\n\n');

  return `Tu es un coach expert en préparation physique tous sports. Je te transmets mon plan général en cours (hors préparation de course spécifique) avec un bilan complet de l'avancement.

**Ta mission :** générer une version révisée v${nextVersion} du plan général qui :
1. Intègre ce qui a été réellement effectué (ou manqué), tous types de séances confondus (activités récurrentes comme le nouveau travail demandé)
2. Adapte la charge et la progression en conséquence
3. Poursuit ou ajuste les objectifs du bloc

---

## Profil athlète

- Niveau et expérience : ${a.level || 'Non renseigné'}
- Meilleures performances récentes : ${a.perfs || 'Non renseigné'}
- Volume hebdomadaire habituel : ${a.volume || 'Non renseigné'}
- Jours disponibles : ${a.days || 'Non renseigné'}
- Équipements : ${a.equipment || 'Non renseigné'}
- Terrain local : ${a.terrain || 'Non renseigné'}
- Pathologies : ${a.pathologies || 'Aucune'}
- Sports pratiqués : ${sportsSummary(a)}
- Objectifs secondaires : ${a.goals || 'Aucun'}

## Contexte du plan général

- Activités récurrentes déclarées : ${meta.context || 'Non renseigné'}
- Objectifs de ce bloc : ${meta.goals || 'Non renseigné'}
${targetsSection(meta, '##')}${bodyPromptSection('##')}
## Bilan au ${todayStr}
- Plan semaine ${currentWeekNum} / ${plan.weeks[plan.weeks.length - 1]?.number || plan.weeks.length}
- Séances réalisées : **${done} / ${total} (${pct}%)**${skipped > 0 ? `\n- Séances non effectuées : **${skipped}**` : ''}

## Détail semaine par semaine (historique tous types de séances confondus)

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
# PLAN_GENERAL_v${nextVersion}

## META
block_label: [nom court du nouveau bloc]
plan_start: [date lundi de la semaine en cours ou prochaine]
plan_weeks: [nombre de semaines du nouveau bloc]
version: ${nextVersion}
generated: ${todayStr}

## PHASES
| ID | Nom | Semaines | Couleur |
|---|---|---|---|
| phase-X | Nom | X-Y | color |

## SEMAINES

### S{NN} | {date début}-{date fin} {mois} {année} | {phase-id} | {volume} | {note}
| Jour | Date | Type | Titre | Description |
|---|---|---|---|---|

## SYNTHESE
[bilan du bloc précédent, ajustements pour le nouveau bloc]
\`\`\`

${sessionRules(meta)}
(Dans le bilan, les types bike, badminton, swim, hike et other désignent des activités que l'athlète a faites à la place de la séance prévue. Ne les utilise pas dans le plan généré : une séance de vélo ou de badminton s'écrit \`cross\`.)
IDs de session : s{NN}-{daycode} (ex: s01-mon, s03-thu)
`;
}

function openPromptModal(title, prompt) {
  const modal = document.createElement('div');
  modal.className = 'export-modal';
  modal.innerHTML = `
    <div class="export-modal__overlay"></div>
    <div class="export-modal__panel">
      <div class="export-modal__header">
        <span class="export-modal__title">${title}</span>
        <button class="export-modal__close" id="modal-close">✕</button>
      </div>
      <div class="export-modal__hint">
        Copie ce texte et envoie-le à Claude pour obtenir le plan au format .md à importer.
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
