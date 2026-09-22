// Génération des "familles de faits" (1 à 12) et de leur ordre d'introduction pédagogique.
// Une famille de faits regroupe toutes les questions qui partagent la même mémorisation
// (ex. 6×7, 7×6, 42÷6, 42÷7 sont une seule famille : une fois le fait su, les 4 vues le sont).

const RANGE_MIN = 0;
const RANGE_MAX = 12;

function canonicalPair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

// Ordre d'introduction des familles ×/÷, par structure plutôt que 1,2,3...12.
// Chaque famille est assignée au premier groupe qui la couvre ; le dernier groupe
// ("reste") récupère automatiquement tout ce qui n'a pas encore été assigné
// (ex. 6×7, 7×8, 7×9, 11×12...) sans qu'on ait à les lister à la main.
const MULT_INTRO_GROUPS = [
  { id: 'zeros-uns', label: '×0 et ×1', bValues: [0, 1] },
  { id: 'deux-cinq-dix', label: '×2, ×5, ×10', bValues: [2, 5, 10] },
  { id: 'carres', label: 'Les carrés', bValues: 'squares' },
  { id: 'quatre-huit', label: '×4 et ×8', bValues: [4, 8] },
  { id: 'trois-six', label: '×3 et ×6', bValues: [3, 6] },
  { id: 'neuf', label: '×9', bValues: [9] },
  { id: 'sept-et-reste', label: '×7 et les faits restants', bValues: 'remainder' },
];

function buildMultiplicationFamilies() {
  const assigned = new Map(); // "a,b" -> groupId
  const groupOrder = [];

  function keyOf([a, b]) {
    return `${a},${b}`;
  }

  for (const group of MULT_INTRO_GROUPS) {
    groupOrder.push(group.id);
    if (group.bValues === 'squares') {
      for (let n = RANGE_MIN; n <= RANGE_MAX; n++) {
        const pair = canonicalPair(n, n);
        const key = keyOf(pair);
        if (!assigned.has(key)) assigned.set(key, group.id);
      }
    } else if (group.bValues === 'remainder') {
      for (let a = RANGE_MIN; a <= RANGE_MAX; a++) {
        for (let b = a; b <= RANGE_MAX; b++) {
          const key = keyOf([a, b]);
          if (!assigned.has(key)) assigned.set(key, group.id);
        }
      }
    } else {
      for (const b of group.bValues) {
        for (let a = RANGE_MIN; a <= RANGE_MAX; a++) {
          const pair = canonicalPair(a, b);
          const key = keyOf(pair);
          if (!assigned.has(key)) assigned.set(key, group.id);
        }
      }
    }
  }

  const families = [];
  for (const [key, groupId] of assigned) {
    const [a, b] = key.split(',').map(Number);
    families.push({
      id: `mult-${a}x${b}`,
      operation: 'mult-div',
      a,
      b,
      result: a * b,
      introGroup: groupId,
    });
  }
  families.sort((f1, f2) => groupOrder.indexOf(f1.introGroup) - groupOrder.indexOf(f2.introGroup));
  return families;
}

// Addition/soustraction : on suppose qu'un enfant de 10 ans maîtrise déjà une bonne partie
// des faits 1-12. On priorise les faits qui "passent la dizaine" (ex. 7+8=15), statistiquement
// les plus lents/erronés ; le reste existe dans le système mais démarre en priorité basse.
function crossesTen(a, b) {
  return a <= 9 && b <= 9 && a + b >= 10;
}

function buildAdditionFamilies() {
  const families = [];
  const seen = new Set();
  for (let a = 1; a <= RANGE_MAX; a++) {
    for (let b = a; b <= RANGE_MAX; b++) {
      const key = `${a},${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      families.push({
        id: `add-${a}+${b}`,
        operation: 'add-sub',
        a,
        b,
        result: a + b,
        introGroup: crossesTen(a, b) ? 'passage-dizaine' : 'connues',
      });
    }
  }
  families.sort((f1, f2) => (f1.introGroup === f2.introGroup ? 0 : f1.introGroup === 'passage-dizaine' ? -1 : 1));
  return families;
}

// Les 4 vues jouables d'une famille ×/÷ : a×b, b×a, résultat÷a, résultat÷b.
// Les vues de division ne sont exposées par le moteur (getUnlockedViews) qu'une fois
// la famille jugée "maîtrisée" (voir leitner.js), donc elles ne sont pas listées ici
// comme faits à part — juste comme vues alternatives de la même famille.
function multDivViews(family) {
  const { a, b, result } = family;
  const views = [
    { kind: 'mult', prompt: [a, '×', b], answer: result },
  ];
  if (a !== b) views.push({ kind: 'mult', prompt: [b, '×', a], answer: result });
  if (a !== 0 && b !== 0) {
    views.push({ kind: 'div', prompt: [result, '÷', a], answer: b });
    if (a !== b) views.push({ kind: 'div', prompt: [result, '÷', b], answer: a });
  }
  return views;
}

function addSubViews(family) {
  const { a, b, result } = family;
  const views = [
    { kind: 'add', prompt: [a, '+', b], answer: result },
  ];
  if (a !== b) views.push({ kind: 'add', prompt: [b, '+', a], answer: result });
  views.push({ kind: 'sub', prompt: [result, '−', a], answer: b });
  if (a !== b) views.push({ kind: 'sub', prompt: [result, '−', b], answer: a });
  return views;
}

export function buildAllFamilies() {
  return [...buildMultiplicationFamilies(), ...buildAdditionFamilies()];
}

export function viewsForFamily(family) {
  return family.operation === 'mult-div' ? multDivViews(family) : addSubViews(family);
}

export const MULT_INTRO_GROUP_ORDER = MULT_INTRO_GROUPS.map((g) => g.id);
export const ADD_INTRO_GROUP_ORDER = ['passage-dizaine', 'connues'];
