import { getFile, putFile } from './github-api.js';
import { parsePlan } from './parser.js';
import { showToast } from './toast.js';

// ── In-memory state ───────────────────────────────────────────────

let _eventsIndex = [];       // raw index entries
let _eventMetas  = {};       // slug → meta.json content
let _plans       = {};       // slug → { v: parsedPlan }
let _state       = { version: 2, events: {} };
let _stateSha    = null;
let _syncTimer   = null;
let _syncing     = false;

// ── Init ──────────────────────────────────────────────────────────

export async function initStore() {
  const indexFile = await getFile('events/index.json');
  if (!indexFile) throw new Error('events/index.json introuvable dans le repo.');
  const index = JSON.parse(indexFile.content);
  _eventsIndex = index.events || [];

  const stateFile = await getFile('state.json');
  if (stateFile) {
    _stateSha = stateFile.sha;       // we'll re-fetch sha before each write
    _state = JSON.parse(stateFile.content);
    if (!_state.events) _state.events = {};
  }

  // Pre-load all event metas
  await Promise.all(_eventsIndex.map(e => loadEventMeta(e.slug)));
}

// ── Events ────────────────────────────────────────────────────────

export function getEventsIndex() { return _eventsIndex; }

export async function loadEventMeta(slug) {
  if (_eventMetas[slug]) return _eventMetas[slug];
  const file = await getFile(`events/${slug}/meta.json`);
  if (!file) return null;
  _eventMetas[slug] = JSON.parse(file.content);
  return _eventMetas[slug];
}

export function getEventMeta(slug) { return _eventMetas[slug] || null; }

// ── Plans ─────────────────────────────────────────────────────────

export async function ensurePlanLoaded(slug, version) {
  if (_plans[slug]?.[version]) return _plans[slug][version];
  const file = await getFile(`events/${slug}/plans/v${version}.md`);
  if (!file) return null;
  const parsed = parsePlan(file.content);
  if (!_plans[slug]) _plans[slug] = {};
  _plans[slug][version] = parsed;
  return parsed;
}

export function getActivePlan(slug) {
  const meta = getEventMeta(slug);
  if (!meta?.activeVersion) return null;
  return _plans[slug]?.[meta.activeVersion] || null;
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
    ...(completed ? { completedAt: new Date().toISOString() } : { completedAt: null })
  };
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
    const newSha = await putFile('state.json', JSON.stringify(_state, null, 2), sha);
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
  await putFile(`events/${slug}/plans/${filename}`, mdContent, null);

  // Update meta
  const newMeta = {
    ...meta,
    activeVersion: nextV,
    versions: [
      ...(meta.versions || []),
      { v: nextV, file: filename, importedAt: new Date().toISOString(), label: label || `Version ${nextV}` }
    ]
  };

  const metaFile = await getFile(`events/${slug}/meta.json`);
  await putFile(`events/${slug}/meta.json`, JSON.stringify(newMeta, null, 2), metaFile?.sha);
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
  const metaFile = await getFile(`events/${slug}/meta.json`);
  const newMeta = { ...meta, activeVersion: v };
  await putFile(`events/${slug}/meta.json`, JSON.stringify(newMeta, null, 2), metaFile?.sha);
  _eventMetas[slug] = newMeta;
  const idx = _eventsIndex.find(e => e.slug === slug);
  if (idx) idx.activeVersion = v;
  await ensurePlanLoaded(slug, v);
}

// ── Import course file ────────────────────────────────────────────

export async function importCourseFile(slug, filename, content, type, { alreadyBase64 = false } = {}) {
  await putFile(`events/${slug}/course/${filename}`, content, null, { alreadyBase64 });
  const meta = getEventMeta(slug);
  const metaFile = await getFile(`events/${slug}/meta.json`);
  const currentCourse = (meta.course && !meta.course.filename) ? meta.course : { gpx: null, pdf: null };
  const newCourse = { ...currentCourse, [type]: { filename, importedAt: new Date().toISOString() } };
  const newMeta = { ...meta, course: newCourse };
  await putFile(`events/${slug}/meta.json`, JSON.stringify(newMeta, null, 2), metaFile?.sha);
  _eventMetas[slug] = newMeta;
}

export async function getCourseFile(slug, type) {
  const meta = getEventMeta(slug);
  // backward compat: old format had course.filename directly
  if (meta?.course?.filename && !type) return getFile(`events/${slug}/course/${meta.course.filename}`);
  const entry = meta?.course?.[type];
  if (!entry?.filename) return null;
  return getFile(`events/${slug}/course/${entry.filename}`);
}

export async function updateEventMeta(slug, updates) {
  const meta = getEventMeta(slug);
  const metaFile = await getFile(`events/${slug}/meta.json`);
  const newMeta = { ...meta, ...updates };
  await putFile(`events/${slug}/meta.json`, JSON.stringify(newMeta, null, 2), metaFile?.sha);
  _eventMetas[slug] = newMeta;
  const idx = _eventsIndex.find(e => e.slug === slug);
  if (idx) Object.assign(idx, updates);
}
