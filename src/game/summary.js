// Agrège la progression des 4 sections/opérations — utilisé par le personnage
// évolutif (qui représente la maîtrise globale, pas une seule section) et par
// la vue parent. Reste une lecture pure du stockage, aucune écriture.

import { OPERATIONS, buildOperationFamilies } from '../engine/facts.js';
import { computeProgress } from '../engine/progress.js';
import { MAX_BOX } from '../engine/leitner.js';
import { loadAllCards } from './storage.js';

export const OPERATION_LABELS = {
  addition: 'Addition',
  subtraction: 'Soustraction',
  multiplication: 'Multiplication',
  division: 'Division',
};

export function computeAllOperationsProgress() {
  const cardsById = loadAllCards();
  let totalBoxSum = 0;
  let totalMax = 0;
  const perOperation = [];

  for (const operation of OPERATIONS) {
    const families = buildOperationFamilies(operation);
    const { overallPercent, byGroup } = computeProgress(families, cardsById);
    perOperation.push({ operation, label: OPERATION_LABELS[operation], percent: overallPercent, byGroup });

    for (const family of families) {
      const card = cardsById.get(family.id);
      totalBoxSum += card ? card.box : 0;
      totalMax += 1;
    }
  }

  const overallPercent = totalMax ? Math.round((totalBoxSum / (totalMax * MAX_BOX)) * 100) : 0;

  return { overallPercent, perOperation };
}
