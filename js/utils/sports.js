// Sports pratiqués par l'utilisateur (Réglages → Mes sports, dans athlete.json).
//
// L'app reste la même pour tout le monde, elle montre seulement ce qui sert :
// sans course à pied, pas d'onglet Courses, pas de km ni d'allures, et des
// prompts de coach salle ; sans salle, pas de types muscu/cardio à choisir.
// Un profil qui n'a jamais rempli la rubrique (`sports` absent) est traité
// comme un coureur : c'est ce que l'app faisait avant.
//
// athlete.json : sports: ['running', 'gym'], otherSports: 'badminton, yoga',
//                trackWeight: true

import { getAthleteProfile, getEventsIndex } from '../store.js';

export const SPORTS = [
  { id: 'running', label: 'Course à pied', hint: 'Plans de course, allures, parcours GPX' },
  { id: 'gym',     label: 'Salle : muscu / cardio', hint: 'Le plan te programme des séances de muscu / cardio' },
];

export function getSports(profile = getAthleteProfile()) {
  return Array.isArray(profile?.sports) ? profile.sports : ['running'];
}

export const doesRun = (profile) => getSports(profile).includes('running');
export const doesGym = (profile) => getSports(profile).includes('gym');
export const tracksWeight = (profile = getAthleteProfile()) => !!profile?.trackWeight;

// Une ligne lisible pour les prompts : « Course à pied, Salle : muscu / cardio, badminton ».
export function sportsSummary(profile = getAthleteProfile()) {
  const names = getSports(profile).map(id => SPORTS.find(s => s.id === id)?.label).filter(Boolean);
  const other = (profile?.otherSports || '').trim();
  if (other) names.push(other);
  return names.join(', ') || 'Non renseigné';
}

// Onglet Courses (menu du bas, barre latérale) : pour qui court, ou qui a déjà
// des courses enregistrées — décocher « Course à pied » ne doit pas les cacher.
export function showsCourses() {
  return doesRun() || getEventsIndex().length > 0;
}

// Niveau en salle (athlete.json → gymLevel), demandé seulement à qui va en salle.
// Il règle ce que le plan explique et ce qu'on peut se fixer comme objectif :
// - beginner : on ne connaît pas les exercices. Objectifs en mots simples
//   (« fessiers et cuisses ») ; l'IA choisit les exercices et les explique.
// - intermediate : vrais exercices, séries × répétitions × charges.
// - advanced : idem, et objectifs « exercice + charge » qu'on se fixe soi-même.
// Absent = débutant : c'est le cas de qui coche « Salle » sans y avoir réfléchi.
export const GYM_LEVELS = [
  { id: 'beginner',     label: 'Débutant·e',    hint: "Je n'y connais rien : l'IA choisit les exercices et les explique" },
  { id: 'intermediate', label: 'Intermédiaire', hint: "Je connais les exercices de base : l'IA programme séries et charges" },
  { id: 'advanced',     label: 'Confirmé·e',    hint: 'Je me fixe aussi mes propres objectifs de charge par exercice' },
];

export function gymLevel(profile = getAthleteProfile()) {
  return GYM_LEVELS.some(l => l.id === profile?.gymLevel) ? profile.gymLevel : 'beginner';
}
