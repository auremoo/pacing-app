// Consigne de progression ajoutée à tous les prompts de plan (course et plan
// général, initial et révision). Sans elle, les plans générés restaient
// « plats » : mêmes séances d'une semaine à l'autre, intensité qui monte à peine
// (retour d'utilisation, octobre 2026). Le curseur « Vitesse de progression »
// (plan-tuning.js) module ensuite le rythme.

function rules({ run, gym, isRevision }) {
  const lines = [
    "- **Chaque semaine (hors décharge) est un peu plus exigeante que la précédente**, sur au moins un levier précis et visible dans la description des séances. Jamais deux semaines identiques d'affilée : une même séance type doit montrer son évolution.",
    "- **Cycles** : 2 à 3 semaines de montée puis 1 semaine de décharge (volume −20 à −30 %, intensité gardée, `DÉCHARGE` dans la note). **Le cycle suivant repart plus haut que le précédent**, pas au même niveau.",
  ];
  if (run) lines.push("- **Course** : volume hebdo +5 à 10 % par semaine de montée ; sortie longue +1 à 2 km (ou +10 min) ; fractionné : plus de répétitions, des répétitions plus longues ou une allure un peu plus rapide ; seuil : blocs plus longs. Un seul levier à la fois par séance.");
  if (gym) lines.push("- **Salle** : double progression écrite noir sur blanc — quand toutes les séries atteignent le haut de la fourchette de répétitions, la charge augmente la semaine suivante (+2,5 à 5 %, ou « un cran au-dessus » sur machine). Écris la cible de la semaine dans chaque séance (ex : S01 3×10, S02 3×12, S03 4×10 un peu plus lourd). Fais évoluer quelques exercices à chaque nouveau cycle.");
  lines.push("- **Garde-fous** : respecte mon niveau, mes points de vigilance et ma récupération ; si tu dois freiner, dis pourquoi dans la SYNTHESE au lieu de faire du sur-place.");
  if (isRevision) lines.push("- **D'après ce que j'ai fait** : une séance cochée sans note a été faite à la lettre, donc la charge était tenable — accélère la progression sur ces séances. Une note qui signale de la difficulté ou des séances manquées justifient de la tenir.");
  lines.push("- Dans la SYNTHESE, ajoute un tableau **Progression** : pour 2 ou 3 séances clés, leur contenu en début, au milieu et en fin de plan.");
  lines.push("- **Vérifie avant d'envoyer** : si une séance clé est identique à elle-même trois semaines plus tôt (hors décharge), corrige-la.");
  return lines.join('\n');
}

// Insère la section juste avant le format de sortie (comme les réglages).
export function withProgression(prompt, opts) {
  const section = `## 📈 Progression (obligatoire)\n\n${rules(opts)}\n\n---\n\n`;
  const at = prompt.search(/(\*\*|## )FORMAT DE SORTIE/);
  return at < 0 ? `${prompt.trimEnd()}\n\n${section}` : `${prompt.slice(0, at)}${section}${prompt.slice(at)}`;
}
