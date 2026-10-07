// Réglages d'un plan, choisis juste avant de générer un prompt (initial ou
// révision, course ou plan général) : « plus de sorties longues », « moins de
// cardio »… sur 5 crans relatifs, plutôt qu'une note de 1 à 5 que l'IA ne
// saurait pas à quoi rapporter.
//
// Tout part au milieu à chaque fois : on ne touche que ce qu'on veut changer.
// En révision le milieu veut dire « comme maintenant », pour un premier plan
// « l'IA décide ». Les réglages retenus sont gardés dans le meta
// (`pendingTuning`) et recopiés sur la version importée ensuite (`tuning`),
// pour qu'on voie plus tard ce qui avait été demandé.

import { doesRun, doesGym } from './sports.js';

export const TUNING_GROUPS = [
  { id: 'general', label: 'En général', params: [
    { id: 'difficulty', label: 'Difficulté générale' },
    { id: 'sessions',   label: 'Séances par semaine' },
    { id: 'recovery',   label: 'Repos et récupération' },
  ] },
  { id: 'running', label: 'Course à pied', params: [
    { id: 'long',      label: 'Sorties longues' },
    { id: 'intervals', label: 'Fractionné / VMA' },
    { id: 'tempo',     label: 'Seuil / tempo' },
    { id: 'hills',     label: 'Côtes' },
    { id: 'volume',    label: 'Volume (km)' },
  ] },
  { id: 'gym', label: 'Salle', params: [
    { id: 'gym',      label: 'Musculation' },
    { id: 'cardio',   label: 'Cardio' },
    { id: 'mobility', label: 'Mobilité / étirements' },
  ] },
];

const STEPS = [-2, -1, 0, 1, 2];
const STEP_LABEL = { '-2': 'Beaucoup moins', '-1': 'Moins', 1: 'Plus', 2: 'Beaucoup plus' };
const STEP_SHORT = { '-2': '−−', '-1': '−', 0: '=', 1: '+', 2: '++' };

function middleLabel(isRevision) { return isRevision ? 'Comme maintenant' : "L'IA décide"; }

export function stepLabel(value, isRevision) {
  return value === 0 ? middleLabel(isRevision) : STEP_LABEL[value];
}

// Groupes affichés : le général toujours, la course pour qui court (et toujours
// pour un plan de course), la salle pour qui y va.
export function tuningGroups({ race = false } = {}) {
  return TUNING_GROUPS.filter(g =>
    g.id === 'general' || (g.id === 'running' && (race || doesRun())) || (g.id === 'gym' && doesGym()));
}

export function isEmptyTuning(t) {
  return !t || (!Object.values(t.values || {}).some(Boolean) && !(t.note || '').trim());
}

// Résumé court pour la carte d'une version : « Sorties longues + · Fractionné ++ ».
export function tuningSummary(t) {
  if (isEmptyTuning(t)) return '';
  const params = TUNING_GROUPS.flatMap(g => g.params);
  const parts = Object.entries(t.values || {}).filter(([, v]) => v)
    .map(([id, v]) => `${params.find(p => p.id === id)?.label || id} ${STEP_SHORT[v]}`);
  if ((t.note || '').trim()) parts.push('note');
  return parts.join(' · ');
}

