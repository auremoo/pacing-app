import { getEventMeta, importCourseFile, getCourseFile, updateEventMeta, addPhoto, removePhoto, getPhoto } from '../store.js';
import { showToast } from '../app.js';
import { parseGpx, renderElevationChart, attachElevationCursor } from '../utils/gpx-parser.js';

export async function mount(container, slug) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Chargement…</span></div>`;

  const meta   = getEventMeta(slug);
  const course = meta?.course || { gpx: null, pdf: null };
  const photos = meta?.photos || [];

  const [gpxFile, pdfFile, ...photoFiles] = await Promise.all([
    course.gpx?.filename ? getCourseFile(slug, 'gpx').catch(() => null) : Promise.resolve(null),
    course.pdf?.filename ? getCourseFile(slug, 'pdf').catch(() => null) : Promise.resolve(null),
    ...photos.map(f => getPhoto(slug, f).catch(() => null)),
  ]);

  renderAll(container, slug, meta, gpxFile, pdfFile, photoFiles);
}

function renderAll(container, slug, meta, gpxFile, pdfFile, photoFiles = []) {
  const course = meta?.course || { gpx: null, pdf: null };
  const photos = meta?.photos || [];

  let gpxData = null;
  if (gpxFile) {
    try { gpxData = parseGpx(gpxFile.content); } catch { /* ignore */ }
  }

  const hasGpx = !!course.gpx;

  container.innerHTML = `
    ${renderCourseInfo(meta, hasGpx)}
    ${renderResult(meta)}
    ${renderGpxSection(gpxData, hasGpx)}
    ${renderPdfSection(!!course.pdf, course.pdf?.filename)}
    ${renderPhotosSection(photos, photoFiles)}
    <div style="height:var(--space-8)"></div>
  `;

  wireCourseInfoEdit(container, slug);
  wireResultEdit(container, slug);
  wireGpxUpload(container, slug);
  wirePdfUpload(container, slug);
  wirePhotoUpload(container, slug, photos);

  if (pdfFile && course.pdf?.filename) {
    mountPdfViewer(container.querySelector('#pdf-viewer-slot'), pdfFile.content, course.pdf.filename);
  }

  if (gpxData) {
    const chartEl = container.querySelector('.elevation-chart-container');
    if (chartEl) attachElevationCursor(chartEl, gpxData);
  }

  // Render loaded photos
  photos.forEach((filename, i) => {
    const slot = container.querySelector(`[data-photo-slot="${i}"]`);
    if (slot && photoFiles[i]?.content) {
      const ext  = filename.split('.').pop().toLowerCase();
      const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' }[ext] || 'image/jpeg';
      slot.innerHTML = `<img src="data:${mime};base64,${photoFiles[i].content}" alt="${filename}" loading="lazy">`;
    }
  });
}

// ── Course info (editable) ────────────────────────────────────────

function renderCourseInfo(meta, hasGpx) {
  const distVal = hasGpx
    ? `${meta?.distanceKm ?? '—'} km <span style="font-size:11px;color:var(--text-tertiary)">(GPX)</span>`
    : (meta?.distanceKm ? `${meta.distanceKm} km` : '—');
  const dplusVal = hasGpx
    ? `${meta?.elevationGainM ?? '—'} m D+ <span style="font-size:11px;color:var(--text-tertiary)">(GPX)</span>`
    : (meta?.elevationGainM != null ? `${meta.elevationGainM} m D+` : '—');

  return `
    <div style="padding:var(--space-4) var(--space-4) 0">
      <div class="card-group" id="course-info-card">
        <div id="course-info-view">
          <div class="list-row" style="cursor:default">
            <div class="list-row__content">
              <div class="list-row__subtitle">Distance</div>
              <div class="list-row__title">${distVal}</div>
            </div>
          </div>
          <div class="list-row" style="cursor:default">
            <div class="list-row__content">
              <div class="list-row__subtitle">Dénivelé +</div>
              <div class="list-row__title">${dplusVal}</div>
            </div>
          </div>
          ${meta?.courseDescription ? infoRow('Parcours', meta.courseDescription) : ''}
          <div class="list-row" id="edit-info-btn" style="cursor:pointer">
            <div class="list-row__content">
              <div class="list-row__title" style="color:var(--ios-blue)">Modifier ces infos</div>
            </div>
            <svg style="width:16px;height:16px;color:var(--text-tertiary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
        <div id="course-info-edit" style="display:none;padding:var(--space-3) var(--space-4)">
          ${!hasGpx ? `
          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label">Distance (km)</label>
            <input class="input-field" id="edit-distance" type="number" step="0.01" value="${meta?.distanceKm || ''}">
          </div>
          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label">Dénivelé + (m)</label>
            <input class="input-field" id="edit-dplus" type="number" step="1" value="${meta?.elevationGainM ?? ''}">
          </div>
          ` : `
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--space-3);padding:var(--space-2) 0">
            Distance et D+ calculés depuis le GPX — supprime le GPX pour les modifier manuellement.
          </div>
          `}
          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label">Description du parcours</label>
            <input class="input-field" id="edit-desc" type="text" value="${meta?.courseDescription || ''}">
          </div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn--primary" id="save-info-btn" style="flex:1">Enregistrer</button>
            <button class="btn btn--secondary" id="cancel-info-btn" style="flex:1">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function infoRow(label, value) {
  return `<div class="list-row" style="cursor:default">
    <div class="list-row__content">
      <div class="list-row__subtitle">${label}</div>
      <div class="list-row__title">${value}</div>
    </div>
  </div>`;
}

