// Saisie du résultat, proposée juste après la clôture d'un événement — le
// chrono est frais, c'est le bon moment pour le noter. Reprend la feuille
// modale des prompts (.export-modal) plutôt que d'en inventer une autre.

import { getEventMeta, saveRaceResult } from '../store.js';
import { showToast } from '../app.js';

export function openRaceResultModal(slug) {
  const meta = getEventMeta(slug);
  if (!meta) return;
  const r = meta.result || {};

  const modal = document.createElement('div');
  modal.className = 'export-modal';
  modal.innerHTML = `
    <div class="export-modal__overlay"></div>
    <div class="export-modal__panel">
      <div class="export-modal__header">
        <span class="export-modal__title">🏁 ${escHtml(meta.name)} — terminée</span>
        <button class="export-modal__close" id="result-modal-close" aria-label="Fermer">✕</button>
      </div>
      <div class="export-modal__hint">
        Course clôturée. Note ton résultat pendant que tu l'as en tête — tu
        pourras toujours le corriger depuis l'onglet Parcours.
      </div>

      <div class="form-group">
        <label class="form-label">Temps final</label>
        <input class="input-field" id="result-time" type="text" placeholder="ex : 1h52'34" value="${escHtml(r.time || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Allure moyenne</label>
        <input class="input-field" id="result-pace" type="text" placeholder="ex : 5'20&quot;/km" value="${escHtml(r.pacePerKm || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Lien de l'activité (optionnel)</label>
        <input class="input-field" id="result-url" type="url" inputmode="url" placeholder="Strava, Garmin…" value="${escHtml(r.activityUrl || '')}">
      </div>

      <div class="export-modal__footer">
        <button class="btn btn--primary" id="result-save" style="flex:1">Enregistrer</button>
        <button class="btn btn--secondary" id="result-later" style="flex:1">Plus tard</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#result-modal-close').addEventListener('click', close);
  modal.querySelector('#result-later').addEventListener('click', close);
  modal.querySelector('.export-modal__overlay').addEventListener('click', close);

  const saveBtn = modal.querySelector('#result-save');
  saveBtn.addEventListener('click', async () => {
    const result = {
      time:        modal.querySelector('#result-time').value.trim(),
      pacePerKm:   modal.querySelector('#result-pace').value.trim(),
      activityUrl: modal.querySelector('#result-url').value.trim() || null,
    };
    if (!result.time && !result.pacePerKm && !result.activityUrl) { close(); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Enregistrement…';
    try {
      await saveRaceResult(slug, result);
      showToast('Résultat enregistré', 'success');
      close();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Enregistrer';
    }
  });

  modal.querySelector('#result-time').focus();
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
