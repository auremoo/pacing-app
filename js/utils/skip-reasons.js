// Raisons d'une séance manquée — source unique des libellés, partagée par le
// plan, les prompts et le bilan de préparation.
//
// Quand une séance est marquée manquée, plan-view préfixe le libellé de la
// raison dans la note pour qu'elle reste visible dans le détail de séance.
// Ce libellé doit disparaître dès que la séance n'est plus manquée, sinon il
// se lit ensuite comme une note de l'athlète sur une séance faite.

export const SKIP_REASON_LABELS = {
  vacances:      'Vacances',
  professionnel: 'Empêchement pro.',
  maladie:       'Maladie',
  blessure:      'Blessure',
  autre:         'Autre',
};

// Variantes de libellés écrites dans les notes par les versions précédentes
// de l'app : le nettoyage doit les reconnaître aussi.
const LEGACY_LABELS = ['Empêch. pro.', 'Empêchement pro', 'Empêch. pro'];

const REASON_LINES = new Set(
  [...Object.values(SKIP_REASON_LABELS), ...Object.keys(SKIP_REASON_LABELS), ...LEGACY_LABELS]
    .map(l => l.toLowerCase())
);

export function skipReasonLabel(reason) {
  return reason ? (SKIP_REASON_LABELS[reason] || reason) : '';
}

// Retire les lignes qui ne sont QUE le libellé d'une raison ; tout le reste du
// texte de l'athlète est conservé tel quel.
export function stripReasonLines(note) {
  if (!note) return '';
  return note
    .split('\n')
    .filter(line => !REASON_LINES.has(line.trim().toLowerCase()))
    .join('\n')
    .trim();
}
