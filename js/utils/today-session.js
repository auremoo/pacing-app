// Trouve la séance du jour tous plans confondus (courses + plan général),
// et détecte si une course a une préparation active aujourd'hui.
// Utilisé par l'accueil (mobile) et la sidebar (desktop) pour rester cohérents.

import { getEventsIndex, getEventMeta, getActivePlan, getDateOverrides, getWeekMetaOverrides,
         getRoutineMeta, ROUTINE_SLUG, getTypeOverrides } from '../store.js';
import { isRaceDone } from './race-status.js';
import { typeName } from './session-types.js';
import { applyDateOverrides, applyWeekMetaOverrides, applyTypeOverrides } from './plan-overrides.js';
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
      // Avec les activités changées : un jour de repos transformé en vélo devient
      // la séance du jour, un footing passé en repos n'en est plus une.
      const effPlan = applyTypeOverrides(
        applyWeekMetaOverrides(
          applyDateOverrides(plan, getDateOverrides(ROUTINE_SLUG)),
          getWeekMetaOverrides(ROUTINE_SLUG)
        ),
        getTypeOverrides(ROUTINE_SLUG)
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
// Une course déjà courue (séance de course cochée) n'est plus une préparation
// en cours, même le jour J où sa période la couvre encore.
export function getActiveRacePreps(todayStr) {
  return getEventsIndex().filter(e => {
    const meta = getEventMeta(e.slug);
    return meta?.activeVersion && meta.planStart && meta.raceDate && !isRaceDone(e.slug) &&
           meta.planStart <= todayStr && todayStr <= meta.raceDate;
  });
}

// Titre à afficher pour la séance du jour : quand l'activité a été changée, le
// titre prévu (« EF + lignes droites ») ne décrit plus ce qui est fait.
export function todaySessionTitle(session) {
  return session.plannedType
    ? `${typeName(session.type)} — à la place de « ${session.title} »`
    : session.title;
}
