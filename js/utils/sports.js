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
  { id: 'running', label: 'Course à pied', hint: 'Courses, plans de course, allures. Décoché, tes courses sont masquées, pas supprimées' },
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

// Courses : visibles seulement si « Course à pied » est coché. Décocher ne
// supprime rien — events/ et l'état des séances restent sur GitHub — mais tout
// ce qui touche aux courses disparaît : menu, accueil, séance du jour, pause
// du plan général pendant une prépa, routes /courses et /event. Recocher fait
// tout réapparaître tel quel. Passer par visibleEvents() plutôt que
// getEventsIndex() partout où l'on montre ou utilise les courses.
export function showsCourses() {
  return doesRun();
}

export function visibleEvents() {
  return doesRun() ? getEventsIndex() : [];
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