// Section du prompt. '' si rien n'a été touché.
export function tuningSection(t, isRevision) {
  if (isEmptyTuning(t)) return '';
  const params = TUNING_GROUPS.flatMap(g => g.params);
  const lines = Object.entries(t.values || {}).filter(([, v]) => v)
    .map(([id, v]) => `- ${params.find(p => p.id === id)?.label || id} : **${STEP_LABEL[v].toLowerCase()}**`);
  const note = (t.note || '').trim();
  return `
## 🎚️ Réglages demandés pour ${isRevision ? 'cette nouvelle version' : 'ce plan'}

${lines.length ? `${isRevision ? 'Par rapport au plan actuel' : 'Mes préférences'} :\n${lines.join('\n')}\n` : ''}${note ? `\nEn plus : ${note}\n` : ''}
${lines.length ? `Ce qui n'est pas listé reste ${isRevision ? 'comme dans le plan actuel' : 'à ton appréciation'}. ` : ''}Applique ces réglages, mais sans dépasser ce que je peux encaisser : progressivité de la charge, récupération, points de vigilance. S'ils se contredisent ou te paraissent risqués, arbitre et explique ton choix dans la SYNTHESE.
`;
}

// Insère la section juste avant le format de sortie (pour qu'elle soit lue
// avec le contexte), ou à la fin à défaut.
export function withTuning(prompt, t, isRevision) {
  const section = tuningSection(t, isRevision);
  if (!section) return prompt;
  const at = prompt.search(/(\*\*|## )FORMAT DE SORTIE/);
  if (at < 0) return `${prompt.trimEnd()}\n${section}`;
  return `${prompt.slice(0, at)}${section.trimStart()}\n---\n\n${prompt.slice(at)}`;
}

// Écran de réglage. Résout avec { values, note } (éventuellement vide si
// « Passer »), ou null si on ferme sans générer.
export function openTuningModal({ title, isRevision, race = false }) {
  return new Promise(resolve => {
    const groups = tuningGroups({ race });
    const values = {};
    const modal = document.createElement('div');
    modal.className = 'export-modal tuning-modal';
    modal.innerHTML = `
      <div class="export-modal__overlay"></div>
      <div class="export-modal__panel">
        <div class="export-modal__header">
          <span class="export-modal__title">${title}</span>
          <button class="export-modal__close" data-tuning-close aria-label="Fermer">✕</button>
        </div>
        <div class="export-modal__hint">
          ${isRevision
            ? 'Ce que tu veux changer par rapport au plan actuel. Touche seulement ce qui compte, le reste ne bouge pas.'
            : "Tes préférences pour ce plan. Au milieu, c'est l'IA qui décide."}
        </div>
        <div class="tuning">
          ${groups.map(g => `
            <p class="tuning__group">${g.label}</p>
            ${g.params.map(p => `
              <div class="tuning__row">
                <div class="tuning__label">${p.label}<span class="tuning__value" data-tuning-value="${p.id}">${middleLabel(isRevision)}</span></div>
                <div class="tuning__steps" role="radiogroup" aria-label="${p.label}">
                  ${STEPS.map(s => `<button type="button" class="tuning__step ${s === 0 ? 'tuning__step--on' : ''}"
                    data-param="${p.id}" data-step="${s}" aria-pressed="${s === 0}" aria-label="${stepLabel(s, isRevision)}">${STEP_SHORT[s]}</button>`).join('')}
                </div>
              </div>`).join('')}
          `).join('')}
          <p class="tuning__group">Autre chose à dire ?</p>
          <textarea class="textarea-field" data-tuning-note rows="3"
            placeholder="${isRevision ? 'Ex : la sortie longue plutôt le samedi, je pars en vacances du 12 au 19' : 'Ex : pas de séance le dimanche, je préfère courir le matin'}"></textarea>
        </div>
        <div class="tuning__actions">
          <button class="btn btn--secondary" data-tuning-skip style="flex:1">Passer</button>
          <button class="btn btn--primary" data-tuning-go style="flex:2">Générer le prompt</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = (result) => { modal.remove(); document.removeEventListener('keydown', onKey); resolve(result); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);

    modal.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      if (step) {
        const id = step.dataset.param, v = parseInt(step.dataset.step);
        if (v) values[id] = v; else delete values[id];
        modal.querySelectorAll(`[data-param="${id}"]`).forEach(b => {
          const on = b === step;
          b.classList.toggle('tuning__step--on', on);
          b.setAttribute('aria-pressed', String(on));
        });
        const label = modal.querySelector(`[data-tuning-value="${id}"]`);
        label.textContent = stepLabel(v, isRevision);
        label.classList.toggle('tuning__value--set', v !== 0);
        return;
      }
      if (e.target.closest('[data-tuning-close]') || e.target.classList.contains('export-modal__overlay')) return close(null);
      if (e.target.closest('[data-tuning-skip]')) return close({ values: {}, note: '' });
      if (e.target.closest('[data-tuning-go]')) {
        return close({ values: { ...values }, note: modal.querySelector('[data-tuning-note]').value.trim() });
      }
    });
  });
}
