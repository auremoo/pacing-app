// Image en plein écran, zoomable : pincer ou double-toucher pour zoomer,
// glisser pour se déplacer dans l'image zoomée ; molette et double-clic sur
// ordinateur. Échap ou la croix pour fermer.
//
// Le zoom est géré à la main (pointer events + transform) : le viewport de
// l'app ne laisse pas le navigateur zoomer la page, et un zoom natif agrandirait
// toute l'interface au lieu de la seule image.

const MAX_SCALE = 6;
const DOUBLE_TAP_MS = 300;

export function openImageViewer(src, title = '') {
  const modal = document.createElement('div');
  modal.className = 'image-viewer';
  modal.innerHTML = `
    <div class="image-viewer__bar">
      <span class="image-viewer__title">${escHtml(title)}</span>
      <button class="image-viewer__close" aria-label="Fermer">✕</button>
    </div>
    <div class="image-viewer__stage">
      <img class="image-viewer__img" src="${src}" alt="${escHtml(title)}" draggable="false">
    </div>
    <div class="image-viewer__hint">Pince ou touche deux fois pour zoomer</div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  const stage = modal.querySelector('.image-viewer__stage');
  const img   = modal.querySelector('.image-viewer__img');
  let scale = 1, x = 0, y = 0;
  const pointers = new Map();
  let pinch = null;      // { dist, scale, cx, cy, x, y }
  let pan = null;        // { px, py, x, y }
  let lastTap = 0;

  // Garde l'image dans le cadre : pas de bord vide tant qu'elle est plus
  // grande que l'écran, centrée sinon.
  function clamp() {
    const r = stage.getBoundingClientRect();
    const w = img.offsetWidth * scale, h = img.offsetHeight * scale;
    const mx = Math.max(0, (w - r.width) / 2), my = Math.max(0, (h - r.height) / 2);
    x = Math.min(mx, Math.max(-mx, x));
    y = Math.min(my, Math.max(-my, y));
  }
  function apply(animate = false) {
    if (scale <= 1) { scale = 1; x = 0; y = 0; }
    clamp();
    img.style.transition = animate ? 'transform 0.2s ease' : 'none';
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }
  // Zoom autour d'un point de l'écran (coordonnées relatives au centre du cadre).
  function zoomAt(newScale, cx, cy) {
    newScale = Math.min(MAX_SCALE, Math.max(1, newScale));
    const k = newScale / scale;
    x = cx - (cx - x) * k;
    y = cy - (cy - y) * k;
    scale = newScale;
  }
  function fromCenter(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    return [clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2)];
  }

  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const [cx, cy] = fromCenter((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale, cx, cy, x, y };
      pan = null;
    } else if (pointers.size === 1) {
      pan = { px: e.clientX, py: e.clientY, x, y };
    }
  });

  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      scale = pinch.scale; x = pinch.x; y = pinch.y;
      zoomAt(pinch.scale * dist / pinch.dist, pinch.cx, pinch.cy);
      apply();
    } else if (pan && scale > 1) {
      x = pan.x + (e.clientX - pan.px);
      y = pan.y + (e.clientY - pan.py);
      apply();
    }
  });

  const release = e => {
    const moved = pan && Math.hypot(e.clientX - pan.px, e.clientY - pan.py) > 8;
    const wasSingle = pointers.size === 1 && !pinch;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      pan = { px: p.x, py: p.y, x, y };
    } else if (!pointers.size) {
      pan = null;
      apply(true);
    }
    // Double toucher : zoom ×2,5 sur le point touché, ou retour à la taille normale.
    if (e.type === 'pointerup' && wasSingle && !moved) {
      const now = Date.now();
      if (now - lastTap < DOUBLE_TAP_MS) {
        const [cx, cy] = fromCenter(e.clientX, e.clientY);
        if (scale > 1) scale = 1; else zoomAt(2.5, cx, cy);
        apply(true);
        lastTap = 0;
      } else lastTap = now;
    }
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const [cx, cy] = fromCenter(e.clientX, e.clientY);
    zoomAt(scale * Math.exp(-e.deltaY / 300), cx, cy);
    apply();
  }, { passive: false });

  const close = () => {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  modal.querySelector('.image-viewer__close').addEventListener('click', close);
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
