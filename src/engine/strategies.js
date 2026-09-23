// Astuces de calcul affichées uniquement à la toute première rencontre d'un fait,
// puis à nouveau si l'enfant reste bloqué au palier 0 après plusieurs essais —
// jamais à chaque fois (voir 1.2 du prompt produit : enseignement explicite,
// puis pure récupération en mémoire). Une par opération, chacune indépendante.

function fingerRuleNine(n) {
  const tens = n - 1;
  const units = 9 - tens;
  return `Astuce du ×9 : la dizaine est ${tens} (un de moins que ${n}), l'unité est ${units} (le complément à 9) → ${tens}${units}.`;
}

function multiplicationHint({ a, b, introGroup }) {
  switch (introGroup) {
    case 'zeros-uns':
      return a === 0 || b === 0
        ? 'Multiplier par 0 donne toujours 0.'
        : "Multiplier par 1 ne change rien : le résultat est l'autre nombre.";
    case 'deux-cinq-dix':
      if (a === 2 || b === 2) return 'Multiplier par 2 : additionne le nombre avec lui-même (un double).';
      if (a === 5 || b === 5) return 'Multiplier par 5 : compte par bonds de 5.';
      return 'Multiplier par 10 : ajoute simplement un 0 à la fin.';
    case 'carres':
      return `${a} × ${a} : un seul nombre à retenir par cœur pour ce carré.`;
    case 'quatre-huit':
      return a === 4 || b === 4
        ? 'Multiplier par 4 : double, puis double encore.'
        : 'Multiplier par 8 : double trois fois de suite.';
    case 'trois-six':
      return a === 6 || b === 6
        ? 'Multiplier par 6 : trouve le ×3, puis double-le.'
        : 'Multiplier par 3 : double le nombre, puis rajoute-le une fois.';
    case 'neuf':
      return fingerRuleNine(a === 9 ? b : a);
    default:
      return "Rappelle-toi : l'ordre ne change pas le résultat (ex. 6×7 = 7×6) — tu le connais peut-être déjà à l'envers.";
  }
}

function divisionHint({ a, b, introGroup }) {
  switch (introGroup) {
    case 'zeros-uns':
      return "Diviser par 1 ne change rien, et un nombre divisé par lui-même donne toujours 1.";
    case 'deux-cinq-dix':
      if (a === 2 || b === 2) return 'Diviser par 2 : trouve la moitié.';
      if (a === 5 || b === 5) return 'Diviser par 5 : combien de fois 5 tient dans le nombre — pense à compter par bonds de 5.';
      return 'Diviser par 10 : enlève simplement le 0 à la fin.';
    case 'carres':
      return `C'est l'envers d'un carré que tu connais : ${a} × ${a} = ${a * a}.`;
    case 'quatre-huit':
      return a === 4 || b === 4
        ? 'Diviser par 4 : prends la moitié de la moitié.'
        : 'Diviser par 8 : prends la moitié, trois fois de suite.';
    case 'trois-six':
      return a === 6 || b === 6
        ? 'Diviser par 6 : divise par 3, puis prends la moitié.'
        : 'Diviser par 3 : pense à combien de fois 3 tient dans le nombre.';
    case 'neuf':
      return "Diviser par 9 : c'est l'envers de la table du 9 — pense à l'astuce des doigts à l'envers.";
    default:
      return "C'est l'envers d'un fait de multiplication que tu connais peut-être déjà.";
  }
}

function additionHint({ a, b, result, introGroup }) {
  if (introGroup === 'passage-dizaine') {
    const toTen = 10 - a;
    return `Fais d'abord un bond jusqu'à 10 (+${toTen}), puis continue avec le reste (+${b - toTen}).`;
  }
  return `Tu connais probablement déjà ce fait — ${a} + ${b} = ${result}, prends un instant pour le confirmer.`;
}

function subtractionHint({ a, b, result, introGroup }) {
  if (introGroup === 'passage-dizaine') {
    return `Pense à l'addition inverse : ${a} + ${b} = ${result}. Recule d'abord jusqu'à 10, puis continue de reculer.`;
  }
  return `Tu connais probablement déjà ce fait — pense à l'addition ${a} + ${b} = ${result}.`;
}

export function strategyHint(family) {
  switch (family.operation) {
    case 'multiplication':
      return multiplicationHint(family);
    case 'division':
      return divisionHint(family);
    case 'addition':
      return additionHint(family);
    case 'subtraction':
      return subtractionHint(family);
    default:
      return '';
  }
}
