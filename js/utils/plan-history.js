// Semaines passées des anciennes versions d'un plan, pour une frise continue.
//
// Une révision importée en cours de route repart souvent de la semaine en
// cours (la v2 du plan général commence le 5 octobre) : sans ceci, le plan
// n'affichait plus que l'avenir, et les semaines déjà faites — coches, notes,
// activités changées — disparaissaient de l'écran alors qu'elles sont archivées
// (store.js, migrateStateToVersion). On remonte donc les versions, de la plus
// récente à la plus ancienne, et on prend chez chacune les semaines antérieures
// à ce qui est déjà couvert.
//
// Affichées en lecture seule : leurs ids (s03-mon…) n'ont de sens que dans leur
// version, une coche ou un lien vers le détail tomberait sur une séance de la
// version active.

import { getEventMeta, getPlanVersion, getAllSessionStates, ensurePlanLoaded } from '../store.js';
import { applyDateOverrides, applyWeekMetaOverrides, applyTypeOverrides, getWeekMonday } from './plan-overrides.js';

function otherVersions(slug) {
  const meta = getEventMeta(slug);
  return (meta?.versions || [])
    .filter(v => v.v !== meta.activeVersion)
    .sort((a, b) => (b.importedAt || '').localeCompare(a.importedAt || '') || b.v - a.v);
}

export async function loadPastVersions(slug) {
  await Promise.all(otherVersions(slug).map(v => ensurePlanLoaded(slug, v.v).catch(() => null)));
}

// → [{ v, week, states }] trié par date ; `states` = état de chaque séance de
// la semaine dans SA version.
export function getPastWeeks(slug, activePlan) {
  const firstActive = activePlan?.weeks.flatMap(w => w.sessions).map(s => s.date).sort()[0];
  if (!firstActive) return [];
  const live    = getAllSessionStates(slug);
  const history = live._history || {};
  const activeIds = new Set(activePlan.weeks.flatMap(w => w.sessions).map(s => s.id));

  // Coupe au lundi de la première semaine active : une version qui démarre un
  // mardi ne doit pas laisser une demi-semaine de l'ancienne à côté d'elle.
  let cutoff = getWeekMonday(firstActive);
  const out = [];
  for (const ver of otherVersions(slug)) {
    const plan = getPlanVersion(slug, ver.v);
    if (!plan) continue;
    const arch = history[`v${ver.v}`] || {};
    const ov   = arch._overrides || {};
    const eff  = applyTypeOverrides(
      applyWeekMetaOverrides(applyDateOverrides(plan, ov._dateOverrides || {}), ov._weekMetaOverrides || {}),
      ov._typeOverrides || {}
    );
    // État d'une séance : l'archive de sa version ; à défaut (versions
    // importées avant l'archivage), l'état vivant s'il ne peut pas appartenir
    // à la version active.
    const stateOf = id => arch[id]
      || (live[id] && !activeIds.has(id) && (live[id].version == null || live[id].version === ver.v) ? live[id] : null);

    const taken = [];
    for (const w of eff.weeks) {
      const sessions = w.sessions.filter(s => s.date < cutoff);
      if (!sessions.length) continue;
      const states = {};
      sessions.forEach(s => { const st = stateOf(s.id); if (st) states[s.id] = st; });
      taken.push({ v: ver.v, week: { ...w, sessions }, states });
    }
    if (!taken.length) continue;
    out.push(...taken);
    cutoff = getWeekMonday(taken.flatMap(t => t.week.sessions).map(s => s.date).sort()[0]);
  }
  return out.sort((a, b) => a.week.sessions[0].date.localeCompare(b.week.sessions[0].date));
}

// Numéros affichés sur toute la frise : les semaines passées des anciennes
// versions d'abord (1, 2, …), puis celles de la version active à la suite.
// Chaque version recommence à S01 dans son .md ; sans ça, Margot voyait trois
// « S01 » d'affilée (v1, v3, puis la v4 en cours). Les numéros internes du plan
// (ids de séance, prompts) ne changent pas.
export function weekNumbering(pastWeeks, activePlan) {
  const offset = pastWeeks.length;
  const order  = new Map((activePlan?.weeks || []).map((w, i) => [w.number, offset + i + 1]));
  return { past: i => i + 1, active: n => order.get(n) ?? n };
}
