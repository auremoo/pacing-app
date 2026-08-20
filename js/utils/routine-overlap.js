// Calcule, pour le plan général, quelles semaines chevauchent la période
// d'entraînement active d'une course spécifique (planStart → raceDate).
// On ne peut pas suivre 2 plans en parallèle : ces semaines sont marquées
// "en pause" dans l'UI plutôt que d'être modifiées ou supprimées.

export function computeEventRanges(eventsIndex, getEventMeta) {
  return eventsIndex
    .map(e => {
      const meta = getEventMeta(e.slug);
      if (!meta?.activeVersion || !meta.planStart || !meta.raceDate) return null;
      return { name: meta.name, start: meta.planStart, end: meta.raceDate };
    })
    .filter(Boolean);
}

// Retourne une Map<weekNumber, nomCourse> pour les semaines du plan général
// qui chevauchent au moins une des périodes de course actives.
export function computePausedWeeks(routineEffPlan, eventRanges) {
  const paused = new Map();
  if (!routineEffPlan || !eventRanges.length) return paused;

  for (const week of routineEffPlan.weeks) {
    if (!week.sessions.length) continue;
    const dates = week.sessions.map(s => s.date);
    const weekMin = dates.reduce((a, b) => (a < b ? a : b));
    const weekMax = dates.reduce((a, b) => (a > b ? a : b));
    const overlap = eventRanges.find(r => weekMin <= r.end && weekMax >= r.start);
    if (overlap) paused.set(week.number, overlap.name);
  }
  return paused;
}
