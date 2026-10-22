// Import d'un plan par collage : la réponse de Claude collée telle quelle,
// sans passer par un fichier (souvent plus simple sur iPhone).

// Retire ce qui entoure le plan : bloc ```markdown … ```, phrase d'intro avant
// le titre « # PLAN… ».
export function cleanPastedPlan(raw) {
  let text = String(raw || '').replace(/\r\n/g, '\n').trim();
  const fenced = [...text.matchAll(/```[a-zA-Z]*\n([\s\S]*?)```/g)].map(m => m[1]).find(b => b.includes('## SEMAINES'));
  if (fenced) text = fenced.trim();
  text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  const title = text.search(/^# /m);
  if (title > 0) text = text.slice(title);
  return text;
}

// Modale de collage → Promise<string|null> (texte nettoyé, ou null si annulé).
export function openPasteModal() {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `
      <div class="export-modal__overlay"></div>
      <div class="export-modal__panel">
        <div class="export-modal__header">
          <span class="export-modal__title">Coller le plan</span>
          <button class="export-modal__close" data-paste-close aria-label="Fermer">✕</button>
        </div>
        <div class="export-modal__hint">Colle ici tout le plan renvoyé par Claude (le contenu du fichier .md, ou son bloc de code).</div>
        <textarea class="export-modal__textarea" data-paste-text placeholder="# PLAN…" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
        <div class="paste-error" data-paste-error></div>
        <button class="btn btn--primary btn--full" data-paste-go>Importer</button>
      </div>`;
    document.body.appendChild(modal);
    const area = modal.querySelector('[data-paste-text]');
    setTimeout(() => area.focus(), 50);
    const close = (v) => { modal.remove(); resolve(v); };
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-paste-close]') || e.target.classList.contains('export-modal__overlay')) return close(null);
      if (!e.target.closest('[data-paste-go]')) return;
      const text = cleanPastedPlan(area.value);
      if (!text.includes('## META') || !text.includes('## SEMAINES')) {
        modal.querySelector('[data-paste-error]').textContent = "Ce texte ne ressemble pas à un plan : il faut les sections « ## META » et « ## SEMAINES ».";
        return;
      }
      close(text);
    });
  });
}
