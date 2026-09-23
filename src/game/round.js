// Construit un round jouable (une question, deux réponses) à partir d'une famille
// de faits et de son état Leitner. Ne connaît rien au rendu.

import { viewsForFamily } from '../engine/facts.js';
import { getUnlockedViews } from '../engine/leitner.js';
import { strategyHint } from '../engine/strategies.js';

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Distracteurs plausibles plutôt qu'aléatoires : pour ×, les produits voisins
// (une ligne/colonne à côté) ; pour ÷, le facteur voisin ; pour +/−, les erreurs
// de report les plus fréquentes (±1, ±9, ±10).
function distractorsFor(view, family) {
  const { kind, answer } = view;
  const candidates = new Set();

  if (kind === 'mult') {
    const neighbors = [
      family.a * Math.max(0, family.b - 1),
      family.a * (family.b + 1),
      Math.max(0, family.a - 1) * family.b,
      (family.a + 1) * family.b,
    ];
    for (const n of neighbors) if (n !== answer && n >= 0) candidates.add(n);
  } else if (kind === 'div') {
    for (const offset of [1, -1, 2, -2]) {
      const n = answer + offset;
      if (n !== answer && n >= 0) candidates.add(n);
    }
  } else {
    for (const offset of [1, -1, 10, -10, 9, -9]) {
      const n = answer + offset;
      if (n !== answer && n >= 0) candidates.add(n);
    }
  }
  return [...candidates];
}

export function buildRound(family, card, timeBudgetMs, showHint = false, studyTimeMs = null) {
  const allViews = viewsForFamily(family);
  const unlockedViews = getUnlockedViews(family, card, allViews);
  const view = randomChoice(unlockedViews);
  const distractors = distractorsFor(view, family);
  const distractor = randomChoice(distractors.length ? distractors : [view.answer + 1]);
  const choices = Math.random() < 0.5 ? [view.answer, distractor] : [distractor, view.answer];

  return {
    familyId: family.id,
    prompt: view.prompt,
    correctAnswer: view.answer,
    choices,
    timeBudgetMs,
    hint: showHint ? strategyHint(family) : null,
    studyTimeMs,
  };
}
