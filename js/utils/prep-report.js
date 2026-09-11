// Bilan de fin de préparation : reconstruit l'historique réel de la prépa
// toutes versions de plan confondues, puis construit le prompt de stratégie
// de course (l'IA choisit elle-même l'objectif atteignable).
//
// Règle de lecture du réalisé (convention de l'app, à rappeler à l'IA) :
//   séance cochée SANS note  → faite exactement comme prescrite dans le plan
//   séance cochée AVEC note  → la note décrit l'écart au prescrit
//   séance marquée manquée   → non faite
//
// Règle de rattachement à une version : state.json porte désormais `version`
// au moment du cochage. Pour l'historique antérieur à ce champ, on déduit la
// version en vigueur à la date du cochage via versions[].importedAt — deux
// versions peuvent partager les mêmes numéros de semaine aux mêmes dates avec
// des séances différentes, et seule cette date tranche.

import { getEventMeta, getAllSessionStates, getActivePlan, getPlanVersion,
         ensurePlanLoaded, getDateOverrides, getWeekMetaOverrides } from '../store.js';
import { applyDateOverrides, applyWeekMetaOverrides } from './plan-overrides.js';
import { today } from './dates.js';

// ── Déclencheur ───────────────────────────────────────────────────
// Dernière séance d'entraînement du plan actif, course exclue : le bilan doit
// se proposer AVANT la course, or la dernière séance du plan est la course.

export function getLastTrainingSession(slug) {
  const plan = effectivePlan(slug, getActivePlan(slug));
  if (!plan) return null;

  const trainings = plan.weeks
    .flatMap(w => w.sessions)
    .filter(s => s.type !== 'race' && s.type !== 'rest')
    .sort((a, b) => a.date.localeCompare(b.date));

  return trainings[trainings.length - 1] || null;
}

export function isPrepComplete(slug) {
  const last = getLastTrainingSession(slug);
  if (!last) return false;
  const st = getAllSessionStates(slug)[last.id];
  return !!(st?.completed || st?.skipped);
}

// ── Consolidation multi-versions ──────────────────────────────────

export async function loadAllPlanVersions(slug) {
  const meta = getEventMeta(slug);
  await Promise.all((meta?.versions || []).map(v => ensurePlanLoaded(slug, v.v).catch(() => null)));
}

function versionInForceAt(meta, isoTimestamp) {
  const sorted = (meta?.versions || []).slice().sort((a, b) => (a.importedAt || '').localeCompare(b.importedAt || ''));
  if (!sorted.length) return null;
  let current = sorted[0].v;
  for (const v of sorted) {
    if (v.importedAt && isoTimestamp && v.importedAt <= isoTimestamp) current = v.v;
  }
  return current;
}

function effectivePlan(slug, plan) {
  if (!plan) return null;
  return applyWeekMetaOverrides(
    applyDateOverrides(plan, getDateOverrides(slug)),
    getWeekMetaOverrides(slug)
  );
}

function findSessionInVersion(slug, v, id) {
  const plan = getPlanVersion(slug, v);
  if (!plan) return null;
  return plan.weeks.flatMap(w => w.sessions).find(s => s.id === id) || null;
}

