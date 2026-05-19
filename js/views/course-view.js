import { getEventMeta, importCourseFile, getCourseFile } from '../store.js';
import { showToast } from '../app.js';
import { parseGpx, renderElevationChart } from '../utils/gpx-parser.js';

export async function mount(container, slug) {
  const meta = getEventMeta(slug);

  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Chargement…</span></div>`;

  if (meta?.course?.filename) {
    try {
      const file = await getCourseFile(slug);
      if (file) {
        renderCourse(container, slug, meta.course.filename, file.content);
        return;
      }
    } catch { /* fall through to upload UI */ }
  }

  renderUploadUI(container, slug, meta);
}

function renderCourse(container, slug, filename, content) {
  const ext = filename.split('.').pop().toLowerCase();

  let chartHtml = '';
  let statsHtml = '';

  if (ext === 'gpx') {
    try {
      const data = parseGpx(content);
      if (data) {
        chartHtml = `
          <div class="elevation-chart-container">
            ${renderElevationChart(data.profile)}
          </div>`;
        statsHtml = `
          <div class="course-stats">
            ${stat('Distance', `${data.distanceKm} km`)}
            ${stat('D+', `${data.elevationGainM} m`)}
            ${stat('D-', `${data.elevationLossM} m`)}
            ${stat('Alt. max', `${data.maxElevationM} m`)}
          </div>`;
      }
    } catch { /* ignore parse errors */ }
  }

  container.innerHTML = `
    ${chartHtml}
    ${statsHtml}
    <p class="section-header">Fichier parcours</p>
    <div class="card-group" style="margin:0 var(--space-4)">
      <div class="list-row" style="cursor:default">
        <div class="list-row__content">
          <div class="list-row__title">${filename}</div>
          <div class="list-row__subtitle">${ext.toUpperCase()} · Importé dans GitHub</div>
        </div>
      </div>
      ${ext === 'pdf' ? `
        <a class="list-row" href="data:application/pdf;base64,${content.replace(/\n/g,'')}" download="${filename}">
          <div class="list-row__content"><div class="list-row__title">Télécharger le PDF</div></div>
          <span class="list-row__chevron">↓</span>
        </a>` : ''}
    </div>
    <div style="padding:var(--space-4)">
      <button class="btn btn--ghost" id="replace-btn">Remplacer le fichier</button>
      <input type="file" id="course-input" accept=".gpx,.pdf,.json,application/pdf,application/json" style="display:none">
    </div>
  `;

  attachUploadListener(container, slug);
}

function renderUploadUI(container, slug, meta) {
  container.innerHTML = `
    <div style="padding:var(--space-4)">
      ${meta?.courseDescription ? `
        <div class="card-group" style="margin:0 0 var(--space-4)">
          <div class="list-row" style="cursor:default">
            <div class="list-row__content">
              <div class="list-row__title">Description</div>
              <div class="list-row__subtitle">${meta.courseDescription}</div>
            </div>
          </div>
          ${meta.elevationGainM ? `<div class="list-row" style="cursor:default">
            <div class="list-row__content">
              <div class="list-row__title">Dénivelé positif</div>
              <div class="list-row__subtitle">${meta.elevationGainM} m D+</div>
            </div>
          </div>` : ''}
        </div>
      ` : ''}
      <div class="course-import-area" id="drop-zone">
        <div style="font-size:40px;margin-bottom:var(--space-3)">🗺️</div>
        <div style="font-size:17px;font-weight:600;margin-bottom:var(--space-2)">Importer le parcours</div>
        <div style="font-size:14px;color:var(--text-secondary)">GPX, PDF ou JSON<br>Depuis Strava, Garmin, Komoot…</div>
        <button class="btn btn--secondary" style="margin-top:var(--space-4)" id="upload-btn">Choisir un fichier</button>
      </div>
      <input type="file" id="course-input" accept=".gpx,.pdf,.json,application/pdf,application/json" style="display:none">
    </div>
  `;

  attachUploadListener(container, slug);
}

function attachUploadListener(container, slug) {
  const input   = container.querySelector('#course-input');
  const trigger = container.querySelector('#upload-btn, #replace-btn');

  trigger?.addEventListener('click', () => input?.click());

  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast('Upload en cours…');
    try {
      const { content, alreadyBase64 } = await readFile(file);
      await importCourseFile(slug, file.name, content, { alreadyBase64 });
      showToast('Parcours importé !', 'success');
      await mount(container, slug);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
    e.target.value = '';
  });
}

async function readFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    // Read as ArrayBuffer → base64 (safe for binary)
    const buffer = await file.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return { content: btoa(binary), alreadyBase64: true };
  }
  return { content: await file.text(), alreadyBase64: false };
}

function stat(label, value) {
  return `<div class="course-stat">
    <div class="course-stat__label">${label}</div>
    <div class="course-stat__value">${value}</div>
  </div>`;
}
