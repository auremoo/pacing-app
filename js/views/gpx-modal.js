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

const CHART_WIDTH = 800;   // largeur du viewBox, voir gpx-parser.js

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

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
      <div class="gpx-modal__chart" id="gpx-modal-chart"></div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  // Le viewBox est calculé d'après la place réellement disponible : à ratio
  // figé, le tracé se retrouvait bordé de bandes vides. clientWidth/Height sont
  // lus plutôt que getBoundingClientRect(), qui renvoie des dimensions
  // inversées dans une scène pivotée.
  const chartEl = modal.querySelector('#gpx-modal-chart');
  const READOUT_H = 34;
  const usableH = Math.max(120, chartEl.clientHeight - READOUT_H);
  // Plafonné à la moitié de la largeur : au-delà, un dénivelé de quelques
  // dizaines de mètres se retrouve étiré sur toute la hauteur d'un écran
  // d'ordinateur et ne ressemble plus au terrain.
  const height  = clamp(Math.round(CHART_WIDTH * usableH / (chartEl.clientWidth || CHART_WIDTH)), 200, CHART_WIDTH / 2);

  chartEl.innerHTML = renderElevationChart(data.profile, { maxTicks: 10, height });
  // La mesure faite, le conteneur se règle sur le graphique : il reste ainsi
  // sans marge vide au-dessus et en dessous du tracé.
  chartEl.style.flex = '0 1 auto';

  attachElevationCursor(chartEl, data);

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
