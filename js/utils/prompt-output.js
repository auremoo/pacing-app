// Consigne de livrable commune à tous les prompts dont la réponse s'importe
// dans l'app (plans de course, plan général, stratégie) : sans elle, Claude
// répond souvent dans la conversation, et il faut recopier le plan à la main.
//
// Annoncée en tête (pour qu'elle soit lue avant tout le reste) et détaillée à la
// fin (pour qu'elle soit la dernière chose lue avant de répondre).

export function withFileDeliverable(prompt, filename, firstLine) {
  const head = `**Livrable attendu : un fichier \`${filename}\` à télécharger**, que j'importerai tel quel dans mon application (détails tout à la fin).`;
  const tail = `
---

## 📄 LIVRABLE : UN FICHIER .md

Ta réponse doit être **un fichier Markdown téléchargeable nommé \`${filename}\`** — pas seulement du texte dans la conversation : je l'importe directement dans mon application.

- Crée le fichier comme un document à part (pièce jointe / fichier téléchargeable).
- Le fichier contient **uniquement** le contenu demandé et commence directement par \`${firstLine}\` : pas d'introduction, pas de conclusion, pas de commentaire à l'intérieur.
- Contenu **complet** : rien de coupé ni résumé — toutes les semaines et toutes les séances pour un plan —, sans « … », sans « (identique à la semaine précédente) » ni rien à compléter.
- Tes remarques éventuelles vont dans ton message, à côté du fichier, jamais dedans.
- Seulement si tu ne peux vraiment pas créer de fichier : renvoie le contenu complet dans **un seul** bloc de code \`\`\`markdown, sans rien couper.
`;
  const cut = prompt.indexOf('\n\n');
  const body = cut < 0 ? `${prompt}\n\n${head}` : `${prompt.slice(0, cut)}\n\n${head}${prompt.slice(cut)}`;
  return `${body.trimEnd()}\n${tail}`;
}
