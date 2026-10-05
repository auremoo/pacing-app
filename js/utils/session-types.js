// Types de séance : pastille (badge) et nom complet, source unique.
//
// Deux familles :
// - les types du plan, ceux que le template .md accepte et que le parser valide ;
// - les activités concrètes, qui n'existent que comme remplacement choisi à la
//   main sur une journée du plan général. Sans elles, un footing remplacé par
//   du vélo ou du badminton tomberait sous « CROSS » et ne se distinguerait pas.

export const PLAN_TYPES     = ['easy', 'long', 'intervals', 'tempo', 'hills', 'race', 'strength', 'cross', 'rest'];
export const ACTIVITY_TYPES = ['bike', 'badminton', 'swim', 'hike', 'other'];

export const TYPE_INFO = {
  rest:      { badge: 'REPOS', name: 'Repos' },
  easy:      { badge: 'EF',    name: 'Endurance fondamentale' },
  long:      { badge: 'SL',    name: 'Sortie longue' },
  intervals: { badge: 'FRAC',  name: 'Fractionné' },
  tempo:     { badge: 'TEMPO', name: 'Seuil / Tempo' },
  hills:     { badge: 'CÔTES', name: 'Côtes' },
  race:      { badge: 'RACE',  name: 'Course / Compétition' },
  strength:  { badge: 'PPG',   name: 'PPG / Renforcement' },
  cross:     { badge: 'CROSS', name: 'Cross-training' },
  bike:      { badge: 'VÉLO',  name: 'Vélo' },
  badminton: { badge: 'BAD',   name: 'Badminton' },
  swim:      { badge: 'NAGE',  name: 'Natation' },
  hike:      { badge: 'RANDO', name: 'Marche / Rando' },
  other:     { badge: 'AUTRE', name: 'Autre sport' },
};

export function typeBadge(type) {
  return TYPE_INFO[type]?.badge || String(type).slice(0, 4).toUpperCase();
}

export function typeName(type) {
  return TYPE_INFO[type]?.name || type;
}

// Titre à montrer pour une séance. Quand l'activité a été changée, le titre du
// plan (« Repos », « EF + lignes droites ») décrit ce qui était prévu, plus ce
// qui a été fait : c'est le nom de l'activité qui prend sa place.
export function sessionTitle(session) {
  return session.plannedType ? typeName(session.type) : session.title;
}