// Retourne { sessions, stats, weeks } — les séances sont dédupliquées par id,
// datées effectivement (déplacements manuels inclus), triées chronologiquement,
// et les jours de repos sont exclus (ils n'apprennent rien sur la préparation).
export function buildConsolidatedHistory(slug) {
  const meta       = getEventMeta(slug);
  const states     = getAllSessionStates(slug);
  const overrides  = getDateOverrides(slug);
  const versionNums = (meta?.versions || []).map(v => v.v).sort((a, b) => b - a);
  const todayStr   = today();

  const sessions = [];
  const seen     = new Set();

  // 1. Tout ce qui a été traité (coché ou manqué), rattaché à sa version
  for (const [id, st] of Object.entries(states)) {
    if (id.startsWith('_')) continue;               // _dateOverrides, _weekMeta…
    if (!st?.completed && !st?.skipped) continue;

    const stamp    = st.completedAt || st.skippedAt || '';
    const inferred = st.version == null;
    let version    = st.version ?? versionInForceAt(meta, stamp);
    let session    = version != null ? findSessionInVersion(slug, version, id) : null;

    // L'id n'existe pas dans cette version (structure de semaine différente) :
    // on le retrouve dans une autre version plutôt que de perdre la séance.
    if (!session) {
      for (const v of versionNums) {
        const found = findSessionInVersion(slug, v, id);
        if (found) { session = found; version = v; break; }
      }
    }
    if (!session) continue;                          // séance d'un plan supprimé
    if (session.type === 'rest') continue;           // le repos n'apprend rien sur la prépa

    seen.add(id);
    sessions.push({
      ...session,
      date:   overrides[id] || session.date,
      status: st.completed ? 'done' : 'skipped',
      note:   st.note || '',
      skipReason: st.skipReason || null,
      version, versionInferred: inferred,
    });
  }

  // 2. Les séances passées du plan actif jamais traitées
  const active = effectivePlan(slug, getActivePlan(slug));
  if (active) {
    for (const s of active.weeks.flatMap(w => w.sessions)) {
      if (seen.has(s.id) || s.type === 'rest' || s.type === 'race') continue;
      if (s.date > todayStr) continue;
      sessions.push({ ...s, status: 'untracked', note: '', skipReason: null,
                      version: meta?.activeVersion ?? null, versionInferred: false });
    }
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  return { sessions, stats: buildStats(sessions), weeks: groupByWeek(sessions) };
}

function buildStats(sessions) {
  const counted = sessions;   // le repos est déjà exclu de l'historique
  const by = {};

  for (const s of counted) {
    if (!by[s.type]) by[s.type] = { done: 0, skipped: 0, untracked: 0, total: 0 };
    by[s.type][s.status]++;
    by[s.type].total++;
  }

  const done      = counted.filter(s => s.status === 'done').length;
  const skipped   = counted.filter(s => s.status === 'skipped').length;
  const untracked = counted.filter(s => s.status === 'untracked').length;

  return {
    total: counted.length, done, skipped, untracked,
    pct: counted.length ? Math.round(done / counted.length * 100) : 0,
    byType: by,
    withNote: counted.filter(s => s.status === 'done' && s.note).length,
  };
}

function groupByWeek(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.weekNum)) map.set(s.weekNum, []);
    map.get(s.weekNum).push(s);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, list]) => ({ number, sessions: list }));
}

// ── Bilan markdown (events/{slug}/bilan.md) ───────────────────────

const TYPE_FR = {
  rest: 'Repos', easy: 'Footing', long: 'Sortie longue', intervals: 'Fractionné',
  tempo: 'Tempo/seuil', hills: 'Côtes', race: 'Course', strength: 'PPG', cross: 'Cross-training',
};
const SKIP_FR = {
  vacances: 'vacances', professionnel: 'empêchement pro', maladie: 'maladie',
  blessure: 'blessure', autre: 'autre',
};

function statusLabel(s) {
  if (s.status === 'done')    return s.note ? 'Faite (avec écart, voir note)' : 'Faite comme prescrite';
  if (s.status === 'skipped') return `Non faite${s.skipReason ? ` (${SKIP_FR[s.skipReason] || s.skipReason})` : ''}`;
  return 'Jamais cochée (statut inconnu)';
}

// L'objectif de départ est lu dans le plan v1 : meta.json est écrasé à chaque
// révision d'objectif, seul le premier plan importé garde l'intention initiale.
export function getObjectiveHistory(slug) {
  const meta = getEventMeta(slug);
  return (meta?.versions || [])
    .slice()
    .sort((a, b) => a.v - b.v)
    .map(v => {
      const plan = getPlanVersion(slug, v.v);
      return {
        v: v.v,
        importedAt: v.importedAt,
        label: v.label || `Version ${v.v}`,
        objective: plan?.meta?.objective_time || '',
        realistic: plan?.meta?.objective_realistic || '',
      };
    });
}

// Détail semaine par semaine : partagé par le bilan et le prompt, qui a déjà
// son propre en-tête et n'a pas besoin du bilan complet.
export function buildWeekDetail(history) {
  return history.weeks.map(w => {
    const rows = w.sessions.map(s => {
      const vTag = `v${s.version}${s.versionInferred ? '*' : ''}`;
      const note = s.note ? s.note.replace(/\n/g, ' ').replace(/\|/g, '/') : '';
      return `| ${s.date} | ${vTag} | ${TYPE_FR[s.type] || s.type} | ${s.title.replace(/\|/g, '/')} | ${statusLabel(s)} | ${note || '—'} |`;
    }).join('\n');

    const prescribed = w.sessions.map(s =>
      `- **${s.date} — ${s.title}** (${TYPE_FR[s.type] || s.type}, plan v${s.version}) : ${(s.description || '').replace(/\n/g, ' ')}`
    ).join('\n');

    return `### S${String(w.number).padStart(2, '0')}

| Date | Plan | Type | Séance | Statut | Note de l'athlète |
|---|---|---|---|---|---|
${rows}

<details><summary>Contenu prescrit de ces séances</summary>

${prescribed}

</details>`;
  }).join('\n\n');
}

