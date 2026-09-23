// Profil altimétrique en plein écran.
//
// Sur téléphone, le profil d'un parcours est illisible dans la largeur d'un
// écran tenu à la verticale : on pivote la scène de 90° pour occuper toute la
// hauteur, l'utilisateur tourne son téléphone. iOS Safari n'expose pas
// screen.orientation.lock(), la rotation CSS est le seul moyen fiable.
//
// La croix est placée DANS la scène pivotée : elle reste en haut à gauche de
// ce que l'utilisateur regarde, pas du téléphone.

import { renderElevationChart, attachElevationCursor } from '../utils/gpx-parser.js';

export function openGpxModal(data, title = '') {
  if (!data?.profile?.length) return;

  const rotated = window.innerWidth < window.innerHeight;

  const modal = document.createElement('div');
  modal.className = 'gpx-modal';
  modal.innerHTML = `
    <div class="gpx-modal__stage ${rotated ? 'gpx-modal__stage--rotated' : ''}">
      <div class="gpx-modal__bar">
        <button class="gpx-modal__close" id="gpx-modal-close" aria-label="Fermer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <span class="gpx-modal__title">${escHtml(title)}</span>
        <span class="gpx-modal__stats">${data.distanceKm} km · D+ ${data.elevationGainM} m · D- ${data.elevationLossM} m</span>
      </div>
      <div class="gpx-modal__chart" id="gpx-modal-chart">
        ${renderElevationChart(data.profile, { maxTicks: 10, height: 400 })}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  attachElevationCursor(modal.querySelector('#gpx-modal-chart'), data);

  const close = () => {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };

  modal.querySelector('#gpx-modal-close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
