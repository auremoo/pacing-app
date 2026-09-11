// Modale "copier un prompt" partagée par les vues qui génèrent des prompts
// (versions de plan, stratégie de course).

import { showToast } from '../app.js';

export function openPromptModal(title, prompt, hint = 'Copie ce texte et envoie-le à Claude pour obtenir le plan au format .md à importer.') {
  const modal = document.createElement('div');
  modal.className = 'export-modal';
  modal.innerHTML = `
    <div class="export-modal__overlay"></div>
    <div class="export-modal__panel">
      <div class="export-modal__header">
        <span class="export-modal__title">${escHtml(title)}</span>
        <button class="export-modal__close" id="modal-close">✕</button>
      </div>
      <div class="export-modal__hint">${escHtml(hint)}</div>
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

export function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