function wireCourseInfoEdit(container, slug) {
  const view      = container.querySelector('#course-info-view');
  const editPane  = container.querySelector('#course-info-edit');
  const editBtn   = container.querySelector('#edit-info-btn');
  const saveBtn   = container.querySelector('#save-info-btn');
  const cancelBtn = container.querySelector('#cancel-info-btn');

  editBtn?.addEventListener('click', () => {
    view.style.display = 'none';
    editPane.style.display = 'block';
  });
  cancelBtn?.addEventListener('click', () => {
    view.style.display = 'block';
    editPane.style.display = 'none';
  });
  saveBtn?.addEventListener('click', async () => {
    const distVal  = parseFloat(container.querySelector('#edit-distance').value);
    const dplusVal = parseInt(container.querySelector('#edit-dplus').value, 10);
    const descVal  = container.querySelector('#edit-desc').value.trim();
    const meta     = getEventMeta(slug);
    saveBtn.disabled = true;
    saveBtn.textContent = 'Enregistrement…';
    try {
      await updateEventMeta(slug, {
        distanceKm:       isNaN(distVal)  ? meta?.distanceKm      : distVal,
        elevationGainM:   isNaN(dplusVal) ? meta?.elevationGainM  : dplusVal,
        courseDescription: descVal || null,
      });
      showToast('Infos mises à jour', 'success');
      await mount(container, slug);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Enregistrer';
    }
  });
}

// ── Race result ───────────────────────────────────────────────────

