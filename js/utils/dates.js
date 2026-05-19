const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

export function today() {
  return new Date().toISOString().slice(0, 10);
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
  return `${d} ${MONTHS_FR[m - 1].slice(0, 3)}.`;
}

export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
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
