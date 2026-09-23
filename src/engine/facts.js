// Génération des faits pour chacune des 4 opérations, traitées comme des sections
// indépendantes (chacune sa propre progression Leitner) — et de leur ordre
// d'introduction pédagogique par structure plutôt que 1,2,3...12.

function canonicalPair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

// Groupes pour ×/÷ (0 à 12) : chaque groupe numéroté enseigne la table complète
// du nombre (0 à 12) plutôt qu'une liste figée ; le dernier groupe récupère
// automatiquement tout ce qui n'a pas encore été assigné.
const MULT_DIV_INTRO_GROUPS = [
  { id: 'zeros-uns', bValues: [0, 1] },
  { id: 'deux-cinq-dix', bValues: [2, 5, 10] },
  { id: 'carres', bValues: 'squares' },
  { id: 'quatre-huit', bValues: [4, 8] },
  { id: 'trois-six', bValues: [3, 6] },
  { id: 'neuf', bValues: [9] },
  { id: 'sept-et-reste', bValues: 'remainder' },
];
export const MULT_DIV_INTRO_GROUP_ORDER = MULT_DIV_INTRO_GROUPS.map((g) => g.id);

function buildMultDivPairs(rangeMin, rangeMax) {
  const assigned = new Map();
  const keyOf = ([a, b]) => `${a},${b}`;

  for (const group of MULT_DIV_INTRO_GROUPS) {
    if (group.bValues === 'squares') {
      for (let n = rangeMin; n <= rangeMax; n++) {
        const key = keyOf(canonicalPair(n, n));
        if (!assigned.has(key)) assigned.set(key, group.id);
      }
    } else if (group.bValues === 'remainder') {
      for (let a = rangeMin; a <= rangeMax; a++) {
        for (let b = a; b <= rangeMax; b++) {
          const key = keyOf([a, b]);
          if (!assigned.has(key)) assigned.set(key, group.id);
        }
      }
    } else {
      for (const b of group.bValues) {
        for (let a = rangeMin; a <= rangeMax; a++) {
          const key = keyOf(canonicalPair(a, b));
          if (!assigned.has(key)) assigned.set(key, group.id);
        }
      }
    }
  }

  const pairs = [];
  for (const [key, introGroup] of assigned) {
    const [a, b] = key.split(',').map(Number);
    pairs.push({ a, b, introGroup });
  }
  pairs.sort((p1, p2) => MULT_DIV_INTRO_GROUP_ORDER.indexOf(p1.introGroup) - MULT_DIV_INTRO_GROUP_ORDER.indexOf(p2.introGroup));
  return pairs;
}

// Addition/soustraction (1 à 12) : on suppose qu'un enfant de 10 ans maîtrise déjà
// une bonne partie des faits 1-12. On priorise ceux qui "passent la dizaine"
// (ex. 7+8=15), statistiquement les plus lents/erronés.
export const ADD_SUB_INTRO_GROUP_ORDER = ['passage-dizaine', 'connues'];

function crossesTen(a, b) {
  return a <= 9 && b <= 9 && a + b >= 10;
}

function buildAddSubPairs() {
  const pairs = [];
  for (let a = 1; a <= 12; a++) {
    for (let b = a; b <= 12; b++) {
      pairs.push({ a, b, introGroup: crossesTen(a, b) ? 'passage-dizaine' : 'connues' });
    }
  }
  pairs.sort((p1, p2) => (p1.introGroup === p2.introGroup ? 0 : p1.introGroup === 'passage-dizaine' ? -1 : 1));
  return pairs;
}

export function buildOperationFamilies(operation) {
  if (operation === 'multiplication') {
    return buildMultDivPairs(0, 12).map(({ a, b, introGroup }) => ({
      id: `mult-${a}x${b}`,
      operation,
      a,
      b,
      result: a * b,
      introGroup,
    }));
  }
  if (operation === 'division') {
    // Diviser par 0 n'existe pas : on exclut les paires dont le facteur "a" est 0.
    return buildMultDivPairs(0, 12)
      .filter(({ a }) => a >= 1)
      .map(({ a, b, introGroup }) => ({
        id: `div-${a}x${b}`,
        operation,
        a,
        b,
        result: a * b,
        introGroup,
      }));
  }
  if (operation === 'addition') {
    return buildAddSubPairs().map(({ a, b, introGroup }) => ({
      id: `add-${a}+${b}`,
      operation,
      a,
      b,
      result: a + b,
      introGroup,
    }));
  }
  if (operation === 'subtraction') {
    return buildAddSubPairs().map(({ a, b, introGroup }) => ({
      id: `sub-${a}+${b}`,
      operation,
      a,
      b,
      result: a + b,
      introGroup,
    }));
  }
  throw new Error(`Opération inconnue : ${operation}`);
}

export const OPERATIONS = ['addition', 'subtraction', 'multiplication', 'division'];

export function introGroupOrderFor(operation) {
  return operation === 'multiplication' || operation === 'division' ? MULT_DIV_INTRO_GROUP_ORDER : ADD_SUB_INTRO_GROUP_ORDER;
}

// Faits "triviaux" : ×0, ×1, ÷1, +1, -1 (par construction, a est toujours le
// plus petit facteur/terme, donc a<=1 les capture tous). Un enfant de 10 ans
// les connaît déjà par cœur — pas besoin de les faire grimper lentement palier
// par palier comme un fait réellement à apprendre.
export function isTrivial(family) {
  return family.a <= 1;
}

// Les vues jouables d'une famille — toutes appartiennent à la même opération
// (plus de vues "inverses" débloquées entre opérations : chaque section est
// désormais indépendante).
export function viewsForFamily(family) {
  const { operation, a, b, result } = family;

  if (operation === 'multiplication') {
    const views = [{ kind: 'mult', prompt: [a, '×', b], answer: result }];
    if (a !== b) views.push({ kind: 'mult', prompt: [b, '×', a], answer: result });
    return views;
  }
  if (operation === 'division') {
    const views = [{ kind: 'div', prompt: [result, '÷', a], answer: b }];
    if (a !== b) views.push({ kind: 'div', prompt: [result, '÷', b], answer: a });
    return views;
  }
  if (operation === 'addition') {
    const views = [{ kind: 'add', prompt: [a, '+', b], answer: result }];
    if (a !== b) views.push({ kind: 'add', prompt: [b, '+', a], answer: result });
    return views;
  }
  // subtraction
  const views = [{ kind: 'sub', prompt: [result, '−', a], answer: b }];
  if (a !== b) views.push({ kind: 'sub', prompt: [result, '−', b], answer: a });
  return views;
}
