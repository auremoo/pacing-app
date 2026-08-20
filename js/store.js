import { getFile, putFile } from './github-api.js';
import { parsePlan } from './parser.js';
import { showToast } from './toast.js';

// ── In-memory state ───────────────────────────────────────────────

let _eventsIndex = [];       // raw index entries
let _eventMetas  = {};       // slug → meta.json content
let _plans       = {};       // slug → { v: parsedPlan }
let _planRaw     = {};       // slug → { v: raw .md text }
let _state       = { version: 2, events: {} };
let _stateSha    = null;
let _syncTimer   = null;
let _syncing     = false;
let _athlete     = {};       // athlete profile
let _athleteSha  = null;

// ── Plan général (routine, hors courses) ────────────────────────────
// Pseudo-slug interne : mêmes fonctions meta/plan/état que les événements,
// mais stocké sous routine/ à la racine (pas dans events/, pas dans
// events/index.json) et jamais mélangé aux courses.

export const ROUTINE_SLUG = '__routine__';

function metaPath(slug) {
  return slug === ROUTINE_SLUG ? 'routine/meta.json' : `events/${slug}/meta.json`;
}

function planFilePath(slug, filename) {
  return slug === ROUTINE_SLUG ? `routine/plans/${filename}` : `events/${slug}/plans/${filename}`;
}

// ── Init ──────────────────────────────────────────────────────────

export async function initStore() {
  const indexFile = await getFile('events/index.json');
  if (!indexFile) throw new Error('events/index.json introuvable dans le repo.');
  const index = JSON.parse(indexFile.content);
  _eventsIndex = index.events || [];

  const stateFile = await getFile('state.json');
  if (stateFile) {
    _stateSha = stateFile.sha;
    _state = JSON.parse(stateFile.content);
    if (!_state.events) _state.events = {};
  }

  const athleteFile = await getFile('athlete.json');
  if (athleteFile) {
    _athleteSha = athleteFile.sha;
    _athlete = JSON.parse(athleteFile.content);
  }

  // Pre-load all event metas
  await Promise.all(_eventsIndex.map(e => loadEventMeta(e.slug)));

  // Pre-load active plans (needed for "séance du jour" on dashboard/sidebar at boot)
  await Promise.all(_eventsIndex.map(async e => {
    const meta = _eventMetas[e.slug];
    if (meta?.activeVersion) await ensurePlanLoaded(e.slug, meta.activeVersion);
  }));

  // Pre-load plan général (routine), s'il existe déjà
  const routineMeta = await loadEventMeta(ROUTINE_SLUG);
  if (routineMeta?.activeVersion) await ensurePlanLoaded(ROUTINE_SLUG, routineMeta.activeVersion);
}

// ── Events ────────────────────────────────────────────────────────

export function getEventsIndex() { return _eventsIndex; }

export async function loadEventMeta(slug) {
  if (_eventMetas[slug]) return _eventMetas[slug];
  const file = await getFile(metaPath(slug));
  if (!file) return null;
  _eventMetas[slug] = JSON.parse(file.content);
  return _eventMetas[slug];
}

export function getEventMeta(slug) { return _eventMetas[slug] || null; }

// ── Plans ─────────────────────────────────────────────────────────

export async function ensurePlanLoaded(slug, version) {
  if (_plans[slug]?.[version]) return _plans[slug][version];
  const file = await getFile(planFilePath(slug, `v${version}.md`));
  if (!file) return null;
  const parsed = parsePlan(file.content);
  if (!_plans[slug]) _plans[slug] = {};
  _plans[slug][version] = parsed;
  if (!_planRaw[slug]) _planRaw[slug] = {};
  _planRaw[slug][version] = file.content;
  return parsed;
}

export function getActivePlan(slug) {
  const meta = getEventMeta(slug);
  if (!meta?.activeVersion) return null;
  return _plans[slug]?.[meta.activeVersion] || null;
}

export function getActivePlanRaw(slug) {
  const meta = getEventMeta(slug);
  if (!meta?.activeVersion) return null;
  return _planRaw[slug]?.[meta.activeVersion] || null;
}

