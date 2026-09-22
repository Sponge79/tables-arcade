// Moteur de mémorisation (paliers Leitner + sélection quotidienne des faits dus).
// Ce module ne connaît rien au rendu / à l'arcade : il répond uniquement à
// "où en est ce fait ?" et "quels faits sont dus aujourd'hui ?".

export const MAX_BOX = 4;

// Jours avant la prochaine révision, selon le palier atteint après la réponse.
// Palier 0 : "revoir dans la même session, puis le lendemain" — le lendemain
// correspond à cet intervalle de 1 jour ; le "même session" est géré par le fait
// qu'une erreur remet dueDate à aujourd'hui (voir recordAnswer).
const INTERVAL_DAYS = [1, 3, 7, 18, 30];

// Nombre de bons rappels à des moments espacés (jours différents) nécessaires
// pour monter de palier — une seule bonne réponse ne prouve pas la mémorisation.
const PROMOTION_THRESHOLD = 3;

// Palier à partir duquel les vues "inverses" d'une famille (division, soustraction)
// sont considérées comme une simple relecture d'un fait déjà solide plutôt qu'un
// nouvel apprentissage — voir section 1.2 du prompt produit.
const DIVISION_UNLOCK_BOX = 2;
const SUBTRACTION_UNLOCK_BOX = 1;

export function createCard(familyId, today) {
  return {
    familyId,
    box: 0,
    dueDate: today,
    spacedCorrectStreak: 0,
    lastCorrectDate: null,
    lastSeenDate: null,
    totalSeen: 0,
  };
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isDue(card, today) {
  return card.dueDate <= today;
}

export function recordAnswer(card, correct, today) {
  const next = { ...card, lastSeenDate: today, totalSeen: card.totalSeen + 1 };

  if (!correct) {
    next.box = 0;
    next.spacedCorrectStreak = 0;
    next.lastCorrectDate = null;
    next.dueDate = today;
    return next;
  }

  if (next.lastCorrectDate !== today) {
    next.spacedCorrectStreak = card.spacedCorrectStreak + 1;
    next.lastCorrectDate = today;
  }

  if (next.spacedCorrectStreak >= PROMOTION_THRESHOLD && next.box < MAX_BOX) {
    next.box = card.box + 1;
    next.spacedCorrectStreak = 0;
  }

  next.dueDate = addDays(today, INTERVAL_DAYS[next.box]);
  return next;
}

export function getUnlockedViews(family, card, allViews) {
  const box = card ? card.box : -1;
  if (family.operation === 'mult-div') {
    return box >= DIVISION_UNLOCK_BOX ? allViews : allViews.filter((v) => v.kind === 'mult');
  }
  return box >= SUBTRACTION_UNLOCK_BOX ? allViews : allViews.filter((v) => v.kind === 'add');
}

// Un groupe d'introduction est "ouvert" une fois que toutes les familles du groupe
// précédent (même type d'opération) ont déjà été vues au moins une fois — pas besoin
// d'être maîtrisées, juste introduites, pour ne pas bloquer la progression.
function openIntroGroups(families, cardsById, groupOrder) {
  const familiesByGroup = new Map(groupOrder.map((g) => [g, []]));
  for (const f of families) familiesByGroup.get(f.introGroup).push(f);

  const open = new Set();
  let previousGroupFullyIntroduced = true;
  for (const groupId of groupOrder) {
    if (!previousGroupFullyIntroduced) break;
    open.add(groupId);
    const groupFamilies = familiesByGroup.get(groupId) ?? [];
    previousGroupFullyIntroduced = groupFamilies.every((f) => cardsById.has(f.id));
  }
  return open;
}

// Décide quels faits sont dus aujourd'hui : les révisions (familles déjà en cours,
// dueDate atteinte) et les nouveautés (familles jamais vues, plafonnées par session,
// prises uniquement dans un groupe d'introduction déjà ouvert).
export function selectDailyFacts(families, cardsById, today, options = {}) {
  const { maxNewFacts = 4, multIntroGroupOrder = [], addIntroGroupOrder = [] } = options;

  const reviewFamilies = [];
  for (const family of families) {
    const card = cardsById.get(family.id);
    if (card && isDue(card, today)) reviewFamilies.push(family);
  }

  const multFamilies = families.filter((f) => f.operation === 'mult-div');
  const addFamilies = families.filter((f) => f.operation === 'add-sub');
  const openMultGroups = openIntroGroups(multFamilies, cardsById, multIntroGroupOrder);
  const openAddGroups = openIntroGroups(addFamilies, cardsById, addIntroGroupOrder);

  const newFamilies = [];
  for (const family of families) {
    if (newFamilies.length >= maxNewFacts) break;
    if (cardsById.has(family.id)) continue;
    const openGroups = family.operation === 'mult-div' ? openMultGroups : openAddGroups;
    if (openGroups.has(family.introGroup)) newFamilies.push(family);
  }

  return { reviewFamilies, newFamilies };
}