function renderResult(meta) {
  const r = meta?.result;
  return `
    <div style="padding:var(--space-3) var(--space-4) 0">
      <div class="card-group" id="result-card">
        <div id="result-view">
          ${r?.time ? `
            ${infoRow('Temps officiel', r.time)}
            ${r.pacePerKm ? infoRow('Allure moyenne', r.pacePerKm) : ''}
            ${r.activityUrl ? `
              <a class="list-row" href="${escHtml(r.activityUrl)}" target="_blank" style="text-decoration:none">
                <div class="list-row__content">
                  <div class="list-row__subtitle">Activité</div>
                  <div class="list-row__title" style="color:var(--ios-blue)">Voir sur Strava / Garmin</div>
                </div>
                <svg style="width:16px;height:16px;color:var(--text-tertiary);flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>` : ''}
          ` : `
            <div class="list-row" style="cursor:default">
              <div class="list-row__content">
                <div class="list-row__title" style="color:var(--text-secondary)">Résultat non renseigné</div>
              </div>
            </div>
          `}
          <div class="list-row" id="edit-result-btn" style="cursor:pointer">
            <div class="list-row__content">
              <div class="list-row__title" style="color:var(--ios-blue)">${r?.time ? 'Modifier le résultat' : 'Saisir le résultat'}</div>
            </div>
            <svg style="width:16px;height:16px;color:var(--text-tertiary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
        <div id="result-edit" style="display:none;padding:var(--space-3) var(--space-4)">
          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label">Temps final</label>
            <input class="input-field" id="edit-time" type="text" placeholder="ex : 1h52'34" value="${r?.time || ''}">
          </div>
          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label">Allure moyenne</label>
            <input class="input-field" id="edit-pace" type="text" placeholder='ex : 5&apos;20"/km' value="${r?.pacePerKm || ''}">
          </div>
          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label">Lien activité (Strava, Garmin…)</label>
            <input class="input-field" id="edit-url" type="url" placeholder="https://www.strava.com/activities/…" value="${r?.activityUrl || ''}">
          </div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn--primary" id="save-result-btn" style="flex:1">Enregistrer</button>
            <button class="btn btn--secondary" id="cancel-result-btn" style="flex:1">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function wireResultEdit(container, slug) {
  const view      = container.querySelector('#result-view');
  const editPane  = container.querySelector('#result-edit');
  const editBtn   = container.querySelector('#edit-result-btn');
  const saveBtn   = container.querySelector('#save-result-btn');
  const cancelBtn = container.querySelector('#cancel-result-btn');

  editBtn?.addEventListener('click', () => {
    view.style.display = 'none';
    editPane.style.display = 'block';
  });
  cancelBtn?.addEventListener('click', () => {
    view.style.display = 'block';
    editPane.style.display = 'none';
  });
  saveBtn?.addEventListener('click', async () => {
    const time  = container.querySelector('#edit-time').value.trim();
    const pace  = container.querySelector('#edit-pace').value.trim();
    const url   = container.querySelector('#edit-url').value.trim();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Enregistrement…';
    try {
      await updateEventMeta(slug, {
        result: {
          time:        time || null,
          pacePerKm:   pace || null,
          activityUrl: url  || null,
        }
      });
      showToast('Résultat enregistré', 'success');
      await mount(container, slug);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Enregistrer';
    }
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── GPX section ───────────────────────────────────────────────────

function renderGpxSection(gpxData, hasGpx) {
  if (hasGpx && gpxData) {
    return `
      <div class="elevation-chart-container" style="margin-top:var(--space-4)">
        ${renderElevationChart(gpxData.profile)}
      </div>
      <div class="course-stats">
        ${stat('Distance', `${gpxData.distanceKm} km`)}
        ${stat('D+', `${gpxData.elevationGainM} m`)}
        ${stat('D-', `${gpxData.elevationLossM} m`)}
        ${stat('Alt. max', `${gpxData.maxElevationM} m`)}
      </div>
      <div style="padding:0 var(--space-4)">
        <button class="btn btn--ghost btn--full" id="replace-gpx-btn">Remplacer le GPX</button>
        <input type="file" id="gpx-input" accept=".gpx" style="display:none">
      </div>
    `;
  }
  if (hasGpx) {
    return `
      <div style="padding:var(--space-4) var(--space-4) 0">
        <div class="card-group">
          <div class="list-row" style="cursor:default">
            <div class="list-row__content">
              <div class="list-row__title">GPX importé</div>
              <div class="list-row__subtitle">Erreur de lecture du fichier</div>
            </div>
          </div>
        </div>
        <button class="btn btn--ghost btn--full" id="replace-gpx-btn" style="margin-top:var(--space-2)">Remplacer le GPX</button>
        <input type="file" id="gpx-input" accept=".gpx" style="display:none">
      </div>
    `;
  }
  return `
    <div style="padding:var(--space-4) var(--space-4) 0">
      <p class="section-header" style="margin:0 0 var(--space-2)">Profil altimétrique</p>
      <div class="course-import-area">
        <div style="font-size:32px;margin-bottom:var(--space-2)">🗺️</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:4px">Importer un GPX</div>
        <div style="font-size:13px;color:var(--text-secondary)">Strava, Garmin, Komoot…</div>
        <button class="btn btn--secondary" style="margin-top:var(--space-3)" id="replace-gpx-btn">Choisir un fichier GPX</button>
        <input type="file" id="gpx-input" accept=".gpx" style="display:none">
      </div>
    </div>
  `;
}

function wireGpxUpload(container, slug) {
  const btn   = container.querySelector('#replace-gpx-btn');
  const input = container.querySelector('#gpx-input');
  btn?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast('Upload GPX…');
    try {
      await importCourseFile(slug, file.name, await file.text(), 'gpx', { alreadyBase64: false });
      showToast('GPX importé !', 'success');
      await mount(container, slug);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
    e.target.value = '';
  });
}

// ── PDF section ───────────────────────────────────────────────────

function renderPdfSection(hasPdf, pdfFilename) {
  if (hasPdf) {
    return `
      <p class="section-header" style="margin-top:var(--space-4)">Document PDF</p>
      <div id="pdf-viewer-slot" style="margin:0 var(--space-4)"></div>
      <div style="padding:var(--space-2) var(--space-4) 0">
        <button class="btn btn--ghost btn--full" id="replace-pdf-btn">Remplacer le PDF</button>
        <input type="file" id="pdf-input" accept=".pdf,application/pdf" style="display:none">
      </div>
    `;
  }
  return `
    <div style="padding:var(--space-4) var(--space-4) 0">
      <p class="section-header" style="margin:0 0 var(--space-2)">Document parcours (PDF)</p>
      <div class="course-import-area">
        <div style="font-size:32px;margin-bottom:var(--space-2)">📄</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:4px">Importer un PDF</div>
        <div style="font-size:13px;color:var(--text-secondary)">Roadbook, carte du parcours…</div>
        <button class="btn btn--secondary" style="margin-top:var(--space-3)" id="replace-pdf-btn">Choisir un fichier PDF</button>
        <input type="file" id="pdf-input" accept=".pdf,application/pdf" style="display:none">
      </div>
    </div>
  `;
}

function mountPdfViewer(slot, b64content, filename) {
  if (!slot) return;
  try {
    const binary = atob(b64content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    slot.innerHTML = `
      <div class="card-group">
        <a class="list-row" href="${url}" target="_blank" rel="noopener" style="text-decoration:none">
          <div class="list-row__content">
            <div class="list-row__title" style="color:var(--ios-blue)">Ouvrir le PDF</div>
            <div class="list-row__subtitle">${filename}</div>
          </div>
          <svg style="width:16px;height:16px;color:var(--text-tertiary);flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
        </a>
      </div>
    `;
  } catch {
    slot.innerHTML = `<div style="padding:var(--space-4);color:var(--text-secondary);text-align:center;font-size:14px">Erreur de lecture du PDF.</div>`;
  }
}

function wirePdfUpload(container, slug) {
  const btn   = container.querySelector('#replace-pdf-btn');
  const input = container.querySelector('#pdf-input');
  btn?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast('Upload PDF…');
    try {
      const buffer = await file.arrayBuffer();
      const bytes  = new Uint8Array(buffer);
      let binary   = '';
      bytes.forEach(b => { binary += String.fromCharCode(b); });
      await importCourseFile(slug, file.name, btoa(binary), 'pdf', { alreadyBase64: true });
      showToast('PDF importé !', 'success');
      await mount(container, slug);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
    e.target.value = '';
  });
}

function stat(label, value) {
  return `<div class="course-stat">
    <div class="course-stat__label">${label}</div>
    <div class="course-stat__value">${value}</div>
  </div>`;
}

// ── Photos section ────────────────────────────────────────────────

function renderPhotosSection(photos, photoFiles) {
  const MAX_PHOTOS = 2;
  const canAdd = photos.length < MAX_PHOTOS;

  return `
    <div style="padding:var(--space-4) var(--space-4) 0">
      <p class="section-header" style="margin:0 0 var(--space-2)">Photos</p>
      <div class="photos-grid" id="photos-grid">
        ${photos.map((filename, i) => `
          <div class="photo-card" data-photo-index="${i}">
            <div class="photo-card__img" data-photo-slot="${i}">
              <div class="spinner" style="width:24px;height:24px"></div>
            </div>
            <button class="photo-card__delete" data-photo-delete="${filename}" aria-label="Supprimer">✕</button>
          </div>
        `).join('')}
        ${canAdd ? `
          <label class="photo-add-btn" id="photo-add-label" title="Ajouter une photo">
            <span style="font-size:28px;line-height:1">＋</span>
            <span style="font-size:12px;color:var(--text-secondary)">Photo</span>
            <input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp,image/heic" style="display:none">
          </label>
        ` : ''}
      </div>
      ${photos.length === MAX_PHOTOS ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:var(--space-2)">Maximum ${MAX_PHOTOS} photos atteint.</p>` : ''}
    </div>
  `;
}

function wirePhotoUpload(container, slug, currentPhotos) {
  const input = container.querySelector('#photo-input');
  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo trop lourde — max 5 Mo', 'error');
      e.target.value = '';
      return;
    }

    showToast('Upload photo…');
    try {
      const buffer = await file.arrayBuffer();
      const bytes  = new Uint8Array(buffer);
      let binary   = '';
      bytes.forEach(b => { binary += String.fromCharCode(b); });
      const base64  = btoa(binary);
      const ext      = file.name.split('.').pop().toLowerCase();
      const filename = `photo-${Date.now()}.${ext}`;
      await addPhoto(slug, filename, base64);
      showToast('Photo ajoutée !', 'success');
      await mount(container, slug);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
    e.target.value = '';
  });

  container.querySelectorAll('[data-photo-delete]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const filename = btn.dataset.photoDelete;
      try {
        await removePhoto(slug, filename);
        showToast('Photo supprimée', 'success');
        await mount(container, slug);
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}