// ── Sessions / State ──────────────────────────────────────────────

export function getSessionState(slug, sessionId) {
  return _state.events?.[slug]?.[sessionId] || { completed: false };
}

export function getAllSessionStates(slug) {
  return _state.events?.[slug] || {};
}

export async function toggleSession(slug, sessionId, completed) {
  if (!_state.events[slug]) _state.events[slug] = {};
  const prev = _state.events[slug][sessionId] || {};
  _state.events[slug][sessionId] = {
    ...prev,
    completed,
    skipped: completed ? false : prev.skipped,
    ...(completed ? { completedAt: new Date().toISOString() } : { completedAt: null })
  };
  scheduleSyncState();
}

export async function skipSession(slug, sessionId, skipped, reason = null) {
  if (!_state.events[slug]) _state.events[slug] = {};
  const prev = _state.events[slug][sessionId] || {};
  _state.events[slug][sessionId] = {
    ...prev,
    skipped,
    completed: skipped ? false : prev.completed,
    ...(skipped
      ? { skippedAt: new Date().toISOString(), skipReason: reason }
      : { skippedAt: null, skipReason: null }),
    ...(skipped ? { completedAt: null } : {})
  };
  scheduleSyncState();
}

export function getDateOverrides(slug) {
  return _state.events?.[slug]?._dateOverrides || {};
}

export async function moveSession(slug, sessionId, newDate) {
  if (!_state.events[slug]) _state.events[slug] = {};
  if (!_state.events[slug]._dateOverrides) _state.events[slug]._dateOverrides = {};
  _state.events[slug]._dateOverrides[sessionId] = newDate;
  scheduleSyncState();
}

export async function swapSessionDates(slug, id1, newDate1, id2, newDate2) {
  if (!_state.events[slug]) _state.events[slug] = {};
  if (!_state.events[slug]._dateOverrides) _state.events[slug]._dateOverrides = {};
  _state.events[slug]._dateOverrides[id1] = newDate1;
  _state.events[slug]._dateOverrides[id2] = newDate2;
  scheduleSyncState();
}

export function getWeekMetaOverrides(slug) {
  return _state.events?.[slug]?._weekMetaOverrides || {};
}

export async function swapWeeks(slug, sessionsA, mondayA, sessionsB, mondayB, metaA, metaB) {
  if (!_state.events[slug]) _state.events[slug] = {};
  if (!_state.events[slug]._dateOverrides)     _state.events[slug]._dateOverrides     = {};
  if (!_state.events[slug]._weekMetaOverrides) _state.events[slug]._weekMetaOverrides = {};

  const diffDays = Math.round(
    (new Date(mondayB + 'T12:00:00') - new Date(mondayA + 'T12:00:00')) / 86400000
  );
  const shiftDate = (dateStr, n) => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  for (const s of sessionsA) _state.events[slug]._dateOverrides[s.id] = shiftDate(s.date,  diffDays);
  for (const s of sessionsB) _state.events[slug]._dateOverrides[s.id] = shiftDate(s.date, -diffDays);

  // Swap week-level metadata (badge décharge, phase, volume, note)
  const pickMeta = w => ({
    isDecharge:      w.isDecharge      ?? false,
    phaseId:         w.phaseId         ?? null,
    targetVolumeKm:  w.targetVolumeKm  ?? 0,
    note:            w.note            ?? '',
  });
  _state.events[slug]._weekMetaOverrides[metaA.number] = pickMeta(metaB);
  _state.events[slug]._weekMetaOverrides[metaB.number] = pickMeta(metaA);

  scheduleSyncState();
}

export async function saveSessionNote(slug, sessionId, note) {
  if (!_state.events[slug]) _state.events[slug] = {};
  _state.events[slug][sessionId] = { ...(_state.events[slug][sessionId] || {}), note };
  scheduleSyncState();
}

function scheduleSyncState() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(syncState, 600);
}

