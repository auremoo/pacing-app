// Trouve la séance du jour tous plans confondus (courses + plan général),
// et détecte si une course a une préparation active aujourd'hui.
// Utilisé par l'accueil (mobile) et la sidebar (desktop) pour rester cohérents.

import { getEventsIndex, getEventMeta, getActivePlan, getDateOverrides, getWeekMetaOverrides,
         getRoutineMeta, ROUTINE_SLUG } from '../store.js';
import { applyDateOverrides, applyWeekMetaOverrides } from './plan-overrides.js';
import { computeEventRanges, computePausedWeeks } from './routine-overlap.js';

// { slug, eventName, session, kind: 'event' | 'routine' } | null
export function findTodaySession(todayStr) {
  for (const e of getEventsIndex()) {
    const plan = getActivePlan(e.slug);
    if (!plan) continue;
    const effPlan = applyDateOverrides(plan, getDateOverrides(e.slug));
    for (const week of effPlan.weeks) {
      for (const s of week.sessions) {
        if (s.date === todayStr && s.type !== 'rest') {
          return { slug: e.slug, eventName: e.name, session: s, kind: 'event' };
        }
      }
    }
  }

  const routineMeta = getRoutineMeta();
  if (routineMeta?.activeVersion) {
    const plan = getActivePlan(ROUTINE_SLUG);
    if (plan) {
      const effPlan = applyWeekMetaOverrides(
        applyDateOverrides(plan, getDateOverrides(ROUTINE_SLUG)),
        getWeekMetaOverrides(ROUTINE_SLUG)
      );
      const pausedWeeks = computePausedWeeks(effPlan, computeEventRanges(getEventsIndex(), getEventMeta));
      for (const week of effPlan.weeks) {
        if (pausedWeeks.has(week.number)) continue;
        for (const s of week.sessions) {
          if (s.date === todayStr && s.type !== 'rest') {
            return { slug: ROUTINE_SLUG, eventName: 'Entraînement général', session: s, kind: 'routine' };
          }
        }
      }
    }
  }

  return null;
}

// Courses dont la période de plan (planStart → raceDate) couvre aujourd'hui.
export function getActiveRacePreps(todayStr) {
  return getEventsIndex().filter(e => {
    const meta = getEventMeta(e.slug);
    return meta?.activeVersion && meta.planStart && meta.raceDate &&
           meta.planStart <= todayStr && todayStr <= meta.raceDate;
  });
}
