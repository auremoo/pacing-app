// Clôture d'un événement : cocher la séance de course le clôt et enchaîne sur
// la saisie du résultat ; la décocher le rouvre.
//
// À appeler après chaque toggleSession d'un événement — plan-view et
// session-view cochent tous deux une séance, et un nouveau point de cochage
// devrait l'appeler aussi.

import { getEventMeta, getActivePlan, closeEvent, reopenEvent, ROUTINE_SLUG } from '../store.js';
import { openRaceResultModal } from './race-result-modal.js';

// Le plan général n'a pas d'événement à clore, et une course test au milieu du
// plan (de type `race` elle aussi) ne doit rien clore : seule compte la séance
// qui tombe le jour de la course.
export function isEventRaceSession(session, meta) {
  return !!session && session.type === 'race' && !!meta?.raceDate && session.date === meta.raceDate;
}

export async function syncEventClosure(slug, sessionId, completed) {
  if (slug === ROUTINE_SLUG) return;

  const meta = getEventMeta(slug);
  // Plan brut et non le planning effectif : on compare la date d'origine de la
  // séance à la date de course, qu'un déplacement manuel ne doit pas fausser.
  const session = getActivePlan(slug)?.weeks.flatMap(w => w.sessions).find(s => s.id === sessionId);
  if (!isEventRaceSession(session, meta)) return;

  if (completed) {
    const alreadyClosed = !!meta.closedAt;
    await closeEvent(slug);
    if (!alreadyClosed) openRaceResultModal(slug);
  } else {
    await reopenEvent(slug);
  }
}