export function buildPrepReportMarkdown(slug, history) {
  const meta       = getEventMeta(slug);
  const objectives = getObjectiveHistory(slug);
  const { stats }  = history;

  const objLines = objectives.map(o =>
    `| v${o.v} | ${(o.importedAt || '').slice(0, 10)} | ${o.objective || '—'} | ${o.realistic || '—'} |`
  ).join('\n');

  const typeLines = Object.entries(stats.byType)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([type, c]) => `| ${TYPE_FR[type] || type} | ${c.done}/${c.total} | ${c.skipped} | ${c.untracked} |`)
    .join('\n');

  return `# Bilan de préparation — ${meta.name}

Généré le ${today()} par l'app. Historique consolidé de toutes les versions du plan.

## Événement

- Course : ${meta.name}${meta.location ? ` — ${meta.location}` : ''}
- Date : ${meta.raceDate}
- Distance : ${meta.distanceKm} km · D+ ${meta.elevationGainM || 0} m
- Parcours : ${meta.courseDescription || 'non renseigné'}

## Objectif de départ et ses révisions

| Version | Importée le | Objectif temps | Fourchette réaliste |
|---|---|---|---|
${objLines || '| — | — | — | — |'}

L'objectif **de départ** est celui de la v1. Les lignes suivantes montrent comment il a été révisé en cours de préparation.

## Assiduité globale

- Séances d'entraînement prévues (repos exclu) : **${stats.total}**
- Réalisées : **${stats.done} (${stats.pct} %)**
- Non faites : **${stats.skipped}**
- Jamais cochées, statut inconnu : **${stats.untracked}**
- Dont réalisées avec un écart noté : **${stats.withNote}**

| Type de séance | Faites | Non faites | Inconnues |
|---|---|---|---|
${typeLines || '| — | — | — | — |'}

## Détail semaine par semaine

Colonne **Plan** = version du plan dont provient la séance. Un astérisque (\`v2*\`)
signale une version déduite de la date de cochage (cochage antérieur à
l'enregistrement de la version dans l'app), et non enregistrée à l'époque.

${buildWeekDetail(history) || '_Aucune séance enregistrée._'}
`;
}

// ── Prompt de stratégie de course ─────────────────────────────────

function kmProfileTable(kms) {
  if (!kms?.length) return null;
  const rows = kms.map(k =>
    `| ${k.km} | ${k.lengthM < 1000 ? `${k.lengthM} m` : '1 km'} | +${k.gainM} | -${k.lossM} | ${k.startEleM} → ${k.endEleM} |`
  ).join('\n');
  return `| Km | Longueur | D+ (m) | D- (m) | Altitude |\n|---|---|---|---|---|\n${rows}`;
}

