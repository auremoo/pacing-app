// Ce que le plan général apporte aux autres prompts.
//
// Pendant une préparation de course, le plan général est en pause (on ne suit
// jamais deux plans en parallèle) : le plan de course doit donc reprendre lui-même
// les activités fixes de l'athlète (club, badminton…), sinon elles disparaissent
// du planning. Il a aussi intérêt à savoir ce que l'athlète faisait juste avant.
//
// Objectifs chrono perso (meta.targets du plan général) : des envies de record
// hors course officielle (« 5 km en 24'30 un de ces jours »). Liste de
// { distance, time, by, achieved } ; by (échéance) et achieved sont facultatifs.

import { getRoutineMeta, getActivePlan, getAllSessionStates, getDateOverrides,
         getWeekMetaOverrides, getTypeOverrides, ROUTINE_SLUG } from '../store.js';
import { applyDateOverrides, applyWeekMetaOverrides, applyTypeOverrides } from './plan-overrides.js';
import { addDays, formatDateShort } from './dates.js';
import { typeName } from './session-types.js';

export const TARGET_DISTANCES = ['5 km', '10 km', 'Semi-marathon', 'Marathon'];

export function getTargets(meta = getRoutineMeta()) {
  return (meta?.targets || []).filter(t => t && (t.distance || '').trim() && (t.time || '').trim());
}

// Une ligne par objectif, pour les prompts.
export function formatTargets(targets) {
  return targets.map(t => {
    const by = t.by ? ` — d'ici le ${formatDateLong(t.by)}` : ' — sans échéance';
    const done = t.achieved ? ' (✓ déjà atteint)' : '';
    return `- ${t.distance.trim()} en ${t.time.trim()}${by}${done}`;
  }).join('\n');
}

function formatDateLong(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Bilan des 4 semaines du plan général précédant `untilDate` (exclu) :
// séances faites par type, activités changées comprises. '' si rien de coché.
function recentRoutineSummary(untilDate) {
  const plan = getActivePlan(ROUTINE_SLUG);
  if (!plan?.weeks?.length) return '';
  const effPlan = applyTypeOverrides(
    applyWeekMetaOverrides(
      applyDateOverrides(plan, getDateOverrides(ROUTINE_SLUG)),
      getWeekMetaOverrides(ROUTINE_SLUG)
    ),
    getTypeOverrides(ROUTINE_SLUG)
  );
  const from = addDays(untilDate, -28);
  const states = getAllSessionStates(ROUTINE_SLUG);
  const sessions = effPlan.weeks.flatMap(w => w.sessions)
    .filter(s => s.type !== 'rest' && s.date >= from && s.date < untilDate);
  const done = sessions.filter(s => states[s.id]?.completed);
  if (!done.length) return '';

  const byType = {};
  done.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
  const types = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${typeName(type)} ×${n}`).join(', ');
  const skipped = sessions.filter(s => states[s.id]?.skipped).length;
  const unknown = sessions.length - done.length - skipped;
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  return `- 4 dernières semaines (du ${formatDateShort(from)} au ${formatDateShort(addDays(untilDate, -1))}), ${plural(sessions.length, 'séance')} prévue${sessions.length > 1 ? 's' : ''} : ${plural(done.length, 'faite')} (${types})${skipped ? `, ${plural(skipped, 'manquée')}` : ''}${unknown ? `, ${unknown} jamais cochée${unknown > 1 ? 's' : ''} (statut inconnu)` : ''}`;
}

// Section « Entraînement général en cours » des prompts de course.
// '' quand il n'y a ni activité récurrente ni historique ni objectif à transmettre.
// L'historique récent ne sert qu'au plan initial : en révision, le plan général
// est en pause depuis le début de la préparation, il n'a plus rien à dire.
export function buildRoutineSectionForRace(todayStr, { withRecent = true } = {}) {
  const meta = getRoutineMeta();
  if (!meta) return '';
  const context = (meta.context || '').trim();
  const recent  = withRecent && meta.activeVersion ? recentRoutineSummary(todayStr) : '';
  const targets = getTargets(meta);
  if (!context && !recent && !targets.length) return '';

  const parts = [];
  if (context) parts.push(`**Activités récurrentes à conserver :**\n${context}\n\nCes activités continuent pendant la préparation : intègre-les comme des séances du plan (type \`cross\` en général, ou le type qui correspond), aux jours où elles ont lieu, et compte leur charge dans la semaine (pas de séance dure la veille ou le lendemain d'une activité intense, récupération suffisante). Le plan général est mis en pause pendant la préparation : si elles ne figurent pas dans ton plan, elles disparaissent de mon planning.`);
  if (recent) parts.push(`**Ce que je faisais ces dernières semaines (plan général) :**\n${recent}`);
  if (targets.length) parts.push(`**Objectifs chrono personnels (hors course officielle, pour information) :**\n${formatTargets(targets)}\n\nLa course reste la priorité. Si la préparation s'y prête, tu peux placer un test chronométré sur l'une de ces distances, sans nuire à la course.`);
  return parts.join('\n\n');
}
