const SESSION_TYPES = new Set(['rest','easy','long','intervals','tempo','hills','race','strength','cross']);
const DAY_CODE = { lundi:'mon', mardi:'tue', mercredi:'wed', jeudi:'thu', vendredi:'fri', samedi:'sat', dimanche:'sun' };

export function parsePlan(markdown) {
  const sections = splitSections(markdown);

  return {
    meta:    parseMeta(sections['META'] || ''),
    phases:  parsePhases(sections['PHASES'] || ''),
    paces:   parsePaces(sections['ALLURES'] || ''),
    weeks:   parseWeeks(sections['SEMAINES'] || ''),
    info: {
      overview:     (sections['SYNTHESE'] || '').trim(),
      principles:   (sections['PRINCIPES'] || '').trim(),
      ppg:          (sections['PPG'] || '').trim(),
      vigilance:    (sections['VIGILANCE'] || '').trim(),
      raceStrategy: (sections['STRATEGIE_COURSE'] || '').trim(),
      nutrition:    (sections['NUTRITION'] || '').trim(),
    }
  };
}

// ── Split by ## headings ──────────────────────────────────────────

function splitSections(md) {
  const result = {};
  const re = /^## ([A-Z_ÉÈÀÙÂÊÎÔ &]+)\s*$/gm;
  let last = { key: null, idx: 0 };
  let m;

  while ((m = re.exec(md)) !== null) {
    if (last.key) result[last.key] = md.slice(last.idx, m.index);
    last = { key: m[1].trim(), idx: m.index + m[0].length };
  }
  if (last.key) result[last.key] = md.slice(last.idx);
  return result;
}

// ── META ─────────────────────────────────────────────────────────

function parseMeta(content) {
  const meta = {};
  for (const line of content.trim().split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    meta[key] = val;
  }
  return meta;
}

// ── PHASES ───────────────────────────────────────────────────────

function parsePhases(content) {
  const phases = [];
  let pastSep = false;

  for (const line of content.trim().split('\n')) {
    if (!line.startsWith('|')) continue;
    if (/\|[-| :]+\|/.test(line)) { pastSep = true; continue; }
    if (!pastSep) continue;

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;

    const [id, name, weeksStr, color] = cells;
    phases.push({ id, name, color, weeks: expandRange(weeksStr) });
  }
  return phases;
}

function expandRange(str) {
  const [a, b] = str.trim().split('-').map(Number);
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

// ── ALLURES ──────────────────────────────────────────────────────

function parsePaces(content) {
  const result = { current: [], target: [] };
  let mode = null;

  for (const line of content.split('\n')) {
    if (/^### Actuelles/i.test(line)) { mode = 'current'; continue; }
    if (/^### Cibles/i.test(line))    { mode = 'target';  continue; }
    if (!mode || !line.startsWith('|')) continue;
    if (/\|[-| :]+\|/.test(line)) continue;

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 2 || cells[0].toLowerCase().includes('zone')) continue;

    result[mode].push({ label: cells[0], value: cells[1], usage: cells[2] || '' });
  }
  return result;
}

// ── SEMAINES ─────────────────────────────────────────────────────

function parseWeeks(content) {
  const weeks = [];
  // Split on ### headings
  const parts = content.split(/^### /m).filter(s => s.trim());

  for (const part of parts) {
    const lines = part.split('\n');
    const header = lines[0];

    // S01 | 18-24 mai 2026 | phase-1 | 12km | note
    const hParts = header.split('|').map(p => p.trim());
    if (hParts.length < 5) continue;

    const numMatch = hParts[0].match(/S(\d+)/i);
    if (!numMatch) continue;
    const weekNum = parseInt(numMatch[1]);

    const dateRange   = hParts[1];
    const phaseId     = hParts[2];
    const volStr      = hParts[3].replace(/km/i, '').trim();
    const note        = hParts[4];
    const isDecharge  = /d.charge/i.test(note);

    const sessions = parseSessionTable(lines.slice(1), weekNum);

    weeks.push({
      number: weekNum,
      dateRange,
      phaseId,
      targetVolumeKm: parseFloat(volStr) || 0,
      note,
      isDecharge,
      sessions
    });
  }

  weeks.sort((a, b) => a.number - b.number);
  return weeks;
}

function parseSessionTable(lines, weekNum) {
  const sessions = [];
  let pastSep = false;

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    if (/\|[-| :]+\|/.test(line)) { pastSep = true; continue; }
    if (!pastSep) continue;

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 5) continue;

    const [dayName, date, rawType, title, ...descParts] = cells;
    const type = SESSION_TYPES.has(rawType) ? rawType : 'easy';
    const dayCode = DAY_CODE[dayName.toLowerCase()] || dayName.toLowerCase().slice(0, 3);
    const id = `s${String(weekNum).padStart(2, '0')}-${dayCode}`;
    const description = descParts.join(' | ');

    sessions.push({ id, weekNum, dayLabel: dayName, date, type, title, description });
  }

  return sessions;
}

// ── Helpers ──────────────────────────────────────────────────────

export const SESSION_LABELS = {
  rest:      'REPOS',
  easy:      'EF',
  long:      'SL',
  intervals: 'FRAC',
  tempo:     'TEMPO',
  hills:     'CÔTES',
  race:      'RACE',
  strength:  'PPG',
  cross:     'CROSS'
};