async function syncState() {
  if (_syncing) { scheduleSyncState(); return; }
  _syncing = true;
  try {
    // Always refetch sha to avoid 409 conflicts
    const current = await getFile('state.json');
    const sha = current?.sha || _stateSha;
    _state.lastUpdated = new Date().toISOString();
    const newSha = await putFile('state.json', JSON.stringify(_state, null, 2), sha, { commitMessage: 'pacing-app: update state.json [skip ci]' });
    _stateSha = newSha;
  } catch (err) {
    console.error('Sync state failed', err);
    showToast('Erreur de synchronisation', 'error');
  } finally {
    _syncing = false;
  }
}

// ── Import plan version ───────────────────────────────────────────

export async function importPlanVersion(slug, mdContent, label) {
  const meta = getEventMeta(slug);
  if (!meta) throw new Error('Événement introuvable');

  const nextV = (meta.versions?.length ? Math.max(...meta.versions.map(v => v.v)) : 0) + 1;
  const filename = `v${nextV}.md`;

  // Upload plan file
  await putFile(planFilePath(slug, filename), mdContent, null);

  // Update meta
  const newMeta = {
    ...meta,
    activeVersion: nextV,
    versions: [
      ...(meta.versions || []),
      { v: nextV, file: filename, importedAt: new Date().toISOString(), label: label || `Version ${nextV}` }
    ]
  };

  const metaFile = await getFile(metaPath(slug));
  await putFile(metaPath(slug), JSON.stringify(newMeta, null, 2), metaFile?.sha);
  _eventMetas[slug] = newMeta;

  // Parse and cache the plan
  const parsed = parsePlan(mdContent);
  if (!_plans[slug]) _plans[slug] = {};
  _plans[slug][nextV] = parsed;

  // Update index entry
  const idx = _eventsIndex.find(e => e.slug === slug);
  if (idx) idx.activeVersion = nextV;

  return nextV;
}

export async function setActiveVersion(slug, v) {
  const meta = getEventMeta(slug);
  if (!meta) return;
  const metaFile = await getFile(metaPath(slug));
  const newMeta = { ...meta, activeVersion: v };
  await putFile(metaPath(slug), JSON.stringify(newMeta, null, 2), metaFile?.sha);
  _eventMetas[slug] = newMeta;
  const idx = _eventsIndex.find(e => e.slug === slug);
  if (idx) idx.activeVersion = v;
  await ensurePlanLoaded(slug, v);
}

// ── Athlete profile ───────────────────────────────────────────────

export function getAthleteProfile() { return _athlete; }

export async function saveAthleteProfile(profile) {
  const newSha = await putFile('athlete.json', JSON.stringify(profile, null, 2), _athleteSha || null);
  _athleteSha = newSha;
  _athlete = profile;
}

// ── Create event ──────────────────────────────────────────────────

export async function createEvent(data) {
  const { slug } = data;
  const meta = {
    slug,
    name: data.name,
    distanceKm: parseFloat(data.distanceKm),
    distanceLabel: data.distanceLabel,
    raceDate: data.raceDate,
    elevationGainM: parseInt(data.elevationGainM) || 0,
    objective: data.objective || '',
    objectiveRealistic: data.objectiveRealistic || '',
    courseDescription: data.courseDescription || '',
    location: data.location || '',
    planStart: data.planStart || '',
    planWeeks: parseInt(data.planWeeks) || 0,
    activeVersion: null,
    versions: [],
    course: { gpx: null, pdf: null },
    photos: []
  };

  await putFile(`events/${slug}/meta.json`, JSON.stringify(meta, null, 2), null);

  const indexFile = await getFile('events/index.json');
  const index = JSON.parse(indexFile.content);
  const entry = { slug, name: data.name, raceDate: data.raceDate, distanceLabel: data.distanceLabel, subtitle: data.location || '' };
  index.events.push(entry);
  await putFile('events/index.json', JSON.stringify(index, null, 2), indexFile.sha);

  _eventsIndex.push(entry);
  _eventMetas[slug] = meta;

  return slug;
}

// ── Import course file ────────────────────────────────────────────

