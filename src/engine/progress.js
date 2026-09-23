// Calcule la progression réelle à partir des paliers Leitner — jamais un score
// décoratif déconnecté de la mémorisation. % = moyenne des paliers (0-4) des
// familles, normalisée sur le palier maximal.

import { MAX_BOX } from './leitner.js';

const GROUP_LABELS = {
  'multiplication:zeros-uns': '×0 et ×1',
  'multiplication:deux-cinq-dix': '×2, ×5, ×10',
  'multiplication:carres': 'Les carrés',
  'multiplication:quatre-huit': '×4 et ×8',
  'multiplication:trois-six': '×3 et ×6',
  'multiplication:neuf': '×9',
  'multiplication:sept-et-reste': '×7 et le reste',
  'division:zeros-uns': '÷1',
  'division:deux-cinq-dix': '÷2, ÷5, ÷10',
  'division:carres': 'Envers des carrés',
  'division:quatre-huit': '÷4 et ÷8',
  'division:trois-six': '÷3 et ÷6',
  'division:neuf': '÷9',
  'division:sept-et-reste': '÷7 et le reste',
  'addition:passage-dizaine': 'Additions qui passent la dizaine',
  'addition:connues': 'Additions déjà connues',
  'subtraction:passage-dizaine': 'Soustractions qui passent la dizaine',
  'subtraction:connues': 'Soustractions déjà connues',
};

export function computeProgress(families, cardsById) {
  const groupStats = new Map();
  let totalBoxSum = 0;

  for (const family of families) {
    const card = cardsById.get(family.id);
    const box = card ? card.box : 0;
    totalBoxSum += box;

    const key = `${family.operation}:${family.introGroup}`;
    if (!groupStats.has(key)) {
      groupStats.set(key, { total: 0, boxSum: 0, masteredCount: 0 });
    }
    const stats = groupStats.get(key);
    stats.total += 1;
    stats.boxSum += box;
    if (box >= MAX_BOX) stats.masteredCount += 1;
  }

  const overallPercent = families.length ? Math.round((totalBoxSum / (families.length * MAX_BOX)) * 100) : 0;

  const byGroup = [...groupStats.entries()].map(([key, stats]) => ({
    groupId: key,
    label: GROUP_LABELS[key] ?? key,
    percent: stats.total ? Math.round((stats.boxSum / (stats.total * MAX_BOX)) * 100) : 0,
    masteredCount: stats.masteredCount,
    total: stats.total,
  }));

  return { overallPercent, byGroup };
}
