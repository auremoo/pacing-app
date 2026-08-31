export function applyDateOverrides(plan, overrides) {
  if (!Object.keys(overrides).length) return plan;

  const allSessions = plan.weeks.flatMap(w =>
    w.sessions.map(s => ({
      ...s,
      date:     overrides[s.id] || s.date,
      dayLabel: overrides[s.id] ? getDayLabel(overrides[s.id]) : s.dayLabel,
    }))
  );

  // Monday de chaque semaine du plan (basé sur les dates originales)
  const weekMondayMap = {};
  plan.weeks.forEach(w => {
    const sorted = w.sessions.map(s => s.date).sort();
    if (sorted.length) weekMondayMap[w.number] = getWeekMonday(sorted[0]);
  });

  // Re-grouper les séances par semaine selon leur date effective
  const weekSessions = {};
  plan.weeks.forEach(w => { weekSessions[w.number] = []; });

  allSessions.forEach(s => {
    const mon   = getWeekMonday(s.date);
    const entry = Object.entries(weekMondayMap).find(([, m]) => m === mon);
    if (entry) weekSessions[parseInt(entry[0])].push(s);
  });

  Object.values(weekSessions).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));

  return { ...plan, weeks: plan.weeks.map(w => ({ ...w, sessions: weekSessions[w.number] || [] })) };
}

export function applyWeekMetaOverrides(plan, metaOverrides) {
  if (!Object.keys(metaOverrides).length) return plan;
  return {
    ...plan,
    weeks: plan.weeks.map(w => {
      const ov = metaOverrides[w.number];
      return ov ? { ...w, ...ov } : w;
    }),
  };
}

export function getWeekMonday(dateStr) {
  const d   = new Date(dateStr + 'T12:00:00');
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export function getDayLabel(dateStr) {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

// Semaine "en cours" = celle dont le lundi calendaire est passé/aujourd'hui.
// Ne se base pas sur la présence d'une séance à une date précise : une
// semaine dont la première séance tombe un mardi (rien le lundi) doit
// quand même devenir "en cours" dès le lundi.
export function getCurrentWeekNum(plan, todayStr) {
  let currentWeekNum = plan.weeks[0]?.number || 1;
  for (const w of plan.weeks) {
    if (!w.sessions.length) continue;
    const earliestDate = w.sessions.reduce((min, s) => (s.date < min ? s.date : min), w.sessions[0].date);
    const monday = getWeekMonday(earliestDate);
    if (monday <= todayStr) currentWeekNum = w.number;
  }
  return currentWeekNum;
}