export async function importCourseFile(slug, filename, content, type, { alreadyBase64 = false } = {}) {
  const path = `events/${slug}/course/${filename}`;
  const existing = await getFile(path).catch(() => null);
  await putFile(path, content, existing?.sha || null, { alreadyBase64 });
  const meta = getEventMeta(slug);
  const metaFile = await getFile(`events/${slug}/meta.json`);
  const currentCourse = (meta.course && !meta.course.filename) ? meta.course : { gpx: null, pdf: null };
  const newCourse = { ...currentCourse, [type]: { filename, importedAt: new Date().toISOString() } };
  const newMeta = { ...meta, course: newCourse };
  await putFile(`events/${slug}/meta.json`, JSON.stringify(newMeta, null, 2), metaFile?.sha);
  _eventMetas[slug] = newMeta;
}

export async function addPhoto(slug, filename, base64Content) {
  const path = `events/${slug}/course/${filename}`;
  const existing = await getFile(path).catch(() => null);
  await putFile(path, base64Content, existing?.sha || null, { alreadyBase64: true });
  const meta = getEventMeta(slug);
  const photos = [...(meta.photos || [])];
  if (!photos.includes(filename)) photos.push(filename);
  const metaFile = await getFile(`events/${slug}/meta.json`);
  const newMeta = { ...meta, photos };
  await putFile(`events/${slug}/meta.json`, JSON.stringify(newMeta, null, 2), metaFile?.sha);
  _eventMetas[slug] = newMeta;
}

export async function removePhoto(slug, filename) {
  const meta = getEventMeta(slug);
  const photos = (meta.photos || []).filter(f => f !== filename);
  const metaFile = await getFile(`events/${slug}/meta.json`);
  const newMeta = { ...meta, photos };
  await putFile(`events/${slug}/meta.json`, JSON.stringify(newMeta, null, 2), metaFile?.sha);
  _eventMetas[slug] = newMeta;
}

export async function getPhoto(slug, filename) {
  return getFile(`events/${slug}/course/${filename}`, { rawBase64: true });
}

export async function getCourseFile(slug, type) {
  const meta = getEventMeta(slug);
  // backward compat: old format had course.filename directly
  if (meta?.course?.filename && !type) return getFile(`events/${slug}/course/${meta.course.filename}`);
  const entry = meta?.course?.[type];
  if (!entry?.filename) return null;
  return getFile(`events/${slug}/course/${entry.filename}`, { rawBase64: type === 'pdf' });
}

export async function updateEventMeta(slug, updates) {
  const meta = getEventMeta(slug);
  const metaFile = await getFile(metaPath(slug));
  const newMeta = { ...meta, ...updates };
  await putFile(metaPath(slug), JSON.stringify(newMeta, null, 2), metaFile?.sha);
  _eventMetas[slug] = newMeta;
  const idx = _eventsIndex.find(e => e.slug === slug);
  if (idx) Object.assign(idx, updates);
}

// ── Plan général (routine) ──────────────────────────────────────────
// Un seul plan général, bien séparé des courses : pas de slug dossier,
// pas d'entrée dans events/index.json. Réutilise loadEventMeta/getEventMeta/
// ensurePlanLoaded/getActivePlan/importPlanVersion/setActiveVersion/
// updateEventMeta ci-dessus via ROUTINE_SLUG, ainsi que toutes les
// fonctions d'état de séance (toggleSession, saveSessionNote, moveSession,
// swapSessionDates, swapWeeks, getDateOverrides…) déjà génériques par slug.

export function getRoutineMeta() { return getEventMeta(ROUTINE_SLUG); }

export async function createRoutine(settings) {
  const meta = {
    context: settings.context || '',
    goals: settings.goals || '',
    blockWeeks: parseInt(settings.blockWeeks) || 0,
    startDate: settings.startDate || '',
    activeVersion: null,
    versions: [],
  };
  await putFile(metaPath(ROUTINE_SLUG), JSON.stringify(meta, null, 2), null);
  _eventMetas[ROUTINE_SLUG] = meta;
  return meta;
}

export async function saveRoutineSettings(updates) {
  const existing = getRoutineMeta();
  if (!existing) return createRoutine(updates);
  await updateEventMeta(ROUTINE_SLUG, updates);
  return getRoutineMeta();
}
