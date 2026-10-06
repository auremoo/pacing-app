// Trouve la séance du jour tous plans confondus (courses + plan général),
// et détecte si une course a une préparation active aujourd'hui.
// Utilisé par l'accueil (mobile) et la sidebar (desktop) pour rester cohérents.

import { getEventsIndex, getEventMeta, getActivePlan, getDateOverrides, getWeekMetaOverrides,
         getRoutineMeta, ROUTINE_SLUG, getTypeOverrides, getAllSessionStates } from '../store.js';
import { isRaceDone } from './race-status.js';
import { typeName } from './session-types.js';
import { applyDateOverrides, applyWeekMetaOverrides, applyTypeOverrides, getCurrentWeekNum } from './plan-overrides.js';
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

// Où en est le plan général : semaine en cours, séances faites, prochaine
// séance. null quand il n'y a rien à montrer — pas de plan, plan terminé, ou
// semaine en pause parce qu'une préparation de course a pris le relais.
// Sert à l'accueil contextuel : la course quand on en prépare une, sinon
// l'entraînement.
export function getRoutineProgress(todayStr) {
  if (!getRoutineMeta()?.activeVersion) return null;
  const plan = getActivePlan(ROUTINE_SLUG);
  if (!plan?.weeks?.length) return null;

  const effPlan = applyTypeOverrides(
    applyWeekMetaOverrides(
      applyDateOverrides(plan, getDateOverrides(ROUTINE_SLUG)),
      getWeekMetaOverrides(ROUTINE_SLUG)
    ),
    getTypeOverrides(ROUTINE_SLUG)
  );

  const all = effPlan.weeks.flatMap(w => w.sessions);
  const lastDate = all.reduce((m, s) => (s.date > m ? s.date : m), '');
  const firstDate = all.reduce((m, s) => (!m || s.date < m ? s.date : m), '');
  if (!lastDate || todayStr > lastDate || todayStr < firstDate) return null;

  const weekNum = getCurrentWeekNum(effPlan, todayStr);
  const week = effPlan.weeks.find(w => w.number === weekNum);
  if (!week) return null;

  const paused = computePausedWeeks(effPlan, computeEventRanges(getEventsIndex(), getEventMeta));
  if (paused.has(weekNum)) return null;

  const states   = getAllSessionStates(ROUTINE_SLUG);
  const training = week.sessions.filter(s => s.type !== 'rest');
  const done     = training.filter(s => states[s.id]?.completed).length;

  // La séance du jour a déjà sa carte : la « prochaine » commence demain.
  const next = all
    .filter(s => s.type !== 'rest' && s.date > todayStr && !states[s.id]?.completed && !states[s.id]?.skipped)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;

  const phase = (effPlan.phases || []).find(p => p.weeks.includes(week.number)) || null;

  return { week, weekCount: effPlan.weeks.length, done, total: training.length, next, phase };
}
