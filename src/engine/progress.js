// Calcule la progression réelle à partir des paliers Leitner — jamais un score
// décoratif déconnecté de la mémorisation. % = moyenne des paliers (0-4) des
// familles, normalisée sur le palier maximal.

import { MAX_BOX } from './leitner.js';

const GROUP_LABELS = {
  'zeros-uns': '×0 et ×1',
  'deux-cinq-dix': '×2, ×5, ×10',
  carres: 'Les carrés',
  'quatre-huit': '×4 et ×8',
  'trois-six': '×3 et ×6',
  neuf: '×9',
  'sept-et-reste': '×7 et le reste',
  'passage-dizaine': 'Additions qui passent la dizaine',
  connues: 'Additions déjà connues',
};

export function computeProgress(families, cardsById) {
  const groupStats = new Map();
  let totalBoxSum = 0;

  for (const family of families) {
    const card = cardsById.get(family.id);
    const box = card ? card.box : 0;
    totalBoxSum += box;

    if (!groupStats.has(family.introGroup)) {
      groupStats.set(family.introGroup, { total: 0, boxSum: 0, masteredCount: 0 });
    }
    const stats = groupStats.get(family.introGroup);
    stats.total += 1;
    stats.boxSum += box;
    if (box >= MAX_BOX) stats.masteredCount += 1;
  }

  const overallPercent = families.length ? Math.round((totalBoxSum / (families.length * MAX_BOX)) * 100) : 0;

  const byGroup = [...groupStats.entries()].map(([groupId, stats]) => ({
    groupId,
    label: GROUP_LABELS[groupId] ?? groupId,
    percent: stats.total ? Math.round((stats.boxSum / (stats.total * MAX_BOX)) * 100) : 0,
    masteredCount: stats.masteredCount,
    total: stats.total,
  }));

  return { overallPercent, byGroup };
}
