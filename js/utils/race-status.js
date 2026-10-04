// La séance de course d'un événement, et son état.
//
// L'état « course faite » se lit dans state.json, où la séance est cochée.
// meta.json porte bien un closedAt, mais les deux fichiers sont écrits
// séparément et peuvent diverger : c'est arrivé sur Run in Lyon, course cochée
// et closedAt revenu à null après un décochage/recochage rapide. L'affichage se
// fonde donc sur le cochage, source unique, et closedAt ne sert plus qu'à
// l'horodatage et à ne pas reproposer la saisie du résultat.

import { getEventMeta, getActivePlan, getSessionState, ROUTINE_SLUG } from '../store.js';

// Une course test au milieu du plan est elle aussi de type `race` : seule
// compte la séance qui tombe le jour de la course.
export function getRaceSession(slug) {
  if (slug === ROUTINE_SLUG) return null;
  const meta = getEventMeta(slug);
  if (!meta?.raceDate) return null;
  return getActivePlan(slug)?.weeks
    .flatMap(w => w.sessions)
    .find(s => s.type === 'race' && s.date === meta.raceDate) || null;
}

export function isRaceDone(slug) {
  const session = getRaceSession(slug);
  return !!session && !!getSessionState(slug, session.id)?.completed;
}
