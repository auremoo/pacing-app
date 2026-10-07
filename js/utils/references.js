// Programmes ou conseils reçus (coach, ami, réseaux), collés tels quels —
// dans Contexte pour le plan général, dans les infos d'une course pour sa
// préparation. Une source d'inspiration, jamais un plan à recopier : ils sont
// souvent écrits pour un autre rythme (4 séances quand on en fait 3).

export function referencesSection(text, level) {
  text = (text || '').trim();
  if (!text) return '';
  return `
${level} Programmes et conseils qu'on m'a donnés (exemples, à adapter)

${text}

Ce sont des exemples, pas des consignes à suivre à la lettre. Inspire-t'en (choix des séances ou des exercices, répartition sur la semaine) mais adapte-les à mon niveau, à mes jours disponibles, au nombre de séances visé — un programme pensé pour 4 séances doit être recombiné sur mes séances réelles, sans en perdre l'essentiel — et à mes points de vigilance. Dis dans la SYNTHESE ce que tu as repris et ce que tu as changé.

`;
}