export function buildStrategyPrompt(slug, history, athlete, kms, gpxTotals) {
  const meta       = getEventMeta(slug);
  const objectives = getObjectiveHistory(slug);
  const start      = objectives[0];
  const last       = objectives[objectives.length - 1];
  const { stats }  = history;
  const a          = athlete || {};

  const profileTable = kmProfileTable(kms);

  return `Tu es un coach running expert. Ma préparation est terminée, la course a lieu le ${meta.raceDate}.

**Ta mission :** analyser ma préparation réelle, **choisir toi-même l'objectif de temps atteignable** — honnête mais légèrement ambitieux, sans surpromettre — puis me donner une stratégie de course complète pour aller le chercher.

Ne reprends pas mécaniquement l'objectif de départ : c'était une intention, pas une promesse. Si la prépa le justifie, revois-le à la baisse et dis-le franchement ; si elle a mieux tourné que prévu, ose viser plus haut. Justifie ton objectif par des éléments concrets du bilan ci-dessous.

---

## Comment lire mon bilan d'entraînement (important)

- Une séance **faite sans note** a été réalisée **exactement comme prescrite** dans le plan (allures, durées, distances, répétitions du contenu prescrit). C'est ma convention : je ne note que les écarts.
- Une séance **faite avec une note** a été réalisée avec l'écart décrit dans la note — la note fait foi sur le prescrit.
- Une séance **non faite** n'a pas été réalisée du tout.
- Une séance **jamais cochée** est un statut inconnu : ne suppose ni qu'elle a été faite, ni l'inverse.
- Certaines notes sont des résidus sans information (\`Autre\`, \`Vacances\`, un mot isolé) : sur une séance faite, traite-la alors comme faite conformément au prescrit.
- Le contenu prescrit de chaque séance est dans les blocs dépliants du bilan : c'est lui qui donne mes allures réelles quand il n'y a pas de note.

---

## Profil athlète

- Niveau et expérience : ${a.level || 'Non renseigné'}
- Meilleures performances récentes : ${a.perfs || 'Non renseigné'}
- Volume hebdomadaire habituel : ${a.volume || 'Non renseigné'}
- Jours disponibles : ${a.days || 'Non renseigné'}
- Équipements : ${a.equipment || 'Non renseigné'}
- Terrain local : ${a.terrain || 'Non renseigné'}
- Pathologies / points de vigilance : ${a.pathologies || 'Aucune'}
- Objectifs secondaires : ${a.goals || 'Aucun'}

## La course

- ${meta.name}${meta.location ? ` — ${meta.location}` : ''}, le ${meta.raceDate}
- Distance officielle : ${meta.distanceKm} km
- Dénivelé positif officiel : ${meta.elevationGainM || 0} m
- Description : ${meta.courseDescription || 'non renseignée'}
${gpxTotals ? `- Trace GPX importée : ${gpxTotals.distanceKm} km, D+ ${gpxTotals.elevationGainM} m, D- ${gpxTotals.elevationLossM} m, altitude ${gpxTotals.minElevationM}–${gpxTotals.maxElevationM} m` : '- Aucune trace GPX importée'}

## Objectif de départ et ses révisions

${objectives.map(o => `- **v${o.v}** (${(o.importedAt || '').slice(0, 10)}) — objectif : ${o.objective || '—'} · fourchette réaliste : ${o.realistic || '—'}`).join('\n')}

Objectif **de départ** (v1) : **${start?.objective || 'non renseigné'}**${start?.realistic ? ` (réaliste annoncé : ${start.realistic})` : ''}.
Dernière révision en date (v${last?.v}) : ${last?.objective || '—'}${last?.realistic ? ` · ${last.realistic}` : ''}.

## Assiduité réelle sur toute la préparation

- Séances d'entraînement prévues (repos exclu) : **${stats.total}**
- Réalisées : **${stats.done} (${stats.pct} %)** · Non faites : **${stats.skipped}** · Statut inconnu : **${stats.untracked}**

| Type de séance | Faites | Non faites | Inconnues |
|---|---|---|---|
${Object.entries(stats.byType).sort((x, y) => y[1].total - x[1].total).map(([t, c]) => `| ${TYPE_FR[t] || t} | ${c.done}/${c.total} | ${c.skipped} | ${c.untracked} |`).join('\n')}

${profileTable ? `## Profil du parcours, kilomètre par kilomètre

Calculé depuis la trace GPX (lissage 3 points, seuil 1,5 m). Le D+ est recalculé
par tranche, la somme peut donc s'écarter de quelques mètres du D+ total.

${profileTable}
` : ''}
---

## Détail de la préparation, semaine par semaine

Colonne **Plan** = version du plan dont provient la séance (plusieurs versions se
sont succédé pendant la préparation). Les blocs dépliants donnent le contenu
prescrit de chaque séance : c'est la référence de ce qui a été fait quand aucune
note ne signale d'écart.

${buildWeekDetail(history)}

---

## Ce que j'attends de toi

1. **Analyse de la préparation** — ce qui a été réellement encaissé : volume, régularité, qualité (séances de seuil/fractionné/sorties longues effectivement faites), coupures et leur impact, tendance sur les dernières semaines.
2. **Objectif retenu** — un temps cible chiffré que **tu** choisis, avec une fourchette basse/haute, et l'explication de ce qui le justifie dans mon bilan. Honnête mais un peu ambitieux : je dois avoir à me battre pour l'atteindre, pas à faire un miracle.
3. **Plan d'allure kilomètre par kilomètre** (ou par segments cohérents), basé sur le relief réel ci-dessus et non sur une allure moyenne plate. Donne l'allure visée et le temps de passage cumulé.
4. **Les points chauds du parcours** — où ça peut casser, où lâcher les chevaux, où se contenir.
5. **Plan B** — si les sensations sont mauvaises aux premiers kilomètres, comment réajuster sans saborder la course.
6. **Nutrition et hydratation** — les 48 h avant, le matin même, pendant la course (quoi, quand, où).
7. **Mental et gestion de l'effort** — sur quoi me concentrer à chaque tiers de course.

Sois direct et concret. Si ma préparation ne permet pas l'objectif de départ, dis-le clairement plutôt que de me faire plaisir.

Réponds en markdown, sans introduction ni conclusion superflue, en commençant directement par \`# Stratégie de course — ${meta.name}\`.
`;
}
