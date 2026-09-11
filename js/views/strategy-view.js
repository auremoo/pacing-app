// Onglet Stratégie : disponible une fois la préparation terminée (dernière
// séance d'entraînement du plan traitée, course exclue). Génère le bilan
// consolidé + le prompt d'analyse, puis accueille la réponse de l'IA.

import { getEventMeta, getAthleteProfile, getCourseFile,
         savePrepReport, saveRaceStrategy, getRaceStrategy } from '../store.js';
import { showToast } from '../app.js';
import { openPromptModal, escHtml } from '../utils/prompt-modal.js';
import { renderMarkdown } from '../utils/markdown.js';
import { parseGpx, splitByKm } from '../utils/gpx-parser.js';
import { loadAllPlanVersions, buildConsolidatedHistory, buildPrepReportMarkdown,
         buildStrategyPrompt, isPrepComplete, getLastTrainingSession } from '../utils/prep-report.js';
import { formatDate } from '../utils/dates.js';

export async function mount(container, slug) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Chargement…</span></div>`;

  const meta     = getEventMeta(slug);
  const strategy = await getRaceStrategy(slug).catch(() => null);

  render(container, slug, meta, strategy);
}

function render(container, slug, meta, strategy) {
  const ready = isPrepComplete(slug);
  const last  = getLastTrainingSession(slug);

  container.innerHTML = `
    ${strategy ? renderStrategy(meta, strategy) : renderIntro(ready, last, meta)}

    <div style="padding:0 var(--space-4) var(--space-4)">
      <button class="btn ${strategy ? 'btn--ghost' : 'btn--primary'} btn--full" id="gen-btn" ${ready ? '' : 'disabled'}>
        ✦ ${strategy ? 'Regénérer le bilan et le prompt' : 'Générer le bilan et le prompt'}
      </button>
    </div>

    <div style="padding:0 var(--space-4) var(--space-4)">
      <button class="btn btn--secondary btn--full" id="import-btn">
        ${strategy ? 'Remplacer la stratégie' : 'Importer la stratégie (.md)'}
      </button>
      <input type="file" id="strategy-input" accept=".md,text/markdown,text/plain" style="display:none">
    </div>

    <div id="strategy-status" style="padding:0 var(--space-4) var(--space-6);font-size:14px;color:var(--text-secondary)"></div>
  `;

  container.querySelector('#gen-btn').addEventListener('click', () => generate(container, slug));

  container.querySelector('#import-btn').addEventListener('click', () => {
    container.querySelector('#strategy-input').click();
  });

  container.querySelector('#strategy-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await handleImport(container, slug, file);
    e.target.value = '';
  });
}

function renderIntro(ready, last, meta) {
  if (!ready) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">🏁</div>
        <div class="empty-state__title">Préparation en cours</div>
        <div class="empty-state__body">
          Le bilan se génère une fois ta dernière séance d'entraînement traitée${
            last ? `, le <strong>${formatDate(last.date)}</strong> (${escHtml(last.title)})` : ''
          } — faite ou manquée, peu importe. Tu pourras alors demander à Claude une stratégie de course fondée sur ta prépa réelle.
        </div>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <div class="empty-state__icon">✦</div>
      <div class="empty-state__title">Préparation terminée</div>
      <div class="empty-state__body">
        Génère le bilan consolidé de ta prépa — toutes versions de plan confondues — et le prompt qui va avec.
        Claude choisira lui-même l'objectif atteignable au vu de ce que tu as réellement fait, et te donnera
        un plan d'allure pour le ${formatDate(meta.raceDate)}.
      </div>
    </div>
  `;
}

function renderStrategy(meta, strategy) {
  const importedAt = meta?.strategy?.importedAt
    ? new Date(meta.strategy.importedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return `
    ${importedAt ? `<p class="section-header">Stratégie importée le ${importedAt}</p>` : ''}
    <div class="markdown-body" style="padding:var(--space-4)">${renderMarkdown(strategy)}</div>
  `;
}

// ── Génération du bilan + prompt ──────────────────────────────────

async function generate(container, slug) {
  const status = container.querySelector('#strategy-status');
  const btn    = container.querySelector('#gen-btn');
  btn.disabled = true;
  status.textContent = 'Consolidation des versions du plan…';

  try {
    await loadAllPlanVersions(slug);
    const history = buildConsolidatedHistory(slug);

    // Profil du parcours : uniquement si une trace GPX est présente
    let kms = null, gpxTotals = null;
    if (getEventMeta(slug)?.course?.gpx) {
      status.textContent = 'Lecture de la trace GPX…';
      try {
        const gpxFile = await getCourseFile(slug, 'gpx');
        const data    = gpxFile ? parseGpx(gpxFile.content) : null;
        if (data) {
          kms = splitByKm(data.profile);
          const { profile, ...totals } = data;
          gpxTotals = totals;
        }
      } catch { /* le prompt reste valable sans GPX */ }
    }

    status.textContent = 'Écriture du bilan sur GitHub…';
    const report = buildPrepReportMarkdown(slug, history);
    await savePrepReport(slug, report);

    const prompt = buildStrategyPrompt(slug, history, getAthleteProfile(), kms, gpxTotals);
    status.textContent = `Bilan enregistré dans events/${slug}/bilan.md`;
    showToast('Bilan généré', 'success');

    openPromptModal(
      'Prompt de stratégie de course',
      prompt,
      'Copie ce texte et envoie-le à Claude, puis importe le .md de réponse ci-dessous.'
    );
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
    status.textContent = '';
  } finally {
    btn.disabled = false;
  }
}

async function handleImport(container, slug, file) {
  const status = container.querySelector('#strategy-status');
  status.textContent = 'Lecture du fichier…';

  const text = await file.text();
  if (!text.trim()) {
    showToast('Fichier vide', 'error');
    status.textContent = '';
    return;
  }

  status.textContent = 'Upload vers GitHub…';
  try {
    await saveRaceStrategy(slug, text);
    showToast('Stratégie importée !', 'success');
    await mount(container, slug);
  } catch (err) {
    showToast('Erreur upload : ' + err.message, 'error');
    status.textContent = '';
  }
}
