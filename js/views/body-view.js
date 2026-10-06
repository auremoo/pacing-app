// Entraînement → Suivi : pesées et courbe du poids.
// Onglet affiché quand « Suivre mon poids » est activé dans Réglages.

import { showToast } from '../app.js';
import { getBodyEntries, saveBodyEntry, deleteBodyEntry } from '../store.js';
import { today, formatDateShort } from '../utils/dates.js';
import { latestEntry, weightChange, fmtDelta, fmtKg, weightTarget, renderWeightChart } from '../utils/body.js';

export function mount(container) {
  render(container);
}

function render(container) {
  const entries = getBodyEntries();
  const last    = latestEntry(entries);
  const c4      = weightChange(28, entries);
  const target  = weightTarget();

  container.innerHTML = `
    <div class="form-page-body" style="padding-top:var(--space-4)">

      ${last ? `
      <div class="body-summary">
        <div class="body-summary__item">
          <span class="body-summary__label">Dernière pesée</span>
          <span class="body-summary__value">${fmtKg(last.weight)}</span>
          <span class="body-summary__sub">${formatDateShort(last.date)}</span>
        </div>
        <div class="body-summary__item">
          <span class="body-summary__label">Sur 4 semaines</span>
          <span class="body-summary__value">${c4 ? fmtDelta(c4.delta) : '—'}</span>
          <span class="body-summary__sub">${c4 ? `depuis le ${formatDateShort(c4.since)}` : 'pas encore assez de recul'}</span>
        </div>
        ${target != null ? `
        <div class="body-summary__item">
          <span class="body-summary__label">Objectif</span>
          <span class="body-summary__value">${fmtKg(target)}</span>
          <span class="body-summary__sub">reste ${fmtDelta(Math.round((target - last.weight) * 10) / 10)}</span>
        </div>` : ''}
      </div>` : ''}

      ${entries.length >= 2 ? `<div class="card-group" style="margin:0 var(--space-4) var(--space-4);padding:var(--space-3)">${renderWeightChart(entries, target)}</div>` : ''}

      <p class="section-header">Nouvelle pesée</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-2)">
        <div class="form-field">
          <label class="form-label">Date</label>
          <input class="form-input" id="b-date" type="date" value="${today()}" max="${today()}">
        </div>
        <div class="form-field">
          <label class="form-label">Poids (kg)</label>
          <input class="form-input" id="b-weight" type="text" inputmode="decimal" placeholder="ex : 62,4">
        </div>
        <div class="form-field">
          <label class="form-label">Tour de taille (cm, facultatif)</label>
          <input class="form-input" id="b-waist" type="text" inputmode="decimal" placeholder="ex : 72">
        </div>
      </div>
      <div style="padding:0 var(--space-4) var(--space-2)">
        <button class="btn btn--primary btn--full" id="b-save">Enregistrer la pesée</button>
      </div>
      <p class="type-picker__hint" style="padding:0 var(--space-4) var(--space-4)">Une pesée par semaine suffit, de préférence le même jour, le matin. L'évolution est transmise à l'IA dans les prompts du plan général. Un objectif de poids se fixe dans Contexte → Objectifs perso.</p>

      ${entries.length ? `
      <p class="section-header">Historique</p>
      <div class="card-group" style="margin:0 var(--space-4) var(--space-4)">
        ${entries.slice().reverse().map(e => `
        <div class="list-row" style="cursor:default">
          <div class="list-row__content">
            <div class="list-row__title">${fmtKg(e.weight)}${e.waist ? ` · ${String(e.waist).replace('.', ',')} cm` : ''}</div>
            <div class="list-row__subtitle">${formatDateShort(e.date)} ${e.date.slice(0, 4)}</div>
          </div>
          <button class="target-remove" data-body-del="${e.date}" aria-label="Supprimer la pesée du ${e.date}">✕</button>
        </div>`).join('')}
      </div>` : ''}

      <div style="height:var(--space-8)"></div>
    </div>
  `;

  const num = id => parseFloat(container.querySelector(id).value.replace(',', '.'));

  container.querySelector('#b-save').addEventListener('click', async () => {
    const btn = container.querySelector('#b-save');
    const date = container.querySelector('#b-date').value;
    const weight = num('#b-weight');
    const waist  = num('#b-waist');
    if (!date)                              { showToast('Indique la date', 'error'); return; }
    if (!(weight > 20 && weight < 400))     { showToast('Poids invalide', 'error'); return; }
    btn.disabled = true;
    try {
      await saveBodyEntry({ date, weight, waist: waist > 0 ? waist : null });
      showToast('Pesée enregistrée', 'success');
      render(container);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      btn.disabled = false;
    }
  });

  container.querySelectorAll('[data-body-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Supprimer cette pesée ?')) return;
    btn.disabled = true;
    try {
      await deleteBodyEntry(btn.dataset.bodyDel);
      render(container);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      btn.disabled = false;
    }
  }));
}
