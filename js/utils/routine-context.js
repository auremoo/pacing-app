// Ce que le plan général apporte aux autres prompts.
//
// Pendant une préparation de course, le plan général est en pause (on ne suit
// jamais deux plans en parallèle) : le plan de course doit donc reprendre lui-même
// les activités fixes de l'athlète (club, badminton…), sinon elles disparaissent
// du planning. Il a aussi intérêt à savoir ce que l'athlète faisait juste avant.
//
// Objectifs perso (meta.targets du plan général) : des envies hors course
// officielle — un chrono (« 5 km en 24'30 »), une charge (« squat 60 kg »), un
// poids (« 58 kg »), ou autre chose. Liste de { kind, what, value, by, achieved } ;
// by (échéance) et achieved sont facultatifs. Les premiers objectifs, purement
// chrono, étaient stockés { distance, time } : normalizeTarget les relit.

import { getRoutineMeta, getActivePlan, getAllSessionStates, getDateOverrides,
         getWeekMetaOverrides, getTypeOverrides, ROUTINE_SLUG } from '../store.js';
import { applyDateOverrides, applyWeekMetaOverrides, applyTypeOverrides } from './plan-overrides.js';
import { addDays, formatDateShort } from './dates.js';
import { typeName } from './session-types.js';

export const TARGET_DISTANCES = ['5 km', '10 km', 'Semi-marathon', 'Marathon'];

// what / value : libellé et exemple des deux champs ; null = champ absent.
export const TARGET_KINDS = {
  chrono: { label: 'Chrono', what: 'Distance', whatPh: 'ex : 5 km', value: 'Temps visé',   valuePh: "ex : 24'30" },
  force:  { label: 'Force',  what: 'Exercice', whatPh: 'ex : Squat', value: 'Charge visée', valuePh: 'ex : 60 kg × 5' },
  poids:  { label: 'Poids',  what: null,       whatPh: '',           value: 'Poids visé',   valuePh: 'ex : 58 kg' },
  autre:  { label: 'Autre',  what: 'Objectif', whatPh: "ex : 10 pompes d'affilée", value: null, valuePh: '' },
};

export function normalizeTarget(t) {
  if (!t) return null;
  if (t.kind) return { kind: t.kind, what: t.what || '', value: t.value || '', by: t.by || '', achieved: !!t.achieved };
  return { kind: 'chrono', what: t.distance || '', value: t.time || '', by: t.by || '', achieved: !!t.achieved };
}

// Les champs que le type d'objectif demande sont tous remplis.
export function isTargetComplete(t) {
  const k = TARGET_KINDS[t.kind];
  if (!k) return false;
  return (!k.what || !!t.what.trim()) && (!k.value || !!t.value.trim());
}

export function targetText(t) {
  const what = t.what.trim(), value = t.value.trim();
  switch (t.kind) {
    case 'chrono': return `${what} en ${value}`;
    case 'force':  return `${what} : ${value}`;
    case 'poids':  return `Atteindre ${value}`;
    default:       return what;
  }
}

export function getTargets(meta = getRoutineMeta()) {
  return (meta?.targets || []).map(normalizeTarget).filter(t => t && isTargetComplete(t));
}

// Une ligne par objectif, pour les prompts.
export function formatTargets(targets) {
  return targets.map(t => {
    const by = t.by ? ` — d'ici le ${formatDateLong(t.by)}` : ' — sans échéance';
    const done = t.achieved ? ' (✓ déjà atteint)' : '';
    return `- [${TARGET_KINDS[t.kind].label}] ${targetText(t)}${by}${done}`;
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
  if (targets.length) parts.push(`**Objectifs personnels (hors course officielle, pour information) :**\n${formatTargets(targets)}\n\nLa course reste la priorité. Si la préparation s'y prête, tu peux les servir au passage (un test chronométré, le renforcement qui va avec), sans nuire à la course.`);
  return parts.join('\n\n');
}
