// Astuces de calcul affichées uniquement à la toute première rencontre d'un fait,
// puis à nouveau si l'enfant reste bloqué au palier 0 après plusieurs essais —
// jamais à chaque fois (voir 1.2 du prompt produit : enseignement explicite,
// puis pure récupération en mémoire).

function fingerRuleNine(n) {
  const tens = n - 1;
  const units = 9 - tens;
  return `Astuce du ×9 : la dizaine est ${tens} (un de moins que ${n}), l'unité est ${units} (le complément à 9) → ${tens}${units}.`;
}

export function strategyHint(family) {
  const { a, b, introGroup } = family;

  if (family.operation === 'mult-div') {
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

  if (introGroup === 'passage-dizaine') {
    const toTen = 10 - a;
    return `Fais d'abord un bond jusqu'à 10 (+${toTen}), puis continue avec le reste (+${b - toTen}).`;
  }
  return 'Tu connais probablement déjà ce fait — prends un instant pour le confirmer.';
}
