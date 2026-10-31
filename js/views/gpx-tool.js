// Étudier un GPX sans l'enregistrer (route /gpx) : on ouvre un fichier, on
// regarde son profil, et rien n'est écrit sur GitHub. Le tracé vit dans une
// variable du module : il reste là si on change d'écran, et disparaît quand on
// quitte ou recharge l'app. Pour garder un parcours, il faut l'importer dans
// une course (Parcours → Importer un GPX).

import { navigate, showToast } from '../app.js';
import { isAuthenticated } from '../utils/users.js';
import { parseGpx, splitByKm, renderElevationChart, attachElevationCursor } from '../utils/gpx-parser.js';
import { openGpxModal } from './gpx-modal.js';

let _study = null;   // { name, data, kms }

export function mount(container) {
  container.innerHTML = `
    <div class="nav-bar">
      <button class="nav-btn" id="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        Retour
      </button>
      <span class="nav-bar__title">Étudier un GPX</span>
      <span class="nav-btn" aria-hidden="true"></span>
    </div>
    <div class="scroll-view">
      <div class="gpx-tool">${_study ? renderStudy(_study) : renderEmpty()}</div>
      <input type="file" id="gpx-tool-input" accept=".gpx,application/gpx+xml" style="display:none">
      <div style="height:var(--space-8)"></div>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    if (history.length > 1) history.back(); else navigate(isAuthenticated() ? '/courses' : '/');
  });

  const input = container.querySelector('#gpx-tool-input');
  container.querySelectorAll('[data-gpx-pick]').forEach(b => b.addEventListener('click', () => input.click()));
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    let data = null;
    try { data = parseGpx(await file.text()); } catch { /* fichier illisible */ }
    if (!data) { showToast("Ce fichier ne contient pas de tracé lisible", 'error'); input.value = ''; return; }
    _study = { name: file.name.replace(/\.gpx$/i, ''), data, kms: splitByKm(data.profile) };
    mount(container);
  });

  container.querySelector('#gpx-tool-clear')?.addEventListener('click', () => { _study = null; mount(container); });

  if (_study) {
    const chartEl = container.querySelector('.elevation-chart-container');
    attachElevationCursor(chartEl, _study.data, {
      onTap: () => openGpxModal(_study.data, _study.name),
      hint:  'Touchez pour agrandir, glissez pour le détail',
    });
  }
}

function renderEmpty() {
  return `
    <div class="course-import-area" data-gpx-pick>
      <div style="font-size:32px;margin-bottom:var(--space-2)">🗺️</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">Ouvrir un fichier GPX</div>
      <div style="font-size:13px;color:var(--text-secondary)">Strava, Garmin, Komoot, gpx.studio…</div>
      <button class="btn btn--secondary" style="margin-top:var(--space-3)">Choisir un fichier</button>
    </div>
    <p class="gpx-tool__note">Rien n'est enregistré : le fichier reste sur cet écran jusqu'à ce que tu quittes l'app.${isAuthenticated() ? " Pour garder le parcours d'une course, importe-le dans sa page Parcours." : ''}</p>
  `;
}

function renderStudy({ name, data, kms }) {
  return `
    <p class="section-header">${escHtml(name)}</p>
    <div class="elevation-chart-container">
      ${renderElevationChart(data.profile)}
    </div>
    <div class="course-stats">
      ${stat('Distance', `${data.distanceKm} km`)}
      ${stat('D+', `${data.elevationGainM} m`)}
      ${stat('D-', `${data.elevationLossM} m`)}
      ${stat('Alt. min–max', `${data.minElevationM}–${data.maxElevationM} m`)}
    </div>
    ${kms.length ? `
    <p class="section-header">Kilomètre par kilomètre</p>
    <div class="gpx-km-table">
      <table>
        <thead><tr><th>Km</th><th>D+</th><th>D-</th><th>Pente</th><th>Alt. (m)</th></tr></thead>
        <tbody>
          ${kms.map(k => {
            const slope = k.lengthM ? Math.round((k.endEleM - k.startEleM) / k.lengthM * 1000) / 10 : 0;
            return `<tr>
              <td>${k.lengthM < 1000 ? `${k.km - 1}–${(k.km - 1 + k.lengthM / 1000).toFixed(2).replace('.', ',')}` : k.km}</td>
              <td>${k.gainM ? `+${k.gainM}` : '0'}</td>
              <td>${k.lossM ? `−${k.lossM}` : '0'}</td>
              <td class="${Math.abs(slope) >= 3 ? 'gpx-km-table__steep' : ''}">${slope > 0 ? '+' : slope < 0 ? '−' : ''}${String(Math.abs(slope)).replace('.', ',')} %</td>
              <td>${k.startEleM} → ${k.endEleM}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="gpx-tool__note">Pente moyenne entre le début et la fin de chaque kilomètre. Les altitudes d'un tracé dessiné (gpx.studio, Komoot) viennent d'un modèle de terrain : le dénivelé est une estimation.</p>` : ''}
    <div style="padding:0 var(--space-4);display:flex;gap:var(--space-2)">
      <button class="btn btn--secondary" data-gpx-pick style="flex:1">Ouvrir un autre fichier</button>
      <button class="btn btn--ghost" id="gpx-tool-clear" style="flex:1">Fermer</button>
    </div>
    <p class="gpx-tool__note">Rien n'est enregistré : ce tracé disparaît quand tu quittes l'app.</p>
  `;
}

function stat(label, value) {
  return `<div class="course-stat">
    <div class="course-stat__label">${label}</div>
    <div class="course-stat__value">${value}</div>
  </div>`;
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
