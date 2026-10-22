const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
// Abréviations usuelles : couper à 3 lettres donnait « jui. » pour juin et
// juillet, et « mai. ».
const MONTHS_SHORT_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

export function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS_FR[date.getDay()]} ${d} ${MONTHS_FR[m - 1]} ${y}`;
}

export function formatDateShort(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS_SHORT_FR[m - 1]}`;
}

export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target - now) / 86400000);
}

export function isPast(isoDate) {
  return isoDate < today();
}

export function isSameDay(a, b) {
  return a === b;
}

export function formatDaysUntil(isoDate) {
  const d = daysUntil(isoDate);
  if (d === null) return '';
  if (d < 0) return `Il y a ${Math.abs(d)} j`;
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Demain';
  if (d < 7) return `Dans ${d} j`;
  const weeks = Math.round(d / 7);
  if (weeks < 8) return `Dans ${weeks} sem.`;
  return `Dans ${Math.round(d / 30)} mois`;
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Nombre de semaines couvertes entre deux dates incluses (ex: lundi -> dimanche
// de la même semaine = 1 semaine).
export function weeksBetween(startIso, endIso) {
  const [y1, m1, d1] = startIso.split('-').map(Number);
  const [y2, m2, d2] = endIso.split('-').map(Number);
  const diffDays = Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
  return Math.max(1, Math.ceil((diffDays + 1) / 7));
}

// Plage lundi → dimanche d'une semaine de plan, à partir des dates de ses
// séances : « 5 – 11 oct. », « 26 oct. – 1 nov. », année ajoutée seulement si
// ce n'est pas l'année en cours. Remplace le libellé écrit par l'IA dans le
// .md (« 2026-10-05-2026-10-11 octobre 2026 »), illisible.
export function formatWeekRange(sessionDates) {
  const first = (sessionDates || []).filter(Boolean).sort()[0];
  if (!first) return '';
  const [y, m, d] = first.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));     // lundi
  const end = new Date(start); end.setDate(start.getDate() + 6);  // dimanche
  const thisYear = new Date().getFullYear();
  const mon = dt => MONTHS_SHORT_FR[dt.getMonth()];
  const yr  = dt => (dt.getFullYear() !== thisYear ? ` ${dt.getFullYear()}` : '');
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear())
    return `${start.getDate()} – ${end.getDate()} ${mon(end)}${yr(end)}`;
  const startYear = start.getFullYear() !== end.getFullYear() ? yr(start) : '';
  return `${start.getDate()} ${mon(start)}${startYear} – ${end.getDate()} ${mon(end)}${yr(end)}`;
}

export function weekRangeOf(week) {
  return formatWeekRange((week?.sessions || []).map(s => s.date));
}
