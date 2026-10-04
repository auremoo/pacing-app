// Clôture d'un événement : cocher la séance de course le clôt et enchaîne sur
// la saisie du résultat ; la décocher le rouvre.
//
// À appeler après chaque toggleSession d'un événement — plan-view et
// session-view cochent tous deux une séance, et un nouveau point de cochage
// devrait l'appeler aussi.

import { getEventMeta, closeEvent, reopenEvent, ROUTINE_SLUG } from '../store.js';
import { getRaceSession } from '../utils/race-status.js';
import { openRaceResultModal } from './race-result-modal.js';

export async function syncEventClosure(slug, sessionId, completed) {
  if (slug === ROUTINE_SLUG) return;

  const meta = getEventMeta(slug);
  // getRaceSession lit le plan brut : la date d'origine de la séance, qu'un
  // déplacement manuel ne doit pas fausser.
  if (getRaceSession(slug)?.id !== sessionId) return;

  if (completed) {
    const alreadyClosed = !!meta.closedAt;
    await closeEvent(slug);
    if (!alreadyClosed) openRaceResultModal(slug);
  } else {
    await reopenEvent(slug);
  }
}
